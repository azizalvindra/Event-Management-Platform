// src/app/api/transactions/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment keys')
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface TransactionItem {
  ticket_type_id: string
  quantity: number
}

function isTransactionItem(obj: unknown): obj is TransactionItem {
  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>
    return (
      typeof record.ticket_type_id === 'string' &&
      typeof record.quantity === 'number' &&
      record.quantity > 0
    )
  }
  return false
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Destructuring dan tipe eksplisit supaya aman
    const {
      event_id,
      items,
      voucher_code,
      paid_amount,
    }: {
      event_id?: string
      items?: unknown
      voucher_code?: string
      paid_amount?: number
    } = body

    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0 || !items.every(isTransactionItem)) {
      return NextResponse.json({ error: 'items is required and must be valid' }, { status: 400 })
    }

    // Insert transaksi dengan status 'waiting_payment'
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          event_id,
          voucher_code: voucher_code ?? null,
          paid_amount: paid_amount ?? 0,
          status: 'waiting_payment',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: txError?.message || 'Failed to create transaction' }, { status: 500 })
    }

    // Prepare transaction_items untuk insert
    const itemsToInsert = items.map((item) => ({
      transaction_id: transaction.id,
      ticket_type_id: item.ticket_type_id,
      quantity: item.quantity,
      created_at: new Date().toISOString(),
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('transaction_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback transaksi jika gagal insert items
      await supabaseAdmin.from('transactions').delete().eq('id', transaction.id)
      return NextResponse.json({ error: itemsError.message || 'Failed to insert items' }, { status: 500 })
    }

    // Kurangi seat untuk tiap ticket_type via RPC
    for (const item of items) {
      const { error: seatsError } = await supabaseAdmin.rpc('decrease_ticket_stock', {
        p_ticket_type_id: item.ticket_type_id,
        p_qty: item.quantity,
      })

      if (seatsError) {
        console.error(`[Transaction API] Failed to decrease seats for ticket_type_id ${item.ticket_type_id}`, seatsError)
      }
    }

    return NextResponse.json({ transaction })
  } catch (err) {
    if (err instanceof Error) {
      console.error('[Transaction API] Unexpected error:', err)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    // fallback generic error
    console.error('[Transaction API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
