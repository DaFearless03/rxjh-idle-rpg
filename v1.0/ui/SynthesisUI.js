/**
 * @file ui/SynthesisUI.js
 * @desc 刀剑笑合成镶嵌工坊 UI。
 */

import { getEquipmentTemplate } from './EquipUI.js?v=release-20260613-2';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260613-11';
import { renderCraftBagPanel } from './InventoryUI.js?v=release-20260614-2';

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

function getBagEquipmentChoices(player) {
  const equippedIds = new Set(Object.values(player?.equipped || {}).flat().filter(Boolean)
    .map(entry => typeof entry === 'string' ? entry : entry.instance_id));
  return (player?.inventory?.slots || []).map(slot => {
    const instanceId = slot?.instance_id;
    if (!instanceId || equippedIds.has(instanceId)) return null;
    const inst = instanceId ? player?.inventory?.equipment_instances?.[instanceId] : null;
    const tpl = getEquipmentTemplate(player, inst);
    if (!inst || !tpl || !SYNTH_SLOTS.includes(tpl.slot)) return null;
    const used = (inst.synthesis_slots || []).filter(Boolean).length;
    const capacity = SynthesisSystem.SLOT_CAPACITY[tpl.slot] || 0;
    const stoneCategory = SynthesisSystem.SLOT_STONE_MAPPING[tpl.slot] || '';
    return {
      key: instanceId,
      name: tpl.name || inst.item_key,
      sub: `${stoneCategory === 'vajra' ? '金刚石' : stoneCategory === 'hot_blood' ? '热血石' : '寒玉石'}孔`,
      icon: SLOT_ICON[tpl.slot] || '⚔️',
      capacity,
      used,
      stoneCategory,
      filled: inst.synthesis_slots || [],
      cost: (tpl.required_level || 1) * 1000,
    };
  }).filter(Boolean);
}

function getSynthesisStones(player, category) {
  return (player?.inventory?.slots || [])
    .filter(slot => (slot.item_key || '').startsWith(category) && (slot.count || 0) > 0)
    .map(slot => ({
      key: slot.item_key,
      name: category === 'vajra' ? '金刚石' : category === 'hot_blood' ? '热血石' : '寒玉石',
      count: slot.count || 1,
      icon: category === 'vajra' ? '💠' : category === 'hot_blood' ? '❤️' : '🔷',
      category,
      sub: getStoneAttributeLabel(slot.item_key),
    }));
}

function getStoneAttributeLabel(key) {
  const [, attr = '', value = ''] = String(key || '').split('--');
  const labels = {
    atkSelfAdd: '攻击', atkAdd: '攻击', hitAdd: '命中', hitSelfAdd: '命中',
    defAdd: '防御', defSelfAdd: '防御', maxHpAdd: '生命', maxHpSelfAdd: '生命',
    missingAdd: '闪避', weaponSkillBonusAdd: '武功攻击', weaponExtraDamageAdd: '追加伤害',
  };
  return labels[attr] && value ? `${labels[attr]}+${value}` : '';
}

function renderChoiceTile(item, kind) {
  return `<div class="bag-tile ${kind === 'equip' ? 'equip' : 'stack'}" draggable="true" ondragstart="window._djxDragItem(event,'${escapeHtml(item.key)}','synth')" data-kind="${kind}" data-key="${escapeHtml(item.key)}" data-icon="${escapeHtml(item.icon)}" data-name="${escapeHtml(item.name)}" data-cap="${item.capacity || ''}" data-used="${item.used || 0}" data-cost="${item.cost || ''}" data-stone-category="${item.stoneCategory || item.category || ''}" data-filled="${escapeHtml((item.filled || []).join('|'))}">
    ${kind === 'equip' ? `<div class="bt-badge">${item.used}/${item.capacity}孔</div>` : ''}
    <div class="bt-icon">${item.icon}</div>
    <div class="bt-name">${escapeHtml(item.name)}</div>
    ${item.sub ? `<div class="bt-sub">${escapeHtml(item.sub)}</div>` : ''}
    ${item.count > 1 ? `<div class="bt-badge">×${item.count}</div>` : ''}
  </div>`;
}

export function renderSynthesisWorkbench(player) {
  const equipmentMeta = new Map(getBagEquipmentChoices(player).map(item => [item.key, item]));
  const extraData = slot => {
    const item = equipmentMeta.get(slot.instance_id);
    if (item) return `data-craft-valid="1" data-cap="${item.capacity}" data-used="${item.used}" data-cost="${item.cost}" data-stone-category="${item.stoneCategory}" data-filled="${escapeHtml(item.filled.join('|'))}"`;
    const category = SynthesisSystem._getStoneCategory(slot.item_key);
    return ['vajra', 'cold_jade', 'hot_blood'].includes(category) ? `data-craft-valid="1" data-stone-category="${category}"` : '';
  };

  return `<div class="craft-body">
    <div class="craft-work">
      <div class="sheet-gold-bar">持有金币 <b>💰 ${(player?.resources?.gold || 0).toLocaleString()}</b></div>
      <div class="craft-slots">
        <div class="craft-dropzone equip-slot" data-zone="equip" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="window._djxDropItem(event,'equip','synth')">
          <div class="dz-plus">＋</div><div class="dz-hint">拖入装备</div>
        </div>
      </div>
      <div class="slot-grid" id="djx-synth-slot-grid">
        ${Array(4).fill('<div class="synth-slot empty inactive">＋</div>').join('')}
      </div>
      <div class="craft-result hidden" id="djx-synth-result"></div>
      <div class="craft-actions">
        <button class="craft-confirm" disabled onclick="window._djxDoCraft('synth')">镶嵌</button>
        <button class="craft-reset hidden" data-reset onclick="window._djxClearAll('synth')">清空</button>
      </div>
    </div>
    <div class="craft-bag">${renderCraftBagPanel(player, 'synth', extraData)}</div>
  </div>`;
}
