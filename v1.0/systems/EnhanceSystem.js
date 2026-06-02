/**
 * @file systems/EnhanceSystem.js
 * @desc 强化系统 +0~+10（成功/失败毁装备）
 * @ref 05_equipment.md 5.5.7 enhance_system
 */
import { InventorySystem } from './InventorySystem.js';
import { random } from '../utils/random.js';

export const EnhanceSystem = {
  // 强化成功率
  SUCCESS_RATE: {
    1: 0.90, 2: 0.80, 3: 0.60, 4: 0.40, 5: 0.20,
    6: 0.10, 7: 0.05, 8: 0.01, 9: 0.001, 10: 0.0001
  },

  // 可强化槽位
  ENHANCEABLE_SLOTS: ['weapon', 'chest', 'gloves', 'boots', 'inner_armor'],

  // 不可强化槽位
  FORBIDDEN_SLOTS: ['amulet', 'ring', 'earring', 'cape'],

  /**
   * 强化装备
   * @param {Object} player
   * @param {string} slotKey "weapon" | "chest" | ...
   * @returns {{ success: boolean, message: string }}
   */
  enhance(player, slotKey) {
    // 检查槽位是否可强化
    if (this.FORBIDDEN_SLOTS.includes(slotKey)) {
      return { success: false, message: `槽位 ${slotKey} 不可强化` };
    }
    if (!this.ENHANCEABLE_SLOTS.includes(slotKey)) {
      return { success: false, message: `未知槽位 ${slotKey}` };
    }

    // 获取已装备的实例
    const instanceId = player.equipped?.[slotKey]?.instance_id;
    if (!instanceId) {
      return { success: false, message: `${slotKey} 槽位没有装备` };
    }

    const ei = player.inventory?.equipment_instances?.[instanceId];
    if (!ei) {
      return { success: false, message: `装备实例不存在` };
    }

    const currentLevel = ei.enhance_level || 0;
    if (currentLevel >= 10) {
      return { success: false, message: `强化等级已达上限 +10` };
    }

    // 获取装备模板（找 required_level 算强化费用）
    const template = this._getEquipmentTemplate(player, slotKey);
    if (!template) {
      return { success: false, message: `装备模板未找到` };
    }

    // 计算强化费用
    const cost = template.required_level * 1000;
    if ((player.resources?.gold || 0) < cost) {
      return { success: false, message: `金币不足，需要 ${cost} 金币` };
    }

    // 消耗强化石（根据已合成石头数量）
    const stoneCount = (ei.synthesis_slots || []).length;
    let stonesNeeded = 1;
    if (stoneCount >= 4) stonesNeeded = 3;
    else if (stoneCount >= 1) stonesNeeded = 2;

    const hasStones = InventorySystem.count(player, 'enhance_stone_01') >= stonesNeeded;
    if (!hasStones) {
      return { success: false, message: `强化需要 ${stonesNeeded} 个强化石` };
    }

    // 扣钱扣石头
    player.resources.gold -= cost;
    InventorySystem.remove(player, 'enhance_stone_01', stonesNeeded);

    // 成功率判定
    const successRate = this.SUCCESS_RATE[currentLevel + 1] || 0.01;
    if (Math.random() < successRate) {
      // 成功
      ei.enhance_level += 1;
      return { success: true, message: `强化成功！+${ei.enhance_level}` };
    } else {
      // 失败摧毁装备（含已合成石头）
      this._destroyEquipment(player, slotKey, instanceId);
      return { success: false, message: `强化失败，装备已碎裂！` };
    }
  },

  /**
   * 销毁装备（失败时调用）
   */
  _destroyEquipment(player, slotKey, instanceId) {
    // 从 equipped 清除
    player.equipped[slotKey] = null;

    // 从 inventory.slots 移除（通过 instance_id 找槽位）
    const slots = player.inventory?.slots || [];
    for (const slot of slots) {
      if (slot.instance_id === instanceId) {
        slot.item_key = null;
        slot.instance_id = null;
        slot.count = 0;
        break;
      }
    }

    // 从 equipment_instances 删除
    if (player.inventory?.equipment_instances?.[instanceId]) {
      delete player.inventory.equipment_instances[instanceId];
    }
  },

  /**
   * 获取装备模板（用于读 required_level 算费用）
   */
  _getEquipmentTemplate(player, slotKey) {
    const instanceId = player.equipped?.[slotKey]?.instance_id;
    if (!instanceId) return null;
    const ei = player.inventory?.equipment_instances?.[instanceId];
    if (!ei) return null;
    // 需要传入外部装备模板，这里简化处理：直接从 player._equipTemplates 查
    return player._equipTemplates?.find(t => t.key === ei.item_key) || null;
  }
};