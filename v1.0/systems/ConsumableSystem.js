/**
 * @file systems/ConsumableSystem.js
 * @desc 药剂系统：手动喝药 + 自动喝药共用恢复公式。
 * @ref 10_consumables.md
 */
import { InventorySystem } from './InventorySystem.js';
import { eventBus } from '../core/EventBus.js';

const POTION_TEMPLATES = {
  hp_potion_grade1: { key: 'hp_potion_grade1', name: '金创药（小）', type: 'hp', recovery: 70, grade_threshold: 1 },
  hp_potion_grade2: { key: 'hp_potion_grade2', name: '金创药（中）', type: 'hp', recovery: 160, grade_threshold: 36 },
  hp_potion_grade3: { key: 'hp_potion_grade3', name: '金创药（大）', type: 'hp', recovery: 300, grade_threshold: 61 },
  mp_potion_grade1: { key: 'mp_potion_grade1', name: '人参', type: 'mp', recovery: 70, grade_threshold: 1 },
  mp_potion_grade2: { key: 'mp_potion_grade2', name: '野山参', type: 'mp', recovery: 160, grade_threshold: 36 },
  mp_potion_grade3: { key: 'mp_potion_grade3', name: '雪原参', type: 'mp', recovery: 320, grade_threshold: 61 },
};

function clampCount(count) {
  return Math.max(1, Math.floor(Number(count) || 1));
}

export const ConsumableSystem = {
  getTemplate(itemKey) {
    return POTION_TEMPLATES[itemKey] || null;
  },

  canUse(player, itemKey) {
    const tpl = this.getTemplate(itemKey);
    if (!tpl) return false;
    return (player?.level || 1) >= tpl.grade_threshold;
  },

  use(player, itemKey, count = 1, options = {}) {
    const tpl = this.getTemplate(itemKey);
    const useCount = clampCount(count);
    if (!player || !tpl) {
      return { success: false, message: '该物品不能使用' };
    }
    if (!this.canUse(player, itemKey)) {
      return { success: false, message: `等级不足，Lv.${tpl.grade_threshold} 后可使用` };
    }
    if (InventorySystem.count(player, itemKey) < useCount) {
      return { success: false, message: '药剂数量不足' };
    }

    const maxField = tpl.type === 'hp' ? 'maxHp' : 'maxMp';
    const valueField = tpl.type === 'hp' ? 'hp' : 'mp';
    const bonusField = tpl.type === 'hp' ? 'healBonus' : 'mpRecoveryBonus';
    const current = Number(player[valueField] || 0);
    const maxValue = Number(player[maxField] || current);
    if (current >= maxValue) {
      return { success: false, message: tpl.type === 'hp' ? '生命已满' : '内功已满' };
    }

    const perUseRecovery = Math.floor(tpl.recovery * (1 + (player[bonusField] || 0)));
    const totalRecovery = perUseRecovery * useCount;
    const actualRecovered = Math.max(0, Math.min(maxValue - current, totalRecovery));
    const removed = InventorySystem.remove(player, itemKey, useCount);
    if (!removed) {
      return { success: false, message: '药剂扣除失败' };
    }

    player[valueField] = Math.min(maxValue, current + totalRecovery);
    const result = {
      success: true,
      item_key: itemKey,
      item_name: tpl.name,
      type: tpl.type,
      used: useCount,
      recovered: actualRecovered,
      recovery_per_item: perUseRecovery,
      remaining_hp_or_mp: player[valueField],
      message: `${tpl.name} ×${useCount}，恢复 ${actualRecovered} ${tpl.type.toUpperCase()}`,
    };

    if (options.emitEvent !== false) {
      eventBus.emit(tpl.type === 'hp' ? 'autoplay.consume_hp' : 'autoplay.consume_mp', {
        item: itemKey,
        item_key: itemKey,
        item_name: tpl.name,
        recovered: actualRecovered,
        count: useCount,
        source: options.source || 'manual',
      });
    }

    return result;
  },
};
