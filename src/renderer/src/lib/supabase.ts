import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !anonKey) {
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env.local.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})

export const supabaseConfigured = Boolean(url && anonKey)
