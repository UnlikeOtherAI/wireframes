import { useTranslation } from 'react-i18next'
import { DeviceSelector } from './DeviceSelector'
import { PageSelector } from './PageSelector'
import { RenderModeToggle } from './RenderModeToggle'
import type { DeviceType, RenderMode } from './usePreviewRenderer'
import { adminColors } from '../../styles/adminTheme'

interface PreviewToolbarProps {
  device: DeviceType
  onDeviceChange: (device: DeviceType) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  pageIds: string[]
  activePage: string | null
  onPageChange: (pageId: string) => void
}

export function PreviewToolbar({
  device,
  onDeviceChange,
  renderMode,
  onRenderModeChange,
  pageIds,
  activePage,
  onPageChange,
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
      <PageSelector
        pageIds={pageIds}
        activePage={activePage}
        onChange={onPageChange}
      />
      <DeviceSelector value={device} onChange={onDeviceChange} />
      <RenderModeToggle value={renderMode} onChange={onRenderModeChange} />
    </div>
  )
}
