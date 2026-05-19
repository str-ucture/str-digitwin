import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import { mapInstanceRef } from '../../lib/mapContext'

import { STADIA_TONER_LITE_STYLE, OSM_RASTER_STYLE, MAPBOX_TOKEN } from '../../lib/mapbox'

const MAP_STYLES = [
  { id: 'strmap', name: 'StrMap (Default)', url: 'mapbox://styles/shailesh-stha/cmpccgocy00ak01s77u783e72' },
  { id: 'light', name: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'stamen-toner', name: 'Stamen Toner Lite', url: STADIA_TONER_LITE_STYLE },
  { id: 'dark', name: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'streets', name: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'outdoors', name: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'satellite', name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-v9' },
  { id: 'satellite-streets', name: 'Satellite Streets', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'standard', name: 'Mapbox Standard', url: 'mapbox://styles/mapbox/standard' },
  { id: 'osm-standard', name: 'OpenStreetMap Standard', url: OSM_RASTER_STYLE },
]

const LIGHTING_PRESETS = ['day', 'night', 'dawn', 'dusk']
const THEMES = ['default', 'monochrome', 'faded']

const BUILDING_COLORS = [
  { id: 'default', name: 'Default', color: '#dde4ec' },
  { id: 'urban', name: 'Urban', color: '#adb5bd' },
  { id: 'warm', name: 'Warm', color: '#e8d5c4' },
  { id: 'night', name: 'Night', color: '#2d3748' },
  { id: 'blueprint', name: 'Blueprint', color: '#1e3a5f' },
  { id: 'minimal', name: 'Minimal', color: '#f5f5f5' },
  { id: 'brand', name: 'Brand Pink', color: '#ffb3e2' },
]

const TEXTURE_IMAGE_NAME = 'building-facade-texture'
// Drop your own power-of-2 image (e.g. 128×128) into /public to use a custom texture.
const TEXTURE_FILE_PATH = '/building-texture.png'

// Reference zoom at which textureScale=1 produces one tile per ~floor-height of wall.
// pixelRatio is halved for each zoom step above this (building face grows 2× but tile stays same size),
// which keeps the physical tile size constant regardless of zoom level.
const TEXTURE_REFERENCE_ZOOM = 16

function getEffectivePixelRatio(baseScale: number, zoom: number): number {
  const ratio = baseScale * Math.pow(2, TEXTURE_REFERENCE_ZOOM - zoom)
  return Math.min(Math.max(ratio, 0.1), 40)
}

// Procedural window-grid placeholder — used when building-texture.png is not found.
function generateWindowTexture(): ImageData {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#6b7280'
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#4b5563'
  for (let row = 0; row <= 4; row++) ctx.fillRect(0, row * 32, size, 2)

  const cols = 3, rows = 4
  const cellW = size / cols, cellH = size / rows
  const padX = 6, padY = 5

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW + padX, y = row * cellH + padY
      const w = cellW - padX * 2, h = cellH - padY * 2
      ctx.fillStyle = '#374151'
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
      ctx.fillStyle = '#7dd3fc'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.38)'
      ctx.fillRect(x + 1, y + 1, w * 0.42, h * 0.35)
    }
  }

  return ctx.getImageData(0, 0, size, size)
}

function loadMapImage(map: MapboxMap, url: string): Promise<HTMLImageElement | ImageBitmap> {
  return new Promise((resolve, reject) => {
    map.loadImage(url, (error, image) => {
      if (error || !image) reject(error ?? new Error('Image not found'))
      else resolve(image as HTMLImageElement)
    })
  })
}

