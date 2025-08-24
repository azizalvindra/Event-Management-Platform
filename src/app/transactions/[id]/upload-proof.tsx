// src/app/transactions/[id]/upload-proof.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { apiFetch } from '@/lib/apiFetch'
import Image from 'next/image'

export default function UploadProof({
  transactionId,
  onUploadSuccess,
}: {
  transactionId: string
  onUploadSuccess?: () => void
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)

    const selected = e.target.files?.[0] ?? null
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (!selected) {
      setFile(null)
      return
    }

    if (!selected.type.startsWith('image/')) {
      setError('File harus berupa gambar (jpg, png, dsb).')
      setFile(null)
      return
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError('Ukuran file terlalu besar. Maksimal 5MB.')
      setFile(null)
      return
    }

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Pilih file terlebih dahulu')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const rawExt = (file.name.split('.').pop() || 'jpg')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
      const fileExt = rawExt.length ? rawExt : 'jpg'
      const filePath = `proofs/${transactionId}/${transactionId}_${Date.now()}.${fileExt}`

      // upload ke bucket
      const { error: uploadError } = await supabase.storage
        .from('transaction-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message || 'Gagal mengunggah file ke storage')
      }

      // dapatkan public URL (tanpa any)
      const { data } = supabase.storage.from('transaction-proofs').getPublicUrl(filePath)
      const publicUrl: string | null = data?.publicUrl ?? null
      if (!publicUrl) {
        throw new Error('Gagal mendapatkan URL publik untuk bukti pembayaran')
      }

      // === PENTING: panggil API server-side yang memakai service role
      // Endpoint: POST /api/transactions/:id
      // Body: { fileUrl: string }
      const apiResp = await apiFetch(`/api/transactions/${encodeURIComponent(transactionId)}`, {
        method: 'POST',
        json: { fileUrl: publicUrl },
      })

      // apiFetch seharusnya melempar error jika status tidak OK,
      // tapi kalau implementasimu mengembalikan object, cek ok property
      if (apiResp && typeof apiResp === 'object' && 'ok' in apiResp && apiResp.ok === false) {
        const msg = (apiResp as any).error ?? 'Server menolak permintaan'
        throw new Error(String(msg))
      }

      setSuccess(true)
      setFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }

      if (onUploadSuccess) {
        try {
          onUploadSuccess()
        } catch {
          // ignore
        }
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error('[UploadProof] error', err)
      if (err instanceof Error) setError(err.message)
      else setError('Terjadi kesalahan saat upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white shadow">
      <h2 className="text-lg font-semibold">Upload Bukti Pembayaran</h2>

      {previewUrl ? (
        <div className="mb-2">
          <p className="text-sm text-gray-500 mb-1">Preview:</p>
          <div className="relative w-full h-48 rounded overflow-hidden border">
            <Image src={previewUrl} alt="preview" fill className="object-cover" />
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Pilih gambar bukti pembayaran (maks 5MB).</p>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
      />

      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        className={`w-full py-2 rounded text-white font-semibold transition ${
          uploading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {uploading ? 'Mengunggah...' : 'Upload Bukti'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">Bukti pembayaran berhasil diupload!</p>}
    </div>
  )
}
