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
      Number.isInteger(record.quantity) &&
      record.quantity > 0
    )
  }
  return false
}

export async function POST(req: Request) {
  try {
    // parse body
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

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

    // basic validation
    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0 || !items.every(isTransactionItem)) {
      return NextResponse.json({ error: 'items is required and must be valid' }, { status: 400 })
    }

    // Ambil token dari header Authorization (Bearer ...)
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 })
    }

    // retrieve user from access token using admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    const user = userData?.user ?? null
    if (userError || !user) {
      console.error('[Transaction API] invalid user token', userError)
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 })
    }

    // ---------- PRE-CHECK AVAILABILITY ----------
    // aggregate quantities per ticket_type (handle duplicates)
    const qtyMap = new Map<string, number>()
    for (const it of items as TransactionItem[]) {
      qtyMap.set(it.ticket_type_id, (qtyMap.get(it.ticket_type_id) ?? 0) + it.quantity)
    }
    const ticketTypeIds = Array.from(qtyMap.keys())
    if (ticketTypeIds.length === 0) {
      return NextResponse.json({ error: 'No ticket types provided' }, { status: 400 })
    }

    // ambil available_seats untuk ticket_types terkait
    const { data: tts, error: ttError } = await supabaseAdmin
      .from('ticket_types')
      .select('id, available_seats')
      .in('id', ticketTypeIds)

    if (ttError) {
      console.error('[Transaction API] failed to fetch ticket types', ttError)
      return NextResponse.json({ error: 'Failed to validate ticket availability' }, { status: 500 })
    }

    // jika ada ticket_type_id yang tidak ditemukan, tolak
    type TicketType = { id: string }

    const foundIds = new Set((tts ?? []).map((t: TicketType) => t.id))

    const missing = ticketTypeIds.filter((tid) => !foundIds.has(tid))

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Some ticket types not found',
          details: missing,
        },
        { status: 400 }
      )
    }


    // build map of availability
    const ttMap = new Map<string, number>()
    for (const tt of tts ?? []) {
      ttMap.set(tt.id, tt.available_seats ?? 0)
    }

    // cek setiap requested qty terhadap available_seats
    const insufficient: Array<{ ticket_type_id: string; want: number; available: number }> = []
    for (const [tid, want] of qtyMap.entries()) {
      const avail = ttMap.get(tid) ?? 0
      if (avail < want) insufficient.push({ ticket_type_id: tid, want, available: avail })
    }

    if (insufficient.length > 0) {
      // return detail supaya frontend bisa tampilkan pesan yg berguna
      return NextResponse.json({
        error: 'Not enough seats for one or more ticket types',
        details: insufficient,
      }, { status: 400 })
    }

    // ---------- INSERT TRANSACTION (sekali, dengan user_id) ----------
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          event_id,
          voucher_code: voucher_code ?? null,
          paid_amount: paid_amount ?? 0,
          status: 'waiting_payment',
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (txError || !transaction) {
      console.error('[Transaction API] failed to create transaction', txError)
      return NextResponse.json({ error: txError?.message || 'Failed to create transaction' }, { status: 500 })
    }

    // ---------- INSERT ITEMS (kembalikan inserted items) ----------
    const itemsToInsert = (items as TransactionItem[]).map((item) => ({
      transaction_id: transaction.id,
      ticket_type_id: item.ticket_type_id,
      quantity: item.quantity,
      created_at: new Date().toISOString(),
    }))

    const { data: insertedItems, error: itemsError } = await supabaseAdmin
      .from('transaction_items')
      .insert(itemsToInsert)
      .select()

    if (itemsError) {
      // rollback transaksi jika gagal insert items
      await supabaseAdmin.from('transactions').delete().eq('id', transaction.id)
      console.error('[Transaction API] failed to insert items', itemsError)
      return NextResponse.json({ error: itemsError.message || 'Failed to insert items' }, { status: 500 })
    }

    // ---------- DECREASE STOCK (RPC atomic) ----------
    for (const rawItem of items as TransactionItem[]) {
      const { error: seatsError } = await supabaseAdmin.rpc('decrease_ticket_stock', {
        p_ticket_type_id: rawItem.ticket_type_id,
        p_qty: rawItem.quantity,
      })

      if (seatsError) {
        console.error(`[Transaction API] Failed to decrease seats for ticket_type_id ${rawItem.ticket_type_id}`, seatsError)

        // rollback everything: items + transaction
        await supabaseAdmin.from('transaction_items').delete().eq('transaction_id', transaction.id)
        await supabaseAdmin.from('transactions').delete().eq('id', transaction.id)

        // If RPC returned custom message, include it; otherwise generic
        return NextResponse.json({ error: seatsError.message || 'Not enough seats' }, { status: 400 })
      }
    }

    // berhasil: kembalikan transaction + items
    return NextResponse.json({ transaction, items: insertedItems ?? [] })
  } catch (err) {
    console.error('[Transaction API] Unexpected error:', err)
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
