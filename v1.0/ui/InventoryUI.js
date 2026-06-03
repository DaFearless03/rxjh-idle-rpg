/**
 * @file ui/InventoryUI.js
 * @desc 背包页渲染：装备摘要 + demo 风格背包格子。
 */

import { renderEquipmentSummary, getEquipmentTemplate } from './EquipUI.js';

const ITEM_META = {
  hp_potion_grade1: { icon: '🍶', name: '金创药(小)' },
  hp_potion_grade2: { icon: '🍶', name: '金创药(中)' },
  hp_potion_grade3: { icon: '🍶', name: '金创药(大)' },
  mp_potion_grade1: { icon: '🌿', name: '人参' },
  mp_potion_grade2: { icon: '🌿', name: '野山参' },
  mp_potion_grade3: { icon: '🌿', name: '雪原参' },
  enhance_stone_01: { icon: '🪨', name: '强化石' },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function classifyItem(slot, player) {
  if (slot.instance_id) return 'equipment';
  const key = slot.item_key || slot.key || '';
  if (key.startsWith('box_')) return 'boxes';
  if (key.startsWith('cold_jade') || key.startsWith('vajra') || key.startsWith('enhance_stone') || key.startsWith('hot_blood')) return 'stones';
  if (key.includes('_potion_')) return 'consumables';
  if (player?.quests?.accepted?.some(q => JSON.stringify(q).includes(key))) return 'quest_items';
  return 'unknown';
}

function parseStoneAttr(key) {
  const parts = String(key || '').split('_');
  if (parts.length < 4) return '';
  const attr = parts.slice(3, -1).join('_');
  const value = parts[parts.length - 1];
  if (!attr || !Number.isFinite(Number(value))) return '';
  const labels = {
    defAdd: '防御',
    maxHpAdd: '生命',
    atkSelfAdd: '攻击',
    hitAdd: '命中',
  };
  return `${labels[attr] || attr}+${value}`;
}

function getSlotDisplay(slot, player) {
  const key = slot.item_key || slot.key || '';
  if (slot.instance_id) {
    const inst = player?.inventory?.equipment_instances?.[slot.instance_id];
    const tpl = getEquipmentTemplate(player, inst);
    const enhance = inst?.enhance_level || 0;
    return {
      key,
      name: tpl?.name || key,
      icon: getEquipmentIcon(tpl?.slot),
      sub: tpl?.slot || '',
      enhance,
      itemClass: 'equipment',
    };
  }

  const itemClass = classifyItem(slot, player);
  const meta = ITEM_META[key] || {};
  return {
    key,
    name: slot.name || meta.name || key || '未知物品',
    icon: slot.icon || meta.icon || getItemIcon(key, itemClass),
    sub: slot.attr || parseStoneAttr(key),
    enhance: 0,
    itemClass,
  };
}

function getEquipmentIcon(slot) {
  const map = {
    weapon: '⚔',
    chest: '👕',
    gloves: '🧤',
    boots: '👟',
    inner_armor: '🛡',
    cape: '🧣',
    ring: '💍',
    amulet: '📿',
    earring: '📿',
  };
  return map[slot] || '⚔';
}

function getItemIcon(key, itemClass) {
  if (itemClass === 'boxes') return '🎁';
  if (itemClass === 'stones') return key.startsWith('vajra') ? '💠' : '🔷';
  if (itemClass === 'consumables') return key.startsWith('mp_') ? '🌿' : '🍶';
  if (itemClass === 'quest_items') return '📜';
  return '📦';
}

export function renderBagTile(slot, player, options = {}) {
  if (!slot || (slot.count || 0) <= 0 || !(slot.item_key || slot.key)) {
    return '<div class="bag-tile empty"></div>';
  }

  const display = getSlotDisplay(slot, player);
  const count = slot.count || 1;
  const isQuest = display.itemClass === 'quest_items' || slot.quest;
  const classes = [
    'bag-tile',
    display.itemClass === 'equipment' ? 'equip' : 'stack',
    isQuest ? 'cross' : '',
    options.locked ? 'locked' : '',
  ].filter(Boolean).join(' ');

  return `<div class="${classes}" data-key="${escapeHtml(display.key)}" data-icon="${escapeHtml(display.icon)}" data-name="${escapeHtml(display.name)}" data-class="${display.itemClass}" data-count="${count}" ${isQuest ? 'data-quest="1"' : ''} ${slot.instance_id ? `data-instance-id="${escapeHtml(slot.instance_id)}"` : ''}>
    <div class="bt-icon">${display.icon}</div>
    <div class="bt-name">${escapeHtml(display.name)}</div>
    ${display.sub ? `<div class="bt-sub">${escapeHtml(display.sub)}</div>` : ''}
    ${display.enhance > 0 ? `<div class="bt-enh">+${display.enhance}</div>` : ''}
    ${isQuest ? '<div class="bt-badge cross">任务</div>' : count > 1 ? `<div class="bt-badge">×${count}</div>` : ''}
  </div>`;
}

function renderBagGrid(player) {
  const slots = player?.inventory?.slots || [];
  const capacity = player?.inventory?.capacity || 50;
  const used = slots.filter(s => (s.count || 0) > 0).length;
  const tiles = slots.map(slot => renderBagTile(slot, player));
  while (tiles.length < Math.min(capacity, 50)) tiles.push('<div class="bag-tile empty"></div>');

  return `<div class="inventory-bag-panel">
    <div class="bag-head">
      <span class="bh-title">背包</span>
      <span class="bh-hint">物品 ${used}/${capacity}</span>
    </div>
    <div class="bag-grid inventory-bag-grid" id="inventoryBagGrid">${tiles.join('')}</div>
  </div>`;
}

export function renderInventoryPanel(player) {
  if (!player) return '<div class="inventory-empty">暂无角色数据</div>';
  return `<div class="inventory-page">
    ${renderEquipmentSummary(player)}
    ${renderBagGrid(player)}
  </div>`;
}

export function mountInventoryPanel(container, player) {
  if (!container) return;
  container.innerHTML = renderInventoryPanel(player);
}
