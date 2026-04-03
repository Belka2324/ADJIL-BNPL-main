-- Create support tickets table (non-breaking, preserves existing schema)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_id column if it doesn't exist (for existing tables)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_tickets' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.support_tickets ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $;

-- Enable RLS for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Support tickets policies
-- Anyone can create a ticket
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create tickets" ON public.support_tickets 
    FOR INSERT WITH CHECK (true);

-- Users can read their own tickets
DROP POLICY IF EXISTS "Users can read own tickets" ON public.support_tickets;
CREATE POLICY "Users can read own tickets" ON public.support_tickets 
    FOR SELECT USING (user_id = auth.uid());

-- Admins can read all tickets
DROP POLICY IF EXISTS "Admins can read all tickets" ON public.support_tickets;
CREATE POLICY "Admins can read all tickets" ON public.support_tickets 
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Service role can manage all tickets
DROP POLICY IF EXISTS "Service role can manage tickets" ON public.support_tickets;
CREATE POLICY "Service role can manage tickets" ON public.support_tickets 
    FOR ALL USING (true);

