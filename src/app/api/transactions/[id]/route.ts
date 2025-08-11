// src/app/api/transactions/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// Helper: ambil id dari params yang disediakan Next atau fallback dari URL
function extractIdFrom(request: Request, idParam?: string): string | undefined {
  if (idParam) return idParam

  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1]
  } catch {
    return undefined
  }
}

/**
 * GET handler
 * Params sekarang Promise<{id: string}>
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = extractIdFrom(request, (await params).id)
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message ?? 'Server error' }, { status: 500 })
  }
}

/**
 * PATCH handler
 * Params juga Promise<{id: string}>
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = extractIdFrom(request, (await params).id)
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 })
  }

  // baca body dengan aman
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 })
  }

  if (
    typeof rawBody !== 'object' ||
    rawBody === null ||
    !('status' in rawBody) ||
    typeof (rawBody as Record<string, unknown>)['status'] !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing or invalid "status" in request body' }, { status: 400 })
  }

  const status = (rawBody as Record<string, unknown>)['status'] as string

  try {
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found after update' }, { status: 404 })
    }

    if (status === 'paid') {
      const eventId = (transaction as Record<string, unknown>)['event_id']
      if (!eventId || typeof eventId !== 'string') {
        return NextResponse.json({
          error: 'Transaction updated but event_id missing or invalid for capacity update',
        }, { status: 500 })
      }

      try {
        const { error: rpcError } = await supabase.rpc('update_event_capacity', {
          input_event_id: eventId,
        })

        if (rpcError) {
          return NextResponse.json({
            error: `Update success, but failed to update capacity: ${rpcError.message}`,
          }, { status: 500 })
        }
      } catch (rpcErr: unknown) {
        const rpcMsg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr)
        return NextResponse.json({
          error: `Update success, but failed to call RPC: ${rpcMsg}`,
        }, { status: 500 })
      }
    }

    return NextResponse.json(transaction)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message ?? 'Server error' }, { status: 500 })
  }
}
