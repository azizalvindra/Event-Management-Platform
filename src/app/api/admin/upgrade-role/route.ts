// src/app/api/admin/upgrade-role/route.ts
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars for admin route')
}

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

type Body = { userId?: unknown; role?: unknown }

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as unknown
    const body = raw as Body

    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json({ error: 'userId (string) required' }, { status: 400 })
    }
    if (!body.role || typeof body.role !== 'string') {
      return NextResponse.json({ error: 'role (string) required' }, { status: 400 })
    }
    const allowedRoles = ['customer', 'event_organizer', 'admin']
    if (!allowedRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role: body.role })
      .eq('id', body.userId)
      .select()
      .single()

    if (error) {
      console.error('upgrade role err', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, data }, { status: 200 })
  } catch (err) {
    console.error('admin upgrade error', err)
    return NextResponse.json({ error: (err as Error)?.message ?? 'server error' }, { status: 500 })
  }
}
