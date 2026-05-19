export type ProjectType = 'architecture' | 'infrastructure' | 'urban_planning'
export type ProjectStatus = 'completed' | 'ongoing' | 'planned'

export type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: number[][][]
}

export type GeoJSONFeature = {
  type: 'Feature'
  geometry: GeoJSONPolygon
  properties: Record<string, unknown> | null
}

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// What gets stored in the `polygon` column — any valid GeoJSON containing polygon(s)
export type ProjectGeoJSON = GeoJSONPolygon | GeoJSONFeature | GeoJSONFeatureCollection

// Camera state captured from the live Mapbox map for a specific layer view
export type LayerCamera = {
  center: [number, number]  // [lng, lat]
  zoom: number
  pitch: number
  bearing: number
}

// A named camera view — one layer can have many of these
export type NamedCamera = LayerCamera & {
  name: string
}

export type CoordRefMode = 'none' | 'project' | 'custom'
export type CoordUnit = 'meters' | 'degrees'

// Per-layer coordinate reference — transforms local coords to WGS84 on the map
export type CoordRef = {
  mode: CoordRefMode
  unit?: CoordUnit        // relevant when mode !== 'none'
  custom_lng?: number     // used when mode === 'custom'
  custom_lat?: number     // used when mode === 'custom'
}

// A named GeoJSON layer — multiple can be attached to one project
export type GeoJSONLayer = {
  name: string
  data: ProjectGeoJSON
  camera?: LayerCamera        // legacy single camera (still respected as cameras[0] fallback)
  cameras?: NamedCamera[]     // named camera views; supersedes camera when present
  coord_ref?: CoordRef
  visible?: boolean
}

// A named glTF/GLB model layer — stored in Supabase and rendered via Mapbox model source
export type ModelLayer = {
  name: string
  model_url: string
  format: 'glb' | 'gltf'
  lng: number
  lat: number
  altitude?: number       // metres above ground, default 0
  scale?: number          // uniform scale, default 1
  rotation?: [number, number, number]  // [x, y, z] degrees
  camera?: LayerCamera        // legacy single camera (still respected as cameras[0] fallback)
  cameras?: NamedCamera[]     // named camera views; supersedes camera when present
  visible?: boolean
  coord_ref?: CoordRef
}

export interface Project {
  id: string
  name_en: string
  name_de: string
  description_en: string | null
  description_de: string | null
  type: ProjectType
  status: ProjectStatus
  client: string | null
  address: string | null
  city: string
  lat: number
  lng: number
  completion_date: string | null
  area_sqm: number | null
  polygon: ProjectGeoJSON | null
  geojson_layers: GeoJSONLayer[] | null
  model_layers: ModelLayer[] | null
  default_camera?: LayerCamera | null
  hidden_building_ids?: string[] | null
  thumbnail_url: string | null
  image_urls: string[] | null
  tags: string[] | null
  featured: boolean
  visible: boolean
  source_url: string | null
  created_at: string
}

export interface ProjectFilters {
  type: ProjectType | 'all'
  status: ProjectStatus | 'all'
  year: number | null
  search: string
}

// ─── URL Scraping / AI Auto-populate ────────────────────────────────────────

export interface ScrapedProjectData {
  name_en: string | null
  name_de: string | null
  description_en: string | null
  description_de: string | null
  type: ProjectType | null
  status: ProjectStatus | null
  client: string | null
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
  completion_date: string | null
  area_sqm: number | null
  tags: string[]
  image_urls: string[]
  source_url: string
}

export type ScrapeStage =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'images'
  | 'geocoding'
  | 'done'
  | 'error'

export interface ScrapeProjectResponse {
  ok: boolean
  data?: ScrapedProjectData
  error?: string
  partial?: boolean
}
