import { useTranslation } from 'react-i18next'
import { PROJECT_TYPE_COLORS, PROJECT_STATUS_COLORS } from '../../lib/mapbox'
import type { Project } from '../../types/project'

interface ProjectCardProps {
  project: Project
  isSelected: boolean
  isHovered?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick: () => void
}

export default function ProjectCard({ project, isSelected, isHovered, onMouseEnter, onMouseLeave, onClick }: ProjectCardProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('de') ? 'de' : 'en'
  const name = lang === 'de' ? project.name_de : project.name_en
  const typeColor = PROJECT_TYPE_COLORS[project.type]
  const statusColor = PROJECT_STATUS_COLORS[project.status]

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
        isSelected ? 'bg-brand-50 border-l-2 border-l-brand-500' : isHovered ? 'bg-gray-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50/50 flex items-center justify-center border border-gray-100">
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt={name}
              className="w-10 h-10 object-contain p-1"
              loading="lazy"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <span className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{name}</span>
            {project.featured && (
              <span className="flex-shrink-0 text-amber-500" title={t('project.featured')}>★</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type badge */}
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${typeColor}18`, color: typeColor }}
            >
              {t(`types.${project.type}`)}
            </span>

            {/* Status dot */}
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusColor }}
              />
              {t(`status.${project.status}`)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
