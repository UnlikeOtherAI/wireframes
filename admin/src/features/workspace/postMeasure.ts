import type { MeasureMessage } from './types'

/** Tell the page in a preview iframe whether to measure. Pages accept this only from their parent. */
export function postMeasure(frame: HTMLIFrameElement | null, on: boolean): void {
  const message: MeasureMessage = { type: 'wf:measure', on }
  frame?.contentWindow?.postMessage(message, '*')
}
