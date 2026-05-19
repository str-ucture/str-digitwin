import { useRef, useState, type DragEvent } from 'react'
import { SUPPORTED_INPUT_FORMATS } from './convertToGLB'

const ACCEPT_ATTR = SUPPORTED_INPUT_FORMATS.join(',')

interface Props {
  onFile: (modelFile: File, textureFiles: File[]) => void
}

const FORMAT_BADGES: Array<{ label: string; title?: string; variant: 'default' | 'soon' }> = [
  { label: 'GLB', variant: 'default' },
  { label: 'glTF', variant: 'default' },
  { label: 'OBJ', variant: 'default' },
  { label: 'FBX', variant: 'default' },
  { label: 'DAE', variant: 'default' },
  { label: '.blend ✕', title: 'Blender .blend files cannot be converted in the browser. In Blender, use File → Export → glTF 2.0 instead.', variant: 'soon' },
]

export default function ModelUploader({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handle(files: FileList | File[]) {
    const fileArray = Array.from(files)
    const modelFile = fileArray.find(f => {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      if (ext === '.blend') return false
      return SUPPORTED_INPUT_FORMATS.includes(ext)
    })

    if (!modelFile) {
      const first = fileArray[0]
      const ext = first ? '.' + (first.name.split('.').pop() ?? '').toLowerCase() : ''
      if (ext === '.blend') {
        setError('Blender .blend files cannot be converted in the browser. In Blender, use File → Export → glTF 2.0 (.glb/.gltf) instead.')
      } else {
        setError(`No supported 3D model file found. Accepted: ${SUPPORTED_INPUT_FORMATS.join(', ')}`)
      }
      return
    }

    const textureFiles = fileArray.filter(f => f !== modelFile)
    setError(null)
    onFile(modelFile, textureFiles)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handle(e.dataTransfer.files)
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors select-none p-4 ${
          dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
        }`}
      >
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </div>
        <div className="text-center min-w-0">
          <p className="text-sm font-semibold text-gray-700">
            {dragOver ? 'Drop to load model' : 'Drop a 3D model here'}
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-snug">
            or click to browse — select model + texture files
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center max-w-full">
          {FORMAT_BADGES.map(f => (
            <span
              key={f.label}
              title={f.title}
              className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded cursor-default ${
                f.variant === 'soon'
                  ? 'bg-red-50 text-red-400 line-through'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 text-center leading-normal">
          FBX/OBJ: select all files at once (model + images)
        </p>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500 text-center">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) handle(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
