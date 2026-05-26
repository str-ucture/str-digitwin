import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as XLSX from 'xlsx'
import Header from '../components/UI/Header'
import AdminHeader from '../components/Admin/AdminHeader'
import ModelUploader from '../components/ModelProcessor/ModelUploader'
import ModelViewer, { ThreeSettings } from '../components/ModelProcessor/ModelViewer'
import ModelMetadataPanel from '../components/ModelProcessor/ModelMetadataPanel'
import FilterColorModal from '../components/UI/FilterColorModal'
import ConfirmDialog from '../components/Admin/ConfirmDialog'
import { convertFileToGLB, needsConversion } from '../components/ModelProcessor/convertToGLB'
import type { SceneMetadata, FileInfo } from '../components/ModelProcessor/types'
import { BUTTON_STYLES, INPUT_STYLES, PANEL_STYLES, TYPOGRAPHY_STYLES, TAB_STYLES, TABLE_STYLES } from '../styles/designSystem'

export interface SceneItemNode {
  uuid: string
  ancestorUuids: string[]
  name: string
  type: string
  vertices: number
  triangles: number
  materialName: string
  materialType: string
  userDataJson: string
  volume: number
}

type VirtualRow =
  | { kind: 'row'; item: SceneItemNode }
  | { kind: 'expanded'; item: SceneItemNode }

type ConversionState = 'idle' | 'converting' | 'done' | 'error'
type ValueOrientation = 'horizontal' | 'vertical'

type DiagramSettings = {
  showLegend: boolean
  bar: {
    showValueLabels: boolean
    valueOrientation: ValueOrientation
    gapScale: number
    barWidthScale: number
  }
  horizontal: {
    showValueLabels: boolean
    labelWidthPx: number
    rowHeightPx: number
  }
  donut: {
    showCenterTotal: boolean
    ringThickness: number
  }
}

export function getAbsoluteUuid(node: THREE.Object3D): string {
  const userData = node.userData || {}
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

  // Deterministic structural path fallback instead of dynamic node.uuid
  let path = 'node'
  let curr: THREE.Object3D | null = node
  while (curr && curr.parent) {
    const idx = curr.parent.children.indexOf(curr)
    path = `${idx}_${path}`
    curr = curr.parent
  }
  return path
}

export function getMeshVolume(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry
  if (!geometry) return 0

  const positionAttr = geometry.attributes.position
  if (!positionAttr) return 0

  let volume = 0
  const pA = new THREE.Vector3()
  const pB = new THREE.Vector3()
  const pC = new THREE.Vector3()

  const index = geometry.index
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const idxA = index.getX(i)
      const idxB = index.getX(i + 1)
      const idxC = index.getX(i + 2)

      pA.fromBufferAttribute(positionAttr, idxA)
      pB.fromBufferAttribute(positionAttr, idxB)
      pC.fromBufferAttribute(positionAttr, idxC)

      volume += pA.dot(pB.cross(pC)) / 6.0
    }
  } else {
    const limit = Math.floor(positionAttr.count / 3) * 3
    for (let i = 0; i < limit; i += 3) {
      pA.fromBufferAttribute(positionAttr, i)
      pB.fromBufferAttribute(positionAttr, i + 1)
      pC.fromBufferAttribute(positionAttr, i + 2)

      volume += pA.dot(pB.cross(pC)) / 6.0
    }
  }

  mesh.updateMatrixWorld(true)
  const matrix = mesh.matrixWorld
  const e = matrix.elements
  const det =
    e[0] * (e[5] * e[10] - e[9] * e[6]) -
    e[4] * (e[1] * e[10] - e[9] * e[2]) +
    e[8] * (e[1] * e[6] - e[5] * e[2])

  return Math.abs(det) * Math.abs(volume)
}

