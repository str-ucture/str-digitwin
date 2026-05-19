import { useCallback } from 'react'
import { mapInstanceRef } from '../lib/mapContext'
import { GERMANY_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH, DEFAULT_BEARING } from '../lib/mapbox'
import type { Project } from '../types/project'

export function useMap() {
  const flyToProject = useCallback((project: Project) => {
    mapInstanceRef.current?.flyTo({
      center: [project.lng, project.lat],
      zoom: 16,
      pitch: 60,
      duration: 1500,
    })
  }, [])

  const resetView = useCallback(() => {
    mapInstanceRef.current?.flyTo({
      center: GERMANY_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 1500,
    })
  }, [])

  return { flyToProject, resetView }
}
