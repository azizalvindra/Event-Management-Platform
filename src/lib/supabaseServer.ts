// lib/supabaseServer.ts
import { cookies } from 'next/headers'
import { createClient, User } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// tipe untuk cookie session (sesuai format supabase)
type SessionCookie = {
  access_token?: string
  [key: string]: unknown
}

export async function getUserFromCookie(): Promise<{ user: User | null; error: string | null }> {
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get('sb:token')?.value
  if (!tokenCookie) return { user: null, error: 'no_cookie' }

  let session: SessionCookie
  try {
    session = JSON.parse(tokenCookie) as SessionCookie
  } catch {
    // fallback: kalau cookie berisi raw token string
    session = { access_token: tokenCookie }
  }

  const access_token = session.access_token ?? null
  if (!access_token) return { user: null, error: 'no_access_token' }

  if (!SUPABASE_URL || !ANON_KEY) return { user: null, error: 'missing_env' }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${access_token}` } }
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, error: error?.message ?? 'no_user' }
  }

  return { user: data.user, error: null }
}
