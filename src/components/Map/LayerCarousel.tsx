import { useState, useEffect, useRef } from 'react'
import type { NamedCamera } from '../../types/project'

export interface CarouselLayer {
  name: string
  type?: 'geojson' | 'model'
  cameras: NamedCamera[]
}

interface FlatItem {
  layerIndex: number
  cameraIndex: number | null  // null = no named cameras on this layer
  layerName: string
  cameraName?: string
  type: 'geojson' | 'model'
}

interface LayerCarouselProps {
  layers: CarouselLayer[]
  activeLayerIndex: number
  activeCameraIndex: number           // -1 = no named camera active
  onLayerChange: (layerIndex: number, cameraIndex?: number) => void
  onSaveCamera?: (cameraIndex: number | null) => Promise<void>
  onAddCamera?: (name: string) => Promise<void>
  onDeleteCamera?: (cameraIndex: number) => Promise<void>
  onRenameCamera?: (cameraIndex: number, name: string) => Promise<void>
  onSaveProjectView?: () => Promise<void>
}

function buildFlatItems(layers: CarouselLayer[]): FlatItem[] {
  const items: FlatItem[] = []
  layers.forEach((layer, li) => {
    const type = layer.type ?? 'geojson'
    // Always push the base layer view as the primary anchor
    items.push({ layerIndex: li, cameraIndex: null, layerName: layer.name, type })
    // Push subsequent named cameras as additional items
    layer.cameras.forEach((cam, ci) => {
      items.push({ layerIndex: li, cameraIndex: ci, layerName: layer.name, cameraName: cam.name, type })
    })
  })
  return items
}

function findFlatIndex(items: FlatItem[], layerIndex: number, cameraIndex: number) {
  const idx = items.findIndex(it =>
    it.layerIndex === layerIndex &&
    (cameraIndex === -1 ? it.cameraIndex === null : it.cameraIndex === cameraIndex)
  )
  return idx < 0 ? 0 : idx
}

// Icons
function CamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

