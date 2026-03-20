import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import type { DocumentSummary } from '../../api/documents'
import {
  adminColors,
  adminRadii,
  adminShadows,
  cardSurfaceStyle,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../../styles/adminTheme'

interface CreateFileDialogProps {
  open: boolean
  documents: DocumentSummary[]
  onClose: () => void
  onCreateDocument: (documentType: string, documentId: string) => Promise<void>
}

export function CreateFileDialog({
  open,
  documents,
  onClose,
  onCreateDocument,
}: CreateFileDialogProps) {
  const { t } = useTranslation()
  const [documentType, setDocumentType] = useState('page')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState('')

  const existingSingletons = useMemo(
    () => new Set(documents.filter((d) => d.documentType !== 'page' && d.documentType !== 'dataset').map((d) => d.documentType)),
    [documents],
  )

  if (!open) return null

  async function handleCreate() {
    const trimmedId = documentId.trim()
    const resolvedId = documentType === 'page' || documentType === 'dataset'
      ? trimmedId
      : documentType

    if (!resolvedId) {
      setError(t('editor.newFileIdRequired'))
      return
    }

    if (documentType !== 'page' && documentType !== 'dataset' && existingSingletons.has(documentType)) {
      setError(t('editor.newFileExists'))
      return
    }

    setError('')
    try {
      await onCreateDocument(documentType, resolvedId)
      handleClose()
    } catch {
      setError(t('editor.newFileError'))
    }
  }

  function handleClose() {
    setDocumentType('page')
    setDocumentId('')
    setError('')
    onClose()
  }

  return (
    <div style={backdropStyle} onClick={handleClose}>
      <section
        role="dialog"
        aria-label={t('editor.newFile')}
        data-testid="create-file-dialog"
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('editor.newFile')}</h2>
          <button
            type="button"
            aria-label={t('chat.close')}
            onClick={handleClose}
            style={closeButtonStyle}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('editor.newFileType')}</label>
            <select
              aria-label={t('editor.newFileType')}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="page">{t('editor.newFilePage')}</option>
              <option value="dataset">{t('editor.newFileDataset')}</option>
              <option value="manifest">manifest.yaml</option>
              <option value="sitemap">sitemap.yaml</option>
              <option value="templates">templates.yaml</option>
              <option value="components">components.yaml</option>
            </select>
          </div>

          {(documentType === 'page' || documentType === 'dataset') && (
            <div>
              <label style={labelStyle}>{t('editor.newFileId')}</label>
              <input
                aria-label={t('editor.newFileId')}
                placeholder={t('editor.newFileId')}
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p role="alert" style={{ margin: 0, color: adminColors.dangerText, fontSize: 12 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ ...secondaryButtonStyle, minHeight: 36, padding: '8px 16px' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              style={{ ...primaryButtonStyle, minHeight: 36, padding: '8px 16px' }}
            >
              {t('editor.newFileCreate')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.25)',
  backdropFilter: 'blur(4px)',
  zIndex: 50,
}

const dialogStyle: CSSProperties = {
  ...cardSurfaceStyle,
  width: '100%',
  maxWidth: 420,
  padding: 24,
  boxShadow: adminShadows.modal,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
}

const closeButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  display: 'grid',
  placeItems: 'center',
  border: 'none',
  borderRadius: adminRadii.button,
  background: 'transparent',
  color: adminColors.textSecondary,
  fontSize: 20,
  cursor: 'pointer',
  lineHeight: 1,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: adminColors.textSecondary,
  marginBottom: 4,
}
