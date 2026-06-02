/**
 * @file systems/SynthesisSystem.js
 * @desc 合成系统：石头嵌入装备孔位
 * @ref 05_equipment.md 5.5.10 synthesis_system
 */
import { InventorySystem } from './InventorySystem.js';

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
   * @param {string} slotKey "weapon" | "chest" | ...
   * @param {string} stoneItemKey 石头 item_key（来自背包 slots 的 item_key）
   * @returns {{ success: boolean, message: string }}
   */
  synthesize(player, slotKey, stoneItemKey) {
    if (this.FORBIDDEN_SLOTS.includes(slotKey)) {
      return { success: false, message: `槽位 ${slotKey} 不可合成` };
    }

    const capacity = this.SLOT_CAPACITY[slotKey] || 0;
    if (capacity === 0) {
      return { success: false, message: `槽位 ${slotKey} 无孔位` };
    }

    // 获取装备实例
    const equipInstanceId = player.equipped?.[slotKey]?.instance_id;
    if (!equipInstanceId) {
      return { success: false, message: `${slotKey} 槽位没有装备` };
    }
    const ei = player.inventory?.equipment_instances?.[equipInstanceId];
    if (!ei) {
      return { success: false, message: `装备实例不存在` };
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
    const requiredCategory = this.SLOT_STONE_MAPPING[slotKey];
    if (stoneCategory !== requiredCategory) {
      return { success: false, message: `石头类型不匹配，需要 ${requiredCategory}，当前 ${stoneCategory}` };
    }

    // 获取装备模板（算费用）
    const template = this._getEquipmentTemplate(player, slotKey);
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

    return { success: true, message: `合成成功！孔位 ${currentStones.length + 1}/${capacity}` };
  },

  _getStoneCategory(stoneItemKey) {
    if (stoneItemKey.startsWith('vajra')) return 'vajra';
    if (stoneItemKey.startsWith('cold_jade')) return 'cold_jade';
    if (stoneItemKey.startsWith('hot_blood')) return 'hot_blood';
    if (stoneItemKey.startsWith('enhance_stone')) return 'enhance';
    return null;
  },

  _getEquipmentTemplate(player, slotKey) {
    const instanceId = player.equipped?.[slotKey]?.instance_id;
    if (!instanceId) return null;
    const ei = player.inventory?.equipment_instances?.[instanceId];
    if (!ei) return null;
    return player._equipTemplates?.find(t => t.key === ei.item_key) || null;
  }
};