/**
 * @file systems/EnhanceSystem.js
 * @desc 强化系统 +0~+10（成功/失败毁装备）
 * @ref 05_equipment.md 5.5.7 enhance_system
 */
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

export const EnhanceSystem = {
  ENHANCEABLE_SLOTS: new Set(['weapon', 'chest', 'gloves', 'boots', 'inner_armor']),

  // 强化成功率
  SUCCESS_RATE: {
    1: 0.90, 2: 0.80, 3: 0.60, 4: 0.40, 5: 0.20,
    6: 0.10, 7: 0.05, 8: 0.01, 9: 0.001, 10: 0.0001
  },

  /**
   * 强化装备
   * @param {Object} player
   * @param {string} instanceId 背包中的装备实例 ID
   * @param {?string} preferredStoneKey 指定要消耗的强化石品类；不传时兼容旧调用并按 key 消耗
   * @returns {{ success: boolean, message: string }}
   */
  enhance(player, instanceId, preferredStoneKey = null) {
    const { instance: ei, template, slot: bagSlot } = this._getBagEquipment(player, instanceId);
    if (!bagSlot || !ei || !template) {
      return { success: false, message: '装备必须先卸下并放入背包' };
    }
    if (!this.isEnhanceableTemplate(template)) {
      return { success: false, message: '该装备不支持强化' };
    }
    const rawLevel = Number(ei.enhance_level);
    const currentLevel = Number.isFinite(rawLevel) ? Math.max(0, Math.floor(rawLevel)) : 0;
    ei.enhance_level = currentLevel;
    if (currentLevel >= 10) {
      return { success: false, message: `强化等级已达上限 +10` };
    }

    // 获取装备模板（找 required_level 算强化费用）
    // 计算强化费用
    const requiredLevel = Number(template.required_level);
    const cost = (Number.isFinite(requiredLevel) && requiredLevel > 0 ? Math.floor(requiredLevel) : 1) * 1000;
    const gold = Number(player.resources?.gold);
    if (!Number.isSafeInteger(gold) || gold < 0) return { success: false, message: '玩家金币数据异常' };
    if (gold < cost) {
      return { success: false, message: `金币不足，需要 ${cost} 金币` };
    }

    // 消耗强化石（根据已合成石头数量）
    const stoneCount = Array.isArray(ei.synthesis_slots) ? ei.synthesis_slots.filter(Boolean).length : 0;
    let stonesNeeded = 1;
    if (stoneCount >= 4) stonesNeeded = 3;
    else if (stoneCount >= 1) stonesNeeded = 2;

    if (preferredStoneKey != null && !/^enhance_stone_/.test(String(preferredStoneKey))) {
      return { success: false, message: '请选择强化石' };
    }
    const normalizedStoneKey = preferredStoneKey == null ? null : String(preferredStoneKey);
    const availableStones = this._countEnhanceStones(player, normalizedStoneKey);
    if (availableStones < stonesNeeded) {
      return { success: false, message: `强化需要 ${stonesNeeded} 个强化石` };
    }

    // 扣钱扣石头
    const removal = this._removeEnhanceStones(player, stonesNeeded, normalizedStoneKey);
    if (!removal.success) return { success: false, message: '强化石消耗失败' };
    player.resources.gold = gold - cost;
    for (const [itemKey, removedCount] of Object.entries(removal.removed)) {
      eventBus.emit('inventory.changed', {
        player,
        item_key: itemKey,
        action: 'remove',
        changed_count: removedCount,
        count: this._countEnhanceStones(player, itemKey),
      });
    }
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: cost, action: 'remove' });

    // 成功率判定
    const successRate = this.getSuccessRate(player, currentLevel + 1);
    if (Math.random() < successRate) {
      // 成功
      ei.enhance_level = currentLevel + 1;
      return { success: true, message: `强化成功！+${ei.enhance_level}`, successRate };
    } else {
      // 失败摧毁装备（含已合成石头）
      this._destroyEquipment(player, instanceId);
      eventBus.emit('inventory.changed', { player, item_key: ei.item_key, action: 'remove', changed_count: 1, count: 0 });
      return { success: false, message: '强化失败，装备已碎裂！', successRate };
    }
  },

  getSuccessRate(player, targetLevel) {
    const baseRate = this.SUCCESS_RATE[targetLevel] ?? 0.01;
    const rawBonus = Number(player?.enhanceSuccessRate);
    const bonusRate = Number.isFinite(rawBonus) ? rawBonus : 0;
    return Math.max(0, Math.min(1, baseRate + bonusRate));
  },

  isEnhanceableTemplate(template) {
    return !!template && this.ENHANCEABLE_SLOTS.has(template.slot);
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

  _countEnhanceStones(player, preferredStoneKey = null) {
    const slots = player.inventory?.slots || [];
    return slots.reduce((sum, slot) => {
      if (!/^enhance_stone_/.test(slot.item_key || '')) return sum;
      if (preferredStoneKey && slot.item_key !== preferredStoneKey) return sum;
      const count = Number(slot.count);
      if (Number.isSafeInteger(count) && count > 0) {
        return Math.min(Number.MAX_SAFE_INTEGER, sum + count);
      }
      return sum;
    }, 0);
  },

  _removeEnhanceStones(player, count, preferredStoneKey = null) {
    if (!Number.isSafeInteger(count) || count <= 0
      || this._countEnhanceStones(player, preferredStoneKey) < count) {
      return { success: false, removed: {} };
    }
    const slots = player.inventory?.slots || [];
    let remaining = count;
    const removed = {};
    const stoneSlots = slots
      .filter(slot => /^enhance_stone_/.test(slot.item_key || '')
        && (!preferredStoneKey || slot.item_key === preferredStoneKey)
        && Number.isSafeInteger(Number(slot.count))
        && Number(slot.count) > 0)
      .sort((a, b) => a.item_key.localeCompare(b.item_key));

    for (const slot of stoneSlots) {
      const itemKey = slot.item_key;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      removed[itemKey] = (removed[itemKey] || 0) + take;
      if (slot.count === 0) {
        slot.item_key = null;
        delete slot.instance_id;
      }
      if (remaining === 0) return { success: true, removed };
    }

    return { success: false, removed: {} };
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
