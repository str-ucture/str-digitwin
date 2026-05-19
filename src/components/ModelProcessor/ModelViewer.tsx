import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SceneMetadata } from './types'

export function extractSceneMetadata(gltf: GLTF): SceneMetadata {
  let meshCount = 0, vertexCount = 0, triangleCount = 0
  const materials = new Set<string>()
  const textures = new Set<string>()

  gltf.scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    meshCount++
    const geo = obj.geometry as THREE.BufferGeometry
    const pos = geo.attributes.position
    if (pos) vertexCount += pos.count
    if (geo.index) {
      triangleCount += geo.index.count / 3
    } else if (pos) {
      triangleCount += pos.count / 3
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach(m => {
      if (!m) return
      const mat = m as THREE.Material
      materials.add(mat.uuid)
      const std = mat as THREE.MeshStandardMaterial
      ;[std.map, std.normalMap, std.roughnessMap, std.metalnessMap, std.emissiveMap, std.aoMap]
        .forEach(t => t && textures.add(t.uuid))
    })
  })

  const box = new THREE.Box3().setFromObject(gltf.scene)
  const size = new THREE.Vector3()
  box.getSize(size)

  const jsonTextureCount: number = (gltf.parser as { json?: { textures?: unknown[] } })
    .json?.textures?.length ?? textures.size

  return {
    meshCount,
    vertexCount: Math.round(vertexCount),
    triangleCount: Math.round(triangleCount),
    materialCount: materials.size,
    textureCount: jsonTextureCount,
    boundingBox: box.isEmpty() ? null : {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
      sizeX: size.x,
      sizeY: size.y,
      sizeZ: size.z,
    },
  }
}

type MeshEntry = {
  node: THREE.Mesh
  originalMaterial: THREE.Material | THREE.Material[]
  matName: string
  ancestorUuids: string[]
}

export function getAbsoluteUuid(node: THREE.Object3D): string {
  const userData = node.userData || {}

  // _stableId is stamped before cloning to ensure the original scene and
  // cloned canvas scene resolve to the identical identifier.
  if (userData._stableId && typeof userData._stableId === 'string') {
    return userData._stableId
  }

  const candidateKeys = ['guid', 'GUID', 'uuid', 'UUID', 'id', 'ID', 'elementId', 'element_id', 'gltf_id']
  for (const key of candidateKeys) {
    if (userData[key] && typeof userData[key] === 'string' && userData[key].trim().length > 5) {
      return userData[key].trim()
    }
  }

  if (node.name && typeof node.name === 'string') {
    const name = node.name.trim()
    const isGeneric = /^(scene|rootnode|mesh|group|object|camera|light|dirLight|ambient|grid|helper)/i.test(name)
    if (!isGeneric && name.length > 5) {
      return name
    }
  }

  return node.uuid
}

// Raycasts only on pointerup (not on every pointermove), so R3F never
// registers the GLTF scene as an interactive object and skips per-move
// intersection tests entirely during orbit/pan.
function ClickRaycaster({
  scene,
  onSelectNode,
  mouseDownRef,
}: {
  scene: THREE.Object3D
  onSelectNode?: (uuid: string | null) => void
  mouseDownRef: React.MutableRefObject<{ x: number; y: number } | null>
}) {
  const { camera, raycaster, gl } = useThree()
  const cbRef = useRef(onSelectNode)
  cbRef.current = onSelectNode
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const raycasterRef = useRef(raycaster)
  raycasterRef.current = raycaster

  useEffect(() => {
    const canvas = gl.domElement
    const onPointerUp = (e: PointerEvent) => {
      const down = mouseDownRef.current
      mouseDownRef.current = null
      if (!down) return
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (Math.sqrt(dx * dx + dy * dy) >= 4) return // drag, not a click
      const rect = canvas.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycasterRef.current.setFromCamera(ndc, cameraRef.current)
      const hits = raycasterRef.current.intersectObject(scene, true)
      cbRef.current?.(hits.length > 0 ? getAbsoluteUuid(hits[0].object as THREE.Object3D) : null)
    }
    canvas.addEventListener('pointerup', onPointerUp)
    return () => canvas.removeEventListener('pointerup', onPointerUp)
  }, [gl, scene, mouseDownRef])

  return null
}

