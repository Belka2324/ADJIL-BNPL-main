import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
const anon = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

console.log('[Supabase] ENV check:', { 
  hasUrl: !!url, 
  hasAnon: !!anon,
  urlPrefix: url.substring(0, 20),
  anonPrefix: anon.substring(0, 30)
})

export const hasSupabase = Boolean(url && anon)

export const supabase = hasSupabase ? createClient(url, anon!) : null
