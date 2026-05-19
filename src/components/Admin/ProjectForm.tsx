import { useState, useCallback, useRef, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import type { Project, ProjectType, ProjectStatus, ProjectGeoJSON, GeoJSONLayer, LayerCamera, ModelLayer, CoordRef, ScrapedProjectData, ScrapeStage, ScrapeProjectResponse } from '../../types/project'
import type { ProjectDraft } from '../../hooks/useAdminProjects'
import { SingleImageUploader, MultiImageUploader } from './ImageUploader'
import TagInput from './TagInput'
import { mapInstanceRef } from '../../lib/mapContext'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  project: Project | null
  onSave: (draft: ProjectDraft, id?: string) => Promise<void>
  onClose: () => void
}

type Tab = 'basic' | 'location' | 'details' | 'media' | 'geojson' | 'models'

type CoordRefEntry = {
  mode: 'none' | 'project' | 'custom'
  unit: 'meters' | 'degrees'
  custom_lng: string
  custom_lat: string
}

const defaultCoordRef = (): CoordRefEntry => ({ mode: 'none', unit: 'meters', custom_lng: '', custom_lat: '' })

type LayerEntry = { name: string; json: string; camera: LayerCamera | null; coord_ref: CoordRefEntry; visible: boolean }

type ModelLayerEntry = {
  name: string
  model_url: string
  format: 'glb' | 'gltf'
  lng: string
  lat: string
  altitude: string
  scale: string
  rotation_x: string
  rotation_y: string
  rotation_z: string
  camera: LayerCamera | null
  visible: boolean
  coord_ref: CoordRefEntry
}

type FormData = {
  name_en: string
  name_de: string
  description_en: string
  description_de: string
  type: ProjectType
  status: ProjectStatus
  client: string
  address: string
  city: string
  lat: string
  lng: string
  completion_date: string
  area_sqm: string
  thumbnail_url: string | null
  image_urls: string[]
  tags: string[]
  featured: boolean
  visible: boolean
  source_url: string
  geojson_layers: LayerEntry[]
  model_layers: ModelLayerEntry[]
}

function emptyForm(): FormData {
  return {
    name_en: '',
    name_de: '',
    description_en: '',
    description_de: '',
    type: 'architecture',
    status: 'completed',
    client: '',
    address: '',
    city: 'Berlin',
    lat: '',
    lng: '',
    completion_date: '',
    area_sqm: '',
    thumbnail_url: null,
    image_urls: [],
    tags: [],
    featured: false,
    visible: true,
    source_url: '',
    geojson_layers: [{ name: '1', json: '', camera: null, coord_ref: defaultCoordRef(), visible: true }],
    model_layers: [],
  }
}

function projectToForm(p: Project): FormData {
  let geojson_layers: LayerEntry[]
  if (p.geojson_layers && p.geojson_layers.length > 0) {
    geojson_layers = p.geojson_layers.map(l => ({
      name: l.name,
      json: JSON.stringify(l.data, null, 2),
      camera: l.camera ?? null,
      coord_ref: l.coord_ref
        ? {
            mode: l.coord_ref.mode,
            unit: l.coord_ref.unit ?? 'meters',
            custom_lng: l.coord_ref.custom_lng != null ? String(l.coord_ref.custom_lng) : '',
            custom_lat: l.coord_ref.custom_lat != null ? String(l.coord_ref.custom_lat) : '',
          }
        : defaultCoordRef(),
      visible: l.visible ?? true,
    }))
  } else if (p.polygon) {
    geojson_layers = [{ name: '1', json: JSON.stringify(p.polygon, null, 2), camera: null, coord_ref: defaultCoordRef(), visible: true }]
  } else {
    geojson_layers = [{ name: '1', json: '', camera: null, coord_ref: defaultCoordRef(), visible: true }]
  }

  return {
    name_en: p.name_en,
    name_de: p.name_de,
    description_en: p.description_en ?? '',
    description_de: p.description_de ?? '',
    type: p.type,
    status: p.status,
    client: p.client ?? '',
    address: p.address ?? '',
    city: p.city,
    lat: String(p.lat),
    lng: String(p.lng),
    completion_date: p.completion_date ?? '',
    area_sqm: p.area_sqm != null ? String(p.area_sqm) : '',
    thumbnail_url: p.thumbnail_url,
    image_urls: p.image_urls ?? [],
    tags: p.tags ?? [],
    featured: p.featured,
    visible: p.visible ?? true,
    source_url: p.source_url ?? '',
    geojson_layers,
    model_layers: (p.model_layers ?? []).map(l => ({
      name: l.name,
      model_url: l.model_url,
      format: l.format,
      lng: String(l.lng),
      lat: String(l.lat),
      altitude: String(l.altitude ?? 0),
      scale: String(l.scale ?? 1),
      rotation_x: String(l.rotation?.[0] ?? 0),
      rotation_y: String(l.rotation?.[1] ?? 0),
      rotation_z: String(l.rotation?.[2] ?? 0),
      camera: l.camera ?? null,
      coord_ref: l.coord_ref
        ? {
            mode: l.coord_ref.mode,
            unit: l.coord_ref.unit ?? 'meters',
            custom_lng: l.coord_ref.custom_lng != null ? String(l.coord_ref.custom_lng) : '',
            custom_lat: l.coord_ref.custom_lat != null ? String(l.coord_ref.custom_lat) : '',
          }
        : defaultCoordRef(),
      visible: l.visible ?? true,
    })),
  }
}

function validateGeoJSON(raw: unknown): ProjectGeoJSON | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.type === 'Polygon') return raw as ProjectGeoJSON
  if (obj.type === 'Feature') {
    const geo = obj.geometry as Record<string, unknown> | undefined
    return geo?.type === 'Polygon' ? (raw as ProjectGeoJSON) : null
  }
  if (obj.type === 'FeatureCollection') {
    const features = obj.features as unknown[]
    const hasPolygon = Array.isArray(features) &&
      features.some(f => (f as Record<string, unknown>)?.geometry &&
        ((f as Record<string, unknown>).geometry as Record<string, unknown>)?.type === 'Polygon')
    return hasPolygon ? (raw as ProjectGeoJSON) : null
  }
  return null
}

