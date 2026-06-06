/**
 * @file systems/EnhanceSystem.js
 * @desc 强化系统 +0~+10（成功/失败毁装备）
 * @ref 05_equipment.md 5.5.7 enhance_system
 */
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
    const { baseSlot, index, equipped } = this._resolveSlot(player, slotKey);
    // 检查槽位是否可强化
    if (this.FORBIDDEN_SLOTS.includes(baseSlot)) {
      return { success: false, message: `槽位 ${baseSlot} 不可强化` };
    }
    if (!this.ENHANCEABLE_SLOTS.includes(baseSlot)) {
      return { success: false, message: `未知槽位 ${baseSlot}` };
    }

    // 获取已装备的实例
    const instanceId = equipped?.instance_id;
    if (!instanceId) {
      return { success: false, message: `${baseSlot} 槽位没有装备` };
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

    const availableStones = this._countEnhanceStones(player);
    if (availableStones < stonesNeeded) {
      return { success: false, message: `强化需要 ${stonesNeeded} 个强化石` };
    }

    // 扣钱扣石头
    player.resources.gold -= cost;
    this._removeEnhanceStones(player, stonesNeeded);

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
    const { baseSlot, index } = this._resolveSlot(player, slotKey);
    // 从 equipped 清除
    if (index == null) player.equipped[baseSlot] = null;
    else player.equipped[baseSlot][index] = null;

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
  _getEquipmentTemplate(player, slotKey) {
    const instanceId = this._resolveSlot(player, slotKey).equipped?.instance_id;
    if (!instanceId) return null;
    const ei = player.inventory?.equipment_instances?.[instanceId];
    if (!ei) return null;
    // 需要传入外部装备模板，这里简化处理：直接从 player._equipTemplates 查
    return player._equipTemplates?.find(t => t.key === ei.item_key) || null;
  },

  _resolveSlot(player, slotRef) {
    const [baseSlot, rawIndex] = String(slotRef || '').split(':');
    const index = rawIndex === undefined ? null : Number(rawIndex);
    const value = player.equipped?.[baseSlot];
    return {
      baseSlot,
      index,
      equipped: index == null ? value : value?.[index],
    };
  }
};
