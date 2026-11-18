import { useTranslation } from 'react-i18next'
import { DeviceSelector } from './DeviceSelector'
import { RenderModeToggle } from './RenderModeToggle'
import { MeasureToggle } from './MeasureToggle'
import type { DeviceType, RenderMode } from './usePreviewRenderer'
import { adminColors } from '../../styles/adminTheme'

interface PreviewToolbarProps {
  device: DeviceType
  onDeviceChange: (device: DeviceType) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  measure: boolean
  onMeasureChange: (on: boolean) => void
}

export function PreviewToolbar({
  device,
  onDeviceChange,
  renderMode,
  onRenderModeChange,
  measure,
  onMeasureChange,
}: PreviewToolbarProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="preview-toolbar"
      aria-label={t('preview.toolbar')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderBottom: `1px solid ${adminColors.border}`,
        minHeight: 44,
        flexWrap: 'wrap',
      }}
    >
      <DeviceSelector value={device} onChange={onDeviceChange} />
      <RenderModeToggle value={renderMode} onChange={onRenderModeChange} />
      <MeasureToggle pressed={measure} onChange={onMeasureChange} />
    </div>
  )
}
