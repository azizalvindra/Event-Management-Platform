// src/app/api/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient, PostgrestError } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env keys");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---- Types untuk hasil query Supabase ----
interface TransactionItem {
  id: string;
  transaction_id: string;
  ticket_type_id: string;
  quantity: number;
  [key: string]: unknown;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  [key: string]: unknown;
}

interface Transaction {
  id: string;
  event_id: string | null;
  status: string;
  payment_proof_url?: string | null;
  proof_url?: string | null;
  payment_proof_uploaded_at?: string | null;
  [key: string]: unknown;
}

/**
 * GET handler (ambil data transaksi + items + event)
 * context.params datang sebagai Promise dari Next.js App Router
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
    }

    // 1) ambil transaksi
    const { data: tx, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("id", id)
      .single<Transaction>();

    if (txError) {
      if (txError.code === "PGRST116" || txError.message?.includes("No rows")) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      }
      console.error("[GET /api/transactions/:id] txError", txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // 2) ambil items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("transaction_items")
      .select("*")
      .eq("transaction_id", id);

    if (itemsError) {
      console.error("[GET /api/transactions/:id] itemsError", itemsError);
      return NextResponse.json({ error: "Failed to fetch transaction items" }, { status: 500 });
    }

    // 3) ambil ticket_types
    const ticketTypeIds = (items || []).map((it: TransactionItem) => it.ticket_type_id).filter(Boolean);

    let ticketTypesMap: Record<string, TicketType> = {};

    if (ticketTypeIds.length > 0) {
      const { data: tts, error: ttError } = await supabaseAdmin
        .from("ticket_types")
        .select("*")
        .in("id", ticketTypeIds);

      if (ttError) {
        console.error("[GET /api/transactions/:id] ticket_types error", ttError);
        return NextResponse.json({ error: "Failed to fetch ticket types" }, { status: 500 });
      }

      ticketTypesMap = (tts || []).reduce<Record<string, TicketType>>((acc, t) => {
        const tt = t as TicketType;
        acc[tt.id] = tt;
        return acc;
      }, {});
    }

    // 4) ambil event
    let eventData: unknown = null;
    if ((tx as Transaction)?.event_id) {
      const { data: ev, error: evError } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", (tx as Transaction).event_id)
        .single();

      if (evError) {
        console.warn("[GET /api/transactions/:id] event not found", evError);
      } else {
        eventData = ev;
      }
    }

    // 5) gabungkan items + ticket type
    const enrichedItems = (items || []).map((it: TransactionItem) => ({
      ...it,
      ticket_type: ticketTypesMap[it.ticket_type_id] ?? null,
    }));

    // hasil final
    const responseBody = {
      transaction: tx,
      items: enrichedItems,
      event: eventData,
    };

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[GET /api/transactions/:id] Unexpected error", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST handler (update proof URL kedua kolom sekaligus)
 * - Expect JSON body: { fileUrl: string }
 * - Menggunakan Supabase service key (trusted) sehingga bypass RLS
 */
type PostBody = {
  fileUrl: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
    }

    // validate content-type + body
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Expected application/json" }, { status: 400 });
    }

    const body = (await request.json()) as PostBody;
    const fileUrl = (body.fileUrl ?? "").trim();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
    }
    // optional: basic url check
    if (!/^https?:\/\//i.test(fileUrl)) {
      return NextResponse.json({ error: "fileUrl must be a valid URL" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // update kedua kolom sekaligus + set timestamp + status
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .update({
        payment_proof_url: fileUrl,
        proof_url: fileUrl,
        payment_proof_uploaded_at: nowIso,
        status: "waiting_confirmation",
      })
      .eq("id", id)
      .select()
      .single<Transaction>();

    if (error) {
      const pge = error as PostgrestError;
      console.error("[POST /api/transactions/:id] supabase update error", {
        message: pge.message,
        details: pge.details ?? undefined,
        hint: pge.hint ?? undefined,
      });
      // jika constraint violation, kirimkan info supaya frontend bisa handle
      return NextResponse.json({ error: pge.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transaction: data }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/transactions/:id] Unexpected error", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
