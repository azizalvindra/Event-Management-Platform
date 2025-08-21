// FILE: src/app/api/auth/session/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    // Accept either { session } (preferred) or { access_token, expires_at }
    let session = body?.session ?? null

    if (!session) {
      const access_token = body?.access_token ?? null
      const expires_at = body?.expires_at ?? null
      if (!access_token) {
        return NextResponse.json({ error: 'Missing session or access_token' }, { status: 400 })
      }
      session = {
        access_token,
        expires_at, // could be null
      }
    }

    // Build cookie value as JSON string (so server-side parsing mudah)
    const cookieValue = JSON.stringify(session)

    // compute maxAge in seconds
    let maxAge = 60 * 60 * 24 * 7 // default 7 days
    // if session.expires_at is present and appears like unix timestamp (seconds)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (typeof session.expires_at === 'number') {
      const maybeMax = session.expires_at - nowSeconds
      if (maybeMax > 0) maxAge = maybeMax
    } else if (typeof session.expires_in === 'number') {
      maxAge = session.expires_in
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set({
      name: 'sb:token',
      value: cookieValue,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.max(60, maxAge), // minimal 60 detik
    })

    return res
  } catch (err) {
    console.error('session route error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