function ModelScene({
  url,
  onMetadata,
  onGLTF,
  onSceneParsed,
  selectedType = 'all',
  selectedMaterial = 'all',
  selectedAnimation = null,
  selectedCategories = [],
  uuidToCategoryMap = {},
  selectedNodeUuids = [],
  typeColorMap = {},
  materialColorMap = {},
  categoryColorMap = {},
  onSelectNode,
  mouseDownRef,
  autoZoom = false,
  onZoomTarget,
}: {
  url: string
  onMetadata?: (m: SceneMetadata) => void
  onGLTF?: (gltf: GLTF) => void
  onSceneParsed?: (maxDim: number, centerY: number) => void
  selectedType?: string
  selectedMaterial?: string | string[]
  selectedAnimation?: string | null
  selectedCategories?: string[]
  uuidToCategoryMap?: Record<string, string>
  selectedNodeUuids?: string[]
  typeColorMap?: Record<string, string>
  materialColorMap?: Record<string, string>
  categoryColorMap?: Record<string, string>
  onSelectNode?: (uuid: string | null) => void
  mouseDownRef: React.MutableRefObject<{ x: number; y: number } | null>
  autoZoom?: boolean
  onZoomTarget?: (target: { pos: THREE.Vector3; target: THREE.Vector3 } | null) => void
}) {
  const gltf = useLoader(GLTFLoader, url)
  const { invalidate, gl } = useThree()
  // Single shared ghost material — pre-compiled once, swapped onto faded meshes
  // instead of mutating per-material transparency (which triggers shader recompiles).
  const ghostMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.08,
    color: 0x999999,
    depthWrite: false,
  }), [])
  const calledRef = useRef<GLTF | null>(null)
  // Flat map built once on clone: uuid → { node, cloned mats, matName }
  const meshMapRef = useRef<Map<string, MeshEntry>>(new Map())
  // Tracks which node uuids are currently in faded state
  const fadedUuidsRef = useRef<Set<string>>(new Set())
  // Cache of colored override materials keyed by hex string
  const coloredMatsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map())
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  // Ref mirror so useFrame can read the latest selection without stale closure
  const selectedAnimRef = useRef<string | null>(selectedAnimation)
  selectedAnimRef.current = selectedAnimation

  // Clone scene + materials once; build flat mesh map for O(1) per-node access
  const { scene, groundOffset } = useMemo(() => {
    // useMemo runs BEFORE useEffect (which calls handleGLTFLoaded).
    // Stamp _stableId on every original node HERE so that:
    //   1. clone(true) copies userData → cloned nodes inherit _stableId
    //   2. handleGLTFLoaded (called later in useEffect) reads the same _stableId
    // This guarantees getAbsoluteUuid() returns identical strings in both contexts.
    gltf.scene.traverse(node => {
      if (!node.userData._stableId) {
        const ud = node.userData || {}
        const keys = ['guid', 'GUID', 'uuid', 'UUID', 'id', 'ID', 'elementId', 'element_id', 'gltf_id']
        let stableId = ''
        for (const key of keys) {
          if (ud[key] && typeof ud[key] === 'string' && ud[key].trim().length > 5) {
            stableId = ud[key].trim()
            break
          }
        }
        if (!stableId && node.name) {
          const name = node.name.trim()
          const isGeneric = /^(scene|rootnode|mesh|group|object|camera|light|dirLight|ambient|grid|helper)/i.test(name)
          if (!isGeneric && name.length > 5) stableId = name
        }
        if (!stableId) stableId = node.uuid
        node.userData._stableId = stableId
      }
    })

    const cloned = gltf.scene.clone(true)
    const map = new Map<string, MeshEntry>()

    cloned.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return

      const mats = (
        Array.isArray(node.material) ? node.material : [node.material]
      ).filter(Boolean) as THREE.Material[]

      const matName = mats
        .map(m => (m as THREE.MeshStandardMaterial).name || '(unnamed)')
        .join(', ')

      const absoluteUuid = getAbsoluteUuid(node)
      const ancestorUuids: string[] = []
      let curr = node.parent
      while (curr) {
        ancestorUuids.push(getAbsoluteUuid(curr))
        curr = curr.parent
      }

      map.set(absoluteUuid, { node, originalMaterial: node.material, matName, ancestorUuids })
    })

    meshMapRef.current = map
    fadedUuidsRef.current = new Set()

    // Shift the model so its bottom sits on the grid (Y=0) and it's centered on X/Z
    const box = new THREE.Box3().setFromObject(cloned)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const groundOffset = box.isEmpty()
      ? new THREE.Vector3()
      : new THREE.Vector3(-center.x, -box.min.y, -center.z)

    return { scene: cloned, groundOffset }
  }, [gltf])

  useEffect(() => {
    if (calledRef.current === gltf) return
    calledRef.current = gltf
    const meta = extractSceneMetadata(gltf)
    if (onMetadata) onMetadata(meta)
    if (onGLTF) onGLTF(gltf)

    let maxDim = 3
    let centerY = 0
    if (meta.boundingBox) {
      maxDim = Math.max(meta.boundingBox.sizeX, meta.boundingBox.sizeY, meta.boundingBox.sizeZ)
      centerY = meta.boundingBox.sizeY / 2
    }
    if (onSceneParsed) onSceneParsed(maxDim || 3, centerY)
  }, [gltf, onMetadata, onGLTF, onSceneParsed])

  // Optimized filter: flat map iteration + delta-only material updates
  useEffect(() => {
    const meshMap = meshMapRef.current
    if (!meshMap.size) return

    const hasMatFilter = Array.isArray(selectedMaterial)
      ? selectedMaterial.length > 0
      : selectedMaterial !== 'all'

    const hasCatFilter = selectedCategories.length > 0
    const hasNodeFilter = selectedNodeUuids.length > 0
    const isFiltering = selectedType !== 'all' || hasMatFilter || hasCatFilter || hasNodeFilter

    // Determine which nodes should be faded under the new filter
    const newFadedUuids = new Set<string>()
    if (isFiltering) {
      for (const [uuid, entry] of meshMap.entries()) {
        const { node, matName, ancestorUuids } = entry
        const matchesType = selectedType === 'all' || node.type === selectedType
        const matchesMat = Array.isArray(selectedMaterial)
          ? (selectedMaterial.length === 0 || selectedMaterial.includes(matName))
          : (selectedMaterial === 'all' || matName === selectedMaterial)

        let matchesCategory = true
        if (hasCatFilter) {
          let foundCategory: string | undefined = undefined
          const selfNormUuid = uuid.toLowerCase().replace(/[{}]/g, '')
          const selfCat = uuidToCategoryMap?.[selfNormUuid]
          if (selfCat) {
            foundCategory = selfCat
          } else {
            for (const anc of ancestorUuids) {
              const normUuid = anc.toLowerCase().replace(/[{}]/g, '')
              const cat = uuidToCategoryMap?.[normUuid]
              if (cat) {
                foundCategory = cat
                break
              }
            }
          }
          matchesCategory = foundCategory !== undefined && selectedCategories.includes(foundCategory)
        }

        let matchesSelection = true
        if (hasNodeFilter) {
          const isSelected = selectedNodeUuids.includes(uuid)
          const isAncestorSelected = ancestorUuids.some(anc => selectedNodeUuids.includes(anc))
          matchesSelection = isSelected || isAncestorSelected
        }

        if (!matchesType || !matchesMat || !matchesCategory || !matchesSelection) newFadedUuids.add(uuid)
      }
    }

    // Ghost meshes at 0.08 opacity have visually irrelevant depth order,
    // so skipping the transparent sort saves significant CPU during orbit/pan.
    gl.sortObjects = !isFiltering

    const coloredMats = coloredMatsRef.current

    function getColoredMat(hex: string): THREE.MeshStandardMaterial {
      let mat = coloredMats.get(hex)
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.1 })
        coloredMats.set(hex, mat)
      }
      return mat
    }

    // Resolve the color override for a mesh based on category > material > type priority
    function resolveColorOverride(node: THREE.Mesh, matName: string): string | null {
      // Category color: walk up ancestor chain to find category
      if (Object.keys(categoryColorMap).length > 0) {
        let cur: THREE.Object3D | null = node
        while (cur) {
          const normUuid = getAbsoluteUuid(cur).toLowerCase().replace(/[{}]/g, '')
          const cat = uuidToCategoryMap?.[normUuid]
          if (cat && categoryColorMap[cat]) return categoryColorMap[cat]
          cur = cur.parent
        }
      }
      // Material color
      if (materialColorMap[matName]) return materialColorMap[matName]
      // Type color
      if (typeColorMap[node.type]) return typeColorMap[node.type]
      return null
    }

    const hasColorOverride = Object.keys(typeColorMap).length > 0
      || Object.keys(materialColorMap).length > 0
      || Object.keys(categoryColorMap).length > 0

    // Swap material pointer instead of mutating properties — avoids per-material
    // shader recompiles that occur when transparent/depthWrite flags change.
    for (const [uuid, { node, originalMaterial, matName }] of meshMap) {
      const nowFaded = newFadedUuids.has(uuid)

      let targetMat: THREE.Material | THREE.Material[]
      if (nowFaded) {
        targetMat = ghostMat
      } else if (hasColorOverride) {
        const hex = resolveColorOverride(node, matName)
        targetMat = hex ? getColoredMat(hex) : originalMaterial
      } else {
        targetMat = originalMaterial
      }

      if (node.material !== targetMat) node.material = targetMat
    }

    fadedUuidsRef.current = newFadedUuids
    invalidate()
    return () => { gl.sortObjects = true }
  }, [scene, selectedType, selectedMaterial, selectedCategories, uuidToCategoryMap, selectedNodeUuids, typeColorMap, materialColorMap, categoryColorMap, invalidate, gl, ghostMat])

  // Create a fresh mixer each time the scene changes; clean up on unmount/scene change
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene)
    mixerRef.current = mixer
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
      mixerRef.current = null
    }
  }, [scene])

  // Play or stop the selected animation clip
  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) return
    mixer.stopAllAction()
    if (selectedAnimation) {
      const clip = gltf.animations.find(a => a.name === selectedAnimation)
      if (clip) {
        mixer.clipAction(clip).play()
        invalidate() // kick off the first frame of the self-sustaining loop
      }
    }
  }, [selectedAnimation, gltf, invalidate])

  // Auto Zoom to extents of selected geometries
  useEffect(() => {
    if (!autoZoom || !onZoomTarget) return

    if (selectedNodeUuids.length === 0) {
      // Zoom out to the full scene bounding box
      const box = new THREE.Box3().setFromObject(scene)
      if (!box.isEmpty()) {
        const center = new THREE.Vector3()
        box.getCenter(center)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        const dist = Math.max(maxDim * 1.5, 2.5)
        onZoomTarget({
          pos: new THREE.Vector3(center.x + dist, center.y + dist * 0.8, center.z + dist),
          target: center
        })
      }
      return
    }

    const box = new THREE.Box3()
    let count = 0
    for (const [uuid, entry] of meshMapRef.current.entries()) {
      const isSelected = selectedNodeUuids.includes(uuid)
      const isAncestorSelected = entry.ancestorUuids.some(anc => selectedNodeUuids.includes(anc))

      if (isSelected || isAncestorSelected) {
        const nodeBox = new THREE.Box3().setFromObject(entry.node)
        if (!nodeBox.isEmpty()) {
          box.union(nodeBox)
          count++
        }
      }
    }

    if (count > 0 && !box.isEmpty()) {
      const center = new THREE.Vector3()
      box.getCenter(center)
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const dist = Math.max(maxDim * 1.5, 1.5)
      
      onZoomTarget({
        pos: new THREE.Vector3(
          center.x + dist,
          center.y + dist * 0.8,
          center.z + dist
        ),
        target: center
      })
    }
  }, [selectedNodeUuids, autoZoom, onZoomTarget, scene])

  // Advance the mixer each frame; call invalidate() to sustain the loop while playing
  useFrame((_, delta) => {
    if (mixerRef.current && selectedAnimRef.current) {
      mixerRef.current.update(delta)
      invalidate()
    }
  })

  return (
    <>
      <primitive
        object={scene}
        position={[groundOffset.x, groundOffset.y, groundOffset.z]}
      />
      <ClickRaycaster scene={scene} onSelectNode={onSelectNode} mouseDownRef={mouseDownRef} />
    </>
  )
}

