import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renameProject } from '../../api/projects'
import type { Project } from '../../api/projects'

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #ddd',
  borderRadius: 8,
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

const successStyle: React.CSSProperties = {
  color: '#188038',
  fontSize: 13,
  margin: '4px 0 0',
}

interface GeneralSectionProps {
  project: Project
  canEdit: boolean
  onRenamed: (project: Project) => void
}

export function GeneralSection({ project, canEdit, onRenamed }: GeneralSectionProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(project.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('settings.projectNameRequired'))
      return
    }
    if (trimmed.length > 100) {
      setError(t('settings.projectNameMaxLength'))
      return
    }
    if (trimmed === project.name) return

    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const updated = await renameProject(project.id, trimmed)
      onRenamed(updated)
      setSuccess(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = name.trim() !== project.name

  return (
    <section style={sectionStyle} aria-label={t('settings.general')}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('settings.general')}</h2>
      <label htmlFor="project-name" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
        {t('settings.projectName')}
      </label>
      <input
        id="project-name"
        type="text"
        value={name}
        maxLength={100}
        disabled={!canEdit || saving}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
          setSuccess(false)
        }}
        style={inputStyle}
      />
      {error && <p style={errorStyle} role="alert">{error}</p>}
      {success && <p style={successStyle} role="status">{t('settings.saved')}</p>}
      {canEdit && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
          >
            {saving ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      )}
    </section>
  )
}
