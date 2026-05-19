import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import FilterBar from './FilterBar'
import ProjectCard from './ProjectCard'
import LoadingSpinner from '../UI/LoadingSpinner'
import type { Project, ProjectFilters } from '../../types/project'

const COLLAPSE_BREAKPOINT = 1024

interface SidebarProps {
  projects: Project[]
  loading: boolean
  error: string | null
  filters: ProjectFilters
  onFiltersChange: (filters: ProjectFilters) => void
  selectedProjectId: string | null
  onSelectProject: (project: Project | null) => void
  hoveredProjectId?: string | null
  onHoverProject?: (projectId: string | null) => void
}

export default function Sidebar({
  projects,
  loading,
  error,
  filters,
  onFiltersChange,
  selectedProjectId,
  onSelectProject,
  hoveredProjectId,
  onHoverProject,
}: SidebarProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < COLLAPSE_BREAKPOINT)

  useEffect(() => {
    function handleResize() {
      setCollapsed(window.innerWidth < COLLAPSE_BREAKPOINT)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <aside
      className={`${collapsed ? 'w-10' : 'w-80'} flex flex-col border-r border-gray-100 bg-white flex-shrink-0 overflow-hidden transition-all duration-300`}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex-1 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          title={t('sidebar.expand', 'Expand sidebar')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <>
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {t('sidebar.projects')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(true)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                title={t('sidebar.collapse', 'Collapse sidebar')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          <FilterBar filters={filters} onChange={onFiltersChange} />

          {/* Project list */}
          <div className="flex-1 overflow-y-auto sidebar-scroll">
            {loading && (
              <div className="py-12">
                <LoadingSpinner />
                <p className="text-center text-xs text-gray-400 mt-3">{t('sidebar.loading')}</p>
              </div>
            )}

            {!loading && error && (
              <div className="p-4 text-center">
                <p className="text-sm text-red-500">{t('sidebar.error')}</p>
                <p className="text-xs text-gray-400 mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && projects.length === 0 && (
              <div className="p-8 text-center">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
                </svg>
                <p className="text-sm text-gray-400">{t('sidebar.noProjects')}</p>
              </div>
            )}

            {!loading && !error && projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelected={project.id === selectedProjectId}
                isHovered={project.id === hoveredProjectId}
                onMouseEnter={() => onHoverProject?.(project.id)}
                onMouseLeave={() => onHoverProject?.(null)}
                onClick={() => onSelectProject(project.id === selectedProjectId ? null : project)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
