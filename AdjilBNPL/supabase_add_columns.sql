-- Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blacklist_due_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;