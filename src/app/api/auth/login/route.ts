// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ error: 'Missing supabase env vars' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error || !data?.session) {
    // Jangan tuliskan detail error sensitif di production
    return NextResponse.json({ error: error?.message ?? 'Login failed' }, { status: 401 })
  }

  const session = data.session
  // Simpan session sebagai JSON string di cookie (supabase client biasanya menyimpan dalam bentuk ini)
  const cookieValue = JSON.stringify(session)

  const res = NextResponse.json({ ok: true, user: data.user })
  // set cookie: httpOnly agar hanya server yang bisa baca, secure di production
  res.cookies.set({
    name: 'sb:token',
    value: cookieValue,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    // maxAge: gunakan expires_in jika tersedia (detik), atau fallback 7 hari
    maxAge: typeof session.expires_in === 'number' ? session.expires_in : 60 * 60 * 24 * 7,
  })

  return res
}
