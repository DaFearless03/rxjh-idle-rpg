/**
 * @file systems/BuffSystem.js
 * @desc Buff 系统：apply_buff / expire / DOT/HOT tick / attribute_mods 注入钩子
 * @ref 04_skills_qigong_buff Buff 系统
 */
import { createBuffInstance, isBuffExpired } from '../entities/Buff.js';
import { eventBus } from '../core/EventBus.js';

export const BuffSystem = {
  _buffTemplates: {},

  /**
   * 注册 Buff 模板（main.js 加载后调用）
   */
  setTemplates(buffsData) {
    this._buffTemplates = {};
    for (const b of buffsData) {
      this._buffTemplates[b.key] = b;
    }
  },

  /**
   * 给玩家应用 Buff
   * @param {Object} player
   * @param {string} buffKey
   * @param {number} durationOverride 覆盖 duration（用于气功 buffDuration 延长）
   * @returns {{ success: boolean, message: string }}
   */
  applyBuff(player, buffKey, durationOverride) {
    const template = this._buffTemplates[buffKey];
    if (!template) return { success: false, message: `Buff ${buffKey} 不存在` };

    const buffs = player.buffs || [];
    player.buffs = buffs;

    // 不可叠加且已有同 key → 刷新时间
    if (!template.stackable) {
      const existing = buffs.find(b => b.key === buffKey);
      if (existing) {
        existing.start_time = Date.now();
        existing.remaining = durationOverride !== undefined ? durationOverride : template.duration;
        existing.duration = existing.remaining;
        console.log(`[Buff] 刷新 ${template.name}`);
        return { success: true, message: `刷新 ${template.name}` };
      }
    }

    const instance = createBuffInstance(template, { durationOverride });
    buffs.push(instance);
    console.log(`[Buff] 应用 ${template.name}`);
    eventBus.emit('buff.applied', { buffKey, name: template.name });
    return { success: true, message: `应用 ${template.name}` };
  },

  /**
   * 每 tick 更新（100ms）
   * @param {Object} player
   * @param {number} deltaMs
   */
  tick(player, deltaMs) {
    const buffs = player.buffs || [];
    if (buffs.length === 0) return;

    const expired = [];

    for (const buff of buffs) {
      if (buff.duration === -1) continue;

      buff.remaining -= deltaMs;
      if (buff.remaining <= 0) {
        expired.push(buff);
      }

      // DOT/HOT tick
      if (buff.effect_type === 'dot' || buff.effect_type === 'hot') {
        buff.tick_remaining -= deltaMs;
        if (buff.tick_remaining <= 0) {
          buff.tick_remaining = buff.tick_interval;
          // DOT: 扣玩家血
          if (buff.effect_type === 'dot') {
            player.hp = Math.max(0, player.hp - buff.tick_value);
            console.log(`[Buff] ${buff.name} 造成 ${buff.tick_value} 伤害`);
          }
          // HOT: 回玩家血
          if (buff.effect_type === 'hot') {
            const maxHp = player.maxHp || 1;
            player.hp = Math.min(maxHp, player.hp + buff.tick_value);
            console.log(`[Buff] ${buff.name} 恢复 ${buff.tick_value} HP`);
          }
        }
      }
    }

    // 移除过期 buff
    if (expired.length > 0) {
      for (const buff of expired) {
        player.buffs = player.buffs.filter(b => b !== buff);
        console.log(`[Buff] ${buff.name} 已结束`);
        eventBus.emit('buff.expired', { buffKey: buff.key });
      }
    }
  },

  /**
   * 聚合所有生效 Buff 的 attribute_mods 到 player._hooks
   * 由 AttributeSystem.recompute 调用
   * @param {Object} player
   * @param {Object} h 钩子对象（会被修改）
   */
  collectBuffHooks(player, h) {
    const buffs = player.buffs || [];
    const now = Date.now();

    for (const buff of buffs) {
      if (isBuffExpired(buff)) continue;
      if (buff.effect_type !== 'attribute') continue;

      const mods = buff.attribute_mods || {};
      for (const [key, value] of Object.entries(mods)) {
        if (key.endsWith('Add')) {
          h[key] = (h[key] || 0) + value;
        } else if (key.endsWith('Pct')) {
          h[key] = (h[key] || 0) + value;
        } else {
          // 其他类型（如 atkSelfPct）当 pct 处理
          if (!h[key]) h[key] = 0;
          h[key] += value;
        }
      }
    }
  },

  /**
   * 获取玩家当前所有 Buff
   */
  listBuffs(player) {
    return (player.buffs || []).map(b => ({
      key: b.key,
      name: b.name,
      remaining: b.duration === -1 ? '永久' : `${Math.ceil(b.remaining / 1000)}秒`,
      stacks: b.stacks
    }));
  }
};