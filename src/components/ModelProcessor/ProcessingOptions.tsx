import type { ProcessingConfig } from './types'
import { PANEL_STYLES, TYPOGRAPHY_STYLES, INPUT_STYLES } from '../../styles/designSystem'

const LOD_OPTIONS: { value: ProcessingConfig['lod']; label: string; desc: string }[] = [
  {
    value: 'high',
    label: 'High',
    desc: 'Deduplicate + prune unused data. Minimal size change, lossless.',
  },
  {
    value: 'medium',
    label: 'Medium',
    desc: 'High + weld shared vertices. Better compression ratio, lossless.',
  },
  {
    value: 'low',
    label: 'Low',
    desc: 'Medium + aggressive pruning. Best for large models. Mesh decimation coming soon.',
  },
]

interface Props {
  config: ProcessingConfig
  onChange: (config: ProcessingConfig) => void
  disabled?: boolean
}

export default function ProcessingOptions({ config, onChange, disabled }: Props) {
  return (
    <div className={`${PANEL_STYLES.card} !p-4 space-y-4`}>
      <p className={TYPOGRAPHY_STYLES.cardHeader}>Processing options</p>

      <div>
        <p className={TYPOGRAPHY_STYLES.label + ' mb-2'}>Level of Detail</p>
        <div className="space-y-2">
          {LOD_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                config.lod === opt.value
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="lod"
                value={opt.value}
                checked={config.lod === opt.value}
                onChange={() => !disabled && onChange({ ...config, lod: opt.value })}
                disabled={disabled}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <p className="text-xs font-semibold text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={INPUT_STYLES.label}>
          Scale factor
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.001"
            min="0.0001"
            max="10000"
            value={config.scale}
            onChange={e => onChange({ ...config, scale: parseFloat(e.target.value) || 1 })}
            disabled={disabled}
            className={`${INPUT_STYLES.text} w-28 font-mono`}
          />
          <span className="text-xs text-gray-500">
            {config.scale === 1 ? 'no change' : config.scale > 1 ? `×${config.scale} (larger)` : `×${config.scale} (smaller)`}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Useful for unit conversion — e.g. mm → m: 0.001, inches → m: 0.0254
        </p>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
        <p className="text-xs text-blue-700 font-medium">Coming in future updates</p>
        <p className="text-xs text-blue-600 mt-0.5">
          Draco mesh compression, mesh decimation, texture downscaling, and Rhino 3DM / IFC import.
        </p>
      </div>
    </div>
  )
}
