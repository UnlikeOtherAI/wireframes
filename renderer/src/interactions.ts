// @ts-expect-error CJS module without type declarations
import * as interactionRuntimeModule from '../../engine/renderer/interactions.js';

const {
  buildInteractionRuntime,
  buildInteractionRuntimeFromWindowContext,
} = interactionRuntimeModule as {
  buildInteractionRuntime: (options: InteractionRuntimeOptions) => string
  buildInteractionRuntimeFromWindowContext: (options: InteractionRuntimeOptions) => string
};

export interface InteractionRuntimeOptions {
  routeId: string;
  routeTable: Record<string, string>;
  appStateDefaults: Record<string, unknown>;
  pageStateDefaults: Record<string, unknown>;
  platform: string;
}

export function buildRuntimeJs(options: InteractionRuntimeOptions): string {
  return buildInteractionRuntime({
    routeId: options.routeId,
    routeTable: options.routeTable,
    appStateDefaults: options.appStateDefaults,
    pageStateDefaults: options.pageStateDefaults,
    platform: options.platform,
  }) as string;
}

export function buildRuntimeJsFromWindowContext(options?: {
  routeId?: string;
  routeTable?: Record<string, string>;
  appStateDefaults?: Record<string, unknown>;
  pageStateDefaults?: Record<string, unknown>;
  platform?: string;
}): string {
  return buildInteractionRuntimeFromWindowContext({
    routeId: options?.routeId ?? '',
    routeTable: options?.routeTable ?? {},
    appStateDefaults: options?.appStateDefaults ?? {},
    pageStateDefaults: options?.pageStateDefaults ?? {},
    platform: options?.platform ?? 'web',
  }) as string;
}
