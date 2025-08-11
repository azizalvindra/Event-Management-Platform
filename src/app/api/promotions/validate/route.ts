// src/app/api/promotions/validate/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const event_id = searchParams.get('event_id')!
  let code = searchParams.get('code')!

  // normalize
  code = code.trim().toUpperCase()

  // cari promo case-insensitive
  const { data: promo, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('event_id', event_id)
    .ilike('code', code)
    .single()

  if (error || !promo) {
    return NextResponse.json(
      { error: 'Voucher tidak ditemukan' },
      { status: 404 }
    )
  }

  const now = new Date()
  const start = new Date(promo.start_date + 'T00:00:00')
  const end = new Date(promo.end_date + 'T23:59:59')

  if (promo.status !== 'active') {
    return NextResponse.json(
      { error: 'Voucher sudah non-aktif' },
      { status: 400 }
    )
  }
  if (now < start || now > end) {
    return NextResponse.json(
      { error: 'Voucher sudah kedaluwarsa' },
      { status: 400 }
    )
  }

  return NextResponse.json({ promotion: promo }, { status: 200 })
}
