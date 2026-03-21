import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { Annotation, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { yaml } from '@codemirror/lang-yaml'
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

const ExternalSync = Annotation.define<boolean>()

export interface YamlEditorHandle {
  scrollToLine(line: number): void
}

interface YamlEditorProps {
  value: string
  onChange: (value: string) => void
  diagnostics?: Diagnostic[]
}

export const YamlEditor = forwardRef<YamlEditorHandle, YamlEditorProps>(
  function YamlEditor({ value, onChange, diagnostics }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    useImperativeHandle(ref, () => ({
      scrollToLine(line: number) {
        const view = viewRef.current
        if (!view) return
        const clampedLine = Math.min(line, view.state.doc.lines)
        const lineInfo = view.state.doc.line(Math.max(1, clampedLine))
        view.dispatch({
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
          selection: { anchor: lineInfo.from },
        })
        view.focus()
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some(tr => tr.annotation(ExternalSync))) {
          onChangeRef.current(update.state.doc.toString())
        }
      })

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle),
          yaml(),
          search(),
          lintGutter(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          updateListener,
          EditorView.lineWrapping,
        ],
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view

      return () => {
        view.destroy()
        viewRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync external value changes (e.g., loading a different document)
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          annotations: ExternalSync.of(true),
        })
      }
    }, [value])

    // Sync diagnostics
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch(setDiagnostics(view.state, diagnostics ?? []))
    }, [diagnostics])

    return (
      <div
        ref={containerRef}
        data-testid="yaml-editor"
        style={{ height: '100%', overflow: 'auto', border: '1px solid #ddd' }}
      />
    )
  },
)