export default function LayerCarousel({
  layers,
  activeLayerIndex,
  activeCameraIndex,
  onLayerChange,
  onSaveCamera,
  onAddCamera,
  onDeleteCamera,
  onRenameCamera,
  onSaveProjectView,
}: LayerCarouselProps) {
  const isAdmin = !!(onSaveCamera || onAddCamera || onDeleteCamera || onRenameCamera || onSaveProjectView)
  const flatItems = buildFlatItems(layers)
  const activeFlatIndex = findFlatIndex(flatItems, activeLayerIndex, activeCameraIndex)
  const hasMultiple = flatItems.length > 1

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  // Admin state
  const [projSaveState, setProjSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [camSaveState, setCamSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [addingCamera, setAddingCamera] = useState(false)
  const [newCameraName, setNewCameraName] = useState('')
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setAnimKey(k => k + 1) }, [activeFlatIndex])
  useEffect(() => { if (addingCamera) setTimeout(() => addInputRef.current?.focus(), 50) }, [addingCamera])
  useEffect(() => { if (renamingIndex !== null) setTimeout(() => renameInputRef.current?.focus(), 50) }, [renamingIndex])

  if (flatItems.length === 0) return null

  const activeItem = flatItems[activeFlatIndex]
  const activeCameras = layers[activeLayerIndex]?.cameras ?? []
  const isModel = activeItem.type === 'model'

  function navigateToFlat(flatIdx: number) {
    const item = flatItems[flatIdx]
    onLayerChange(item.layerIndex, item.cameraIndex !== null ? item.cameraIndex : -1)
  }

  function goPrev() {
    setDirection('right')
    navigateToFlat(activeFlatIndex === 0 ? flatItems.length - 1 : activeFlatIndex - 1)
  }
  function goNext() {
    setDirection('left')
    navigateToFlat(activeFlatIndex === flatItems.length - 1 ? 0 : activeFlatIndex + 1)
  }

  async function handleSaveProjectView() {
    if (!onSaveProjectView || projSaveState !== 'idle') return
    setProjSaveState('saving')
    await onSaveProjectView()
    setProjSaveState('saved')
    setTimeout(() => setProjSaveState('idle'), 2000)
  }

  async function handleSaveCurrentCamera() {
    if (!onSaveCamera || camSaveState !== 'idle') return
    setCamSaveState('saving')
    await onSaveCamera(activeItem.cameraIndex)
    setCamSaveState('saved')
    setTimeout(() => setCamSaveState('idle'), 2000)
  }

  async function handleAddCamera() {
    if (!onAddCamera || !newCameraName.trim()) return
    await onAddCamera(newCameraName.trim())
    setNewCameraName('')
    setAddingCamera(false)
  }

  async function handleRename() {
    if (!onRenameCamera || renamingIndex === null || !renameValue.trim()) return
    await onRenameCamera(renamingIndex, renameValue.trim())
    setRenamingIndex(null)
    setRenameValue('')
  }

  async function handleDelete(index: number) {
    if (!onDeleteCamera) return
    setDeletingIndex(index)
    await onDeleteCamera(index)
    setDeletingIndex(null)
  }

  // Group flat items by layer for dropdown display
  const grouped = layers.map((layer, li) => ({
    layer,
    layerIndex: li,
    items: flatItems.filter(it => it.layerIndex === li),
  }))

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none select-none">

      {/* ── Main pill ── */}
      <div className="flex items-center gap-0 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg pointer-events-auto relative">

        {/* Left navigation arrow */}
        <button
          onClick={goPrev}
          disabled={!hasMultiple}
          className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0 rounded-l-full disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Previous view"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

        {/* Label + dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => hasMultiple && setDropdownOpen(o => !o)}
            className={`px-5 min-w-[160px] max-w-[240px] h-10 flex flex-col items-center justify-center gap-0 transition-colors group ${
              hasMultiple ? 'hover:bg-gray-100' : 'cursor-default rounded-full'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                key={`lbl-${animKey}`}
                className="text-sm font-semibold text-gray-800 truncate"
                style={{
                  animationName: direction === 'left' ? 'carouselSlideLeft' : direction === 'right' ? 'carouselSlideRight' : 'none',
                  animationDuration: '180ms',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                }}
              >
                {activeItem.layerName}
              </span>
              {hasMultiple && (
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              )}
            </div>
            {/* Sub-label: camera view name */}
            {activeItem.cameraName && (
              <span className="text-[10px] text-gray-400 font-medium truncate -mt-0.5 leading-tight flex items-center gap-1">
                <CamIcon className="w-2.5 h-2.5" />
                {activeItem.cameraName}
              </span>
            )}
          </button>

          {/* Grouped dropdown */}
          {hasMultiple && dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-56 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl py-2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden">
                <div className="max-h-[220px] overflow-y-auto sidebar-scroll">
                  {grouped.map(({ layer, layerIndex, items }) => (
                    <div key={layerIndex}>
                      {/* Layer section header (only shown when layer has named cameras) */}
                      {items.length > 1 && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-0.5">
                          {layer.name}
                        </p>
                      )}
                      {items.map((item, relIdx) => {
                        const globalFlatIdx = flatItems.indexOf(item)
                        const isCurrent = globalFlatIdx === activeFlatIndex
                        return (
                          <button
                            key={relIdx}
                            onClick={() => {
                              setDirection(globalFlatIdx > activeFlatIndex ? 'left' : 'right')
                              navigateToFlat(globalFlatIdx)
                              setDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 transition-all flex items-center gap-2 text-xs font-medium ${
                              isCurrent ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {item.cameraName ? (
                              <CamIcon className="w-3 h-3 flex-shrink-0 text-gray-400" />
                            ) : layer.type === 'model' ? (
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h1.5M8.25 3.75h7.5M18 3.75a2.25 2.25 0 0 1 2.25 2.25v1.5m0 3v7.5m0 3a2.25 2.25 0 0 1-2.25 2.25h-1.5m-3 0h-7.5m-3 0a2.25 2.25 0 0 1-2.25-2.25v-1.5m0-3v-7.5m0-3h1.5" />
                              </svg>
                            )}
                            <span className="truncate">{item.cameraName ?? item.layerName}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

        {/* Right navigation arrow */}
        <button
          onClick={goNext}
          disabled={!hasMultiple}
          className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0 rounded-r-full disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Next view"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* ── Dots: one per flat item ── */}
      {hasMultiple && (
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {flatItems.map((_, i) => (
            <button
              key={i}
              onClick={() => navigateToFlat(i)}
              className={`rounded-full transition-all duration-200 ${
                i === activeFlatIndex ? 'w-4 h-1.5 bg-white shadow' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to view ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ── Add camera view input ── */}
      {isAdmin && addingCamera && (
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-brand-300 rounded-full shadow-xl px-3 py-1.5 animate-in fade-in zoom-in-95 duration-150">
          <CamIcon className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
          <input
            ref={addInputRef}
            value={newCameraName}
            onChange={e => setNewCameraName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCamera(); if (e.key === 'Escape') setAddingCamera(false) }}
            placeholder="View name (e.g. Overview)"
            className="text-xs w-40 outline-none bg-transparent font-medium text-gray-800 placeholder-gray-400"
          />
          <button onClick={handleAddCamera} disabled={!newCameraName.trim()} className="px-2 py-0.5 text-[10px] font-bold bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors disabled:opacity-40">
            Add
          </button>
          <button onClick={() => { setAddingCamera(false); setNewCameraName('') }} className="p-0.5 text-gray-400 hover:text-gray-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Rename input for active named camera ── */}
      {isAdmin && renamingIndex !== null && (
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white border border-brand-400 rounded-full shadow px-3 py-1.5 animate-in fade-in zoom-in-95 duration-150">
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingIndex(null) }}
            className="text-xs w-32 outline-none bg-transparent font-medium text-gray-800"
            placeholder="New name"
          />
          <button onClick={handleRename} className="text-brand-600 hover:text-brand-700">
            <CheckIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setRenamingIndex(null)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Admin toolbar ── */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 pointer-events-auto mt-0.5 flex-wrap justify-center">

          {onSaveProjectView && (
            <button
              onClick={handleSaveProjectView}
              disabled={projSaveState === 'saving'}
              title="Save current map center as project default"
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-all ${
                projSaveState === 'saved' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white/90 backdrop-blur-sm border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm'
              } disabled:opacity-50`}
            >
              {projSaveState === 'saved' ? <><CheckIcon className="w-3 h-3" />Saved</> : <><PinIcon className="w-3 h-3 text-blue-500" />{projSaveState === 'saving' ? 'Saving…' : 'Default'}</>}
            </button>
          )}

          {onSaveCamera && (
            <button
              onClick={handleSaveCurrentCamera}
              disabled={camSaveState === 'saving'}
              title={activeItem.cameraName ? `Update "${activeItem.cameraName}" to current view` : `Save as ${isModel ? 'model' : 'layer'} default camera`}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-all ${
                camSaveState === 'saved' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white/90 backdrop-blur-sm border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm'
              } disabled:opacity-50`}
            >
              {camSaveState === 'saved' ? <><CheckIcon className="w-3 h-3" />Saved</> : <><CamIcon className="w-3 h-3 text-green-600" />{camSaveState === 'saving' ? 'Saving…' : (activeItem.cameraIndex !== null ? 'Update View' : (isModel ? 'Model' : 'Layer'))}</>}
            </button>
          )}

          {/* Rename active named camera */}
          {onRenameCamera && activeItem.cameraIndex !== null && (
            <button
              onClick={() => { setRenamingIndex(activeItem.cameraIndex!); setRenameValue(activeItem.cameraName ?? '') }}
              title="Rename this view"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-gray-200 bg-white/90 backdrop-blur-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-700 shadow-sm transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
              Rename
            </button>
          )}

          {/* Delete active named camera */}
          {onDeleteCamera && activeItem.cameraIndex !== null && (
            <button
              onClick={() => handleDelete(activeItem.cameraIndex!)}
              disabled={deletingIndex === activeItem.cameraIndex}
              title="Delete this view"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-gray-200 bg-white/90 backdrop-blur-sm text-gray-700 hover:border-red-300 hover:text-red-600 shadow-sm transition-all disabled:opacity-40"
            >
              {deletingIndex === activeItem.cameraIndex ? (
                <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Delete View
            </button>
          )}

          {/* Add new named camera view */}
          {onAddCamera && (
            <button
              onClick={() => setAddingCamera(true)}
              title="Add a new named camera view"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-gray-200 bg-white/90 backdrop-blur-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-700 shadow-sm transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              View
            </button>
          )}
        </div>
      )}
    </div>
  )
}
