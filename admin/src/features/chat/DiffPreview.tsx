import { useTranslation } from 'react-i18next'
import type { DiffLine } from './diff'
import {
  adminColors,
  adminRadii,
  primaryButtonStyle,
  ghostButtonStyle,
} from '../../styles/adminTheme'

interface DiffPreviewProps {
  documentLabel: string
  lines: DiffLine[]
  onApply: () => void
  onReject: () => void
  busy?: boolean
}

const COLORS = {
  unchanged: adminColors.surfaceMuted,
  added: adminColors.successBg,
  removed: adminColors.dangerBg,
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
        border: `1px solid ${adminColors.border}`,
        borderRadius: adminRadii.card,
        overflow: 'hidden',
        background: adminColors.cardBg,
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${adminColors.border}`, fontSize: 13, fontWeight: 500, color: adminColors.textSecondary }}>
        {t('chat.diff.document', { document: documentLabel })}
      </div>
      <div style={{ maxHeight: 220, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {lines.map((line, index) => (
          <div
            key={`${line.type}-${index}-${line.value}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr',
              gap: 8,
              padding: '4px 12px',
              background: COLORS[line.type],
              borderBottom: `1px solid ${adminColors.borderSubtle}`,
            }}
          >
            <span style={{ color: adminColors.textTertiary }}>{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
            <span style={{ whiteSpace: 'pre-wrap', color: adminColors.textPrimary }}>{line.value || ' '}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12 }}>
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          style={{
            ...primaryButtonStyle,
            minHeight: 36,
            padding: '6px 16px',
            opacity: busy ? 0.5 : 1,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? t('chat.diff.applying') : t('chat.diff.apply')}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          style={{
            ...ghostButtonStyle,
            minHeight: 36,
            padding: '6px 16px',
            border: `1px solid ${adminColors.border}`,
            opacity: busy ? 0.5 : 1,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {t('chat.diff.reject')}
        </button>
      </div>
    </section>
  )
}
