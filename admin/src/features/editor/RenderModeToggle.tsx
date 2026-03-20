import { useTranslation } from 'react-i18next'
import type { RenderMode } from './usePreviewRenderer'
import { adminColors, adminRadii } from '../../styles/adminTheme'

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
      style={containerStyle}
    >
      {(['line', 'card'] as const).map((mode) => (
        <button
          key={mode}
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          style={btnStyle(value === mode)}
        >
          {t(mode === 'line' ? 'preview.modeLine' : 'preview.modeCard')}
        </button>
      ))}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  background: adminColors.surfaceMuted,
  borderRadius: adminRadii.pill,
  padding: 2,
  gap: 2,
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 14px',
    borderRadius: adminRadii.pill,
    border: 'none',
    background: active ? adminColors.cardBg : 'transparent',
    color: active ? adminColors.textPrimary : adminColors.textTertiary,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    minHeight: 28,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    transition: 'all 150ms ease',
  }
}
