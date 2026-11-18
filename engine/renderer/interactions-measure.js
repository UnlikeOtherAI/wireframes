'use strict';

/**
 * Returns the measurement-mode runtime code string for the interaction runtime.
 * This is a fragment of the client-side JS IIFE. It relies on `clamp` from the
 * overlay fragment, declared in the surrounding scope.
 *
 * Measurement is inert until it is switched on by a `wf:measure` message from
 * the embedding window, `setMeasure()` in the browser library, or the `m` key on
 * a standalone page. Before that it adds no DOM, attributes or styles, and
 * switching it off removes everything it added. While on, capture-phase window
 * listeners stop pointer, click, key and touch events before the page's own
 * handlers, and `isMeasuring()` gates the runtime paths that do not start from
 * those events.
 */
function buildMeasureRuntimeCode() {
  return `var WF_MEASURE = { on: false, layer: null, marks: null, hover: null, pin: null, x: 0, y: 0, hasPoint: false, touch: false };
var WF_MEASURE_INK = '#c2185b';
var WF_MEASURE_HALO = 'rgba(255,255,255,.9)';
var WF_MEASURE_TARGETS = '.wf-node[id],.wf-root[id],.wf-overlay[id]';
var WF_MEASURE_STOPPED = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'];
var WF_MEASURE_MARK = 'position:absolute;margin:0;padding:0;border:0;box-sizing:border-box;';
var WF_MEASURE_CHIP = 'font:600 11px/16px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;'
  + 'letter-spacing:0;text-transform:none;white-space:nowrap;color:#ffffff;background:' + WF_MEASURE_INK + ';'
  + 'padding:0 5px;border-radius:4px;box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';transform:translate(-50%,-50%);';
var WF_MEASURE_PAD_FILL = 'background:repeating-linear-gradient(135deg,rgba(21,128,61,.42) 0 1px,rgba(21,128,61,.1) 1px 5px);';
var WF_MEASURE_GAP_FILL = 'background:repeating-linear-gradient(45deg,rgba(194,24,91,.45) 0 1px,rgba(194,24,91,.1) 1px 5px);';

function isMeasuring() { return WF_MEASURE.on; }
function measureViewport() {
  var root = document.documentElement;
  return { w: root.clientWidth || window.innerWidth, h: root.clientHeight || window.innerHeight };
}
function measurePx(value) {
  var n = parseFloat(value);
  return isFinite(n) && n > 0 ? n : 0;
}
function measureFormat(value) {
  return String(Math.round(Math.abs(value) * 10) / 10);
}
// The visible box of a target: an overlay shell is measured by its content.
// Hidden, zero-size and fragmented (multi-line inline) boxes are skipped.
function measureBox(shell) {
  if (!shell || !shell.isConnected) return null;
  var el = shell.classList.contains('wf-overlay') ? shell.querySelector(':scope > .wf-overlay-content') : shell;
  if (!el) return null;
  var rects = el.getClientRects();
  if (rects.length !== 1) return null;
  var r = rects[0];
  if (!(r.width > 0 && r.height > 0)) return null;
  if (window.getComputedStyle(el).visibility !== 'visible') return null;
  return { el: el, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}
function measureContains(box, x, y) {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
function measureParentTarget(node) {
  var parent = node.parentElement;
  return parent && parent.closest ? parent.closest(WF_MEASURE_TARGETS) : null;
}
// Hit-testing rather than event targets, so disabled controls and content
// behind a modal backdrop can be measured.
function measureTargetAt(x, y) {
  var hits = document.elementsFromPoint(x, y);
  for (var i = 0; i < hits.length; i++) {
    var shell = hits[i].closest ? hits[i].closest(WF_MEASURE_TARGETS) : null;
    while (shell) {
      var box = measureBox(shell);
      if (box && (!shell.classList.contains('wf-overlay') || measureContains(box, x, y))) return shell;
      shell = measureParentTarget(shell);
    }
  }
  return null;
}
function measureMark(left, top, width, height, css) {
  var mark = document.createElement('div');
  mark.style.cssText = WF_MEASURE_MARK + 'left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + height + 'px;' + (css || '');
  WF_MEASURE.marks.appendChild(mark);
  return mark;
}
function measureChip(cx, cy, value, kind) {
  var view = measureViewport();
  var chip = document.createElement('div');
  chip.style.cssText = WF_MEASURE_MARK + 'left:' + clamp(cx, 22, Math.max(22, view.w - 22)) + 'px;top:'
    + clamp(cy, 10, Math.max(10, view.h - 10)) + 'px;' + WF_MEASURE_CHIP;
  chip.setAttribute('data-wf-measure-label', kind);
  chip.textContent = measureFormat(value);
  WF_MEASURE.marks.appendChild(chip);
}
function measureVisibleMid(start, end, limit) {
  return (Math.max(start, 0) + Math.min(end, limit)) / 2;
}
// A dimension line: a hairline with end ticks and a centred label chip.
function measureHLine(left, right, y, kind, value) {
  var ink = 'background:' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';';
  measureMark(left, y, right - left, 1, ink);
  measureMark(left, y - 4, 1, 9, ink);
  measureMark(right - 1, y - 4, 1, 9, ink);
  measureChip(measureVisibleMid(left, right, measureViewport().w), y, value, kind);
}
function measureVLine(top, bottom, x, kind, value) {
  var ink = 'background:' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';';
  measureMark(x, top, 1, bottom - top, ink);
  measureMark(x - 4, top, 9, 1, ink);
  measureMark(x - 4, bottom - 1, 9, 1, ink);
  measureChip(x, measureVisibleMid(top, bottom, measureViewport().h), value, kind);
}
function measureGuideH(left, right, y) {
  if (right - left < 1) return;
  measureMark(left, y, right - left, 0, 'border-top:1px dashed ' + WF_MEASURE_INK + ';');
}
function measureGuideV(top, bottom, x) {
  if (bottom - top < 1) return;
  measureMark(x, top, 0, bottom - top, 'border-left:1px dashed ' + WF_MEASURE_INK + ';');
}
function measureOutline(box, width, kind) {
  var mark = measureMark(box.left, box.top, box.width, box.height,
    'border:' + width + 'px solid ' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';');
  mark.setAttribute('data-wf-measure-box', kind);
}
// Width above (below, then inside, when there is no room) and height beside.
function measureDimensions(box) {
  var view = measureViewport();
  var y = box.top - 8;
  if (y < 12) y = box.bottom + 8;
  if (y > view.h - 12) y = clamp(Math.max(box.top, 0) + 12, 12, view.h - 12);
  measureHLine(box.left, box.right, Math.round(y), 'width', box.width);
  var x = box.right + 8;
  if (x > view.w - 30) x = box.left - 8;
  if (x < 30) x = clamp(Math.min(box.right, view.w) - 48, 30, view.w - 30);
  measureVLine(box.top, box.bottom, Math.round(x), 'height', box.height);
}
function measureBand(left, top, width, height, fill, kind, value) {
  if (width < 1 || height < 1) return;
  measureMark(left, top, width, height, fill).setAttribute('data-wf-measure-band', kind);
  measureChip(left + width / 2, top + height / 2, value, kind);
}
function measureChildBoxes(shell) {
  var boxes = [];
  var nodes = shell.querySelectorAll('.wf-node[id]');
  for (var i = 0; i < nodes.length; i++) {
    if (measureParentTarget(nodes[i]) !== shell) continue;
    var box = measureBox(nodes[i]);
    if (box) boxes.push(box);
  }
  return boxes;
}
function measureRows(boxes) {
  var sorted = boxes.slice().sort(function (a, b) { return a.top - b.top || a.left - b.left; });
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var row = rows[rows.length - 1];
    if (row && sorted[i].top < row.bottom - 0.5) {
      row.items.push(sorted[i]);
      row.top = Math.min(row.top, sorted[i].top);
      row.bottom = Math.max(row.bottom, sorted[i].bottom);
    } else {
      rows.push({ items: [sorted[i]], top: sorted[i].top, bottom: sorted[i].bottom });
    }
  }
  return rows;
}
// Padding bands and child gaps, read from computed styles, for layout
// containers only. A gap band is drawn where the space between neighbours
// holds the computed gap.
function measureLayoutBands(shell, box) {
  if (!shell.classList.contains('wf-stack') && !shell.classList.contains('wf-row') && !shell.classList.contains('wf-grid')) return;
  var cs = window.getComputedStyle(box.el);
  var left = box.left + measurePx(cs.borderLeftWidth), right = box.right - measurePx(cs.borderRightWidth);
  var top = box.top + measurePx(cs.borderTopWidth), bottom = box.bottom - measurePx(cs.borderBottomWidth);
  var pt = measurePx(cs.paddingTop), pr = measurePx(cs.paddingRight), pb = measurePx(cs.paddingBottom), pl = measurePx(cs.paddingLeft);
  measureBand(left, top, right - left, pt, WF_MEASURE_PAD_FILL, 'padding-top', pt);
  measureBand(left, bottom - pb, right - left, pb, WF_MEASURE_PAD_FILL, 'padding-bottom', pb);
  measureBand(left, top + pt, pl, bottom - top - pt - pb, WF_MEASURE_PAD_FILL, 'padding-left', pl);
  measureBand(right - pr, top + pt, pr, bottom - top - pt - pb, WF_MEASURE_PAD_FILL, 'padding-right', pr);
  var rowGap = measurePx(cs.rowGap), columnGap = measurePx(cs.columnGap);
  var rows = measureRows(measureChildBoxes(shell));
  for (var r = 0; r < rows.length; r++) {
    var next = rows[r + 1];
    var space = next ? next.top - rows[r].bottom : 0;
    if (next && rowGap > 0 && space >= rowGap - 0.5) {
      measureBand(left + pl, rows[r].bottom + (space - rowGap) / 2, right - pr - left - pl, rowGap, WF_MEASURE_GAP_FILL, 'gap-row', rowGap);
    }
    var items = rows[r].items.slice().sort(function (a, b) { return a.left - b.left; });
    for (var c = 0; c + 1 < items.length; c++) {
      var across = items[c + 1].left - items[c].right;
      if (columnGap > 0 && across >= columnGap - 0.5) {
        measureBand(items[c].right + (across - columnGap) / 2, rows[r].top, columnGap, rows[r].bottom - rows[r].top, WF_MEASURE_GAP_FILL, 'gap-column', columnGap);
      }
    }
  }
}
// Distances from the pinned box to another box on one axis: the gap between
// facing edges when they are apart, otherwise the insets between matching edges.
function measureAxis(pin, other, horizontal) {
  var start = horizontal ? 'left' : 'top', end = horizontal ? 'right' : 'bottom';
  var crossStart = horizontal ? 'top' : 'left', crossEnd = horizontal ? 'bottom' : 'right';
  var lo = Math.max(pin[crossStart], other[crossStart]), hi = Math.min(pin[crossEnd], other[crossEnd]);
  var at = Math.round(hi > lo ? (lo + hi) / 2 : (other[crossStart] + other[crossEnd]) / 2);
  var line = horizontal ? measureHLine : measureVLine;
  var guide = horizontal ? measureGuideV : measureGuideH;
  function edgeGuide(edge) {
    if (at < pin[crossStart]) guide(at, pin[crossStart], edge);
    else if (at > pin[crossEnd]) guide(pin[crossEnd], at, edge);
  }
  if (other[start] >= pin[end]) {
    line(pin[end], other[start], at, horizontal ? 'gap-x' : 'gap-y', other[start] - pin[end]);
    edgeGuide(Math.round(pin[end]));
    return;
  }
  if (pin[start] >= other[end]) {
    line(other[end], pin[start], at, horizontal ? 'gap-x' : 'gap-y', pin[start] - other[end]);
    edgeGuide(Math.round(pin[start]));
    return;
  }
  if (Math.abs(other[start] - pin[start]) >= 0.5) {
    line(Math.min(pin[start], other[start]), Math.max(pin[start], other[start]), at, 'inset-' + start, other[start] - pin[start]);
  }
  if (Math.abs(pin[end] - other[end]) >= 0.5) {
    line(Math.min(pin[end], other[end]), Math.max(pin[end], other[end]), at, 'inset-' + end, pin[end] - other[end]);
  }
}
function measureDraw() {
  if (!WF_MEASURE.marks) return;
  WF_MEASURE.marks.textContent = '';
  var pin = measureBox(WF_MEASURE.pin);
  if (!pin) WF_MEASURE.pin = null;
  var hover = WF_MEASURE.hover && WF_MEASURE.hover !== WF_MEASURE.pin ? measureBox(WF_MEASURE.hover) : null;
  if (pin && hover) {
    measureOutline(pin, 2, 'pin');
    measureOutline(hover, 1, 'hover');
    measureAxis(pin, hover, true);
    measureAxis(pin, hover, false);
    return;
  }
  var box = hover || pin;
  if (!box) return;
  measureOutline(box, pin ? 2 : 1, pin ? 'pin' : 'hover');
  measureLayoutBands(hover ? WF_MEASURE.hover : WF_MEASURE.pin, box);
  measureDimensions(box);
}
function measureRefresh() {
  if (WF_MEASURE.hasPoint) WF_MEASURE.hover = measureTargetAt(WF_MEASURE.x, WF_MEASURE.y);
  measureDraw();
}
function measureEditable(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].indexOf(String(el.type).toLowerCase()) < 0;
}
// Only a standalone page owns the m key; an embedded page follows its host.
function measureToggleKey(event) {
  return window.parent === window && (event.key === 'm' || event.key === 'M')
    && !event.ctrlKey && !event.metaKey && !event.altKey && !measureEditable(event.target);
}
function measureKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (WF_MEASURE.pin) { WF_MEASURE.pin = null; measureDraw(); }
    return;
  }
  if (measureToggleKey(event)) { event.preventDefault(); setMeasure(false); return; }
  if (measureEditable(event.target) && event.key !== 'Tab') event.preventDefault();
}
// Mouse: a click pins, and clicking the pin again releases it. Touch has no
// hover, so after the first tap pins, tapping another target measures to it.
function measureClick(event) {
  if (event.detail === 0) return;
  var target = measureTargetAt(event.clientX, event.clientY);
  if (WF_MEASURE.touch && WF_MEASURE.pin && target !== WF_MEASURE.pin) {
    WF_MEASURE.hover = target;
  } else {
    WF_MEASURE.pin = target && target !== WF_MEASURE.pin ? target : null;
    WF_MEASURE.hover = WF_MEASURE.touch && !WF_MEASURE.pin ? null : target;
  }
  measureDraw();
  try { if (!document.hasFocus()) window.focus(); } catch (_err) {}
}
function measureCapture(event) {
  if (!WF_MEASURE.on) return;
  event.stopImmediatePropagation();
  if (event.type === 'keydown') { measureKey(event); return; }
  if (event.type === 'pointerdown') WF_MEASURE.touch = event.pointerType === 'touch';
  if (event.type === 'mousedown' || event.type === 'click') event.preventDefault();
  if (event.type === 'click') measureClick(event);
}
function measureMove(event) {
  if (event.pointerType === 'touch') return;
  WF_MEASURE.touch = false;
  WF_MEASURE.x = event.clientX;
  WF_MEASURE.y = event.clientY;
  WF_MEASURE.hasPoint = true;
  measureRefresh();
}
function measureLeave(event) {
  if (event.relatedTarget) return;
  WF_MEASURE.hasPoint = false;
  WF_MEASURE.hover = null;
  measureDraw();
}
function measureListeners(add) {
  var method = add ? 'addEventListener' : 'removeEventListener';
  for (var i = 0; i < WF_MEASURE_STOPPED.length; i++) {
    window[method](WF_MEASURE_STOPPED[i], measureCapture, { capture: true, passive: WF_MEASURE_STOPPED[i].indexOf('touch') === 0 });
  }
  window[method]('pointermove', measureMove, { capture: true, passive: true });
  window[method]('mouseout', measureLeave, true);
  window[method]('scroll', measureRefresh, { capture: true, passive: true });
  window[method]('resize', measureRefresh);
}
function setMeasure(on) {
  if (on === WF_MEASURE.on || !document.body) return;
  WF_MEASURE.on = on;
  if (!on) {
    measureListeners(false);
    if (WF_MEASURE.layer && WF_MEASURE.layer.parentNode) WF_MEASURE.layer.parentNode.removeChild(WF_MEASURE.layer);
    WF_MEASURE.layer = WF_MEASURE.marks = WF_MEASURE.hover = WF_MEASURE.pin = null;
    WF_MEASURE.hasPoint = false;
    return;
  }
  var layer = document.createElement('div');
  layer.setAttribute('data-wf-measure', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;margin:0;padding:0;border:0;background:none;'
    + 'z-index:2147483647;pointer-events:none;overflow:hidden;contain:strict';
  var cursor = document.createElement('style');
  cursor.textContent = '*{cursor:crosshair!important}';
  var marks = document.createElement('div');
  layer.appendChild(cursor);
  layer.appendChild(marks);
  document.body.appendChild(layer);
  WF_MEASURE.layer = layer;
  WF_MEASURE.marks = marks;
  measureListeners(true);
  measureDraw();
}
function measureMessage(event) {
  if (window.parent === window || event.source !== window.parent) return;
  var data = event.data;
  if (!data || data.type !== 'wf:measure' || typeof data.on !== 'boolean') return;
  setMeasure(data.on);
}
function measureToggleListener(event) {
  if (!WF_MEASURE.on && !event.defaultPrevented && !event.repeat && measureToggleKey(event)) setMeasure(true);
}
function initMeasure() {
  window.addEventListener('message', measureMessage);
  if (window.parent === window) window.addEventListener('keydown', measureToggleListener);
}`;
}

module.exports = { buildMeasureRuntimeCode };
