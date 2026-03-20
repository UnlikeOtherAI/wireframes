import { useTranslation } from 'react-i18next'
import type { Problem } from './useDocumentManager'
import { adminColors } from '../../styles/adminTheme'

interface ProblemsPanelProps {
  problems: Problem[]
  onClickProblem?: (problem: Problem) => void
}

export function ProblemsPanel({ problems, onClickProblem }: ProblemsPanelProps) {
  const { t } = useTranslation()

  if (problems.length === 0) {
    return (
      <div
        data-testid="problems-panel"
        style={{ padding: '8px 12px', borderTop: `1px solid ${adminColors.border}`, fontSize: 13, color: adminColors.textTertiary }}
      >
        {t('editor.noProblems')}
      </div>
    )
  }

  return (
    <div
      data-testid="problems-panel"
      role="list"
      aria-label={t('editor.problems')}
      style={{ borderTop: `1px solid ${adminColors.border}`, maxHeight: 150, overflow: 'auto' }}
    >
      {problems.map((problem, index) => (
        <button
          key={index}
          role="listitem"
          onClick={() => onClickProblem?.(problem)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: onClickProblem ? 'pointer' : 'default',
            textAlign: 'left',
            fontSize: 13,
            minHeight: 28,
            color: adminColors.textPrimary,
          }}
          aria-label={`${problem.severity}: ${problem.message}${problem.line ? ` at line ${problem.line}` : ''}`}
        >
          <span
            style={{
              color: problem.severity === 'error' ? adminColors.dangerText : adminColors.primary,
              fontWeight: 600,
              minWidth: 16,
            }}
          >
            {problem.severity === 'error' ? '\u2716' : '\u26A0'}
          </span>
          <span style={{ flex: 1 }}>{problem.message}</span>
          {problem.line != null && (
            <span style={{ color: adminColors.textTertiary, fontSize: 12 }}>
              {t('editor.lineCol', { line: problem.line, col: problem.column ?? 1 })}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
