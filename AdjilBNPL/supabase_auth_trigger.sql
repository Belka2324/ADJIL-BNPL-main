-- Adjil BNPL - Supabase Auth Trigger Setup
-- Run this SQL to auto-create user profiles when signing up via Supabase Auth
-- Compatible with both supabase_setup.sql and supabase_full_schema.sql

-- ==========================================
-- 1. Ensure profiles table exists (mirrors auth.users for easier querying)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'support', 'partner', 'merchant', 'customer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'frozen', 'blacklisted')),
    business_name TEXT,
    business_type TEXT,
    state TEXT,
    city TEXT,
    document_urls JSONB DEFAULT '[]',
    risk_score INT DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public profiles are insertable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are insertable by everyone." ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public profiles are updatable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are updatable by everyone." ON public.profiles FOR UPDATE USING (true);

-- ==========================================
-- 2. Create trigger function to auto-create profile from Supabase Auth
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_name TEXT;
    v_role TEXT;
BEGIN
    -- Extract name from metadata (handle multiple possible keys)
    v_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'business_name',
        new.raw_user_meta_data->>'username',
        split_part(new.email, '@', 1)
    );
    
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'customer');

    -- Insert into profiles table
    INSERT INTO public.profiles (
        id, email, full_name, phone, role, status,
        business_name, business_type, state, city
    )
    VALUES (
        new.id,
        new.email,
        v_name,
        new.raw_user_meta_data->>'phone',
        v_role,
        'active',
        new.raw_user_meta_data->>'business_name',
        new.raw_user_meta_data->>'business_type',
        new.raw_user_meta_data->>'wilaya',
        new.raw_user_meta_data->>'city'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Also insert into users table if it exists and has different structure
    -- This handles supabase_setup.sql format
    IF to_regclass('public.users') IS NOT NULL THEN
        INSERT INTO public.users (id, email, name, phone, role, status)
        VALUES (new.id, new.email, v_name, new.raw_user_meta_data->>'phone', v_role, 'active')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. Activate the trigger on auth.users
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 4. Optional: Add staff table trigger (for ADMIN-PORTAL)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('ceo', 'administrator', 'support', 'partner')),
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS on staff
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Staff policies
DROP POLICY IF EXISTS "Allow public read access on staff" ON public.staff;
CREATE POLICY "Allow public read access on staff" ON public.staff FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on staff" ON public.staff;
CREATE POLICY "Allow public insert access on staff" ON public.staff FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on staff" ON public.staff;
CREATE POLICY "Allow public update access on staff" ON public.staff FOR UPDATE USING (true);

-- ==========================================
-- 6. Subscription Requests Table
-- ==========================================
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

-- ==========================================
-- 7. Helper function to get user email by username
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email
    FROM public.users
    WHERE username ILIKE p_username OR name ILIKE p_username
    LIMIT 1;
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;