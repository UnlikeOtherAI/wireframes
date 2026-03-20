import { useTranslation } from 'react-i18next'
import type { Problem } from './useDocumentManager'

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
        style={{ padding: '8px 12px', borderTop: '1px solid #ddd', fontSize: '13px', color: '#666' }}
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
      style={{ borderTop: '1px solid #ddd', maxHeight: '150px', overflow: 'auto' }}
    >
      {problems.map((problem, index) => (
        <button
          key={index}
          role="listitem"
          onClick={() => onClickProblem?.(problem)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: onClickProblem ? 'pointer' : 'default',
            textAlign: 'left',
            fontSize: '13px',
            minHeight: '28px',
          }}
          aria-label={`${problem.severity}: ${problem.message}${problem.line ? ` at line ${problem.line}` : ''}`}
        >
          <span
            style={{
              color: problem.severity === 'error' ? '#d32f2f' : '#f57c00',
              fontWeight: 600,
              minWidth: '16px',
            }}
          >
            {problem.severity === 'error' ? '\u2716' : '\u26A0'}
          </span>
          <span style={{ flex: 1 }}>{problem.message}</span>
          {problem.line != null && (
            <span style={{ color: '#888', fontSize: '12px' }}>
              {t('editor.lineCol', { line: problem.line, col: problem.column ?? 1 })}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
