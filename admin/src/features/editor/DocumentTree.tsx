import { useTranslation } from 'react-i18next'
import type { DocumentSummary } from '../../api/documents'
import {
  adminColors,
  secondaryButtonStyle,
} from '../../styles/adminTheme'

interface DocumentTreeProps {
  documents: DocumentSummary[]
  activeDocType: string | null
  activeDocId: string | null
  onSelect: (documentType: string, documentId: string) => void
  isUnsaved: (documentType: string, documentId: string) => boolean
  onNewFile: () => void
}

const DOC_ORDER = ['manifest', 'sitemap', 'templates', 'components']

function groupDocuments(documents: DocumentSummary[]) {
  const root: DocumentSummary[] = []
  const pages: DocumentSummary[] = []
  const data: DocumentSummary[] = []

  for (const doc of documents) {
    if (doc.documentType === 'page') {
      pages.push(doc)
    } else if (doc.documentType === 'dataset') {
      data.push(doc)
    } else {
      root.push(doc)
    }
  }

  root.sort((a, b) => {
    const ai = DOC_ORDER.indexOf(a.documentType)
    const bi = DOC_ORDER.indexOf(b.documentType)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  pages.sort((a, b) => a.documentId.localeCompare(b.documentId))
  data.sort((a, b) => a.documentId.localeCompare(b.documentId))

  return { root, pages, data }
}

function docLabel(doc: DocumentSummary): string {
  if (doc.documentType === 'page' || doc.documentType === 'dataset') {
    return doc.documentId + '.yaml'
  }
  return doc.documentType + '.yaml'
}

export function DocumentTree({
  documents,
  activeDocType,
  activeDocId,
  onSelect,
  isUnsaved,
  onNewFile,
}: DocumentTreeProps) {
  const { t } = useTranslation()
  const { root, pages, data } = groupDocuments(documents)

  const isActive = (doc: DocumentSummary) =>
    activeDocType === doc.documentType && activeDocId === doc.documentId

  return (
    <nav aria-label={t('editor.documentTree')} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${adminColors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <strong style={{ fontSize: 14, color: adminColors.textPrimary }}>{t('editor.documentTree')}</strong>
          <button
            type="button"
            onClick={onNewFile}
            style={{ ...secondaryButtonStyle, minHeight: 36, padding: '8px 12px' }}
          >
            {t('editor.newFile')}
          </button>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
        {root.map((doc) => (
          <TreeItem
            key={`${doc.documentType}:${doc.documentId}`}
            doc={doc}
            label={docLabel(doc)}
            active={isActive(doc)}
            unsaved={isUnsaved(doc.documentType, doc.documentId)}
            onSelect={onSelect}
          />
        ))}

        {pages.length > 0 && (
          <li>
            <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, color: adminColors.textTertiary, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('editor.pages')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pages.map((doc) => (
                <TreeItem
                  key={`${doc.documentType}:${doc.documentId}`}
                  doc={doc}
                  label={docLabel(doc)}
                  active={isActive(doc)}
                  unsaved={isUnsaved(doc.documentType, doc.documentId)}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </li>
        )}

        {data.length > 0 && (
          <li>
            <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, color: adminColors.textTertiary, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('editor.data')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {data.map((doc) => (
                <TreeItem
                  key={`${doc.documentType}:${doc.documentId}`}
                  doc={doc}
                  label={docLabel(doc)}
                  active={isActive(doc)}
                  unsaved={isUnsaved(doc.documentType, doc.documentId)}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </li>
        )}
      </ul>
    </nav>
  )
}

interface TreeItemProps {
  doc: DocumentSummary
  label: string
  active: boolean
  unsaved: boolean
  onSelect: (documentType: string, documentId: string) => void
}

function TreeItem({ doc, label, active, unsaved, onSelect }: TreeItemProps) {
  return (
    <li>
      <button
        onClick={() => onSelect(doc.documentType, doc.documentId)}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '6px 12px',
          border: active ? `1px solid rgba(245, 101, 34, 0.25)` : '1px solid transparent',
          borderRadius: 10,
          background: active ? adminColors.primaryTint : 'transparent',
          color: active ? adminColors.primary : adminColors.textPrimary,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          minHeight: 36,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {unsaved && (
          <span
            aria-label="unsaved changes"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: adminColors.primary,
              flexShrink: 0,
            }}
          />
        )}
      </button>
    </li>
  )
}
