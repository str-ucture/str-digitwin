import { useState, useEffect } from 'react'
import type { Project } from '../../types/project'
import { PROJECT_TYPE_COLORS, PROJECT_STATUS_COLORS } from '../../lib/mapbox'
import { Pencil, Trash2 } from 'lucide-react'

interface ProjectTableProps {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
  onToggleVisible: (id: string, currentVisible: boolean) => void
  onAddNew: () => void
  isSearching: boolean
}

export default function ProjectTable({ projects, onEdit, onDelete, onToggleVisible, onAddNew, isSearching }: ProjectTableProps) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0)

  useEffect(() => {
    const outer = document.createElement('div')
    outer.className = 'sidebar-scroll'
    outer.style.visibility = 'hidden'
    outer.style.overflow = 'scroll'
    outer.style.width = '100px'
    outer.style.position = 'absolute'
    outer.style.top = '-9999px'
    document.body.appendChild(outer)

    const inner = document.createElement('div')
    inner.style.width = '100%'
    outer.appendChild(inner)

    const width = 100 - inner.offsetWidth
    outer.parentNode?.removeChild(outer)

    setScrollbarWidth(width)
  }, [])

  if (projects.length === 0) {
    return (
      <div className="py-20 text-center">
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
            className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Add your first project →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0 shadow-sm overflow-hidden relative">
      {/* Horizontally scrollable wrapper */}
      <div className="flex-1 min-h-0 overflow-x-auto flex flex-col sidebar-scroll">
        <div className="min-w-[900px] flex-1 flex flex-col min-h-0">
          {/* Header table container */}
          <div className="bg-gray-100 border-b border-gray-150 flex-shrink-0" style={{ paddingRight: `${scrollbarWidth}px`, overflowY: 'hidden' }}>
            <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="text-left divide-x divide-gray-200/50">
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">City</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">Year</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide text-center">Featured</th>
                  <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide text-center">Visible</th>
                  <th className="px-4 py-3 w-28 font-bold text-gray-700 text-xs uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Body table container */}
          <div className="flex-grow overflow-y-scroll sidebar-scroll">
            <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-28" />
              </colgroup>
              <tbody className="divide-y divide-gray-100">
                {projects.map(project => (
                  <tr
                    key={project.id}
                    className="hover:bg-gray-50 transition-colors group divide-x divide-gray-100"
                  >
                    {/* Name + thumbnail */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {project.thumbnail_url ? (
                            <img
                              src={project.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: `${PROJECT_TYPE_COLORS[project.type]}18` }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]" title={project.name_en}>
                            {project.name_en}
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]" title={project.name_de}>
                            {project.name_de}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: `${PROJECT_TYPE_COLORS[project.type]}15`,
                          color: PROJECT_TYPE_COLORS[project.type],
                        }}
                      >
                        {project.type.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <span className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PROJECT_STATUS_COLORS[project.status] }}
                        />
                        {project.status}
                      </span>
                    </td>

                    {/* City */}
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap truncate border-b border-gray-100" title={project.city}>{project.city}</td>

                    {/* Year */}
                    <td className="px-4 py-3 text-gray-400 text-xs border-b border-gray-100">
                      {project.completion_date
                        ? new Date(project.completion_date).getFullYear()
                        : '—'}
                    </td>

                    {/* Featured */}
                    <td className="px-4 py-3 text-center border-b border-gray-100">
                      {project.featured && <span className="text-amber-400" title="Featured project">★</span>}
                    </td>

                    {/* Visible toggle */}
                    <td className="px-4 py-3 text-center border-b border-gray-100">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={project.visible !== false}
                        onClick={() => onToggleVisible(project.id, project.visible !== false)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          project.visible !== false ? 'bg-brand-600' : 'bg-gray-200'
                        }`}
                        title={project.visible !== false ? 'Visible on map (Click to hide)' : 'Hidden from map (Click to show)'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                            project.visible !== false ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => onEdit(project)}
                          className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit project"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(project.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
