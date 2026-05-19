import { useRef, useState, type DragEvent } from 'react'
import { supabase } from '../../lib/supabase'

const MAX_DIMENSION = 1920
const WEBP_QUALITY = 0.90

async function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      const longer = Math.max(width, height)
      if (longer > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / longer
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Image conversion failed')); return }
          resolve(blob)
        },
        'image/webp',
        WEBP_QUALITY,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')) }
    img.src = objectUrl
  })
}

async function uploadToStorage(file: File): Promise<string> {
  const blob = await processImage(file)
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
  const { error } = await supabase.storage.from('project-images').upload(path, blob, { contentType: 'image/webp' })
  if (error) throw error
  return supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl
}

// ─── Single image (thumbnail) ────────────────────────────────────────────────

interface SingleProps {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
}

export function SingleImageUploader({ value, onChange, label = 'Image' }: SingleProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handle(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('File must be an image')
      return
    }
    setUploading(true)
    setError(null)
    try {
      onChange(await uploadToStorage(file))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {value ? (
        <div className="relative w-32 h-32 group">
          <img src={value} alt="" className="w-32 h-32 object-cover rounded-xl border border-gray-200" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-32 h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors select-none ${
            dragOver
              ? 'border-brand-400 bg-brand-50'
              : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <span className="text-xs text-gray-400">Uploading…</span>
          ) : (
            <>
              <svg className="w-7 h-7 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-400">Upload</span>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }}
      />
    </div>
  )
}

// ─── Multiple images (gallery) ───────────────────────────────────────────────

interface MultiProps {
  value: string[]
  onChange: (urls: string[]) => void
}

export function MultiImageUploader({ value, onChange }: MultiProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(files: FileList) {
    setUploading(true)
    setError(null)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        urls.push(await uploadToStorage(file))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed')
        break
      }
    }
    onChange([...value, ...urls])
    setUploading(false)
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className="relative w-20 h-20 group">
            <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-brand-400 hover:bg-gray-50 transition-colors text-gray-400 disabled:opacity-50"
        >
          {uploading ? (
            <span className="text-xs">…</span>
          ) : (
            <>
              <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">Add</span>
            </>
          )}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) { handle(e.target.files); e.target.value = '' } }}
      />
    </div>
  )
}
