// src/lib/referral.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export function generateReferralCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // exclude ambiguous chars
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

type ProfilesRow = { id: string }

/**
 * generateUniqueReferralCode
 * - menerima instance supabaseAdmin (SupabaseClient)
 * - mencoba hingga menemukan kode unik (throws jika gagal)
 */
export async function generateUniqueReferralCode(
  supabaseAdmin: SupabaseClient,
  length = 8
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateReferralCode(length)

    // panggil query, lalu kita casting response ke bentuk yang kita harapkan
    const res = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .limit(1)

    // cast ke tipe lokal (hindari `any`)
    const typed = res as unknown as { data: ProfilesRow[] | null; error: { message?: string } | null }

    if (typed.error) {
      // jika error DB, lempar supaya caller bisa handle
      throw new Error(typed.error.message ?? 'Unknown DB error while checking referral uniqueness')
    }

    if (!typed.data || typed.data.length === 0) {
      return code
    }
  }

  throw new Error('Gagal generate referral code unik setelah beberapa percobaan')
}
