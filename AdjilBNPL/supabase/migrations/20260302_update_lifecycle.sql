
-- 1. Update Users Table Schema
-- Add new columns for lifecycle and wallet management
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT CHECK (subscription_plan IN ('monthly', '6months', 'annual')),
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding DECIMAL(12, 2) DEFAULT 0;

-- Ensure Balance Non-Negative Constraint
-- This prevents the balance from dropping below zero at the database level
ALTER TABLE public.users 
ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

-- 2. Create Transaction Processing RPC
-- This function handles the transaction atomically to prevent race conditions
CREATE OR REPLACE FUNCTION process_transaction(
    p_customer_id UUID,
    p_merchant_id UUID,
    p_amount DECIMAL,
    p_method TEXT,
    p_merchant_name TEXT,
    p_customer_name TEXT,
    p_customer_card TEXT,
    p_merchant_pin TEXT DEFAULT NULL,
    p_merchant_activity TEXT DEFAULT NULL,
    p_merchant_location TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_balance DECIMAL;
    v_customer_status TEXT;
    v_new_balance DECIMAL;
    v_tx_id TEXT;
    v_created_at TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- 1. Lock Customer Row & Check Balance/Status
    -- FOR UPDATE ensures no other transaction can modify this user concurrently
    SELECT balance, status INTO v_customer_balance, v_customer_status
    FROM public.users
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;

    IF v_customer_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is inactive');
    END IF;

    IF v_customer_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- 2. Check Idempotency (Optional but good practice)
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Duplicate transaction');
        END IF;
    END IF;

    -- 3. Perform Transfer
    v_new_balance := v_customer_balance - p_amount;

    -- Deduct from Customer
    UPDATE public.users 
    SET balance = v_new_balance 
    WHERE id = p_customer_id;

    -- Add to Merchant (Locking not strictly necessary if we don't enforce limits on merchant, but good for consistency)
    UPDATE public.users 
    SET balance = balance + p_amount,
        outstanding = outstanding + p_amount
    WHERE id = p_merchant_id;

    -- 4. Record Transaction
    INSERT INTO public.transactions (
        amount, status, method, merchant_id, customer_id, 
        merchant_name, customer_name, customer_card, 
        merchant_pin, merchant_activity, merchant_location, idempotency_key, created_at
    ) VALUES (
        p_amount, 'completed', p_method, p_merchant_id, p_customer_id,
        p_merchant_name, p_customer_name, p_customer_card,
        p_merchant_pin, p_merchant_activity, p_merchant_location, p_idempotency_key, v_created_at
    ) RETURNING id INTO v_tx_id;

    -- 5. Return Success & Notification Flag
    RETURN jsonb_build_object(
        'success', true, 
        'tx_id', v_tx_id, 
        'new_balance', v_new_balance,
        'low_balance_alert', (v_new_balance <= 2000)
    );

EXCEPTION WHEN OTHERS THEN
    -- Rollback happens automatically on error
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
