import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFile, faFileLines } from '@fortawesome/free-solid-svg-icons'
import type { Project } from '../api/projects'
import {
  adminColors,
  adminRadii,
  cardSurfaceStyle,
} from '../styles/adminTheme'

const cardStyle: React.CSSProperties = {
  ...cardSurfaceStyle,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 20,
  cursor: 'pointer',
  minHeight: 180,
  transition: 'box-shadow 150ms ease, transform 150ms ease',
}

const nameStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: adminColors.textPrimary,
}

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  owner: { bg: adminColors.primaryTint, text: adminColors.primary, border: `rgba(245, 101, 34, 0.2)` },
  editor: { bg: adminColors.successBg, text: adminColors.successText, border: `rgba(34, 197, 94, 0.2)` },
  viewer: { bg: adminColors.surfaceMuted, text: adminColors.textSecondary, border: adminColors.border },
}

function roleBadge(role: string) {
  const colors = roleColors[role] ?? roleColors.viewer
  return {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: adminRadii.pill,
    backgroundColor: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  } as React.CSSProperties
}

function roleLabel(t: (key: string) => string, role: string): string {
  switch (role) {
    case 'owner':
      return t('dashboard.roleOwner')
    case 'editor':
      return t('dashboard.roleEditor')
    default:
      return t('dashboard.roleViewer')
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const initials = project.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      role="link"
      tabIndex={0}
      style={cardStyle}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/projects/${project.id}`)
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
      aria-label={project.name}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
          <h2 style={nameStyle}>{project.name}</h2>
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              display: 'grid',
              placeItems: 'center',
              borderRadius: adminRadii.button,
              background: adminColors.primaryTint,
              color: adminColors.primary,
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={roleBadge(project.role)}>
            {roleLabel(t, project.role)}
          </span>
        </div>
      </div>
      <div>
        <div style={statsRowStyle}>
          <span style={statStyle}>
            <FontAwesomeIcon icon={faFile} style={{ marginRight: 5 }} />
            {t('dashboard.fileCount', { count: Number(project.documentCount ?? 0) })}
          </span>
          <span style={statStyle}>
            <FontAwesomeIcon icon={faFileLines} style={{ marginRight: 5 }} />
            {t('dashboard.pageCount', { count: Number(project.pageCount ?? 0) })}
          </span>
        </div>
        <div style={{ fontSize: 12, color: adminColors.textTertiary, marginTop: 8 }}>
          {t('dashboard.lastUpdated', { date: formatDate(project.updatedAt) })}
        </div>
      </div>
    </div>
  )
}

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
}

const statStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 12,
  color: adminColors.textSecondary,
}