export interface ThreeSettings {
  showGrid: boolean
  gridCellSize: number
  gridColor: string
  gridSectionColor: string
  backgroundColor: string
  ambientIntensity: number
  dirIntensity: number
  autoRotate: boolean
  showGroundPlane: boolean
  groundColor: string
}

const DEFAULT_SETTINGS: ThreeSettings = {
  showGrid: true,
  gridCellSize: 0.5,
  gridColor: '#e2e8f0',
  gridSectionColor: '#cbd5e1',
  backgroundColor: '#f8fafc',
  ambientIntensity: 1.0,
  dirIntensity: 1.5,
  autoRotate: false,
  showGroundPlane: true,
  groundColor: '#f1f5f9',
}

interface Props {
  url: string | null
  onMetadata?: (m: SceneMetadata) => void
  onGLTF?: (gltf: GLTF) => void
  placeholder?: string
  selectedType?: string
  selectedMaterial?: string | string[]
  selectedAnimation?: string | null
  selectedCategories?: string[]
  uuidToCategoryMap?: Record<string, string>
  selectedNodeUuids?: string[]
  typeColorMap?: Record<string, string>
  materialColorMap?: Record<string, string>
  categoryColorMap?: Record<string, string>
  onSelectNode?: (uuid: string | null) => void
  threeSettings?: ThreeSettings
  autoZoom?: boolean
}

