'use strict';

// Where every key, value and item of one YAML document sits in its text.
//
// js-yaml reports the start and end of each node it composes through its
// `listener` option. Those events are turned into a tree of ranges beside the
// parsed value, so the value is js-yaml's own and lint sees what the build sees.
//
// Offsets are UTF-16 indexes into the text given, start inclusive, end exclusive.

const yaml = require('js-yaml');

const isSpace = (char) => char === ' ' || char === '\t' || char === '\n' || char === '\r';

/** The first offset at or after `from` that is not whitespace or a comment. */
function skipBlank(text, from) {
  let position = from;
  while (position < text.length) {
    const char = text[position];
    if (isSpace(char)) {
      position += 1;
    } else if (char === '#' && (position === 0 || isSpace(text[position - 1]))) {
      while (position < text.length && text[position] !== '\n') position += 1;
    } else {
      break;
    }
  }
  return position;
}

function trimEnd(text, end, start) {
  let position = end;
  while (position > start && isSpace(text[position - 1])) position -= 1;
  return position;
}

function isCollection(value) {
  return value !== null && typeof value === 'object';
}

/**
 * js-yaml tries a value as the first key of a block mapping before anything else,
 * so a scalar or a flow collection arrives wrapped in a frame holding the same
 * result. The inner frame is the node; the outer one adds only leading space.
 */
function unwrap(frame) {
  let current = frame;
  for (;;) {
    const result = current.result;
    const inner = current.children.find((child) => child.kind !== null && child.kind === current.kind && (
      isCollection(result) ? child.result === result : Object.is(child.result, result)
    ) && (isCollection(result) || current.children.filter((entry) => entry.kind !== null).length === 1));
    if (!inner) return current;
    current = inner;
  }
}

function buildMapping(frame, text, node) {
  const children = frame.children;
  let last = node.start;
  for (let index = 0; index < children.length; index += 1) {
    const keyFrame = children[index];
    // A failed attempt to read another key leaves an empty frame behind.
    if (keyFrame.kind === null) continue;
    const key = buildNode(keyFrame, text);
    last = Math.max(last, key.end);
    let value = null;
    const afterKey = skipBlank(text, keyFrame.close);
    if (text[afterKey] === ':' && index + 1 < children.length) {
      index += 1;
      value = buildNode(children[index], text);
      // An empty value has no text of its own: it sits just after the colon.
      if (value.kind === 'null') value.start = value.end = afterKey + 1;
      last = Math.max(last, value.end);
    }
    node.entries.set(String(key.value), { key: { start: key.start, end: key.end }, value });
  }
  return last;
}

/** Where each `-` of a block sequence is: one per item, at the sequence's own column. */
function dashOffsets(text, start, end) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const column = start - lineStart;
  const dashes = [];
  for (let line = lineStart; line < end; line = text.indexOf('\n', line) + 1) {
    const dash = line + column;
    if (dash < end && text[dash] === '-' && (dash + 1 >= text.length || isSpace(text[dash + 1]))
        && text.slice(line, dash).trim() === '') dashes.push(dash);
    if (text.indexOf('\n', line) === -1) break;
  }
  return dashes;
}

function isAliasOrContent(frame) {
  return frame.kind !== null || (frame.result !== null && frame.result !== undefined);
}

function buildSequence(frame, text, node, flow) {
  const frames = frame.children.filter(isAliasOrContent);
  const values = Array.isArray(frame.result) ? frame.result : [];
  node.items = values.map(() => null);
  let last = node.start;
  const place = (index, candidate) => {
    const item = buildNode(candidate, text);
    node.items[index] = item;
    last = Math.max(last, item.end);
  };

  // An empty `-` composes nothing, so a block item is matched to its dash, not counted.
  const dashes = flow ? [] : dashOffsets(text, node.start, frame.close);
  if (!flow && dashes.length === values.length) {
    for (const candidate of frames) {
      let index = dashes.length - 1;
      while (index >= 0 && dashes[index] >= candidate.open) index -= 1;
      if (index >= 0 && node.items[index] === null) place(index, candidate);
    }
    return last;
  }

  let next = 0;
  for (let index = 0; index < values.length; index += 1) {
    const candidate = frames[next];
    if (!candidate) break;
    if (Object.is(unwrap(candidate).result, values[index])) {
      place(index, candidate);
      next += 1;
    } else if (text[skipBlank(text, candidate.close)] === ':') {
      // `[a: 1]` builds a mapping of its own from a key frame and a value frame.
      next += 2;
    }
  }
  return last;
}

/** Past an anchor or a tag, which come before the node they belong to. */
function skipProperties(text, from) {
  let position = from;
  while (text[position] === '&' || text[position] === '!') {
    while (position < text.length && !isSpace(text[position])) position += 1;
    position = skipBlank(text, position);
  }
  return position;
}

