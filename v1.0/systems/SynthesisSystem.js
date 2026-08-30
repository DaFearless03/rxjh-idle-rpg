/**
 * @file systems/SynthesisSystem.js
 * @desc 合成系统：石头嵌入装备孔位
 * @ref 05_equipment.md 5.5.10 synthesis_system
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { QigongSystem } from './QigongSystem.js?v=release-20260830-3';

export const SynthesisSystem = {
  SUCCESS_RATE: {
    0: 0.90,
    1: 0.50,
    2: 0.20,
    3: 0.05,
  },

  // 各装备槽位孔数
  SLOT_CAPACITY: {
    weapon: 4,
    chest: 4,
    gloves: 4,
    boots: 4,
    inner_armor: 2,
    ring: 4,
    amulet: 4,
    earring: 4,
    cape: 4
  },

  // 槽位对应石头类型
  SLOT_STONE_MAPPING: {
    weapon: 'vajra',
    chest: 'cold_jade',
    gloves: 'cold_jade',
    boots: 'cold_jade',
    inner_armor: 'cold_jade',
    ring: 'cold_jade',
    amulet: 'cold_jade',
    earring: 'cold_jade',
    cape: 'hot_blood'
  },

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
    const capacity = this.SLOT_CAPACITY[baseSlot] || 0;
    if (capacity === 0) {
      return { success: false, message: `槽位 ${baseSlot} 无孔位` };
    }

    if (typeof stoneItemKey !== 'string' || !stoneItemKey) {
      return { success: false, message: '请选择合成石' };
    }

    // 检查孔位是否已满
    if (!Array.isArray(ei.synthesis_slots)) ei.synthesis_slots = [];
    const currentStones = ei.synthesis_slots.filter(Boolean);
    const occupiedCount = currentStones.length;
    if (occupiedCount >= capacity) {
      return { success: false, message: `孔位已满` };
    }
    // 旧存档可能使用 [stone, null, ...] 表示空孔。先紧凑化，
    // 否则 push 会追加到第 5 格，生成无法再保存的装备。

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
    const requiredLevel = Number(template?.required_level);
    const cost = (Number.isFinite(requiredLevel) && requiredLevel > 0 ? Math.floor(requiredLevel) : 1) * 1000;
    const gold = Number(player.resources?.gold);
    if (!Number.isSafeInteger(gold) || gold < 0) return { success: false, message: '玩家金币数据异常' };
    if (gold < cost) {
      return { success: false, message: `金币不足，需要 ${cost} 金币` };
    }

    const boundStoneKey = QigongSystem.bindSkillLevelStone(player, stoneItemKey);
    if (typeof boundStoneKey !== 'string'
      || boundStoneKey.length === 0
      || boundStoneKey.length > 256
      || !/^[A-Za-z0-9_.:-]+$/.test(boundStoneKey)) {
      return { success: false, message: '合成石数据无效' };
    }

    if (!InventorySystem.remove(player, stoneItemKey, 1)) {
      return { success: false, message: '合成石消耗失败' };
    }
    player.resources.gold = gold - cost;
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: cost, action: 'remove' });

    const successRate = this.getSuccessRate(player, occupiedCount);
    if (Math.random() >= successRate) {
      return {
        success: false,
        message: '合成失败，合成石已消失',
        successRate,
      };
    }

    // 石头 key 追加到装备 synthesis_slots
    ei.synthesis_slots = [...currentStones, boundStoneKey];

    return {
      success: true,
      message: `合成成功！孔位 ${ei.synthesis_slots.length}/${capacity}`,
      successRate,
    };
  },

  getSuccessRate(player, occupiedCount = 0) {
    const baseRate = this.SUCCESS_RATE[occupiedCount] ?? 0.05;
    const rawBonus = Number(player?.enhanceSuccessRate);
    const bonusRate = Number.isFinite(rawBonus) ? rawBonus : 0;
    return Math.max(0, Math.min(1, baseRate + bonusRate));
  },

  _getStoneCategory(stoneItemKey) {
    if (typeof stoneItemKey !== 'string') return null;
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