export default function ModelViewerPage() {
  const defaultDiagramSettings: DiagramSettings = {
    showLegend: true,
    bar: {
      showValueLabels: true,
      valueOrientation: 'horizontal',
      gapScale: 0.8,
      barWidthScale: 1,
    },
    horizontal: {
      showValueLabels: true,
      labelWidthPx: 112,
      rowHeightPx: 32,
    },
    donut: {
      showCenterTotal: true,
      ringThickness: 20,
    },
  }

  const [inputFile, setInputFile] = useState<File | null>(null)
  const [convertedBuffer, setConvertedBuffer] = useState<ArrayBuffer | null>(null)
  const [conversionState, setConversionState] = useState<ConversionState>('idle')
  const [conversionError, setConversionError] = useState<string | null>(null)

  const [sceneMeta, setSceneMeta] = useState<SceneMetadata | null>(null)
  const [items, setItems] = useState<SceneItemNode[]>([])
  const [gltfObj, setGltfObj] = useState<GLTF | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])

  // ThreeJS Viewport customizable settings state
  const [threeSettings, setThreeSettings] = useState<ThreeSettings>({
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
  })
  const [pendingThreeSettings, setPendingThreeSettings] = useState<ThreeSettings>({ ...threeSettings })
  const [threeModalOpen, setThreeModalOpen] = useState(false)

  function handleToggleMaterial(m: string) {
    if (m === 'all') {
      setSelectedMaterials([])
    } else {
      setSelectedMaterials(prev => {
        if (prev.includes(m)) {
          return prev.filter(x => x !== m)
        } else {
          return [...prev, m]
        }
      })
    }
  }
  function handleToggleCategory(c: string) {
    if (c === 'all') {
      setSelectedCategories([])
    } else {
      setSelectedCategories(prev =>
        prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
      )
    }
  }

  const [sortField, setSortField] = useState<'type' | 'name' | 'materialName' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null)
  const [animationNames, setAnimationNames] = useState<string[]>([])
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null)
  const [selectedNodeUuids, setSelectedNodeUuids] = useState<string[]>([])
  const [inspectorTab, setInspectorTab] = useState<'table' | 'analytics'>('table')
  const [diagramMode, setDiagramMode] = useState<'count' | 'volume'>('count')
  const [autoZoom, setAutoZoom] = useState<boolean>(false)
  const [groupByField, setGroupByField] = useState<'type' | 'materialName' | 'category'>('type')
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(false)
  const [includeUnmapped, setIncludeUnmapped] = useState<boolean>(false)
  const [chartType, setChartType] = useState<'bar' | 'horizontal' | 'donut'>('bar')
  const [diagramSettings, setDiagramSettings] = useState<DiagramSettings>(defaultDiagramSettings)
  const [pendingDiagramSettings, setPendingDiagramSettings] = useState<DiagramSettings>(defaultDiagramSettings)
  const [diagramSettingsOpen, setDiagramSettingsOpen] = useState(false)
  const [isDiagramControlsCollapsed, setIsDiagramControlsCollapsed] = useState(false)
  const [diagramSideTab, setDiagramSideTab] = useState<'legend' | 'controls'>('legend')
  const [isInspectorControlsCollapsed, setIsInspectorControlsCollapsed] = useState(false)

  function handleSelectNode(uuid: string | null) {
    if (uuid === null) {
      setSelectedNodeUuids([])
    } else {
      setSelectedNodeUuids(prev =>
        prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
      )
    }
  }

  // Excel overlay state
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  // uuid → {columnName: value} for all non-UUID columns
  const [excelData, setExcelData] = useState<Record<string, Record<string, string>>>({})
  // ordered list of non-UUID column names from the header row
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  // name of the detected UUID column
  const [uuidColumnName, setUuidColumnName] = useState<string>('')
  // columns currently shown in the table (subset of excelHeaders)
  const [visibleExcelColumns, setVisibleExcelColumns] = useState<string[]>([])
  // draft state for the settings panel (before Apply)
  const [pendingColumns, setPendingColumns] = useState<string[]>([])
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
  const [settingsPopoverPos, setSettingsPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)
  // derived category mapping for 3D scene filter
  const [uuidToCategoryMap, setUuidToCategoryMap] = useState<Record<string, string>>({})
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [excelFileName, setExcelFileName] = useState<string>('')
  const [ignoreHeaderToggle, setIgnoreHeaderToggle] = useState<boolean>(false)
  const [categoryColumn, setCategoryColumn] = useState<string>('')
  const [isOverlayCollapsed, setIsOverlayCollapsed] = useState<boolean>(true)

  // Color override maps: dimension value → hex color
  const [typeColorMap, setTypeColorMap] = useState<Record<string, string>>({})
  const [materialColorMap, setMaterialColorMap] = useState<Record<string, string>>({})
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({})
  const [typeLabelMap, setTypeLabelMap] = useState<Record<string, string>>({})
  const [materialLabelMap, setMaterialLabelMap] = useState<Record<string, string>>({})
  const [categoryLabelMap, setCategoryLabelMap] = useState<Record<string, string>>({})
  // Which filter row's color modal is open: null = closed
  type ColorModalTarget = 'type' | 'material' | 'category' | null
  const [colorModalTarget, setColorModalTarget] = useState<ColorModalTarget>(null)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<'model' | 'excel' | null>(null)

  const hasExcelData = Object.keys(excelData).length > 0
  const displayedCols = visibleExcelColumns
  const getDisplayLabel = (field: 'type' | 'materialName' | 'category', raw: string) => {
    if (field === 'type') return typeLabelMap[raw] || raw
    if (field === 'materialName') return materialLabelMap[raw] || raw
    return categoryLabelMap[raw] || raw
  }

  // minmax() prevents fr columns from collapsing when Excel cols push past container width
  const EXCEL_COL_W = 120
  const gridTemplate = hasExcelData && displayedCols.length > 0
    ? `130px minmax(200px,1.2fr) 140px ${displayedCols.map(() => `${EXCEL_COL_W}px`).join(' ')} 90px 90px minmax(260px,1.5fr) 76px`
    : '130px minmax(200px,1.2fr) 140px 90px 90px minmax(260px,1.5fr) 76px'

  // minimum pixel total; triggers horizontal scroll before fr columns collapse
  const tableMinWidth = 130 + 200 + 140 + (hasExcelData ? displayedCols.length * EXCEL_COL_W : 0) + 90 + 90 + 260 + 76

  function handleClearExcel() {
    setWorkbook(null)
    setSelectedSheet('')
    setExcelData({})
    setExcelHeaders([])
    setUuidColumnName('')
    setVisibleExcelColumns([])
    setPendingColumns([])
    setColumnSettingsOpen(false)
    setUuidToCategoryMap({})
    setSelectedCategories([])
    setExcelFileName('')
    setIgnoreHeaderToggle(false)
    setCategoryColumn('')
    if (excelInputRef.current) {
      excelInputRef.current.value = ''
    }
  }

  function applyColumnAsCategory(col: string, data: Record<string, Record<string, string>>) {
    const mapping: Record<string, string> = {}
    const uniqueCats = new Set<string>()
    for (const [normUuid, rowData] of Object.entries(data)) {
      const cat = rowData[col]
      if (cat) {
        mapping[normUuid] = cat
        uniqueCats.add(cat)
      }
    }
    setCategoryColumn(col)
    setUuidToCategoryMap(mapping)
    setSelectedCategories([])
  }

  const processSheet = (wb: XLSX.WorkBook, sheetName: string, ignoreHeader: boolean = ignoreHeaderToggle) => {
    setSelectedSheet(sheetName)
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })
    if (rows.length === 0) return

    let uuidColIdx = 0
    let detectedUuidColName = 'Column 1'
    const colIndexToName = new Map<number, string>()
    const orderedColNames: string[] = []

    if (!ignoreHeader && rows[0] && rows[0].length > 0) {
      // Scan header row to find UUID column by keyword matching
      const uuidKeywords = [
        'absolute uuid', 'absoluteuuid', 'absolute_uuid',
        'uuid', 'guid', 'id', 'element_id', 'elementid', 'elementguid',
      ]
      let foundUuid = false
      for (let c = 0; c < rows[0].length; c++) {
        const val = String(rows[0][c] || '').trim().toLowerCase()
        if (uuidKeywords.some(kw => val === kw || val.includes(kw))) {
          uuidColIdx = c
          detectedUuidColName = String(rows[0][c]).trim()
          foundUuid = true
          break
        }
      }
      if (!foundUuid) {
        uuidColIdx = 0
        detectedUuidColName = String(rows[0][0] || 'Column 1').trim()
      }

      // Build ordered map of column index → name for all non-UUID columns with uniqueness safety
      const seenNames = new Set<string>()
      for (let c = 0; c < rows[0].length; c++) {
        if (c !== uuidColIdx) {
          const rawName = String(rows[0][c] || '').trim()
          const baseName = rawName || `Column ${c + 1}`
          
          let name = baseName
          let suffix = 1
          while (seenNames.has(name.toLowerCase())) {
            name = `${baseName} (${suffix})`
            suffix++
          }
          seenNames.add(name.toLowerCase())
          
          colIndexToName.set(c, name)
          orderedColNames.push(name)
        }
      }
    } else {
      // No header row: col 0 is UUID, generate names for the rest
      uuidColIdx = 0
      detectedUuidColName = 'Column 1'
      const sampleRow = rows[0]
      if (sampleRow) {
        for (let c = 1; c < sampleRow.length; c++) {
          const name = `Column ${c + 1}`
          colIndexToName.set(c, name)
          orderedColNames.push(name)
        }
      }
    }

    // Build data map: normalised uuid → {colName: cellValue}
    const data: Record<string, Record<string, string>> = {}
    const startRow = ignoreHeader ? 0 : 1

    for (let rowIdx = startRow; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      if (!row) continue
      const rawUuid = String(row[uuidColIdx] ?? '').trim()
      if (!rawUuid || rawUuid === 'undefined') continue
      const normUuid = rawUuid.toLowerCase().replace(/[{}]/g, '')
      const rowData: Record<string, string> = {}
      for (const [colIdx, colName] of colIndexToName) {
        rowData[colName] = String(row[colIdx] ?? '').trim()
      }
      data[normUuid] = rowData
    }

    setExcelData(data)
    setExcelHeaders(orderedColNames)
    setUuidColumnName(detectedUuidColName)
    setVisibleExcelColumns(orderedColNames)
    setPendingColumns(orderedColNames)

    // Auto-detect category column; user can change it afterwards via the picker
    const autocat =
      orderedColNames.find(h => {
        const hl = h.toLowerCase()
        return hl.includes('category') || hl.includes('group') || hl.includes('class') || hl.includes('type')
      }) ?? orderedColNames[0] ?? ''

    if (autocat) applyColumnAsCategory(autocat, data)
  }

  const handleToggleIgnoreHeader = (newValue: boolean) => {
    setIgnoreHeaderToggle(newValue)
    if (workbook) {
      processSheet(workbook, selectedSheet || workbook.SheetNames[0] || '', newValue)
    }
  }

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear old state completely first to guarantee a clean slate and no residuals
    setWorkbook(null)
    setSelectedSheet('')
    setExcelData({})
    setExcelHeaders([])
    setUuidColumnName('')
    setVisibleExcelColumns([])
    setPendingColumns([])
    setColumnSettingsOpen(false)
    setUuidToCategoryMap({})
    setSelectedCategories([])
    setExcelFileName('')
    setIgnoreHeaderToggle(false)
    setCategoryColumn('')

    setExcelFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        setWorkbook(wb)
        if (wb.SheetNames.length > 0) {
          processSheet(wb, wb.SheetNames[0], ignoreHeaderToggle)
        }
      } catch (err) {
        console.error('Error parsing Excel file:', err)
        alert('Failed to parse Excel file. Please ensure it is a valid spreadsheet.')
        handleClearExcel()
      }
    }
    reader.readAsArrayBuffer(file)
    // Clear HTML file input so that re-uploading the same file always triggers onChange
    e.target.value = ''
  }

  const handleExportCSV = () => {
    if (filteredAndSortedItems.length === 0) return

    const excelColHeaders = displayedCols

    const headers = [
      'Taxonomy',
      'Node Label',
      'Absolute UUID',
      ...excelColHeaders,
      'Vertices',
      'Triangles',
      'Material Name',
      'Material Type',
      'UserData',
    ]

    const csvContent = [
      headers.join(','),
      ...filteredAndSortedItems.map(item => {
        const normUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
        const itemExcelData = excelData[normUuid] || {}
        const row = [
          item.type,
          item.name,
          item.uuid,
          ...excelColHeaders.map(col => itemExcelData[col] || ''),
          item.vertices,
          item.triangles,
          item.materialName,
          item.materialType,
          item.userDataJson,
        ]
        return row.map(val => {
          if (val == null) return '""'
          const str = String(val).replace(/"/g, '""')
          return `"${str}"`
        }).join(',')
      }),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_')
    link.setAttribute('download', `model_nodes_export_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const [isExportingGLB, setIsExportingGLB] = useState(false)

  const handleExportGLBWithUUIDs = async () => {
    if (!gltfObj) {
      alert('No active 3D model loaded to export.')
      return
    }

    setIsExportingGLB(true)
    try {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
      const exporter = new GLTFExporter()

      // Clone scene to avoid mutating the live active viewport's scene state directly
      const exportScene = gltfObj.scene.clone(true)

      // Traverse cloned scene and assign stable UUIDs
      exportScene.traverse((node) => {
        if (!node.userData) node.userData = {}

        // Check if there is already an existing GUID or UUID
        const candidateKeys = ['guid', 'GUID', 'uuid', 'UUID', 'id', 'ID', 'elementId', 'element_id', 'gltf_id']
        let stableId = node.userData._stableId || ''
        if (!stableId) {
          for (const key of candidateKeys) {
            if (node.userData[key] && typeof node.userData[key] === 'string' && node.userData[key].trim().length > 5) {
              stableId = node.userData[key].trim()
              break
            }
          }
        }

        // If no stable ID exists, generate a persistent random UUID!
        if (!stableId) {
          stableId = THREE.MathUtils.generateUUID()
        }

        // Stamp it permanently into the glb userData!
        node.userData._stableId = stableId
        node.userData.uuid = stableId
      })

      // Parse and export as a binary GLB file
      exporter.parse(
        exportScene,
        (result) => {
          const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const originalName = inputFile?.name ? inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) : 'model'
          link.setAttribute('download', `${originalName}_with_uuids.glb`)
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          setIsExportingGLB(false)

          // Additionally stamp them onto the active scene so they immediately show up in the table
          // without needing a refresh!
          gltfObj.scene.traverse((node) => {
            if (!node.userData) node.userData = {}
            const candidateKeys = ['guid', 'GUID', 'uuid', 'UUID', 'id', 'ID', 'elementId', 'element_id', 'gltf_id']
            let stableId = node.userData._stableId || ''
            if (!stableId) {
              for (const key of candidateKeys) {
                if (node.userData[key] && typeof node.userData[key] === 'string' && node.userData[key].trim().length > 5) {
                  stableId = node.userData[key].trim()
                  break
                }
              }
            }
            if (!stableId) stableId = THREE.MathUtils.generateUUID()
            node.userData._stableId = stableId
            node.userData.uuid = stableId
          })
          handleGLTFLoaded(gltfObj)

          alert('GLB successfully exported with permanent UUIDs injected!')
        },
        (error) => {
          console.error('Error exporting GLB:', error)
          alert('Failed to export GLB file.')
          setIsExportingGLB(false)
        },
        {
          binary: true,
          animations: gltfObj.animations || [],
          truncateDrawRange: false,
        }
      )
    } catch (err) {
      console.error('Failed to export GLB:', err)
      alert('Failed to initialize GLB exporter.')
      setIsExportingGLB(false)
    }
  }

  // Deferred search prevents the filter from blocking keypresses
  const deferredSearch = useDeferredValue(searchQuery)
  const isSearchStale = deferredSearch !== searchQuery

  const tableParentRef = useRef<HTMLDivElement>(null)

  // Derive stable Blob URL for loaded buffer
  const modelUrl = useMemo(() => {
    if (!convertedBuffer) return null
    const blob = new Blob([convertedBuffer], { type: 'model/gltf-binary' })
    return URL.createObjectURL(blob)
  }, [convertedBuffer])

  useEffect(() => {
    return () => { if (modelUrl) URL.revokeObjectURL(modelUrl) }
  }, [modelUrl])

  async function handleNewFile(file: File, textureFiles: File[] = []) {
    setInputFile(file)
    setSceneMeta(null)
    setItems([])
    setGltfObj(null)
    setConvertedBuffer(null)
    setConversionError(null)
    setExpandedUuid(null)
    setAnimationNames([])
    setSelectedAnimation(null)
    setSelectedNodeUuids([])
    handleClearExcel()

    if (!needsConversion(file)) {
      setConversionState('done')
      const buf = await file.arrayBuffer()
      setConvertedBuffer(buf)
      return
    }

    setConversionState('converting')
    try {
      const glb = await convertFileToGLB(file, textureFiles)
      setConvertedBuffer(glb)
      setConversionState('done')
    } catch (e) {
      setConversionError(e instanceof Error ? e.message : 'File parsing failed')
      setConversionState('error')
    }
  }

  function handleClear() {
    setInputFile(null)
    setConvertedBuffer(null)
    setConversionState('idle')
    setConversionError(null)
    setSceneMeta(null)
    setItems([])
    setGltfObj(null)
    setExpandedUuid(null)
    setAnimationNames([])
    setSelectedAnimation(null)
    setSelectedNodeUuids([])
    handleClearExcel()
  }

  function handleGLTFLoaded(gltf: GLTF) {
    const list: SceneItemNode[] = []
    gltf.scene.traverse((node) => {
      let vertices = 0
      let triangles = 0
      let materialName = '-'
      let materialType = '-'

      let volume = 0

      if (node instanceof THREE.Mesh) {
        const geo = node.geometry as THREE.BufferGeometry
        const pos = geo?.attributes?.position
        if (pos) {
          vertices = pos.count
          if (geo.index) {
            triangles = Math.round(geo.index.count / 3)
          } else {
            triangles = Math.round(pos.count / 3)
          }
        }

        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material]
          materialName = mats.map(m => m?.name || '(unnamed)').join(', ')
          materialType = mats.map(m => m?.type.replace('Material', '')).join(', ')
        }

        volume = getMeshVolume(node)
      }

      const udKeys = node.userData ? Object.keys(node.userData).filter(k => k !== '_stableId') : []
      const userDataJson = udKeys.length > 0 ? JSON.stringify(
        Object.fromEntries(udKeys.map(k => [k, node.userData[k]])), null, 2
      ) : ''

      const absoluteUuid = getAbsoluteUuid(node)

      const ancestorUuids: string[] = []
      let curr = node.parent
      while (curr) {
        ancestorUuids.push(getAbsoluteUuid(curr))
        curr = curr.parent
      }

      list.push({
        uuid: absoluteUuid,
        ancestorUuids,
        name: node.name || '(unnamed)',
        type: node.type || 'Object3D',
        vertices,
        triangles,
        materialName,
        materialType,
        userDataJson,
        volume,
      })
    })
    setItems(list)
    setGltfObj(gltf)
    setAnimationNames(gltf.animations.map(a => a.name))
    setSelectedAnimation(null)
  }

  const fallbackCopyToClipboard = (text: string, id: string) => {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    } catch (err) {
      console.error('Fallback copy failed', err)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedId(id)
          setTimeout(() => setCopiedId(null), 2000)
        })
        .catch(() => {
          fallbackCopyToClipboard(text, id)
        })
    } else {
      fallbackCopyToClipboard(text, id)
    }
  }

  const fileInfo: FileInfo | null = inputFile
    ? {
        name: inputFile.name,
        format: (inputFile.name.split('.').pop() ?? '').toLowerCase(),
        sizeBytes: inputFile.size,
      }
    : null

  function handleSort(field: 'type' | 'name' | 'materialName') {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortField(null)
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const availableTypes = useMemo(() => {
    const types = new Set<string>()
    items.forEach(item => types.add(item.type))
    return ['all', ...Array.from(types)]
  }, [items])

  const availableMaterials = useMemo(() => {
    const mats = new Set<string>()
    items.forEach(item => {
      if (item.materialName && item.materialName !== '-') {
        mats.add(item.materialName)
      }
    })
    return ['all', ...Array.from(mats)]
  }, [items])

  const availableCategories = useMemo(() => {
    if (Object.keys(uuidToCategoryMap).length === 0) return []
    const cats = new Set<string>()
    items.forEach(item => {
      const normUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
      let cat = uuidToCategoryMap[normUuid]
      if (!cat) {
        for (const ancUuid of item.ancestorUuids) {
          const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
          if (uuidToCategoryMap[normAncUuid]) {
            cat = uuidToCategoryMap[normAncUuid]
            break
          }
        }
      }
      if (cat) cats.add(cat)
    })
    return cats.size > 0 ? ['all', ...Array.from(cats).sort()] : []
  }, [items, uuidToCategoryMap])

  const filteredAndSortedItems = useMemo(() => {
    const filtered = items.filter(item => {
      const matchesType = selectedType === 'all' || item.type === selectedType
      const matchesMat = selectedMaterials.length === 0 || selectedMaterials.includes(item.materialName)

      let matchesCategory = true
      if (selectedCategories.length > 0) {
        const normUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
        let cat = uuidToCategoryMap?.[normUuid]
        if (!cat) {
          for (const ancUuid of item.ancestorUuids) {
            const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
            if (uuidToCategoryMap?.[normAncUuid]) {
              cat = uuidToCategoryMap?.[normAncUuid]
              break
            }
          }
        }
        matchesCategory = cat !== undefined && selectedCategories.includes(cat)
      }

      let matchesSelection = true
      if (selectedNodeUuids.length > 0) {
        matchesSelection = selectedNodeUuids.some(uid => uid === item.uuid || item.ancestorUuids.includes(uid))
      }

      const normItemUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
      let catText = uuidToCategoryMap?.[normItemUuid] || ''
      if (!catText) {
        for (const ancUuid of item.ancestorUuids) {
          const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
          if (uuidToCategoryMap?.[normAncUuid]) {
            catText = uuidToCategoryMap?.[normAncUuid]
            break
          }
        }
      }

      // Also search across all excel columns
      const excelText = hasExcelData
        ? Object.values(excelData[normItemUuid] || {}).join(' ')
        : ''

      const q = deferredSearch.toLowerCase()
      const matchesQuery = !q || (
        item.name.toLowerCase().includes(q) ||
        item.uuid.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.userDataJson.toLowerCase().includes(q) ||
        item.materialName.toLowerCase().includes(q) ||
        catText.toLowerCase().includes(q) ||
        excelText.toLowerCase().includes(q)
      )
      return matchesType && matchesMat && matchesCategory && matchesSelection && matchesQuery
    })

    if (!sortField) return filtered

    return [...filtered].sort((a, b) => {
      let valA = a[sortField] || ''
      let valB = b[sortField] || ''
      if (valA === '-') valA = ''
      if (valB === '-') valB = ''
      const cmp = valA.localeCompare(valB)
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [items, selectedType, selectedMaterials, selectedCategories, uuidToCategoryMap, selectedNodeUuids, deferredSearch, sortField, sortOrder, excelData, hasExcelData])

  const chartFilteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesType = selectedType === 'all' || item.type === selectedType
      const matchesMat = selectedMaterials.length === 0 || selectedMaterials.includes(item.materialName)

      let matchesCategory = true
      if (selectedCategories.length > 0) {
        const normUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
        let cat = uuidToCategoryMap?.[normUuid]
        if (!cat) {
          for (const ancUuid of item.ancestorUuids) {
            const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
            if (uuidToCategoryMap?.[normAncUuid]) {
              cat = uuidToCategoryMap?.[normAncUuid]
              break
            }
          }
        }
        matchesCategory = cat !== undefined && selectedCategories.includes(cat)
      }

      const normItemUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
      let catText = uuidToCategoryMap?.[normItemUuid] || ''
      if (!catText) {
        for (const ancUuid of item.ancestorUuids) {
          const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
          if (uuidToCategoryMap?.[normAncUuid]) {
            catText = uuidToCategoryMap?.[normAncUuid]
            break
          }
        }
      }

      const excelText = hasExcelData
        ? Object.values(excelData[normItemUuid] || {}).join(' ')
        : ''

      const q = deferredSearch.toLowerCase()
      const matchesQuery = !q || (
        item.name.toLowerCase().includes(q) ||
        item.uuid.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.userDataJson.toLowerCase().includes(q) ||
        item.materialName.toLowerCase().includes(q) ||
        catText.toLowerCase().includes(q) ||
        excelText.toLowerCase().includes(q)
      )
      return matchesType && matchesMat && matchesCategory && matchesQuery
    })
  }, [items, selectedType, selectedMaterials, selectedCategories, uuidToCategoryMap, deferredSearch, excelData, hasExcelData])

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    const volumes: Record<string, number> = {}
    
    chartFilteredItems.forEach(item => {
      let key = ''
      if (groupByField === 'type') {
        key = item.type || '-'
      } else if (groupByField === 'materialName') {
        key = item.materialName || '-'
      } else if (groupByField === 'category') {
        const normItemUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
        let catText = uuidToCategoryMap?.[normItemUuid] || ''
        if (!catText) {
          for (const ancUuid of item.ancestorUuids) {
            const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
            if (uuidToCategoryMap?.[normAncUuid]) {
              catText = uuidToCategoryMap?.[normAncUuid]
              break
            }
          }
        }
        key = catText || 'Unmapped'
      }

      // Normalize empty/blank spaces to standard '-'
      if (key === '' || key === ' ' || key === 'undefined' || key === 'null') {
        key = '-'
      }

      const isEmpty = key === '-' || key === '(unnamed)'
      const isUnmapped = key === 'Unmapped' || key === 'Unknown' || key === 'No Material'

      if (isEmpty && !includeEmpty) {
        return
      }
      if (isUnmapped && !includeUnmapped) {
        return
      }

      counts[key] = (counts[key] || 0) + 1
      volumes[key] = (volumes[key] || 0) + (item.volume || 0)
    })

    if (diagramMode === 'volume') {
      return Object.entries(volumes)
        .map(([name, volume]) => ({ name, count: volume }))
        .sort((a, b) => b.count - a.count)
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [chartFilteredItems, groupByField, uuidToCategoryMap, includeEmpty, includeUnmapped, diagramMode])

  const virtualFlatRows = useMemo<VirtualRow[]>(() => {
    const result: VirtualRow[] = []
    for (const item of filteredAndSortedItems) {
      result.push({ kind: 'row', item })
      if (expandedUuid === item.uuid && item.userDataJson) {
        result.push({ kind: 'expanded', item })
      }
    }
    return result
  }, [filteredAndSortedItems, expandedUuid])

  const rowVirtualizer = useVirtualizer({
    count: virtualFlatRows.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: i => virtualFlatRows[i]?.kind === 'expanded' ? 200 : 48,
    overscan: 12,
  })

  const isConverting = conversionState === 'converting'

  // Close column-settings popover when clicking outside
  useEffect(() => {
    if (!columnSettingsOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        settingsBtnRef.current?.contains(target) ||
        document.getElementById('col-settings-popover')?.contains(target)
      ) return
      setColumnSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [columnSettingsOpen])

  return (
    <>
    <div className="h-screen max-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <AdminHeader activeTab="viewer" />

      <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* Left panel */}
        <div className="xl:col-span-5 flex flex-col gap-4 min-h-0 overflow-hidden pr-1">
          <div className="flex items-center justify-between flex-shrink-0 h-7">
            <h2 className={TYPOGRAPHY_STYLES.sectionHeader}>Source</h2>
            {inputFile && (
              <div className="flex items-center gap-2">
                <button onClick={() => setDeleteConfirmTarget('model')} className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors">
                  Upload different file
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button
                  onClick={() => setDeleteConfirmTarget('model')}
                  className={BUTTON_STYLES.iconDestructive + " !p-1.5 !w-6 !h-6 flex items-center justify-center"}
                  title="Unload model file"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {!inputFile ? (
            <div className="flex-1 min-h-[256px] sm:min-h-[288px] bg-white rounded-2xl p-2 border border-gray-200 shadow-sm flex flex-col">
              <ModelUploader onFile={(m, t) => handleNewFile(m, t)} />
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {conversionState === 'error' && conversionError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-xs font-medium text-red-700">File structure unreadable</p>
                  <p className="text-xs text-red-500 mt-1">{conversionError}</p>
                </div>
              )}

              {conversionState === 'done' && (
                <div className="flex-1 min-h-[256px] sm:min-h-[288px] rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white relative group">
                  {/* Viewport Settings Button */}
                  <button
                    onClick={() => {
                      setPendingThreeSettings({ ...threeSettings })
                      setThreeModalOpen(true)
                    }}
                    className="absolute top-3 right-3 z-10 p-1.5 bg-white/90 hover:bg-white text-gray-500 hover:text-gray-900 rounded-lg shadow border border-gray-200/80 backdrop-blur-sm transition-all duration-200 cursor-pointer flex items-center justify-center opacity-90 hover:opacity-100"
                    title="Customize 3D Viewport Styling"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <ModelViewer
                    url={modelUrl}
                    onMetadata={m => setSceneMeta(m)}
                    onGLTF={handleGLTFLoaded}
                    placeholder="Parsing node map..."
                    selectedType={selectedType}
                    selectedMaterial={selectedMaterials}
                    selectedAnimation={selectedAnimation}
                    selectedCategories={selectedCategories}
                    uuidToCategoryMap={uuidToCategoryMap}
                    selectedNodeUuids={selectedNodeUuids}
                    typeColorMap={typeColorMap}
                    materialColorMap={materialColorMap}
                    categoryColorMap={categoryColorMap}
                    onSelectNode={handleSelectNode}
                    threeSettings={threeSettings}
                    autoZoom={autoZoom}
                  />
                </div>
              )}

              {isConverting && (
                <div className="flex-1 min-h-[256px] sm:min-h-[288px] rounded-2xl border border-dashed border-amber-200 bg-amber-50 flex flex-col items-center justify-center gap-3">
                  <svg className="w-6 h-6 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-xs text-amber-700 font-medium">Standardizing multi-format structure binary...</p>
                </div>
              )}
            </div>
          )}

          {/* Data Overlay Card */}
          <div className={`rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-2 flex-shrink-0 transition-all duration-200 ${
            isOverlayCollapsed ? '' : 'h-auto'
          }`}>
            {/* Header row */}
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsOverlayCollapsed(!isOverlayCollapsed)}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-700">Data Overlay</span>
              </div>
              <button
                type="button"
                className="w-5 h-5 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOverlayCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            </div>

            {!isOverlayCollapsed && (
              <div className="flex flex-col gap-2 flex-1 min-h-0 mt-1">
                {/* Actions row inside expanded body */}
                <div className="flex items-center justify-between flex-shrink-0 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-gray-400 select-none">Include Header</span>
                    <button
                      type="button"
                      onClick={() => handleToggleIgnoreHeader(!ignoreHeaderToggle)}
                      className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        ignoreHeaderToggle ? 'bg-emerald-500' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={ignoreHeaderToggle}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          ignoreHeaderToggle ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {excelFileName && excelHeaders.length > 0 && (
                    <button
                      ref={settingsBtnRef}
                      onClick={() => {
                        if (!columnSettingsOpen) {
                          setPendingColumns([...visibleExcelColumns])
                          const rect = settingsBtnRef.current?.getBoundingClientRect()
                          if (rect) setSettingsPopoverPos({ top: rect.bottom + 6, left: rect.left })
                        }
                        setColumnSettingsOpen(prev => !prev)
                      }}
                      className={`w-6 h-6 rounded hover:bg-gray-50 flex items-center justify-center transition-colors flex-shrink-0 border border-gray-200/60 shadow-sm ${
                        columnSettingsOpen
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Configure visible columns"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                  )}
                </div>

                {!excelFileName ? (
                  <div className="border border-dashed border-gray-200 hover:border-emerald-400 rounded-lg p-2 transition-colors text-center relative cursor-pointer group bg-gray-50/50 hover:bg-emerald-50/10 flex flex-col justify-center items-center h-[92px] flex-shrink-0">
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 mx-auto mb-1.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors">Upload Excel / CSV Map</p>
                    <p className="text-xs text-gray-400 mt-1 leading-snug">First row: headers — UUID column auto-detected</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {/* File status block */}
                    <div className="flex items-center gap-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg px-2.5 py-1 flex-shrink-0">
                      <div className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold font-mono flex-shrink-0">
                        X
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-emerald-800 truncate">{excelFileName}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">
                          {Object.keys(excelData).length} rows · {excelHeaders.length} columns
                          {uuidColumnName ? ` · UUID: "${uuidColumnName}"` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteConfirmTarget('excel')}
                        className="w-5 h-5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition-colors flex-shrink-0"
                        title="Remove Excel mapping"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Category column picker */}
                    {excelHeaders.length > 0 && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-semibold text-gray-500 shrink-0">Filter by:</span>
                        <select
                          value={categoryColumn}
                          onChange={e => applyColumnAsCategory(e.target.value, excelData)}
                          className="text-[10px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 max-w-[160px] truncate"
                        >
                          {visibleExcelColumns.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => applyColumnAsCategory(categoryColumn, excelData)}
                          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm border border-transparent hover:border-emerald-200"
                          title="Force Refresh Data Mapping"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Column summary */}
                    {excelHeaders.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {excelHeaders.slice(0, 5).map(h => (
                          <span key={h} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            visibleExcelColumns.includes(h)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-400 line-through'
                          }`}>
                            {h}
                          </span>
                        ))}
                        {excelHeaders.length > 5 && (
                          <span className="text-[10px] text-gray-400">+{excelHeaders.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model Metadata Panel */}
          <ModelMetadataPanel
            file={fileInfo}
            scene={sceneMeta}
            loading={!!inputFile && !sceneMeta}
          />
        </div>

        {/* Right panel: Node Inspector Table */}
        <div className="xl:col-span-7 flex flex-col gap-4 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between flex-shrink-0 h-7">
            <h2 className={TYPOGRAPHY_STYLES.sectionHeader}>Node Inspector</h2>
          </div>
          
          {/* Top Component: Controls & Filters Box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-shrink-0">
            <div
              className="px-6 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsInspectorControlsCollapsed(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <span className={TYPOGRAPHY_STYLES.sectionHeader + ' !text-xs'}>Data Overlay & File Metadata Filters</span>
              </div>
              <button
                type="button"
                className="w-5 h-5 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isInspectorControlsCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            </div>
            {!isInspectorControlsCollapsed && (
            <div className="px-6 py-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-auto max-h-24 pb-1 sm:pb-0">
                  <button
                    onClick={() => setColorModalTarget('type')}
                    className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                    title="Color settings for Taxonomy"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                  </button>
                  <span className={TYPOGRAPHY_STYLES.label + ' mr-1'}>Taxonomy</span>
                  {availableTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={selectedType === t ? TAB_STYLES.filterActive : TAB_STYLES.filterInactive}
                      title={t === 'all' ? 'All' : t}
                    >
                      {t === 'all' ? 'All' : getDisplayLabel('type', t)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  {items.length > 0 && (
                    <>
                      <button
                        onClick={handleExportGLBWithUUIDs}
                        disabled={isExportingGLB}
                        className={BUTTON_STYLES.info + " " + (isExportingGLB ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer')}
                        title="Download GLB with stable UUIDs embedded on each node"
                      >
                        {isExportingGLB ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-blue-750" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>GLB</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleExportCSV}
                        className={BUTTON_STYLES.successSubtle}
                        title="Download the currently filtered node table as CSV"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span>CSV</span>
                      </button>
                    </>
                  )}

                  <div className="relative w-full sm:w-60">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search UUID, name, custom data..."
                      className={INPUT_STYLES.search + " !py-1.5 !text-xs !bg-gray-50 hover:!bg-white focus:!bg-white " + (isSearchStale ? 'opacity-70' : '')}
                      disabled={items.length === 0}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Material selector row */}
              {availableMaterials.length > 2 && (
                <div className="flex items-center gap-2 overflow-auto max-h-24 pt-1 border-t border-gray-50/80">
                  <button
                    onClick={() => setColorModalTarget('material')}
                    className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                    title="Color settings for Material"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                  </button>
                  <span className={TYPOGRAPHY_STYLES.label + ' mr-1'}>Material</span>
                  {availableMaterials.map(m => {
                    const isActive = m === 'all'
                      ? selectedMaterials.length === 0
                      : selectedMaterials.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => handleToggleMaterial(m)}
                        className={isActive ? TAB_STYLES.filterActive : TAB_STYLES.filterInactive}
                        title={m === 'all' ? 'All Materials' : getDisplayLabel('materialName', m)}
                      >
                        {m === 'all' ? 'All' : getDisplayLabel('materialName', m)}
                      </button>
                    )
                  })}
                  {selectedMaterials.length > 0 && (
                    <button
                      onClick={() => setSelectedMaterials([])}
                      className="px-2 py-0.5 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer animate-in fade-in zoom-in-95 duration-150"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}

              {/* Category filter row */}
              {availableCategories.length > 1 && (
                <div className="flex items-center gap-2 overflow-auto max-h-24 pt-1 border-t border-gray-50/80 animate-in fade-in duration-200">
                  <button
                    onClick={() => setColorModalTarget('category')}
                    className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                    title={`Color settings for ${categoryColumn || 'Category'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                  </button>
                  <span className={TYPOGRAPHY_STYLES.label + ' mr-1 shrink-0'}>{categoryColumn || 'Category'}</span>
                  {availableCategories.map(c => {
                    const isActive = c === 'all'
                      ? selectedCategories.length === 0
                      : selectedCategories.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => handleToggleCategory(c)}
                        className={isActive ? TAB_STYLES.filterActiveEmerald : TAB_STYLES.filterInactive}
                        title={c === 'all' ? 'All' : getDisplayLabel('category', c)}
                      >
                        {c === 'all' ? 'All' : getDisplayLabel('category', c)}
                      </button>
                    )
                  })}
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={() => setSelectedCategories([])}
                      className="px-2 py-0.5 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer animate-in fade-in zoom-in-95 duration-150"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}

              {/* Animation selector row */}
              {animationNames.length > 0 && (
                <div className="flex items-center gap-3 pt-1 border-t border-gray-50/80">
                  <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Animation</span>
                  <div className="relative flex-shrink-0">
                    <select
                      value={selectedAnimation ?? ''}
                      onChange={e => setSelectedAnimation(e.target.value || null)}
                      className={INPUT_STYLES.textDense + " !appearance-none !pl-3 !pr-7 !py-1 hover:!bg-gray-100 cursor-pointer !max-w-[220px]"}
                    >
                      <option value="">None</option>
                      {animationNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {selectedAnimation && (
                    <>
                      <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Playing
                      </span>
                      <button
                        onClick={() => setSelectedAnimation(null)}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 font-medium transition-colors"
                      >
                        Stop
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Second Component: Table & Scene Graph Contents Box */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {items.length > 0 && (
              <div className="flex flex-col border-b border-gray-100 bg-gray-50/50 px-6 py-2 flex-shrink-0 gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setInspectorTab('table')}
                      className={inspectorTab === 'table' ? TAB_STYLES.underlineActive : TAB_STYLES.underlineInactive}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => setInspectorTab('analytics')}
                      className={inspectorTab === 'analytics' ? TAB_STYLES.underlineActive : TAB_STYLES.underlineInactive}
                    >
                      Diagram
                    </button>
                  </div>

                  {inspectorTab === 'analytics' && <div />}
                </div>
              </div>
            )}

            {/* Table body */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 p-8">
                <svg className="w-10 h-10 stroke-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
                <p className="text-sm font-semibold text-gray-700">Scene Graph Diagnostics Pending</p>
                <p className="text-xs text-gray-400 text-center max-w-sm mt-1 leading-normal">
                  Upload a binary model payload on the left to extract absolute UUID maps, object taxonomy, material sub-assignments, and BIM/IFC userData structures.
                </p>
              </div>
            ) : inspectorTab === 'analytics' ? (
              <div className="flex-1 flex flex-col p-6 min-h-0 overflow-y-auto bg-gray-50/20">
                <style>{`
                  @keyframes chartGrow {
                    from { transform: scaleY(0); }
                    to { transform: scaleY(1); }
                  }
                `}</style>
                {chartData.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                    <p className="text-xs">No data points available for grouping.</p>
                  </div>
                ) : (() => {
                  const maxCount = Math.max(...chartData.map(c => c.count)) || 1
                  const isVol = diagramMode === 'volume'
                  
                  const formatVal = (val: number) => {
                    if (isVol) {
                      return `${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })} m³`
                    }
                    return val.toLocaleString()
                  }

                  const formatTick = (val: number) => {
                    if (isVol) {
                      if (val >= 1000) return `${Math.round(val)} m³`
                      if (val === 0) return '0'
                      return `${val.toFixed(2)} m³`
                    }
                    return Math.round(val).toString()
                  }

                  const ticks = [
                    maxCount,
                    (maxCount * 3) / 4,
                    maxCount / 2,
                    maxCount / 4,
                    0
                  ].map(formatTick)
                  
                  const barGradients = [
                    'from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-350',
                    'from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-350',
                    'from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-350',
                    'from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-350',
                    'from-rose-600 to-rose-400 hover:from-rose-500 hover:to-rose-350',
                    'from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-350',
                    'from-indigo-600 to-indigo-400 hover:from-indigo-500 hover:to-indigo-350',
                  ]
                  
                  const legendColors = [
                    'bg-brand-500',
                    'bg-emerald-500',
                    'bg-blue-500',
                    'bg-purple-500',
                    'bg-rose-500',
                    'bg-amber-500',
                    'bg-indigo-500'
                  ]

                  const hasSomeGroupActive = (groupName: string) => {
                    const groupItems = items.filter(item => {
                      let key = ''
                      if (groupByField === 'type') {
                        key = item.type || '-'
                      } else if (groupByField === 'materialName') {
                        key = item.materialName || '-'
                      } else if (groupByField === 'category') {
                        const normItemUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
                        let catText = uuidToCategoryMap?.[normItemUuid] || ''
                        if (!catText) {
                          for (const ancUuid of item.ancestorUuids) {
                            const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
                            if (uuidToCategoryMap?.[normAncUuid]) {
                              catText = uuidToCategoryMap?.[normAncUuid]
                              break
                            }
                          }
                        }
                        key = catText || 'Unmapped'
                      }

                      if (key === '' || key === ' ' || key === 'undefined' || key === 'null') {
                        key = '-'
                      }

                      return key === groupName
                    })

                    if (groupItems.length === 0) return false
                    return groupItems.some(i => selectedNodeUuids.includes(i.uuid))
                  }

                  const handleChartGroupClick = (groupName: string) => {
                    const groupItems = items.filter(item => {
                      let key = ''
                      if (groupByField === 'type') {
                        key = item.type || '-'
                      } else if (groupByField === 'materialName') {
                        key = item.materialName || '-'
                      } else if (groupByField === 'category') {
                        const normItemUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
                        let catText = uuidToCategoryMap?.[normItemUuid] || ''
                        if (!catText) {
                          for (const ancUuid of item.ancestorUuids) {
                            const normAncUuid = ancUuid.toLowerCase().replace(/[{}]/g, '')
                            if (uuidToCategoryMap?.[normAncUuid]) {
                              catText = uuidToCategoryMap?.[normAncUuid]
                              break
                            }
                          }
                        }
                        key = catText || 'Unmapped'
                      }

                      if (key === '' || key === ' ' || key === 'undefined' || key === 'null') {
                        key = '-'
                      }

                      return key === groupName
                    })

                    const groupUuids = groupItems.map(i => i.uuid)
                    const allSelected = groupUuids.every(uid => selectedNodeUuids.includes(uid))
                    
                    if (allSelected) {
                      setSelectedNodeUuids(prev => prev.filter(uid => !groupUuids.includes(uid)))
                    } else {
                      setSelectedNodeUuids(prev => {
                        const union = new Set([...prev, ...groupUuids])
                        return Array.from(union)
                      })
                    }
                  }

                  const anyGroupSelected = chartData.some(c => hasSomeGroupActive(c.name))
                  const barCount = Math.max(chartData.length, 1)
                  const barGapPx = (barCount > 28 ? 2 : barCount > 18 ? 3 : 4) * diagramSettings.bar.gapScale
                  const compactLabels = barCount > 16
                  const compactValues = barCount > 24
                  const baseBarWidthPct = barCount > 40 ? 48 : barCount > 30 ? 58 : barCount > 20 ? 70 : barCount > 12 ? 82 : 100
                  const barWidthPct = Math.max(28, Math.min(100, baseBarWidthPct * diagramSettings.bar.barWidthScale))

                  return (
                    <div className="flex flex-row gap-6 h-full min-h-[340px] items-stretch">
                      {/* Main Chart Area */}
                      <div className="flex bg-white rounded-2xl border border-gray-150 p-6 relative shadow-sm select-none flex-shrink-0 w-[65%]">
                        {chartType === 'bar' && (
                          <div className="flex w-full h-full relative">
                            {/* Y-axis Label & Ticks */}
                            <div className="flex items-stretch pr-4 flex-shrink-0 select-none">
                              {/* Rotated text */}
                              <div className="flex items-center justify-center -rotate-90 w-6">
                                <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest whitespace-nowrap">
                                  {isVol ? 'Cumulative Volume' : 'Element Count'}
                                </span>
                              </div>
                              {/* Ticks values */}
                              <div className="flex flex-col justify-between items-end text-[9px] font-mono font-bold text-gray-400 pb-8 pt-2">
                                {ticks.map((t, idx) => (
                                  <span key={idx}>{t}</span>
                                ))}
                              </div>
                            </div>

                            {/* Main Chart Window */}
                            <div className="flex-1 flex flex-col justify-end relative h-full min-h-[260px]">
                              {/* Y-axis Gridlines Background */}
                              <div className="absolute inset-0 pb-8 pt-2 flex flex-col justify-between pointer-events-none">
                                {[...Array(5)].map((_, i) => (
                                  <div key={i} className="w-full border-t border-gray-100 h-0" />
                                ))}
                                <div className="w-full h-0 border-t border-gray-350" />
                              </div>

                              {/* Chart columns */}
                              <div
                                className="relative flex-1 grid items-end pb-8 pt-2 z-10"
                                style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))`, columnGap: `${barGapPx}px` }}
                              >
                                {chartData.map((d, index) => {
                                  const pctHeight = (d.count / maxCount) * 100
                                  const customColor = groupByField === 'type' ? typeColorMap[d.name] : groupByField === 'materialName' ? materialColorMap[d.name] : categoryColorMap[d.name]
                                  const gradientClass = customColor ? '' : barGradients[index % barGradients.length]
                                  
                                  const isSelected = hasSomeGroupActive(d.name)
                                  const opacityClass = anyGroupSelected && !isSelected ? 'opacity-30 grayscale-[40%]' : 'opacity-100'
                                  const activeBorderClass = isSelected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white' : ''

                                  return (
                                    <div 
                                      key={d.name} 
                                      onClick={() => handleChartGroupClick(d.name)}
                                      className="flex flex-col items-center group relative h-full justify-end cursor-pointer min-w-0"
                                    >
                                      {/* Dynamic Bar */}
                                      <div 
                                        className={`w-full rounded-t-none transition-all duration-300 shadow-sm relative flex items-end justify-center origin-bottom ${opacityClass} ${activeBorderClass} ${!customColor ? 'bg-gradient-to-t ' + gradientClass : ''}`}
                                        style={{ 
                                          width: `${barWidthPct}%`,
                                          height: `${Math.max(pctHeight, 6)}%`,
                                          animation: `chartGrow 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                          backgroundColor: customColor || undefined
                                        }}
                                      >
                                        {/* Count display on top of bar */}
                                        {diagramSettings.bar.showValueLabels && (
                                          <span className={`absolute bottom-full mb-1 font-bold text-gray-600 whitespace-nowrap ${compactValues ? 'text-[8px]' : 'text-[9px]'} ${diagramSettings.bar.valueOrientation === 'vertical' ? '-rotate-90 origin-bottom' : ''}`}>
                                            {formatVal(d.count)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Label */}
                                      <div className={`mt-2 font-semibold text-gray-500 text-center truncate w-full ${compactLabels ? 'text-[9px]' : 'text-[10px]'}`} title={getDisplayLabel(groupByField, d.name)}>
                                        {getDisplayLabel(groupByField, d.name)}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* X-axis Label */}
                              <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none select-none truncate px-4">
                                {groupByField === 'type' ? 'Taxonomy Types' : groupByField === 'materialName' ? 'Material Bindings' : (categoryColumn || 'Excel Categories')} (X-Axis)
                              </div>
                            </div>
                          </div>
                        )}

                        {chartType === 'horizontal' && (
                          <div className="flex flex-col w-full h-full relative pl-2 min-h-[260px] justify-around py-4 overflow-y-auto">
                            {chartData.map((d, index) => {
                              const pctWidth = (d.count / maxCount) * 100
                              const customColor = groupByField === 'type' ? typeColorMap[d.name] : groupByField === 'materialName' ? materialColorMap[d.name] : categoryColorMap[d.name]
                              const gradientClass = customColor ? '' : barGradients[index % barGradients.length]
                               const isSelected = hasSomeGroupActive(d.name)
                              const opacityClass = anyGroupSelected && !isSelected ? 'opacity-30 grayscale-[40%]' : 'opacity-100'
                              const activeBorderClass = isSelected ? 'ring-2 ring-brand-500' : ''
                              return (
                                <div key={d.name} onClick={() => handleChartGroupClick(d.name)} className="flex items-center w-full group cursor-pointer my-1" style={{ minHeight: `${diagramSettings.horizontal.rowHeightPx}px` }}>
                                  {/* Label left */}
                                  <div className="flex-shrink-0 text-[10px] font-semibold text-gray-600 text-right pr-3 truncate" style={{ width: `${diagramSettings.horizontal.labelWidthPx}px` }} title={getDisplayLabel(groupByField, d.name)}>{getDisplayLabel(groupByField, d.name)}</div>
                                  {/* Bar container */}
                                  <div className="flex-1 h-5 relative flex items-center">
                                    <div 
                                      className={`h-full rounded-r-md transition-all duration-500 relative flex items-center justify-end ${opacityClass} ${activeBorderClass} ${!customColor ? 'bg-gradient-to-r ' + gradientClass : ''}`} 
                                      style={{ width: `${Math.max(pctWidth, 2)}%`, backgroundColor: customColor || undefined }}
                                    >
                                      {/* Add a subtle visual glow to the text value and position it outside the bar */}
                                      {diagramSettings.horizontal.showValueLabels && (
                                        <span className="absolute left-full ml-2 text-[9px] font-bold text-gray-600 drop-shadow-sm whitespace-nowrap">{formatVal(d.count)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {chartType === 'donut' && (() => {
                          const donutTotalCount = chartData.reduce((acc, c) => acc + c.count, 0)
                          const R = 40;
                          const C = 2 * Math.PI * R;
                          let cumulativeCount = 0;
                          const ringThickness = Math.max(8, Math.min(30, diagramSettings.donut.ringThickness))
                          
                          return (
                            <div className="flex w-full h-full items-center justify-center min-h-[260px] relative">
                              <svg viewBox="0 0 100 100" className="w-56 h-56 transform -rotate-90 drop-shadow-sm overflow-visible animate-in zoom-in duration-500">
                                {/* Background ring */}
                                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f3f4f6" strokeWidth={ringThickness} />
                                
                                {chartData.map((d, index) => {
                                  const fraction = d.count / (donutTotalCount || 1);
                                  // Add tiny overlap to prevent sub-pixel anti-aliasing gaps between slices
                                  const sliceLength = fraction * C + (fraction < 1 ? 0.3 : 0);
                                  const dashOffset = (cumulativeCount / (donutTotalCount || 1)) * C;
                                  cumulativeCount += d.count;
                                  
                                  const customColor = groupByField === 'type' ? typeColorMap[d.name] : groupByField === 'materialName' ? materialColorMap[d.name] : categoryColorMap[d.name]
                                  const hexColor = customColor || ['#0ea5e9', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#6366f1'][index % 7];
                                  const isSelected = hasSomeGroupActive(d.name);
                                  const opacityClass = anyGroupSelected && !isSelected ? 'opacity-30 grayscale-[40%]' : 'opacity-100 hover:opacity-80';
                                  
                                  return (
                                    <circle
                                      key={d.name}
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke={hexColor}
                                      strokeWidth={isSelected ? `${ringThickness + 3}` : `${ringThickness}`}
                                      strokeDasharray={`${sliceLength} ${C}`}
                                      strokeDashoffset={-dashOffset}
                                      className={`cursor-pointer transition-all duration-300 origin-center ${opacityClass}`}
                                      onClick={() => handleChartGroupClick(d.name)}
                                    >
                                      <title>{getDisplayLabel(groupByField, d.name)}: {formatVal(d.count)}</title>
                                    </circle>
                                  )
                                })}
                              </svg>

                              {/* Center Label */}
                              {diagramSettings.donut.showCenterTotal && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="flex flex-col items-center justify-center bg-white rounded-full w-28 h-28 shadow-sm">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                                    <span className="text-2xl font-black text-gray-700 truncate max-w-[100px]" title={formatVal(donutTotalCount)}>
                                      {isVol ? `${donutTotalCount.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³` : donutTotalCount}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      <div className="flex-1 min-h-0 min-w-0 relative">
                        <div className="h-full bg-white rounded-2xl border border-gray-150 p-5 shadow-sm select-none overflow-y-auto overflow-x-hidden pr-12 min-w-0">
                          {diagramSideTab === 'controls' && (
                            <div>
                              <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsDiagramControlsCollapsed(prev => !prev)}>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Diagram Controls</h4>
                              </div>
                              {!isDiagramControlsCollapsed && (
                                <div className="mt-3 space-y-3">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-gray-500"><input type="checkbox" checked={includeEmpty} onChange={e => setIncludeEmpty(e.target.checked)} className="rounded border-gray-300 text-brand-600 w-3.5 h-3.5 cursor-pointer accent-brand-500" /><span>Empty</span></label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-gray-500"><input type="checkbox" checked={includeUnmapped} onChange={e => setIncludeUnmapped(e.target.checked)} className="rounded border-gray-300 text-brand-600 w-3.5 h-3.5 cursor-pointer accent-brand-500" /><span>Unmapped</span></label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-gray-500"><input type="checkbox" checked={autoZoom} onChange={e => setAutoZoom(e.target.checked)} className="rounded border-gray-300 text-brand-600 w-3.5 h-3.5 cursor-pointer accent-brand-500" /><span>Auto Zoom</span></label>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Diagram</span>
                                      <select value={diagramMode} onChange={e => setDiagramMode(e.target.value as any)} className={INPUT_STYLES.textDense + " !w-44 hover:!bg-gray-50 cursor-pointer"}>
                                        <option value="count">Distribution</option>
                                        <option value="volume">Volume Distribution</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Group By</span>
                                      <select value={groupByField} onChange={e => setGroupByField(e.target.value as any)} className={INPUT_STYLES.textDense + " !w-44 hover:!bg-gray-50 cursor-pointer truncate"}>
                                        <option value="type">Taxonomy (Type)</option>
                                        <option value="materialName">Material Binding</option>
                                        {hasExcelData && <option value="category">{categoryColumn || 'Excel Category'}</option>}
                                      </select>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Type</span>
                                      <select value={chartType} onChange={e => setChartType(e.target.value as any)} className={INPUT_STYLES.textDense + " !w-44 hover:!bg-gray-50 cursor-pointer"}>
                                        <option value="bar">Bar (Vertical)</option>
                                        <option value="horizontal">Bar (Horizontal)</option>
                                        <option value="donut">Donut Ring</option>
                                      </select>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setPendingDiagramSettings({ ...diagramSettings })
                                        setDiagramSettingsOpen(true)
                                      }}
                                      className={BUTTON_STYLES.secondary + " !inline-flex !items-center !justify-center !gap-1.5 !px-2.5 !py-1.5 !rounded-md !text-[11px] !font-semibold transition-colors cursor-pointer"}
                                      title="Diagram Settings"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span>Settings</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {diagramSideTab === 'legend' && diagramSettings.showLegend && (
                            <div>
                              <div className="flex items-center justify-between mb-3 gap-2">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Legend</h4>
                                {selectedNodeUuids.length > 0 && (
                                  <button onClick={() => setSelectedNodeUuids([])} className="px-2 py-1 text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-md transition-colors whitespace-nowrap flex-shrink-0">
                                    Reset Selection
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-col gap-3">
                                {chartData.map((d, idx) => {
                                  const totalVal = isVol ? chartData.reduce((acc, c) => acc + c.count, 0) : chartFilteredItems.length
                                  const pctTotal = totalVal > 0 ? ((d.count / totalVal) * 100).toFixed(1) : '0.0'
                                  const customColor = groupByField === 'type' ? typeColorMap[d.name] : groupByField === 'materialName' ? materialColorMap[d.name] : categoryColorMap[d.name]
                                  const dotColor = customColor ? '' : legendColors[idx % legendColors.length]
                                  const isSelected = hasSomeGroupActive(d.name)
                                  const opacityClass = anyGroupSelected && !isSelected ? 'opacity-40' : 'opacity-100'
                                  const rowClass = isSelected ? 'bg-brand-50/30' : 'hover:bg-gray-50/70'
                                  return (
                                    <div key={d.name} onClick={() => handleChartGroupClick(d.name)} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors min-w-0 cursor-pointer ${rowClass} ${opacityClass}`}>
                                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} style={{ backgroundColor: customColor || undefined }} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-semibold text-gray-700 truncate" title={getDisplayLabel(groupByField, d.name)}>{getDisplayLabel(groupByField, d.name)}</p>
                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5 truncate" title={`${formatVal(d.count)} (${pctTotal}%)`}>{formatVal(d.count)} <span className="font-normal font-sans">({pctTotal}%)</span></p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 flex flex-col gap-2">
                           <button
                             onClick={() => setDiagramSideTab('legend')}
                             className={`rotate-180 px-2 py-2 rounded-lg border text-[10px] font-bold tracking-wide transition-all ${
                               diagramSideTab === 'legend'
                                 ? 'bg-brand-50 border-brand-200 text-brand-700'
                                 : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                             }`}
                             style={{ writingMode: 'vertical-rl' }}
                           >
                             Legend
                           </button>
                           <button
                             onClick={() => setDiagramSideTab('controls')}
                             className={`rotate-180 px-2 py-2 rounded-lg border text-[10px] font-bold tracking-wide transition-all ${
                               diagramSideTab === 'controls'
                                 ? 'bg-brand-50 border-brand-200 text-brand-700'
                                 : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                             }`}
                             style={{ writingMode: 'vertical-rl' }}
                           >
                             Controls
                           </button>
                         </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : filteredAndSortedItems.length === 0 ? (
              <div className="flex-1 text-center py-16 text-gray-400 text-[11px]">
                No sub-nodes match the active filters or text pattern.
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {selectedNodeUuids.length > 0 && (
                  <div className="flex items-center justify-between bg-brand-50/50 border border-brand-100/60 px-4 py-2 rounded-xl mb-3 mt-1 mr-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse flex-shrink-0" />
                      {selectedNodeUuids.length === 1 ? (
                        <span className="text-[11px] font-medium text-brand-700 truncate">
                          Isolating: <span className="font-semibold text-brand-900">
                            "{items.find(i => i.uuid === selectedNodeUuids[0])?.name || selectedNodeUuids[0]}"
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-brand-700">
                          <span className="font-semibold text-brand-900">{selectedNodeUuids.length}</span> nodes selected
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedNodeUuids([])}
                      className="text-[11px] text-brand-500 hover:text-brand-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-brand-200 hover:border-brand-300 shadow-sm transition-all cursor-pointer flex items-center gap-1 hover:shadow flex-shrink-0 ml-2"
                    >
                      <span>Clear Selection</span>
                      <span className="text-[9px]">✕</span>
                    </button>
                  </div>
                )}

                {/* Single scroll container — header is sticky inside so horizontal scroll is shared */}
                <div
                  ref={tableParentRef}
                  className="flex-1 min-h-0 overflow-auto sidebar-scroll"
                >
                  <div style={{ minWidth: `${tableMinWidth}px` }}>

                    {/* Sticky header */}
                    <div
                      className={"sticky top-0 z-10 " + TABLE_STYLES.headerRow}
                      style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                    >
                      <div className={TABLE_STYLES.headerCell + " border-r border-gray-200 flex items-center"}>
                        <button
                          onClick={() => handleSort('type')}
                          className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase font-bold text-xs"
                        >
                          <span>Taxonomy</span>
                          {sortField === 'type' ? (
                            <span className="text-[10px] text-brand-600 font-bold">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 font-black">↕</span>
                          )}
                        </button>
                      </div>
                      <div className={TABLE_STYLES.headerCell + " !px-3 border-r border-gray-200 flex items-center"}>
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase font-bold text-xs"
                        >
                          <span>Node Label</span>
                          {sortField === 'name' ? (
                            <span className="text-[10px] text-brand-600 font-bold">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 font-black">↕</span>
                          )}
                        </button>
                      </div>
                      <div className={TABLE_STYLES.headerCell + " !px-3 border-r border-gray-200 flex items-center"}>Absolute UUID</div>
                      {hasExcelData && displayedCols.map(col => (
                        <div key={col} className={TABLE_STYLES.headerCell + " !px-3 !text-emerald-700 border-r border-gray-200 truncate flex items-center"} title={col}>
                          {col}
                        </div>
                      ))}
                      <div className={TABLE_STYLES.headerCell + " !px-3 border-r border-gray-200 flex items-center justify-end"}>Vertices</div>
                      <div className={TABLE_STYLES.headerCell + " !px-3 border-r border-gray-200 flex items-center justify-end"}>Triangles</div>
                      <div className={TABLE_STYLES.headerCell + " !px-3 border-r border-gray-200 flex items-center"}>
                        <button
                          onClick={() => handleSort('materialName')}
                          className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase font-bold text-xs"
                        >
                          <span>Material Binding</span>
                          {sortField === 'materialName' ? (
                            <span className="text-[10px] text-brand-600 font-bold">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 font-black">↕</span>
                          )}
                        </button>
                      </div>
                      <div className={TABLE_STYLES.headerCell + " text-center flex items-center justify-center"}>UserData</div>
                    </div>

                    {/* Virtual rows */}
                    <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                      {rowVirtualizer.getVirtualItems().map(vRow => {
                        const entry = virtualFlatRows[vRow.index]
                        if (!entry) return null

                        const { item } = entry
                        const isCopied = copiedId === item.uuid

                        const baseStyle: React.CSSProperties = {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${vRow.start}px)`,
                        }

                        if (entry.kind === 'expanded') {
                          return (
                            <div
                              key={`${item.uuid}-expanded`}
                              data-index={vRow.index}
                              ref={rowVirtualizer.measureElement}
                              style={baseStyle}
                              className="bg-slate-50/60 border-b border-gray-100"
                            >
                              <div className="p-4">
                                <div className="bg-gray-900 rounded-xl p-3 relative">
                                  <button
                                    onClick={() => copyToClipboard(item.userDataJson, `json-${item.uuid}`)}
                                    className="absolute right-2 top-2 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[10px] font-mono transition-colors"
                                  >
                                    {copiedId === `json-${item.uuid}` ? 'Copied Payload!' : 'Copy raw JSON'}
                                  </button>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Embedded Node Data Payload</p>
                                  <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                                    {item.userDataJson}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        const isExpanded = expandedUuid === item.uuid
                        const hasData = !!item.userDataJson
                        const normUuid = item.uuid.toLowerCase().replace(/[{}]/g, '')
                        const itemExcelData = hasExcelData ? (excelData[normUuid] || {}) : {}

                        return (
                          <div
                            key={item.uuid}
                            data-index={vRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{ ...baseStyle, display: 'grid', gridTemplateColumns: gridTemplate }}
                            className={TABLE_STYLES.rowHover + " group border-b border-gray-100"}
                          >
                            <div className={TABLE_STYLES.bodyCellDense + " font-mono flex items-center overflow-hidden border-r border-gray-100"}>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold truncate ${
                                item.type === 'Mesh' ? 'bg-purple-50 text-purple-700 border border-purple-100/80' :
                                item.type === 'Group' ? 'bg-blue-50 text-blue-700 border border-blue-100/80' :
                                'bg-gray-50 text-gray-600 border border-gray-200/50'
                              }`}>
                                {item.type}
                              </span>
                            </div>
                            <div className={TABLE_STYLES.bodyCellDense + " !px-3 font-semibold !text-gray-900 flex items-center overflow-hidden border-r border-gray-100"} title={item.name}>
                              <span className="truncate">{item.name}</span>
                            </div>
                            <div className={TABLE_STYLES.bodyCellDense + " !px-3 font-mono !text-gray-500 flex items-center overflow-hidden border-r border-gray-100"}>
                              <span className="truncate min-w-0 flex-1" title={item.uuid}>{item.uuid}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(item.uuid, item.uuid)
                                }}
                                className={`ml-1.5 p-1 rounded transition-all flex-shrink-0 opacity-40 group-hover:opacity-100 hover:scale-105 hover:bg-gray-100 ${
                                  isCopied ? 'text-green-600 bg-green-50 opacity-100 scale-100' : 'text-gray-400 hover:text-brand-600'
                                }`}
                                title="Copy full UUID"
                              >
                                {isCopied ? (
                                  <span className="text-[9px] font-bold px-0.5">✓</span>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {hasExcelData && displayedCols.map(col => {
                              const val = itemExcelData[col]
                              return (
                                <div key={col} className={TABLE_STYLES.bodyCellDense + " !px-3 flex items-center overflow-hidden border-r border-gray-100"}>
                                  {val ? (
                                    <span className="truncate text-gray-700" title={val}>{val}</span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </div>
                              )
                            })}
                            <div className={TABLE_STYLES.bodyCellDense + " !px-3 font-mono !text-gray-650 flex items-center justify-end border-r border-gray-100"}>
                              {item.vertices > 0 ? item.vertices.toLocaleString() : '—'}
                            </div>
                            <div className={TABLE_STYLES.bodyCellDense + " !px-3 font-mono !text-gray-650 flex items-center justify-end border-r border-gray-100"}>
                              {item.triangles > 0 ? item.triangles.toLocaleString() : '—'}
                            </div>
                            <div className={TABLE_STYLES.bodyCellDense + " !px-3 flex items-center overflow-hidden border-r border-gray-100"} title={`${item.materialName} (${item.materialType})`}>
                              {item.materialName !== '-' ? (
                                <span className="inline-flex items-center gap-1 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                                  <span className="truncate">{item.materialName}</span>
                                  {item.materialType && <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">({item.materialType})</span>}
                                </span>
                              ) : '—'}
                            </div>
                            <div className={TABLE_STYLES.bodyCellDense + " flex items-center justify-center"}>
                              {hasData ? (
                                <button
                                  onClick={() => setExpandedUuid(isExpanded ? null : item.uuid)}
                                  className={isExpanded ? TAB_STYLES.filterActive : TAB_STYLES.filterInactive}
                                >
                                  <span>BIM Map</span>
                                  <span className="text-[9px] font-bold">{isExpanded ? '▲' : '▼'}</span>
                                </button>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Filter Color Modal */}
      {colorModalTarget === 'type' && (
        <FilterColorModal
          title="Taxonomy"
          values={availableTypes.filter(t => t !== 'all')}
          colorMap={typeColorMap}
          labelMap={typeLabelMap}
          onApply={(map, labels) => { setTypeColorMap(map); setTypeLabelMap(labels) }}
          onClose={() => setColorModalTarget(null)}
        />
      )}
      {colorModalTarget === 'material' && (
        <FilterColorModal
          title="Material"
          values={availableMaterials.filter(m => m !== 'all')}
          colorMap={materialColorMap}
          labelMap={materialLabelMap}
          onApply={(map, labels) => { setMaterialColorMap(map); setMaterialLabelMap(labels) }}
          onClose={() => setColorModalTarget(null)}
        />
      )}
      {colorModalTarget === 'category' && (
        <FilterColorModal
          title={categoryColumn || 'Category'}
          values={availableCategories.filter(c => c !== 'all')}
          colorMap={categoryColorMap}
          labelMap={categoryLabelMap}
          onApply={(map, labels) => { setCategoryColorMap(map); setCategoryLabelMap(labels) }}
          onClose={() => setColorModalTarget(null)}
        />
      )}

      {/* Column settings floating popover — rendered via portal so it escapes overflow clipping */}
      {columnSettingsOpen && settingsPopoverPos && excelHeaders.length > 0 && createPortal(
        <div
          id="col-settings-popover"
          style={{ position: 'fixed', top: settingsPopoverPos.top, left: settingsPopoverPos.left, zIndex: 9999 }}
          className={PANEL_STYLES.card + " !shadow-xl !p-3 !w-56"}
        >
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Visible Columns</p>
          <div className="space-y-0.5 max-h-52 overflow-y-auto">
            {excelHeaders.map(col => (
              <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1.5 py-1 rounded">
                <input
                  type="checkbox"
                  checked={pendingColumns.includes(col)}
                  onChange={e => {
                    if (e.target.checked) {
                      setPendingColumns(prev => excelHeaders.filter(h => new Set([...prev, col]).has(h)))
                    } else {
                      setPendingColumns(prev => prev.filter(c => c !== col))
                    }
                  }}
                  className="w-3 h-3 rounded accent-emerald-600 flex-shrink-0"
                />
                <span className="text-[11px] text-gray-700 truncate">{col}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setVisibleExcelColumns([...pendingColumns])
                setColumnSettingsOpen(false)
                if (pendingColumns.length > 0 && categoryColumn && !pendingColumns.includes(categoryColumn)) {
                  applyColumnAsCategory(pendingColumns[0], excelData)
                } else if (pendingColumns.length === 0 && categoryColumn) {
                  applyColumnAsCategory('', excelData)
                }
              }}
              className={BUTTON_STYLES.success + " !px-2.5 !py-1 !text-[11px] !rounded-md"}
            >
              Apply
            </button>
            <button
              onClick={() => { setPendingColumns([...visibleExcelColumns]); setColumnSettingsOpen(false) }}
              className={BUTTON_STYLES.secondary + " !px-2.5 !py-1 !text-[11px] !rounded-md"}
            >
              Cancel
            </button>
            <button
              onClick={() => setPendingColumns([...excelHeaders])}
              className={BUTTON_STYLES.subtle + " !px-2.5 !py-1 !text-[11px] !rounded-md"}
            >
              Reset
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Diagram Settings Modal */}
      {diagramSettingsOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className={PANEL_STYLES.modalLarge + " !max-h-[88vh]"}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-bold text-gray-800">Diagram Visualization Settings</h3>
              </div>
              <button
                onClick={() => {
                  setPendingDiagramSettings({ ...diagramSettings })
                  setDiagramSettingsOpen(false)
                }}
                className="text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 p-1 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 sidebar-scroll">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Show Legend Panel</span>
                <input
                  type="checkbox"
                  checked={pendingDiagramSettings.showLegend}
                  onChange={e => setPendingDiagramSettings(prev => ({ ...prev, showLegend: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer accent-brand-500"
                />
              </div>

              {chartType === 'bar' && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-gray-400">Bar (Vertical)</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Show Value Labels</span>
                    <input
                      type="checkbox"
                      checked={pendingDiagramSettings.bar.showValueLabels}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, bar: { ...prev.bar, showValueLabels: e.target.checked } }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer accent-brand-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Value Label Orientation</label>
                    <select
                      value={pendingDiagramSettings.bar.valueOrientation}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, bar: { ...prev.bar, valueOrientation: e.target.value as ValueOrientation } }))}
                      className={INPUT_STYLES.textDense + " !w-full"}
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-500">Bar Gap Scale</label>
                      <span className="text-[10px] font-mono text-gray-500">{pendingDiagramSettings.bar.gapScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1.4"
                      step="0.05"
                      value={pendingDiagramSettings.bar.gapScale}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, bar: { ...prev.bar, gapScale: parseFloat(e.target.value) } }))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-500">Bar Width Scale</label>
                      <span className="text-[10px] font-mono text-gray-500">{pendingDiagramSettings.bar.barWidthScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.55"
                      max="1.1"
                      step="0.05"
                      value={pendingDiagramSettings.bar.barWidthScale}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, bar: { ...prev.bar, barWidthScale: parseFloat(e.target.value) } }))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                </div>
              )}

              {chartType === 'horizontal' && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-gray-400">Bar (Horizontal)</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Show Value Labels</span>
                    <input
                      type="checkbox"
                      checked={pendingDiagramSettings.horizontal.showValueLabels}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, horizontal: { ...prev.horizontal, showValueLabels: e.target.checked } }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer accent-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-500">Label Width (px)</label>
                      <input
                        type="number"
                        min="80"
                        max="220"
                        step="4"
                        value={pendingDiagramSettings.horizontal.labelWidthPx}
                        onChange={e => setPendingDiagramSettings(prev => ({ ...prev, horizontal: { ...prev.horizontal, labelWidthPx: Math.max(80, Math.min(220, parseInt(e.target.value || '112', 10))) } }))}
                        className={INPUT_STYLES.textDense + " !w-full"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-500">Row Height (px)</label>
                      <input
                        type="number"
                        min="24"
                        max="56"
                        step="2"
                        value={pendingDiagramSettings.horizontal.rowHeightPx}
                        onChange={e => setPendingDiagramSettings(prev => ({ ...prev, horizontal: { ...prev.horizontal, rowHeightPx: Math.max(24, Math.min(56, parseInt(e.target.value || '32', 10))) } }))}
                        className={INPUT_STYLES.textDense + " !w-full"}
                      />
                    </div>
                  </div>
                </div>
              )}

              {chartType === 'donut' && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-gray-400">Donut Ring</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Show Center Total</span>
                    <input
                      type="checkbox"
                      checked={pendingDiagramSettings.donut.showCenterTotal}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, donut: { ...prev.donut, showCenterTotal: e.target.checked } }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer accent-brand-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-500">Ring Thickness</label>
                      <span className="text-[10px] font-mono text-gray-500">{pendingDiagramSettings.donut.ringThickness}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="30"
                      step="1"
                      value={pendingDiagramSettings.donut.ringThickness}
                      onChange={e => setPendingDiagramSettings(prev => ({ ...prev, donut: { ...prev.donut, ringThickness: parseInt(e.target.value, 10) } }))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <button
                onClick={() => setPendingDiagramSettings(defaultDiagramSettings)}
                className={BUTTON_STYLES.secondary + " !px-3.5 !py-1.5 !text-[11px] !font-bold"}
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingDiagramSettings({ ...diagramSettings })
                    setDiagramSettingsOpen(false)
                  }}
                  className={BUTTON_STYLES.secondary + " !px-3.5 !py-1.5 !text-[11px] !font-bold"}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setDiagramSettings({ ...pendingDiagramSettings })
                    setDiagramSettingsOpen(false)
                  }}
                  className={BUTTON_STYLES.primary + " !px-3.5 !py-1.5 !text-[11px] !font-bold !shadow-none"}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {threeModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className={PANEL_STYLES.modalLarge + " !max-h-[90vh]"}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-bold text-gray-800">3D Viewport Styling & Parameters</h3>
              </div>
              <button 
                onClick={() => setThreeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 p-1 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 sidebar-scroll">
              
              {/* Presets Row */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2.5">Theme Presets</span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setPendingThreeSettings(prev => ({
                      ...prev,
                      backgroundColor: '#f8fafc',
                      gridColor: '#e2e8f0',
                      gridSectionColor: '#cbd5e1',
                      showGroundPlane: true,
                      groundColor: '#f1f5f9',
                    }))}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-slate-50 transition-colors flex flex-col items-center gap-1 cursor-pointer bg-slate-50"
                  >
                    <span className="w-4 h-4 rounded bg-slate-100 border border-slate-300" />
                    <span>Light Slate</span>
                  </button>
                  <button
                    onClick={() => setPendingThreeSettings(prev => ({
                      ...prev,
                      backgroundColor: '#0f172a',
                      gridColor: '#334155',
                      gridSectionColor: '#475569',
                      showGroundPlane: true,
                      groundColor: '#1e293b',
                    }))}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-slate-900 hover:text-white transition-colors flex flex-col items-center gap-1 cursor-pointer bg-slate-800 text-slate-100"
                  >
                    <span className="w-4 h-4 rounded bg-slate-950 border border-slate-700" />
                    <span>Dark Slate</span>
                  </button>
                  <button
                    onClick={() => setPendingThreeSettings(prev => ({
                      ...prev,
                      backgroundColor: '#1e3a8a',
                      gridColor: '#3b82f6',
                      gridSectionColor: '#60a5fa',
                      showGroundPlane: true,
                      groundColor: '#172554',
                    }))}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-blue-900 hover:text-white transition-colors flex flex-col items-center gap-1 cursor-pointer bg-blue-800 text-blue-100"
                  >
                    <span className="w-4 h-4 rounded bg-blue-950 border border-blue-600" />
                    <span>Blueprint</span>
                  </button>
                  <button
                    onClick={() => setPendingThreeSettings(prev => ({
                      ...prev,
                      backgroundColor: '#000000',
                      gridColor: '#262626',
                      gridSectionColor: '#404040',
                      showGroundPlane: true,
                      groundColor: '#111111',
                    }))}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-black hover:text-white transition-colors flex flex-col items-center gap-1 cursor-pointer bg-neutral-900 text-neutral-100"
                  >
                    <span className="w-4 h-4 rounded bg-black border border-neutral-800" />
                    <span>Contrast Black</span>
                  </button>
                </div>
              </div>

              {/* Ground & Grid Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Ground Grid Helper</span>
                    <span className="text-[11px] text-gray-400">Show infinite coordinate grid under model</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pendingThreeSettings.showGrid}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, showGrid: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>

                {pendingThreeSettings.showGrid && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-500">Grid Cell Size (meters)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={pendingThreeSettings.gridCellSize}
                        onChange={e => setPendingThreeSettings(prev => ({ ...prev, gridCellSize: parseFloat(e.target.value) || 0.5 }))}
                        className={INPUT_STYLES.textDense + " !w-full focus:!ring-emerald-400"}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Sub-grid</label>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="color" 
                            value={pendingThreeSettings.gridColor}
                            onChange={e => setPendingThreeSettings(prev => ({ ...prev, gridColor: e.target.value }))}
                            className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-gray-500 uppercase">{pendingThreeSettings.gridColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Main-grid</label>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="color" 
                            value={pendingThreeSettings.gridSectionColor}
                            onChange={e => setPendingThreeSettings(prev => ({ ...prev, gridSectionColor: e.target.value }))}
                            className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-gray-500 uppercase">{pendingThreeSettings.gridSectionColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ground Plane Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Ground Floor Plane</span>
                    <span className="text-[11px] text-gray-400">Render a solid ground/floor plane under the 3D model</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pendingThreeSettings.showGroundPlane}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, showGroundPlane: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>

                {pendingThreeSettings.showGroundPlane && (
                  <div className="flex items-center gap-3 animate-in slide-in-from-top-1 duration-150">
                    <input 
                      type="color" 
                      value={pendingThreeSettings.groundColor}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, groundColor: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0 bg-transparent"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-mono font-bold text-gray-700 uppercase">{pendingThreeSettings.groundColor}</span>
                      <span className="text-[10px] text-gray-400">Click swatch to select custom ground floor hex</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Background Color Section */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">Viewport Background Color</span>
                  <span className="text-[11px] text-gray-400">Set the background fill behind the 3D viewport canvas</span>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={pendingThreeSettings.backgroundColor}
                    onChange={e => setPendingThreeSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0 bg-transparent"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono font-bold text-gray-700 uppercase">{pendingThreeSettings.backgroundColor}</span>
                    <span className="text-[10px] text-gray-400">Click swatch to select custom background hex</span>
                  </div>
                </div>
              </div>

              {/* Lights Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">Lighting & Camera Options</span>
                  <span className="text-[11px] text-gray-400">Control Three.js light sources and dynamic camera controls</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-gray-500">Ambient Light</label>
                      <span className="text-[10px] font-mono font-bold text-gray-500">{pendingThreeSettings.ambientIntensity.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0"
                      max="3"
                      step="0.1"
                      value={pendingThreeSettings.ambientIntensity}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, ambientIntensity: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-gray-500">Directional Light</label>
                      <span className="text-[10px] font-mono font-bold text-gray-500">{pendingThreeSettings.dirIntensity.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0"
                      max="4"
                      step="0.1"
                      value={pendingThreeSettings.dirIntensity}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, dirIntensity: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Auto-Rotate Scene</span>
                    <span className="text-[11px] text-gray-400">Slowly rotate camera around focal center</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pendingThreeSettings.autoRotate}
                      onChange={e => setPendingThreeSettings(prev => ({ ...prev, autoRotate: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <button
                onClick={() => setPendingThreeSettings({
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
                })}
                className={BUTTON_STYLES.secondary + " !px-3.5 !py-1.5 !text-[11px] !font-bold"}
              >
                Reset Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setThreeModalOpen(false)}
                  className={BUTTON_STYLES.secondary + " !px-3.5 !py-1.5 !text-[11px] !font-bold"}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setThreeSettings({ ...pendingThreeSettings })
                  }}
                  className={BUTTON_STYLES.success + " !px-3.5 !py-1.5 !text-[11px] !font-bold !shadow-none"}
                >
                  Accept & Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmTarget === 'model' && (
        <ConfirmDialog
          title="Unload 3D Model?"
          message="Are you sure you want to unload the active 3D model? This will also remove any loaded Excel/CSV overlay data and mapping details."
          confirmLabel="Unload Model"
          destructive
          onConfirm={() => {
            handleClear()
            setDeleteConfirmTarget(null)
          }}
          onCancel={() => setDeleteConfirmTarget(null)}
        />
      )}

      {deleteConfirmTarget === 'excel' && (
        <ConfirmDialog
          title="Remove Mapped Data?"
          message="Are you sure you want to remove the mapped Excel/CSV spreadsheet? This will clear all data rows, category filters, and custom table overlay columns."
          confirmLabel="Remove Data"
          destructive
          onConfirm={() => {
            handleClearExcel()
            setDeleteConfirmTarget(null)
          }}
          onCancel={() => setDeleteConfirmTarget(null)}
        />
      )}
    </>
  )
}