export default function ModelViewer({
  url,
  onMetadata,
  onGLTF,
  placeholder,
  selectedType,
  selectedMaterial,
  selectedAnimation,
  selectedCategories = [],
  uuidToCategoryMap = {},
  selectedNodeUuids = [],
  typeColorMap = {},
  materialColorMap = {},
  categoryColorMap = {},
  onSelectNode,
  threeSettings,
  autoZoom = false,
}: Props) {
  const settings = threeSettings || DEFAULT_SETTINGS
  const [transitionTarget, setTransitionTarget] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const maxDimRef = useRef<number>(3)
  const centerYRef = useRef<number>(0)
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null)

  const frameExtents = useCallback(() => {
    const dist = Math.max(maxDimRef.current * 1.5, 2.5)
    setTransitionTarget({
      pos: new THREE.Vector3(dist, dist * 0.8, dist),
      target: new THREE.Vector3(0, centerYRef.current, 0)
    })
  }, [])

  const handleSceneParsed = useCallback((dim: number, centerY: number) => {
    maxDimRef.current = dim
    centerYRef.current = centerY
    setTimeout(() => frameExtents(), 50)
  }, [frameExtents])

  const handleTransitionComplete = useCallback(() => setTransitionTarget(null), [])



  return (
    <div 
      className="w-full h-full min-h-[280px] rounded-xl overflow-hidden border border-gray-200 relative transition-colors duration-200"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      {url && (
        <button
          onClick={frameExtents}
          className="absolute right-3 bottom-3 z-10 px-2.5 py-1.5 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 text-[11px] font-medium rounded-lg shadow border border-gray-200/80 backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer select-none"
          title="Reset camera view to fit the model perfectly"
        >
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Reset View
        </button>
      )}
      {url ? (
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance', antialias: false }}
          camera={{ position: [3, 3, 3], fov: 45 }}
          style={{ width: '100%', height: '100%' }}
          onPointerDown={(e) => {
            mouseDownRef.current = { x: e.clientX, y: e.clientY }
          }}
        >
          <ambientLight intensity={settings.ambientIntensity} />
          <directionalLight position={[10, 10, 5]} intensity={settings.dirIntensity} />
          <directionalLight position={[-5, -5, -5]} intensity={settings.dirIntensity * 0.2} />
          <Suspense fallback={null}>
            <ModelScene
              url={url}
              onMetadata={onMetadata}
              onGLTF={onGLTF}
              onSceneParsed={handleSceneParsed}
              selectedType={selectedType}
              selectedMaterial={selectedMaterial}
              selectedAnimation={selectedAnimation}
              selectedCategories={selectedCategories}
              uuidToCategoryMap={uuidToCategoryMap}
              selectedNodeUuids={selectedNodeUuids}
              typeColorMap={typeColorMap}
              materialColorMap={materialColorMap}
              categoryColorMap={categoryColorMap}
              onSelectNode={onSelectNode}
              mouseDownRef={mouseDownRef}
              autoZoom={autoZoom}
              onZoomTarget={setTransitionTarget}
            />
          </Suspense>
          <CameraTransitionController
            controlsRef={controlsRef}
            transitionTarget={transitionTarget}
            onTransitionComplete={handleTransitionComplete}
          />
          <OrbitControls 
            ref={controlsRef} 
            makeDefault 
            enableDamping={true} 
            dampingFactor={0.15} 
            regress 
            autoRotate={settings.autoRotate}
            autoRotateSpeed={1.5}
          />
          {settings.showGrid && (
            <Grid
              args={[20, 20]}
              cellSize={settings.gridCellSize}
              cellThickness={0.5}
              cellColor={settings.gridColor}
              sectionSize={settings.gridCellSize * 4}
              sectionThickness={1}
              sectionColor={settings.gridSectionColor}
              fadeDistance={25}
              fadeStrength={1}
              infiniteGrid
            />
          )}
          {settings.showGroundPlane && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
              <planeGeometry args={[100, 100]} />
              <meshStandardMaterial color={settings.groundColor} roughness={0.8} metalness={0.1} />
            </mesh>
          )}
        </Canvas>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
          <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <p className="text-xs">{placeholder ?? 'No model loaded'}</p>
        </div>
      )}
    </div>
  )
}

