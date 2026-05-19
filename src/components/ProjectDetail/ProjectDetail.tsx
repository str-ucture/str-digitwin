import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ImageGallery from './ImageGallery'
import { PROJECT_TYPE_COLORS, PROJECT_STATUS_COLORS } from '../../lib/mapbox'
import type { Project } from '../../types/project'

interface ProjectDetailProps {
  project: Project
  onClose: () => void
  activeLayerIndex: number
  activeCameraIndex?: number
  onLayerChange: (index: number, cameraIndex?: number) => void
  activeMaterials?: string[]
  selectedMaterial?: string
  onMaterialChange?: (mat: string) => void
}

export default function ProjectDetail({
  project,
  onClose,
  activeLayerIndex,
  activeCameraIndex = -1,
  onLayerChange,
  activeMaterials = [],
  selectedMaterial = 'all',
  onMaterialChange,
}: ProjectDetailProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('de') ? 'de' : 'en'
  const name = lang === 'de' ? project.name_de : project.name_en
  const description = lang === 'de' ? project.description_de : project.description_en
  const typeColor = PROJECT_TYPE_COLORS[project.type]
  const statusColor = PROJECT_STATUS_COLORS[project.status]
  const images = project.image_urls ?? []
  const allImages = project.thumbnail_url
    ? [project.thumbnail_url, ...images.filter((u) => u !== project.thumbnail_url)]
    : images

  const geojsonCount = project.geojson_layers?.length ?? 0
  const hasGeoJSON = geojsonCount > 0
  const hasModels = project.model_layers && project.model_layers.length > 0

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const completionYear = project.completion_date
    ? new Date(project.completion_date).getFullYear()
    : null

  const [copiedCoords, setCopiedCoords] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setIsExpanded(false)
  }, [project.id])

  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return

    const checkClamp = () => {
      if (!isExpanded) {
        setIsClamped(el.scrollHeight > el.clientHeight)
      }
    }

    checkClamp()
    const timer = setTimeout(checkClamp, 50)

    window.addEventListener('resize', checkClamp)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkClamp)
    }
  }, [description, isExpanded])

  function handleCopyCoords() {
    const text = `${project.lat.toFixed(5)}, ${project.lng.toFixed(5)}`
    navigator.clipboard.writeText(text)
    setCopiedCoords(true)
    setTimeout(() => setCopiedCoords(false), 2000)
  }

  const addedDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <aside className="w-96 flex flex-col border-l border-gray-100 bg-white flex-shrink-0 overflow-hidden animate-slide-in">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeColor }} />
          <span className="text-xs font-medium" style={{ color: typeColor }}>
            {t(`types.${project.type}`)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {/* Image gallery */}
        {allImages.length > 0 && (
          <ImageGallery images={allImages} projectName={name} />
        )}

        {allImages.length === 0 && (
          <div
            className="aspect-video flex items-center justify-center"
            style={{ backgroundColor: `${typeColor}10` }}
          >
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke={typeColor} strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v4M12 10v4M16 10v4" />
            </svg>
          </div>
        )}

        {/* Project info */}
        <div className="p-5 space-y-5">
          {/* Title + featured */}
          <div>
            {project.featured && (
              <span className="text-xs text-amber-500 font-medium flex items-center gap-1 mb-1">
                ★ {t('project.featured')}
              </span>
            )}
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{name}</h2>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: `${statusColor}15`,
                borderColor: `${statusColor}40`,
                color: statusColor,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {t(`status.${project.status}`)}
            </span>
          </div>

          {/* Description */}
          {description ? (
            <div className="space-y-1">
              <p
                ref={descriptionRef}
                className={`text-sm text-gray-600 leading-relaxed text-justify transition-all duration-300 ${
                  isExpanded ? '' : 'line-clamp-4'
                }`}
              >
                {description}
              </p>
              {(isClamped || isExpanded) && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors focus:outline-none flex items-center gap-1 cursor-pointer pt-0.5"
                >
                  {isExpanded ? (
                    <>
                      <span>{t('project.readLess')}</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>{t('project.readMore')}</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">{t('project.noDescription')}</p>
          )}

          {/* Detailed Info Section */}
          <div className="space-y-2.5 pt-1">
            {/* Address full row */}
            {project.address && (
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 flex items-start gap-2.5 transition-all hover:bg-gray-100/60">
                <svg className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium mb-0.5">{t('project.address')}</p>
                  <p className="text-xs font-semibold text-gray-800 break-words">{project.address}, {project.city}</p>
                </div>
              </div>
            )}

            {/* Coordinates full row with copy button */}
            <div className="bg-gray-50 rounded-lg p-1.5 pl-3 border border-gray-100 flex items-center justify-between gap-2 transition-all hover:bg-gray-100/60">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium leading-none mb-1">{t('project.coordinates')}</p>
                  <p className="text-xs font-mono font-semibold text-gray-700 truncate">
                    {project.lat.toFixed(5)}° N, {project.lng.toFixed(5)}° E
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyCoords}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                  copiedCoords
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 shadow-xs'
                }`}
                title="Copy coordinates"
              >
                {copiedCoords ? (
                  <>
                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                    </svg>
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {project.client && (
              <DetailItem label={t('project.client')} value={project.client} />
            )}
            {completionYear && (
              <DetailItem label={t('project.completedDate')} value={String(completionYear)} />
            )}
            {project.area_sqm && (
              <DetailItem
                label={t('project.area')}
                value={t('project.areaSqm', { value: project.area_sqm.toLocaleString() })}
              />
            )}
            {project.city && (
              <DetailItem label={t('project.location')} value={project.city} />
            )}
            {addedDate && (
              <DetailItem label={t('project.addedOn')} value={addedDate} />
            )}
            {(hasGeoJSON || hasModels) && (
              <DetailItem label={t('project.layers')} value={String(geojsonCount + (project.model_layers?.length ?? 0))} />
            )}
          </div>

          {/* Unified Models switcher */}
          {(hasGeoJSON || hasModels) && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Models & Views
              </p>
              <div className="flex flex-col gap-2">
                {/* GeoJSON Layers */}
                {project.geojson_layers?.map((layer, i) => {
                  const isLayerActive = i === activeLayerIndex
                  const cameras = layer.cameras ?? []
                  const hasCameras = cameras.length > 0

                  return (
                    <div key={`geo-${i}`} className="flex flex-col gap-1 border-l-2 border-brand-200 pl-2">
                      <button
                        onClick={() => {
                          onLayerChange(i, -1)
                        }}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors w-full text-left font-medium ${
                          isLayerActive && (!hasCameras || activeCameraIndex === -1)
                            ? 'bg-brand-50 text-brand-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-brand-600'
                        }`}
                      >
                        <svg className="w-3 h-3 flex-shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h1.5M8.25 3.75h7.5M18 3.75a2.25 2.25 0 0 1 2.25 2.25v1.5m0 3v7.5m0 3a2.25 2.25 0 0 1-2.25 2.25h-1.5m-3 0h-7.5m-3 0a2.25 2.25 0 0 1-2.25-2.25v-1.5m0-3v-7.5m0-3h1.5" />
                        </svg>
                        <span className="truncate">{layer.name}</span>
                        <span className="ml-auto text-[10px] text-gray-400 font-normal">Base</span>
                      </button>

                      {/* Named Camera Views */}
                      {hasCameras && (
                        <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                          {cameras.map((cam, ci) => {
                            const isCamActive = isLayerActive && activeCameraIndex === ci
                            return (
                              <button
                                key={ci}
                                onClick={() => {
                                  onLayerChange(i, ci)
                                }}
                                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                  isCamActive
                                    ? 'bg-brand-600 border-brand-600 text-white font-medium shadow-2xs'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600'
                                }`}
                              >
                                <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                                </svg>
                                <span className="max-w-[100px] truncate">{cam.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 3D Models */}
                {project.model_layers?.map((layer, i) => {
                  const unifiedIndex = geojsonCount + i
                  const isLayerActive = unifiedIndex === activeLayerIndex
                  const cameras = layer.cameras ?? []
                  const hasCameras = cameras.length > 0

                  return (
                    <div key={`model-${i}`} className="flex flex-col gap-1 border-l-2 border-indigo-200 pl-2">
                      <button
                        onClick={() => {
                          onLayerChange(unifiedIndex, -1)
                        }}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors w-full text-left font-medium ${
                          isLayerActive && (!hasCameras || activeCameraIndex === -1)
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                        }`}
                      >
                        <svg className="w-3 h-3 flex-shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                        </svg>
                        <span className="truncate">{layer.name}</span>
                        <span className="ml-auto text-[10px] text-gray-400 font-normal">Model</span>
                      </button>

                      {/* Named Camera Views */}
                      {hasCameras && (
                        <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                          {cameras.map((cam, ci) => {
                            const isCamActive = isLayerActive && activeCameraIndex === ci
                            return (
                              <button
                                key={ci}
                                onClick={() => {
                                  onLayerChange(unifiedIndex, ci)
                                }}
                                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                  isCamActive
                                    ? 'bg-indigo-600 border-indigo-600 text-white font-medium shadow-2xs'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                              >
                                <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                                </svg>
                                <span className="max-w-[100px] truncate">{cam.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {t('project.tags')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Materials — only shown when an active model layer has loaded */}
          {activeMaterials.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Materials
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', ...activeMaterials] as string[]).map((mat) => {
                  const isActive = selectedMaterial === mat
                  return (
                    <button
                      key={mat}
                      onClick={() => onMaterialChange?.(mat)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white font-medium shadow-xs'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {mat === 'all' ? 'All' : mat}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}
