/**
 * @file ui/SynthesisUI.js
 * @desc 刀剑笑合成镶嵌工坊 UI。
 */

import { getEquipmentTemplate } from './EquipUI.js';

const SYNTH_SLOTS = ['weapon', 'chest', 'gloves', 'boots', 'inner_armor', 'cape'];
const SLOT_LABEL = { weapon: '武器', chest: '衣服', gloves: '护手', boots: '鞋子', inner_armor: '内甲', cape: '披风' };
const SLOT_ICON = { weapon: '⚔️', chest: '👕', gloves: '🧤', boots: '👟', inner_armor: '🛡️', cape: '🧣' };

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmptyTiles(count) {
  return Array(Math.max(0, count)).fill('<div class="bag-tile empty"></div>').join('');
}

function getEquippedChoices(player) {
  return SYNTH_SLOTS.map(slotKey => {
    const equipped = player?.equipped?.[slotKey];
    const instanceId = equipped?.instance_id;
    const inst = instanceId ? player?.inventory?.equipment_instances?.[instanceId] : null;
    const tpl = getEquipmentTemplate(player, inst);
    if (!inst) return null;
    const used = inst.synthesis_slots?.length || 0;
    const capacity = slotKey === 'inner_armor' ? 2 : 4;
    return {
      key: slotKey,
      name: tpl?.name || inst.item_key,
      sub: `${SLOT_LABEL[slotKey] || slotKey} · 孔位 ${used}/${capacity}`,
      icon: SLOT_ICON[slotKey] || '⚔️',
    };
  }).filter(Boolean);
}

function getSynthesisStones(player) {
  return (player?.inventory?.slots || [])
    .filter(slot => /^(vajra|cold_jade|hot_blood)_/.test(slot.item_key || '') && (slot.count || 0) > 0)
    .map(slot => ({
      key: slot.item_key,
      name: slot.item_key?.startsWith('vajra') ? '金刚石' : slot.item_key?.startsWith('hot_blood') ? '热血石' : '寒玉石',
      count: slot.count || 1,
      icon: slot.item_key?.startsWith('vajra') ? '💠' : slot.item_key?.startsWith('hot_blood') ? '❤️' : '💎',
    }));
}

function renderChoiceTile(item, kind) {
  return `<div class="bag-tile ${kind === 'equip' ? 'equip' : 'stack'}" data-kind="${kind}" data-key="${escapeHtml(item.key)}" data-icon="${escapeHtml(item.icon)}" data-name="${escapeHtml(item.name)}">
    <div class="bt-icon">${item.icon}</div>
    <div class="bt-name">${escapeHtml(item.name)}</div>
    ${item.sub ? `<div class="bt-sub">${escapeHtml(item.sub)}</div>` : ''}
    ${item.count > 1 ? `<div class="bt-badge">×${item.count}</div>` : ''}
  </div>`;
}

export function renderSynthesisWorkbench(player) {
  const equips = getEquippedChoices(player);
  const stones = getSynthesisStones(player);
  const equipGrid = equips.map(item => renderChoiceTile(item, 'equip')).join('') + renderEmptyTiles(12 - equips.length);
  const stoneGrid = stones.map(item => renderChoiceTile(item, 'stone')).join('') + renderEmptyTiles(12 - stones.length);

  return `<div class="craft-body">
    <div class="craft-work">
      <div class="craft-slots">
        <div class="craft-dropzone equip-slot" data-zone="equip">
          <div class="dz-plus">＋</div><div class="dz-hint">选择已穿戴装备</div>
        </div>
        <div class="craft-arrow">＋</div>
        <div class="craft-dropzone stone-slot" data-zone="synth-stone">
          <div class="dz-plus">＋</div><div class="dz-hint">选择<br>合成石</div>
        </div>
      </div>
      <div class="craft-result hidden" id="djx-synth-result"></div>
      <div class="craft-warn hidden" id="djx-synth-warn"></div>
      <div class="craft-actions">
        <button class="craft-confirm" disabled onclick="window._djxDoCraft('synth')">合成</button>
        <button class="craft-reset" data-reset onclick="window._djxClearAll('synth')">清空</button>
      </div>
    </div>
    <div class="craft-bag">
      <div class="bag-label">🎒 可合成装备（已穿戴）</div>
      <div class="bag-grid" id="djx-synth-equip-grid">${equipGrid || renderEmptyTiles(12)}</div>
      <div class="bag-label">💎 合成石</div>
      <div class="bag-grid" id="djx-synth-stone-grid">${stoneGrid || renderEmptyTiles(12)}</div>
    </div>
  </div>`;
}
