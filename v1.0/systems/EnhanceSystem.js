/**
 * @file systems/EnhanceSystem.js
 * @desc 强化系统 +0~+10（成功/失败毁装备）
 * @ref 05_equipment.md 5.5.7 enhance_system
 */
import { eventBus } from '../core/EventBus.js';

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
   * @param {string} instanceId 背包中的装备实例 ID
   * @returns {{ success: boolean, message: string }}
   */
  enhance(player, instanceId) {
    const { instance: ei, template, slot: bagSlot } = this._getBagEquipment(player, instanceId);
    if (!bagSlot || !ei || !template) {
      return { success: false, message: '装备必须先卸下并放入背包' };
    }
    const baseSlot = template.slot;
    // 检查槽位是否可强化
    if (this.FORBIDDEN_SLOTS.includes(baseSlot)) {
      return { success: false, message: `槽位 ${baseSlot} 不可强化` };
    }
    if (!this.ENHANCEABLE_SLOTS.includes(baseSlot)) {
      return { success: false, message: `未知槽位 ${baseSlot}` };
    }

    const currentLevel = ei.enhance_level || 0;
    if (currentLevel >= 10) {
      return { success: false, message: `强化等级已达上限 +10` };
    }

    // 获取装备模板（找 required_level 算强化费用）
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

    const availableStones = this._countEnhanceStones(player);
    if (availableStones < stonesNeeded) {
      return { success: false, message: `强化需要 ${stonesNeeded} 个强化石` };
    }

    // 扣钱扣石头
    player.resources.gold -= cost;
    this._removeEnhanceStones(player, stonesNeeded);
    eventBus.emit('inventory.changed', { player, item_key: 'enhance_stone_01', action: 'remove', changed_count: stonesNeeded, count: this._countEnhanceStones(player) });
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: cost, action: 'remove' });

    // 成功率判定
    const successRate = this.SUCCESS_RATE[currentLevel + 1] || 0.01;
    if (Math.random() < successRate) {
      // 成功
      ei.enhance_level += 1;
      return { success: true, message: `强化成功！+${ei.enhance_level}` };
    } else {
      // 失败摧毁装备（含已合成石头）
      this._destroyEquipment(player, instanceId);
      eventBus.emit('inventory.changed', { player, item_key: ei.item_key, action: 'remove', changed_count: 1, count: 0 });
      return { success: false, message: `强化失败，装备已碎裂！` };
    }
  },

  /**
   * 销毁装备（失败时调用）
   */
  _destroyEquipment(player, instanceId) {
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

  _countEnhanceStones(player) {
    const slots = player.inventory?.slots || [];
    return slots.reduce((sum, slot) => {
      if (/^enhance_stone_/.test(slot.item_key || '')) return sum + (slot.count || 0);
      return sum;
    }, 0);
  },

  _removeEnhanceStones(player, count) {
    const slots = player.inventory?.slots || [];
    let remaining = count;
    const stoneSlots = slots
      .filter(slot => /^enhance_stone_/.test(slot.item_key || '') && (slot.count || 0) > 0)
      .sort((a, b) => a.item_key.localeCompare(b.item_key));

    for (const slot of stoneSlots) {
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count === 0) slot.item_key = null;
      if (remaining === 0) return true;
    }

    return false;
  },

  /**
   * 获取装备模板（用于读 required_level 算费用）
   */
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
