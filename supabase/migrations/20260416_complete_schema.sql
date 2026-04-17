-- ============================================
-- Adjil BNPL - Complete Auth & Schema Migration
-- Run this in Supabase Dashboard > SQL Editor
-- Project: ADJIL.BNPL V2 (znlieqvasitebeyinrxi)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. USERS TABLE - Add missing columns
-- ============================================

-- Add columns to existing users table if not exists
DO $$
BEGIN
    -- Basic info columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
        ALTER TABLE public.users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        ALTER TABLE public.users ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE public.users ADD COLUMN phone TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE public.users ADD COLUMN role TEXT CHECK (role IN ('customer', 'merchant', 'admin', 'administrator', 'support', 'partner', 'ceo'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended', 'frozen', 'blacklisted'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'balance') THEN
        ALTER TABLE public.users ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0 CHECK (balance >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'outstanding') THEN
        ALTER TABLE public.users ADD COLUMN outstanding DECIMAL(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'credit_limit') THEN
        ALTER TABLE public.users ADD COLUMN credit_limit DECIMAL(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_plan') THEN
        ALTER TABLE public.users ADD COLUMN subscription_plan TEXT CHECK (subscription_plan IN ('monthly', '6months', 'annual'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pin') THEN
        ALTER TABLE public.users ADD COLUMN pin TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'card_number') THEN
        ALTER TABLE public.users ADD COLUMN card_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'activity') THEN
        ALTER TABLE public.users ADD COLUMN activity TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'location') THEN
        ALTER TABLE public.users ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'wilaya') THEN
        ALTER TABLE public.users ADD COLUMN wilaya TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'coords') THEN
        ALTER TABLE public.users ADD COLUMN coords TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE public.users ADD COLUMN username TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'frozen_at') THEN
        ALTER TABLE public.users ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'blacklist_due_at') THEN
        ALTER TABLE public.users ADD COLUMN blacklist_due_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'risk_score') THEN
        ALTER TABLE public.users ADD COLUMN risk_score INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_id_front') THEN
        ALTER TABLE public.users ADD COLUMN doc_id_front TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_id_back') THEN
        ALTER TABLE public.users ADD COLUMN doc_id_back TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_payslip') THEN
        ALTER TABLE public.users ADD COLUMN doc_payslip TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_rib') THEN
        ALTER TABLE public.users ADD COLUMN doc_rib TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_commercial_register') THEN
        ALTER TABLE public.users ADD COLUMN doc_commercial_register TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'doc_contract') THEN
        ALTER TABLE public.users ADD COLUMN doc_contract TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'document_urls') THEN
        ALTER TABLE public.users ADD COLUMN document_urls JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'synced') THEN
        ALTER TABLE public.users ADD COLUMN synced BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_synced_at') THEN
        ALTER TABLE public.users ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
CREATE POLICY "Allow public read access on users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on users" ON public.users;
CREATE POLICY "Allow public insert access on users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on users" ON public.users;
CREATE POLICY "Allow public update access on users" ON public.users FOR UPDATE USING (true);

-- ============================================
-- 2. STAFF TABLE - Add columns to existing table
-- ============================================

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS institution TEXT DEFAULT 'Adjil';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS reports_count INTEGER DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS messages_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff
DROP POLICY IF EXISTS "Anyone can read staff" ON public.staff;
CREATE POLICY "Anyone can read staff" ON public.staff FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert staff" ON public.staff;
CREATE POLICY "Public can insert staff" ON public.staff FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update own profile" ON public.staff;
CREATE POLICY "Staff can update own profile" ON public.staff FOR UPDATE USING (
    auth_id = auth.uid() OR 
    role IN ('ceo', 'administrator', 'admin')
);

-- Indexes
CREATE INDEX idx_staff_role ON public.staff(role);
CREATE INDEX idx_staff_email ON public.staff(email);

-- ============================================
-- 3. AUTH TRIGGER - Sync auth.users to public.users
-- ============================================

-- Function to handle new user registration via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a staff/admin registration
    -- Role is passed in user_metadata
    DECLARE
        v_role TEXT;
        v_name TEXT;
    BEGIN
        v_role := NEW.raw_user_meta_data->>'role';
        v_name := NEW.raw_user_meta_data->>'full_name';
        
        -- Determine role (default to customer if not specified)
        IF v_role IS NULL THEN
            v_role := 'customer';
        END IF;
        
        IF v_name IS NULL THEN
            v_name := NEW.email;
        END IF;
        
        -- Insert into public.users
        INSERT INTO public.users (
            id,
            email,
            name,
            role,
            status,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            NEW.email,
            v_name,
            v_role,
            'active',
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            updated_at = NOW();
        
        -- If staff role, also insert into staff table
        IF v_role IN ('ceo', 'administrator', 'admin', 'partner', 'support') THEN
            INSERT INTO public.staff (
                id,
                auth_id,
                email,
                first_name,
                last_name,
                role,
                is_active,
                created_at
            )
            VALUES (
                gen_random_uuid(),
                NEW.id,
                NEW.email,
                SPLIT_PART(v_name, ' ', 1),
                SUBSTRING(v_name FROM POSITION(' ' IN v_name) + 1),
                v_role,
                TRUE,
                NOW()
            )
            ON CONFLICT (email) DO NOTHING;
        END IF;
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. TRANSACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id UUID REFERENCES public.users(id),
    merchant_id UUID REFERENCES public.users(id),
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    method TEXT DEFAULT 'BNPL_DIRECT',
    idempotency_key TEXT UNIQUE,
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    merchant_name TEXT,
    merchant_pin TEXT,
    merchant_activity TEXT,
    merchant_location TEXT,
    customer_name TEXT,
    customer_card TEXT,
    invoice_number TEXT,
    store_number TEXT,
    payment_channel TEXT,
    cash_collected BOOLEAN DEFAULT FALSE,
    cash_collected_at TIMESTAMP WITH TIME ZONE,
    cash_collection_status TEXT
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on transactions" ON public.transactions;
CREATE POLICY "Allow public insert access on transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on transactions" ON public.transactions;
CREATE POLICY "Allow public update access on transactions" ON public.transactions FOR UPDATE USING (true);

-- ============================================
-- 5. SUPPORT TICKETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending'))
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert access on tickets" ON public.support_tickets;
CREATE POLICY "Allow public insert access on ticket" ON public.support_tickets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on tickets" ON public.support_tickets;
CREATE POLICY "Allow public read access on tickets" ON public.support_tickets FOR SELECT USING (true);

-- ============================================
-- 6. SUBSCRIPTION REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id),
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', '6months', 'annual')),
    credit_limit DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on subscription_requests" ON public.subscription_requests;
