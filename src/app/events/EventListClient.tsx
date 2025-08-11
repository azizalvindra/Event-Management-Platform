'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

type TicketType = {
  id: string;
  name: string;
  price: number;
  available_seats: number;
};

type Event = {
  id: string;
  title: string;
  description: string;
  date: string;
  end_date: string | null;
  time_start: string | null;
  time_end: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  venue: string | null;
  price: number;
  capacity: number;
  available_seats: number;
  imageUrl: string | null;
  ticket_types: TicketType[];
};

export default function EventListClient() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search')?.toLowerCase() || '';

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndFilter = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`*, ticket_types(*), capacity`)
        .order('date', { ascending: true });

      if (error) {
        console.error('Failed to fetch events:', error);
        setEvents([]);
      } else if (data) {
        const filtered = data.filter((e) => {
          const dateStr = new Date(e.date).toLocaleDateString();
          const haystack = [
            e.title,
            e.venue ?? '',
            e.city ?? '',
            e.state ?? '',
            e.country ?? '',
            dateStr,
            e.description,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        });
        setEvents(filtered);
      }
      setLoading(false);
    };

    fetchAndFilter();
  }, [search]);

  if (loading) {
    return <p className="text-center py-10 text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-semibold text-center mb-12 text-gray-800">
        Upcoming Events
      </h1>

      {events.length === 0 ? (
        <p className="text-center text-gray-600">
          {search ? `No events found for “${search}”.` : 'No events available.'}
        </p>
      ) : (
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
            >
              {event.imageUrl ? (
                <Image
                  src={event.imageUrl}
                  alt={event.title}
                  width={400}
                  height={300}
                  className="h-52 w-full object-cover"
                />
              ) : (
                <div className="h-52 w-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">No Image</span>
                </div>
              )}
              <div className="p-6 flex flex-col flex-grow">
                <h2 className="text-xl font-semibold text-gray-800 mb-1 truncate">
                  {event.title}
                </h2>
                <p className="text-sm text-gray-500 mb-2">
                  Capacity: {event.capacity.toLocaleString()} tickets
                </p>

                <p className="text-sm text-gray-500 mb-2">
                  {new Date(event.date).toLocaleDateString()}
                  {event.time_start && ` • ${event.time_start}`}{' '}
                  {event.venue && `• ${event.venue}, ${event.city}`}
                </p>
                <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow">
                  {event.description}
                </p>
                <p className="text-sm text-gray-800 font-medium mb-4">
                  Starting at IDR {event.price.toLocaleString()}
                </p>

                <Link
                  href={`/events/${event.id}`}
                  className="inline-block mt-auto bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 transition"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
