import { useTranslation } from 'react-i18next'
import type { DocumentSummary } from '../../api/documents'

interface DocumentTreeProps {
  documents: DocumentSummary[]
  activeDocType: string | null
  onSelect: (docType: string) => void
  isUnsaved: (docType: string) => boolean
}

const DOC_ORDER = ['manifest', 'sitemap', 'templates', 'components']

function groupDocuments(documents: DocumentSummary[]) {
  const root: DocumentSummary[] = []
  const pages: DocumentSummary[] = []
  const data: DocumentSummary[] = []

  for (const doc of documents) {
    if (doc.documentType.startsWith('page:')) {
      pages.push(doc)
    } else if (doc.documentType.startsWith('dataset:')) {
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

  pages.sort((a, b) => a.documentType.localeCompare(b.documentType))
  data.sort((a, b) => a.documentType.localeCompare(b.documentType))

  return { root, pages, data }
}

function docLabel(docType: string): string {
  if (docType.startsWith('page:')) return docType.slice(5) + '.yaml'
  if (docType.startsWith('dataset:')) return docType.slice(8) + '.yaml'
  return docType + '.yaml'
}

export function DocumentTree({ documents, activeDocType, onSelect, isUnsaved }: DocumentTreeProps) {
  const { t } = useTranslation()
  const { root, pages, data } = groupDocuments(documents)

  return (
    <nav aria-label={t('editor.documentTree')} style={{ width: '220px', borderRight: '1px solid #ddd', overflow: 'auto' }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
        {root.map((doc) => (
          <TreeItem
            key={doc.documentType}
            docType={doc.documentType}
            label={docLabel(doc.documentType)}
            active={activeDocType === doc.documentType}
            unsaved={isUnsaved(doc.documentType)}
            onSelect={onSelect}
          />
        ))}

        {pages.length > 0 && (
          <li>
            <div style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600, color: '#888', marginTop: '8px' }}>
              {t('editor.pages')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pages.map((doc) => (
                <TreeItem
                  key={doc.documentType}
                  docType={doc.documentType}
                  label={docLabel(doc.documentType)}
                  active={activeDocType === doc.documentType}
                  unsaved={isUnsaved(doc.documentType)}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </li>
        )}

        {data.length > 0 && (
          <li>
            <div style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600, color: '#888', marginTop: '8px' }}>
              {t('editor.data')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {data.map((doc) => (
                <TreeItem
                  key={doc.documentType}
                  docType={doc.documentType}
                  label={docLabel(doc.documentType)}
                  active={activeDocType === doc.documentType}
                  unsaved={isUnsaved(doc.documentType)}
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
  docType: string
  label: string
  active: boolean
  unsaved: boolean
  onSelect: (docType: string) => void
}

function TreeItem({ docType, label, active, unsaved, onSelect }: TreeItemProps) {
  return (
    <li>
      <button
        onClick={() => onSelect(docType)}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          padding: '4px 12px',
          border: 'none',
          background: active ? '#e3f2fd' : 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '13px',
          minHeight: '32px',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {unsaved && (
          <span
            aria-label="unsaved changes"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#f57c00',
              flexShrink: 0,
            }}
          />
        )}
      </button>
    </li>
  )
}
