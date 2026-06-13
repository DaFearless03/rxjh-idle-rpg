/**
 * @file systems/SynthesisSystem.js
 * @desc 合成系统：石头嵌入装备孔位
 * @ref 05_equipment.md 5.5.10 synthesis_system
 */
import { InventorySystem } from './InventorySystem.js';
import { eventBus } from '../core/EventBus.js';

export const SynthesisSystem = {
  // 各装备槽位孔数
  SLOT_CAPACITY: {
    weapon: 4,
    chest: 4,
    gloves: 4,
    boots: 4,
    inner_armor: 2,
    ring: 0,
    amulet: 0,
    earring: 0,
    cape: 4
  },

  // 槽位对应石头类型
  SLOT_STONE_MAPPING: {
    weapon: 'vajra',
    chest: 'cold_jade',
    gloves: 'cold_jade',
    boots: 'cold_jade',
    inner_armor: 'cold_jade',
    cape: 'hot_blood'
  },

  // 不可合成槽位
  FORBIDDEN_SLOTS: ['ring', 'amulet', 'earring'],

  /**
   * 合成石头到装备
   * @param {Object} player
   * @param {string} instanceId 背包中的装备实例 ID
   * @param {string} stoneItemKey 石头 item_key（来自背包 slots 的 item_key）
   * @returns {{ success: boolean, message: string }}
   */
  synthesize(player, instanceId, stoneItemKey) {
    const { instance: ei, template, slot: bagSlot } = this._getBagEquipment(player, instanceId);
    if (!bagSlot || !ei || !template) {
      return { success: false, message: '装备必须先卸下并放入背包' };
    }
    const baseSlot = template.slot;
    if (this.FORBIDDEN_SLOTS.includes(baseSlot)) {
      return { success: false, message: `槽位 ${baseSlot} 不可合成` };
    }

    const capacity = this.SLOT_CAPACITY[baseSlot] || 0;
    if (capacity === 0) {
      return { success: false, message: `槽位 ${baseSlot} 无孔位` };
    }

    // 检查孔位是否已满
    const currentStones = ei.synthesis_slots || [];
    if (currentStones.length >= capacity) {
      return { success: false, message: `孔位已满` };
    }

    // 找到背包中的石头槽位（按 item_key 查找，石头无 instance_id）
    const slots = player.inventory?.slots || [];
    let stoneSlot = null;
    for (const s of slots) {
      if (s.item_key === stoneItemKey && s.count > 0) {
        stoneSlot = s;
        break;
      }
    }
    if (!stoneSlot) {
      return { success: false, message: `石头 ${stoneItemKey} 不在背包中` };
    }

    // 获取石头模板（根据 stone item_key 反推 category）
    const stoneCategory = this._getStoneCategory(stoneItemKey);
    const requiredCategory = this.SLOT_STONE_MAPPING[baseSlot];
    if (stoneCategory !== requiredCategory) {
      return { success: false, message: `石头类型不匹配，需要 ${requiredCategory}，当前 ${stoneCategory}` };
    }

    // 获取装备模板（算费用）
    const cost = (template?.required_level || 1) * 1000;
    if ((player.resources?.gold || 0) < cost) {
      return { success: false, message: `金币不足，需要 ${cost} 金币` };
    }

    // 扣钱
    player.resources.gold -= cost;

    // 石头从背包移除（1个）
    stoneSlot.count -= 1;
    if (stoneSlot.count === 0) {
      stoneSlot.item_key = null;
    }

    // 石头 key 追加到装备 synthesis_slots
    ei.synthesis_slots = ei.synthesis_slots || [];
    ei.synthesis_slots.push(stoneItemKey);
    eventBus.emit('inventory.changed', { player, item_key: stoneItemKey, action: 'remove', changed_count: 1, count: InventorySystem.count(player, stoneItemKey) });
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: cost, action: 'remove' });

    return { success: true, message: `合成成功！孔位 ${ei.synthesis_slots.length}/${capacity}` };
  },

  _getStoneCategory(stoneItemKey) {
    if (stoneItemKey.startsWith('vajra')) return 'vajra';
    if (stoneItemKey.startsWith('cold_jade')) return 'cold_jade';
    if (stoneItemKey.startsWith('hot_blood')) return 'hot_blood';
    if (stoneItemKey.startsWith('enhance_stone')) return 'enhance';
    return null;
  },

  _getBagEquipment(player, instanceId) {
    const equippedIds = Object.values(player.equipped || {}).flat().filter(Boolean)
      .map(entry => typeof entry === 'string' ? entry : entry.instance_id);
    if (equippedIds.includes(instanceId)) return {};
    const slot = (player.inventory?.slots || []).find(entry => entry?.instance_id === instanceId && (entry.count || 0) > 0);
    const instance = player.inventory?.equipment_instances?.[instanceId];
    const template = player._equipTemplates?.find(item => item.key === instance?.item_key);
    return { slot, instance, template };
  }
};
