import { useTranslation } from 'react-i18next'

interface PageSelectorProps {
  pageIds: string[]
  activePage: string | null
  onChange: (pageId: string) => void
}

export function PageSelector({ pageIds, activePage, onChange }: PageSelectorProps) {
  const { t } = useTranslation()

  if (pageIds.length === 0) return null

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
      }}
    >
      <span>{t('preview.page')}</span>
      <select
        value={activePage ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('preview.page')}
        style={{
          padding: '4px 8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '13px',
          minHeight: '32px',
        }}
      >
        {pageIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  )
}
