-- ============================================
-- Adjil BNPL - Complete Database Schema
-- Version: 2026-03-09
-- Project: Adjil Buy Now Pay Later (Algeria)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 0. AUTH INTEGRATION - Profiles Table & Trigger
-- ============================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text,
  full_name text,
  phone text,
  role text DEFAULT 'customer',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function: Auto-create profile AND user entry when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile in public.profiles
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'phone'
  );
  
  -- Also create user entry in public.users for platform compatibility
  INSERT INTO public.users (id, name, email, phone, role, status, balance, credit_limit)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    'active',
    0,
    0
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Activate the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles 
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
CREATE POLICY "Service role can manage profiles" ON public.profiles 
    FOR ALL USING (true);

-- ============================================
-- 1. CLEANUP EXISTING OBJECTS (if re-running)
-- ============================================

DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS process_transaction(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- ============================================
-- 1. USERS TABLE
-- ============================================

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Basic Info (required)
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'merchant')),
    status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended', 'local_only')),
    
    -- Financials
    balance DECIMAL(12, 2) DEFAULT 0 CHECK (balance >= 0),
    outstanding DECIMAL(12, 2) DEFAULT 0,
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    subscription_plan TEXT CHECK (subscription_plan IN ('monthly', '6months', 'annual')),
    
    -- Payment Details
    pin TEXT,
    card_number TEXT,
    
    -- Merchant Specific
    activity TEXT,
    location TEXT,
    wilaya TEXT,
    coords TEXT,
    
    -- Bank Details
    bank_rip TEXT,
    bank_rib TEXT,
    
    -- Documents
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

-- ============================================
-- 2. TRANSACTIONS TABLE
-- ============================================

CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relations
    customer_id UUID REFERENCES public.users(id),
    merchant_id UUID REFERENCES public.users(id),
    
    -- Transaction Details
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    method TEXT DEFAULT 'BNPL_DIRECT',
    idempotency_key TEXT UNIQUE,
    
    -- Snapshot Data
    merchant_name TEXT,
    merchant_pin TEXT,
    merchant_activity TEXT,
    merchant_location TEXT,
    customer_name TEXT,
    customer_card TEXT
);

-- ============================================
-- 3. SUPPORT TICKETS TABLE
-- ============================================

CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending'))
);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
CREATE POLICY "Anyone can update users" ON public.users FOR UPDATE USING (true);

-- Transactions policies
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.transactions;
CREATE POLICY "Anyone can read transactions" ON public.transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert transactions" ON public.transactions;
CREATE POLICY "Anyone can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update transactions" ON public.transactions;
CREATE POLICY "Anyone can update transactions" ON public.transactions FOR UPDATE USING (true);

-- Tickets policies
DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.support_tickets;
CREATE POLICY "Anyone can insert tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read tickets" ON public.support_tickets;
CREATE POLICY "Anyone can read tickets" ON public.support_tickets FOR SELECT USING (true);

-- ============================================
-- 5. INDEXES
-- ============================================

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_transactions_customer ON public.transactions(customer_id);
CREATE INDEX idx_transactions_merchant ON public.transactions(merchant_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created ON public.transactions(created_at);

-- ============================================
-- 6. NOTIFICATIONS TABLE (NEW)
-- ============================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can only access their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications 
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications 
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Service role policy: Allows service role to insert system notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications 
    FOR UPDATE USING (user_id = auth.uid());

-- Notifications indexes
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);

-- ============================================
-- 7. SUBSCRIPTION REQUESTS TABLE (NEW)
-- ============================================

CREATE TABLE public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', '6months', 'annual')),
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for subscription_requests
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Subscription requests policies
DROP POLICY IF EXISTS "Users can read own requests" ON public.subscription_requests;
CREATE POLICY "Users can read own requests" ON public.subscription_requests 
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create requests" ON public.subscription_requests;
CREATE POLICY "Users can create requests" ON public.subscription_requests 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own requests" ON public.subscription_requests;
CREATE POLICY "Users can update own requests" ON public.subscription_requests 
    FOR UPDATE USING (user_id = auth.uid());

-- Admin can read all requests
DROP POLICY IF EXISTS "Admins can read all requests" ON public.subscription_requests;
CREATE POLICY "Admins can read all requests" ON public.subscription_requests 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage requests" ON public.subscription_requests;
CREATE POLICY "Service role can manage requests" ON public.subscription_requests 
    FOR ALL USING (true);

-- Subscription requests indexes
CREATE INDEX idx_subscription_requests_user ON public.subscription_requests(user_id);
CREATE INDEX idx_subscription_requests_status ON public.subscription_requests(status);
CREATE INDEX idx_subscription_requests_created ON public.subscription_requests(created_at);

-- ============================================
-- 8. AUDIT LOG TABLE (NEW)
-- ============================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT
);

-- Enable RLS for audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs: Only admins can read, service role can insert
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs 
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update audit logs" ON public.audit_logs;
CREATE POLICY "Admins can update audit logs" ON public.audit_logs 
    FOR UPDATE USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);

-- ============================================
-- 8. CREDIT SCORE TABLE (NEW)
-- ============================================

CREATE TABLE public.credit_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    score INTEGER DEFAULT 500 CHECK (score >= 300 AND score <= 850),
    rating TEXT DEFAULT 'Fair' CHECK (rating IN ('Poor', 'Fair', 'Good', 'Very Good', 'Excellent')),
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    payment_history JSONB DEFAULT '[]',
    last_calculated TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for credit scores
