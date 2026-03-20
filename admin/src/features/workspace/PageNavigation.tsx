import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface PageNavigationProps {
  pageIds: string[]
  activePage: string
  onPageChange: (pageId: string) => void
}

interface PageGroup {
  label: string
  pages: string[]
}

function groupPages(pageIds: string[]): PageGroup[] {
  const grouped = new Map<string, string[]>()

  for (const id of pageIds) {
    const slashIdx = id.indexOf('/')
    const group = slashIdx > 0 ? id.slice(0, slashIdx) : ''
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(id)
  }

  const result: PageGroup[] = []
  for (const [label, pages] of grouped) {
    pages.sort((a, b) => a.localeCompare(b))
    result.push({ label, pages })
  }

  result.sort((a, b) => {
    if (a.label === '' && b.label !== '') return -1
    if (a.label !== '' && b.label === '') return 1
    return a.label.localeCompare(b.label)
  })

  return result
}

export function PageNavigation({ pageIds, activePage, onPageChange }: PageNavigationProps) {
  const { t } = useTranslation()
  const groups = useMemo(() => groupPages(pageIds), [pageIds])

  return (
    <nav
      aria-label={t('workspace.pageNavigation')}
      data-testid="workspace-page-navigation"
      style={{
        width: '200px',
        borderRight: '1px solid #ddd',
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {t('workspace.pages')}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {groups.map((group) => (
          <li key={group.label || '__root'}>
            {group.label && (
              <div
                style={{
                  padding: '6px 12px 2px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#666',
                }}
              >
                {group.label}/
              </div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.pages.map((pageId) => {
                const isActive = pageId === activePage
                const displayName = group.label
                  ? pageId.slice(group.label.length + 1)
                  : pageId
                return (
                  <li key={pageId}>
                    <button
                      onClick={() => onPageChange(pageId)}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '4px 12px 4px 20px',
                        border: 'none',
                        background: isActive ? '#e3f2fd' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '13px',
                        minHeight: '32px',
                        lineHeight: '24px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayName}
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}
