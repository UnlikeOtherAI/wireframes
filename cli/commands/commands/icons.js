'use strict';

const { searchIcons } = require('../../../engine/icons/search');

function runIcons(args = []) {
  const [action, ...rest] = args;
  const words = [];
  let style, limit = 8, json = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--json') json = true;
    else if (rest[i] === '--style') style = rest[++i] || '!';
    else if (rest[i] === '--limit') limit = Number(rest[++i]);
    else if (rest[i].startsWith('-')) { console.error('Unknown option: ' + rest[i]); process.exitCode = 1; return; }
    else words.push(rest[i]);
  }
  if (action !== 'search' || !words.length || (style && !['solid', 'regular', 'brands'].includes(style))
    || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    console.error('Usage: wf icons search <query> [--style solid|regular|brands] [--limit 1..20] [--json]');
    process.exitCode = 1;
    return;
  }
  const catalogue = require('../../../engine/icons/catalogue');
  const query = words.join(' ');
  const icons = searchIcons(catalogue, query, { style, limit });
  console.log(json ? JSON.stringify({ query, icons }) : icons.length
    ? icons.map((icon) => icon.name + ' [' + icon.styles.join(', ') + '] — ' + icon.label).join('\n')
    : 'No matching Font Awesome Free icons.');
}

module.exports = { runIcons };
