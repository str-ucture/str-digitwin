import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ColorRowProps {
  label: string
  displayLabel: string
  color: string
  onChange: (hex: string) => void
  onRename: (next: string) => void
  onResetName: () => void
}

function isValidHex(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

function ColorRow({ label, displayLabel, color, onChange, onRename, onResetName }: ColorRowProps) {
  const [hex, setHex] = useState(color)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayLabel)
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHex(color) }, [color])
  useEffect(() => { setNameDraft(displayLabel) }, [displayLabel])

  function commitHex(raw: string) {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (isValidHex(v)) onChange(v)
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => colorInputRef.current?.click()}
        className="w-7 h-7 rounded-lg border-2 border-white shadow ring-1 ring-gray-200 flex-shrink-0 transition-transform hover:scale-110 cursor-pointer"
        style={{ backgroundColor: isValidHex(hex) ? hex : '#cccccc' }}
        title="Click to pick color"
      />
      <input
        ref={colorInputRef}
        type="color"
        value={isValidHex(hex) ? hex : '#cccccc'}
        className="sr-only"
        onChange={e => { setHex(e.target.value); onChange(e.target.value) }}
      />
      <div className="flex-1 min-w-0">
        {!isEditingName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-gray-700 truncate font-medium" title={displayLabel}>{displayLabel}</span>
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex-shrink-0"
              title="Rename"
            >
              Edit
            </button>
            {displayLabel !== label && (
              <button
                type="button"
                onClick={onResetName}
                className="w-5 h-5 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
                title="Reset name"
              >
                ↺
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              className="flex-1 min-w-0 text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = nameDraft.trim()
                if (trimmed.length > 0) onRename(trimmed)
                setIsEditingName(false)
              }}
              className="w-5 h-5 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center flex-shrink-0"
              title="Accept"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => {
                setNameDraft(displayLabel)
                setIsEditingName(false)
              }}
              className="w-5 h-5 rounded border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0"
              title="Discard"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <input
        type="text"
        value={hex}
        maxLength={7}
        onChange={e => {
          const v = e.target.value
          setHex(v)
          const padded = v.startsWith('#') ? v : `#${v}`
          if (isValidHex(padded)) onChange(padded)
        }}
        onBlur={e => commitHex(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commitHex((e.target as HTMLInputElement).value) }}
        className="w-20 text-[11px] font-mono border border-gray-200 rounded-md px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
        placeholder="#rrggbb"
      />
    </div>
  )
}

interface Props {
  title: string
  values: string[]
  colorMap: Record<string, string>
  labelMap: Record<string, string>
  onApply: (map: Record<string, string>, labels: Record<string, string>) => void
  onClose: () => void
}

const DEFAULT_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
]

export default function FilterColorModal({ title, values, colorMap, labelMap, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    values.forEach((v, i) => {
      init[v] = colorMap[v] ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
    })
    return init
  })
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    values.forEach(v => { init[v] = labelMap[v] ?? v })
    return init
  })

  function setColor(value: string, hex: string) {
    setDraft(prev => ({ ...prev, [value]: hex }))
  }

  function handleResetAll() {
    const reset: Record<string, string> = {}
    values.forEach((v, i) => { reset[v] = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] })
    setDraft(reset)
    const resetLabels: Record<string, string> = {}
    values.forEach(v => { resetLabels[v] = v })
    setDraftLabels(resetLabels)
  }

  function handleApply() {
    onApply(draft, draftLabels)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1.5px]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Color Settings</p>
              <p className="text-sm font-bold text-gray-800">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Color rows */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
          {values.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No values available yet.</p>
          ) : (
            values.map(v => (
              <ColorRow
                key={v}
                label={v}
                displayLabel={draftLabels[v] ?? v}
                color={draft[v] ?? '#cccccc'}
                onChange={hex => setColor(v, hex)}
                onRename={next => setDraftLabels(prev => ({ ...prev, [v]: next }))}
                onResetName={() => setDraftLabels(prev => ({ ...prev, [v]: v }))}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleResetAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            Reset All
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              Close
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
