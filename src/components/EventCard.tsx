// src/components/EventCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export type EventProps = {
  id: string;
  title: string;
  location: string;
  date: string;
  price: number;
  imageUrl?: string | null;
};

export function EventCard({
  id,
  title,
  location,
  date,
  price,
  imageUrl,
}: EventProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col">
      {/* Image wrapper must be position:relative for fill */}
      <Link href={`/events/${id}`}>
        <div className="relative h-48 w-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-200 h-full w-full">
              <span className="text-gray-500">No Image</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex-grow">
        <h3 className="text-lg font-semibold mb-1 truncate">{title}</h3>
        <p className="text-sm text-gray-600">{location}</p>
        <p className="text-sm text-gray-600 mb-2">
          {format(new Date(date), 'd MMMM yyyy', { locale: idLocale })}
        </p>
        <span className="inline-block text-sm font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
          {price === 0 ? 'Free' : `IDR ${price.toLocaleString()}`}
        </span>
      </div>

      <div className="px-4 pb-4">
        <Link href={`/events/${id}`}>
          <button className="bg-blue-600 text-white py-2 px-4 rounded w-full text-sm font-semibold hover:bg-blue-700 transition">
            View Details
          </button>
        </Link>
      </div>
    </div>
  );
}