function formToDraft(f: FormData): ProjectDraft {
  const validLayers: GeoJSONLayer[] = []
  for (const entry of f.geojson_layers) {
    if (entry.json.trim()) {
      try {
        const data = validateGeoJSON(JSON.parse(entry.json))
        if (data) {
          const cr = entry.coord_ref
          const coord_ref: CoordRef | undefined = cr.mode !== 'none'
            ? {
                mode: cr.mode,
                unit: cr.unit,
                ...(cr.mode === 'custom' ? {
                  custom_lng: parseFloat(cr.custom_lng) || 0,
                  custom_lat: parseFloat(cr.custom_lat) || 0,
                } : {}),
              }
            : undefined
          validLayers.push({
            name: entry.name.trim() || String(validLayers.length + 1),
            data,
            ...(entry.camera ? { camera: entry.camera } : {}),
            ...(coord_ref ? { coord_ref } : {}),
            visible: entry.visible,
          })
        }
      } catch { /* skip invalid */ }
    }
  }

  const polygon = validLayers.length > 0 ? validLayers[0].data : null

  const validModelLayers: ModelLayer[] = f.model_layers
    .filter(l => l.model_url)
    .map(l => {
      const cr = l.coord_ref
      const coord_ref: CoordRef | undefined = cr && cr.mode !== 'none'
        ? {
            mode: cr.mode,
            unit: cr.unit,
            ...(cr.mode === 'custom' ? {
              custom_lng: parseFloat(cr.custom_lng) || 0,
              custom_lat: parseFloat(cr.custom_lat) || 0,
            } : {}),
          }
        : undefined

      return {
        name: l.name.trim() || 'Model',
        model_url: l.model_url,
        format: l.format,
        lng: parseFloat(l.lng) || 0,
        lat: parseFloat(l.lat) || 0,
        altitude: parseFloat(l.altitude) || 0,
        scale: parseFloat(l.scale) || 1,
        rotation: [
          parseFloat(l.rotation_x) || 0,
          parseFloat(l.rotation_y) || 0,
          parseFloat(l.rotation_z) || 0,
        ] as [number, number, number],
        ...(l.camera ? { camera: l.camera } : {}),
        visible: l.visible,
        ...(coord_ref ? { coord_ref } : {}),
      }
    })

  return {
    name_en: f.name_en.trim(),
    name_de: f.name_de.trim(),
    description_en: f.description_en.trim() || null,
    description_de: f.description_de.trim() || null,
    type: f.type,
    status: f.status,
    client: f.client.trim() || null,
    address: f.address.trim() || null,
    city: f.city.trim() || 'Berlin',
    lat: parseFloat(f.lat),
    lng: parseFloat(f.lng),
    completion_date: f.completion_date || null,
    area_sqm: f.area_sqm ? parseFloat(f.area_sqm) : null,
    thumbnail_url: f.thumbnail_url,
    image_urls: f.image_urls.length > 0 ? f.image_urls : null,
    tags: f.tags.length > 0 ? f.tags : null,
    featured: f.featured,
    visible: f.visible,
    source_url: f.source_url || null,
    polygon,
    geojson_layers: validLayers.length > 0 ? validLayers : null,
    model_layers: validModelLayers.length > 0 ? validModelLayers : null,
  }
}

