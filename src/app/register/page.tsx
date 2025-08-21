// FILE: src/app/register/page.tsx
'use client'

import React, { useState, ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type AddressFields = {
  addressStreet: string
  addressCity: string
  addressState: string
  addressPostal: string
  addressCountry: string
}

type FormState = {
  fullName: string
  email: string
  password: string
  referralCode: string
} & AddressFields

type RegisterSuccess = {
  ok: true
  userId: string
  referral_code: string
}

type RegisterError = {
  ok?: false
  error?: string
}

export default function RegisterPage() : React.ReactElement {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
    referralCode: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressPostal: '',
    addressCountry: ''
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'Full name wajib diisi.'
    if (!form.email.trim()) return 'Email wajib diisi.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Format email tidak valid.'
    if (!form.password || form.password.length < 6) return 'Password minimal 6 karakter.'
    // optional: postal code basic check (if filled)
    if (form.addressPostal && form.addressPostal.length > 30) return 'Postal code terlalu panjang.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          referralCode: form.referralCode || undefined,
          addressStreet: form.addressStreet || undefined,
          addressCity: form.addressCity || undefined,
          addressState: form.addressState || undefined,
          addressPostal: form.addressPostal || undefined,
          addressCountry: form.addressCountry || undefined
        })
      })

      const data = (await res.json()) as RegisterSuccess | RegisterError

      if (!res.ok || (data as RegisterError).error) {
        setError((data as RegisterError).error ?? 'Gagal register, coba lagi.')
        setLoading(false)
        return
      }

      // success
      const success = data as RegisterSuccess
      setMessage(`Akun berhasil dibuat. Referral kamu: ${success.referral_code}. Silakan cek email / login.`)

      // optionally redirect to login after short delay
      setTimeout(() => {
        router.push('/login')
      }, 1800)
    } catch (err) {
      console.error('register error', err)
      setError('Terjadi kesalahan. Coba lagi nanti.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-4">Daftar Akun</h1>

      {error && <div className="mb-4 text-red-600">{error}</div>}
      {message && <div className="mb-4 text-green-600">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Nama lengkap"
            className="w-full border px-3 py-2 rounded"
            required
            aria-label="Full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="email@example.com"
            className="w-full border px-3 py-2 rounded"
            required
            aria-label="Email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Minimal 6 karakter"
            className="w-full border px-3 py-2 rounded"
            required
            aria-label="Password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Referral Code (opsional)</label>
          <input
            name="referralCode"
            value={form.referralCode}
            onChange={handleChange}
            placeholder="KODEOPSI"
            className="w-full border px-3 py-2 rounded"
            aria-label="Referral Code"
          />
        </div>

        <fieldset className="border p-3 rounded">
          <legend className="text-sm font-medium mb-2">Alamat (opsional)</legend>
          <div className="space-y-2">
            <input name="addressStreet" value={form.addressStreet} onChange={handleChange} placeholder="Jalan / No. Rumah" className="w-full border px-3 py-2 rounded" />
            <div className="grid grid-cols-2 gap-2">
              <input name="addressCity" value={form.addressCity} onChange={handleChange} placeholder="Kota" className="w-full border px-3 py-2 rounded" />
              <input name="addressState" value={form.addressState} onChange={handleChange} placeholder="Provinsi" className="w-full border px-3 py-2 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="addressPostal" value={form.addressPostal} onChange={handleChange} placeholder="Kode Pos" className="w-full border px-3 py-2 rounded" />
              <input name="addressCountry" value={form.addressCountry} onChange={handleChange} placeholder="Negara" className="w-full border px-3 py-2 rounded" />
            </div>
          </div>
        </fieldset>

        <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">
          {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
        </button>
      </form>
    </div>
  )
}
