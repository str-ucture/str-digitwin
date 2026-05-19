import type mapboxgl from 'mapbox-gl'
import type { ProjectType } from '../types/project'
import { validateConfig, isConfigError } from './config'

const config = validateConfig()

// If config is invalid, App.tsx renders ConfigError before MapView is ever mounted.
// The empty-string fallback prevents mapboxgl.accessToken from being set to 'undefined'.
export const MAPBOX_TOKEN = isConfigError(config) ? '' : config.mapboxToken

export const GERMANY_CENTER: [number, number] = [10.03343, 51.15554]
export const DEFAULT_ZOOM = 5.36
export const DEFAULT_PITCH = 0.0
export const DEFAULT_BEARING = 0.0
export const STADIA_TONER_LITE_STYLE = {
  version: 8 as const,
  sources: {
    'stadia-stamen-toner-lite': {
      type: 'raster',
      tiles: ['https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    composite: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    }
  },
  layers: [
    {
      id: 'stadia-stamen-toner-lite-layer',
      type: 'raster',
      source: 'stadia-stamen-toner-lite',
      minzoom: 0,
      maxzoom: 20
    }
  ]
}

export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    'osm-raster-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    },
    composite: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    }
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MAP_STYLE = 'mapbox://styles/shailesh-stha/cmpccgocy00ak01s77u783e72' as any

export const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  architecture: '#ff3eb5',
  infrastructure: '#16A34A',
  urban_planning: '#9333EA',
}

export const PROJECT_STATUS_COLORS = {
  completed: '#16A34A',
  ongoing: '#D97706',
  planned: '#6B7280',
}

const STANDARD_FONT_PREFIXES = [
  'Open Sans', 'DIN Offc', 'Arial Unicode MS', 'Roboto',
  'Noto', 'Source Sans', 'PT Sans', 'Ubuntu', 'Lato', 'Raleway',
]
const FALLBACK_FONTS = ['Open Sans Regular', 'Arial Unicode MS Regular']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function patchLayerFont(layer: any): any {
  const textFont = layer?.layout?.['text-font']
  if (!Array.isArray(textFont) || !textFont.length) return layer
  // GL expressions have a lowercase keyword as the first element (e.g. 'literal', 'match').
  // Plain font stacks start with an uppercase font name — skip expressions.
  if (typeof textFont[0] === 'string' && /^[a-z]/.test(textFont[0])) return layer
  const hasNonStandard = textFont.some(
    (f: unknown) => typeof f === 'string' && !STANDARD_FONT_PREFIXES.some(p => f.startsWith(p))
  )
  if (!hasNonStandard) return layer
  return { ...layer, layout: { ...layer.layout, 'text-font': FALLBACK_FONTS } }
}

/**
 * Pass as the `transformStyle` option on `new mapboxgl.Map(...)`.
 * Mapbox calls this synchronously with the raw style JSON before distributing
 * it to Web Workers — patches layer-level text-font declarations before any
 * glyph requests are made.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformStyleFonts(_prev: any, next: any): any {
  if (!Array.isArray(next?.layers)) return next
  return { ...next, layers: next.layers.map(patchLayerFont) }
}

/**
 * Pass as the `transformRequest` option on `new mapboxgl.Map(...)`.
 * Acts as a network-level safety net: any glyph (.pbf) request that still
 * carries a non-standard font name (e.g. from a Standard-style config block
 * that transformStyleFonts cannot reach) is redirected to "Open Sans Regular"
 * before the request leaves the browser.
 *
 * URL shape: …/fonts/v1/{user}/{fontstack}/{range}.pbf?access_token=…
 * Commas in the fontstack are literal; spaces are percent-encoded.
 */
export function transformRequestFonts(
  url: string,
  resourceType: string,
): mapboxgl.RequestParameters | undefined {
  if (resourceType !== 'Glyphs') return undefined

  const match = url.match(/^(.+\/fonts\/v1\/[^/]+\/)([^/]+)(\/\d+-\d+\.pbf.*)$/)
  if (!match) return undefined

  const encodedStack = match[2]
  const fonts = decodeURIComponent(encodedStack).split(',').map(f => f.trim())

  const standard = fonts.filter(f => STANDARD_FONT_PREFIXES.some(p => f.startsWith(p)))
  const resolved = standard.length > 0 ? standard : FALLBACK_FONTS

  if (resolved.join(',') === fonts.join(',')) return undefined

  const resolvedEncoded = resolved.map(f => encodeURIComponent(f)).join(',')
  return { url: match[1] + resolvedEncoded + match[3] }
}
