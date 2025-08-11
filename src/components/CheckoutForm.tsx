//src/components/CheckoutForm.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { TicketType } from '@/app/events/[id]/checkout/page'

// Tipe untuk promotion yang kita fetch
interface Promotion {
  id: string
  code: string
  discount: number
  type: 'percent' | 'nominal'
  start_date: string
  end_date: string
  status: 'active' | 'inactive'
}

interface Props {
  eventId: string
  ticketTypes: TicketType[]
}

export default function CheckoutForm({ eventId, ticketTypes }: Props) {
  const router = useRouter()

  // form state
  const [ticketTypeId, setTicketTypeId] = useState<string>(ticketTypes[0]?.id || '')
  const [quantity, setQuantity] = useState<number>(1)
  const [voucher, setVoucher] = useState<string>('')
  const [promo, setPromo] = useState<Promotion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // state untuk transaction yang baru dibuat
  const [createdTxId, setCreatedTxId] = useState<string | null>(null)

  // state upload bukti
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // harga per seat & total sebelum diskon
  const pricePerSeat = ticketTypes.find(t => t.id === ticketTypeId)?.price || 0
  const subtotal = pricePerSeat * quantity

  // diskon & final price
  const discountAmount = promo
    ? promo.type === 'percent'
      ? Math.round((subtotal * promo.discount) / 100)
      : promo.discount
    : 0
  const finalTotal = subtotal - discountAmount

  // 1. Handler apply voucher
  const handleApplyVoucher = async () => {
    if (!voucher.trim()) {
      setPromo(null)
      return setError('Masukkan kode voucher dulu.')
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/promotions/validate?event_id=${eventId}&code=${voucher.trim().toUpperCase()}`
      )
      // response dari validate bisa 200 atau status error tergantung implementasi
      const payload = await res.json()
      if (!res.ok || payload.error) {
        throw new Error(payload.error || `Voucher invalid (${res.status})`)
      }
      setPromo(payload.promotion)
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui');
      }
      setPromo(null);
    } finally {
      setLoading(false);
    }

  }

  // 2. Handler submit checkout -> buat transaksi
  const handleCheckout = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setLoading(true)
  try {
    // Misal, kita kirim hanya satu jenis tiket dulu sesuai form yang ada
    const payload = {
      event_id: eventId,
      items: [{ ticket_type_id: ticketTypeId, quantity }],
      voucher_code: promo?.code || null,
      paid_amount: finalTotal,
    }

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const body = await res.json()
    if (!res.ok) throw new Error(body.error || `Checkout failed (${res.status})`)

    const newTransaction = body.transaction
    if (!newTransaction || !newTransaction.id) throw new Error('Transaksi dibuat tapi response tidak berisi ID.')

    setCreatedTxId(newTransaction.id)
  } catch (e) {
    if (e instanceof Error) {
      setError(e.message);
    } else {
      setError('Terjadi kesalahan yang tidak diketahui');
    }
  } finally {
    setLoading(false);
  }
}


  // HANDLE FILE SELECT untuk bukti
// client: debug upload (paste ganti fungsi handleUploadProof)
const handleUploadProof = async () => {
  if (!proofFile || !createdTxId) {
    setUploadError('Pilih file terlebih dahulu atau buat transaksi dulu.')
    return
  }

  setUploading(true)
  setUploadError(null)

  try {
    const ext = (proofFile.name.split('.').pop() || 'jpg').toLowerCase()
    const filename = `${createdTxId}_${Date.now()}.${ext}`
    const filePath = `proofs/${createdTxId}/${filename}` // NO leading slash

    console.log('Attempting upload to filePath=', filePath, 'file=', proofFile)

    const uploadRes = await supabase.storage
      .from('transaction-proofs')
      .upload(filePath, proofFile, { upsert: true, cacheControl: '3600' })

    console.log('uploadRes', uploadRes)
    if (uploadRes.error) {
      // tampilkan message yg disediakan SDK
      throw new Error(uploadRes.error.message || JSON.stringify(uploadRes.error))
    }

    const uploadedPath = uploadRes.data?.path
    console.log('uploadedPath', uploadedPath)
    if (!uploadedPath) throw new Error('Upload sukses tapi path missing')

    const { data: urlData } = supabase.storage
      .from('transaction-proofs')
      .getPublicUrl(uploadedPath)

    console.log('urlData', urlData)
    const publicUrl = urlData?.publicUrl
    if (!publicUrl) throw new Error('Gagal mendapatkan publicUrl')

    // POST ke server untuk update transaksi (server akan gunakan service role)
    const res = await fetch(`/api/transactions/${createdTxId}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_url: publicUrl }),
    })
    const body = await res.json()
    console.log('server reply when saving proof:', res.status, body)
    if (!res.ok) throw new Error(body.error || 'Gagal update transaksi')

    router.push(`/transactions/${createdTxId}`)
  } catch (e) {
    console.error('handleUploadProof error', e);
    if (e instanceof Error) {
      setUploadError(e.message);
    } else {
      setUploadError(String(e));
    }
  } finally {
    setUploading(false);
  }
}


  return (
    <div>
      <form onSubmit={handleCheckout} className="space-y-4 p-6 bg-white rounded shadow">
        {error && <p className="text-red-500">{error}</p>}

        {/* Ticket Type & Quantity */}
        <div>
          <label className="block">Ticket Type</label>
          <select
            value={ticketTypeId}
            onChange={e => setTicketTypeId(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          >
            {ticketTypes.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} — IDR {t.price.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(+e.target.value)}
            className="mt-1 block w-24 border rounded p-2"
          />
        </div>

        {/* Voucher */}
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Kode Voucher"
            value={voucher}
            onChange={e => setVoucher(e.target.value)}
            className="block w-full border rounded p-2"
          />
          <button
            type="button"
            onClick={handleApplyVoucher}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? 'Memeriksa...' : 'Apply'}
          </button>
        </div>

        {/* Ringkasan Harga */}
        <div className="space-y-1">
          <p>Subtotal: IDR {subtotal.toLocaleString()}</p>
          {promo && (
            <p className="text-green-600">
              Discount ({promo.code}): –IDR {discountAmount.toLocaleString()}
            </p>
          )}
          <p className="font-semibold">Total: IDR {finalTotal.toLocaleString()}</p>
        </div>

        <button
          type="submit"
          disabled={loading || !!createdTxId} // kunci submit kalau sudah bikin transaksi
          className="w-full py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : createdTxId ? 'Transaksi dibuat' : 'Checkout'}
        </button>
      </form>

      {/* Jika transaksi sudah dibuat -> tampilkan section upload bukti */}
      {createdTxId && (
        <section className="mt-6 p-6 bg-white rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Upload Bukti Pembayaran</h3>
          <p className="text-sm text-gray-500 mb-3">Silakan unggah foto/struk transfer. Setelah upload, status akan berubah jadi <strong>waiting_admin</strong>.</p>

          <div className="space-y-3">
            <input type="file" accept="image/*" onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                setProofFile(e.target.files[0])
              }
            }} />
            {uploadError && <p className="text-red-500">{uploadError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleUploadProof}
                disabled={uploading || !proofFile}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {uploading ? 'Mengunggah...' : 'Upload Bukti'}
              </button>
              <button
                onClick={() => router.push(`/transactions/${createdTxId}`)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Lihat Halaman Transaksi
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )

}
