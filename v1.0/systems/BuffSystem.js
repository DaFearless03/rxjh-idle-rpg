/**
 * @file systems/BuffSystem.js
 * @desc Buff 系统：apply_buff / expire / DOT/HOT tick / attribute_mods 注入钩子
 * @ref 04_skills_qigong_buff Buff 系统
 */
import { createBuffInstance, isBuffExpired } from '../entities/Buff.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

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
    if (!player || typeof player !== 'object') {
      return { success: false, message: '角色数据无效' };
    }
    const template = this._buffTemplates[buffKey];
    if (!template) return { success: false, message: `Buff ${buffKey} 不存在` };

    const duration = durationOverride !== undefined ? Number(durationOverride) : Number(template.duration);
    if (!Number.isFinite(duration) || (duration !== -1 && duration <= 0)) {
      return { success: false, message: `Buff ${buffKey} 持续时间无效` };
    }

    const buffs = Array.isArray(player.buffs) ? player.buffs : [];
    player.buffs = buffs;

    const existing = buffs.find(buff => buff?.key === buffKey);
    if (existing) {
      existing.start_time = Date.now();
      existing.remaining = duration;
      existing.duration = duration;

      let stacked = false;
      if (template.stackable) {
        const configuredMax = Number(template.max_stacks);
        const maxStacks = Number.isSafeInteger(configuredMax) && configuredMax >= 1 && configuredMax <= 100
          ? configuredMax
          : 1;
        const currentStacks = Number.isSafeInteger(existing.stacks) && existing.stacks >= 1
          ? Math.min(existing.stacks, maxStacks)
          : 1;
        existing.max_stacks = maxStacks;
        existing.stackable = true;
        existing.stacks = Math.min(maxStacks, currentStacks + 1);
        stacked = existing.stacks > currentStacks;
      } else {
        existing.stackable = false;
        existing.max_stacks = 1;
        existing.stacks = 1;
      }

      const message = stacked ? `叠加 ${template.name} x${existing.stacks}` : `刷新 ${template.name}`;
      console.log(`[Buff] ${message}`);
      eventBus.emit('buff.applied', {
        player,
        buffKey,
        name: template.name,
        refreshed: true,
        stacked,
        stacks: existing.stacks,
      });
      return { success: true, message };
    }

    const instance = createBuffInstance(template, { durationOverride: duration });
    buffs.push(instance);
    console.log(`[Buff] 应用 ${template.name}`);
    eventBus.emit('buff.applied', { player, buffKey, name: template.name });
    return { success: true, message: `应用 ${template.name}` };
  },

  /**
   * 每 tick 更新（100ms）
   * @param {Object} player
   * @param {number} deltaMs
   */
  tick(player, deltaMs) {
    if (!player || typeof player !== 'object') return;
    const elapsedMs = Number(deltaMs);
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    const buffs = Array.isArray(player.buffs) ? player.buffs : [];
    if (buffs.length === 0) return;

    const expired = [];

    for (const buff of buffs) {
      if (buff.duration === -1) continue;

      buff.remaining -= elapsedMs;
      if (buff.remaining <= 0) {
        expired.push(buff);
      }

      // DOT/HOT tick
      if (buff.effect_type === 'dot' || buff.effect_type === 'hot') {
        buff.tick_remaining -= elapsedMs;
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
        eventBus.emit('buff.expired', { player, buffKey: buff.key });
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
    const buffs = Array.isArray(player?.buffs) ? player.buffs : [];

    for (const buff of buffs) {
      if (isBuffExpired(buff)) continue;
      if (buff.effect_type !== 'attribute') continue;

      const maxStacks = Number.isSafeInteger(buff.max_stacks) && buff.max_stacks >= 1
        ? Math.min(buff.max_stacks, 100)
        : 1;
      const stacks = buff.stackable && Number.isSafeInteger(buff.stacks) && buff.stacks >= 1
        ? Math.min(buff.stacks, maxStacks)
        : 1;
      const mods = buff.attribute_mods || {};
      for (const [key, value] of Object.entries(mods)) {
        const stackedValue = value * stacks;
        if (!Number.isFinite(stackedValue)) continue;
        if (key.endsWith('Add')) {
          h[key] = (h[key] || 0) + stackedValue;
        } else if (key.endsWith('Pct')) {
          h[key] = (h[key] || 0) + stackedValue;
        } else {
          // 其他类型（如 atkSelfPct）当 pct 处理
          if (!h[key]) h[key] = 0;
          h[key] += stackedValue;
        }
      }
    }
  },

  /**
   * 获取玩家当前所有 Buff
   */
  listBuffs(player) {
    return (player?.buffs || []).map(b => ({
      key: b.key,
      name: b.name,
      remaining: b.duration === -1 ? '永久' : `${Math.ceil(b.remaining / 1000)}秒`,
      stacks: b.stacks
    }));
  }
};
