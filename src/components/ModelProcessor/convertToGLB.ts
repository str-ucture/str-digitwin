import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export const SUPPORTED_INPUT_FORMATS = ['.glb', '.gltf', '.obj', '.fbx', '.dae']
export const SUPPORTED_DISPLAY_FORMATS = ['GLB', 'glTF', 'OBJ', 'FBX', 'DAE']

function exportToGLB(object: THREE.Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      object,
      result => {
        if (result instanceof ArrayBuffer) resolve(result)
        else reject(new Error('GLTFExporter returned JSON instead of binary. Ensure {binary: true} is set.'))
      },
      err => reject(err),
      { binary: true },
    )
  })
}

// GLTFExporter requires MeshStandardMaterial. FBXLoader produces MeshPhongMaterial,
// so we convert each Phong material to Standard with equivalent properties.
function convertMaterials(root: THREE.Object3D) {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    const converted = mats.map(mat => {
      if (!(mat instanceof THREE.MeshPhongMaterial)) return mat
      return new THREE.MeshStandardMaterial({
        name: mat.name,
        color: mat.color.clone(),
        map: mat.map,
        normalMap: mat.normalMap,
        normalScale: mat.normalScale?.clone(),
        emissive: mat.emissive.clone(),
        emissiveMap: mat.emissiveMap,
        emissiveIntensity: mat.emissiveIntensity,
        alphaMap: mat.alphaMap,
        transparent: mat.transparent,
        opacity: mat.opacity,
        side: mat.side,
        roughness: 0.8,
        metalness: 0.1,
      })
    })
    node.material = Array.isArray(node.material) ? converted : converted[0]
  })
}

// Build a LoadingManager that redirects texture filename lookups to local blob URLs.
// FBXLoader resolves textures relative to the model blob URL, which fails for
// separately-uploaded texture files. This maps bare filenames to their blobs.
function buildManagerWithTextures(textureFiles: File[]): { manager: THREE.LoadingManager; cleanup: () => void } {
  const blobUrls: string[] = []
  const textureMap = new Map<string, string>()

  for (const tf of textureFiles) {
    const blobUrl = URL.createObjectURL(tf)
    blobUrls.push(blobUrl)
    textureMap.set(tf.name, blobUrl)
    textureMap.set(tf.name.toLowerCase(), blobUrl)
  }

  const manager = new THREE.LoadingManager()
  manager.setURLModifier(url => {
    const filename = decodeURIComponent(url.split('/').pop() ?? '')
    return textureMap.get(filename) ?? textureMap.get(filename.toLowerCase()) ?? url
  })

  return {
    manager,
    cleanup: () => blobUrls.forEach(u => URL.revokeObjectURL(u)),
  }
}

/**
 * Converts any supported 3D file format to a GLB ArrayBuffer.
 * GLB/glTF files are read as-is; OBJ, FBX, DAE are loaded via
 * Three.js loaders and re-exported as binary GLB.
 *
 * Pass `textureFiles` for FBX/OBJ models that reference external texture images —
 * the loader will resolve texture filenames against those files automatically.
 */
export async function convertFileToGLB(file: File, textureFiles: File[] = []): Promise<ArrayBuffer> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()

  if (ext === 'glb' || ext === 'gltf') {
    return file.arrayBuffer()
  }

  if (ext === 'blend') {
    throw new Error(
      'Blender .blend files cannot be converted in the browser.\n' +
      'In Blender, use File → Export → glTF 2.0 (.glb/.gltf) to export first.',
    )
  }

  const { manager, cleanup } = buildManagerWithTextures(textureFiles)
  const url = URL.createObjectURL(file)
  try {
    let object: THREE.Object3D

    if (ext === 'obj') {
      object = await new Promise<THREE.Group>((resolve, reject) =>
        new OBJLoader(manager).load(url, resolve, undefined, reject),
      )
    } else if (ext === 'fbx') {
      object = await new Promise<THREE.Group>((resolve, reject) =>
        new FBXLoader(manager).load(url, resolve, undefined, reject),
      )
    } else if (ext === 'dae') {
      const collada = await new Promise<{ scene: THREE.Group }>((resolve, reject) =>
        new ColladaLoader(manager).load(url, resolve as (result: unknown) => void, undefined, reject),
      )
      object = collada.scene
    } else {
      throw new Error(`Unsupported format: .${ext}`)
    }

    convertMaterials(object)
    return exportToGLB(object)
  } finally {
    URL.revokeObjectURL(url)
    cleanup()
  }
}

export function needsConversion(file: File): boolean {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  return !['glb', 'gltf'].includes(ext)
}
