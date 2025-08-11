import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

interface UpdatePayload {
  proof_url: string
  updated_at: string
  status?: string
}


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

    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, status, event_id')
      .eq('id', id)
      .single()

    if (txError || !tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    if (tx.status !== 'waiting_payment' && tx.status !== 'waiting_admin' && tx.status !== 'rejected') {
      return NextResponse.json({ error: `Transaction status ${tx.status} tidak bisa update proof` }, { status: 400 })
    }

    // Cek dan update kuota ticket_types + event kalau status awal waiting_payment
    if (tx.status === 'waiting_payment') {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('transaction_items')
        .select('ticket_type_id, quantity')
        .eq('transaction_id', id)
      if (itemsError || !items || items.length === 0) {
        return NextResponse.json({ error: 'Transaction items not found' }, { status: 404 })
      }

      for (const item of items) {
        const { data: tt, error: ttError } = await supabaseAdmin
          .from('ticket_types')
          .select('available_seats')
          .eq('id', item.ticket_type_id)
          .single()
        if (ttError || !tt) return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 })
        if (tt.available_seats < item.quantity) return NextResponse.json({ error: 'Not enough seats for ticket type' }, { status: 400 })

        const newSeats = tt.available_seats - item.quantity
        const { error: updateTtError } = await supabaseAdmin
          .from('ticket_types')
          .update({ available_seats: newSeats })
          .eq('id', item.ticket_type_id)
        if (updateTtError) return NextResponse.json({ error: 'Failed to update ticket type quota' }, { status: 500 })
      }

      const totalQty = items.reduce((acc, cur) => acc + cur.quantity, 0)
      const { data: eventData, error: eventError } = await supabaseAdmin
        .from('events')
        .select('available_seats')
        .eq('id', tx.event_id)
        .single()
      if (eventError || !eventData) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      if (eventData.available_seats < totalQty) return NextResponse.json({ error: 'Not enough seats in event' }, { status: 400 })

      const { error: updateEventError } = await supabaseAdmin
        .from('events')
        .update({ available_seats: eventData.available_seats - totalQty })
        .eq('id', tx.event_id)
      if (updateEventError) return NextResponse.json({ error: 'Failed to update event quota' }, { status: 500 })
    }

    // Update transaksi dengan proof_url dan status (kalau dari waiting_payment jadi waiting_admin)
    const updatePayload: UpdatePayload = { proof_url, updated_at: new Date().toISOString() }
    if (tx.status === 'waiting_payment') updatePayload.status = 'waiting_admin'


    const { data: updatedTx, error: updateTxError } = await supabaseAdmin
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateTxError) return NextResponse.json({ error: 'Failed to update transaction', detail: updateTxError.message }, { status: 500 })

    // Simulasi delay 10 detik untuk update status jadi done
    setTimeout(async () => {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', id)
    }, 10000) // 10 detik

    return NextResponse.json({ message: 'Proof saved and seats updated', data: updatedTx })
  } catch (err) {
    if (err instanceof Error) {
      console.error('[Confirm API] Unexpected error:', err.message)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    console.error('[Confirm API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
