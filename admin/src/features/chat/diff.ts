export type DiffLineType = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  type: DiffLineType
  value: string
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const lines: DiffLine[] = []
  let i = 0
  let j = 0

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: 'unchanged', value: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'removed', value: a[i] })
      i++
    } else {
      lines.push({ type: 'added', value: b[j] })
      j++
    }
  }

  while (i < a.length) {
    lines.push({ type: 'removed', value: a[i] })
    i++
  }

  while (j < b.length) {
    lines.push({ type: 'added', value: b[j] })
    j++
  }

  return lines
}
