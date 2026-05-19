import type { ConfigValidationError } from '../../lib/config'

interface ConfigErrorProps {
  error: ConfigValidationError
}

export default function ConfigError({ error }: ConfigErrorProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-panel border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-amber-900">Environment variables not configured</h1>
            <p className="text-sm text-amber-700 mt-0.5">
              {error.missing.length === 1
                ? '1 required variable is missing.'
                : `${error.missing.length} required variables are missing.`}
            </p>
          </div>
        </div>

        {/* Missing vars list */}
        <div className="px-6 py-5 space-y-3">
          {error.missing.map(({ key, description }) => (
            <div key={key} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-2" />
              <div>
                <code className="text-xs font-mono font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                  {key}
                </code>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fix steps */}
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How to fix</p>
          <ol className="space-y-2.5 text-sm text-gray-600">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">1</span>
              <span>
                Copy the template:{' '}
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                  cp .env.example .env.local
                </code>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">2</span>
              <span>Open <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">.env.local</code> and fill in the values above.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">3</span>
              <span>
                Restart the dev server:{' '}
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">npm run dev</code>
              </span>
            </li>
          </ol>
          <p className="text-xs text-gray-400 mt-4">
            See <code className="font-mono">.env.example</code> for all available variables and{' '}
            <code className="font-mono">README.md</code> for full setup instructions.
          </p>
        </div>
      </div>
    </div>
  )
}
