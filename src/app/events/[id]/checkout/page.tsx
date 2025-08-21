// src/app/events/[id]/checkout/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/apiFetch';

export interface TicketType {
  id: string;
  name: string;
  price: number;
  available_seats: number;
  status?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  venue: string;
  city: string;
  price?: number;
  imageUrl?: string | null;
  ticket_types: TicketType[];
  capacity?: number;
  available_seats?: number;
  category?: string;
}

interface Promotion {
  id: string;
  code: string;
  discount: number;
  type: 'percent' | 'nominal';
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive';
}

interface PromotionResponse {
  promotion?: Promotion | null;
}

interface CreateTxnResponse {
  transaction: { id: string };
  // tambahkan field lain jika API mengembalikan lebih banyak
}

export default function CheckoutPage() {
  const { id: eventId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [voucher, setVoucher] = useState('');
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const qtyParam = searchParams.get('qty');
    const typeParam = searchParams.get('ticket_type');
    if (qtyParam) setQuantity(Number(qtyParam));

    async function fetchEvent() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*, ticket_types(*), capacity, available_seats, category')
          .eq('id', eventId)
          .single();

        if (error) {
          console.error('fetchEvent error', error);
        } else if (data) {
          // cast ke tipe Event (supabase typings jadi tidak unknown)
          const evt = data as Event;

          // normalize ticket_types status
          if (Array.isArray(evt.ticket_types)) {
            evt.ticket_types = evt.ticket_types.map((t) => ({
              ...t,
              status: t.available_seats <= 0 ? 'sold_out' : t.status ?? 'active',
            }));
          }

          setEvent(evt);
          const pick = evt.ticket_types?.find((t) => t.id === typeParam);
          setSelectedType(pick ?? (evt.ticket_types?.[0] ?? null));
        }
      } catch (e) {
        console.error('fetchEvent unexpected', e);
      } finally {
        setLoading(false);
      }
    }

    if (eventId) fetchEvent();
  }, [eventId, searchParams]);

  if (loading) {
    return <p className="text-center py-10">Loading checkout…</p>;
  }

  if (!event) {
    return <p className="text-center py-10 text-red-600">Event tidak ditemukan.</p>;
  }

  if (!selectedType) {
    return <p className="text-center py-10">Tidak ada tipe tiket tersedia untuk event ini.</p>;
  }

  const subtotal = selectedType.price * quantity;
  let discountAmount = 0;
  if (promo) {
    discountAmount =
      promo.type === 'percent'
        ? Math.round((subtotal * promo.discount) / 100)
        : promo.discount;
  }
  const total = Math.max(0, subtotal - discountAmount);

  const handleApplyVoucher = async () => {
    if (!voucher.trim()) {
      setPromo(null);
      setApplyError('Masukkan kode voucher dulu.');
      return;
    }
    setApplying(true);
    setApplyError(null);

    try {
      // gunakan apiFetch (public endpoint) -> requireAuth false
      const url = `/api/promotions/validate?event_id=${eventId}&code=${voucher.trim().toUpperCase()}`;
      const data = await apiFetch<PromotionResponse>(url, { method: 'GET', requireAuth: false });

      // expect shape { promotion }
      if (!data?.promotion) {
        throw new Error('Voucher tidak valid');
      }

      setPromo(data.promotion);
    } catch (err) {
      if (err instanceof Error) {
        // bikin tipe sementara untuk error dengan kemungkinan ada 'details'
        const detailedErr = err as Error & { details?: unknown };

        if (detailedErr.details) {
          setApplyError(`${err.message} — ${JSON.stringify(detailedErr.details)}`);
        } else {
          setApplyError(err.message);
        }
        setPromo(null);
      } else {
        setPromo(null);
        setApplyError('Unknown error occurred');
      }
    } finally {
      setApplying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // basic validation
    if (quantity <= 0) {
      alert('Masukkan jumlah tiket minimal 1.');
      return;
    }

    setSubmitting(true);

    try {
      // Ambil session (supabase client) supaya kita bisa redirect ke login kalau perlu
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert('Silakan login terlebih dahulu untuk melanjutkan pembayaran.');
        router.push('/login');
        setSubmitting(false);
        return;
      }

      // realtime check ke ticket_types (UI-friendly pre-check)
      const { data: latestTicket, error: latestError } = await supabase
        .from('ticket_types')
        .select('id, available_seats')
        .eq('id', selectedType.id)
        .single();

      // cast latestTicket ke known shape
      const latest =
        latestTicket as { id: string; available_seats: number } | null;

      if (latestError || !latest) {
        alert('Gagal cek kuota tiket. Coba lagi.');
        setSubmitting(false);
        return;
      }

      if (latest.available_seats <= 0) {
        alert('Maaf, tiket ini sudah habis.');
        setSelectedType((prev) =>
          prev ? { ...prev, available_seats: 0, status: 'sold_out' } : prev
        );
        setSubmitting(false);
        return;
      }

      if (quantity > latest.available_seats) {
        alert(`Hanya tersisa ${latest.available_seats} tiket.`);
        setSubmitting(false);
        return;
      }

      // siapkan body transaksi
      const body = {
        event_id: eventId,
        voucher_code: promo?.code ?? null,
        paid_amount: total,
        items: [
          {
            ticket_type_id: selectedType.id,
            quantity: quantity,
          },
        ],
      };

      // gunakan apiFetch (otomatiskan token dan error)
      try {
        // beri tahu TypeScript bentuk response dengan generic
        const created = await apiFetch<CreateTxnResponse>('/api/transactions', {
          method: 'POST',
          json: body,
          requireAuth: true,
        });

        // sukses -> redirect ke halaman transaksi
        router.push(`/transactions/${created.transaction.id}`);
      } catch (err) {
        type ServerError = Error & { details?: unknown };
        // apiFetch melempar Error dengan message + details
        if (err instanceof Error) {
          const serverErr = err as ServerError;

          // kalau ada detail dari server (mis. array insufficient), update UI
          if (Array.isArray(serverErr.details)) {
            // treat details as array of records (type-safe)
            const details = serverErr.details as Array<Record<string, unknown>>;
            for (const d of details) {
              const ticket_type_id = d['ticket_type_id'] as string | undefined;
              const available = typeof d['available'] === 'number' ? (d['available'] as number) : undefined;

              if (ticket_type_id === selectedType.id && typeof available === 'number') {
                setSelectedType((prev) =>
                  prev
                    ? {
                        ...prev,
                        available_seats: available,
                        status: available <= 0 ? 'sold_out' : prev.status,
                      }
                    : prev
                );
              }
            }
          }
          alert('Error: ' + err.message);
        } else {
          alert('Error: Unknown error occurred');
        }
      }
    } catch (err) {
      console.error('handleSubmit unexpected', err);
      if (err instanceof Error) {
        alert('Error: ' + err.message);
      } else {
        alert('Error: Unknown error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderTicketLabel = (t: TicketType) => {
    const isSoldOut = t.available_seats <= 0 || t.status === 'sold_out';
    return `${t.name} - IDR ${t.price.toLocaleString()} (${isSoldOut ? 'Sold Out' : `${t.available_seats} left`})`;
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
      <p className="text-blue-600 mb-4 font-medium">{event.category}</p>
      <p className="text-gray-600 mb-6">
        {new Date(event.date).toLocaleDateString()} • {event.venue}, {event.city}
      </p>

      <div className="mb-4">
        <p className="text-sm text-gray-500">
          Total Capacity: {event.capacity?.toLocaleString() ?? '—'} tickets
        </p>
        <p className="text-sm text-gray-500">
          Available Seats (total): {event.available_seats?.toLocaleString() ?? '—'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Ticket Type */}
        <div>
          <label className="block mb-1 font-medium">Ticket Type</label>
          <select
            value={selectedType.id}
            onChange={e => {
              const t = event.ticket_types.find(t => t.id === e.target.value);
              if (t) {
                const normalized = {
                  ...t,
                  status: t.available_seats <= 0 ? 'sold_out' : t.status ?? 'active',
                };
                setSelectedType(normalized);
              }
            }}
            className="w-full border rounded px-3 py-2"
          >
            {event.ticket_types.map(t => (
              <option
                key={t.id}
                value={t.id}
                disabled={t.available_seats <= 0 || t.status === 'sold_out'}
              >
                {renderTicketLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block mb-1 font-medium">Quantity</label>
          <input
            type="number"
            min={1}
            max={selectedType.available_seats}
            value={quantity}
            onChange={e => {
              const val = Math.max(1, Number(e.target.value || 1));
              setQuantity(Math.min(val, selectedType.available_seats));
            }}
            className="w-24 border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maks {selectedType.available_seats} tiket untuk tipe ini.
          </p>
        </div>

        {/* Voucher */}
        <div>
          <label className="block mb-1 font-medium">Voucher Code</label>
          <div className="flex">
            <input
              type="text"
              placeholder="Enter voucher code"
              value={voucher}
              onChange={e => setVoucher(e.target.value)}
              className="flex-1 border rounded-l px-3 py-2"
            />
            <button
              type="button"
              onClick={handleApplyVoucher}
              disabled={applying}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r"
            >
              {applying ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {applyError && <p className="text-sm text-red-500 mt-1">{applyError}</p>}
          {promo && <p className="text-sm text-green-600 mt-1">Promo applied: {promo.code} — discount {promo.discount}{promo.type === 'percent' ? '%' : ''}</p>}
        </div>

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>IDR {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Discount</span>
            <span className="text-green-600">–IDR {discountAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span>IDR {total.toLocaleString()}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || selectedType.available_seats <= 0}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Pay Now'}
        </button>
      </form>
    </main>
  );
}
