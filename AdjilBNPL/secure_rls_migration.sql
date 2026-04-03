-- ============================================
-- Adjil BNPL - Secure RLS Migration
-- ============================================

-- Step 1: Cleanup existing objects (handling both tables and views)
-- We use a DO block to safely drop based on object type to avoid "is not a view" or "is not a table" errors
DO $$
BEGIN
    -- Handle transactions first (depends on users)
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions') THEN
        DROP TABLE public.transactions CASCADE;
    END IF;

    -- Handle support_tickets
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'support_tickets') THEN
        DROP TABLE public.support_tickets CASCADE;
    END IF;

    -- Handle users (could be table or view)
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users') THEN
        IF (SELECT relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users') = 'v' THEN
            DROP VIEW public.users CASCADE;
        ELSE
            DROP TABLE public.users CASCADE;
        END IF;
    END IF;
END $$;

-- Step 2: Recreate the users TABLE
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password TEXT,
  phone TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'merchant', 'admin', 'administrator', 'support', 'ceo', 'partner')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'local_only')),
  balance DECIMAL(12, 2) DEFAULT 0 CHECK (balance >= 0),
  outstanding DECIMAL(12, 2) DEFAULT 0,
  credit_limit DECIMAL(12, 2) DEFAULT 0,
  subscription_plan TEXT CHECK (subscription_plan IN ('monthly', '6months', 'annual')),
  pin TEXT,
  card_number TEXT,
  activity TEXT,
  location TEXT,
  wilaya TEXT,
  coords TEXT,
  bank_rip TEXT,
  bank_rib TEXT,
  doc_id_front TEXT,
  doc_id_back TEXT,
  doc_payslip TEXT,
  doc_rib TEXT,
  doc_commercial_register TEXT,
  doc_contract TEXT,
  synced BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Step 3: Recreate the transactions TABLE
CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id UUID REFERENCES public.users(id),
    merchant_id UUID REFERENCES public.users(id),
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    method TEXT DEFAULT 'BNPL_DIRECT',
    idempotency_key TEXT UNIQUE,
    merchant_name TEXT,
    merchant_pin TEXT,
    merchant_activity TEXT,
    merchant_location TEXT,
    customer_name TEXT,
    customer_card TEXT
);

-- Step 4: Recreate the support_tickets TABLE
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending'))
);

-- Step 5: Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Step 6: Enable Realtime for all tables
-- This allows the admin portal to see changes instantly
BEGIN;
  -- Remove existing publication if any
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create publication for all tables we want to sync
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.users, 
    public.transactions, 
    public.support_tickets;
COMMIT;

-- ============================================
-- 1. USERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self"
ON public.users
FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self"
ON public.users
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all"
ON public.users
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'administrator', 'support', 'ceo', 'partner')
);

-- ============================================
-- 2. TRANSACTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "tx_select_participant" ON public.transactions;
CREATE POLICY "tx_select_participant"
ON public.transactions
FOR SELECT
USING (
  customer_id = auth.uid()
  OR merchant_id = auth.uid()
);

DROP POLICY IF EXISTS "tx_insert_customer" ON public.transactions;
CREATE POLICY "tx_insert_customer"
ON public.transactions
FOR INSERT
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "tx_admin_all" ON public.transactions;
CREATE POLICY "tx_admin_all"
ON public.transactions
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'administrator', 'support', 'ceo')
);

-- ============================================
-- 3. TICKETS POLICIES
-- ============================================
DROP POLICY IF EXISTS "tickets_select_own" ON public.support_tickets;
CREATE POLICY "tickets_select_own"
ON public.support_tickets
FOR SELECT
USING (user_email = (SELECT email FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tickets_insert_any" ON public.support_tickets;
CREATE POLICY "tickets_insert_any"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "tickets_admin_all" ON public.support_tickets;
CREATE POLICY "tickets_admin_all"
ON public.support_tickets
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'administrator', 'support', 'ceo')
);

-- ============================================
-- 4. AUTH TRIGGER & HELPERS
-- ============================================

-- Function to safely lookup email by username (used for login)
-- SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT email FROM public.users WHERE username = p_username LIMIT 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================
-- 5. SEED DATA
-- ============================================
-- Ensure the CEO account exists with correct username even if created via Auth dashboard
INSERT INTO public.users (id, name, email, username, role, status)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'CEO Admin', 'admin@adjil.dz', 'admin', 'ceo', 'active')
ON CONFLICT (email) DO UPDATE 
SET username = EXCLUDED.username, 
    role = EXCLUDED.role, 
    status = EXCLUDED.status;

-- Ensure test customer account
INSERT INTO public.users (id, name, email, password, role, status, balance, credit_limit, outstanding, pin, card_number)
VALUES 
    ('11111111-1111-4111-8111-111111111111', 'محمد علي', 'c@adjil.dz', '123', 'customer', 'active', 10000, 10000, 0, '1234', '5423 0000 0000 0001')
ON CONFLICT (email) DO NOTHING;
