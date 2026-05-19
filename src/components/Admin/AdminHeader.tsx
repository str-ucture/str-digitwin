import { Link } from 'react-router-dom'

interface AdminHeaderProps {
  activeTab: 'admin' | 'viewer' | 'processor'
  loading?: boolean
  projectCount?: number
}

export default function AdminHeader({ activeTab, loading = false, projectCount = 0 }: AdminHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to map
        </Link>
        <div className="w-px h-5 bg-gray-200" />
        <h1 className="text-base font-semibold text-gray-900">Admin Console</h1>
        {activeTab === 'admin' && !loading && projectCount > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {projectCount} {projectCount === 1 ? 'project' : 'projects'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/admin"
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'admin'
              ? 'text-brand-700 bg-brand-50 border border-brand-100 font-semibold shadow-sm'
              : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          title="Manage projects database on the map twin"
        >
          <svg className={`w-4 h-4 ${activeTab === 'admin' ? 'text-brand-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Project Admin
        </Link>
        <Link
          to="/model-viewer"
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'viewer'
              ? 'text-brand-700 bg-brand-50 border border-brand-100 font-semibold shadow-sm'
              : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          title="Local diagnostic inspector for glTF/GLB tree hierarchy"
        >
          <svg className={`w-4 h-4 ${activeTab === 'viewer' ? 'text-brand-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Model Viewer
        </Link>
        <Link
          to="/model-processor"
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'processor'
              ? 'text-brand-700 bg-brand-50 border border-brand-100 font-semibold shadow-sm'
              : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          title="Optimize GLB models for web usage"
        >
          <svg className={`w-4 h-4 ${activeTab === 'processor' ? 'text-brand-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          Model Processor
        </Link>
      </div>
    </div>
  )
}
