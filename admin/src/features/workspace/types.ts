export type DeviceType =
  | 'mobile_portrait'
  | 'mobile_landscape'
  | 'tablet_portrait'
  | 'tablet_landscape'
  | 'web'
  | 'full_scale'

export type RenderMode = 'line' | 'card'

export interface DeviceViewport {
  width: number
  minHeight: number
}

export const DEVICE_VIEWPORTS: Record<DeviceType, DeviceViewport> = {
  mobile_portrait: { width: 390, minHeight: 844 },
  mobile_landscape: { width: 844, minHeight: 390 },
  tablet_portrait: { width: 820, minHeight: 1180 },
  tablet_landscape: { width: 1180, minHeight: 820 },
  web: { width: 1280, minHeight: 900 },
  full_scale: { width: 1920, minHeight: 1080 },
}

export const DEVICE_ORDER: DeviceType[] = [
  'mobile_portrait',
  'mobile_landscape',
  'tablet_portrait',
  'tablet_landscape',
  'web',
  'full_scale',
]

/** Host-to-page message that switches the measurement overlay on or off. */
export interface MeasureMessage {
  type: 'wf:measure'
  on: boolean
}

export interface ResolvedNode {
  id: string
  /**
   * What selecting the node selects: where it is written, or, for a node a
   * component renders, its nearest owner (the instance, or the row it renders in).
   */
  address: string
  /** The id the node renders with in the preview, when the tree knows it. */
  renderedId?: string
  /** Set on a node a component renders, which selects its nearest owner rather than itself. */
  internal?: boolean
  type: string
  component?: string
  layout?: string
  /** The item id, when the node is a row of a `repeat`. */
  repeatItem?: string
  children: ResolvedNode[]
}

/** Why the tree lists no nodes for a page that has some. */
export type TreeNotice =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  /** The page expands past the engine's budget; `host` is the repeat that would pass it. */
  | { kind: 'too-large'; max: number; host: string | null }

export interface WorkspaceTree {
  nodes: ResolvedNode[]
  notice: TreeNotice | null
}

export interface SitemapNode {
  id: string
  page: string
  path: string
  targets: string[]
}
