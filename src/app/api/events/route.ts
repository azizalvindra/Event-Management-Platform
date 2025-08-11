// src/app/api/events/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

type TicketTypeInput = {
  name: string;
  price: number;
  seats: number;
};

export async function GET() {
  // Fetch all events along with their ticket types
  const { data, error } = await supabase
    .from('events')
    .select('*, ticket_types(*)')
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    title,
    description,
    country,
    state,
    city,
    venue,
    date,
    end_date,
    time_start,
    time_end,
    price,
    imageUrl,
    ticketTypes,
  }: {
    title: string;
    description: string;
    country: string;
    state: string;
    city: string;
    venue: string;
    date: string;
    end_date: string;
    time_start: string;
    time_end: string;
    price: number;
    available_seats: number;
    imageUrl: string;
    ticketTypes: TicketTypeInput[];
  } = body;

  // 1) Insert into events table
  const { data: newEvent, error: eventError } = await supabase
    .from('events')
    .insert([
      {
        title,
        description,
        country,
        state,
        city,
        venue,
        date,
        end_date,
        time_start,
        time_end,
        price,
        imageUrl,
      },
    ])
    .select('*, ticket_types(*)')
    .single();

  if (eventError || !newEvent?.id) {
    return NextResponse.json(
      { error: eventError?.message || 'Failed to create event' },
      { status: 400 }
    );
  }

  // 2) Insert related ticket types
  if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
    const batch = ticketTypes.map((t) => ({
      event_id: newEvent.id,
      name: t.name,
      price: t.price,
      available_seats: t.seats,
    }));
    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(batch);

    if (ttError) {
      return NextResponse.json(
        { error: ttError.message || 'Failed to insert ticket types' },
        { status: 400 }
      );
    }
  }

  // 3) Fetch and return the full event with ticket types
  const { data: fullEvent, error: fetchError } = await supabase
    .from('events')
    .select('*, ticket_types(*)')
    .eq('id', newEvent.id)
    .single();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(fullEvent, { status: 201 });
}
