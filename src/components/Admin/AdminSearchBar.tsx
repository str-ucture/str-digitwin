import { LayoutGrid, List } from 'lucide-react'

interface AdminSearchBarProps {
  value: string
  onChange: (value: string) => void
  resultsCount: number
  showResultsCount: boolean
  onAddProject: () => void
  viewMode: 'table' | 'grid'
  onViewModeChange: (mode: 'table' | 'grid') => void
}

export default function AdminSearchBar({
  value,
  onChange,
  resultsCount,
  showResultsCount,
  onAddProject,
  viewMode,
  onViewModeChange,
}: AdminSearchBarProps) {
  return (
    <div className="mb-4 flex items-center justify-end gap-3">
      {/* View Toggle (Table / Grid) */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-auto">
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          className={`p-1.5 rounded-md transition-all ${
            viewMode === 'table'
              ? 'bg-white text-brand-600 shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Table View"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 rounded-md transition-all ${
            viewMode === 'grid'
              ? 'bg-white text-brand-600 shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={onAddProject}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition-colors shadow-sm shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add project
      </button>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, city, client…"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="pl-9 pr-4 py-2 w-72 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors"
        />
      </div>
      {showResultsCount && (
        <span className="text-sm text-gray-500 animate-in fade-in duration-200">
          {resultsCount} result{resultsCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
