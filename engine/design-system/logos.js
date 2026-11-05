'use strict';

const LOGO_SLOTS = Object.freeze(['logo_1', 'logo_2', 'logo_3']);
const MAX_LOGO_BYTES = 256 * 1024;
const MAX_LOGO_DIMENSION = 1024;
const PREFIX = 'data:image/png;base64,';
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function safeLogoSource(source) {
  if (typeof source !== 'string' || !source.startsWith(PREFIX)
      || source.length > PREFIX.length + 4 * Math.ceil(MAX_LOGO_BYTES / 3)) return null;
  const encoded = source.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  let bytes;
  try { bytes = atob(encoded); } catch { return null; }
  if (bytes.length > MAX_LOGO_BYTES || bytes.length < 45) return null;
  const byte = (at) => bytes.charCodeAt(at);
  const u32 = (at) => byte(at) * 0x1000000 + byte(at + 1) * 0x10000 + byte(at + 2) * 0x100 + byte(at + 3);
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((value, i) => byte(i) !== value)
      || u32(8) !== 13 || bytes.slice(12, 16) !== 'IHDR') return null;
  const width = u32(16), height = u32(20);
  if (width < 1 || height < 1 || width > MAX_LOGO_DIMENSION || height > MAX_LOGO_DIMENSION) return null;
  let hasImage = false;
  for (let at = 8; at + 12 <= bytes.length;) {
    const length = u32(at), end = at + length + 12;
    if (end > bytes.length) return null;
    const type = bytes.slice(at + 4, at + 8);
    if (type === 'acTL') return null;
    if (type === 'IDAT') hasImage = true;
    if (type === 'IEND') return length === 0 && end === bytes.length && hasImage ? source : null;
    at = end;
  }
  return null;
}

function logoForSkin(skin, slot) {
  if (!LOGO_SLOTS.includes(slot) || !own(skin?.logos, slot)) return null;
  const logo = skin.logos[slot];
  return logo && typeof logo.name === 'string' && logo.name.trim().length > 0
    && logo.name.length <= 80 && safeLogoSource(logo.src) ? logo : null;
}

function logoDimension(value, fallback) {
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? parseFloat(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(4096, parsed) : fallback;
}

module.exports = { LOGO_SLOTS, MAX_LOGO_BYTES, MAX_LOGO_DIMENSION, safeLogoSource, logoForSkin, logoDimension };
