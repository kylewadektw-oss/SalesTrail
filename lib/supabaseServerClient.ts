// Server-only Supabase client (use only in server code / API routes)
// IMPORTANT: do NOT expose SUPABASE_SERVICE_ROLE_KEY to the browser.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase server env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your server environment.'
  )
}

// This client has elevated privileges. Use only on the server.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
