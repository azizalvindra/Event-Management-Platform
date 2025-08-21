// FILE: src/app/transactions/[id]/confirm/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(req: Request, context: unknown) {
  try {
    const { params } = context as { params?: { id?: string } };
    const transactionId = params?.id;

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
    }


    const cookieStore = await cookies();
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    // cek user login
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // cek role user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only admin can confirm transactions" },
        { status: 403 }
      );
    }

    // baca body dan validasi status
    const body = await req.json().catch(() => ({}));
    const { status } = body ?? {};

    const validStatuses = [
      "waiting_admin_confirmation",
      "done",
      "rejected",
      "expired",
      "canceled",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
    }

    // update transaksi
    const { data, error } = await supabase
      .from("transactions")
      .update({ status })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Transaction updated successfully",
      transaction: data,
    });
  }  catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
