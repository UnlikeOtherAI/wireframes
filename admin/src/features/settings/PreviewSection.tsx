import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updatePreviewSettings, publishPreview } from '../../api/preview'
import type { PreviewSettings } from '../../api/preview'

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #ddd',
  borderRadius: 8,
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  minHeight: 44,
  width: '100%',
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

const emailTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  backgroundColor: '#f1f3f4',
  borderRadius: 4,
  fontSize: 13,
  margin: '4px 4px 4px 0',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface PreviewSectionProps {
  projectId: string
  preview: PreviewSettings | null
  onPreviewChanged: (preview: PreviewSettings) => void
  readOnly?: boolean
}

export function PreviewSection({ projectId, preview, onPreviewChanged, readOnly = false }: PreviewSectionProps) {
  const { t } = useTranslation()
  const [accessMode, setAccessMode] = useState<string>(preview?.accessMode ?? 'public')
  const [password, setPassword] = useState('')
  const [ssoEmails, setSsoEmails] = useState<string[]>(preview?.emailAccessList ?? [])
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [publishError, setPublishError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleAccessModeChange(mode: string) {
    setAccessMode(mode)
    setError('')
    if (mode === 'password') {
      return
    }
    setSaving(true)
    try {
      const settings: { accessMode: string; emails?: string[] } = { accessMode: mode }
      if (mode === 'sso') {
        settings.emails = ssoEmails
      }
      const updated = await updatePreviewSettings(projectId, settings)
      onPreviewChanged(updated)
    } catch {
      setError(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePassword() {
    if (!password) {
      setError(t('settings.passwordRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updatePreviewSettings(projectId, {
        accessMode: 'password',
        password,
      })
      onPreviewChanged(updated)
      setPassword('')
    } catch {
      setError(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function handleAddEmail() {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (ssoEmails.includes(email)) {
      setNewEmail('')
      return
    }
    const updated = [...ssoEmails, email]
    setSsoEmails(updated)
    setNewEmail('')
    updatePreviewSettings(projectId, { accessMode: 'sso', emails: updated })
      .then(onPreviewChanged)
      .catch(() => setError(t('common.error')))
  }

  function handleRemoveEmail(email: string) {
    const updated = ssoEmails.filter((e) => e !== email)
    setSsoEmails(updated)
    updatePreviewSettings(projectId, { accessMode: 'sso', emails: updated })
      .then(onPreviewChanged)
      .catch(() => setError(t('common.error')))
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishError('')
    try {
      const updated = await publishPreview(projectId)
      onPreviewChanged(updated)
    } catch {
      setPublishError(t('settings.publishError'))
    } finally {
      setPublishing(false)
    }
  }

  function handleCopyLink() {
    if (preview?.url) {
      navigator.clipboard.writeText(preview.url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <section style={sectionStyle} aria-label={t('settings.previewSettings')}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('settings.previewSettings')}</h2>

      <label htmlFor="access-mode" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
        {t('settings.accessMode')}
      </label>
      <select
        id="access-mode"
        value={accessMode}
        onChange={(e) => handleAccessModeChange(e.target.value)}
        disabled={saving || readOnly}
        style={selectStyle}
      >
        <option value="public">{t('settings.accessPublic')}</option>
        <option value="password">{t('settings.accessPassword')}</option>
        <option value="sso">{t('settings.accessSso')}</option>
      </select>

      {accessMode === 'password' && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="preview-password" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            {t('settings.password')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="preview-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              disabled={saving || readOnly}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleSavePassword}
              disabled={saving || !password || readOnly}
              style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
            >
              {saving ? t('settings.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {accessMode === 'sso' && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="sso-email" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            {t('settings.ssoEmails')}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 8 }}>
            {ssoEmails.map((email) => (
              <span key={email} style={emailTagStyle}>
                {email}
                {!readOnly && <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: 14,
                    color: '#666',
                    minWidth: 20,
                    minHeight: 20,
                  }}
                  aria-label={`${t('common.delete')} ${email}`}
                >
                  x
                </button>}
              </span>
            ))}
          </div>
          {!readOnly && <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="sso-email"
              type="email"
              value={newEmail}
              placeholder={t('settings.addEmail')}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddEmail()
                }
              }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={!newEmail.trim()}
              style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
            >
              {t('settings.addEmail')}
            </button>
          </div>}
        </div>
      )}

      {error && <p style={errorStyle} role="alert">{error}</p>}

      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        {preview?.url && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              {t('settings.shareLink')}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={preview.url}
                style={{ ...inputStyle, flex: 1, backgroundColor: '#f1f3f4' }}
                aria-label={t('settings.shareLink')}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                style={{ ...buttonBase, backgroundColor: '#f1f3f4', color: '#333' }}
              >
                {copied ? t('settings.copied') : t('settings.copyLink')}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || readOnly}
            style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
          >
            {publishing ? t('settings.publishing') : t('settings.publish')}
          </button>
          <span style={{ fontSize: 13, color: '#666' }}>
            {preview?.publishedAt
              ? t('settings.lastPublished', { date: formatDate(preview.publishedAt) })
              : t('settings.notPublished')}
          </span>
        </div>
        {publishError && <p style={errorStyle} role="alert">{publishError}</p>}
      </div>
    </section>
  )
}
