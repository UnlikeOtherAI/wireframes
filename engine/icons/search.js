'use strict';

const STYLES = new Set(['solid', 'regular', 'brands']);
const normalize = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const contains = (text, phrase) => phrase !== '' && (' ' + text + ' ').includes(' ' + phrase + ' ');

function createIconIndex(metadata) {
  return Object.entries(metadata).map(([name, data]) => ({
    name,
    label: data.label || name,
    styles: [...new Set((data.styles || data.familyStylesByLicense?.free?.map((s) => s.style) || [])
      .filter((style) => STYLES.has(style)))],
    aliases: data.aliases?.names || [],
    terms: data.search?.terms || [],
  })).filter((icon) => icon.styles.length > 0).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

function rank(icon, query) {
  const name = normalize(icon.name);
  const aliases = icon.aliases.map(normalize);
  const terms = icon.terms.map(normalize);
  if (name === query) return 1000;
  if (aliases.includes(query)) return 950;
  if (terms.includes(query)) return 900;
  if (name.startsWith(query)) return 600;
  const haystack = [name, normalize(icon.label), ...aliases, ...terms].join(' ');
  return query.split(' ').every((word) => contains(haystack, word)) ? 200 : 0;
}

function searchIcons(index, query, { style, limit = 8 } = {}) {
  const queryText = normalize(query);
  const text = queryText === 'settings' ? 'gear' : queryText;
  if (!text || (style && !STYLES.has(style))) return [];
  const count = Math.max(1, Math.min(20, Math.floor(Number(limit)) || 8));
  return index.filter((icon) => !style || icon.styles.includes(style))
    .map((icon) => ({ icon, score: rank(icon, text) })).filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (a.icon.name < b.icon.name ? -1 : a.icon.name > b.icon.name ? 1 : 0))
    .slice(0, count).map(({ icon }) => ({ name: icon.name, label: icon.label, styles: icon.styles }));
}

const GENERIC = new Set(['app', 'bar', 'button', 'header', 'interface', 'page', 'panel', 'text', 'tool', 'top', 'web']);
function iconsForRequest(index, request, { limit = 8, maxChars = 1200 } = {}) {
  const text = normalize(request);
  if (!/\b(icon|icons|symbol|symbols|glyph|glyphs|burger|hamburger|search|menu)\b/.test(text)) return '';
  const scored = index.map((icon) => {
    let score = 0;
    for (const name of [icon.name, ...icon.aliases]) {
      if (contains(text, normalize(name))) score = Math.max(score, 1000 + normalize(name).length);
    }
    for (const term of icon.terms) {
      const phrase = normalize(term);
      if (phrase.length > 2 && !GENERIC.has(phrase) && contains(text, phrase)) {
        score = Math.max(score, 500 + phrase.length);
      }
    }
    return { icon, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score
    || (a.icon.name < b.icon.name ? -1 : a.icon.name > b.icon.name ? 1 : 0));
  const lines = [];
  for (const { icon } of scored) {
    const line = icon.name + ' (' + icon.styles.join('|') + '): ' + icon.label;
    if (lines.length >= Math.min(8, limit) || [...lines, line].join('\n').length > Math.min(1200, maxChars)) break;
    lines.push(line);
  }
  return lines.join('\n');
}

module.exports = { createIconIndex, searchIcons, iconsForRequest };