ALTER TABLE public.credit_scores ENABLE ROW LEVEL SECURITY;

-- Credit scores: Users can read their own, admins can manage all
DROP POLICY IF EXISTS "Users can read own credit score" ON public.credit_scores;
CREATE POLICY "Users can read own credit score" ON public.credit_scores 
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all credit scores" ON public.credit_scores;
CREATE POLICY "Admins can read all credit scores" ON public.credit_scores 
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "Service role can insert credit scores" ON public.credit_scores;
CREATE POLICY "Service role can insert credit scores" ON public.credit_scores 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update credit scores" ON public.credit_scores;
CREATE POLICY "Admins can update credit scores" ON public.credit_scores 
    FOR UPDATE USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

-- Credit scores indexes
CREATE INDEX idx_credit_scores_user ON public.credit_scores(user_id);
CREATE INDEX idx_credit_scores_score ON public.credit_scores(score);

-- ============================================
-- 6. SEED DATA
-- ============================================

INSERT INTO public.users (id, name, email, password, role, status, balance, credit_limit, outstanding, pin, card_number, activity, location, coords, wilaya)
VALUES 
    ('11111111-1111-4111-8111-111111111111', 'محمد علي', 'c@adjil.dz', '123', 'customer', 'active', 10000, 10000, 0, '1234', '5423 0000 0000 0001', NULL, NULL, NULL, NULL),
    ('22222222-2222-4222-8222-222222222222', 'متجر الإلكترونيات', 'm@adjil.dz', '123', 'merchant', 'active', 85000, 0, 12400, NULL, NULL, 'بيع الأجهزة الإلكترونية والهواتف', 'العناصر، الجزائر العاصمة', '36.7456,3.0645', '16-الجزائر'),
    ('33333333-3333-4333-8333-333333333333', 'سوبر ماركت السلام', 'qr@adjil.dz', '123', 'merchant', 'active', 0, 0, 0, NULL, NULL, 'مواد غذائية وعادة', 'باب الزوار، الجزائر العاصمة', '36.7111,3.1722', '16-الجزائر'),
    ('44444444-4444-4444-8444-444444444444', 'صيدلية الشفاء', 'phones@adjil.dz', '123', 'merchant', 'active', 0, 0, 0, NULL, NULL, 'أدوية ومستلزمات طبية', 'دالي ابراهيم، الجزائر العاصمة', '36.7588,2.9833', '16-الجزائر')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (id, created_at, amount, status, method, merchant_id, customer_id, merchant_name, customer_name, customer_card)
VALUES 
    ('TX-1710000001-001', '2026-03-23 18:20:45+00', 4500, 'completed', 'BNPL_QR', '44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'صيدلية الشفاء', 'محمد علي', '5423 0000 0000 0001'),
    ('TX-1710000002-002', '2026-03-20 11:00:00+00', 12000, 'completed', 'BNPL_DIRECT', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'متجر الإلكترونيات', 'محمد علي', '5423 0000 0000 0001'),
    ('TX-1710000003-003', '2026-03-21 15:30:00+00', 35000, 'completed', 'BNPL_DIRECT', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'متجر الإلكترونيات', 'محمد علي', '5423 0000 0000 0001'),
    ('TX-1710000004-004', '2026-03-22 10:45:00+00', 38000, 'completed', 'BNPL_DIRECT', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'متجر الإلكترونيات', 'محمد علي', '5423 0000 0000 0001')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. PROCESS TRANSACTION FUNCTION
-- ============================================

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
SECURITY DEFINER
AS $$
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
        RETURN jsonb_build_object('success', false, 'error', 'Account is not active');
    END IF;

    IF v_cust_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
            SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'new_balance', v_cust_balance, 'message', 'Duplicate prevented');
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

    RETURN jsonb_build_object(
        'success', true, 
        'tx_id', v_tx_id, 
        'new_balance', v_cust_balance - p_amount,
        'low_balance_alert', v_low_balance_alert
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION process_transaction TO anon, authenticated;

-- ============================================
-- 8. VERIFICATION
-- ============================================

SELECT 'Users:' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL
SELECT 'Transactions:', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'Tickets:', COUNT(*) FROM public.support_tickets;

-- ============================================
-- 9. ADMIN PORTAL SYNC TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_user_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjilUserId TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    firstName TEXT,
    lastName TEXT,
    name TEXT,
    phoneNumber TEXT,
    role TEXT DEFAULT 'support',
    isActive BOOLEAN DEFAULT true,
    adjilRole TEXT,
    adjilStatus TEXT,
    adjilBalance DECIMAL(12, 2),
    adjilCreditLimit DECIMAL(12, 2),
    adjilData JSONB,
    lastSyncedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_user_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read admin_user_sync" ON public.admin_user_sync;
CREATE POLICY "Anyone can read admin_user_sync" ON public.admin_user_sync FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert admin_user_sync" ON public.admin_user_sync;
CREATE POLICY "Anyone can insert admin_user_sync" ON public.admin_user_sync FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update admin_user_sync" ON public.admin_user_sync;
CREATE POLICY "Anyone can update admin_user_sync" ON public.admin_user_sync FOR UPDATE USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_admin_user_sync_adjil_user_id ON public.admin_user_sync(adjilUserId);

-- ============================================
-- 10. REALTIME PUBLICATION - Enable live updates
-- ============================================

-- Add tables to realtime publication for ADMIN-PORTAL live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
