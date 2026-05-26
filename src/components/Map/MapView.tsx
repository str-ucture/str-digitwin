import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type * as GeoJSON from 'geojson'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  MAPBOX_TOKEN,
  GERMANY_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  DEFAULT_BEARING,
  MAP_STYLE,
  PROJECT_TYPE_COLORS,
  transformStyleFonts,
  transformRequestFonts,
} from '../../lib/mapbox'
import { mapInstanceRef } from '../../lib/mapContext'
import type { Project, ModelLayer } from '../../types/project'
import { useIsAdmin } from '../../lib/authContext'
import { useTranslation } from 'react-i18next'

mapboxgl.accessToken = MAPBOX_TOKEN

interface MapViewProps {
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (project: Project | null) => void
  flyKey: number
  activeLayerIndices: Record<string, number>
  hoveredProjectId?: string | null
  onHoverProject?: (projectId: string | null) => void
  // Material filter: layerId → 'all' | material name
  selectedMaterialByLayer?: Record<string, string>
  // Called once per layer when the GLB loads and material names are known
  onModelMaterials?: (layerId: string, materials: string[]) => void
}

// Handle for each Three.js model custom layer — used to clean up on re-sync
interface ModelLayerHandle {
  layerId: string
  dispose: () => void
  // null / 'all' → show everything; a material name → hide all other meshes
  setMaterialFilter: (matName: string | null) => void
}

interface CameraTelemetry {
  zoom: string
  pitch: string
  bearing: string
  lat: string
  lng: string
}