CREATE POLICY "Allow public read access on subscription_requests" ON public.subscription_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on subscription_requests" ON public.subscription_requests;
CREATE POLICY "Allow public insert access on subscription_requests" ON public.subscription_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on subscription_requests" ON public.subscription_requests;
CREATE POLICY "Allow public update access on subscription_requests" ON public.subscription_requests FOR UPDATE USING (true);

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to get user by email or username
CREATE OR REPLACE FUNCTION public.get_user_by_identifier(p_identifier TEXT)
RETURNS TABLE(
    id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    status TEXT,
    balance DECIMAL,
    credit_limit DECIMAL,
    card_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.balance,
        u.credit_limit,
        u.card_number
    FROM public.users u
    WHERE u.email = p_identifier OR u.username = p_identifier OR u.phone = p_identifier
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user balance
CREATE OR REPLACE FUNCTION public.update_user_balance(
    p_user_id UUID,
    p_amount DECIMAL,
    p_is_deduction BOOLEAN DEFAULT FALSE
) RETURNS JSON AS $$
DECLARE
    v_new_balance DECIMAL;
BEGIN
    IF p_is_deduction THEN
        UPDATE public.users 
        SET balance = balance - p_amount,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING balance INTO v_new_balance;
    ELSE
        UPDATE public.users 
        SET balance = balance + p_amount,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING balance INTO v_new_balance;
    END IF;
    
    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. PROCESS TRANSACTION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.process_transaction(
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

    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
            SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
            RETURN json_build_object('success', true, 'tx_id', v_tx_id, 'new_balance', v_cust_balance, 'message', 'Duplicate prevented');
        END IF;
    END IF;

    v_tx_id := 'TX-' || extract(epoch from now())::bigint || '-' || floor(random() * 10000);

    UPDATE public.users 
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;

    UPDATE public.users 
    SET balance = balance + p_amount,
        outstanding = outstanding + p_amount,
        updated_at = NOW()
    WHERE id = p_merchant_id;

    INSERT INTO public.transactions (
        id, customer_id, merchant_id, amount, method, 
        merchant_name, merchant_pin, merchant_activity, merchant_location,
        customer_name, customer_card, idempotency_key, created_at
    ) VALUES (
        v_tx_id, p_customer_id, p_merchant_id, p_amount, p_method,
        p_merchant_name, p_merchant_pin, p_merchant_activity, p_merchant_location,
        p_customer_name, p_customer_card, p_idempotency_key, NOW()
    );

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

-- ============================================
-- 9. SEED DATA
-- ============================================

-- Seed admin personnel (not linked to auth.users yet - must be created manually in Supabase Auth)
-- Use Supabase Dashboard > Authentication > Users to create these accounts
INSERT INTO public.staff (id, email, first_name, last_name, role, institution, is_active, created_at)
VALUES 
    (gen_random_uuid(), 'ceo@adjil.dz', 'المدير العام', 'عبدو', 'ceo', 'Adjil', TRUE, NOW()),
    (gen_random_uuid(), 'admin@adjil.dz', 'مسؤول', 'نظام', 'administrator', 'Adjil', TRUE, NOW()),
    (gen_random_uuid(), 'support@adjil.dz', 'الدعم', 'تقني', 'support', 'Adjil', TRUE, NOW()),
    (gen_random_uuid(), 'partner@adjil.dz', 'الشريك', 'تجاري', 'partner', 'Adjil', TRUE, NOW())
ON CONFLICT (email) DO NOTHING;

-- Seed test customer and merchant accounts
INSERT INTO public.users (id, name, email, role, status, balance, credit_limit, card_number, created_at)
VALUES 
    (gen_random_uuid(), 'الزبون التجريبي', 'customer@test.com', 'customer', 'active', 10000, 10000, '5423 0000 0000 0001', NOW()),
    (gen_random_uuid(), 'متجر الإلكترونيات', 'merchant@test.com', 'merchant', 'active', 0, 0, NULL, NOW())
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 10. REALTIME
-- ============================================

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

SELECT 'Migration completed successfully!' as result;