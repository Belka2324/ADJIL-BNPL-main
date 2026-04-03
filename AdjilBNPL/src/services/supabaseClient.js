
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL)) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)) ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

let supabase = null;

export const getSupabaseClient = () => {
    if (supabase) return supabase;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabase;
    } catch (error) {
        console.error('Supabase initialization failed:', error);
        return null;
    }
};

export default getSupabaseClient;
