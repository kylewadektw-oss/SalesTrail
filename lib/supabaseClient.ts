import { createClient } from '@supabase/supabase-js'

// Use safe lookups (avoid `!` non-null assertions which trigger zsh history expansion
// if the snippet is accidentally pasted into a shell)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Support either the standard anon key name or your custom publishable name
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
