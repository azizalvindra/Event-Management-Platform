// FILE: src/app/login/page.tsx
'use client'

import React, { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() : React.ReactElement {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // sign in with Supabase client (browser)
      const {
        data: signInData,
        error: signInError
      } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() })

      console.log("signIn result:", { signInData, signInError })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      const session = signInData.session

      if (!session || !session.access_token) {
        setError('Gagal mendapatkan session. Pastikan kredensial benar.')
        setLoading(false)
        return
      }

      // KIRIM whole session ke server agar server dapat menyimpan cookie httpOnly.
      // Supaya server bisa memanfaatkan refresh_token dan informasi expires.
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }) // <-- kirim object session penuh
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setError(payload?.error ?? 'Gagal menyimpan sesi di server')
        setLoading(false)
        return
      }

      // sukses: redirect ke halaman yang aman
      router.push('/')
    } catch (err) {
      console.error('login err', err)
      setError('Terjadi kesalahan saat login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-4">Masuk</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>
        <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
