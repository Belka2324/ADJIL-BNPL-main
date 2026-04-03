-- Adjil BNPL - Database Setup
-- Run this file to create tables, security policies, and functions.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Users Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Basic Info
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Legacy/Simple auth fallback
    phone TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'merchant')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Financials
    balance DECIMAL(12, 2) DEFAULT 0 CHECK (balance >= 0),
    outstanding DECIMAL(12, 2) DEFAULT 0, -- For merchants: pending receivables
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    subscription_plan TEXT CHECK (subscription_plan IN ('monthly', '6months', 'annual')),
    
    -- Payment Details
    pin TEXT, -- 4 digit PIN for transactions
    card_number TEXT, -- Generated card number for customers
    
    -- Merchant Specific
    activity TEXT, -- Business activity type
    location TEXT, -- Address/Location text
    wilaya TEXT, -- State/Province
    coords TEXT, -- GPS Coordinates "lat,lng"
    
    -- Documents (stored as file paths/URLs)
    doc_id_front TEXT,
    doc_id_back TEXT,
    doc_payslip TEXT,
    doc_rib TEXT,
    doc_commercial_register TEXT,
    doc_contract TEXT,
    
    -- Metadata
    synced BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 2. Transactions Table
-- ==========================================
-- Ensure id is TEXT (alter if exists as UUID from previous setup)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relations
    customer_id UUID REFERENCES public.users(id),
    merchant_id UUID REFERENCES public.users(id),
    
    -- Transaction Details
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    method TEXT DEFAULT 'BNPL_DIRECT',
    idempotency_key TEXT UNIQUE,
    
    -- Snapshot Data (Historical integrity)
    merchant_name TEXT,
    merchant_pin TEXT,
    merchant_activity TEXT,
    merchant_location TEXT,
    customer_name TEXT,
    customer_card TEXT
);

-- Fix: If table exists but id is UUID, alter it to TEXT
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN 
        ALTER TABLE public.transactions ALTER COLUMN id TYPE TEXT;
    END IF; 
END $$;

-- ==========================================
-- 3. Support Tickets Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending'))
);

-- ==========================================
-- 4. Security (Row Level Security)
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for Users
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
CREATE POLICY "Allow public read access on users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on users" ON public.users;
CREATE POLICY "Allow public insert access on users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on users" ON public.users;
CREATE POLICY "Allow public update access on users" ON public.users FOR UPDATE USING (true);

-- Policies for Transactions
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on transactions" ON public.transactions;
CREATE POLICY "Allow public insert access on transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on transactions" ON public.transactions;
CREATE POLICY "Allow public update access on transactions" ON public.transactions FOR UPDATE USING (true);

-- Policies for Support Tickets
DROP POLICY IF EXISTS "Allow public insert access on tickets" ON public.support_tickets;
CREATE POLICY "Allow public insert access on tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on tickets" ON public.support_tickets;
CREATE POLICY "Allow public read access on tickets" ON public.support_tickets FOR SELECT USING (true);

-- ==========================================
-- 5. Functions & Procedures
-- ==========================================

-- Function to handle atomic transaction processing
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
) RETURNS JSON AS $$
DECLARE
    v_cust_balance DECIMAL;
    v_cust_status TEXT;
    v_tx_id TEXT;
    v_low_balance_alert BOOLEAN := FALSE;
BEGIN
    -- 1. Check customer balance and status
    SELECT balance, status INTO v_cust_balance, v_cust_status 
    FROM public.users 
    WHERE id = p_customer_id 
    FOR UPDATE;
    
    IF v_cust_status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Account is not active');
    END IF;

    IF v_cust_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- 2. Check for duplicate transaction (idempotency)
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
            SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
            RETURN json_build_object('success', true, 'tx_id', v_tx_id, 'new_balance', v_cust_balance, 'message', 'Duplicate prevented');
        END IF;
    END IF;

    -- 3. Generate Transaction ID
    v_tx_id := 'TX-' || extract(epoch from now())::bigint || '-' || floor(random() * 10000);

    -- 4. Deduct from customer
    UPDATE public.users 
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- 5. Add to merchant
    UPDATE public.users 
    SET balance = balance + p_amount,
        outstanding = outstanding + p_amount,
        updated_at = NOW()
    WHERE id = p_merchant_id;

    -- 6. Record transaction
    INSERT INTO public.transactions (
        id, customer_id, merchant_id, amount, method, 
        merchant_name, merchant_pin, merchant_activity, merchant_location,
        customer_name, customer_card, idempotency_key, created_at
    ) VALUES (
        v_tx_id, p_customer_id, p_merchant_id, p_amount, p_method,
        p_merchant_name, p_merchant_pin, p_merchant_activity, p_merchant_location,
        p_customer_name, p_customer_card, p_idempotency_key, NOW()
    );

    -- Check for low balance alert (e.g., < 2000 DZD)
    IF (v_cust_balance - p_amount) < 2000 THEN
        v_low_balance_alert := TRUE;
    END IF;

    RETURN json_build_object(
        'success', true, 
        'tx_id', v_tx_id, 
        'new_balance', v_cust_balance - p_amount,
        'low_balance_alert', v_low_balance_alert
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
