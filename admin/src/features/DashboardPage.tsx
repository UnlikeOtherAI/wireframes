import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { listProjects, createProject } from '../api/projects'
import type { Project } from '../api/projects'
import { listPendingInvites } from '../api/invites'
import type { PendingInvite } from '../api/invites'
import { ProjectCard } from './ProjectCard'
import { InviteCard } from './InviteCard'
import { CreateProjectDialog } from './CreateProjectDialog'

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
}

const newCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '1',
  padding: 16,
  border: '2px dashed #ccc',
  borderRadius: 8,
  cursor: 'pointer',
  minHeight: 180,
  minWidth: 180,
  color: '#666',
  fontSize: 14,
}

const skeletonCardStyle: React.CSSProperties = {
  aspectRatio: '1',
  padding: 16,
  border: '1px solid #eee',
  borderRadius: 8,
  backgroundColor: '#f5f5f5',
  minHeight: 180,
  minWidth: 180,
  animation: 'pulse 1.5s ease-in-out infinite',
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '64px 16px',
  color: '#666',
}

const errorBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#fce8e6',
  borderRadius: 8,
  marginBottom: 16,
  color: '#c5221f',
}

const buttonBase: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '8px 16px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
}

type LoadState = 'loading' | 'loaded' | 'error'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    try {
      const [projectList, inviteList] = await Promise.all([
        listProjects(),
        listPendingInvites(),
      ])
      setProjects(projectList)
      setInvites(inviteList)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCreate(name: string) {
    setCreating(true)
    try {
      const project = await createProject(name)
      setProjects((prev) => [project, ...prev])
      setDialogOpen(false)
      navigate(`/projects/${project.id}`)
    } catch {
      setCreating(false)
    }
  }

  function handleInviteAccepted(invite: PendingInvite) {
    setInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  function handleInviteDeclined(invite: PendingInvite) {
    setInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  if (loadState === 'loading') {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h1>
        <div style={gridStyle} aria-busy="true" aria-label={t('common.loading')}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={skeletonCardStyle} />
          ))}
        </div>
      </main>
    )
  }

  if (loadState === 'error') {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h1>
        <div style={errorBannerStyle} role="alert">
          <span>{t('dashboard.networkError')}</span>
          <button
            type="button"
            onClick={loadData}
            style={{ ...buttonBase, backgroundColor: 'transparent', color: '#c5221f' }}
          >
            {t('dashboard.retry')}
          </button>
        </div>
      </main>
    )
  }

  const isEmpty = projects.length === 0 && invites.length === 0

  if (isEmpty) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h1>
        <div style={emptyStyle}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>{t('dashboard.noProjects')}</p>
          <p style={{ marginBottom: 16 }}>{t('dashboard.createFirst')}</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
          >
            {t('dashboard.createProject')}
          </button>
        </div>
        <CreateProjectDialog
          open={dialogOpen}
          creating={creating}
          onClose={() => { setDialogOpen(false); setCreating(false) }}
          onCreate={handleCreate}
        />
      </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h1>
      <div style={gridStyle}>
        {invites.map((invite) => (
          <InviteCard
            key={`invite-${invite.id}`}
            invite={invite}
            onAccepted={handleInviteAccepted}
            onDeclined={handleInviteDeclined}
          />
        ))}
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <div
          role="button"
          tabIndex={0}
          style={newCardStyle}
          onClick={() => setDialogOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setDialogOpen(true)
            }
          }}
          aria-label={t('dashboard.newProject')}
        >
          <span style={{ fontSize: 36, lineHeight: 1 }}>+</span>
          <span style={{ marginTop: 8 }}>{t('dashboard.newProject')}</span>
        </div>
      </div>
      <CreateProjectDialog
        open={dialogOpen}
        creating={creating}
        onClose={() => { setDialogOpen(false); setCreating(false) }}
        onCreate={handleCreate}
      />
    </main>
  )
}
