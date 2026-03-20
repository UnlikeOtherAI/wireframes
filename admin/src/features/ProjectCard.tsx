import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Project } from '../api/projects'

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  aspectRatio: '1',
  padding: 16,
  border: '1px solid #ddd',
  borderRadius: 8,
  cursor: 'pointer',
  minHeight: 180,
  minWidth: 180,
}

const nameStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 4,
  fontWeight: 500,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  color: '#666',
}

function roleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return '#e8f0fe'
    case 'editor':
      return '#e6f4ea'
    default:
      return '#f1f3f4'
  }
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

function RoleIcon({ role }: { role: string }) {
  if (role === 'viewer') {
    return (
      <span aria-hidden="true" style={{ fontSize: 18 }}>
        &#x1F441;
      </span>
    )
  }
  return (
    <span aria-hidden="true" style={{ fontSize: 18 }}>
      &#x270F;
    </span>
  )
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
      aria-label={project.name}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <h2 style={nameStyle}>{project.name}</h2>
          <RoleIcon role={project.role} />
        </div>
        <span style={{ ...badgeStyle, backgroundColor: roleBadgeColor(project.role) }}>
          {roleLabel(t, project.role)}
        </span>
      </div>
      <div style={footerStyle}>
        <span>{t('dashboard.lastUpdated', { date: formatDate(project.updatedAt) })}</span>
      </div>
    </div>
  )
}
