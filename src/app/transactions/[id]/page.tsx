// src/app/transactions/[id]/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import UploadProof from './upload-proof'
import { apiFetch } from '@/lib/apiFetch'

export interface TicketType {
  id: string
  name: string
  price: number
  available_seats: number
  status?: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  ticket_type_id: string
  quantity: number
  created_at?: string
  ticket_type?: TicketType | null
}

export interface Event {
  id: string
  title?: string
  date?: string
  venue?: string
  city?: string
  capacity?: number
  available_seats?: number
  imageUrl?: string | null
  category?: string
}

export interface Transaction {
  id: string
  paid_amount: number
  status: string
  proof_url?: string | null
  created_at: string
  voucher_code?: string | null
}

export interface TransactionResponse {
  transaction: Transaction;
  items: TransactionItem[];
  event?: Event | null;
}

export default function TransactionPage() {
  const [tx, setTx] = useState<Transaction | null>(null)
  const [items, setItems] = useState<TransactionItem[]>([])
  const [eventData, setEventData] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null) // detik tersisa
  const params = useParams()
  const id = params?.id as string | undefined

  // useRef untuk menyimpan id interval (tipe number di browser)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTx = useCallback(async () => {
    if (!id) {
      setError('Missing transaction id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // pakai apiFetch dan query param 'id' supaya konsisten dgn route style project
      const data = await apiFetch<TransactionResponse>(`/api/transactions/${id}`, {
        method: 'GET',
        requireAuth: false,
      }).catch((e) => {
        // apiFetch melempar Error terstruktur
        throw e
      })

      // ekspektasi shape: { transaction, items, event }
      const transaction: Transaction | undefined = data?.transaction
      const txItems: TransactionItem[] = Array.isArray(data?.items) ? data.items : []
      const ev : Event | null = data?.event ?? null;

      if (!transaction) {
        throw new Error('Response transaksi tidak valid')
      }

      setTx(transaction)
      setItems(txItems)
      setEventData(ev ?? null)

      // set countdown logic: 2 jam sejak created_at jika belum done/canceled and no proof_url
      if (
        transaction.status !== 'done' &&
        transaction.status !== 'canceled' &&
        !transaction.proof_url
      ) {
        const createdAt = new Date(transaction.created_at).getTime()
        const now = Date.now()
        const twoHours = 2 * 60 * 60 * 1000
        const diff = createdAt + twoHours - now
        if (diff > 0) {
          setCountdown(Math.floor(diff / 1000))
        } else {
          setCountdown(0)
        }
      } else {
        setCountdown(null)
      }
    } catch (err) {
      console.error('[TransactionPage] fetchTx error', err)
      if (err instanceof Error) setError(err.message)
      else setError('Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // initial fetch
    fetchTx()

    // cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchTx])

  // jalankan countdown setiap 1 detik kalau ada countdown
  useEffect(() => {
    if (countdown === null) return

    if (countdown === 0) {
      // waktu habis, refresh status supaya bisa cek expired atau logic lain
      // kita panggil fetchTx untuk reload data
      fetchTx()
      return
    }

    // clear dulu kalau ada
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (!prev || prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [countdown, fetchTx])

  // format countdown ke jam:menit:detik
  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Callback untuk dipassing ke UploadProof agar setelah upload kita reload data lokal
  const handleUploadSuccess = async () => {
    // refresh transaction data lebih halus (tanpa full page refresh)
    await fetchTx()
  }

  if (loading) {
    return <p className="p-4 text-gray-600">Loading transaksi...</p>
  }

  if (error) {
    return <p className="p-4 text-red-500">{error}</p>
  }

  if (!tx) {
    return <p className="p-4 text-gray-600">Transaksi tidak ditemukan</p>
  }

  const statusColors: Record<string, string> = {
    done: 'text-green-600',
    waiting_admin: 'text-orange-600',
    rejected: 'text-red-600',
    expired: 'text-red-600',
    canceled: 'text-red-600',
    default: 'text-gray-700',
  }

  const prettyStatus = (status: string) => {
    const map: Record<string, string> = {
      done: 'Selesai',
      waiting_admin: 'Menunggu Admin',
      rejected: 'Ditolak',
      expired: 'Kadaluarsa',
      canceled: 'Dibatalkan',
    }
    return map[status] || status
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-2">Detail Transaksi</h1>
        <p className="text-gray-500 text-sm">
          ID Transaksi: <span className="font-mono">{tx.id}</span>
        </p>
      </div>

      <div className="space-y-1">
        <p>
          Jumlah:{' '}
          <span className="font-semibold">
            {typeof tx.paid_amount === 'number' && !isNaN(tx.paid_amount)
              ? new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                }).format(tx.paid_amount)
              : '-'}
          </span>
        </p>
        <p>
          Status:{' '}
          <span
            className={`font-semibold ${statusColors[tx.status] || statusColors.default}`}
          >
            {prettyStatus(tx.status)}
          </span>
        </p>
        <p>
          Tanggal:{' '}
          {new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date(tx.created_at))}
        </p>
      </div>

      {/* Event summary (jika ada) */}
      {eventData && (
        <div className="border rounded p-3">
          <p className="font-semibold">{eventData.title ?? 'Event'}</p>
          <p className="text-sm text-gray-500">
            {eventData.date ? new Date(eventData.date).toLocaleDateString() : null}{' '}
            {eventData.venue ? `• ${eventData.venue}` : null}
          </p>
          {eventData.imageUrl && (
            <div className="relative w-full h-40 mt-3 rounded overflow-hidden border">
              <Image src={eventData.imageUrl} alt="Event" fill className="object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Items (jika ada) */}
      {items && items.length > 0 && (
        <div>
          <p className="font-semibold mb-2">Item Transaksi</p>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {it.ticket_type?.name ?? it.ticket_type_id}
                  </div>
                  <div className="text-sm text-gray-500">
                    Qty: {it.quantity}
                    {it.ticket_type ? ` • Harga: IDR ${it.ticket_type.price.toLocaleString()}` : ''}
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  IDR{' '}
                  {it.ticket_type
                    ? (it.ticket_type.price * it.quantity).toLocaleString()
                    : '-'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Countdown dan info upload bukti */}
      {countdown !== null && countdown > 0 && (
        <div className="p-4 bg-yellow-100 rounded border border-yellow-300 text-yellow-800">
          <p>
            Harap unggah bukti pembayaran dalam waktu:{' '}
            <span className="font-mono">{formatCountdown(countdown)}</span>
          </p>
        </div>
      )}

      {countdown === 0 && !tx.proof_url && (
        <div className="p-4 bg-red-100 rounded border border-red-300 text-red-800">
          <p>Waktu upload bukti pembayaran sudah habis. Transaksi akan kadaluarsa.</p>
        </div>
      )}

      {tx.proof_url && (
        <div>
          <p className="font-semibold mb-2">Bukti Pembayaran:</p>
          <div className="relative w-full h-64 rounded-lg overflow-hidden border">
            <Image
              src={tx.proof_url}
              alt="Bukti pembayaran"
              fill
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Jika status belum done/canceled dan belum ada proof_url, tampilkan UploadProof */}
      {tx.status !== 'done' && tx.status !== 'canceled' && !tx.proof_url && countdown !== 0 && (
        <UploadProof transactionId={tx.id} onUploadSuccess={handleUploadSuccess} />
      )}

      <button
        onClick={() => fetchTx()}
        className="w-full py-2 rounded bg-gray-100 hover:bg-gray-200 transition"
      >
        Refresh Status
      </button>
    </div>
  )
}
