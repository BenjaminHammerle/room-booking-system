import { createClient } from '@supabase/supabase-js'

// Dieser Client läuft NUR auf dem Server
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)