/**
 * @file ui/SynthesisUI.js
 * @desc 刀剑笑合成镶嵌工坊 UI。
 */

import { getEquipmentTemplate } from './EquipUI.js?v=release-20260830-3';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260830-3';
import { normalizeLegacyEquipmentSlots, renderCraftBagPanel } from './InventoryUI.js?v=release-20260830-3';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBagEquipmentChoices(player) {
  const equippedIds = new Set(Object.values(player?.equipped || {}).flat().filter(Boolean)
    .map(entry => typeof entry === 'string' ? entry : entry.instance_id));
  return (player?.inventory?.slots || []).map(slot => {
    const instanceId = slot?.instance_id;
    if (!instanceId || equippedIds.has(instanceId)) return null;
    const inst = instanceId ? player?.inventory?.equipment_instances?.[instanceId] : null;
    const tpl = getEquipmentTemplate(player, inst);
    if (!inst || !tpl) return null;
    const used = (inst.synthesis_slots || []).filter(Boolean).length;
    const capacity = SynthesisSystem.SLOT_CAPACITY[tpl.slot] || 0;
    const stoneCategory = SynthesisSystem.SLOT_STONE_MAPPING[tpl.slot] || '';
    return {
      key: instanceId,
      capacity,
      used,
      stoneCategory,
      filled: inst.synthesis_slots || [],
      cost: (tpl.required_level || 1) * 1000,
    };
  }).filter(Boolean);
}

export function renderSynthesisWorkbench(player) {
  if (normalizeLegacyEquipmentSlots(player)) window.game?.saveNow?.();
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
        <div class="craft-dropzone equip-slot" data-zone="equip">
          <div class="dz-plus">＋</div><div class="dz-hint">选择装备</div>
        </div>
      </div>
      <div class="slot-grid" id="djx-synth-slot-grid">
        ${Array(4).fill('<div class="synth-slot empty inactive">＋</div>').join('')}
      </div>
      <div class="craft-result" id="djx-synth-result">
        <div class="cr-row"><span class="l">合成费用</span><span class="v cost">--</span></div>
      </div>
      <div class="craft-actions">
        <button class="craft-confirm" disabled onclick="window._djxDoCraft('synth')">镶嵌</button>
        <button class="craft-reset hidden" data-reset onclick="window._djxClearAll('synth')">清空</button>
      </div>
    </div>
    <div class="craft-bag">${renderCraftBagPanel(player, 'synth', extraData)}</div>
  </div>`;
}
