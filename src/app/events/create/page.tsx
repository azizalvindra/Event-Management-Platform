// src/app/events/create/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import CreateEventForm from '@/components/CreateEventForm'
import { getUserFromCookie } from '@/lib/supabaseServer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function extractAccessTokenFromCookieValue(raw?: string | null) {
  if (!raw) return null

  // try parse JSON first
  try {
    const parsed = JSON.parse(raw)
    // common shapes used by supabase or custom implementations:
    if (parsed?.access_token) return parsed.access_token
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token
    if (parsed?.session?.access_token) return parsed.session.access_token
    // if parsed is an object but doesn't contain known keys, fallback to null
  } catch {
    // not JSON — continue to regex attempts below
  }

  // try to extract access_token from query-like string
  const accessRegex = /access_token=([^&;]+)/i
  const m = raw.match(accessRegex)
  if (m) return m[1]

  // try to extract Bearer token pattern
  const bearer = raw.match(/Bearer\s+([A-Za-z0-9-_.]+)/i)
  if (bearer) return bearer[1]

  // otherwise return raw value as last resort (maybe cookie already contains token)
  return raw
}

export default async function CreateEventPage() {

  const { user, error } = await getUserFromCookie()
  if (error || !user) return redirect('/login')

  // ambil cookie store
  const cookieStore = await cookies()

  // Coba beberapa nama cookie yang mungkin berisi session/token
  const possibleNames = [
    'sb:token',
    'sb-access-token',
    'supabase-auth-token',
    'sb:session',
    'session',
    'supabase-session',
  ]

  let tokenCookieValue: string | null = null
  for (const name of possibleNames) {
    const c = cookieStore.get(name)
    if (c?.value) {
      tokenCookieValue = c.value
      break
    }
  }

  // Kalau mau debug: (hanya saat develop) bisa lihat semua cookie names
  // const all = cookieStore.getAll?.().map(c => c.name).join(', ')
  // console.log('cookies found:', all)

  const access_token = extractAccessTokenFromCookieValue(tokenCookieValue)
  if (!access_token) {
    // token tidak ditemukan di cookie -> kemungkinan client menyimpan di localStorage
    // sehingga server-side tidak bisa baca. Redirect ke login.
    return redirect('/login')
  }

  // 1️⃣ gunakan anon client untuk validasi token & ambil user
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env var')
    return redirect('/login')
  }

  const supabaseAuthClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${access_token}` },
    },
  })

  const { data: userResult, error: userErr } = await supabaseAuthClient.auth.getUser()
  if (userErr || !userResult?.user) {
    console.error('auth.getUser error:', userErr)
    return redirect('/login')
  }
  const userId = userResult.user.id

  // 2️⃣ pakai service role untuk cek role di tabel profiles
  if (!SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var on server')
    // kalau service role key nggak ada, lebih aman redirect ke login atau 403.
    return redirect('/login')
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profileErr) {
    console.error('profile fetch error:', profileErr)
    // kalau gagal ambil profile kemungkinan row gak ada atau query error
    return redirect('/403')
  }

  if (profile?.role !== 'event_organizer') {
    return redirect('/403')
  }

  // ✅ kalau lolos semua
  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Create New Event</h1>
      <CreateEventForm userId={userId} />
    </main>
  )
}
