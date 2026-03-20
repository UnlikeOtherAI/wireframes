import { useTranslation } from 'react-i18next'
import { DEVICE_VIEWPORTS, type DeviceType } from './usePreviewRenderer'

const DEVICE_ORDER: DeviceType[] = [
  'web',
  'tablet_portrait',
  'tablet_landscape',
  'mobile_portrait',
  'mobile_landscape',
]

interface DeviceSelectorProps {
  value: DeviceType
  onChange: (device: DeviceType) => void
}

export function DeviceSelector({ value, onChange }: DeviceSelectorProps) {
  const { t } = useTranslation()

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
      }}
    >
      <span>{t('preview.device')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DeviceType)}
        aria-label={t('preview.device')}
        style={{
          padding: '4px 8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '13px',
          minHeight: '32px',
        }}
      >
        {DEVICE_ORDER.map((d) => (
          <option key={d} value={d}>
            {t(`preview.devices.${d}`)} ({DEVICE_VIEWPORTS[d].width}px)
          </option>
        ))}
      </select>
    </label>
  )
}
