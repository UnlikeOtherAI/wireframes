import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { updateProfile, deleteAccount } from '../api/account'
import { changeLocale } from '../utils/locale'

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #ddd',
  borderRadius: 8,
}

const dangerSectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #c5221f',
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

export function AccountPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleSaveProfile() {
    const trimmed = displayName.trim()
    if (!trimmed) {
      setProfileError(t('account.displayNameRequired'))
      return
    }
    if (trimmed.length > 100) {
      setProfileError(t('account.displayNameMaxLength'))
      return
    }
    if (trimmed === user?.displayName) return

    setSaving(true)
    setProfileError('')
    setProfileSuccess(false)
    try {
      const updated = await updateProfile(trimmed)
      updateUser(updated)
      setProfileSuccess(true)
    } catch {
      setProfileError(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleLocaleChange(locale: string) {
    try {
      await changeLocale(locale)
    } catch {
      // Locale change is best-effort; i18n already changed client-side
    }
  }

  async function handleDeleteAccount() {
    if (confirmEmail !== user?.email) {
      setDeleteError(t('account.deleteAccountEmailMismatch'))
      return
    }
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteAccount(user.email)
      logout()
      window.location.href = '/login'
    } catch {
      setDeleteError(t('common.error'))
      setDeleting(false)
    }
  }

  function closeDialog() {
    if (!deleting) {
      setDialogOpen(false)
      setConfirmEmail('')
      setDeleteError('')
    }
  }

  const hasNameChanges = displayName.trim() !== (user?.displayName ?? '')

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <button type="button" style={backLinkStyle} onClick={() => navigate('/')}>
        {t('account.backToDashboard')}
      </button>
      <h1 style={{ marginBottom: 24 }}>{t('account.title')}</h1>

      {/* Profile Section */}
      <section style={sectionStyle} aria-label={t('account.profile')}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('account.profile')}</h2>

        <label htmlFor="display-name" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          {t('account.displayName')}
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          maxLength={100}
          disabled={saving}
          onChange={(e) => {
            setDisplayName(e.target.value)
            setProfileError('')
            setProfileSuccess(false)
          }}
          style={inputStyle}
        />
        {profileError && <p style={errorStyle} role="alert">{profileError}</p>}
        {profileSuccess && <p style={successStyle} role="status">{t('account.saved')}</p>}

        <div style={{ marginTop: 16 }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            {t('account.email')}
          </label>
          <input
            id="email"
            type="email"
            value={user?.email ?? ''}
            disabled
            style={{ ...inputStyle, backgroundColor: '#f5f5f5', color: '#666' }}
            aria-readonly="true"
          />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
            {t('account.emailReadOnly')}
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving || !hasNameChanges}
            style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
          >
            {saving ? t('account.saving') : t('common.save')}
          </button>
        </div>
      </section>

      {/* Language Section */}
      <section style={sectionStyle} aria-label={t('account.language')}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('account.language')}</h2>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
          {t('account.languageDescription')}
        </p>
        <label htmlFor="language-select" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          {t('account.language')}
        </label>
        <select
          id="language-select"
          value={i18n.language}
          onChange={(e) => handleLocaleChange(e.target.value)}
          style={{
            ...inputStyle,
            minHeight: 44,
            cursor: 'pointer',
          }}
        >
          <option value="en">{t('account.english')}</option>
        </select>
      </section>

      {/* Sessions Section */}
      <section style={sectionStyle} aria-label={t('account.sessions')}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('account.sessions')}</h2>
        <div style={{ fontSize: 14, color: '#333' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{t('account.currentSession')}</p>
          <p style={{ margin: 0, color: '#666' }}>
            {t('account.loggedInSince', { date: new Date().toLocaleDateString() })}
          </p>
        </div>
      </section>

      {/* Danger Zone */}
      <section style={dangerSectionStyle} aria-label={t('account.dangerZone')}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#c5221f' }}>
          {t('account.dangerZone')}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666' }}>
          {t('account.deleteAccountDescription')}
        </p>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          style={{ ...buttonBase, backgroundColor: '#c5221f', color: '#fff' }}
        >
          {t('account.deleteAccount')}
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
            aria-label={t('account.deleteAccount')}
          >
            <div style={dialogStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
                {t('account.deleteAccount')}
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                {t('account.deleteAccountConfirm')}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500 }}>
                {user?.email}
              </p>
              <input
                type="text"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value)
                  setDeleteError('')
                }}
                disabled={deleting}
                style={inputStyle}
                aria-label={t('account.deleteAccountConfirm')}
              />
              {deleteError && <p style={errorStyle} role="alert">{deleteError}</p>}
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
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmEmail !== user?.email}
                  style={{ ...buttonBase, backgroundColor: '#c5221f', color: '#fff' }}
                >
                  {deleting ? t('account.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
