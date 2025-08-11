'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

interface TicketType {
  id: string;
  name: string;
  price: number;
  available_seats: number;
  status: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  country: string;
  state: string;
  city: string;
  venue: string;
  date: string;
  end_date: string | null;
  time_start: string | null;
  time_end: string | null;
  price: number;
  capacity: number;
  imageUrl: string | null;
  ticket_types: TicketType[];
}

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types(*), capacity')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching event:', error.message);
      } else {
        setEvent(data);
        if (data?.ticket_types?.length) {
          setSelectedType(data.ticket_types[0]);
        }
      }
      setLoading(false);
    };
    if (id) fetchEvent();
  }, [id]);

  if (loading) return <p className="text-center py-10">Loading event...</p>;
  if (!event) return <p className="text-center py-10">Event not found.</p>;

  const handleBuy = () => {
    if (!selectedType) return;
    router.push(
      `/events/${id}/checkout?ticket_type=${selectedType.id}&qty=${quantity}`
    );
  };

  return (
    <main className="max-w-screen-xl mx-auto p-6 relative">
      {/* Tombol Manage Promotions */}
      <button
        onClick={() => router.push(`/events/${id}/promotions`)}
        className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-shadow shadow-md z-20"
      >
        Manage Promotions
      </button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Image Section */}
        <div className="relative w-full md:w-1/2 h-64 md:h-auto rounded-lg overflow-hidden">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="bg-gray-200 w-full h-full flex items-center justify-center">
              <span className="text-gray-500">No Image</span>
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-4">{event.title}</h1>

          <p className="text-gray-600 mb-1">
            📍 {event.venue}, {event.city}, {event.state}, {event.country}
          </p>

          <p className="text-gray-600 mb-4">
            🗓️ {new Date(event.date).toLocaleDateString()}
            {event.time_start && ` • ${event.time_start}`}
            {event.end_date && ` - ${new Date(event.end_date).toLocaleDateString()}`}
            {event.time_end && ` • ${event.time_end}`}
          </p>

          <p className="text-gray-800 mb-6">{event.description}</p>

          {/* Display capacity */}
          <p className="text-sm text-gray-500 mb-4">
            Total Capacity: {event.capacity.toLocaleString()} tickets
          </p>

          {/* Ticket Selection */}
          <div className="space-y-4 mb-6">
            <label className="block">
              <span className="text-sm font-medium">Ticket Type</span>
              <select
                className="w-full p-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={selectedType?.id || ''}
                onChange={(e) => {
                  const type = event.ticket_types.find(
                    (t) => t.id === e.target.value
                  );
                  setSelectedType(type || null);
                  setQuantity(1);
                }}
              >
                {event.ticket_types.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={t.status === 'sold_out'}
                  >
                    {t.name} • IDR {t.price.toLocaleString()}{' '}
                    {t.status === 'sold_out'
                      ? ' • Sold Out'
                      : ` • ${t.available_seats} seats left`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Quantity</span>
              <input
                type="number"
                min={1}
                max={selectedType?.available_seats || 1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1 block w-24 border rounded p-2"
              />
            </label>
          </div>

          <button
            onClick={handleBuy}
            disabled={!selectedType || quantity < 1}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            Buy Ticket
          </button>
        </div>
      </div>
    </main>
  );
}
