// src/app/api/auth/auto-confirm/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // pakai service_role
);

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    // Update langsung user agar email dianggap confirmed
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: data }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
