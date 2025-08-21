// src/app/api/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  [key: string]: unknown; // biar fleksibel
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
  [key: string]: unknown;
}

export async function GET(request: Request, context: unknown) {
  try {
    // Ambil id dari context (cast aman) atau fallback dari request.url
    const params = (context as { params?: { id?: string } } | null)?.params;
    let id = params?.id;

    if (!id) {
      try {
        // fallback: parse dari url terakhir (misalnya /api/transactions/123)
        const url = new URL(request.url);
        const parts = url.pathname.split("/").filter(Boolean);
        id = parts[parts.length - 1] ?? undefined;
      } catch {
        // ignore parsing error
      }
    }

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
    const response = {
      transaction: tx,
      items: enrichedItems,
      event: eventData,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/transactions/:id] Unexpected error", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
