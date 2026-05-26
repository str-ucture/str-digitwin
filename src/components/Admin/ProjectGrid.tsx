import type { Project } from '../../types/project'
import { PROJECT_TYPE_COLORS, PROJECT_STATUS_COLORS } from '../../lib/mapbox'
import { Pencil, Trash2 } from 'lucide-react'

interface ProjectGridProps {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
  onToggleVisible: (id: string, currentVisible: boolean) => void
  onAddNew: () => void
  isSearching: boolean
}

export default function ProjectGrid({
  projects,
  onEdit,
  onDelete,
  onToggleVisible,
  onAddNew,
  isSearching,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="py-20 text-center flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm">
        <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm font-medium text-gray-400">
          {isSearching ? 'No projects match your search' : 'No projects yet'}
        </p>
        {!isSearching && (
          <button
            onClick={onAddNew}
            className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium cursor-pointer"
          >
            Add your first project →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {projects.map(project => {
          const typeColor = PROJECT_TYPE_COLORS[project.type]
          const statusColor = PROJECT_STATUS_COLORS[project.status]
          const year = project.completion_date
            ? new Date(project.completion_date).getFullYear()
            : null

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md hover:border-gray-300 transition-all duration-200 relative group"
            >
              {/* Card Thumbnail / Header */}
              <div className="h-40 w-full relative overflow-hidden bg-gray-50 flex-shrink-0">
                {project.thumbnail_url ? (
                  <img
                    src={project.thumbnail_url}
                    alt={project.name_en}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: `${typeColor}15` }}
                  >
                    <svg
                      className="w-10 h-10"
                      style={{ color: typeColor }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12"
                      />
                    </svg>
                  </div>
                )}

                {/* Featured Badge Overlay */}
                {project.featured && (
                  <span className="absolute top-2.5 right-2.5 bg-amber-400 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm z-10 select-none">
                    ★ Featured
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Category Type Tag */}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider select-none"
                    style={{
                      backgroundColor: `${typeColor}15`,
                      color: typeColor,
                    }}
                  >
                    {project.type.replace('_', ' ')}
                  </span>

                  {/* Title / Description */}
                  <h4
                    className="font-semibold text-gray-900 mt-2.5 leading-snug line-clamp-1"
                    title={project.name_en}
                  >
                    {project.name_en}
                  </h4>
                  <p
                    className="text-xs text-gray-400 mt-0.5 line-clamp-1"
                    title={project.name_de}
                  >
                    {project.name_de}
                  </p>

                  {/* Location & Year Metadata */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span className="truncate max-w-[120px]" title={project.city}>
                      📍 {project.city}
                    </span>
                    {year && (
                      <span className="text-gray-400">
                        📅 {year}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Status, Switch, Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {/* Status Indicator */}
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusColor }}
                    />
                    {project.status}
                  </span>

                  <div className="flex items-center gap-3">
                    {/* Visibility Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={project.visible !== false}
                      onClick={() => onToggleVisible(project.id, project.visible !== false)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${
                        project.visible !== false ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                      title={
                        project.visible !== false
                          ? 'Visible on map (Click to hide)'
                          : 'Hidden from map (Click to show)'
                      }
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          project.visible !== false ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-0.5 border-l border-gray-100 pl-2">
                      <button
                        onClick={() => onEdit(project)}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit project"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(project.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
