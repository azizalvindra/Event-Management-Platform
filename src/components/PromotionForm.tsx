// components/PromotionForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'

interface PromotionFormProps {
  eventId: string
}

export default function PromotionForm({ eventId }: PromotionFormProps) {
  const router = useRouter()

  // 1. State untuk semua input
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState<number>(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 2. Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validasi sederhana
    if (!code || !startDate || !endDate || discount <= 0) {
      setError('Tolong isi semua field dengan benar.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          code: code.trim().toUpperCase(),
          discount,
          type,
          start_date: startDate,
          end_date: endDate,
          status,
        }),
      })

     if (!res.ok) {
      const text = await res.text()
      let message = `Error ${res.status}`
      try {
        const json = JSON.parse(text)
        message = json.error || json.message || message
      } catch {
        message = text
      }
      throw new Error(message || 'Failed to create promo')
    }


      // setelah sukses, reload atau redirect
      router.refresh()
      setCode('')
      setDiscount(0)
      setType('percent')
      setStartDate('')
      setEndDate('')
      setStatus('active')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui');
      }
    } finally {
      setLoading(false);
    }
  }

  type PromoType = 'percent' | 'nominal';

  const [type, setType] = useState<PromoType>('percent');

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-md shadow">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div>
        <label className="block text-sm font-medium">Voucher Code</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
          placeholder="DISKON10"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Discount</label>
          <input
            type="number"
            value={discount}
            onChange={e => setDiscount(parseInt(e.target.value))}
            className="mt-1 block w-full border rounded p-2"
            placeholder="10"
            min={1}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as PromoType)}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="percent">Percent (%)</option>
              <option value="nominal">Nominal (IDR)</option>
            </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </div>
      </div>

      <div>
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={status === 'active'}
            onChange={e => setStatus(e.target.checked ? 'active' : 'inactive')}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm">Active</span>
        </label>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Membuat...' : 'Buat Promo'}
      </Button>
    </form>
  )
}
