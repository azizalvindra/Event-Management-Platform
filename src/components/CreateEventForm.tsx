'use client'
import React, { useState, ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload } from 'react-icons/fi'
import { supabase } from '@/lib/supabaseClient'

type TicketType = {
  name: string;
  price: number | '';
  seats: number | '';
}

export default function CreateEventForm({ userId }: { userId?: string }) {
  const router = useRouter()

  const [formData] = useState({
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
    category: 'Konser' // default category
  })

  const [ticketTypes] = useState<TicketType[]>([
    { name: '', price: '', seats: '' }
  ])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)


  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.title.trim()) {
      setError('Judul event wajib diisi')
      setLoading(false)
      return
    }

    const validTickets = ticketTypes.filter(
      t =>
        t.name.trim() !== '' &&
        Number(t.price) >= 0 &&
        Number(t.seats) > 0
    )
    if (validTickets.length === 0) {
      setError('Isi minimal satu ticket type yang valid')
      setLoading(false)
      return
    }

    try {
      let imageUrl = ''
      if (file) {
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('event-thumbnails')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })

        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('event-thumbnails')
          .getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      const totalCapacity = validTickets.reduce(
        (acc, t) => acc + Number(t.seats),
        0
      )

      const finalCapacity =
        totalCapacity > 0
          ? totalCapacity
          : Number(formData.availableSeats) || 0

      const { data: createdEvent, error: insertErr } = await supabase
        .from('events')
        .insert([
          {
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
            price: Number(formData.price) || 0,
            imageUrl: imageUrl,
            capacity: finalCapacity,
            available_seats: finalCapacity,
            category: formData.category,
            organizer_id: userId ?? null,
          },
        ])
        .select('id')
        .single()

      if (insertErr || !createdEvent?.id)
        throw insertErr ?? new Error('Gagal menyimpan event')

      const eventId = createdEvent.id
      const toInsert = validTickets.map(t => ({
        event_id: eventId,
        name: t.name,
        price: Number(t.price),
        available_seats: Number(t.seats),
        status: 'available',
      }))

      if (toInsert.length > 0) {
        const { error: ttError } = await supabase
          .from('ticket_types')
          .insert(toInsert)
        if (ttError) throw ttError
      }

      setLoading(false)
      router.push('/events')
    } catch (err) {
      if (err instanceof Error) {
        console.error('create event err', err)
        setError(err.message || 'Terjadi kesalahan saat menyimpan event')
      } else {
        setError('Terjadi kesalahan tidak diketahui')
      }
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-500">{error}</p>}

      {/* ...input lainnya... */}

      {/* Thumbnail */}
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
          <image
            href={preview}
            className="mt-3 rounded w-full h-64 object-cover"
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
  )
}
