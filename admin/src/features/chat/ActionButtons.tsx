import { useTranslation } from 'react-i18next'

interface ActionButtonsProps {
  activePage?: string
  selectedNode?: string
  onPromptSelect: (prompt: string) => void
  onBuildPreview: () => void
  disabled?: boolean
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
      style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
      data-testid="chat-action-buttons"
    >
      <button type="button" onClick={() => onPromptSelect(t('chat.prompts.addPage'))} disabled={disabled}>
        {t('chat.actions.addPage')}
      </button>
      <button
        type="button"
        onClick={() => onPromptSelect(t('chat.prompts.editPage', { page: activePage ?? 'current' }))}
        disabled={disabled || !activePage}
      >
        {t('chat.actions.editPage')}
      </button>
      <button
        type="button"
        onClick={() => onPromptSelect(t('chat.prompts.explainNode', { node: selectedNode ?? '' }))}
        disabled={disabled || !selectedNode}
      >
        {t('chat.actions.explainNode')}
      </button>
      <button type="button" onClick={onBuildPreview} disabled={disabled}>
        {t('chat.actions.buildPreview')}
      </button>
    </div>
  )
}
