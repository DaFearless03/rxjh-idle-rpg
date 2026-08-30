/**
 * @file ui/EnhanceUI.js
 * @desc 刀剑笑强化工坊 UI。
 */

import { getEquipmentTemplate } from './EquipUI.js?v=release-20260830-3';
import { normalizeLegacyEquipmentSlots, renderCraftBagPanel } from './InventoryUI.js?v=release-20260830-3';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260830-3';

function getBagEquipmentChoices(player) {
  const equippedIds = new Set(Object.values(player?.equipped || {}).flat().filter(Boolean)
    .map(entry => typeof entry === 'string' ? entry : entry.instance_id));
  return (player?.inventory?.slots || []).map(slot => {
    const instanceId = slot?.instance_id;
    if (!instanceId || equippedIds.has(instanceId)) return null;
    const inst = instanceId ? player?.inventory?.equipment_instances?.[instanceId] : null;
    const tpl = getEquipmentTemplate(player, inst);
    if (!inst || !tpl || !EnhanceSystem.isEnhanceableTemplate(tpl)) return null;
    return {
      key: instanceId,
      cost: (tpl.required_level || 1) * 1000,
    };
  }).filter(Boolean);
}

export function renderEnhanceWorkbench(player) {
  if (normalizeLegacyEquipmentSlots(player)) window.game?.saveNow?.();
  const equips = getBagEquipmentChoices(player);

  return `<div class="craft-body">
    <div class="craft-work">
      <div class="craft-slots">
        <div class="craft-dropzone equip-slot" data-zone="equip">
          <div class="dz-plus">＋</div><div class="dz-hint">选择装备</div>
        </div>
        <div class="craft-arrow">＋</div>
        <div class="craft-dropzone stone-slot" data-zone="enhance-stone">
          <div class="dz-plus">＋</div><div class="dz-hint">选择<br>强化石</div>
        </div>
      </div>
      <div class="craft-result" id="djx-enhance-cost">
        <div class="cr-row"><span class="l">强化费用</span><span class="v cost">--</span></div>
      </div>
      <div class="craft-actions">
        <button class="craft-confirm" disabled onclick="window._djxDoCraft('enhance')">强化</button>
        <button class="craft-reset" data-reset onclick="window._djxClearAll('enhance')">清空</button>
      </div>
    </div>
    <div class="craft-bag">${renderCraftBagPanel(player, 'enhance', slot => {
      if (/^enhance_stone_/.test(slot.item_key || '')) return 'data-craft-valid="1"';
      const item = equips.find(equip => equip.key === slot.instance_id);
      return item ? `data-craft-valid="1" data-cost="${item.cost}"` : '';
    })}</div>
  </div>`;
}
