// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,                // set in Vercel env
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // set in Vercel env (server-only)
  { auth: { persistSession: false } }
);
