import { useTranslation } from 'react-i18next'
import type { ProjectFilters, ProjectType, ProjectStatus } from '../../types/project'

interface FilterBarProps {
  filters: ProjectFilters
  onChange: (filters: ProjectFilters) => void
}

const TYPES: Array<{ value: ProjectType | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'filters.all' },
  { value: 'architecture', labelKey: 'types.architecture' },
  { value: 'infrastructure', labelKey: 'types.infrastructure' },
  { value: 'urban_planning', labelKey: 'types.urban_planning' },
]

const STATUSES: Array<{ value: ProjectStatus | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'filters.all' },
  { value: 'completed', labelKey: 'status.completed' },
  { value: 'ongoing', labelKey: 'status.ongoing' },
  { value: 'planned', labelKey: 'status.planned' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i)

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const { t } = useTranslation()

  const hasActiveFilters =
    filters.type !== 'all' ||
    filters.status !== 'all' ||
    filters.year !== null ||
    filters.search.trim() !== ''

  function clearAll() {
    onChange({ type: 'all', status: 'all', year: null, search: '' })
  }

  return (
    <div className="px-4 py-3 border-b border-gray-100 space-y-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder={t('filters.search')}
          className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-400"
        />
      </div>

      {/* Type filter */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{t('filters.type')}</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, type: opt.value })}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                filters.type === opt.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Status + Year row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t('filters.status')}</p>
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value as ProjectStatus | 'all' })}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t('filters.year')}</p>
          <select
            value={filters.year ?? ''}
            onChange={(e) =>
              onChange({ ...filters, year: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{t('filters.all')}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          {t('filters.clear')}
        </button>
      )}
    </div>
  )
}
