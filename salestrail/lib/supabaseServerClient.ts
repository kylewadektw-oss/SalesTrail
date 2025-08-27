import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const SUPABASE_ENABLED = Boolean(supabaseUrl && serviceRoleKey)

export const supabaseAdmin = SUPABASE_ENABLED
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : (null as unknown as ReturnType<typeof createClient>)