export default function MapView({
  projects,
  selectedProject,
  onSelectProject,
  flyKey,
  activeLayerIndices,
  hoveredProjectId,
  onHoverProject,
  selectedMaterialByLayer,
  onModelMaterials,
}: MapViewProps) {
  const isAdmin = useIsAdmin()
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [isAtDefaultView, setIsAtDefaultView] = useState(true)
  const [telemetry, setTelemetry] = useState<CameraTelemetry>({
    zoom: DEFAULT_ZOOM.toFixed(2),
    pitch: DEFAULT_PITCH.toFixed(1),
    bearing: DEFAULT_BEARING.toFixed(1),
    lat: '50.30868',
    lng: '10.69308',
  })
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const mapLoadedRef = useRef(false)
  const [mapLoadedState, setMapLoadedState] = useState(false)
  const projectsRef = useRef<Project[]>(projects)
  const selectedProjectRef = useRef<Project | null>(selectedProject)
  const activeLayerIndicesRef = useRef(activeLayerIndices)
  const hoveredProjectIdRef = useRef<string | null>(hoveredProjectId ?? null)
  const onHoverProjectRef = useRef(onHoverProject)
  const onModelMaterialsRef = useRef(onModelMaterials)
  // Replaces the old three separate model refs — each handle owns its Three.js teardown
  const modelHandlesRef = useRef<ModelLayerHandle[]>([])
  // Fingerprint of the last synced model configuration — prevents unnecessary teardown/reload
  const lastModelKeyRef = useRef<string | null>(null)

  useEffect(() => { projectsRef.current = projects }, [projects])
  useEffect(() => { selectedProjectRef.current = selectedProject }, [selectedProject])
  useEffect(() => { activeLayerIndicesRef.current = activeLayerIndices }, [activeLayerIndices])
  useEffect(() => { hoveredProjectIdRef.current = hoveredProjectId ?? null }, [hoveredProjectId])
  useEffect(() => { onHoverProjectRef.current = onHoverProject }, [onHoverProject])
  useEffect(() => { onModelMaterialsRef.current = onModelMaterials }, [onModelMaterials])

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: GERMANY_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      transformStyle: transformStyleFonts,
      transformRequest: transformRequestFonts,
    } as any)

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    map.on('move', () => {
      const z = map.getZoom()
      const c = map.getCenter()
      setTelemetry({
        zoom: z.toFixed(2),
        pitch: map.getPitch().toFixed(1),
        bearing: map.getBearing().toFixed(1),
        lat: c.lat.toFixed(5),
        lng: c.lng.toFixed(5),
      })
      setZoom(z)

      const latDiff = Math.abs(c.lat - GERMANY_CENTER[1])
      const lngDiff = Math.abs(c.lng - GERMANY_CENTER[0])
      const zoomDiff = Math.abs(z - DEFAULT_ZOOM)
      const pitchDiff = Math.abs(map.getPitch() - DEFAULT_PITCH)
      const bearingDiff = Math.abs(map.getBearing() - DEFAULT_BEARING)

      const isDefault = latDiff < 0.001 && lngDiff < 0.001 && zoomDiff < 0.01 && pitchDiff < 0.1 && bearingDiff < 0.1
      setIsAtDefaultView(isDefault)
    })

    function initMapLayers() {
      const map = mapRef.current
      if (!map) return

      // Standard-based styles (those with a `schema` field) manage 3D building
      // rendering internally. Adding a fill-extrusion layer here would render a
      // flat grey box over the Standard style's lighting and materials.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isStandardBased = !!(map.getStyle() as any)?.schema

      // 3D buildings layer (built-in Mapbox buildings).
      // Skipped for Standard-based styles and when the composite source is absent.
      if (!isStandardBased && map.getStyle().layers && map.getSource('composite') && !map.getLayer('3d-buildings')) {
        map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#dde4ec',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.75,
          },
        })
      }

      // Project polygons source
      if (!map.getSource('project-polygons')) {
        map.addSource('project-polygons', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
      }

      // Flat polygon fill
      if (!map.getLayer('project-polygon-fill')) {
        map.addLayer({
          id: 'project-polygon-fill',
          type: 'fill',
          source: 'project-polygons',
          filter: ['==', ['get', 'height'], 0],
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.2,
          },
        })
      }

      // Outline for all project footprints
      if (!map.getLayer('project-polygon-outline')) {
        map.addLayer({
          id: 'project-polygon-outline',
          type: 'line',
          source: 'project-polygons',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.8,
          },
        })
      }

      // 3D extrusion — non-selected
      if (!map.getLayer('project-building-extrusion')) {
        map.addLayer({
          id: 'project-building-extrusion',
          type: 'fill-extrusion',
          source: 'project-polygons',
          filter: ['>', ['get', 'height'], 0],
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.75,
          },
        })
      }

      // 3D extrusion — selected feature only
      if (!map.getLayer('project-building-extrusion-selected')) {
        map.addLayer({
          id: 'project-building-extrusion-selected',
          type: 'fill-extrusion',
          source: 'project-polygons',
          filter: ['==', ['get', 'id'], ''],
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.95,
          },
        })
      }

      updatePolygons(map, projectsRef.current, selectedProjectRef.current)
    }

    map.on('load', () => {
      mapLoadedRef.current = true
      setMapLoadedState(true)
      initMapLayers()
    })

    map.on('style.load', () => {
      initMapLayers()
      // Style changes clear all custom layers — re-sync models immediately using stable refs
      lastModelKeyRef.current = null
      syncModelLayers(map, projectsRef.current, modelHandlesRef, activeLayerIndicesRef.current, (lid, mats) => onModelMaterialsRef.current?.(lid, mats))
      lastModelKeyRef.current = modelConfigKey(projectsRef.current, activeLayerIndicesRef.current)
    })

    mapRef.current = map
    mapInstanceRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(mapContainerRef.current)

    return () => {
      observer.disconnect()
      // Dispose all Three.js resources before removing the map
      modelHandlesRef.current.forEach(h => h.dispose())
      modelHandlesRef.current = []
      lastModelKeyRef.current = null
      map.remove()
      mapRef.current = null
      mapInstanceRef.current = null
      mapLoadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset map view on pressing 'R' key when not typing in an input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if (e.key.toLowerCase() === 'r') {
        mapRef.current?.flyTo({
          center: GERMANY_CENTER,
          zoom: DEFAULT_ZOOM,
          pitch: DEFAULT_PITCH,
          bearing: DEFAULT_BEARING,
          duration: 1500,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fly to selected project whenever flyKey increments
  useEffect(() => {
    if (!selectedProject) return
    setTimeout(() => {
      if (mapRef.current && mapLoadedRef.current) flyToProject(mapRef.current, selectedProject)
    }, 0)
  }, [flyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hide markers when zoomed past level 18.25
  useEffect(() => {
    const hidden = zoom > 17.50
    markersRef.current.forEach((m) => {
      m.getElement().style.visibility = hidden ? 'hidden' : 'visible'
    })
  }, [zoom])

  // Sync markers when projects change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Sort projects by latitude descending so northernmost markers are created and appended
    // to the DOM first, placing them natively behind southernmost markers.
    const sortedProjects = [...projects].sort((a, b) => b.lat - a.lat)

    sortedProjects.forEach((project) => {
      const color = PROJECT_TYPE_COLORS[project.type]

      // el: outer wrapper — anchor='bottom' so the tip sits exactly on the coordinate
      const el = document.createElement('div')
      el.setAttribute('data-project-id', project.id)
      el.setAttribute('data-lat', String(project.lat))
      const baseZIndex = Math.round((90 - project.lat) * 10000)
      const isSelected = selectedProjectRef.current?.id === project.id
      const isHovered = hoveredProjectIdRef.current === project.id
      const active = isSelected || isHovered
      const currentZoom = map.getZoom()
      const isHidden = currentZoom > 17.50
      el.style.cssText = `cursor: pointer; width: 48px; display: flex; flex-direction: column; align-items: center; z-index: ${active ? baseZIndex + 1000000 : baseZIndex}; visibility: ${isHidden ? 'hidden' : 'visible'};`

      // pin: the transformable unit (circle + tip) — el.firstElementChild
      const pin = document.createElement('div')
      pin.style.cssText = 'display: flex; flex-direction: column; align-items: center; transition: transform 0.15s ease; transform-origin: bottom center;'

      // circle: image badge — pin.firstElementChild (gets box-shadow updates)
      const circle = document.createElement('div')
      circle.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 3px solid ${color};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        overflow: hidden;
        background: white;
        flex-shrink: 0;
      `

      // tip: downward triangle — pin.lastElementChild
      const tip = document.createElement('div')
      tip.style.cssText = `
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 10px solid ${color};
        margin-top: -1px;
      `

      const img = document.createElement('img')
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;'
      img.draggable = false

      // Fallback chain: project thumbnail → default PNG → small colored circle + tip
      let triedDefault = false
      const applyPinFallback = () => {
        img.remove()
        circle.style.cssText = `
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          flex-shrink: 0;
        `
        tip.style.borderLeft = '5px solid transparent'
        tip.style.borderRight = '5px solid transparent'
        tip.style.borderTop = `8px solid ${color}`
        el.style.width = '22px'
      }

      img.onerror = () => {
        if (!triedDefault) {
          triedDefault = true
          img.src = `${import.meta.env.BASE_URL}project-thumblain.png`
        } else {
          applyPinFallback()
        }
      }

      img.src = project.thumbnail_url ?? `${import.meta.env.BASE_URL}project-thumblain.png`
      if (!project.thumbnail_url) triedDefault = true

      circle.appendChild(img)
      pin.appendChild(circle)
      pin.appendChild(tip)
      el.appendChild(pin)

      el.addEventListener('mouseenter', () => {
        pin.style.transform = 'scale(1.15)'
        circle.style.boxShadow = `0 0 0 3px ${color}, 0 4px 14px rgba(0,0,0,0.35)`
        el.style.zIndex = String(baseZIndex + 1000000)
        onHoverProjectRef.current?.(project.id)
      })
      el.addEventListener('mouseleave', () => {
        const isSelected = selectedProjectRef.current?.id === project.id
        const isHovered = hoveredProjectIdRef.current === project.id
        const active = isSelected || isHovered
        pin.style.transform = active ? 'scale(1.15)' : 'scale(1)'
        circle.style.boxShadow = active
          ? `0 0 0 4px ${color}, 0 4px 14px rgba(0,0,0,0.25)`
          : '0 2px 8px rgba(0,0,0,0.3)'
        el.style.zIndex = String(active ? baseZIndex + 1000000 : baseZIndex)
        onHoverProjectRef.current?.(null)
      })
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectProject(project)
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([project.lng, project.lat])
        .addTo(map)

      markersRef.current.push(marker)
    })

    updatePolygons(map, projects, null)
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync Three.js model layers only when model configuration actually changes.
  // Guards against spurious rebuilds caused by new object references on every HomePage render
  // (e.g. hover events, camera view switches) which would tear down and re-fetch the GLB.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedState) return
    const key = modelConfigKey(projects, activeLayerIndices)
    if (key === lastModelKeyRef.current) return
    lastModelKeyRef.current = key
    syncModelLayers(map, projects, modelHandlesRef, activeLayerIndices, (lid, mats) => onModelMaterialsRef.current?.(lid, mats))
  }, [projects, activeLayerIndices, mapLoadedState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply material visibility filter to handles whenever the selection changes.
  // Also re-applies after layer rebuilds (activeLayerIndices change) because
  // syncModelLayers creates fresh handles that start with all meshes visible.
  useEffect(() => {
    modelHandlesRef.current.forEach(h => {
      const mat = selectedMaterialByLayer?.[h.layerId] ?? null
      h.setMaterialFilter(mat === 'all' ? null : mat)
    })
  }, [selectedMaterialByLayer, activeLayerIndices, mapLoadedState])

  // Highlight / fly to selected project or hovered project
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => {
      const el = marker.getElement()
      const pin = el.firstElementChild as HTMLElement
      const circle = pin?.firstElementChild as HTMLElement
      const id = el.getAttribute('data-project-id')
      const isSelected = selectedProject?.id === id
      const isHovered = hoveredProjectId === id
      const active = isSelected || isHovered
      pin.style.transform = active ? 'scale(1.15)' : 'scale(1)'
      circle.style.boxShadow = active
        ? `0 0 0 4px ${circle.style.borderColor}, 0 4px 14px rgba(0,0,0,0.25)`
        : '0 2px 8px rgba(0,0,0,0.3)'

      const latStr = el.getAttribute('data-lat')
      const lat = latStr ? parseFloat(latStr) : 0
      const baseZIndex = Math.round((90 - lat) * 10000)
      el.style.zIndex = String(active ? baseZIndex + 1000000 : baseZIndex)

      const currentZoom = map.getZoom()
      el.style.visibility = currentZoom > 17.50 ? 'hidden' : 'visible'
    })

    if (map.getLayer('3d-buildings')) {
      const hiddenIds = selectedProject?.hidden_building_ids ?? []
      if (hiddenIds.length > 0) {
        const numIds = hiddenIds.map(id => Number(id)).filter(n => !isNaN(n))
        map.setFilter('3d-buildings', [
          'all',
          ['==', 'extrude', 'true'],
          ['!in', '$id', ...hiddenIds, ...numIds]
        ])
      } else {
        map.setFilter('3d-buildings', ['==', 'extrude', 'true'])
      }
    }

    if (!selectedProject) {
      updatePolygons(map, projects, null)
      return
    }

    updatePolygons(map, projects, selectedProject)
  }, [selectedProject, hoveredProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResetView() {
    mapRef.current?.flyTo({
      center: GERMANY_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 1500,
    })
  }

  return (
    <div className="w-full h-full relative z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Reset view overlay button on top-right of the map, to the left of standard controls */}
      <div className="absolute top-2.5 right-[47px] z-10">
        <div className="bg-white rounded-md shadow-xs border border-gray-200/80 hover:bg-gray-50 transition-colors">
          <button
            onClick={handleResetView}
            className={`w-[29px] h-[29px] flex items-center justify-center transition-colors cursor-pointer ${
              isAtDefaultView ? 'text-gray-600 hover:text-brand-600' : 'text-brand-600 hover:text-brand-700'
            }`}
            title={t('map.resetView', 'Reset map view')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Camera telemetry HUD — rendered as a React overlay to guarantee z-index above all map controls and markers */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '10px',
          zIndex: 2000000,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          fontSize: '10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 600,
          lineHeight: 1.6,
          color: '#374151',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
          whiteSpace: 'pre',
        }}
      >
        {`z: ${telemetry.zoom}   p: ${telemetry.pitch}°  b: ${telemetry.bearing}°`}{'\n'}{`${telemetry.lat}, ${telemetry.lng}`}
      </div>
    </div>
  )
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

interface BuildingData {
  geometry: { type: 'Polygon'; coordinates: unknown[] }
  height: number
  base: number
  featureColor: string | null
}

function flyToProject(map: mapboxgl.Map, project: Project) {
  if (project.default_camera) {
    const cam = project.default_camera
    map.flyTo({
      center: cam.center,
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
      duration: 1400,
      essential: true,
    })
    return
  }

  const allParts = extractAllBuildingData(project.polygon)
  const allCoords = allParts.flatMap((d) => d.geometry.coordinates[0] as [number, number][])
  if (allCoords.length) {
    const bounds = allCoords.reduce(
      (b, pt) => b.extend(pt),
      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]),
    )
    map.fitBounds(bounds, { padding: 80, pitch: 60, duration: 1400, maxZoom: 18 })
  } else {
    map.flyTo({ center: [project.lng, project.lat], zoom: 16, pitch: 60, duration: 1400 })
  }
}

function propsToBuilding(
  geo: { type: 'Polygon'; coordinates: unknown[] },
  p: Record<string, unknown>,
): BuildingData {
  return {
    geometry: geo,
    height: Number(p.height ?? p.height_m ?? 0),
    base: Number(p.min_height ?? p.min_height_m ?? p.base ?? 0),
    featureColor: typeof p.color === 'string' ? p.color : null,
  }
}

function extractAllBuildingData(polygon: Project['polygon']): BuildingData[] {
  if (!polygon) return []
  if (polygon.type === 'Polygon') {
    return [{ geometry: polygon, height: 0, base: 0, featureColor: null }]
  }
  if (polygon.type === 'Feature') {
    const geo = polygon.geometry
    if (geo?.type !== 'Polygon') return []
    return [propsToBuilding(geo, polygon.properties ?? {})]
  }
  if (polygon.type === 'FeatureCollection') {
    return polygon.features.flatMap((f) => {
      if (f.geometry?.type !== 'Polygon') return []
      return [propsToBuilding(f.geometry, f.properties ?? {})]
    })
  }
  return []
}

function updatePolygons(
  map: mapboxgl.Map,
  projects: Project[],
  selected: Project | null,
) {
  if (!map.getSource('project-polygons')) return

  const features = projects.flatMap((p) => {
    const projectColor = PROJECT_TYPE_COLORS[p.type]
    return extractAllBuildingData(p.polygon).flatMap((data) => {
      if (!data.geometry?.coordinates?.[0]) return []
      return [{
        type: 'Feature' as const,
        geometry: data.geometry as GeoJSON.Polygon,
        properties: {
          id: p.id,
          color: data.featureColor ?? projectColor,
          selected: selected?.id === p.id,
          height: data.height,
          base: data.base,
        },
      }]
    })
  })

    ; (map.getSource('project-polygons') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    })

  const selectedHas3D = selected
    ? extractAllBuildingData(selected.polygon).some((d) => d.height > 0)
    : false

  if (selected?.polygon && !selectedHas3D) {
    map.setPaintProperty('project-polygon-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'id'], selected.id],
      0.4,
      0.15,
    ])
  } else {
    map.setPaintProperty('project-polygon-fill', 'fill-opacity', 0.15)
  }

  if (selected?.polygon && selectedHas3D) {
    map.setFilter('project-building-extrusion', [
      'all', ['>', ['get', 'height'], 0], ['!=', ['get', 'id'], selected.id],
    ])
    map.setFilter('project-building-extrusion-selected', [
      'all', ['>', ['get', 'height'], 0], ['==', ['get', 'id'], selected.id],
    ])
  } else {
    map.setFilter('project-building-extrusion', ['>', ['get', 'height'], 0])
    map.setFilter('project-building-extrusion-selected', ['==', ['get', 'id'], ''])
  }
}

// ─── Three.js model layer ────────────────────────────────────────────────────

/**
 * Creates a Mapbox custom layer (renderingMode '3d') backed by a Three.js
 * scene + GLTFLoader. This works with any Mapbox style and handles any valid
 * GLB/glTF file, bypassing Mapbox's proprietary addModel() API which only
 * works with the Standard style and has its own format restrictions.
 */
function addModelAsCustomLayer(
  map: mapboxgl.Map,
  layerId: string,
  layer: ModelLayer,
  onMaterials: (layerId: string, materials: string[]) => void,
): ModelLayerHandle {
  let threeCamera: THREE.Camera | null = null
  let threeScene: THREE.Scene | null = null
  let threeRenderer: THREE.WebGLRenderer | null = null
  let disposed = false
  // Guard: skip the resetState()+render() pipeline until the GLB mesh is in the
  // scene. Without this, every Mapbox frame pays the full GL state-sync cost
  // even while the model is still downloading.
  let modelLoaded = false

  // Per-material mesh map — built once on load for O(1) visibility toggling.
  // Key: material name string (matching ModelViewer's matName convention).
  const meshByMaterial = new Map<string, THREE.Mesh[]>()
  // Filter set before the GLB finished loading — applied on load.
  let pendingFilter: string | null = null
  // True once materials have been cloned for this layer — cloning is deferred
  // until the first filter activation so normal (unfiltered) rendering keeps
  // the shared material references and full draw-call batching.
  let materialsOwned = false

  const userScale = layer.scale ?? 1
  const userRotation = layer.rotation ?? [0, 0, 0]

  // Pre-compute anchor in Mercator space — these never change for this layer
  const mc = mapboxgl.MercatorCoordinate.fromLngLat(
    [layer.lng, layer.lat],
    layer.altitude ?? 0,
  )
  // meterInMercatorCoordinateUnits() converts user's meter-scale to Mercator units
  const metersPerUnit = mc.meterInMercatorCoordinateUnits()
  const modelScale = userScale * metersPerUnit

  // Convert user rotation degrees → radians once
  const rxRad = userRotation[0] * (Math.PI / 180)
  const ryRad = userRotation[1] * (Math.PI / 180)
  const rzRad = userRotation[2] * (Math.PI / 180)

  // Fully pre-compute the static model-to-Mercator matrix (T * S * R).
  // Translation, scale, and rotation are all layer-level constants — this matrix
  // never changes after setup, so render() only needs one multiply per frame.
  // X(π/2 + rxRad) converts glTF Y-up → Mapbox Z-up, then applies user tilt/yaw/roll.
  const _modelMatrix = new THREE.Matrix4()
    .makeTranslation(mc.x, mc.y, mc.z)
    .scale(new THREE.Vector3(modelScale, -modelScale, modelScale))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + rxRad))
    .multiply(new THREE.Matrix4().makeRotationY(ryRad))
    .multiply(new THREE.Matrix4().makeRotationZ(rzRad))

  const customLayer: mapboxgl.CustomLayerInterface = {
    id: layerId,
    type: 'custom',
    renderingMode: '3d',

    onAdd(m, gl) {
      if (disposed) return

      threeCamera = new THREE.Camera()
      threeScene = new THREE.Scene()

      // Match lighting from the ModelViewer preview so models look consistent
      threeScene.add(new THREE.AmbientLight(0xffffff, 1.0))
      const dir = new THREE.DirectionalLight(0xffffff, 1.5)
      dir.position.set(10, 10, 5).normalize()
      threeScene.add(dir)
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.4)
      dir2.position.set(-5, -5, -5).normalize()
      threeScene.add(dir2)

      const loader = new GLTFLoader()
      loader.load(
        layer.model_url,
        gltf => {
          if (disposed || !threeScene) return

          // Clone the GLTF scene so this layer owns the scene graph nodes.
          // Without cloning, a style reload (syncModelLayers) that runs while a
          // prior layer is still loading can double-add or dispose the same
          // shared Object3D, because a node can only have one parent in Three.js.
          // clone(true) creates new Mesh/Object3D instances (new UUIDs) while
          // sharing geometry and material references — no extra GPU uploads and
          // no broken draw-call batching from duplicate material instances.
          const cloned = gltf.scene.clone(true)
          threeScene.add(cloned)

          // Build per-material mesh map for O(1) visibility toggling.
          // Uses the same matName convention as ModelViewer (joined names for multi-mat meshes).
          cloned.traverse(node => {
            if (!(node instanceof THREE.Mesh)) return
            const mats = Array.isArray(node.material) ? node.material : [node.material]
            const matName = mats
              .map(mat => (mat as THREE.MeshStandardMaterial).name || '(unnamed)')
              .join(', ')
            if (!meshByMaterial.has(matName)) meshByMaterial.set(matName, [])
            meshByMaterial.get(matName)!.push(node)
          })

          // Notify parent of available material names
          onMaterials(layerId, [...meshByMaterial.keys()])

          // Apply any filter that was set before the GLB finished loading
          if (pendingFilter) setMaterialFilter(pendingFilter)

          modelLoaded = true
          // Trigger one repaint so the model appears immediately after loading
          m.triggerRepaint()
          // Dispatch event so HomePage knows this specific model is visually ready
          window.dispatchEvent(new CustomEvent('map-model-loaded', { detail: { layerId } }))
        },
        undefined,
        err => console.warn(`[MapView] GLB load failed for layer "${layerId}":`, err),
      )

      // Share the map's WebGL context — Three.js must NOT clear the framebuffer
      threeRenderer = new THREE.WebGLRenderer({
        canvas: m.getCanvas(),
        context: gl as unknown as WebGL2RenderingContext,
        antialias: true,
      })
      threeRenderer.autoClear = false
    },

    render(gl, matrix) {
      // Skip entirely until the GLB is loaded — avoids paying resetState() cost
      // on every Mapbox frame while the model is still downloading or absent.
      if (!threeCamera || !threeScene || !threeRenderer || disposed || !modelLoaded) return

      const rawGl = gl as WebGL2RenderingContext
      const fbW = rawGl.drawingBufferWidth
      const fbH = rawGl.drawingBufferHeight
      // Guard: skip render if the framebuffer has no size yet (e.g. during
      // style transitions or initial layout before canvas is sized).
      if (!fbW || !fbH) return

      // _modelMatrix is the fully pre-computed static model-to-Mercator transform
      // (T * S * R, computed once at layer setup — never changes per frame).
      // Only the camera matrix changes on each orbit/zoom, so render() is a
      // single multiply with no heap allocation.
      threeCamera.projectionMatrix
        .fromArray(matrix)
        .multiply(_modelMatrix)

      // ── Shared-context GL state handshake ─────────────────────────────────
      //
      // Mapbox GL v3 uses custom framebuffers (MSAA resolve) and integer vertex
      // attributes (vertexAttribIPointer). Three.js's resetState() unbinds both.
      // To prevent mutual contamination we bracket our render with explicit saves
      // and restores:
      //
      //  BEFORE:
      //   1. Save Mapbox's framebuffer — resetState() calls bindFramebuffer(null).
      //   2. Unbind Mapbox's VAO — if left bound, Three.js writes its float
      //      attribute pointers into Mapbox's VAO, corrupting Mapbox's state.
      //
      //  AFTER:
      //   3. Unbind Three.js's VAO — after render(), Three.js's VAO is still
      //      active. Mapbox's next draw may keep that VAO and fail because its
      //      integer-typed attributes don't match Three.js's float setup.
      //   4. Restore Mapbox's framebuffer so subsequent Mapbox layers render
      //      to the correct render target.
      const mapboxFB = rawGl.getParameter(rawGl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
      rawGl.bindVertexArray?.(null)                          // (1+2) clear Mapbox VAO

      threeRenderer.resetState()
      // resetState() → state.reset() calls gl.viewport(canvas.w, canvas.h)
      // directly, bypassing Three.js's state cache. Re-sync the viewport so
      // the renderer draws at the correct pixel dimensions.
      threeRenderer.setViewport(0, 0, fbW, fbH)
      threeRenderer.render(threeScene, threeCamera)

      rawGl.bindVertexArray?.(null)                          // (3) release Three.js VAO
      rawGl.bindFramebuffer(rawGl.FRAMEBUFFER, mapboxFB)    // (4) restore Mapbox FBO
      // Do NOT call triggerRepaint() here — that would cause an infinite
      // render loop. Mapbox already calls render() whenever the camera moves.
    },
  }

  try {
    map.addLayer(customLayer)
  } catch (e) {
    console.warn(`[MapView] addLayer failed for "${layerId}":`, e)
  }

  type OwnedMaterial = THREE.Material & { _origTransparent?: boolean; _origOpacity?: number }

  // Clone every mesh's material so this layer owns them exclusively.
  // Called lazily on first filter activation — keeps shared material refs
  // (and their draw-call batching benefits) during normal unfiltered rendering.
  function ensureMaterialOwnership() {
    if (materialsOwned) return
    for (const meshes of meshByMaterial.values()) {
      for (const mesh of meshes) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => {
            const c = (m as THREE.Material).clone() as OwnedMaterial
            c._origTransparent = (m as OwnedMaterial).transparent
            c._origOpacity = (m as THREE.MeshStandardMaterial).opacity ?? 1.0
            return c
          })
        } else if (mesh.material) {
          const c = (mesh.material as THREE.Material).clone() as OwnedMaterial
          c._origTransparent = (mesh.material as OwnedMaterial).transparent
          c._origOpacity = (mesh.material as THREE.MeshStandardMaterial).opacity ?? 1.0
          mesh.material = c
        }
      }
    }
    materialsOwned = true
  }

  function setMaterialFilter(matName: string | null) {
    pendingFilter = matName
    if (meshByMaterial.size === 0) return  // will re-apply once the GLB loads

    if (matName) {
      // Lazy material clone — only paid once, on first filter activation
      ensureMaterialOwnership()
      for (const [name, meshes] of meshByMaterial) {
        const selected = name === matName
        meshes.forEach(mesh => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(m => {
            const mat = m as OwnedMaterial
            if (selected) {
              mat.transparent = mat._origTransparent ?? false
              mat.opacity = mat._origOpacity ?? 1.0
              mat.depthWrite = true
            } else {
              mat.transparent = true
              mat.opacity = 0.08
              mat.depthWrite = false
            }
            mat.needsUpdate = true
          })
        })
      }
    } else if (materialsOwned) {
      // Restore all materials to their original transparency state
      for (const meshes of meshByMaterial.values()) {
        meshes.forEach(mesh => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(m => {
            const mat = m as OwnedMaterial
            mat.transparent = mat._origTransparent ?? false
            mat.opacity = mat._origOpacity ?? 1.0
            mat.depthWrite = true
            mat.needsUpdate = true
          })
        })
      }
    }

    if (modelLoaded) map.triggerRepaint()
  }

  function dispose() {
    disposed = true
    modelLoaded = false
    try {
      threeScene?.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => (m as THREE.Material).dispose())
      })
      threeScene?.clear()
      threeRenderer?.dispose()
    } catch {
      // no-op during teardown — map may already be removed
    }
    threeCamera = null
    threeScene = null
    threeRenderer = null
  }

  return { layerId, dispose, setMaterialFilter }
}

/**
 * Produces a stable string fingerprint of the active model layer configuration
 * for each project. Used to skip `syncModelLayers` when nothing model-related
 * has actually changed (e.g. only camera view, hover state, or other UI state).
 */
function modelConfigKey(
  projects: Project[],
  activeLayerIndices: Record<string, number>,
): string {
  const configs = projects.flatMap(p => {
    const geojsonCount = p.geojson_layers?.length ?? 0
    const activeIdx = activeLayerIndices[p.id] ?? 0
    if (activeIdx < geojsonCount) return []
    const modelIdx = activeIdx - geojsonCount
    const layer = p.model_layers?.[modelIdx]
    if (!layer?.model_url) return []
    return [{ id: p.id, url: layer.model_url, lng: layer.lng, lat: layer.lat, alt: layer.altitude, scale: layer.scale, rot: layer.rotation, coordRef: layer.coord_ref }]
  })
  return JSON.stringify(configs)
}

/**
 * Removes all existing Three.js model custom layers and recreates them from
 * the current project list. Called whenever `projects` or active layers change.
 */
function syncModelLayers(
  map: mapboxgl.Map,
  projects: Project[],
  handlesRef: React.MutableRefObject<ModelLayerHandle[]>,
  activeLayerIndices: Record<string, number>,
  onMaterials: (layerId: string, materials: string[]) => void,
) {
  // Tear down previous layers and Three.js resources
  handlesRef.current.forEach(h => {
    try { if (map.getLayer(h.layerId)) map.removeLayer(h.layerId) } catch { /* no-op */ }
    h.dispose()
  })
  handlesRef.current = []

  // Rebuild from current project data
  projects.forEach(p => {
    const activeIdx = activeLayerIndices[p.id] ?? 0
    const geojsonCount = p.geojson_layers?.length ?? 0

    // Only render a model if the active index points to the model layers section
    if (activeIdx >= geojsonCount) {
      const modelIdx = activeIdx - geojsonCount
      const layer = p.model_layers?.[modelIdx]

      if (layer?.model_url) {
        let finalLng = layer.lng
        let finalLat = layer.lat
        if (layer.coord_ref && layer.coord_ref.mode !== 'none') {
          const refLng = layer.coord_ref.mode === 'project' ? p.lng : (layer.coord_ref.custom_lng ?? p.lng)
          const refLat = layer.coord_ref.mode === 'project' ? p.lat : (layer.coord_ref.custom_lat ?? p.lat)
          if (layer.coord_ref.unit === 'meters') {
            const cosLat = Math.cos((refLat * Math.PI) / 180)
            finalLng = refLng + layer.lng / (111320 * cosLat)
            finalLat = refLat + layer.lat / 110540
          } else {
            finalLng = refLng + layer.lng
            finalLat = refLat + layer.lat
          }
        }

        const layerId = `three-model-${p.id}-${modelIdx}`
        const handle = addModelAsCustomLayer(map, layerId, { ...layer, lng: finalLng, lat: finalLat }, onMaterials)
        handlesRef.current.push(handle)
      }
    }
  })
}
