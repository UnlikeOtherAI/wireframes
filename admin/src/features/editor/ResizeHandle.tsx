import type { CSSProperties } from 'react'
import { adminColors } from '../../styles/adminTheme'

interface ResizeHandleProps {
  testId: string
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
}

const handleStyle: CSSProperties = {
  width: 8,
  flexShrink: 0,
  cursor: 'col-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const indicatorStyle: CSSProperties = {
  width: 3,
  height: 32,
  borderRadius: 999,
  background: adminColors.border,
  transition: 'background 150ms ease',
  pointerEvents: 'none',
}

export function ResizeHandle({ testId, onMouseDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      data-testid={testId}
      onMouseDown={onMouseDown}
      style={handleStyle}
      onMouseEnter={(e) => {
        const indicator = e.currentTarget.firstElementChild as HTMLElement
        if (indicator) indicator.style.background = adminColors.textTertiary
      }}
      onMouseLeave={(e) => {
        const indicator = e.currentTarget.firstElementChild as HTMLElement
        if (indicator) indicator.style.background = adminColors.border
      }}
    >
      <div style={indicatorStyle} />
    </div>
  )
}
