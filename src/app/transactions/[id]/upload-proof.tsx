'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function UploadProof({ transactionId, onUploadSuccess }: { transactionId: string, onUploadSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Pilih file terlebih dahulu')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const filePath = `proofs/${transactionId}/${transactionId}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('transaction-proofs').upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('transaction-proofs').getPublicUrl(filePath)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) throw new Error('Gagal mendapatkan URL bukti pembayaran')

      const res = await fetch(`/api/transactions/${transactionId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_url: publicUrl }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal update transaksi')
      }

      setSuccess(true)
      if (onUploadSuccess) onUploadSuccess()

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat upload');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white shadow">
      <h2 className="text-lg font-semibold">Upload Bukti Pembayaran</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100" />
      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        className={`w-full py-2 rounded text-white font-semibold transition ${uploading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {uploading ? 'Mengunggah...' : 'Upload Bukti'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">Bukti pembayaran berhasil diupload!</p>}
    </div>
  )
}