function CameraTransitionController({
  controlsRef,
  transitionTarget,
  onTransitionComplete,
}: {
  controlsRef: React.RefObject<any>
  transitionTarget: { pos: THREE.Vector3; target: THREE.Vector3 } | null
  onTransitionComplete: () => void
}) {
  const { invalidate } = useThree()

  // Gracefully abort camera transition if user manually drags, orbits, or zooms
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !transitionTarget) return

    const handleStart = () => {
      onTransitionComplete()
    }

    controls.addEventListener('start', handleStart)
    return () => {
      controls.removeEventListener('start', handleStart)
    }
  }, [controlsRef, transitionTarget, onTransitionComplete])

  useEffect(() => {
    if (transitionTarget) invalidate()
  }, [transitionTarget, invalidate])

  useFrame((state) => {
    if (!transitionTarget || !controlsRef.current) return

    const controls = controlsRef.current
    const camera = controls.object
    if (!camera) return

    // Smoothly interpolate position and controls target using a fast lerp (0.22 / 22% per frame)
    camera.position.lerp(transitionTarget.pos, 0.22)
    controls.target.lerp(transitionTarget.target, 0.22)
    controls.update()

    // Flag render loop update since OrbitControls regression and demand render loop are active
    state.invalidate()

    // Settle animation when extremely close to the actual targets
    const posDist = camera.position.distanceTo(transitionTarget.pos)
    const targetDist = controls.target.distanceTo(transitionTarget.target)
    if (posDist < 0.005 && targetDist < 0.005) {
      camera.position.copy(transitionTarget.pos)
      controls.target.copy(transitionTarget.target)
      controls.update()
      onTransitionComplete()
    }
  })

  return null
}