function buildNode(wrapper, text) {
  const frame = unwrap(wrapper);
  if (frame.kind === null) {
    // An alias composes no node of its own: it hands back the anchored value.
    if (frame.result !== null && frame.result !== undefined) {
      // The frame runs on to the next token, past any comment, so the name is read from the text.
      const start = Math.min(skipBlank(text, frame.open), frame.close);
      const name = /^\*[^\s,[\]{}]*/.exec(text.slice(start, frame.close));
      return { kind: 'alias', value: frame.result, start, end: start + (name ? name[0].length : 0) };
    }
    return { kind: 'null', value: null, start: frame.open, end: frame.open };
  }
  const start = Math.min(skipBlank(text, frame.open), frame.close);
  const node = { kind: frame.kind, value: frame.result, start, end: start };
  if (frame.kind === 'mapping' || frame.kind === 'sequence') {
    // A flow collection ends at its closing bracket; a block one at its last child.
    const opener = text[skipProperties(text, start)];
    const flow = opener === '{' || opener === '[';
    if (frame.kind === 'mapping') node.entries = new Map();
    const last = frame.kind === 'mapping' ? buildMapping(frame, text, node) : buildSequence(frame, text, node, flow);
    node.end = flow ? trimEnd(text, frame.close, start) : Math.max(last, start);
  } else {
    node.end = Math.max(trimEnd(text, frame.close, start), start);
  }
  return node;
}

/**
 * Parse one YAML document.
 * @returns {{ ok: true, value: unknown, root: object | null } | { ok: false, error: { message: string, offset: number } }}
 */
function parseDocument(text) {
  const roots = [];
  const stack = [];
  let value;
  try {
    value = yaml.load(text, {
      schema: yaml.CORE_SCHEMA,
      listener(type, state) {
        if (type === 'open') {
          const frame = { open: state.position, close: state.position, kind: null, result: null, children: [] };
          if (stack.length > 0) stack[stack.length - 1].children.push(frame);
          else roots.push(frame);
          stack.push(frame);
        } else {
          const frame = stack.pop();
          if (!frame) return;
          frame.close = state.position;
          frame.kind = state.kind;
          frame.result = state.result;
        }
      },
    });
  } catch (error) {
    const offset = Number.isInteger(error?.mark?.position) ? error.mark.position : 0;
    return {
      ok: false,
      error: {
        message: typeof error?.reason === 'string' ? error.reason : String(error?.message || 'Invalid YAML.').split('\n')[0],
        offset: Math.max(0, Math.min(offset, text.length)),
      },
    };
  }
  const rootFrame = roots.find((frame) => frame.kind !== null);
  return { ok: true, value, root: rootFrame ? buildNode(rootFrame, text) : null };
}

/**
 * `$.page.slots[0].content[1]["odd key"]` as its segments. This is the path
 * syntax the schema validator writes.
 */
function parsePath(path) {
  const segments = [];
  const pattern = /\.([A-Za-z0-9_]+)|\[(\d+)\]|\[("(?:[^"\\]|\\.)*")\]/g;
  const body = String(path || '').replace(/^\$/, '');
  let consumed = 0;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index !== consumed) break;
    consumed = pattern.lastIndex;
    if (match[1] !== undefined) segments.push(match[1]);
    else if (match[2] !== undefined) segments.push(Number(match[2]));
    else segments.push(JSON.parse(match[3]));
  }
  return segments;
}

/**
 * Follow a path as far as the text allows.
 * @returns {{ node: object, key: {start:number,end:number} | null, complete: boolean }}
 */
function locate(root, segments) {
  let node = root;
  let key = null;
  for (const segment of segments) {
    let next = null;
    let nextKey = null;
    if (node && node.kind === 'mapping') {
      const entry = node.entries.get(String(segment));
      if (entry) {
        next = entry.value;
        nextKey = entry.key;
      }
    } else if (node && node.kind === 'sequence' && Number.isInteger(segment)) {
      next = node.items[segment] || null;
    }
    if (!next && !nextKey) return { node, key, complete: false };
    key = nextKey;
    // A key with no value of its own still has somewhere to point: the key.
    node = next || { kind: 'null', value: null, start: nextKey.end, end: nextKey.end };
  }
  return { node, key, complete: true };
}

/** Every mapping whose `id` is the one asked for, in the order they are written. */
function findAllById(root, id) {
  const found = [];
  const visit = (node) => {
    if (!node) return;
    if (node.kind === 'mapping') {
      const entry = node.entries.get('id');
      if (entry && entry.value && entry.value.value === id) found.push({ node, id: entry.value });
      for (const child of node.entries.values()) visit(child.value);
    } else if (node.kind === 'sequence') {
      node.items.forEach(visit);
    }
  };
  visit(root);
  return found.sort((a, b) => a.id.start - b.id.start);
}

/** The first of them, or null. */
function findById(root, id) {
  return findAllById(root, id)[0] || null;
}

module.exports = {
  parseDocument,
  parsePath,
  locate,
  findById,
  findAllById,
  skipBlank,
};
