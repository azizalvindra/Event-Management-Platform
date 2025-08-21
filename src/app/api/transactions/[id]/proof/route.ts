// src/app/api/transactions/[id]/proof/route.ts
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
    const url = new URL(request.url)
    const id = url.pathname.split('/')[3]
    if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })

    const body = await request.json()
    const proof_url = body?.proof_url
    if (!proof_url) return NextResponse.json({ error: 'proof_url is required' }, { status: 400 })

    const validPrefix = `${SUPABASE_URL}/storage/v1/object/public/transaction-proofs/`
    if (!proof_url.startsWith(validPrefix)) {
      return NextResponse.json({ error: 'Invalid proof_url' }, { status: 400 })
    }

    // ambil transaksi
    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, status, event_id')
      .eq('id', id)
      .single()

    if (txError || !tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    // ijinkan update proof hanya untuk status tertentu
    if (tx.status !== 'waiting_payment' && tx.status !== 'waiting_admin' && tx.status !== 'rejected') {
      return NextResponse.json({ error: `Transaction status ${tx.status} tidak bisa update proof` }, { status: 400 })
    }

    // *** PENTING: tidak mengurangi stok lagi di sini ***
    // Karena stok sudah dikurangi saat transaksi dibuat (POST /api/transactions),
    // maka proof hanya update proof_url + ubah status menjadi waiting_admin

        interface TransactionUpdate {
          proof_url?: string;
          updated_at?: string;
          status?: string;
        }

    const updatePayload: TransactionUpdate = {
      proof_url,
      updated_at: new Date().toISOString(),
    };

    if (tx.status === "waiting_payment") {
      updatePayload.status = "waiting_admin";
    }


    const { data: updatedTx, error: updateTxError } = await supabaseAdmin
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateTxError) return NextResponse.json({ error: 'Failed to update transaction', detail: updateTxError.message }, { status: 500 })

    // Opsional: jika kamu ingin lanjutkan proses verifikasi/admin, lakukan di sini (notification dlsb)

    return NextResponse.json({ message: 'Proof saved', data: updatedTx })
  } catch (err) {
    if (err instanceof Error) {
      console.error('[Confirm API] Unexpected error:', err.message)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    console.error('[Confirm API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
