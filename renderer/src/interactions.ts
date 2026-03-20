// @ts-expect-error CJS module without type declarations
import { buildInteractionRuntime, buildInteractionRuntimeFromWindowContext } from '../../engine/renderer/interactions.js';

export interface InteractionRuntimeOptions {
  routeId: string;
  routeTable: Record<string, string>;
  appStateDefaults: Record<string, unknown>;
  pageStateDefaults: Record<string, unknown>;
  platform: string;
  preview?: boolean;
}

function buildPreviewBridge(): string {
  return `
(function(){
  var _origNav = typeof wfNavigate === 'function' ? wfNavigate : null;
  wfNavigate = function(id) {
    var target = WF_ROUTES[id];
    if (!target) { console.warn('Missing target route:', id); return; }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wf:navigate', routeId: id, target: target }, '*');
        return;
      }
    } catch (_err) {}
    window.location.href = target;
  };
})();`;
}

export function buildRuntimeJs(options: InteractionRuntimeOptions): string {
  const runtime = buildInteractionRuntime({
    routeId: options.routeId,
    routeTable: options.routeTable,
    appStateDefaults: options.appStateDefaults,
    pageStateDefaults: options.pageStateDefaults,
    platform: options.platform,
  }) as string;

  if (!options.preview) {
    return runtime;
  }

  return runtime + '\n' + buildPreviewBridge();
}

export function buildRuntimeJsFromWindowContext(options?: {
  routeId?: string;
  routeTable?: Record<string, string>;
  appStateDefaults?: Record<string, unknown>;
  pageStateDefaults?: Record<string, unknown>;
  platform?: string;
  preview?: boolean;
}): string {
  const runtime = buildInteractionRuntimeFromWindowContext({
    routeId: options?.routeId ?? '',
    routeTable: options?.routeTable ?? {},
    appStateDefaults: options?.appStateDefaults ?? {},
    pageStateDefaults: options?.pageStateDefaults ?? {},
    platform: options?.platform ?? 'web',
  }) as string;

  if (!options?.preview) {
    return runtime;
  }

  return runtime + '\n' + buildPreviewBridge();
}
