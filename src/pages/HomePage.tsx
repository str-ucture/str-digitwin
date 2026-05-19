import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/UI/Header'
import MapView from '../components/Map/MapView'
import Sidebar from '../components/Sidebar/Sidebar'
import ProjectDetail from '../components/ProjectDetail/ProjectDetail'
import LayerCarousel from '../components/Map/LayerCarousel'
import { useIsAdmin } from '../lib/authContext'
import { useProjects } from '../hooks/useProjects'
import { mapInstanceRef } from '../lib/mapContext'
import { supabase } from '../lib/supabase'
import type { Project, ProjectFilters, ProjectGeoJSON, LayerCamera, NamedCamera, CoordUnit, CoordRef } from '../types/project'

import MapSettingsPanel from '../components/Map/MapSettingsPanel'
import LocationSearchBar from '../components/Map/LocationSearchBar'

function shiftCoords(coords: number[][], refLng: number, refLat: number, unit: CoordUnit): number[][] {
  if (unit === 'meters') {
    const cosLat = Math.cos((refLat * Math.PI) / 180)
    return coords.map(([x, y]) => [
      refLng + x / (111320 * cosLat),
      refLat + y / 110540,
    ])
  }
  return coords.map(([x, y]) => [refLng + x, refLat + y])
}

function applyCoordRef(geojson: ProjectGeoJSON, refLng: number, refLat: number, unit: CoordUnit): ProjectGeoJSON {
  if (geojson.type === 'Polygon') {
    return { ...geojson, coordinates: geojson.coordinates.map(ring => shiftCoords(ring, refLng, refLat, unit)) }
  }
  if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
    return {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: geojson.geometry.coordinates.map(ring => shiftCoords(ring, refLng, refLat, unit)),
      },
    }
  }
  if (geojson.type === 'FeatureCollection') {
    return {
      ...geojson,
      features: geojson.features.map(f => {
        if (f.geometry?.type !== 'Polygon') return f
        return {
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: f.geometry.coordinates.map(ring => shiftCoords(ring, refLng, refLat, unit)),
          },
        }
      }),
    }
  }
  return geojson
}

function getActivePolygon(project: Project, layerIndex: number): ProjectGeoJSON | null {
  const layers = getProjectLayers(project)
  const activeLayer = layers[layerIndex]
  // When a model layer is active, hide the base/GeoJSON polygon to avoid overlap and depth fighting
  if (activeLayer && activeLayer.type === 'model') {
    return null
  }
  const visibleGeojsonCount = layers.filter(l => l.type === 'geojson').length
  if (visibleGeojsonCount === 0) return project.polygon

  if (activeLayer && activeLayer.type === 'geojson') {
    const ref: CoordRef | undefined = activeLayer.coord_ref
    if (!ref || ref.mode === 'none') return activeLayer.data
    const refLng = ref.mode === 'project' ? project.lng : (ref.custom_lng ?? project.lng)
    const refLat = ref.mode === 'project' ? project.lat : (ref.custom_lat ?? project.lat)
    return applyCoordRef(activeLayer.data, refLng, refLat, ref.unit ?? 'meters')
  }
  return null
}

function getProjectLayers(project: Project) {
  const geojson = (project.geojson_layers ?? [])
    .map((l, i) => ({ ...l, type: 'geojson' as const, originalIndex: i }))
    .filter(l => l.visible !== false)
  const models = (project.model_layers ?? [])
    .map((l, i) => ({ ...l, type: 'model' as const, originalIndex: i }))
    .filter(l => l.visible !== false)
  return [...geojson, ...models]
}

