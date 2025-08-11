'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export interface TicketType {
  id: string;
  name: string;
  price: number;
  available_seats: number;
  status: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  venue: string;
  city: string;
  price: number;
  imageUrl: string | null;
  ticket_types: TicketType[];
  capacity: number;
}

// tipe promo yang di-return dari API validate
interface Promotion {
  id: string;
  code: string;
  discount: number;
  type: 'percent' | 'nominal';
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive';
}

export default function CheckoutPage() {
  const { id: eventId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);

  // voucher & promo state
  const [voucher, setVoucher] = useState('');
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // fetch event + ticket types
  useEffect(() => {
    const qtyParam = searchParams.get('qty');
    const typeParam = searchParams.get('ticket_type');
    if (qtyParam) setQuantity(Number(qtyParam));

    async function fetchEvent() {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types(*), capacity')
        .eq('id', eventId)
        .single();

      if (error) console.error(error);
      else {
        setEvent(data);
        const pick = data.ticket_types.find(
          (t: TicketType) => t.id === typeParam);
        setSelectedType(pick ?? data.ticket_types[0] ?? null);
      }
      setLoading(false);
    }

    if (eventId) fetchEvent();
  }, [eventId, searchParams]);

  if (loading || !event || !selectedType) {
    return <p className="text-center py-10">Loading checkout…</p>;
  }

  // hitung subtotal, discount dan total
  const subtotal = selectedType.price * quantity;
  let discountAmount = 0;
  if (promo) {
    discountAmount =
      promo.type === 'percent'
        ? Math.round((subtotal * promo.discount) / 100)
        : promo.discount;
  }
  const total = subtotal - discountAmount;

  // apply voucher
  const handleApplyVoucher = async () => {
    if (!voucher.trim()) {
      setPromo(null);
      setApplyError('Masukkan kode voucher dulu.');
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(
        `/api/promotions/validate?event_id=${eventId}&code=${voucher.trim().toUpperCase()}`
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Voucher invalid (${res.status})`);
      }
      const { promotion } = await res.json();
      setPromo(promotion);
    } catch (err) {
      if (err instanceof Error) {
        setPromo(null);
        setApplyError(err.message);
      } else {
        setPromo(null);
        setApplyError('Unknown error occurred');
      }
    } finally {
      setApplying(false);
    }
  };

  // submit checkout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // extra validation
    if (selectedType.status === 'sold_out') {
      alert('Maaf, tiket ini sudah habis.');
      return;
    }
    if (quantity > selectedType.available_seats) {
      alert(`Hanya tersisa ${selectedType.available_seats} tiket.`);
      return;
    }

    setSubmitting(true);
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

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      alert('Error: ' + (data.error || 'Failed to create transaction'));
    } else {
      router.push(`/transactions/${data.transaction.id}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      alert('Error: ' + error.message);
    } else {
      alert('Error: Unknown error occurred');
    }
  } finally {
    setSubmitting(false);
  }
};

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Checkout: {event.title}</h1>
      <p className="text-gray-600 mb-6">
        {new Date(event.date).toLocaleDateString()} • {event.venue}, {event.city}
      </p>

      <p className="text-sm text-gray-500 mb-6">
        Total Capacity: {event.capacity.toLocaleString()} tickets
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Ticket Type */}
        <div>
          <label className="block mb-1 font-medium">Ticket Type</label>
          <select
            value={selectedType.id}
            onChange={e => {
              const t = event.ticket_types.find(t => t.id === e.target.value);
              if (t) setSelectedType(t);
            }}
            className="w-full border rounded px-3 py-2"
          >
            {event.ticket_types.map(t => (
              <option key={t.id} value={t.id} disabled={t.status === 'sold_out'}>
                {`${t.name} - IDR ${t.price.toLocaleString()} (${t.available_seats} left)`}
                {t.status === 'sold_out' && ' (Sold Out)'}
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
            onChange={e => setQuantity(Number(e.target.value))}
            className="w-24 border rounded px-3 py-2"
          />
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
        </div>

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>IDR {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Discount</span>
            <span className="text-green-600">
              –IDR {discountAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span>IDR {total.toLocaleString()}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Pay Now'}
        </button>
      </form>
    </main>
  );
}
