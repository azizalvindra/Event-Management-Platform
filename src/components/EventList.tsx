// src/components/EventList.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from './EventCard';


export type Event = {
  id: string;
  title: string;
  location: string;
  date: string;
  price: number;
  imageUrl: string;
  description: string;
  category: string;
};

interface EventListProps {
  category?: string;
}

export function EventList({ category }: EventListProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Failed to fetch events');
        const data: Event[] = await res.json();
        const filtered = category
          ? data.filter((evt) => evt.category.toLowerCase() === category.toLowerCase())
          : data;
        setEvents(filtered);
        setError(null);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Gagal memuat data event. Silakan coba lagi nanti.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [category]);
  
  if (loading) return <p className="text-center py-10">Loading events...</p>;
  if (error) return <p className="text-center text-red-600 py-10">{error}</p>;
  if (!Array.isArray(events) || events.length === 0)
    return <p className="text-center text-gray-500 py-10">Belum ada event yang tersedia.</p>;

  return (
    <div className="relative">

      {/* Container scroll horizontal */}
      <div
        ref={scrollRef}
        className="flex space-x-6 overflow-x-auto scrollbar-hide py-4 px-10 scroll-smooth"
      >
        {events.map((evt) => (
          <div key={evt.id} className="flex-shrink-0 w-[280px]">
            <EventCard
              id={evt.id}
              title={evt.title}
              location={evt.location}
              date={evt.date}
              price={evt.price}
              imageUrl={evt.imageUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
