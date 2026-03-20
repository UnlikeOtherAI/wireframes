import { useTranslation } from 'react-i18next'
import { adminColors } from '../../styles/adminTheme'

interface PreviewBreadcrumbProps {
  pageId: string | null
  templateName: string | null
  routePath: string | null
}

export function PreviewBreadcrumb({ pageId, templateName, routePath }: PreviewBreadcrumbProps) {
  const { t } = useTranslation()

  if (!pageId) return null

  const parts: string[] = []
  if (templateName) parts.push(templateName)
  parts.push(pageId)
  if (routePath) parts.push(routePath)

  return (
    <nav
      aria-label={t('preview.breadcrumb')}
      data-testid="preview-breadcrumb"
      style={{
        padding: '4px 12px',
        fontSize: 12,
        color: adminColors.textTertiary,
        borderBottom: `1px solid ${adminColors.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 28,
      }}
    >
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span aria-hidden="true" style={{ color: adminColors.border }}>/</span>}
          <span>{part}</span>
        </span>
      ))}
    </nav>
  )
}
