import React, { Suspense } from 'react';
import EventListClient from './EventListClient';

export default function EventsPage() {
  return (
    <Suspense fallback={<p className="text-center py-10 text-gray-500">Loading events...</p>}>
      <EventListClient />
    </Suspense>
  );
}
