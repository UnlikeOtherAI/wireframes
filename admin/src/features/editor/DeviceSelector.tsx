import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMobileScreen, faTabletScreenButton, faDesktop, faExpand } from '@fortawesome/free-solid-svg-icons'
import { DEVICE_ORDER, type DeviceType } from './usePreviewRenderer'
import { adminColors, adminRadii } from '../../styles/adminTheme'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

const DEVICE_ICONS: Record<DeviceType, { icon: IconDefinition; rotate?: number }> = {
  mobile_portrait: { icon: faMobileScreen },
  mobile_landscape: { icon: faMobileScreen, rotate: 90 },
  tablet_portrait: { icon: faTabletScreenButton },
  tablet_landscape: { icon: faTabletScreenButton, rotate: 90 },
  web: { icon: faDesktop },
  full_scale: { icon: faExpand },
}

interface DeviceSelectorProps {
  value: DeviceType
  onChange: (device: DeviceType) => void
}

export function DeviceSelector({ value, onChange }: DeviceSelectorProps) {
  const { t } = useTranslation()

  return (
    <div
      role="radiogroup"
      aria-label={t('preview.device')}
      style={containerStyle}
    >
      {DEVICE_ORDER.map((d) => {
        const { icon, rotate } = DEVICE_ICONS[d]
        const active = value === d
        return (
          <button
            key={d}
            role="radio"
            type="button"
            aria-checked={active}
            aria-label={t(`preview.devices.${d}`)}
            title={t(`preview.devices.${d}`)}
            onClick={() => onChange(d)}
            style={btnStyle(active)}
          >
            <FontAwesomeIcon
              icon={icon}
              style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
            />
          </button>
        )
      })}
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
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 28,
    borderRadius: adminRadii.pill,
    border: 'none',
    background: active ? adminColors.cardBg : 'transparent',
    color: active ? adminColors.primary : adminColors.textTertiary,
    cursor: 'pointer',
    fontSize: 13,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    transition: 'all 150ms ease',
  }
}
