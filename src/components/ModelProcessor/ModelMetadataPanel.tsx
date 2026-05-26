import { useState } from 'react'
import type { FileInfo, SceneMetadata } from './types'
import { PANEL_STYLES, TYPOGRAPHY_STYLES } from '../../styles/designSystem'

function fmt(n: number) {
  return n.toLocaleString()
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDim(v: number) {
  return v.toFixed(2)
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0 ${
      highlight ? 'text-green-700 font-semibold' : ''
    }`}>
      <span className={TYPOGRAPHY_STYLES.label + ' shrink-0'}>{label}</span>
      <span className={TYPOGRAPHY_STYLES.mono + ' text-right font-medium'}>{value}</span>
    </div>
  )
}

interface Props {
  file?: FileInfo | null
  scene?: SceneMetadata | null
  outputBytes?: number | null
  inputBytes?: number | null
  processingDesc?: string | null
  loading?: boolean
}

export default function ModelMetadataPanel({ file, scene, outputBytes, inputBytes, processingDesc, loading }: Props) {
  const compressionRatio = outputBytes != null && inputBytes
    ? ((1 - outputBytes / inputBytes) * 100).toFixed(1)
    : null

  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div className={`${PANEL_STYLES.card} !p-4 flex flex-col ${isCollapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}>
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <span className={TYPOGRAPHY_STYLES.title + ' text-sm'}>File Metadata</span>
        </div>
        <button
          type="button"
          className="w-5 h-5 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-3 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="text-xs text-gray-400 animate-pulse">Analysing model…</p>
          ) : !file && !scene ? (
            <div className="py-3 px-4 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <p className="text-sm font-semibold text-gray-600">No active model loaded</p>
              <p className="text-xs text-gray-400 mt-1 leading-snug">Upload a GLB above to parse geometry details</p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-gray-100 space-y-3 flex-1 min-h-0 pr-1">
          {file && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 mb-2">File Info</p>
              <Row label="Name" value={file.name} />
              <Row label="Format" value={file.format.toUpperCase()} />
              <Row
                label="Size"
                value={
                  outputBytes != null ? (
                    <span>
                      {fmtSize(outputBytes)}{' '}
                      {compressionRatio && (
                        <span className="text-green-600 font-semibold">
                          (-{compressionRatio}%)
                        </span>
                      )}
                    </span>
                  ) : fmtSize(file.sizeBytes)
                }
                highlight={compressionRatio != null}
              />
              {processingDesc && (
                <Row label="Transforms" value={processingDesc} />
              )}
            </div>
          )}

          {scene && (
            <div className="pt-3 space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 mb-2">Geometry</p>
              <Row label="Meshes" value={fmt(scene.meshCount)} />
              <Row label="Vertices" value={fmt(scene.vertexCount)} />
              <Row label="Triangles" value={fmt(scene.triangleCount)} />
              <Row label="Materials" value={fmt(scene.materialCount)} />
              <Row label="Textures" value={fmt(scene.textureCount)} />
            </div>
          )}

          {scene?.boundingBox && (
            <div className="pt-3 space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 mb-2">Bounding Box</p>
              <Row
                label="Size (X × Y × Z)"
                value={`${fmtDim(scene.boundingBox.sizeX)} × ${fmtDim(scene.boundingBox.sizeY)} × ${fmtDim(scene.boundingBox.sizeZ)}`}
              />
              <Row
                label="Min"
                value={`${fmtDim(scene.boundingBox.min.x)}, ${fmtDim(scene.boundingBox.min.y)}, ${fmtDim(scene.boundingBox.min.z)}`}
              />
              <Row
                label="Max"
                value={`${fmtDim(scene.boundingBox.max.x)}, ${fmtDim(scene.boundingBox.max.y)}, ${fmtDim(scene.boundingBox.max.z)}`}
              />
            </div>
          )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