// Loads (or re-loads) the texture with the given pixelRatio.
// IMPORTANT: the new image is fetched BEFORE removing the old registration so that
// fill-extrusion-pattern never references a missing image during the async gap.
// Always resolves — never throws.
async function ensureBuildingTexture(map: MapboxMap, pixelRatio = 2.5): Promise<'file' | 'placeholder'> {
  try {
    const img = await loadMapImage(map, TEXTURE_FILE_PATH)
    // Atomically swap: old image stays registered until the new one is ready
    if (map.hasImage(TEXTURE_IMAGE_NAME)) map.removeImage(TEXTURE_IMAGE_NAME)
    map.addImage(TEXTURE_IMAGE_NAME, img, { pixelRatio })
    return 'file'
  } catch {
    // generateWindowTexture is synchronous — safe to swap immediately
    if (map.hasImage(TEXTURE_IMAGE_NAME)) map.removeImage(TEXTURE_IMAGE_NAME)
    map.addImage(TEXTURE_IMAGE_NAME, generateWindowTexture(), { pixelRatio })
    return 'placeholder'
  }
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-brand-500' : 'bg-gray-300'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

export default function MapSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-collapse when user clicks outside the panel container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  const [selectedStyleId, setSelectedStyleId] = useState('strmap')
  const [lighting, setLighting] = useState('day')
  const [theme, setTheme] = useState('default')
  const [showLabels, setShowLabels] = useState(true)
  const [facades, setFacades] = useState(false)

  // Building layer
  const [buildingColorId, setBuildingColorId] = useState('default')
  const [buildingOpacity, setBuildingOpacity] = useState(0.75)
  const [ambientOcclusion, setAmbientOcclusion] = useState(false)
  const [aoIntensity, setAoIntensity] = useState(0.3)
  const [verticalGradient, setVerticalGradient] = useState(true)
  const [showBuildings, setShowBuildings] = useState(true)

  // Wall texture — pixelRatio is zoom-adjusted to keep tile size world-invariant
  const [buildingTexture, setBuildingTexture] = useState(false)
  const [textureStatus, setTextureStatus] = useState<'none' | 'loading' | 'file' | 'placeholder'>('none')
  const [textureScale, setTextureScale] = useState(2.5)
  const [mapZoom, setMapZoom] = useState(TEXTURE_REFERENCE_ZOOM)

  // Both the built-in Standard style and the custom strmap style (which is
  // Standard-based) use setConfigProperty for lighting, theme, labels, and facades.
  const isStandardStyle = selectedStyleId === 'standard' || selectedStyleId === 'strmap'
  // Track whether the user has explicitly changed a Standard config value this
  // session. We skip the bulk push on initial load so Studio-configured defaults
  // are preserved, but apply immediately once the user touches any control.
  const userChangedStandardConfig = useRef(false)

  // Track map zoom so texture pixelRatio stays world-invariant
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const onZoomEnd = () => setMapZoom(map.getZoom())
    map.on('zoomend', onZoomEnd)
    return () => { map.off('zoomend', onZoomEnd) }
  }, [])

  // Re-register texture with zoom-adjusted pixelRatio whenever zoom changes
  useEffect(() => {
    if (!buildingTexture || textureStatus === 'none' || textureStatus === 'loading') return
    const map = mapInstanceRef.current
    if (!map || !map.getLayer('3d-buildings')) return
    const ratio = getEffectivePixelRatio(textureScale, mapZoom)
    ensureBuildingTexture(map, ratio).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { map.setPaintProperty('3d-buildings', 'fill-extrusion-pattern' as any, null) } catch { /* no-op */ }
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { map.setPaintProperty('3d-buildings', 'fill-extrusion-pattern' as any, TEXTURE_IMAGE_NAME) } catch { /* no-op */ }
      })
    })
  }, [mapZoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Style change ────────────────────────────────────────────────────────────

  const handleStyleChange = (styleId: string) => {
    const map = mapInstanceRef.current
    if (!map) return
    const styleDef = MAP_STYLES.find(s => s.id === styleId)
    if (!styleDef) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    setSelectedStyleId(styleId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setStyle(styleDef.url as any)

    // Snapshot settings at call time to avoid stale closures inside style.load callback
    const color = BUILDING_COLORS.find(c => c.id === buildingColorId)?.color ?? '#dde4ec'
    const opacityVal = buildingOpacity
    const aoVal = ambientOcclusion ? aoIntensity : 0
    const gradVal = verticalGradient
    const showVal = showBuildings
    const textureVal = buildingTexture
    const scaleVal = textureScale
    const zoomVal = mapZoom

    map.once('style.load', () => {
      requestAnimationFrame(async () => {
        if (!map.getLayer('3d-buildings')) return
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.setPaintProperty('3d-buildings', 'fill-extrusion-color' as any, color)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity' as any, opacityVal)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.setPaintProperty('3d-buildings', 'fill-extrusion-vertical-gradient' as any, gradVal)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (aoVal > 0) map.setPaintProperty('3d-buildings', 'fill-extrusion-ambient-occlusion-intensity' as any, aoVal)
          if (!showVal) map.setLayoutProperty('3d-buildings', 'visibility', 'none')

          if (textureVal) {
            const source = await ensureBuildingTexture(map, getEffectivePixelRatio(scaleVal, zoomVal))
            setTextureStatus(source)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.setPaintProperty('3d-buildings', 'fill-extrusion-pattern' as any, TEXTURE_IMAGE_NAME)
          }
        } catch (e) {
          console.warn('Building layer reapply failed:', e)
        }
      })
    })
  }

  // ─── Standard style config ───────────────────────────────────────────────────

  const updateConfig = (key: string, value: unknown) => {
    const map = mapInstanceRef.current
    if (!map || !isStandardStyle) return
    try { map.setConfigProperty('basemap', key, value) }
    catch (e) { console.warn('Config property update failed:', e) }
  }

  useEffect(() => {
    // For the custom strmap style, skip pushing panel defaults on initial load so
    // Studio-configured values (lighting preset, theme, etc.) are preserved.
    // Once the user explicitly changes a control, userChangedStandardConfig is set
    // and subsequent effect runs apply normally.
    if (isStandardStyle && (selectedStyleId !== 'strmap' || userChangedStandardConfig.current)) {
      updateConfig('lightPreset', lighting)
      updateConfig('theme', theme)
      updateConfig('showPointOfInterestLabels', showLabels)
      updateConfig('showRoadLabels', showLabels)
      updateConfig('showTransitLabels', showLabels)
      updateConfig('showPlaceLabels', showLabels)
      updateConfig('show3dFacades', facades)
    }
  }, [selectedStyleId, lighting, theme, showLabels, facades])

  const handleLighting = (preset: string) => {
    userChangedStandardConfig.current = true
    setLighting(preset)
  }

  const handleTheme = (t: string) => {
    userChangedStandardConfig.current = true
    setTheme(t)
  }

  const handleShowLabels = () => {
    userChangedStandardConfig.current = true
    setShowLabels(v => !v)
  }

  const handleFacades = (enabled: boolean) => {
    userChangedStandardConfig.current = true
    setFacades(enabled)
    updateConfig('show3dFacades', enabled)
  }

  // ─── Building layer helpers ──────────────────────────────────────────────────

  const updateBuildingPaint = (property: string, value: unknown) => {
    const map = mapInstanceRef.current
    if (!map || !map.getLayer('3d-buildings')) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setPaintProperty('3d-buildings', property as any, value)
    } catch (e) { console.warn('Building paint update failed:', e) }
  }

  const handleBuildingColor = (colorId: string) => {
    setBuildingColorId(colorId)
    updateBuildingPaint('fill-extrusion-color', BUILDING_COLORS.find(c => c.id === colorId)?.color ?? '#dde4ec')
  }

  const handleBuildingOpacity = (opacity: number) => {
    setBuildingOpacity(opacity)
    updateBuildingPaint('fill-extrusion-opacity', opacity)
  }

  const handleAmbientOcclusion = (enabled: boolean) => {
    setAmbientOcclusion(enabled)
    updateBuildingPaint('fill-extrusion-ambient-occlusion-intensity', enabled ? aoIntensity : 0)
  }

  const handleAoIntensity = (intensity: number) => {
    setAoIntensity(intensity)
    if (ambientOcclusion) updateBuildingPaint('fill-extrusion-ambient-occlusion-intensity', intensity)
  }

  const handleVerticalGradient = (enabled: boolean) => {
    setVerticalGradient(enabled)
    updateBuildingPaint('fill-extrusion-vertical-gradient', enabled)
  }

  const handleShowBuildings = (show: boolean) => {
    setShowBuildings(show)
    const map = mapInstanceRef.current
    if (!map) return
    if (isStandardStyle) {
      userChangedStandardConfig.current = true
      updateConfig('show3dBuildings', show)
    } else if (map.getLayer('3d-buildings')) {
      try { map.setLayoutProperty('3d-buildings', 'visibility', show ? 'visible' : 'none') }
      catch (e) { console.warn('Building visibility update failed:', e) }
    }
  }

  // ─── Wall texture ────────────────────────────────────────────────────────────

  const handleBuildingTexture = (enabled: boolean) => {
    setBuildingTexture(enabled)
    const map = mapInstanceRef.current
    if (!map || !map.getLayer('3d-buildings')) return

    if (enabled) {
      setTextureStatus('loading')
      ensureBuildingTexture(map, getEffectivePixelRatio(textureScale, mapZoom))
        .then(source => {
          setTextureStatus(source)
          updateBuildingPaint('fill-extrusion-pattern', TEXTURE_IMAGE_NAME)
        })
        .catch(() => { setTextureStatus('none'); setBuildingTexture(false) })
    } else {
      updateBuildingPaint('fill-extrusion-pattern', null)
      setTextureStatus('none')
    }
  }

  const handleTextureScale = (scale: number) => {
    setTextureScale(scale)
    if (!buildingTexture) return
    const map = mapInstanceRef.current
    if (!map || !map.getLayer('3d-buildings')) return
    ensureBuildingTexture(map, getEffectivePixelRatio(scale, mapZoom)).then(source => {
      setTextureStatus(source)
      // Mapbox won't re-tile if the paint property value string is unchanged —
      // clear it first so the re-assignment forces a full retile.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { map.setPaintProperty('3d-buildings', 'fill-extrusion-pattern' as any, null) } catch { /* no-op */ }
      requestAnimationFrame(() => updateBuildingPaint('fill-extrusion-pattern', TEXTURE_IMAGE_NAME))
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="absolute bottom-6 left-6 z-20 flex flex-col items-start gap-2">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-md border border-white/40 rounded-xl shadow-lg hover:bg-white transition-all group"
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-600 group-hover:text-brand-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
              <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">Map Settings</span>
        </button>
      ) : (
        <div className="w-64 p-4 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header button inside container */}
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between w-full pb-3 mb-3 border-b border-gray-100 text-left group focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xs font-bold text-gray-800">Map Settings</span>
            </div>
            <div className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded">
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2.5}>
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          <div className="space-y-4">

            {/* Base Style */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-0.5">
                Base Style
              </label>
              <select
                value={selectedStyleId}
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              >
                {MAP_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Standard Style Options */}
            {isStandardStyle && (
              <div className="space-y-3 pt-3 border-t border-gray-100 animate-in fade-in duration-300">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-0.5">
                    Lighting
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LIGHTING_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handleLighting(p)}
                        className={`px-2 py-1.5 text-[10px] font-semibold rounded-md border transition-all capitalize ${lighting === p
                            ? 'bg-brand-50 border-brand-200 text-brand-700'
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-0.5">
                    Visual Theme
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => handleTheme(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-medium focus:outline-none transition-all"
                  >
                    {THEMES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-0.5">
                    Show Labels
                  </label>
                  <Toggle on={showLabels} onToggle={handleShowLabels} />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">3D Facades</span>
                      <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">Windows &amp; detail — Select regions supported</p>
                    </div>
                    <Toggle on={facades} onToggle={() => handleFacades(!facades)} />
                  </div>
                </div>
              </div>
            )}

            {/* Buildings */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-0.5">
                Buildings
              </label>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Show 3D Buildings</span>
                <Toggle on={showBuildings} onToggle={() => handleShowBuildings(!showBuildings)} />
              </div>

              {showBuildings && (
                <div className="space-y-3 animate-in fade-in duration-200">

                  {/* Color swatches */}
                  <div>
                    <span className="block text-[10px] text-gray-400 mb-1.5">Color Theme</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {BUILDING_COLORS.map((c) => (
                        <button
                          key={c.id}
                          title={c.name}
                          onClick={() => handleBuildingColor(c.id)}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${buildingColorId === c.id ? 'border-brand-500 scale-110 shadow-sm' : 'border-transparent hover:border-gray-300'
                            }`}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {BUILDING_COLORS.find(c => c.id === buildingColorId)?.name}
                    </span>
                  </div>

                  {/* Opacity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">Opacity</span>
                      <span className="text-[10px] font-medium text-gray-500">{Math.round(buildingOpacity * 100)}%</span>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.05} value={buildingOpacity}
                      onChange={(e) => handleBuildingOpacity(Number(e.target.value))}
                      className="w-full h-1 accent-brand-500" />
                  </div>

                  {/* Ambient occlusion */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Contact Shadow (AO)</span>
                      <Toggle on={ambientOcclusion} onToggle={() => handleAmbientOcclusion(!ambientOcclusion)} />
                    </div>
                    {ambientOcclusion && (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-400">Intensity</span>
                          <span className="text-[10px] font-medium text-gray-500">{Math.round(aoIntensity * 100)}%</span>
                        </div>
                        <input type="range" min={0.05} max={1} step={0.05} value={aoIntensity}
                          onChange={(e) => handleAoIntensity(Number(e.target.value))}
                          className="w-full h-1 accent-brand-500" />
                      </div>
                    )}
                  </div>

                  {/* Vertical gradient */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Vertical Shading</span>
                    <Toggle on={verticalGradient} onToggle={() => handleVerticalGradient(!verticalGradient)} />
                  </div>

                  {/* Wall Texture */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400">Wall Texture</span>
                        {buildingTexture && textureStatus !== 'none' && (
                          <p className={`text-[9px] mt-0.5 ${textureStatus === 'loading' ? 'text-gray-400' :
                              textureStatus === 'file' ? 'text-green-500' : 'text-amber-500'
                            }`}>
                            {textureStatus === 'loading' ? 'Loading…' :
                              textureStatus === 'file' ? 'Custom texture' : 'Placeholder'}
                          </p>
                        )}
                      </div>
                      <Toggle on={buildingTexture} onToggle={() => handleBuildingTexture(!buildingTexture)} />
                    </div>

                    {/* Advanced settings — visible once texture is loaded */}
                    {buildingTexture && (textureStatus === 'file' || textureStatus === 'placeholder') && (
                      <div className="space-y-2 pl-2 border-l-2 border-gray-100 animate-in fade-in duration-200">

                        {/* Pattern scale */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-gray-400">Pattern Scale</span>
                            <span className="text-[9px] font-medium text-gray-500">{textureScale.toFixed(1)}×</span>
                          </div>
                          <input type="range" min={0.5} max={5} step={0.25} value={textureScale}
                            onChange={(e) => handleTextureScale(Number(e.target.value))}
                            className="w-full h-1 accent-brand-500" />
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[8px] text-gray-300">Fewer repeats</span>
                            <span className="text-[8px] text-gray-300">More repeats</span>
                          </div>
                        </div>

                        {/* Placeholder hint */}
                        {textureStatus === 'placeholder' && (
                          <p className="text-[9px] text-gray-400 leading-tight bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                            Drop <span className="font-mono font-medium text-gray-500">building-texture.png</span> (128×128 px) into <span className="font-mono font-medium text-gray-500">/public</span> and re-toggle to apply it.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
