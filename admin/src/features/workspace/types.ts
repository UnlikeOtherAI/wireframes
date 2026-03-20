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

export interface ResolvedNode {
  id: string
  address: string
  type: string
  component?: string
  layout?: string
  children: ResolvedNode[]
}

export interface SitemapNode {
  id: string
  page: string
  path: string
  targets: string[]
}
