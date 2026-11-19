'use strict';

// Where a rendered repeat row, or a failure inside one, is written. Validation
// resolves stamped copies of what a page renders, the same stamps the build's
// source annotation uses, so a row records its document and `…repeat.items[i]`
// path and a finding can be located at the item rather than by an id that is
// written nowhere.

const { stampNodes } = require('../build/source-stamps');
const { appendPath } = require('../schema/validator');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/** Stamped copies of a page payload, its template and the definitions it resolves against. */
function stampRenderedInputs({ pageId, page, template, templateId, components }) {
  return {
    page: stampNodes(page, `page:${pageId}`, 'page'),
    template: isObject(template) ? stampNodes(template, `template:${templateId}`) : template,
    components: isObject(components)
      ? Object.fromEntries(Object.entries(components).map(([id, definition]) => [id, stampNodes(definition, `component:${id}`)]))
      : components,
  };
}

/**
 * The lint `at` of a stamped node, `{ document, file?, path }`, or undefined.
 * `sources` names the file a component is defined in (`{ sourcePath, localId }`).
 * `suffix` adds path segments below the node, such as `['id']`.
 */
function placeOf(node, sources, suffix = []) {
  if (!isObject(node) || typeof node.__source !== 'string' || typeof node.__sourcePath !== 'string') return undefined;
  const address = node.__source.slice(0, node.__source.indexOf('#'));
  const kind = address.slice(0, address.indexOf(':'));
  const id = address.slice(address.indexOf(':') + 1);
  let place;
  if (kind === 'page') {
    place = { document: address, path: `$.${node.__sourcePath}` };
  } else if (kind === 'template') {
    place = { document: 'templates', path: `${appendPath('$.templates', id)}.${node.__sourcePath}` };
  } else if (kind === 'component') {
    const source = isObject(sources) ? sources[id] : null;
    place = {
      document: 'components',
      ...(isObject(source) ? { file: source.sourcePath } : {}),
      path: `${appendPath('$.components', isObject(source) ? source.localId : id)}.${node.__sourcePath}`,
    };
  } else {
    return undefined;
  }
  for (const segment of suffix) place.path = appendPath(place.path, segment);
  return place;
}

/** The `repeat` key of the host a stamped row was made by, or undefined. */
function repeatPlaceOf(row, sources) {
  const place = placeOf(row, sources);
  return place ? { ...place, path: place.path.replace(/\.items\[\d+\]$/, ''), key: true } : undefined;
}

module.exports = { placeOf, repeatPlaceOf, stampRenderedInputs };
