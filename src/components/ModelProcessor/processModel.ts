import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, weld } from '@gltf-transform/functions'
import type { ProcessingConfig } from './types'

export interface ProcessResult {
  data: Uint8Array
  sizeBytes: number
  processingDesc: string
}

export async function processGLB(
  inputBuffer: ArrayBuffer,
  config: ProcessingConfig,
): Promise<ProcessResult> {
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(new Uint8Array(inputBuffer))

  const transforms = [dedup(), prune()]
  const labels = ['dedup', 'prune']

  if (config.lod === 'medium' || config.lod === 'low') {
    transforms.push(weld())
    labels.push('weld')
  }

  await doc.transform(...transforms)

  if (config.scale !== 1) {
    const root = doc.getRoot()
    root.listScenes().forEach(scene => {
      scene.listChildren().forEach(node => {
        const s = config.scale
        node.setScale([s, s, s])
      })
    })
    labels.push(`scale×${config.scale}`)
  }

  const output = await io.writeBinary(doc)

  return {
    data: output,
    sizeBytes: output.byteLength,
    processingDesc: labels.join(' + '),
  }
}
