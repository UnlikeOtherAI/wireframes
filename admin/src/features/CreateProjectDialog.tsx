import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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

interface CreateProjectDialogProps {
  open: boolean
  creating: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export function CreateProjectDialog({ open, creating, onClose, onCreate }: CreateProjectDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  function validate(): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('dashboard.projectNameRequired'))
      return false
    }
    if (trimmed.length > 100) {
      setError(t('dashboard.projectNameMaxLength'))
      return false
    }
    setError('')
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) {
      onCreate(name.trim())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={t('dashboard.createProject')}
    >
      <div style={dialogStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('dashboard.createProject')}</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="project-name" style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            {t('dashboard.projectName')}
          </label>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError('')
            }}
            style={inputStyle}
            disabled={creating}
          />
          {error && <p style={errorStyle} role="alert">{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              style={{ ...buttonBase, backgroundColor: '#f1f3f4', color: '#333' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
            >
              {creating ? t('dashboard.creating') : t('dashboard.createProject')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
