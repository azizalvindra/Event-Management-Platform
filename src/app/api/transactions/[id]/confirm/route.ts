// src/app/transactions/[id]/confirm/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment keys')
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

export async function POST(request: Request) {
  try {
    // Ambil ID transaksi dari URL path, contoh: /transactions/{id}/confirm
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[2] // sesuaikan index path sesuai struktur foldermu
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    // Ambil status transaksi sekarang dari DB
    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('status')
      .eq('id', id)
      .single()

    if (txError || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Pastikan status transaksi harus 'pending' untuk bisa dikonfirmasi
    if (tx.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot confirm transaction with status '${tx.status}'` },
        { status: 400 }
      )
    }

    // Update status transaksi menjadi 'waiting_payment' (atau status sesuai kebutuhanmu)
    const { data: updatedTx, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'waiting_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Beri response sukses dengan data transaksi terbaru
      return NextResponse.json({ message: 'Transaction confirmed', data: updatedTx })
    } catch (err) {
    if (err instanceof Error) {
      console.error('[Confirm API] Unexpected error:', err.message)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    console.error('[Confirm API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
