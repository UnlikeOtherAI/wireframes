interface PreviewBreadcrumbProps {
  pageId: string | null
  templateName: string | null
  routePath: string | null
}

export function PreviewBreadcrumb({ pageId, templateName, routePath }: PreviewBreadcrumbProps) {
  if (!pageId) return null

  const parts: string[] = []
  if (templateName) parts.push(templateName)
  parts.push(pageId)
  if (routePath) parts.push(routePath)

  return (
    <nav
      aria-label="Preview breadcrumb"
      data-testid="preview-breadcrumb"
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        color: '#666',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minHeight: '28px',
      }}
    >
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {i > 0 && <span aria-hidden="true" style={{ color: '#ccc' }}>/</span>}
          <span>{part}</span>
        </span>
      ))}
    </nav>
  )
}