function inputCls(hasError = false) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
    hasError
      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
      : 'border-gray-300 focus:ring-2 focus:ring-brand-200 focus:border-brand-400'
  }`
}

function Field({ label, error, children, className = '' }: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const ACTIVE_SCRAPE_STAGES: ScrapeStage[] = ['fetching', 'analyzing', 'images', 'geocoding']

const STAGE_LABELS: Record<string, string> = {
  fetching: 'Fetching page…',
  analyzing: 'Analyzing with AI…',
  images: 'Processing images…',
  geocoding: 'Geocoding address…',
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'basic',
    label: 'Basic',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
  {
    id: 'location',
    label: 'Location',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    id: 'details',
    label: 'Details',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
  },
  {
    id: 'media',
    label: 'Media',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
  },
  {
    id: 'geojson',
    label: 'GeoJSON',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    id: 'models',
    label: '3D Models',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
]

export default function ProjectForm({ project, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormData>(project ? projectToForm(project) : emptyForm())
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [layerErrors, setLayerErrors] = useState<string[]>([])
  const [justCaptured, setJustCaptured] = useState<number | null>(null)
  const [copiedCamera, setCopiedCamera] = useState<LayerCamera | null>(null)
  const [modelUploading, setModelUploading] = useState<number | null>(null)
  const [modelUploadError, setModelUploadError] = useState<string | null>(null)
  const [justCapturedModel, setJustCapturedModel] = useState<number | null>(null)
  const [layerToDelete, setLayerToDelete] = useState<number | null>(null)
  const modelInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // URL scraping state
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeStage, setScrapeStage] = useState<ScrapeStage>('idle')
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [scrapeResult, setScrapeResult] = useState<ScrapedProjectData | null>(null)
  const [scrapePartial, setScrapePartial] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<keyof ScrapedProjectData>>(new Set())

  function confirmRemoveLayer() {
    if (layerToDelete !== null) {
      removeLayer(layerToDelete)
      setLayerToDelete(null)
    }
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!form.name_en.trim()) e.name_en = 'Required'
    if (!form.name_de.trim()) e.name_de = 'Required'
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (!form.lat || isNaN(lat) || lat < -90 || lat > 90) e.lat = 'Required — valid latitude (−90 to 90)'
    if (!form.lng || isNaN(lng) || lng < -180 || lng > 180) e.lng = 'Required — valid longitude (−180 to 180)'
    const lErrs = form.geojson_layers.map(entry => {
      if (!entry.json.trim()) return ''
      try {
        if (!validateGeoJSON(JSON.parse(entry.json)))
          return 'Must contain a GeoJSON Polygon (Polygon, Feature, or FeatureCollection)'
        return ''
      } catch { return 'Invalid JSON' }
    })
    setLayerErrors(lErrs)
    setErrors(e)
    // Navigate to the first tab with errors
    if (e.name_en || e.name_de) { setActiveTab('basic'); return false }
    if (e.lat || e.lng) { setActiveTab('location'); return false }
    if (lErrs.some(err => !!err)) { setActiveTab('geojson'); return false }
    return Object.keys(e).length === 0
  }

  async function handleScrape() {
    if (!scrapeUrl.trim()) return
    setScrapeStage('fetching')
    setScrapeError(null)
    setScrapeResult(null)
    setScrapePartial(false)
    try {
      const apiBase = (import.meta.env.VITE_LOCAL_API_URL as string | undefined) ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/scrape-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      })
      const data: ScrapeProjectResponse = await res.json()
      if (!data?.ok) throw new Error(data?.error ?? 'Unknown error')
      setScrapeResult(data.data ?? null)
      setScrapePartial(data.partial ?? false)
      setScrapeStage('done')
      if (data.data) {
        const nonNull = (Object.keys(data.data) as Array<keyof ScrapedProjectData>).filter(k => {
          const v = data.data![k]
          return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
        })
        setSelectedFields(new Set(nonNull))
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scraping failed — is the backend running? (npm run dev)')
      setScrapeStage('error')
    }
  }

  function applyScrapedData() {
    if (!scrapeResult) return
    setForm(f => {
      const patch: Partial<FormData> = {}
      if (selectedFields.has('name_en') && scrapeResult.name_en) patch.name_en = scrapeResult.name_en
      if (selectedFields.has('name_de') && scrapeResult.name_de) patch.name_de = scrapeResult.name_de
      if (selectedFields.has('description_en') && scrapeResult.description_en) patch.description_en = scrapeResult.description_en
      if (selectedFields.has('description_de') && scrapeResult.description_de) patch.description_de = scrapeResult.description_de
      if (selectedFields.has('type') && scrapeResult.type) patch.type = scrapeResult.type
      if (selectedFields.has('status') && scrapeResult.status) patch.status = scrapeResult.status
      if (selectedFields.has('client') && scrapeResult.client) patch.client = scrapeResult.client
      if (selectedFields.has('address') && scrapeResult.address) patch.address = scrapeResult.address
      if (selectedFields.has('city') && scrapeResult.city) patch.city = scrapeResult.city
      if (selectedFields.has('lat') && scrapeResult.lat !== null) patch.lat = String(scrapeResult.lat)
      if (selectedFields.has('lng') && scrapeResult.lng !== null) patch.lng = String(scrapeResult.lng)
      if (selectedFields.has('completion_date') && scrapeResult.completion_date) patch.completion_date = scrapeResult.completion_date
      if (selectedFields.has('area_sqm') && scrapeResult.area_sqm !== null) patch.area_sqm = String(scrapeResult.area_sqm)
      if (selectedFields.has('tags') && scrapeResult.tags.length > 0)
        patch.tags = [...new Set([...f.tags, ...scrapeResult.tags])]
      if (selectedFields.has('image_urls') && scrapeResult.image_urls.length > 0) {
        const [first, ...rest] = scrapeResult.image_urls
        if (!f.thumbnail_url) patch.thumbnail_url = first
        patch.image_urls = [...f.image_urls, ...(f.thumbnail_url ? scrapeResult.image_urls : rest)]
      }
      if (selectedFields.has('source_url') && scrapeResult.source_url) patch.source_url = scrapeResult.source_url
      return { ...f, ...patch }
    })
    setScrapeResult(null)
    setScrapeStage('idle')
  }

  // Tab error badges
  const tabHasError: Record<Tab, boolean> = {
    basic: !!(errors.name_en || errors.name_de),
    location: !!(errors.lat || errors.lng),
    details: false,
    media: false,
    geojson: layerErrors.some(e => !!e),
    models: false,
  }

  // Tab item counts for badges
  const tabCounts: Partial<Record<Tab, number>> = {
    geojson: form.geojson_layers.filter(l => l.json.trim()).length || undefined,
    models: form.model_layers.length || undefined,
    media: (form.thumbnail_url ? 1 : 0) + form.image_urls.length || undefined,
  }

  function updateLayer(index: number, patch: Partial<LayerEntry>) {
    setForm(f => ({
      ...f,
      geojson_layers: f.geojson_layers.map((l, i) => i === index ? { ...l, ...patch } : l),
    }))
    if (patch.json !== undefined) {
      setLayerErrors(prev => prev.map((e, i) => i === index ? '' : e))
    }
  }

  function addLayer() {
    setForm(f => ({
      ...f,
      geojson_layers: [...f.geojson_layers, { name: String(f.geojson_layers.length + 1), json: '', camera: null, coord_ref: defaultCoordRef(), visible: true }],
    }))
    setLayerErrors(prev => [...prev, ''])
  }

  const captureCamera = useCallback((index: number) => {
    const map = mapInstanceRef.current
    if (!map) return
    const c = map.getCenter()
    const camera: LayerCamera = {
      center: [parseFloat(c.lng.toFixed(6)), parseFloat(c.lat.toFixed(6))],
      zoom: parseFloat(map.getZoom().toFixed(2)),
      pitch: parseFloat(map.getPitch().toFixed(1)),
      bearing: parseFloat(map.getBearing().toFixed(1)),
    }
    setForm(f => ({
      ...f,
      geojson_layers: f.geojson_layers.map((l, i) => i === index ? { ...l, camera } : l),
    }))
    setJustCaptured(index)
    setTimeout(() => setJustCaptured(prev => prev === index ? null : prev), 2000)
  }, [])

  function removeLayer(index: number) {
    setForm(f => ({
      ...f,
      geojson_layers: f.geojson_layers.filter((_, i) => i !== index),
    }))
    setLayerErrors(prev => prev.filter((_, i) => i !== index))
  }

  function updateModelLayer(index: number, patch: Partial<ModelLayerEntry>) {
    setForm(f => ({
      ...f,
      model_layers: f.model_layers.map((l, i) => i === index ? { ...l, ...patch } : l),
    }))
  }

  function addModelLayer() {
    setForm(f => ({
      ...f,
      model_layers: [...f.model_layers, {
        name: `Model ${f.model_layers.length + 1}`,
        model_url: '',
        format: 'glb' as const,
        lng: f.lng,
        lat: f.lat,
        altitude: '0',
        scale: '1',
        rotation_x: '0',
        rotation_y: '0',
        rotation_z: '0',
        camera: null,
        visible: true,
        coord_ref: defaultCoordRef(),
      }],
    }))
  }

  function removeModelLayer(index: number) {
    setForm(f => ({
      ...f,
      model_layers: f.model_layers.filter((_, i) => i !== index),
    }))
  }

  async function uploadModelFile(index: number, file: File) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!['glb', 'gltf'].includes(ext)) {
      setModelUploadError('Only .glb and .gltf files are supported')
      return
    }
    setModelUploading(index)
    setModelUploadError(null)
    try {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('project-models').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('project-models').getPublicUrl(path)
      updateModelLayer(index, { model_url: data.publicUrl, format: ext as 'glb' | 'gltf' })
    } catch (e: unknown) {
      setModelUploadError(e instanceof Error ? e.message : 'Upload failed. Ensure the "project-models" storage bucket exists in Supabase.')
    } finally {
      setModelUploading(null)
    }
  }

  const captureModelCamera = useCallback((index: number) => {
    const map = mapInstanceRef.current
    if (!map) return
    const c = map.getCenter()
    const camera: LayerCamera = {
      center: [parseFloat(c.lng.toFixed(6)), parseFloat(c.lat.toFixed(6))],
      zoom: parseFloat(map.getZoom().toFixed(2)),
      pitch: parseFloat(map.getPitch().toFixed(1)),
      bearing: parseFloat(map.getBearing().toFixed(1)),
    }
    updateModelLayer(index, { camera })
    setJustCapturedModel(index)
    setTimeout(() => setJustCapturedModel(prev => prev === index ? null : prev), 2000)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    await onSave(formToDraft(form), project?.id)
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-5xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {project ? 'Edit project' : 'Add project'}
            </h2>
            {project && (
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{project.name_en}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-2 flex-shrink-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tabHasError[tab.id] && (
                <span className="absolute top-2 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {!tabHasError[tab.id] && tabCounts[tab.id] !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
                  activeTab === tab.id
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto sidebar-scroll px-6 py-5">

            {/* ── BASIC TAB ── */}
            {activeTab === 'basic' && (
              <div className="space-y-5">

                {/* ── URL Auto-populate ── */}
                <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    <span className="text-sm font-medium text-brand-700">AI Auto-populate from URL</span>
                    <span className="text-xs text-brand-500 font-normal">— paste a project page URL</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                      placeholder="https://www.str-ucture.com/projekte/museum-oberamteistrasse"
                      disabled={ACTIVE_SCRAPE_STAGES.includes(scrapeStage)}
                      className="flex-1 px-3 py-2 text-sm border border-brand-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white placeholder:text-gray-400 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleScrape}
                      disabled={!scrapeUrl.trim() || ACTIVE_SCRAPE_STAGES.includes(scrapeStage)}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                    >
                      {ACTIVE_SCRAPE_STAGES.includes(scrapeStage) ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          {STAGE_LABELS[scrapeStage]}
                        </>
                      ) : 'Process'}
                    </button>
                  </div>

                  {ACTIVE_SCRAPE_STAGES.includes(scrapeStage) && (
                    <div className="flex items-center gap-4">
                      {ACTIVE_SCRAPE_STAGES.map((stage, i) => {
                        const activeIdx = ACTIVE_SCRAPE_STAGES.indexOf(scrapeStage)
                        return (
                          <div key={stage} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full transition-colors ${
                              i < activeIdx ? 'bg-brand-500' :
                              i === activeIdx ? 'bg-brand-400 animate-pulse' :
                              'bg-gray-200'
                            }`} />
                            <span className={`text-xs ${i <= activeIdx ? 'text-brand-600' : 'text-gray-400'}`}>
                              {STAGE_LABELS[stage]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {scrapeStage === 'error' && scrapeError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{scrapeError}</p>
                  )}

                  {scrapeStage === 'done' && scrapeResult && (
                    <ScrapePreviewPanel
                      result={scrapeResult}
                      partial={scrapePartial}
                      selectedFields={selectedFields}
                      onToggleField={(field: keyof ScrapedProjectData) => setSelectedFields(prev => {
                        const next = new Set(prev)
                        next.has(field) ? next.delete(field) : next.add(field)
                        return next
                      })}
                      onSelectAll={() => setSelectedFields(new Set(
                        (Object.keys(scrapeResult) as Array<keyof ScrapedProjectData>).filter(k => {
                          const v = scrapeResult[k]
                          return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
                        })
                      ))}
                      onSelectNone={() => setSelectedFields(new Set())}
                      onApply={applyScrapedData}
                      onDismiss={() => { setScrapeResult(null); setScrapeStage('idle') }}
                    />
                  )}
                </div>
                {/* ── end URL Auto-populate ── */}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Project Name (EN) *" error={errors.name_en}>
                    <input
                      type="text"
                      value={form.name_en}
                      onChange={e => set('name_en', e.target.value)}
                      placeholder="Project name in English"
                      className={inputCls(!!errors.name_en)}
                    />
                  </Field>
                  <Field label="Project Name (DE) *" error={errors.name_de}>
                    <input
                      type="text"
                      value={form.name_de}
                      onChange={e => set('name_de', e.target.value)}
                      placeholder="Projektname auf Deutsch"
                      className={inputCls(!!errors.name_de)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Type">
                    <select
                      value={form.type}
                      onChange={e => set('type', e.target.value as ProjectType)}
                      className={inputCls()}
                    >
                      <option value="architecture">Architecture</option>
                      <option value="infrastructure">Infrastructure</option>
                      <option value="urban_planning">Urban Planning</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={e => set('status', e.target.value as ProjectStatus)}
                      className={inputCls()}
                    >
                      <option value="completed">Completed</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="planned">Planned</option>
                    </select>
                  </Field>
                  <Field label="Client / Commissioner">
                    <input
                      type="text"
                      value={form.client}
                      onChange={e => set('client', e.target.value)}
                      placeholder="Organisation"
                      className={inputCls()}
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.featured}
                      onClick={() => set('featured', !form.featured)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
                        form.featured ? 'bg-amber-400' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        form.featured ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <div
                      onClick={() => set('featured', !form.featured)}
                      className="text-sm text-gray-700 cursor-pointer select-none"
                    >
                      Featured <span className="text-amber-400">★</span>
                      <span className="text-gray-400 font-normal"> — appears first in sidebar</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.visible}
                      onClick={() => set('visible', !form.visible)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
                        form.visible ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        form.visible ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <div
                      onClick={() => set('visible', !form.visible)}
                      className="text-sm text-gray-700 cursor-pointer select-none"
                    >
                      Visible on Map
                      <span className="text-gray-400 font-normal"> — display project on the homepage map and sidebar</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LOCATION TAB ── */}
            {activeTab === 'location' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Address">
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="e.g. Rosensteinstraße 12"
                      className={inputCls()}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      placeholder="Berlin"
                      className={inputCls()}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude *" error={errors.lat}>
                    <input
                      type="text"
                      value={form.lat}
                      onChange={e => {
                        const val = e.target.value
                        const cleaned = val.replace(/^\s*\(/, '').replace(/\)\s*$/, '')
                        if (cleaned.includes(',')) {
                          const parts = cleaned.split(',')
                          if (parts.length === 2) {
                            const parsedLat = parseFloat(parts[0].trim())
                            const parsedLng = parseFloat(parts[1].trim())
                            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                              setForm(f => ({
                                ...f,
                                lat: String(parsedLat),
                                lng: String(parsedLng),
                              }))
                              if (errors.lat) setErrors(errs => ({ ...errs, lat: undefined }))
                              if (errors.lng) setErrors(errs => ({ ...errs, lng: undefined }))
                              return
                            }
                          }
                        }
                        set('lat', val)
                      }}
                      placeholder="52.5200 (paste Lat, Lng here)"
                      className={inputCls(!!errors.lat)}
                    />
                  </Field>
                  <Field label="Longitude *" error={errors.lng}>
                    <input
                      type="text"
                      value={form.lng}
                      onChange={e => set('lng', e.target.value)}
                      placeholder="13.4050"
                      className={inputCls(!!errors.lng)}
                    />
                  </Field>
                </div>

                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
                  Berlin centre: <span className="font-mono">52.5200, 13.4050</span> — right-click any location in{' '}
                  <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="text-brand-500 underline">
                    Google Maps
                  </a>{' '}
                  to copy coordinates and paste them directly into the Latitude field above.
                </p>
              </div>
            )}

            {/* ── DETAILS TAB ── */}
            {activeTab === 'details' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Completion date">
                    <input
                      type="date"
                      value={form.completion_date}
                      onChange={e => set('completion_date', e.target.value)}
                      className={inputCls()}
                    />
                  </Field>
                  <Field label="Area (m²)">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={form.area_sqm}
                      onChange={e => set('area_sqm', e.target.value)}
                      placeholder="18000"
                      className={inputCls()}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="English description">
                    <textarea
                      rows={6}
                      value={form.description_en}
                      onChange={e => set('description_en', e.target.value)}
                      placeholder="Project description in English…"
                      className={`${inputCls()} resize-none`}
                    />
                  </Field>
                  <Field label="German description (Deutsch)">
                    <textarea
                      rows={6}
                      value={form.description_de}
                      onChange={e => set('description_de', e.target.value)}
                      placeholder="Projektbeschreibung auf Deutsch…"
                      className={`${inputCls()} resize-none`}
                    />
                  </Field>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Tags</label>
                  <TagInput
                    value={form.tags}
                    onChange={tags => set('tags', tags)}
                    placeholder="residential, sustainable, leed…"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Press Enter or comma to add. Backspace removes the last one.</p>
                </div>
              </div>
            )}

            {/* ── MEDIA TAB ── */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <SingleImageUploader
                  value={form.thumbnail_url}
                  onChange={url => set('thumbnail_url', url)}
                  label="Thumbnail (cover image — shown in sidebar)"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Gallery images <span className="text-gray-400 font-normal">(shown in detail panel)</span>
                  </label>
                  <MultiImageUploader
                    value={form.image_urls}
                    onChange={urls => set('image_urls', urls)}
                  />
                </div>
              </div>
            )}

            {/* ── GEOJSON TAB ── */}
            {activeTab === 'geojson' && (
              <div className="grid grid-cols-2 gap-4">
                {form.geojson_layers.map((layer, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/30 flex flex-col">
                    {/* Layer header */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={layer.name}
                        onChange={e => updateLayer(i, { name: e.target.value })}
                        placeholder={`Layer ${i + 1} name`}
                        className={`${inputCls()} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => updateLayer(i, { visible: layer.visible === false ? true : false })}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                          layer.visible !== false
                            ? 'text-brand-600 hover:bg-brand-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={layer.visible !== false ? 'Model visible on map (click to hide)' : 'Model hidden from map (click to show)'}
                      >
                        {layer.visible !== false ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        )}
                      </button>
                      {form.geojson_layers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLayerToDelete(i)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Delete layer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* GeoJSON textarea */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">GeoJSON Content</label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={layer.coord_ref.mode}
                            onChange={e => updateLayer(i, { coord_ref: { ...layer.coord_ref, mode: e.target.value as CoordRefEntry['mode'] } })}
                            className="text-xs border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          >
                            <option value="none">No offset</option>
                            <option value="project">Project coordinates</option>
                            <option value="custom">Custom coordinates</option>
                          </select>
                          {layer.coord_ref.mode !== 'none' && (
                            <select
                              value={layer.coord_ref.unit}
                              onChange={e => updateLayer(i, { coord_ref: { ...layer.coord_ref, unit: e.target.value as CoordRefEntry['unit'] } })}
                              className="text-xs border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                            >
                              <option value="meters">Meters</option>
                              <option value="degrees">Degrees</option>
                            </select>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={6}
                        value={layer.json}
                        onChange={e => updateLayer(i, { json: e.target.value })}
                        placeholder={'{\n  "type": "Polygon",\n  "coordinates": [[[9.18, 48.77], ...]]\n}'}
                        className={`${inputCls(!!layerErrors[i])} font-mono text-xs resize-none leading-relaxed`}
                        spellCheck={false}
                      />
                      {layerErrors[i] && (
                        <p className="mt-1 text-xs text-red-500">{layerErrors[i]}</p>
                      )}
                      {layer.coord_ref.mode === 'custom' && (
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Longitude (ref)</label>
                            <input
                              type="number"
                              step="any"
                              value={layer.coord_ref.custom_lng}
                              onChange={e => updateLayer(i, { coord_ref: { ...layer.coord_ref, custom_lng: e.target.value } })}
                              placeholder="0.000000"
                              className={`${inputCls()} w-full font-mono`}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Latitude (ref)</label>
                            <input
                              type="number"
                              step="any"
                              value={layer.coord_ref.custom_lat}
                              onChange={e => updateLayer(i, { coord_ref: { ...layer.coord_ref, custom_lat: e.target.value } })}
                              placeholder="0.000000"
                              className={`${inputCls()} w-full font-mono`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Camera view */}
                    <CameraCapture
                      camera={layer.camera}
                      justCaptured={justCaptured === i}
                      onCapture={() => captureCamera(i)}
                      onClear={() => updateLayer(i, { camera: null })}
                      onEdit={cam => updateLayer(i, { camera: cam })}
                      onCopy={() => setCopiedCamera(layer.camera)}
                      onPaste={() => copiedCamera && updateLayer(i, { camera: copiedCamera })}
                      copiedCamera={copiedCamera}
                      showCaptureButton={false}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLayer}
                  className="flex flex-col items-center justify-center gap-2 text-xs font-medium text-brand-600 hover:text-brand-700 p-8 border-2 border-dashed border-brand-200 hover:border-brand-400 rounded-xl transition-all hover:bg-brand-50/50 group min-h-[280px]"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <span>Add GeoJSON layer</span>
                </button>
              </div>
            )}

            {/* ── 3D MODELS TAB ── */}
            {activeTab === 'models' && (
              <div className="grid grid-cols-2 gap-4">
                {form.model_layers.map((layer, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/30 flex flex-col">
                    {/* Header: index + name + visibility + remove */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={layer.name}
                        onChange={e => updateModelLayer(i, { name: e.target.value })}
                        placeholder={`Model ${i + 1} name`}
                        className={`${inputCls()} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => updateModelLayer(i, { visible: layer.visible === false ? true : false })}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                          layer.visible !== false
                            ? 'text-indigo-600 hover:bg-indigo-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={layer.visible !== false ? 'Model visible on map (click to hide)' : 'Model hidden from map (click to show)'}
                      >
                        {layer.visible !== false ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModelLayer(i)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Remove model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* File upload */}
                    {layer.model_url ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className="text-xs text-green-700 truncate flex-1 font-mono">
                          {layer.model_url.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateModelLayer(i, { model_url: '' })}
                          className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => modelInputRefs.current[i]?.click()}
                        disabled={modelUploading === i}
                        className="flex items-center justify-center gap-2 w-full px-3 py-3 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                      >
                        {modelUploading === i ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Uploading…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Upload GLB or glTF file
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={el => { modelInputRefs.current[i] = el }}
                      type="file"
                      accept=".glb,.gltf"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadModelFile(i, f)
                        e.target.value = ''
                      }}
                    />

                    {/* Anchor position + coord_ref */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Anchor position</label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={layer.coord_ref.mode}
                            onChange={e => updateModelLayer(i, { coord_ref: { ...layer.coord_ref, mode: e.target.value as CoordRefEntry['mode'] } })}
                            className="text-xs border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          >
                            <option value="none">No offset</option>
                            <option value="project">Project coordinates</option>
                            <option value="custom">Custom coordinates</option>
                          </select>
                          {layer.coord_ref.mode !== 'none' && (
                            <select
                              value={layer.coord_ref.unit}
                              onChange={e => updateModelLayer(i, { coord_ref: { ...layer.coord_ref, unit: e.target.value as CoordRefEntry['unit'] } })}
                              className="text-xs border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                            >
                              <option value="meters">Meters</option>
                              <option value="degrees">Degrees</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {layer.coord_ref.mode !== 'none' && (
                        <p className="text-[11px] text-gray-400 mb-2 italic">
                          Values act as local {layer.coord_ref.unit ?? 'meters'} offsets relative to the reference point.
                        </p>
                      )}

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5 truncate">
                            {layer.coord_ref.mode !== 'none' ? (layer.coord_ref.unit === 'meters' ? 'Y offset (m)' : 'Lat offset') : 'Latitude'}
                          </label>
                          <input type="number" step="any" value={layer.lat}
                            onChange={e => updateModelLayer(i, { lat: e.target.value })}
                            placeholder="48.7758" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5 truncate">
                            {layer.coord_ref.mode !== 'none' ? (layer.coord_ref.unit === 'meters' ? 'X offset (m)' : 'Lng offset') : 'Longitude'}
                          </label>
                          <input type="number" step="any" value={layer.lng}
                            onChange={e => updateModelLayer(i, { lng: e.target.value })}
                            placeholder="9.1829" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5 truncate">Altitude (m)</label>
                          <input type="number" step="any" value={layer.altitude}
                            onChange={e => updateModelLayer(i, { altitude: e.target.value })}
                            placeholder="0" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5 truncate">Scale</label>
                          <input type="number" step="any" min="0.0001" value={layer.scale}
                            onChange={e => updateModelLayer(i, { scale: e.target.value })}
                            placeholder="1" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                      </div>

                      {layer.coord_ref.mode === 'custom' && (
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Longitude (ref)</label>
                            <input
                              type="number"
                              step="any"
                              value={layer.coord_ref.custom_lng}
                              onChange={e => updateModelLayer(i, { coord_ref: { ...layer.coord_ref, custom_lng: e.target.value } })}
                              placeholder="0.000000"
                              className={`${inputCls()} w-full font-mono text-xs`}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Latitude (ref)</label>
                            <input
                              type="number"
                              step="any"
                              value={layer.coord_ref.custom_lat}
                              onChange={e => updateModelLayer(i, { coord_ref: { ...layer.coord_ref, custom_lat: e.target.value } })}
                              placeholder="0.000000"
                              className={`${inputCls()} w-full font-mono text-xs`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rotation — 3 columns */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Rotation (degrees)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5">X (pitch)</label>
                          <input type="number" step="any" value={layer.rotation_x}
                            onChange={e => updateModelLayer(i, { rotation_x: e.target.value })}
                            placeholder="0" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5">Y (yaw)</label>
                          <input type="number" step="any" value={layer.rotation_y}
                            onChange={e => updateModelLayer(i, { rotation_y: e.target.value })}
                            placeholder="0" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-0.5">Z (roll)</label>
                          <input type="number" step="any" value={layer.rotation_z}
                            onChange={e => updateModelLayer(i, { rotation_z: e.target.value })}
                            placeholder="0" className={`${inputCls()} px-1.5 text-xs font-mono`} />
                        </div>
                      </div>
                    </div>

                    {/* Camera view */}
                    <div className="mt-auto pt-2">
                      <CameraCapture
                        camera={layer.camera}
                        justCaptured={justCapturedModel === i}
                        onCapture={() => captureModelCamera(i)}
                        onClear={() => updateModelLayer(i, { camera: null })}
                        onEdit={cam => updateModelLayer(i, { camera: cam })}
                        onCopy={() => setCopiedCamera(layer.camera)}
                        onPaste={() => copiedCamera && updateModelLayer(i, { camera: copiedCamera })}
                        copiedCamera={copiedCamera}
                        showCaptureButton={false}
                      />
                    </div>
                  </div>
                ))}

                {modelUploadError && (
                  <div className="col-span-2">
                    <p className="text-xs text-red-500 bg-red-50 px-4 py-3 rounded-lg">{modelUploadError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addModelLayer}
                  className="flex flex-col items-center justify-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 p-8 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl transition-all hover:bg-indigo-50/50 group min-h-[280px]"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <span>Add 3D model</span>
                </button>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Tab prev/next shortcuts */}
              {TABS.findIndex(t => t.id === activeTab) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = TABS.findIndex(t => t.id === activeTab)
                    setActiveTab(TABS[idx - 1].id)
                  }}
                  className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  {TABS[TABS.findIndex(t => t.id === activeTab) - 1].label}
                </button>
              )}
              {TABS.findIndex(t => t.id === activeTab) < TABS.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = TABS.findIndex(t => t.id === activeTab)
                    setActiveTab(TABS[idx + 1].id)
                  }}
                  className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  {TABS[TABS.findIndex(t => t.id === activeTab) + 1].label}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {layerToDelete !== null && (
        <ConfirmDialog
          title="Delete layer"
          message={`Are you sure you want to delete "${form.geojson_layers[layerToDelete].name || 'this layer'}"? This action cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={confirmRemoveLayer}
          onCancel={() => setLayerToDelete(null)}
        />
      )}
    </>
  )
}

// Shared camera capture widget used in both GeoJSON and model layer cards
function CameraCapture({
  camera,
  justCaptured,
  onCapture,
  onClear,
  onEdit,
  onCopy,
  onPaste,
  copiedCamera,
  showCaptureButton = true,
}: {
  camera: LayerCamera | null
  justCaptured: boolean
  onCapture: () => void
  onClear: () => void
  onEdit?: (camera: LayerCamera) => void
  onCopy?: () => void
  onPaste?: () => void
  copiedCamera?: LayerCamera | null
  showCaptureButton?: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState({ zoom: '', pitch: '', bearing: '', lng: '', lat: '' })

  function enterEdit() {
    if (!camera) return
    setDraft({
      zoom: String(camera.zoom),
      pitch: String(camera.pitch),
      bearing: String(camera.bearing),
      lng: String(camera.center[0]),
      lat: String(camera.center[1]),
    })
    setEditMode(true)
  }

  function saveEdit() {
    const zoom = parseFloat(draft.zoom)
    const pitch = parseFloat(draft.pitch)
    const bearing = parseFloat(draft.bearing)
    const lng = parseFloat(draft.lng)
    const lat = parseFloat(draft.lat)
    if ([zoom, pitch, bearing, lng, lat].some(isNaN)) return
    onEdit?.({ center: [lng, lat], zoom, pitch, bearing })
    setEditMode(false)
  }

  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Camera view</span>
        {camera && !editMode && (
          <div className="flex items-center gap-2">
            {onCopy && (
              <button type="button" onClick={onCopy} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
                Copy
              </button>
            )}
            {onPaste && copiedCamera && (
              <button type="button" onClick={onPaste} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
                Paste
              </button>
            )}
            <button type="button" onClick={enterEdit} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
              Edit
            </button>
            <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Clear
            </button>
          </div>
        )}
        {!camera && onPaste && copiedCamera && (
          <button type="button" onClick={onPaste} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
            Paste
          </button>
        )}
      </div>

      {camera ? (
        <div className="space-y-2">
          {editMode ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                {(['zoom', 'pitch', 'bearing'] as const).map(field => (
                  <div key={field} className="contents">
                    <label className="text-xs text-gray-400 self-center capitalize">{field}</label>
                    <input
                      type="number"
                      step="any"
                      value={draft[field]}
                      onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
                      className="text-xs font-mono border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                ))}
                <label className="text-xs text-gray-400 self-center">lng</label>
                <input
                  type="number"
                  step="any"
                  value={draft.lng}
                  onChange={e => setDraft(d => ({ ...d, lng: e.target.value }))}
                  className="text-xs font-mono border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <label className="text-xs text-gray-400 self-center">lat</label>
                <input
                  type="number"
                  step="any"
                  value={draft.lat}
                  onChange={e => setDraft(d => ({ ...d, lat: e.target.value }))}
                  className="text-xs font-mono border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-1 text-xs font-medium px-2 py-1.5 rounded-md border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="flex-1 text-xs font-medium px-2 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-x-2 gap-y-1 font-mono text-xs text-gray-600">
              <span className="text-gray-400">zoom</span><span>{camera.zoom}</span>
              <span className="text-gray-400">pitch</span><span>{camera.pitch}°</span>
              <span className="text-gray-400">bearing</span><span>{camera.bearing}°</span>
              <span className="text-gray-400">lng, lat</span>
              <span className="col-span-3">{camera.center[0].toFixed(2)}, {camera.center[1].toFixed(2)}</span>
            </div>
          )}
          {showCaptureButton && !editMode && (
            <button
              type="button"
              onClick={onCapture}
              className={`flex items-center gap-1.5 text-xs font-medium w-full justify-center px-2 py-1.5 rounded-md border transition-all ${
                justCaptured
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              {justCaptured ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Captured
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Update from map
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            {showCaptureButton
              ? "Navigate the map to the desired view, then capture it."
              : "No camera view set for this layer."}
          </p>
          {showCaptureButton && (
            <button
              type="button"
              onClick={onCapture}
              className={`flex items-center gap-1.5 text-xs font-medium w-full justify-center px-2 py-1.5 rounded-md border transition-all ${
                justCaptured
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              {justCaptured ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Captured
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  Capture current map view
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Scrape Preview Panel ────────────────────────────────────────────────────

function ScrapePreviewPanel({
  result,
  partial,
  selectedFields,
  onToggleField,
  onSelectAll,
  onSelectNone,
  onApply,
  onDismiss,
}: {
  result: ScrapedProjectData
  partial: boolean
  selectedFields: Set<keyof ScrapedProjectData>
  onToggleField: (field: keyof ScrapedProjectData) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onApply: () => void
  onDismiss: () => void
}) {
  function FieldRow({ field, label, value }: {
    field: keyof ScrapedProjectData
    label: string
    value: string | null | undefined
  }) {
    if (!value) return null
    const checked = selectedFields.has(field)
    return (
      <label className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
        checked ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'
      }`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleField(field)}
          className="mt-0.5 flex-shrink-0 accent-brand-600"
        />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-500 block">{label}</span>
          <p className="text-xs text-gray-800 truncate">{value}</p>
        </div>
      </label>
    )
  }

  const hasImages = result.image_urls.length > 0
  const allSelectableFields = (Object.keys(result) as Array<keyof ScrapedProjectData>).filter(k => {
    const v = result[k]
    return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  })
  const allSelected = allSelectableFields.every(f => selectedFields.has(f))

  return (
    <div className="border border-brand-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span className="text-xs font-medium text-gray-700">
            Extraction complete
            {partial && <span className="ml-1.5 text-amber-600">(some steps had errors)</span>}
          </span>
        </div>
        <button type="button" onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="p-3 space-y-0.5 max-h-72 overflow-y-auto sidebar-scroll">
        <p className="text-xs text-gray-400 px-2 pb-1">Select fields to apply to the form:</p>
        <FieldRow field="name_en" label="Name (EN)" value={result.name_en} />
        <FieldRow field="name_de" label="Name (DE)" value={result.name_de} />
        <FieldRow field="type" label="Type" value={result.type} />
        <FieldRow field="status" label="Status" value={result.status} />
        <FieldRow field="client" label="Client" value={result.client} />
        <FieldRow field="address" label="Address" value={result.address} />
        <FieldRow field="city" label="City" value={result.city} />
        {result.lat !== null && result.lng !== null && (
          <FieldRow field="lat" label="Coordinates" value={`${result.lat?.toFixed(5)}, ${result.lng?.toFixed(5)}`} />
        )}
        <FieldRow field="completion_date" label="Completion date" value={result.completion_date} />
        <FieldRow field="area_sqm" label="Area (m²)" value={result.area_sqm !== null ? String(result.area_sqm) : null} />
        <FieldRow field="description_en" label="Description (EN)" value={result.description_en ? result.description_en.slice(0, 100) + '…' : null} />
        <FieldRow field="description_de" label="Description (DE)" value={result.description_de ? result.description_de.slice(0, 100) + '…' : null} />
        {result.tags.length > 0 && (
          <label className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
            selectedFields.has('tags') ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'
          }`}>
            <input type="checkbox" checked={selectedFields.has('tags')} onChange={() => onToggleField('tags')} className="mt-0.5 flex-shrink-0 accent-brand-600" />
            <div className="min-w-0">
              <span className="text-xs font-medium text-gray-500 block">Tags</span>
              <p className="text-xs text-gray-800">{result.tags.join(', ')}</p>
            </div>
          </label>
        )}
        {hasImages && (
          <label className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
            selectedFields.has('image_urls') ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'
          }`}>
            <input type="checkbox" checked={selectedFields.has('image_urls')} onChange={() => onToggleField('image_urls')} className="mt-0.5 flex-shrink-0 accent-brand-600" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-gray-500 block">Images ({result.image_urls.length} found)</span>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {result.image_urls.slice(0, 5).map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className={`w-14 h-14 object-cover rounded-lg border-2 ${i === 0 ? 'border-brand-400' : 'border-gray-200'}`}
                    title={i === 0 ? 'Will be used as thumbnail' : undefined}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">First image (highlighted) → thumbnail</p>
            </div>
          </label>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={allSelected ? onSelectNone : onSelectAll}
          className="text-xs text-brand-600 hover:text-brand-700"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onDismiss} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            Discard
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={selectedFields.size === 0}
            className="px-4 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Apply selected ({selectedFields.size})
          </button>
        </div>
      </div>
    </div>
  )
}
