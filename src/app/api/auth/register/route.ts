// FILE: src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateUniqueReferralCode } from '@/lib/referral'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

/** tipe body */
type RegisterBody = {
  email?: string
  password?: string
  referralCode?: string
  fullName?: string
  addressStreet?: string
  addressCity?: string
  addressState?: string
  addressPostal?: string
  addressCountry?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody

    // ========== VALIDATION ==========
    if (!body.fullName || body.fullName.trim().length < 2) {
      return NextResponse.json({ error: 'Full name wajib dan minimal 2 karakter' }, { status: 400 })
    }
    if (!body.email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: 'Password wajib (min 6 karakter)' }, { status: 400 })
    }

    const cleanFullName = body.fullName.trim().slice(0, 255)
    const email = body.email.trim()
    const password = body.password
    const referralCode = body.referralCode?.trim()

    // address optional
    const cleanAddressStreet = body.addressStreet?.trim().slice(0, 500) ?? null
    const cleanCity = body.addressCity?.trim().slice(0, 120) ?? null
    const cleanState = body.addressState?.trim().slice(0, 120) ?? null
    const cleanPostal = body.addressPostal?.trim().slice(0, 30) ?? null
    const cleanCountry = body.addressCountry?.trim().slice(0, 120) ?? null

    // ========== 1) CREATE AUTH USER ==========
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung auto confirm
      user_metadata: { full_name: cleanFullName }
    })

    if (createError) {
      console.error('create user err', createError)
      return NextResponse.json({ error: createError.message ?? 'Gagal membuat user' }, { status: 400 })
    }

    const userId = createdUser?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'User id tidak tersedia setelah pembuatan user' }, { status: 500 })
    }

    // ========== 2) HANDLE REFERRAL ==========
    let referredById: string | null = null
    if (referralCode) {
      const { data: refUsers, error: refErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('referral_code', referralCode)
        .limit(1)

      if (refErr) {
        console.warn('cek referral err', refErr)
      } else if (refUsers && refUsers.length > 0) {
        referredById = refUsers[0].id
      } else {
        console.log(`Referral code ${referralCode} tidak ditemukan`)
      }
    }

    // ========== 3) GENERATE REFERRAL CODE ==========
    const referral_code = await generateUniqueReferralCode(supabaseAdmin)

    // ========== 4) INSERT PROFILE ==========
    const insertPayload: Record<string, unknown> = {
      id: userId,
      email,
      role: 'customer',
      referral_code,
      referred_by: referredById,
      full_name: cleanFullName,
      address_street: cleanAddressStreet,
      address_city: cleanCity,
      address_state: cleanState,
      address_postal_code: cleanPostal,
      address_country: cleanCountry
    }

    const { error: insertErr } = await supabaseAdmin.from('profiles').insert(insertPayload)

    if (insertErr) {
      console.error('insert profile err', insertErr)
      // rollback: hapus user kalau gagal insert profile
      await supabaseAdmin.auth.admin.deleteUser(userId).catch((e) => console.warn('rollback delete user err', e))
      return NextResponse.json({ error: insertErr.message ?? 'Gagal menyimpan profil' }, { status: 500 })
    }

    // ========== SUCCESS ==========
    return NextResponse.json({ ok: true, userId, referral_code }, { status: 201 })
  } catch (err) {
    console.error('register route err', err)
    return NextResponse.json({ error: (err as Error)?.message ?? 'server error' }, { status: 500 })
  }
}
