import { useTranslation } from 'react-i18next'
import { DEVICE_ORDER, DEVICE_VIEWPORTS, type DeviceType, type RenderMode } from './types'

interface DeviceControlsProps {
  device: DeviceType
  onDeviceChange: (device: DeviceType) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
}

export function DeviceControls({
  device,
  onDeviceChange,
  renderMode,
  onRenderModeChange,
}: DeviceControlsProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="workspace-device-controls"
      aria-label={t('workspace.deviceControls')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 12px',
        borderBottom: '1px solid #ddd',
        minHeight: '44px',
        flexWrap: 'wrap',
      }}
    >
      {/* Device selector */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
        }}
      >
        <span>{t('workspace.device')}</span>
        <select
          value={device}
          onChange={(e) => onDeviceChange(e.target.value as DeviceType)}
          aria-label={t('workspace.device')}
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
              {t(`workspace.devices.${d}`)} ({DEVICE_VIEWPORTS[d].width}px)
            </option>
          ))}
        </select>
      </label>

      {/* Render mode toggle */}
      <div
        role="radiogroup"
        aria-label={t('workspace.renderMode')}
        style={{
          display: 'flex',
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <button
          role="radio"
          aria-checked={renderMode === 'line'}
          onClick={() => onRenderModeChange('line')}
          style={{
            padding: '4px 12px',
            border: 'none',
            background: renderMode === 'line' ? '#e3f2fd' : '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            minHeight: '32px',
            fontWeight: renderMode === 'line' ? 600 : 400,
          }}
        >
          {t('workspace.modeLine')}
        </button>
        <button
          role="radio"
          aria-checked={renderMode === 'card'}
          onClick={() => onRenderModeChange('card')}
          style={{
            padding: '4px 12px',
            border: 'none',
            borderLeft: '1px solid #ddd',
            background: renderMode === 'card' ? '#e3f2fd' : '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            minHeight: '32px',
            fontWeight: renderMode === 'card' ? 600 : 400,
          }}
        >
          {t('workspace.modeCard')}
        </button>
      </div>
    </div>
  )
}
