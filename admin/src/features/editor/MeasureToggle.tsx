import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRulerCombined } from '@fortawesome/free-solid-svg-icons'
import { adminColors, adminRadii } from '../../styles/adminTheme'

interface MeasureToggleProps {
  pressed: boolean
  onChange: (on: boolean) => void
}

export function MeasureToggle({ pressed, onChange }: MeasureToggleProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      data-testid="measure-toggle"
      aria-pressed={pressed}
      title={t('preview.measureHint')}
      onClick={() => onChange(!pressed)}
      style={hitAreaStyle}
    >
      <span style={pillStyle(pressed)}>
        <FontAwesomeIcon icon={faRulerCombined} aria-hidden="true" />
        {t('preview.measure')}
      </span>
    </button>
  )
}

// A 44x44 hit area around a compact pill; the negative margin keeps the
// toolbar row at the height of its other controls.
const hitAreaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
  margin: '-6px 0',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
}

function pillStyle(pressed: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    minHeight: 28,
    boxSizing: 'border-box',
    borderRadius: adminRadii.pill,
    border: `1px solid ${pressed ? adminColors.primary : adminColors.border}`,
    background: pressed ? adminColors.primaryTint : adminColors.cardBg,
    color: pressed ? adminColors.textPrimary : adminColors.textSecondary,
    fontSize: 13,
    fontWeight: pressed ? 600 : 400,
    transition: 'all 150ms ease',
  }
}
