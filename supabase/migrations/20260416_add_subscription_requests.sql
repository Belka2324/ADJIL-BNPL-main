-- ============================================
-- Adjil BNPL - Migration: Add subscription_requests table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- Create subscription_requests table if not exists
CREATE TABLE IF NOT EXISTS public.subscription_requests (
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

-- Enable RLS
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can read own requests" ON public.subscription_requests;
CREATE POLICY "Users can read own requests" ON public.subscription_requests 
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create requests" ON public.subscription_requests;
CREATE POLICY "Users can create requests" ON public.subscription_requests 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own requests" ON public.subscription_requests;
CREATE POLICY "Users can update own requests" ON public.subscription_requests 
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all requests" ON public.subscription_requests;
CREATE POLICY "Admins can read all requests" ON public.subscription_requests 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage requests" ON public.subscription_requests;
CREATE POLICY "Service role can manage requests" ON public.subscription_requests 
    FOR ALL USING (true);

-- Indexes
DROP INDEX IF EXISTS idx_subscription_requests_user;
CREATE INDEX idx_subscription_requests_user ON public.subscription_requests(user_id);

DROP INDEX IF EXISTS idx_subscription_requests_status;
CREATE INDEX idx_subscription_requests_status ON public.subscription_requests(status);

DROP INDEX IF EXISTS idx_subscription_requests_created;
CREATE INDEX idx_subscription_requests_created ON public.subscription_requests(created_at);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_requests;

-- Enable realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;