import { useTranslation } from 'react-i18next'
import type { DiffLine } from './diff'

interface DiffPreviewProps {
  documentLabel: string
  lines: DiffLine[]
  onApply: () => void
  onReject: () => void
  busy?: boolean
}

const COLORS = {
  unchanged: '#f5f5f5',
  added: '#e8f5e9',
  removed: '#ffebee',
}

export function DiffPreview({
  documentLabel,
  lines,
  onApply,
  onReject,
  busy = false,
}: DiffPreviewProps) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('chat.diff.title')}
      data-testid="chat-diff-preview"
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
        {t('chat.diff.document', { document: documentLabel })}
      </div>
      <div style={{ maxHeight: '220px', overflow: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
        {lines.map((line, index) => (
          <div
            key={`${line.type}-${index}-${line.value}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr',
              gap: '8px',
              padding: '4px 12px',
              background: COLORS[line.type],
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <span>{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{line.value || ' '}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', padding: '12px' }}>
        <button type="button" onClick={onApply} disabled={busy}>
          {busy ? t('chat.diff.applying') : t('chat.diff.apply')}
        </button>
        <button type="button" onClick={onReject} disabled={busy}>
          {t('chat.diff.reject')}
        </button>
      </div>
    </section>
  )
}
