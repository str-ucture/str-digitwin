import type mapboxgl from 'mapbox-gl'

/**
 * Shared reference to the live Mapbox map instance.
 * MapView writes this on mount and clears it on unmount.
 * Admin form reads it when the user captures a camera view.
 */
export const mapInstanceRef: { current: mapboxgl.Map | null } = { current: null }
