import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faCode, faEye, faFloppyDisk, faGear } from '@fortawesome/free-solid-svg-icons'
import { statusStyles } from './projectEditorUtils'
import {
  adminColors,
  adminRadii,
  secondaryButtonStyle,
} from '../../styles/adminTheme'

export type CenterView = 'source' | 'preview'

interface EditorHeaderProps {
  projectId: string
  centerView: CenterView
  onCenterViewChange: (view: CenterView) => void
  autoSaveEnabled: boolean
  onAutoSaveChange: (enabled: boolean) => void
  onSave: () => void
  saving: boolean
  canSave: boolean
  displayStatus: string
}

export function EditorHeader({
  projectId,
  centerView,
  onCenterViewChange,
  autoSaveEnabled,
  onAutoSaveChange,
  onSave,
  saving,
  canSave,
  displayStatus,
}: EditorHeaderProps) {
  const { t } = useTranslation()

  return (
    <header style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" aria-label={t('editor.backToDashboard')} style={iconButtonStyle}>
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 14 }} />
        </Link>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: adminColors.textPrimary }}>
          {t('editor.title')}
        </h1>
        <Link to={`/projects/${projectId}/settings`} aria-label={t('editor.settings')} style={iconButtonStyle}>
          <FontAwesomeIcon icon={faGear} style={{ fontSize: 14 }} />
        </Link>

        {/* Source / Preview toggle */}
        <div style={viewToggleContainerStyle}>
          <button
            type="button"
            aria-label={t('editor.viewSource')}
            data-testid="view-source-btn"
            onClick={() => onCenterViewChange('source')}
            style={viewToggleBtnStyle(centerView === 'source')}
          >
            <FontAwesomeIcon icon={faCode} />
          </button>
          <button
            type="button"
            aria-label={t('editor.viewPreview')}
            data-testid="view-preview-btn"
            onClick={() => onCenterViewChange('preview')}
            style={viewToggleBtnStyle(centerView === 'preview')}
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: adminColors.textSecondary, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => onAutoSaveChange(e.target.checked)}
            aria-label={t('editor.autoSave')}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            display: 'inline-flex',
            width: 36,
            height: 20,
            borderRadius: 10,
            background: autoSaveEnabled ? adminColors.primary : adminColors.border,
            transition: 'background 150ms ease',
            position: 'relative',
            flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute',
              top: 2,
              left: autoSaveEnabled ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 150ms ease',
            }} />
          </span>
          {t('editor.autoSave')}
        </label>
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{
            ...secondaryButtonStyle,
            minHeight: 36,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          <FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: 13 }} />
          {saving ? t('editor.saving') : t('common.save')}
        </button>
        {displayStatus !== 'idle' && (
          <span
            data-testid="save-status"
            style={{ fontSize: 13, fontWeight: 500, ...statusStyles[displayStatus] }}
          >
            {t(`editor.status.${displayStatus}`)}
          </span>
        )}
      </div>
    </header>
  )
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 16px',
  borderBottom: `1px solid ${adminColors.border}`,
  minHeight: 48,
  background: adminColors.cardBg,
}

const iconButtonStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 36,
  height: 36,
  borderRadius: adminRadii.button,
  border: `1px solid ${adminColors.border}`,
  background: adminColors.cardBg,
  color: adminColors.textSecondary,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background 150ms ease',
}

const viewToggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: adminColors.surfaceMuted,
  borderRadius: adminRadii.pill,
  padding: 2,
  gap: 2,
  marginLeft: 4,
}

function viewToggleBtnStyle(active: boolean): React.CSSProperties {
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
