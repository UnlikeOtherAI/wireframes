import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteProject } from '../../api/projects'
import type { Project } from '../../api/projects'

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #c5221f',
  borderRadius: 8,
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 8,
  padding: 24,
  width: 400,
  maxWidth: '90vw',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  boxSizing: 'border-box',
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

const errorStyle: React.CSSProperties = {
  color: '#d93025',
  fontSize: 13,
  margin: '4px 0 0',
}

interface DangerZoneSectionProps {
  project: Project
  onDeleted: () => void
}

export function DangerZoneSection({ project, onDeleted }: DangerZoneSectionProps) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (confirmName !== project.name) {
      setError(t('settings.deleteProjectNameMismatch'))
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteProject(project.id)
      onDeleted()
    } catch {
      setError(t('common.error'))
      setDeleting(false)
    }
  }

  function closeDialog() {
    if (!deleting) {
      setDialogOpen(false)
      setConfirmName('')
      setError('')
    }
  }

  return (
    <section style={sectionStyle} aria-label={t('settings.dangerZone')}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#c5221f' }}>
        {t('settings.dangerZone')}
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666' }}>
        {t('settings.deleteProjectDescription')}
      </p>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        style={{ ...buttonBase, backgroundColor: '#c5221f', color: '#fff' }}
      >
        {t('settings.deleteProject')}
      </button>

      {dialogOpen && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDialog()
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.deleteProject')}
        >
          <div style={dialogStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
              {t('settings.deleteProject')}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              {t('settings.deleteProjectConfirm')}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500 }}>
              {project.name}
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value)
                setError('')
              }}
              disabled={deleting}
              style={inputStyle}
              aria-label={t('settings.deleteProjectConfirm')}
            />
            {error && <p style={errorStyle} role="alert">{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                style={{ ...buttonBase, backgroundColor: '#f1f3f4', color: '#333' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || confirmName !== project.name}
                style={{ ...buttonBase, backgroundColor: '#c5221f', color: '#fff' }}
              >
                {deleting ? t('settings.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
