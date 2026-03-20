import { useTranslation } from 'react-i18next'
import type { RenderMode } from './usePreviewRenderer'

interface RenderModeToggleProps {
  value: RenderMode
  onChange: (mode: RenderMode) => void
}

export function RenderModeToggle({ value, onChange }: RenderModeToggleProps) {
  const { t } = useTranslation()

  return (
    <div
      role="radiogroup"
      aria-label={t('preview.renderMode')}
      style={{
        display: 'flex',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <button
        role="radio"
        aria-checked={value === 'line'}
        onClick={() => onChange('line')}
        style={{
          padding: '4px 12px',
          border: 'none',
          background: value === 'line' ? '#e3f2fd' : '#fff',
          cursor: 'pointer',
          fontSize: '13px',
          minHeight: '32px',
          fontWeight: value === 'line' ? 600 : 400,
        }}
      >
        {t('preview.modeLine')}
      </button>
      <button
        role="radio"
        aria-checked={value === 'card'}
        onClick={() => onChange('card')}
        style={{
          padding: '4px 12px',
          border: 'none',
          borderLeft: '1px solid #ddd',
          background: value === 'card' ? '#e3f2fd' : '#fff',
          cursor: 'pointer',
          fontSize: '13px',
          minHeight: '32px',
          fontWeight: value === 'card' ? 600 : 400,
        }}
      >
        {t('preview.modeCard')}
      </button>
    </div>
  )
}
