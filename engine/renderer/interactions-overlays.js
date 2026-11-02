'use strict';

/**
 * Returns the overlay-related runtime code string for the interaction runtime.
 * This is a fragment of the client-side JS IIFE — it relies on variables
 * and helpers (isObj, overlayType, etc.) declared in the surrounding scope.
 */
function buildOverlayRuntimeCode() {
  return `function overlayDismissList(node) {
  if (!node) return [];
  try {
    var d = JSON.parse(node.getAttribute('data-wf-overlay-dismiss') || '[]');
    return Array.isArray(d) ? d : [];
  } catch (_err) { return []; }
}
function overlayType(node) {
  return node && node.getAttribute ? String(node.getAttribute('data-wf-overlay-type') || '') : '';
}
function overlayPlacement(node) {
  return node && node.getAttribute ? String(node.getAttribute('data-wf-overlay-placement') || '') : '';
}
function overlayTriggerNode(node) {
  if (!node || !node.getAttribute) return null;
  var triggerId = String(node.getAttribute('data-wf-overlay-trigger') || '');
  return triggerId ? document.getElementById(triggerId) : null;
}
function isAnchoredOverlayType(type) {
  return type === 'dropdown' || type === 'popover' || type === 'menu' || type === 'tooltip';
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function positionAnchoredOverlay(node) {
  if (!node) return;
  var type = overlayType(node);
  if (!isAnchoredOverlayType(type)) return;
  var trigger = overlayTriggerNode(node);
  if (!trigger) return;

  var prevVisibility = node.style.visibility;
  node.style.visibility = 'hidden';
  node.style.left = '0px';
  node.style.top = '0px';
  node.style.right = 'auto';
  node.style.bottom = 'auto';

  var triggerRect = trigger.getBoundingClientRect();
  // Match the trigger's width before measuring, or the clamp below works from a
  // stale width and the popup can still overflow the viewport.
  if (type === 'menu' || type === 'dropdown') {
    node.style.minWidth = Math.max(Math.round(triggerRect.width), 160) + 'px';
  }
  var overlayRect = node.getBoundingClientRect();
  var width = overlayRect.width || 0;
  var height = overlayRect.height || 0;
  var gap = 8;
  var placement = overlayPlacement(node) || 'bottom';
  var left = triggerRect.left;
  var top = triggerRect.bottom + gap;

  if (placement === 'top') {
    top = triggerRect.top - height - gap;
    if (top < gap) top = triggerRect.bottom + gap;
  } else if (placement === 'left') {
    left = triggerRect.left - width - gap;
    top = triggerRect.top;
    if (left < gap) left = triggerRect.right + gap;
  } else if (placement === 'right') {
    left = triggerRect.right + gap;
    top = triggerRect.top;
    if (left + width > window.innerWidth - gap) left = triggerRect.left - width - gap;
  } else if (placement === 'center') {
    left = triggerRect.left + ((triggerRect.width - width) / 2);
    top = triggerRect.top + ((triggerRect.height - height) / 2);
  } else {
    top = triggerRect.bottom + gap;
    left = triggerRect.left;
    if (top + height > window.innerHeight - gap) top = triggerRect.top - height - gap;
  }

  left = clamp(left, gap, Math.max(gap, window.innerWidth - width - gap));
  top = clamp(top, gap, Math.max(gap, window.innerHeight - height - gap));

  node.style.left = Math.round(left) + 'px';
  node.style.top = Math.round(top) + 'px';
  node.style.visibility = prevVisibility || '';
}
function setOverlayVisible(node, show) {
  if (!node) return;
  node.classList.toggle('wf-visible', !!show);
  var backdrop = node.querySelector('.wf-overlay-backdrop');
  if (backdrop) {
    backdrop.style.display = show ? 'block' : 'none';
    backdrop.style.pointerEvents = show ? 'auto' : 'none';
  }
}
function bindOverlayDismiss(node, overlayId, list) {
  if (list.indexOf('backdrop') >= 0) {
    var backdrop = node.querySelector('.wf-overlay-backdrop');
    if (backdrop && !node._wfBackdropHandler) {
      node._wfBackdropHandler = function (event) {
        event.stopPropagation();
        closeOverlay(overlayId);
      };
      backdrop.addEventListener('click', node._wfBackdropHandler);
    }
  }
  if (list.indexOf('escape') >= 0 && !node._wfEscHandler) {
    node._wfEscHandler = function (event) {
      if (event.key === 'Escape') closeOverlay(overlayId);
    };
    document.addEventListener('keydown', node._wfEscHandler);
  }
  if (list.indexOf('outside') >= 0 && !node._wfOutsideHandler) {
    node._wfOutsideHandler = function (event) {
      var trigger = overlayTriggerNode(node);
      var target = event && event.target ? event.target : null;
      if (!target) return;
      if (node.contains(target)) return;
      if (trigger && trigger.contains && trigger.contains(target)) return;
      closeOverlay(overlayId);
    };
    document.addEventListener('mousedown', node._wfOutsideHandler);
  }
  if (isAnchoredOverlayType(overlayType(node)) && !node._wfPositionHandler) {
    node._wfPositionHandler = function () {
      if (node.classList.contains('wf-visible')) positionAnchoredOverlay(node);
    };
    window.addEventListener('resize', node._wfPositionHandler);
    window.addEventListener('scroll', node._wfPositionHandler, true);
  }
}
function unbindOverlayDismiss(node, overlayId) {
  var backdrop = node ? node.querySelector('.wf-overlay-backdrop') : null;
  if (node._wfBackdropHandler && backdrop) {
    backdrop.removeEventListener('click', node._wfBackdropHandler);
    node._wfBackdropHandler = null;
  }
  if (node._wfEscHandler) {
    document.removeEventListener('keydown', node._wfEscHandler);
    node._wfEscHandler = null;
  }
  if (node._wfOutsideHandler) {
    document.removeEventListener('mousedown', node._wfOutsideHandler);
    node._wfOutsideHandler = null;
  }
  if (node._wfPositionHandler) {
    window.removeEventListener('resize', node._wfPositionHandler);
    window.removeEventListener('scroll', node._wfPositionHandler, true);
    node._wfPositionHandler = null;
  }
  if (node._wfDismissTimer) {
    clearTimeout(node._wfDismissTimer);
    node._wfDismissTimer = null;
  }
}
function openOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  var dismiss = overlayDismissList(node);
  setOverlayVisible(node, true);
  positionAnchoredOverlay(node);
  if (dismiss.indexOf('timeout') >= 0) {
    node._wfDismissTimer = setTimeout(function () { closeOverlay(id); }, 3000);
  }
  bindOverlayDismiss(node, id, dismiss);
}
function closeOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  setOverlayVisible(node, false);
  unbindOverlayDismiss(node, id);
}`;
}

module.exports = { buildOverlayRuntimeCode };
