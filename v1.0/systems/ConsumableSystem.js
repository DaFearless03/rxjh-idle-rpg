/**
 * @file systems/ConsumableSystem.js
 * @desc 药剂系统：手动喝药 + 自动喝药共用恢复公式。
 * @ref 10_consumables.md
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

const POTION_TEMPLATES = {
  hp_potion_grade1: { key: 'hp_potion_grade1', name: '金创药（小）', type: 'hp', recovery: 70, min_level: 1, min_transfer: 0 },
  hp_potion_grade2: { key: 'hp_potion_grade2', name: '金创药（中）', type: 'hp', recovery: 160, min_level: 35, min_transfer: 2 },
  hp_potion_grade3: { key: 'hp_potion_grade3', name: '金创药（大）', type: 'hp', recovery: 300, min_level: 60, min_transfer: 3 },
  mp_potion_grade1: { key: 'mp_potion_grade1', name: '人参', type: 'mp', recovery: 70, grade_threshold: 1 },
  mp_potion_grade2: { key: 'mp_potion_grade2', name: '野山参', type: 'mp', recovery: 160, min_level: 35, min_transfer: 2 },
  mp_potion_grade3: { key: 'mp_potion_grade3', name: '雪原参', type: 'mp', recovery: 320, min_level: 60, min_transfer: 3 },
};

function normalizeCount(count) {
  const value = Number(count);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function getTransferCount(player) {
  return [player?.career, ...(Array.isArray(player?.career_history) ? player.career_history : [])]
    .reduce((maxTransfer, career) => {
      const match = String(career || '').match(/_transfer_(\d+)/);
      return Math.max(maxTransfer, match ? Number(match[1]) : 0);
    }, 0);
}

export const ConsumableSystem = {
  getTemplate(itemKey) {
    return POTION_TEMPLATES[itemKey] || null;
  },

  canUse(player, itemKey) {
    const tpl = this.getTemplate(itemKey);
    if (!tpl) return false;
    const minLevel = tpl.min_level ?? tpl.grade_threshold ?? 1;
    const minTransfer = tpl.min_transfer ?? 0;
    const level = Number(player?.level);
    return Number.isFinite(level) && level >= minLevel && getTransferCount(player) >= minTransfer;
  },

  use(player, itemKey, count = 1, options = {}) {
    const tpl = this.getTemplate(itemKey);
    const useCount = normalizeCount(count);
    if (!player || !tpl) {
      return { success: false, message: '该物品不能使用' };
    }
    if (!useCount) return { success: false, message: '使用数量无效' };
    if (!this.canUse(player, itemKey)) {
      const minLevel = tpl.min_level ?? tpl.grade_threshold ?? 1;
      const minTransfer = tpl.min_transfer ?? 0;
      const requirement = minTransfer > 0
        ? `需达到 Lv.${minLevel} 且完成 ${minTransfer} 转`
        : `需达到 Lv.${minLevel}`;
      return { success: false, message: `${requirement}后可使用` };
    }
    if (InventorySystem.count(player, itemKey) < useCount) {
      return { success: false, message: '药剂数量不足' };
    }

    const maxField = tpl.type === 'hp' ? 'maxHp' : 'maxMp';
    const valueField = tpl.type === 'hp' ? 'hp' : 'mp';
    const bonusField = tpl.type === 'hp' ? 'healBonus' : 'mpRecoveryBonus';
    const rawCurrent = Number(player[valueField]);
    const maxValue = Number(player[maxField]);
    if (!Number.isFinite(rawCurrent) || !Number.isFinite(maxValue) || maxValue <= 0) {
      return { success: false, message: '角色属性数据异常' };
    }
    const current = Math.max(0, Math.min(maxValue, rawCurrent));
    if (current >= maxValue) {
      return { success: false, message: tpl.type === 'hp' ? '生命已满' : '内功已满' };
    }

    const rawBonus = Number(player[bonusField]);
    const bonus = Number.isFinite(rawBonus) ? rawBonus : 0;
    const perUseRecovery = Math.max(0, Math.floor(tpl.recovery * (1 + bonus)));
    if (perUseRecovery <= 0) return { success: false, message: '当前恢复效果为 0，未消耗药剂' };
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
