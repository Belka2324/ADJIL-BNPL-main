-- ============================================
-- Staff Management Migration Script
-- Date: 2026-03-12
-- Purpose: Create staff tables and migrate existing admin accounts
-- ============================================

-- ============================================
-- 1. STAFF TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Personal Info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    
    -- Professional Info
    role TEXT NOT NULL CHECK (role IN ('ceo', 'administrator', 'partner', 'support')),
    institution TEXT,
    bank_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    avatar_url TEXT,
    password_hash TEXT,
    
    -- Stats
    reports_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Staff RLS Policies
-- Users can read their own staff profile using auth.uid()
DROP POLICY IF EXISTS "Staff can read own profile" ON public.staff;
CREATE POLICY "Staff can read own profile" ON public.staff 
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can manage all staff" ON public.staff;
CREATE POLICY "Admins can manage all staff" ON public.staff 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Staff Indexes
CREATE INDEX idx_staff_role ON public.staff(role);
CREATE INDEX idx_staff_email ON public.staff(email);
CREATE INDEX idx_staff_institution ON public.staff(institution);

-- ============================================
-- 2. STAFF REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('warning', 'complaint', 'praise', 'other')),
    created_by TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own reports" ON public.staff_reports;
CREATE POLICY "Staff can read own reports" ON public.staff_reports 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage staff reports" ON public.staff_reports;
CREATE POLICY "Admins can manage staff reports" ON public.staff_reports 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Service role can manage all staff reports
DROP POLICY IF EXISTS "Service role can manage staff reports" ON public.staff_reports;
CREATE POLICY "Service role can manage staff reports" ON public.staff_reports 
    FOR ALL USING (true);

CREATE INDEX idx_staff_reports_staff_id ON public.staff_reports(staff_id);

-- ============================================
-- 3. STAFF COMMUNICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT,
    direction TEXT CHECK (direction IN ('incoming', 'outgoing'))
);

-- Enable RLS
ALTER TABLE public.staff_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own communications" ON public.staff_communications;
CREATE POLICY "Staff can read own communications" ON public.staff_communications 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage staff communications" ON public.staff_communications;
CREATE POLICY "Admins can manage staff communications" ON public.staff_communications 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Service role can manage all staff communications
DROP POLICY IF EXISTS "Service role can manage staff communications" ON public.staff_communications;
CREATE POLICY "Service role can manage staff communications" ON public.staff_communications 
    FOR ALL USING (true);

CREATE INDEX idx_staff_communications_staff_id ON public.staff_communications(staff_id);

-- ============================================
-- 4. INSTITUTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    logo TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read institutions" ON public.institutions;
CREATE POLICY "Anyone can read institutions" ON public.institutions 
    FOR SELECT USING (true);

-- Seed Institutions Data
INSERT INTO public.institutions (code, name, name_en, name_fr, logo) VALUES
    ('BNA', 'البنك الوطني الجزائري', 'Banque Nationale d''Algérie', 'BNA', '/assets/banks/bna.png'),
    ('BADR', 'بنك الفلاحة والتنمية Rural', 'Banque Agriculture et Développement Rural', 'BADR', '/assets/banks/badr.jpg'),
    ('CNEP', 'الصندوق الوطني للتوفير والاحتياط', 'Caisse Nationale d''Epargne et de Prévoyance', 'CNEP', '/assets/banks/cnep.png'),
    ('BEA', 'بنك خارجية الجزائر', 'Banque Extérieure d''Algérie', 'BEA', '/assets/banks/bea.jpg'),
    ('CCP', 'بريد الجزائر - CCP', 'Algerie Poste - CCP', 'CCP', '/assets/banks/ccp.png'),
    ('BNP', 'بي إن بي باريبا', 'BNP Paribas', 'BNP', '/assets/banks/bnp.png')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. MIGRATION: Move existing admin users to staff table
-- ============================================

-- This is a template for migrating existing admin accounts
-- Run this after creating the staff table to migrate existing admin users

/*
-- Example migration query:
INSERT INTO public.staff (first_name, last_name, email, phone, address, role, institution, is_active)
SELECT 
    SPLIT_PART(name, ' ', 1) as first_name,
    SUBSTRING(name FROM POSITION(' ' IN name) + 1) as last_name,
    email,
    phone,
    location,
    role,
    'Adjil HQ' as institution,
    CASE WHEN status = 'active' THEN TRUE ELSE FALSE END
FROM public.users
WHERE role IN ('admin', 'administrator', 'ceo')
ON CONFLICT (email) DO NOTHING;
*/

-- ============================================
-- 6. DATA SEGREGATION: Update existing queries
-- ============================================

-- Create a view to separate staff from customers/merchants
CREATE OR REPLACE VIEW public.v_staff_users AS
SELECT id, email, name, role, status, created_at
FROM public.users
WHERE role IN ('admin', 'administrator', 'ceo');

CREATE OR REPLACE VIEW public.v_customer_users AS
SELECT id, email, name, role, status, created_at
FROM public.users
WHERE role = 'customer';

CREATE OR REPLACE VIEW public.v_merchant_users AS
SELECT id, email, name, role, status, created_at
FROM public.users
WHERE role = 'merchant';
