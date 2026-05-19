import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/UI/Header'
import AdminHeader from '../components/Admin/AdminHeader'
import ModelUploader from '../components/ModelProcessor/ModelUploader'
import ModelViewer from '../components/ModelProcessor/ModelViewer'
import ModelMetadataPanel from '../components/ModelProcessor/ModelMetadataPanel'
import ProcessingOptions from '../components/ModelProcessor/ProcessingOptions'
import { processGLB } from '../components/ModelProcessor/processModel'
import { convertFileToGLB, needsConversion } from '../components/ModelProcessor/convertToGLB'
import type { SceneMetadata, FileInfo, ProcessingConfig } from '../components/ModelProcessor/types'

type ConversionState = 'idle' | 'converting' | 'done' | 'error'
type ProcessingState = 'idle' | 'processing' | 'done' | 'error'

export default function ModelProcessorPage() {
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [convertedBuffer, setConvertedBuffer] = useState<ArrayBuffer | null>(null)
  const [conversionState, setConversionState] = useState<ConversionState>('idle')
  const [conversionError, setConversionError] = useState<string | null>(null)

  const [inputMeta, setInputMeta] = useState<SceneMetadata | null>(null)
  const [outputData, setOutputData] = useState<Uint8Array | null>(null)
  const [outputMeta, setOutputMeta] = useState<SceneMetadata | null>(null)
  const [outputSizeBytes, setOutputSizeBytes] = useState<number | null>(null)
  const [processingDesc, setProcessingDesc] = useState<string | null>(null)
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [config, setConfig] = useState<ProcessingConfig>({ lod: 'medium', scale: 1 })

  // Always show the model from the converted GLB buffer (works for all formats)
  const inputUrl = useMemo(() => {
    if (!convertedBuffer) return null
    const blob = new Blob([convertedBuffer], { type: 'model/gltf-binary' })
    return URL.createObjectURL(blob)
  }, [convertedBuffer])

  const outputUrl = useMemo(() => {
    if (!outputData) return null
    const blob = new Blob([outputData.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
    return URL.createObjectURL(blob)
  }, [outputData])

  useEffect(() => {
    return () => { if (inputUrl) URL.revokeObjectURL(inputUrl) }
  }, [inputUrl])

  useEffect(() => {
    return () => { if (outputUrl) URL.revokeObjectURL(outputUrl) }
  }, [outputUrl])

  function resetOutput() {
    setOutputData(null)
    setOutputMeta(null)
    setOutputSizeBytes(null)
    setProcessingDesc(null)
    setProcessingState('idle')
    setErrorMsg(null)
  }

  async function handleNewFile(file: File, textureFiles: File[] = []) {
    setInputFile(file)
    setInputMeta(null)
    setConvertedBuffer(null)
    setConversionError(null)
    resetOutput()

    if (!needsConversion(file)) {
      // GLB / glTF — read directly, no conversion needed
      setConversionState('done')
      const buf = await file.arrayBuffer()
      setConvertedBuffer(buf)
      return
    }

    // OBJ / FBX / DAE — convert to GLB first
    setConversionState('converting')
    try {
      const glb = await convertFileToGLB(file, textureFiles)
      setConvertedBuffer(glb)
      setConversionState('done')
    } catch (e) {
      setConversionError(e instanceof Error ? e.message : 'Conversion failed')
      setConversionState('error')
    }
  }

  async function handleProcess() {
    if (!convertedBuffer) return
    setProcessingState('processing')
    setErrorMsg(null)
    try {
      const result = await processGLB(convertedBuffer, config)
      setOutputData(result.data)
      setOutputSizeBytes(result.sizeBytes)
      setProcessingDesc(result.processingDesc)
      setOutputMeta(null)
      setProcessingState('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Processing failed')
      setProcessingState('error')
    }
  }

  function handleDownload() {
    if (!outputData || !inputFile) return
    const blob = new Blob([outputData.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseName = inputFile.name.replace(/\.[^.]+$/, '')
    a.href = url
    a.download = `${baseName}-processed.glb`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClear() {
    setInputFile(null)
    setConvertedBuffer(null)
    setConversionState('idle')
    setConversionError(null)
    setInputMeta(null)
    resetOutput()
  }

  const fileInfo: FileInfo | null = inputFile
    ? {
        name: inputFile.name,
        format: (inputFile.name.split('.').pop() ?? '').toLowerCase(),
        sizeBytes: inputFile.size,
      }
    : null

  const isConverting = conversionState === 'converting'
  const isProcessing = processingState === 'processing'
  const canProcess = conversionState === 'done' && !!convertedBuffer && !isProcessing

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <AdminHeader activeTab="processor" />

      {/* Main two-column layout */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">

        {/* ── Left: INPUT ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Input</h2>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                GLB · glTF · OBJ · FBX · DAE
              </span>
            </div>
            {inputFile && (
              <button onClick={handleClear} className="text-xs text-brand-600 hover:text-brand-700">
                Change file
              </button>
            )}
          </div>

          {!inputFile ? (
            <ModelUploader onFile={(m, t) => handleNewFile(m, t)} />
          ) : (
            <div className="flex flex-col gap-3">
              {/* File info bar */}
              <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
                <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
                <span className="text-sm font-medium text-gray-800 truncate flex-1">{inputFile.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {(inputFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                {isConverting && (
                  <span className="text-xs text-amber-600 flex-shrink-0 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Converting…
                  </span>
                )}
                {conversionState === 'done' && needsConversion(inputFile) && (
                  <span className="text-xs text-green-600 flex-shrink-0">→ GLB</span>
                )}
                <button
                  onClick={handleClear}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Conversion error */}
              {conversionState === 'error' && conversionError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-xs font-medium text-red-700">Conversion failed</p>
                  <p className="text-xs text-red-500 mt-0.5 whitespace-pre-line">{conversionError}</p>
                </div>
              )}

              {/* Input 3D viewer — shown once GLB is ready */}
              {conversionState === 'done' && (
                <div className="h-64 lg:h-72">
                  <ModelViewer
                    url={inputUrl}
                    onMetadata={m => setInputMeta(m)}
                    placeholder="Loading model…"
                  />
                </div>
              )}

              {/* Conversion placeholder while loading */}
              {isConverting && (
                <div className="h-64 lg:h-72 rounded-xl border border-dashed border-amber-200 bg-amber-50 flex items-center justify-center">
                  <p className="text-xs text-amber-600">Converting to GLB…</p>
                </div>
              )}

              {/* Input metadata */}
              {conversionState === 'done' && (
                <ModelMetadataPanel
                  file={fileInfo}
                  scene={inputMeta}
                  loading={!!inputFile && !inputMeta}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Right: OUTPUT ── */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Output</h2>

          {/* Processing options */}
          <ProcessingOptions
            config={config}
            onChange={setConfig}
            disabled={isProcessing || isConverting}
          />

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isConverting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Converting format…
              </>
            ) : isProcessing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
                Process model
              </>
            )}
          </button>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-medium text-red-700">Processing failed</p>
              <p className="text-xs text-red-500 mt-0.5">{errorMsg}</p>
            </div>
          )}

          {processingState === 'done' && outputData && (
            <>
              {/* Output 3D viewer */}
              <div className="h-64 lg:h-72">
                <ModelViewer
                  url={outputUrl}
                  onMetadata={m => setOutputMeta(m)}
                  placeholder="Loading processed model…"
                />
              </div>

              {/* Output metadata */}
              <ModelMetadataPanel
                file={fileInfo}
                scene={outputMeta}
                outputBytes={outputSizeBytes ?? undefined}
                inputBytes={inputFile?.size}
                processingDesc={processingDesc}
                loading={!outputMeta}
              />

              {/* Download */}
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download processed GLB
              </button>
            </>
          )}

          {processingState === 'idle' && !inputFile && (
            <div className="flex-1 rounded-xl border border-dashed border-gray-200 bg-white flex items-center justify-center">
              <p className="text-xs text-gray-400 text-center px-6">
                Upload a model on the left, configure options, then press "Process model".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
