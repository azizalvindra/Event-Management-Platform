//src/app/events/create/page.tsx

'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { FiUpload, FiPlusCircle, FiTrash2 } from 'react-icons/fi';
import Image from 'next/image'

type TicketType = {
  name: string;
  price: number;
  seats: number;
};

export default function CreateEventPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    endDate: '',
    timeStart: '',
    timeEnd: '',
    country: '',
    state: '',
    city: '',
    venue: '',
    price: '',
    availableSeats: '',
  });

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    { name: '', price: 0, seats: 0 },
  ]);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTicketChange = (
    idx: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setTicketTypes((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, [name]: value } : t
      )
    );
  };

  const addTicketType = () => {
    setTicketTypes((prev) => [...prev, { name: '', price: 0, seats: 0 }]);
  };

  const removeTicketType = (idx: number) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1) Validasi judul
    if (!formData.title.trim()) {
      alert('Judul event wajib diisi!');
      setLoading(false);
      return;
    }

     const validTickets = ticketTypes.filter(
    (t) =>
      t.name.trim() !== '' &&
      Number(t.price) >= 0 &&
      Number(t.seats) > 0
  );
  if (validTickets.length === 0) {
    alert('Harap isi minimal satu ticket type dengan data yang valid!');
    setLoading(false);
    return;
  }

    // 1) Upload thumbnail
    let imageUrl = '';
    if (file) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('event-thumbnails')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadErr) {
        setError('Gagal upload gambar.');
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from('event-thumbnails')
        .getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    // 5) Hitung total kapasitas dari semua ticket types
  const totalCapacity = validTickets.reduce(
    (acc, t) => acc + Number(t.seats),
    0);

    // 2) Insert ke table events
    const { data: createdEvent, error: insertErr } = await supabase
  .from('events')
  .insert([{
      title: formData.title,
      description: formData.description,
      date: formData.date,
      end_date: formData.endDate || null,
      time_start: formData.timeStart || null,
      time_end: formData.timeEnd || null,
      country: formData.country,
      state: formData.state,
      city: formData.city,
      venue: formData.venue,
      price: Number(formData.price),
      imageUrl,
      capacity: totalCapacity,
      available_seats: totalCapacity,
  }])
  .select('id')
  .single();  // => data: { id: string } | null

if (insertErr || !createdEvent?.id) {
  setError('Gagal menyimpan event.');
  setLoading(false);
  return;
}

const eventId = createdEvent.id;
    
    // 3) Insert ke table ticket_types

  // 2) Prepare ticket types
  const toInsert = validTickets.map((t) => ({
    event_id: eventId,
    name: t.name,
    price: Number(t.price),
    available_seats: Number(t.seats),
    status: 'available',
  }));

  // 3) Batch insert ticket types
  if (toInsert.length > 0) {
    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(toInsert);
    if (ttError) {
      setLoading(false);
      alert('Gagal menambahkan ticket types: ' + ttError.message);
      return;
    }
  }

  // 4) Redirect
  setLoading(false);
  router.push('/events');
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Create New Event</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <input
          name="title"
          placeholder="Event Title"
          onChange={handleChange}
          value={formData.title}
          required
          className="w-full border px-4 py-2 rounded"
        />
        <textarea
          name="description"
          placeholder="Description"
          onChange={handleChange}
          value={formData.description}
          required
          rows={4}
          className="w-full border px-4 py-2 rounded"
        />

        {/* Date & Time */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Start Date</label>
            <input
              type="date"
              name="date"
              onChange={handleChange}
              value={formData.date}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              onChange={handleChange}
              value={formData.endDate}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Start Time</label>
            <input
              type="time"
              name="timeStart"
              onChange={handleChange}
              value={formData.timeStart}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">End Time</label>
            <input
              type="time"
              name="timeEnd"
              onChange={handleChange}
              value={formData.timeEnd}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <div>
            <label className="block mb-1">Country</label>
            <input
              name="country"
              placeholder="Country"
              onChange={handleChange}
              value={formData.country}
              required
              className="w-full border px-4 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">State / Province</label>
            <input
              name="state"
              placeholder="State or Province"
              onChange={handleChange}
              value={formData.state}
              required
              className="w-full border px-4 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">City</label>
            <input
              name="city"
              placeholder="City"
              onChange={handleChange}
              value={formData.city}
              required
              className="w-full border px-4 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Venue</label>
            <input
              name="venue"
              placeholder="Venue Address"
              onChange={handleChange}
              value={formData.venue}
              required
              className="w-full border px-4 py-2 rounded"
            />
          </div>
        </div>

        {/* Price & Seats */}
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            type="number"
            name="price"
            placeholder="Base Ticket Price (IDR)"
            onChange={handleChange}
            value={formData.price}
            required
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type="number"
            name="availableSeats"
            placeholder="Total Seats"
            onChange={handleChange}
            value={formData.availableSeats}
            required
            className="w-full border px-4 py-2 rounded"
          />
        </div>

        {/* Dynamic Ticket Types */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Ticket Types</h2>
          {ticketTypes.map((t, i) => (
            <div key={i} className="flex gap-2 items-end">
              <input
                name="name"
                placeholder="Type (e.g. VIP)"
                value={t.name}
                onChange={(e) => handleTicketChange(i, e )}
                required
                className="flex-1 border px-3 py-2 rounded"
              />
              <input
                name="price"
                type="number"
                placeholder="Price (IDR)"
                value={t.price}
                onChange={(e) => handleTicketChange(i, e )}
                required
                className="w-24 border px-3 py-2 rounded"
              />
              <input
                name="seats"
                type="number"
                placeholder="Seats"
                value={t.seats}
                onChange={(e) => handleTicketChange(i, e )}
                required
                className="w-24 border px-3 py-2 rounded"
              />
              <button
                type="button"
                onClick={() => removeTicketType(i)}
                className="text-red-500 p-1"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTicketType}
            className="flex items-center text-blue-600 hover:underline"
          >
            <FiPlusCircle className="mr-1" /> Add Ticket Type
          </button>
        </div>

        {/* Thumbnail Upload */}
        <div>
          <label
            htmlFor="file"
            className="flex items-center justify-center border-2 border-dashed border-gray-400 py-6 cursor-pointer rounded hover:bg-gray-100 transition"
          >
            <FiUpload className="mr-2 text-xl" />
            {preview ? 'Change Thumbnail' : 'Upload Thumbnail'}
          </label>
          <input
            id="file"
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          {preview && (
          <Image
            src={preview}
            alt="Preview"
            className="mt-3 rounded"
            width={400}  // sesuaikan dengan kebutuhan, misal 400px
            height={256} // supaya proporsinya sesuai dengan h-64 (64*4 = 256)
            style={{ objectFit: 'cover' }}
          />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? 'Saving...' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}
