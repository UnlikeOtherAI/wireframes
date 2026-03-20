import { useTranslation } from 'react-i18next'
import { adminColors, adminRadii, ghostButtonStyle } from '../../styles/adminTheme'

interface ActionButtonsProps {
  activePage?: string
  selectedNode?: string
  onPromptSelect: (prompt: string) => void
  onBuildPreview: () => void
  disabled?: boolean
}

const actionBtnStyle: React.CSSProperties = {
  ...ghostButtonStyle,
  minWidth: 'auto',
  minHeight: 32,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: adminRadii.pill,
  border: `1px solid ${adminColors.border}`,
  background: adminColors.cardBg,
  color: adminColors.textSecondary,
}

const disabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

export function ActionButtons({
  activePage,
  selectedNode,
  onPromptSelect,
  onBuildPreview,
  disabled = false,
}: ActionButtonsProps) {
  const { t } = useTranslation()

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
      data-testid="chat-action-buttons"
    >
      <button
        type="button"
        onClick={() => onPromptSelect(t('chat.prompts.addPage'))}
        disabled={disabled}
        style={{ ...actionBtnStyle, ...(disabled ? disabledStyle : {}) }}
      >
        {t('chat.actions.addPage')}
      </button>
      <button
        type="button"
        onClick={() => onPromptSelect(t('chat.prompts.editPage', { page: activePage ?? 'current' }))}
        disabled={disabled || !activePage}
        style={{ ...actionBtnStyle, ...(disabled || !activePage ? disabledStyle : {}) }}
      >
        {t('chat.actions.editPage')}
      </button>
      <button
        type="button"
        onClick={() => onPromptSelect(t('chat.prompts.explainNode', { node: selectedNode ?? '' }))}
        disabled={disabled || !selectedNode}
        style={{ ...actionBtnStyle, ...(disabled || !selectedNode ? disabledStyle : {}) }}
      >
        {t('chat.actions.explainNode')}
      </button>
      <button
        type="button"
        onClick={onBuildPreview}
        disabled={disabled}
        style={{ ...actionBtnStyle, ...(disabled ? disabledStyle : {}) }}
      >
        {t('chat.actions.buildPreview')}
      </button>
    </div>
  )
}
