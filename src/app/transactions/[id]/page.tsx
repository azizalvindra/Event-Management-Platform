'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import UploadProof from './upload-proof'

interface Transaction {
  id: string
  paid_amount: number
  status: string
  proof_url?: string
  created_at: string
}

export default function TransactionPage() {
  const [tx, setTx] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null) // detik tersisa
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  // buat interval countdown ref supaya bisa clear interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchTx = async () => {
      try {
        const res = await fetch(`/api/transactions/${id}`)
        if (!res.ok) throw new Error('Gagal mengambil data transaksi')
        const data = await res.json()
        setTx(data)

        // Jika status belum selesai atau batal dan belum ada bukti,
        // hitung sisa waktu 2 jam dari created_at
        if (
          data.status !== 'done' &&
          data.status !== 'canceled' &&
          !data.proof_url
        ) {
          const createdAt = new Date(data.created_at).getTime()
          const now = Date.now()
          const twoHours = 2 * 60 * 60 * 1000
          const diff = createdAt + twoHours - now
          if (diff > 0) {
            setCountdown(Math.floor(diff / 1000)) // detik tersisa
          } else {
            setCountdown(0)
          }
        } else {
          setCountdown(null)
        }
      } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }
    fetchTx()

    // clear interval kalau komponen unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [id])

  // jalankan countdown setiap 1 detik kalau ada countdown
  useEffect(() => {
    if (countdown === null) return

    if (countdown === 0) {
      // waktu habis, refresh status supaya bisa cek expired atau logic lain
      router.refresh()
      return
    }

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (!prev || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [countdown, router])

  // format countdown ke jam:menit:detik
  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
            className={`font-semibold ${
              statusColors[tx.status] || statusColors.default
            }`}
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
      {tx.status !== 'done' &&
        tx.status !== 'canceled' &&
        !tx.proof_url &&
        countdown !== 0 && <UploadProof transactionId={tx.id} />}

      <button
        onClick={() => router.refresh()}
        className="w-full py-2 rounded bg-gray-100 hover:bg-gray-200 transition"
      >
        Refresh Status
      </button>
    </div>
  )
}
