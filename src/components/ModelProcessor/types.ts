export interface SceneMetadata {
  meshCount: number
  vertexCount: number
  triangleCount: number
  materialCount: number
  textureCount: number
  boundingBox: {
    min: { x: number; y: number; z: number }
    max: { x: number; y: number; z: number }
    sizeX: number
    sizeY: number
    sizeZ: number
  } | null
}

export interface FileInfo {
  name: string
  format: string
  sizeBytes: number
}

export interface ProcessingConfig {
  lod: 'high' | 'medium' | 'low'
  scale: number
}
