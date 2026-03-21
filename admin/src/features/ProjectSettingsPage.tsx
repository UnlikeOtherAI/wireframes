import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProject } from '../api/projects'
import type { Project } from '../api/projects'
import { listMembers } from '../api/members'
import type { Member } from '../api/members'
import { getPreviewSettings } from '../api/preview'
import type { PreviewSettings } from '../api/preview'
import { useAuthStore } from '../stores/authStore'
import { GeneralSection } from './settings/GeneralSection'
import { MembersSection } from './settings/MembersSection'
import { PreviewSection } from './settings/PreviewSection'
import { DangerZoneSection } from './settings/DangerZoneSection'

const skeletonStyle: React.CSSProperties = {
  height: 24,
  backgroundColor: '#f5f5f5',
  borderRadius: 4,
  marginBottom: 16,
  animation: 'pulse 1.5s ease-in-out infinite',
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

const backLinkStyle: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: 'transparent',
  color: '#1a73e8',
  padding: 0,
  minWidth: 'auto',
  minHeight: 'auto',
  marginBottom: 16,
  display: 'inline-block',
}

type LoadState = 'loading' | 'loaded' | 'error'

export function ProjectSettingsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [preview, setPreview] = useState<PreviewSettings | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const loadData = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    try {
      const [proj, memberList, previewData] = await Promise.all([
        getProject(id),
        listMembers(id),
        getPreviewSettings(id).catch(() => null),
      ])
      setProject(proj)
      setMembers(memberList)
      setPreview(previewData)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const role = project?.role ?? 'viewer'
  const isOwner = role === 'owner'
  const isEditorOrAbove = role === 'owner' || role === 'editor'

  if (loadState === 'loading') {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>
        <div aria-busy="true" aria-label={t('common.loading')}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ ...skeletonStyle, width: i % 2 === 0 ? '80%' : '60%' }} />
          ))}
        </div>
      </main>
    )
  }

  if (loadState === 'error' || !project) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>
        <div style={errorBannerStyle} role="alert">
          <span>{t('settings.networkError')}</span>
          <button
            type="button"
            onClick={loadData}
            style={{ ...buttonBase, backgroundColor: 'transparent', color: '#c5221f' }}
          >
            {t('settings.retry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <Link to={`/projects/${id}`} style={backLinkStyle}>
        {t('settings.backToProject')}
      </Link>
      <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>

      {!isEditorOrAbove && (
        <div
          style={{ padding: '12px 16px', backgroundColor: '#f1f3f4', borderRadius: 8, marginBottom: 24, color: '#666' }}
          role="status"
        >
          {t('settings.readOnlyNotice')}
        </div>
      )}

      <GeneralSection
        project={project}
        canEdit={isEditorOrAbove}
        onRenamed={(updated) => setProject(updated)}
      />

      {isOwner && (
        <MembersSection
          projectId={project.id}
          members={members}
          currentUserId={user?.id ?? ''}
          onMembersChanged={setMembers}
        />
      )}

      <PreviewSection
        projectId={project.id}
        preview={preview}
        onPreviewChanged={setPreview}
        readOnly={!isEditorOrAbove}
      />

      {isOwner && (
        <DangerZoneSection
          project={project}
          onDeleted={() => navigate('/')}
        />
      )}
    </main>
  )
}
