import type { Diagnostic } from '@codemirror/lint'
import type { Problem } from './useDocumentManager'

function lineColToPos(doc: string, line: number, col: number): number {
  let pos = 0
  let currentLine = 1
  for (let i = 0; i < doc.length; i++) {
    if (currentLine === line) {
      return pos + Math.min(col - 1, doc.length - pos)
    }
    if (doc[i] === '\n') {
      currentLine++
    }
    pos++
  }
  return pos
}

export function problemsToDiagnostics(problems: Problem[], docContent: string): Diagnostic[] {
  return problems.map((p) => {
    let from = 0
    let to = 0
    if (p.line != null && p.line > 0) {
      from = lineColToPos(docContent, p.line, p.column ?? 1)
      const lineEnd = docContent.indexOf('\n', from)
      to = lineEnd === -1 ? docContent.length : lineEnd
      if (to === from) to = Math.min(from + 1, docContent.length)
    }
    return {
      from,
      to,
      severity: p.severity === 'warning' ? ('warning' as const) : ('error' as const),
      message: p.message,
    }
  })
}

export function buildYamlFilesMap(
  docStates: Map<string, { documentType: string; documentId: string; current: string }>,
): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [, state] of docStates) {
    if (state.documentType === 'page') {
      files[`pages/${state.documentId}.yaml`] = state.current
    } else if (state.documentType === 'dataset') {
      files[`data/${state.documentId}.yaml`] = state.current
    } else {
      files[`${state.documentType}.yaml`] = state.current
    }
  }
  return files
}

export const statusStyles: Record<string, { color: string }> = {
  saving: { color: '#9A9FA5' },
  saved: { color: '#22C55E' },
  unsaved: { color: '#F56522' },
  error: { color: '#EF4444' },
  conflict: { color: '#EF4444' },
}
