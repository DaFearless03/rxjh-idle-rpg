/**
 * @file ui/PixelIconUI.js
 * @desc Shared pixel icon markup for the 64px source / existing-size display rule.
 */

const PIXEL_ICON_VERSION = '20260923-icons-6';
const PIXEL_ICON_NAMES = new Set([
  'boss', 'combat', 'defense', 'elite', 'enhance', 'gold', 'hp', 'map', 'mp',
  'nav-bag', 'nav-character', 'nav-home', 'nav-quest', 'nav-settings',
  'potion-hp', 'qigong', 'synthesis', 'teleport', 'town', 'warehouse',
]);
const ICON_ALIASES = Object.freeze({
  '🍶': 'potion-hp', '🌿': 'mp', '🪨': 'synthesis', '💠': 'synthesis', '🔷': 'synthesis',
  '🎁': 'warehouse', '📜': 'nav-quest', '📦': 'warehouse', '⚔': 'combat', '⚔️': 'combat',
  '🛡': 'defense', '🛡️': 'defense', '🧪': 'potion-hp', '💎': 'synthesis', '⚒': 'enhance',
  '🗡️': 'combat', '🪄': 'qigong', '🔱': 'combat',
});

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function pixelIconSrc(name) {
  return `icons/${name}.png?v=${PIXEL_ICON_VERSION}`;
}

export function pixelIcon(name, className = '', alt = '') {
  const classes = ['ui-icon-img', className].filter(Boolean).join(' ');
  const altAttr = escapeAttr(alt);
  return `<img class="${classes}" src="${pixelIconSrc(name)}" alt="${altAttr}"${alt ? '' : ' aria-hidden="true"'} draggable="false">`;
}

export function resolvePixelIcon(value, itemKey = '', itemClass = '') {
  const candidate = String(value ?? '');
  return PIXEL_ICON_NAMES.has(candidate)
    ? candidate
    : ICON_ALIASES[candidate] || pixelIconForItem(itemKey, itemClass);
}

export function pixelIconMarkup(value, itemKey = '', itemClass = '') {
  return pixelIcon(resolvePixelIcon(value, itemKey, itemClass));
}

export function pixelIconForItem(itemKey = '', itemClass = '') {
  const key = String(itemKey);
  if (itemClass === 'equipment') return 'combat';
  if (itemClass === 'boxes') return 'warehouse';
  if (itemClass === 'stones') return 'synthesis';
  if (itemClass === 'quest_items') return 'nav-quest';
  if (itemClass === 'consumables') return key.startsWith('mp_') ? 'mp' : 'potion-hp';
  return 'warehouse';
}
