'use client'

import { useRouter } from 'next/navigation'
import { Promotion } from '@/app/events/[id]/promotions/page'

type Props = {
  promotions: Promotion[]
}

export function PromotionList({ promotions }: Props) {
  const router = useRouter()

  // Handler untuk delete promo
  const handleDelete = async (id: string) => {
    if (!confirm('Yakin mau hapus promo ini?')) return

    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: 'DELETE',
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Gagal menghapus promo')
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        alert(`Error: ${err.message}`);
      } else {
        alert('Error: Terjadi kesalahan yang tidak diketahui');
      }
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-2xl font-semibold">Promotions</h2>
      {promotions.length > 0 ? (
        promotions.map((p) => {
          // Hitung label diskon
          const discountLabel =
            p.type === 'percent'
              ? `${p.discount}%`
              : `IDR ${p.discount.toLocaleString()}`

          return (
            <div
              key={p.id}
              className="flex justify-between items-center p-4 bg-gray-50 rounded"
            >
              <div>
                <p>
                  <strong>{p.code}</strong> — {discountLabel}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(p.start_date).toLocaleDateString()} —{' '}
                  {new Date(p.end_date).toLocaleDateString()}
                  {' • '}
                  <span
                    className={`font-medium ${
                      p.status === 'active'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {p.status}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
          )
        })
      ) : (
        <p className="text-gray-500">No promotions yet.</p>
      )}
    </div>
  )
}
