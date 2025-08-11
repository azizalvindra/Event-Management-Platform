// src/app/api/promotions/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }  // params berupa Promise
) {
  // tunggu dulu params-nya baru ambil id
  const id = (await params).id

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Promo deleted' }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message ?? 'Server error' }, { status: 500 })
  }
}