export default function HomePage() {
  const isAdmin = useIsAdmin()
  const [searchParams, setSearchParams] = useSearchParams()

  // Capture the initial mount values to initialize filters and determine if we need to auto-select a project
  const [initialUrlProjectId] = useState(() => searchParams.get('project'))
  const [initialProjectLoaded, setInitialProjectLoaded] = useState(false)

  const [filters, setFilters] = useState<ProjectFilters>(() => ({
    type: (searchParams.get('type') as any) ?? 'all',
    status: (searchParams.get('status') as any) ?? 'all',
    year: searchParams.has('year') ? Number(searchParams.get('year')) : null,
    search: '',
  }))
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const [flyKey, setFlyKey] = useState(0)
  // Tracks which unified layer index is active per project (GeoJSON indices first, then Models)
  const [activeLayerIndices, setActiveLayerIndices] = useState<Record<string, number>>({})
  // Tracks which named camera view is active per project+layer: key = `${projectId}:${layerOriginalIndex}`, value = cameras[] index (-1 = default)
  const [activeCameraIndices, setActiveCameraIndices] = useState<Record<string, number>>({})
  const [modelRotationEdit, setModelRotationEdit] = useState<[number, number, number] | null>(null)
  const [modelCoordsEdit, setModelCoordsEdit] = useState<[number, number] | null>(null)
  const [modelCoordsInput, setModelCoordsInput] = useState<[string, string] | null>(null)
  const [modelPositionExpanded, setModelPositionExpanded] = useState(false)
  const [savingRotation, setSavingRotation] = useState(false)

  // Base buildings mask management state
  const [hiddenBuildingsEdit, setHiddenBuildingsEdit] = useState<string[] | null>(null)
  const [isSelectingBuildings, setIsSelectingBuildings] = useState(false)
  const [hideBuildingsExpanded, setHideBuildingsExpanded] = useState(false)
  const [savingHiddenBuildings, setSavingHiddenBuildings] = useState(false)

  // Material filtering for 3D model layers on the map
  // layerId → string[] of material names extracted from the loaded GLB
  const [modelMaterials, setModelMaterials] = useState<Record<string, string[]>>({})
  // layerId → selected material name ('all' = no filter)
  const [selectedMaterialByLayer, setSelectedMaterialByLayer] = useState<Record<string, string>>({})

  const { projects, loading, error, reload } = useProjects(filters)

  // Once projects finish loading, if there was an initial project ID in the URL, auto-select it
  useEffect(() => {
    if (!initialProjectLoaded && projects.length > 0) {
      if (initialUrlProjectId) {
        const target = projects.find(p => p.id === initialUrlProjectId)
        if (target) {
          setSelectedProject(target)
          setFlyKey(k => k + 1)
        }
      }
      setInitialProjectLoaded(true)
    }
  }, [projects, initialProjectLoaded, initialUrlProjectId])

  // Keep the URL query parameters synchronized with filter selections and the selected project
  useEffect(() => {
    // Prevent overwriting the URL before initial projects array loads and resolves any initial project selection
    if (!initialProjectLoaded && initialUrlProjectId) return

    const params = new URLSearchParams()
    if (filters.type && filters.type !== 'all') {
      params.set('type', filters.type)
    }
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status)
    }
    if (filters.year !== null && filters.year !== undefined) {
      params.set('year', String(filters.year))
    }
    if (selectedProject) {
      params.set('project', selectedProject.id)
    }
    setSearchParams(params, { replace: true })
  }, [filters.type, filters.status, filters.year, selectedProject?.id, setSearchParams, initialProjectLoaded, initialUrlProjectId])

  // Keep modelRotationEdit, modelCoordsEdit, and hiddenBuildingsEdit synchronized with saved DB state
  useEffect(() => {
    if (selectedProject && isAdmin) {
      const pFresh = projects.find(p => p.id === selectedProject.id) ?? selectedProject
      setHiddenBuildingsEdit(pFresh.hidden_building_ids ?? [])
      const layers = getProjectLayers(pFresh)
      const idx = activeLayerIndices[pFresh.id] ?? 0
      const activeL = layers[idx]
      if (activeL?.type === 'model') {
        setModelRotationEdit(activeL.rotation ?? [0, 0, 0])
        const initLng = activeL.lng ?? pFresh.lng
        const initLat = activeL.lat ?? pFresh.lat
        setModelCoordsEdit([initLng, initLat])
        setModelCoordsInput([String(initLng), String(initLat)])
      } else {
        setModelRotationEdit(null)
        setModelCoordsEdit(null)
        setModelCoordsInput(null)
      }
    } else {
      setModelRotationEdit(null)
      setModelCoordsEdit(null)
      setModelCoordsInput(null)
      setHiddenBuildingsEdit(null)
      setIsSelectingBuildings(false)
    }
  }, [selectedProject?.id, activeLayerIndices, isAdmin, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle map canvas clicks when in building inspection mode
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !isSelectingBuildings) return

    function handleBuildingClick(e: any) {
      const features = map?.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] })
      if (features && features.length > 0) {
        const clickedFeature = features[0]
        const featId = clickedFeature.id
        if (featId != null) {
          const idStr = String(featId)
          setHiddenBuildingsEdit(prev => {
            const list = prev ?? []
            if (list.includes(idStr)) return list
            return [...list, idStr]
          })
        }
      }
    }

    map.on('click', handleBuildingClick)
    const canvas = map.getCanvas()
    const origCursor = canvas.style.cursor
    canvas.style.cursor = 'crosshair'

    return () => {
      map.off('click', handleBuildingClick)
      canvas.style.cursor = origCursor
    }
  }, [isSelectingBuildings])

  // Keep selectedProject fresh without re-triggering flyTo map resets during live edits
  useEffect(() => {
    if (selectedProject) {
      const fresh = projects.find(p => p.id === selectedProject.id)
      if (fresh) {
        setSelectedProject(fresh)
      }
    }
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectProject(project: Project | null) {
    setSelectedProject(project)
    if (project) setFlyKey((k) => k + 1)
  }

  // Helper: compute key for per-layer camera index tracking
  function camKey(projectId: string, layerOriginalIndex: number) {
    return `${projectId}:${layerOriginalIndex}`
  }

  // Helper: fly to a camera view.
  // Uses easeTo (linear interpolation) rather than flyTo (zoom-out arc) so that
  // layer and camera-view transitions are smooth without the jarring zoom-out path.
  function flyToCamera(cam: LayerCamera) {
    const map = mapInstanceRef.current
    if (!map) return
    map.easeTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, duration: 1200 })
  }

  function handleLayerChange(projectId: string, index: number, targetCameraIndex?: number) {
    const isChangingLayer = activeLayerIndices[projectId] !== index
    // Only update when the layer actually changes — avoids a new object reference on every
    // camera-view switch, which would otherwise re-trigger the model sync effect and flash the GLB.
    if (isChangingLayer) {
      setActiveLayerIndices(prev => ({ ...prev, [projectId]: index }))
    }

    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const layers = getProjectLayers(project)
    const layer = layers[index]
    if (!layer) return

    let finalCamIdx = -1
    if (targetCameraIndex !== undefined) {
      finalCamIdx = targetCameraIndex
    } else {
      if (layer.camera) {
        finalCamIdx = -1
      } else {
        const cameras = layer.cameras ?? []
        if (cameras.length > 0) {
          finalCamIdx = 0
        } else {
          finalCamIdx = -1
        }
      }
    }

    setActiveCameraIndices(prev => ({ ...prev, [camKey(projectId, layer.originalIndex)]: finalCamIdx }))

    let targetCam: LayerCamera | undefined
    if (finalCamIdx === -1) {
      if (layer.camera) targetCam = layer.camera
    } else {
      const cams = layer.cameras ?? []
      if (cams[finalCamIdx]) targetCam = cams[finalCamIdx]
    }

    if (targetCam) {
      if (isChangingLayer && layer.type === 'geojson') {
        // Give React a tiny window to flush geometry changes before flying
        setTimeout(() => flyToCamera(targetCam!), 50)
      } else {
        // Model layer switches and camera-view-only changes fly immediately.
        // The easeTo animation (~1200ms) gives the GLB enough time to parse
        // and appear on screen before the camera arrives at the target view.
        flyToCamera(targetCam)
      }
    }
  }

  // Save current map viewport to a named camera slot (cameraSlot=null → save as legacy .camera field)
  async function handleSaveCamera(projectId: string, layerUnifiedIndex: number, cameraSlot: number | null) {
    const map = mapInstanceRef.current
    if (!map) return

    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const layers = getProjectLayers(project)
    const activeLayer = layers[layerUnifiedIndex]
    if (!activeLayer) return

    const c = map.getCenter()
    const camera: LayerCamera = {
      center: [parseFloat(c.lng.toFixed(6)), parseFloat(c.lat.toFixed(6))],
      zoom: parseFloat(map.getZoom().toFixed(2)),
      pitch: parseFloat(map.getPitch().toFixed(1)),
      bearing: parseFloat(map.getBearing().toFixed(1)),
    }

    if (activeLayer.type === 'geojson') {
      const updatedLayers = (project.geojson_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        if (cameraSlot === null) return { ...l, camera }
        const cams = [...(l.cameras ?? [])]
        cams[cameraSlot] = { ...cams[cameraSlot], ...camera }
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ geojson_layers: updatedLayers as any }).eq('id', projectId)
    } else {
      const updatedLayers = (project.model_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        if (cameraSlot === null) return { ...l, camera }
        const cams = [...(l.cameras ?? [])]
        cams[cameraSlot] = { ...cams[cameraSlot], ...camera }
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ model_layers: updatedLayers as any }).eq('id', projectId)
    }

    reload()
  }

  // Add a new named camera view to the active layer, saves current viewport
  async function handleAddCamera(projectId: string, layerUnifiedIndex: number, name: string) {
    const map = mapInstanceRef.current
    if (!map) return

    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const layers = getProjectLayers(project)
    const activeLayer = layers[layerUnifiedIndex]
    if (!activeLayer) return

    const c = map.getCenter()
    const newCam: NamedCamera = {
      name,
      center: [parseFloat(c.lng.toFixed(6)), parseFloat(c.lat.toFixed(6))],
      zoom: parseFloat(map.getZoom().toFixed(2)),
      pitch: parseFloat(map.getPitch().toFixed(1)),
      bearing: parseFloat(map.getBearing().toFixed(1)),
    }

    if (activeLayer.type === 'geojson') {
      const updatedLayers = (project.geojson_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        return { ...l, cameras: [...(l.cameras ?? []), newCam] }
      })
      await supabase.from('projects').update({ geojson_layers: updatedLayers as any }).eq('id', projectId)
    } else {
      const updatedLayers = (project.model_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        return { ...l, cameras: [...(l.cameras ?? []), newCam] }
      })
      await supabase.from('projects').update({ model_layers: updatedLayers as any }).eq('id', projectId)
    }

    // Auto-activate the newly added camera view
    const currentCameras = activeLayer.cameras ?? []
    const newIndex = currentCameras.length
    setActiveCameraIndices(prev => ({ ...prev, [camKey(projectId, activeLayer.originalIndex)]: newIndex }))
    flyToCamera(newCam)

    reload()
  }

  // Delete a named camera view by index
  async function handleDeleteCamera(projectId: string, layerUnifiedIndex: number, cameraIndex: number) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const layers = getProjectLayers(project)
    const activeLayer = layers[layerUnifiedIndex]
    if (!activeLayer) return

    if (activeLayer.type === 'geojson') {
      const updatedLayers = (project.geojson_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        const cams = (l.cameras ?? []).filter((_, ci) => ci !== cameraIndex)
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ geojson_layers: updatedLayers as any }).eq('id', projectId)
    } else {
      const updatedLayers = (project.model_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        const cams = (l.cameras ?? []).filter((_, ci) => ci !== cameraIndex)
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ model_layers: updatedLayers as any }).eq('id', projectId)
    }

    // Reset camera index if deleted slot was active
    const ck = camKey(projectId, activeLayer.originalIndex)
    setActiveCameraIndices(prev => {
      const current = prev[ck] ?? -1
      if (current === cameraIndex) return { ...prev, [ck]: -1 }
      if (current > cameraIndex) return { ...prev, [ck]: current - 1 }
      return prev
    })

    reload()
  }

  // Rename a named camera view by index
  async function handleRenameCamera(projectId: string, layerUnifiedIndex: number, cameraIndex: number, name: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const layers = getProjectLayers(project)
    const activeLayer = layers[layerUnifiedIndex]
    if (!activeLayer) return

    if (activeLayer.type === 'geojson') {
      const updatedLayers = (project.geojson_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        const cams = (l.cameras ?? []).map((c, ci) => ci === cameraIndex ? { ...c, name } : c)
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ geojson_layers: updatedLayers as any }).eq('id', projectId)
    } else {
      const updatedLayers = (project.model_layers ?? []).map((l, i) => {
        if (i !== activeLayer.originalIndex) return l
        const cams = (l.cameras ?? []).map((c, ci) => ci === cameraIndex ? { ...c, name } : c)
        return { ...l, cameras: cams }
      })
      await supabase.from('projects').update({ model_layers: updatedLayers as any }).eq('id', projectId)
    }

    reload()
  }

  async function handleSaveProjectView(projectId: string) {
    const map = mapInstanceRef.current
    if (!map) return

    const c = map.getCenter()
    const lng = parseFloat(c.lng.toFixed(6))
    const lat = parseFloat(c.lat.toFixed(6))
    const default_camera: LayerCamera = {
      center: [lng, lat],
      zoom: parseFloat(map.getZoom().toFixed(2)),
      pitch: parseFloat(map.getPitch().toFixed(1)),
      bearing: parseFloat(map.getBearing().toFixed(1)),
    }

    await supabase.from('projects').update({ lng, lat, default_camera: default_camera as any }).eq('id', projectId)
    reload()
  }

  async function handleSaveModelPosition() {
    if (!selectedProject || !modelRotationEdit || !modelCoordsEdit) return
    setSavingRotation(true)
    try {
      const layers = getProjectLayers(selectedForMap ?? selectedProject)
      const idx = activeLayerIndices[selectedProject.id] ?? 0
      const activeL = layers[idx]
      if (activeL?.type === 'model') {
        const origModelLayers = selectedProject.model_layers ?? []
        const updatedLayers = origModelLayers.map((l, i) =>
          i === activeL.originalIndex ? { ...l, rotation: modelRotationEdit, lng: modelCoordsEdit[0], lat: modelCoordsEdit[1] } : l
        )
        await supabase.from('projects').update({ model_layers: updatedLayers as any }).eq('id', selectedProject.id)
        setModelPositionExpanded(false)
        reload()
      }
    } catch (err) {
      console.error('Failed to save position:', err)
    } finally {
      setSavingRotation(false)
    }
  }

  async function handleSaveHiddenBuildings() {
    if (!selectedProject || !hiddenBuildingsEdit) return
    setSavingHiddenBuildings(true)
    try {
      await supabase.from('projects').update({ hidden_building_ids: hiddenBuildingsEdit }).eq('id', selectedProject.id)
      setHideBuildingsExpanded(false)
      setIsSelectingBuildings(false)
      reload()
    } catch (err) {
      console.error('Failed to save hidden buildings:', err)
    } finally {
      setSavingHiddenBuildings(false)
    }
  }

  // Substitute each project's polygon with the active layer's data for map rendering,
  // apply live rotation, coordinate, and hidden buildings overrides during admin adjustments,
  // and filter out hidden layers so MapView and ProjectDetail only render visible layers.
  const projectsForMap = projects.map(p => {
    let visibleModels = (p.model_layers ?? []).filter(l => l.visible !== false)
    if (selectedProject && p.id === selectedProject.id) {
      const layers = getProjectLayers(p)
      const activeIdx = activeLayerIndices[p.id] ?? 0
      const activeLOverride = layers[activeIdx]
      if (activeLOverride?.type === 'model') {
        visibleModels = visibleModels.map((m, mIdx) => {
          if (mIdx !== activeLOverride.originalIndex) return m
          return {
            ...m,
            ...(modelRotationEdit ? { rotation: modelRotationEdit } : {}),
            ...(modelCoordsEdit ? { lng: modelCoordsEdit[0], lat: modelCoordsEdit[1] } : {}),
          }
        })
      }
    }
    const visibleGeojson = (p.geojson_layers ?? []).filter(l => l.visible !== false)
    return {
      ...p,
      geojson_layers: visibleGeojson.length > 0 ? visibleGeojson : null,
      model_layers: visibleModels.length > 0 ? visibleModels : null,
      polygon: getActivePolygon(p, activeLayerIndices[p.id] ?? 0),
      ...(selectedProject && p.id === selectedProject.id && hiddenBuildingsEdit ? { hidden_building_ids: hiddenBuildingsEdit } : {}),
    }
  })

  const selectedForMap = selectedProject
    ? (projectsForMap.find(p => p.id === selectedProject.id) ?? null)
    : null

  // Compute the Three.js custom layer ID for the selected project's active model layer.
  // Matches the ID produced by syncModelLayers: `three-model-${projectId}-${modelIdx}`.
  const activeModelLayerId = (() => {
    if (!selectedProject) return null
    const pForMap = selectedForMap
    const geojsonCount = pForMap?.geojson_layers?.length ?? 0
    const activeIdx = activeLayerIndices[selectedProject.id] ?? 0
    if (activeIdx < geojsonCount) return null
    return `three-model-${selectedProject.id}-${activeIdx - geojsonCount}`
  })()

  function handleModelMaterials(layerId: string, materials: string[]) {
    setModelMaterials(prev => ({ ...prev, [layerId]: materials }))
  }

  function handleMaterialChange(mat: string) {
    if (!activeModelLayerId) return
    setSelectedMaterialByLayer(prev => ({ ...prev, [activeModelLayerId]: mat }))
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          projects={projects}
          loading={loading}
          error={error}
          filters={filters}
          onFiltersChange={setFilters}
          selectedProjectId={selectedProject?.id ?? null}
          onSelectProject={handleSelectProject}
          hoveredProjectId={hoveredProjectId}
          onHoverProject={setHoveredProjectId}
        />
        <div className="flex-1 relative">
          <MapView
            projects={projectsForMap}
            selectedProject={selectedForMap}
            onSelectProject={handleSelectProject}
            flyKey={flyKey}
            activeLayerIndices={activeLayerIndices}
            hoveredProjectId={hoveredProjectId}
            onHoverProject={setHoveredProjectId}
            selectedMaterialByLayer={selectedMaterialByLayer}
            onModelMaterials={handleModelMaterials}
          />
          <MapSettingsPanel />
          <LocationSearchBar />
          {selectedProject && (() => {
            const layers = getProjectLayers(selectedForMap ?? selectedProject)
            const layerUnifiedIdx = activeLayerIndices[selectedProject.id] ?? 0
            const activeL = layers[layerUnifiedIdx]
            const activeCamIdx = activeL
              ? (activeCameraIndices[`${selectedProject.id}:${activeL.originalIndex}`] ?? -1)
              : -1

            // Build carousel layers with cameras array attached
            const carouselLayers = layers.map(l => ({
              name: l.name,
              type: l.type as 'geojson' | 'model',
              cameras: l.cameras ?? [],
            }))

            return (
              <LayerCarousel
                layers={carouselLayers}
                activeLayerIndex={layerUnifiedIdx}
                activeCameraIndex={activeCamIdx}
                onLayerChange={(index, cameraIndex) => handleLayerChange(selectedProject.id, index, cameraIndex)}
                onSaveCamera={isAdmin
                  ? (slot) => handleSaveCamera(selectedProject.id, layerUnifiedIdx, slot)
                  : undefined}
                onSaveProjectView={isAdmin
                  ? () => handleSaveProjectView(selectedProject.id)
                  : undefined}
                onAddCamera={isAdmin
                  ? (name) => handleAddCamera(selectedProject.id, layerUnifiedIdx, name)
                  : undefined}
                onDeleteCamera={isAdmin
                  ? (cameraIndex) => handleDeleteCamera(selectedProject.id, layerUnifiedIdx, cameraIndex)
                  : undefined}
                onRenameCamera={isAdmin
                  ? (cameraIndex, name) => handleRenameCamera(selectedProject.id, layerUnifiedIdx, cameraIndex, name)
                  : undefined}
              />
            )
          })()}
          {isAdmin && selectedProject && (() => {
            const layers = getProjectLayers(selectedForMap ?? selectedProject)
            const idx = activeLayerIndices[selectedProject.id] ?? 0
            const activeL = layers[idx]
            if (activeL?.type !== 'model' || !modelRotationEdit || !modelCoordsEdit || !modelCoordsInput) return null
            const pFresh = projects.find(p => p.id === selectedProject.id) ?? selectedProject

            if (!modelPositionExpanded) {
              return (
                <button
                  onClick={() => setModelPositionExpanded(true)}
                  className="absolute bottom-24 right-3 z-20 flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-lg text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-all hover:scale-105 group"
                  title="Expand 3D model positioning controls"
                >
                  <div className="p-1 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </div>
                  <span>Model Position</span>
                </button>
              )
            }

            return (
              <div className="absolute bottom-24 right-3 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-gray-200 shadow-xl w-72 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Model Position
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                    <button
                      onClick={() => setModelPositionExpanded(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Collapse panel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Coordinates text inputs */}
                  <div className="grid grid-cols-2 gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Latitude</label>
                      <input
                        type="text"
                        value={modelCoordsInput[1]}
                        onChange={e => {
                          const valStr = e.target.value
                          setModelCoordsInput([modelCoordsInput[0], valStr])
                          const parsed = parseFloat(valStr)
                          if (!isNaN(parsed)) {
                            setModelCoordsEdit([modelCoordsEdit[0], parsed])
                          }
                        }}
                        placeholder="48.7758"
                        className="w-full px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Longitude</label>
                      <input
                        type="text"
                        value={modelCoordsInput[0]}
                        onChange={e => {
                          const valStr = e.target.value
                          setModelCoordsInput([valStr, modelCoordsInput[1]])
                          const parsed = parseFloat(valStr)
                          if (!isNaN(parsed)) {
                            setModelCoordsEdit([parsed, modelCoordsEdit[1]])
                          }
                        }}
                        placeholder="9.1829"
                        className="w-full px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Rotation sliders */}
                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1">
                        <span>X (Pitch)</span>
                        <span className="font-mono text-gray-700">{modelRotationEdit[0]}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={modelRotationEdit[0]}
                        onChange={e => setModelRotationEdit([parseFloat(e.target.value), modelRotationEdit[1], modelRotationEdit[2]])}
                        className="w-full accent-indigo-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1">
                        <span>Y (Yaw)</span>
                        <span className="font-mono text-gray-700">{modelRotationEdit[1]}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={modelRotationEdit[1]}
                        onChange={e => setModelRotationEdit([modelRotationEdit[0], parseFloat(e.target.value), modelRotationEdit[2]])}
                        className="w-full accent-indigo-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1">
                        <span>Z (Roll)</span>
                        <span className="font-mono text-gray-700">{modelRotationEdit[2]}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={modelRotationEdit[2]}
                        onChange={e => setModelRotationEdit([modelRotationEdit[0], modelRotationEdit[1], parseFloat(e.target.value)])}
                        className="w-full accent-indigo-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3.5 pt-2.5 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setModelRotationEdit(activeL.rotation ?? [0, 0, 0])
                      const initLng = activeL.lng ?? pFresh.lng
                      const initLat = activeL.lat ?? pFresh.lat
                      setModelCoordsEdit([initLng, initLat])
                      setModelCoordsInput([String(initLng), String(initLat)])
                      setModelPositionExpanded(false)
                    }}
                    disabled={savingRotation}
                    className="flex-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveModelPosition}
                    disabled={savingRotation}
                    className="flex-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg flex items-center justify-center gap-1 shadow-xs"
                  >
                    {savingRotation ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )
          })()}
          {/* Base Buildings Mask Controller */}
          {isAdmin && selectedProject && (() => {
            if (!hideBuildingsExpanded) {
              return (
                <button
                  onClick={() => setHideBuildingsExpanded(true)}
                  className="absolute bottom-36 right-3 z-20 flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-lg text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-all hover:scale-105 group"
                  title="Configure base building masking"
                >
                  <div className="p-1 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h1.5A2.25 2.25 0 0 1 20.25 6m-16.5 9.375V18A2.25 2.25 0 0 0 6 20.25h1.5m9 0h1.5A2.25 2.25 0 0 0 20.25 18v-2.625M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                  </div>
                  <span>Hide Buildings</span>
                  {(hiddenBuildingsEdit?.length ?? 0) > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {hiddenBuildingsEdit?.length}
                    </span>
                  )}
                </button>
              )
            }

            const pFresh = projects.find(p => p.id === selectedProject.id) ?? selectedProject
            const list = hiddenBuildingsEdit ?? []

            return (
              <div className="absolute bottom-36 right-3 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-gray-200 shadow-xl w-72 animate-in fade-in zoom-in-95 duration-200 max-h-[350px] flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2.5 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h1.5A2.25 2.25 0 0 1 20.25 6m-16.5 9.375V18A2.25 2.25 0 0 0 6 20.25h1.5m9 0h1.5A2.25 2.25 0 0 0 20.25 18v-2.625M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                    Hide Buildings
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                    <button
                      onClick={() => {
                        setHideBuildingsExpanded(false)
                        setIsSelectingBuildings(false)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Collapse panel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[80px]">
                  <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-indigo-900 font-medium">
                      {isSelectingBuildings ? 'Click map buildings to hide…' : 'Pick mode inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSelectingBuildings(!isSelectingBuildings)}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                        isSelectingBuildings
                          ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isSelectingBuildings ? 'Stop Picking' : 'Start Picking'}
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-3 italic">No base buildings hidden</p>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase">Hidden Feature IDs</label>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {list.map(idStr => (
                          <span
                            key={idStr}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 text-xs font-mono rounded border border-gray-200 transition-colors group"
                          >
                            <span>{idStr}</span>
                            <button
                              type="button"
                              onClick={() => setHiddenBuildingsEdit(list.filter(item => item !== idStr))}
                              className="text-gray-400 group-hover:text-red-600 p-0.5 hover:bg-red-100 rounded transition-colors"
                              title="Restore building"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 flex-shrink-0">
                  <button
                    onClick={() => {
                      setHiddenBuildingsEdit(pFresh.hidden_building_ids ?? [])
                      setIsSelectingBuildings(false)
                    }}
                    disabled={savingHiddenBuildings}
                    className="flex-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHiddenBuildings}
                    disabled={savingHiddenBuildings}
                    className="flex-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg flex items-center justify-center gap-1 shadow-xs"
                  >
                    {savingHiddenBuildings ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
        {selectedProject && (() => {
          const layerUnifiedIdx = activeLayerIndices[selectedProject.id] ?? 0
          const layers = getProjectLayers(selectedForMap ?? selectedProject)
          const activeL = layers[layerUnifiedIdx]
          const activeCamIdx = activeL
            ? (activeCameraIndices[`${selectedProject.id}:${activeL.originalIndex}`] ?? -1)
            : -1

          return (
            <ProjectDetail
              project={selectedForMap ?? selectedProject}
              onClose={() => setSelectedProject(null)}
              activeLayerIndex={layerUnifiedIdx}
              activeCameraIndex={activeCamIdx}
              onLayerChange={(index, cameraIndex) => handleLayerChange(selectedProject.id, index, cameraIndex)}
              activeMaterials={activeModelLayerId ? (modelMaterials[activeModelLayerId] ?? []) : []}
              selectedMaterial={activeModelLayerId ? (selectedMaterialByLayer[activeModelLayerId] ?? 'all') : 'all'}
              onMaterialChange={handleMaterialChange}
            />
          )
        })()}
      </div>
    </div>
  )
}
