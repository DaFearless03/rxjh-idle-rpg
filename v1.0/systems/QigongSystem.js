/**
 * @file systems/QigongSystem.js
 * @desc 气功系统：投点 / 重置 / 耳环加成 / 热血石加成
 * @ref 04_skills_qigong_buff 4.2 气功系统
 */
import { eventBus } from '../core/EventBus.js';

export const QigongSystem = {
  _qigongTemplates: [],

  /**
   * 注册气功模板（main.js 加载后调用）
   */
  setTemplates(qigongsData) {
    this._qigongTemplates = qigongsData;
  },

  /**
   * 计算玩家 transfer_count
   */
  _getTransferCount(player) {
    const career = player.career || '';
    const match = career.match(/_transfer_(\d+)st/);
    return match ? parseInt(match[1]) : 0;
  },

  /**
   * 计算玩家气功点上限（历史累计）
   */
  calcMaxPoints(player) {
    const initial = 1;
    let gained = 0;
    for (let lv = 2; lv <= player.level; lv++) {
      gained += lv < 35 ? 1 : 2;
    }
    return initial + gained;
  },

  /**
   * 获取玩家可用气功点（累计 - 已投）
   */
  getAvailablePoints(player) {
    this._ensureQigongState(player);
    return player.qigong.available_points;
  },

  /**
   * 获取玩家当前可学气功列表（过滤转职/等级）
   */
  listAvailableQigongs(player) {
    const transferCount = this._getTransferCount(player);
    const careerFamily = player.career_family;

    return this._qigongTemplates.filter(q => {
      // 职业系过滤
      const cf = Array.isArray(q.career_family) ? q.career_family : [q.career_family];
      if (!cf.includes(careerFamily)) return false;
      // 解锁条件
      if (transferCount < q.unlock.min_transfer) return false;
      if (player.level < q.unlock.min_level) return false;
      return true;
    }).map(q => {
      const invested = player.qigong?.invested?.[q.key] || 0;
      const effectiveLevel = this._calcEffectiveLevel(player, q);
      return {
        key: q.key,
        name: q.name,
        description: q.description,
        invested,
        effectiveLevel,
        max_level: q.max_level,
        effect_type: q.effect.type,
        currentValue: this._calcEffectValue(q, invested),
        nextValue: this._calcEffectValue(q, invested + 1)
      };
    });
  },

  /**
   * 投点
   * @param {Object} player
   * @param {string} qigongKey
   * @param {number} points
   * @returns {{ success: boolean, message: string }}
   */
  investQigong(player, qigongKey, points) {
    this._ensureQigongState(player);

    const qigong = this._qigongTemplates.find(q => q.key === qigongKey);
    if (!qigong) return { success: false, message: `气功 ${qigongKey} 不存在` };

    const current = player.qigong.invested[qigongKey] || 0;
    const available = this.getAvailablePoints(player);
    const canAdd = Math.min(points, available, qigong.max_level - current);
    if (canAdd <= 0) {
      return { success: false, message: `气功点不足或已达上限` };
    }

    player.qigong.invested[qigongKey] = current + canAdd;
    player.qigong.available_points -= canAdd;
    console.log(`[气功] 投入 ${canAdd} 点到 ${qigong.name}（共 ${player.qigong.invested[qigongKey]} 点）`);

    eventBus.emit('qigong.invested', { qigongKey, points: canAdd });
    return { success: true, message: `投入 ${canAdd} 点` };
  },

  /**
   * 重置气功
   * @param {Object} player
   * @returns {{ success: boolean, message: string }}
   */
  resetQigong(player) {
    this._ensureQigongState(player);
    const count = player.qigong?.attribute_reset_count || 0;
    const cost = Math.floor(10000 * Math.pow(10, count));

    if ((player.resources?.gold || 0) < cost) {
      return { success: false, message: `重置需要 ${cost} 金币` };
    }

    const refunded = Object.values(player.qigong?.invested || {}).reduce((s, v) => s + v, 0);
    player.resources.gold -= cost;
    player.qigong.invested = {};
    player.qigong.available_points += refunded;
    player.qigong.attribute_reset_count = (player.qigong.attribute_reset_count || 0) + 1;

    console.log(`[气功] 重置完成，返还 ${refunded} 点，花费 ${cost} 金币`);
    return { success: true, message: `重置成功，返还 ${refunded} 点` };
  },

  /**
   * 聚合气功加成到 player._hooks
   * 由 AttributeSystem.recompute 调用
   * @param {Object} player
   * @param {Object} h 钩子对象（会被修改）
   */
  collectQigongHooks(player, h) {
    const invested = player.qigong?.invested || {};

    for (const [key, points] of Object.entries(invested)) {
      if (points <= 0) continue;
      const qigong = this._qigongTemplates.find(q => q.key === key);
      if (!qigong) continue;

      const effectType = qigong.effect.type;
      const totalValue = this._calcEffectValue(qigong, points);

      // 百分比类 → xxxPct 钩子；数值类 → xxxAdd 钩子
      if (effectType.endsWith('Pct')) {
        h[effectType] = (h[effectType] || 0) + totalValue;
      } else {
        h[effectType + 'Add'] = (h[effectType + 'Add'] || 0) + totalValue;
      }
    }
  },

  /**
   * 计算耳环 qigong 加成（仅当 invested >= 1 时生效）
   * @param {Object} player
   * @param {Object} h 钩子对象
   */
  collectEarringBonus(player, h) {
    const earringSlots = player.equipped?.earring || [];
    for (const earringVal of earringSlots) {
      if (!earringVal?.instance_id) continue;
      const inst = player.inventory?.equipment_instances?.[earringVal.instance_id];
      if (!inst?.synthesis_slots) continue;

      for (const stoneKey of inst.synthesis_slots) {
        if (stoneKey.startsWith('hot_blood')) {
          // 热血石：找到对应气功 key 并加对应加成
          // hot_blood_skill_stack_rules：hot_blood_xxx → 对应气功 key
          const skillKey = stoneKey.replace('hot_blood_', '').replace(/_0\d$/, '');
          // 简化：直接用气功 key 匹配
          const invested = player.qigong?.invested?.[stoneKey.replace('hot_blood_', 'qigong_')] || 0;
          if (invested >= 1) {
            // 找对应气功
            const qigong = this._qigongTemplates.find(q => q.key === stoneKey.replace('hot_blood_', ''));
            if (qigong) {
              const bonus = Math.min(10, qigong.max_level) - invested; // 最多 +10
              if (bonus > 0) {
                const effectType = qigong.effect.type;
                if (effectType.endsWith('Pct')) {
                  h[effectType] = (h[effectType] || 0) + qigong.effect.value_per_level * bonus;
                } else {
                  h[effectType + 'Add'] = (h[effectType + 'Add'] || 0) + qigong.effect.value_per_level * bonus;
                }
              }
            }
          }
        }
      }
    }
  },

  // 计算气功当前效果值（base + invested * per_level）
  _calcEffectValue(qigong, points) {
    return qigong.effect.base_value + points * qigong.effect.value_per_level;
  },

  // 计算含耳环加成的有效气功等级
  _calcEffectiveLevel(player, qigong) {
    let level = player.qigong?.invested?.[qigong.key] || 0;
    // 耳环加成
    const earringSlots = player.equipped?.earring || [];
    for (const earringVal of earringSlots) {
      if (!earringVal?.instance_id) continue;
      const inst = player.inventory?.equipment_instances?.[earringVal.instance_id];
      if (!inst?.synthesis_slots) continue;
      for (const stoneKey of inst.synthesis_slots) {
        if (stoneKey.startsWith('hot_blood')) {
          // 简化：找对应气功是否有对应热血石
          if (stoneKey.includes(qigong.key)) {
            level += Math.min(10, qigong.max_level);
          }
        }
      }
    }
    return Math.min(level, qigong.max_level);
  },

  _ensureQigongState(player) {
    player.qigong = player.qigong || {};
    player.qigong.invested = player.qigong.invested || {};
    player.qigong.attribute_reset_count = player.qigong.attribute_reset_count || 0;

    if (typeof player.qigong.available_points !== 'number') {
      const invested = Object.values(player.qigong.invested).reduce((s, v) => s + v, 0);
      player.qigong.available_points = Math.max(0, this.calcMaxPoints(player) - invested);
    }
  }
};
