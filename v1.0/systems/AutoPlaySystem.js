/**
 * @file systems/AutoPlaySystem.js
 * @desc is_auto_play 状态机 + 12项清挂机规则 + auto_consume + auto_heal_skill + auto_resupply
 * @ref 10_consumables.auto_consume / auto_heal_skill / auto_resupply
 */
import { InventorySystem } from './InventorySystem.js';
import { eventBus } from '../core/EventBus.js';

export const AutoPlaySystem = {
  is_auto_play: false,
  _cooldowns: { hp_potion: 0, mp_potion: 0, heal_skill: 0 },

  /**
   * 进入挂机状态
   */
  start(player) {
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = true;
    this.is_auto_play = true;
    this._cooldowns = { hp_potion: 0, mp_potion: 0, heal_skill: 0 };
    eventBus.emit('autoplay.start', {});
  },

  /**
   * 停止挂机（4条退出规则统一出口）
   */
  stop(player, reason = 'manual') {
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = false;
    this.is_auto_play = false;
    eventBus.emit('autoplay.stop', { reason });
  },

  /**
   * 每 100ms tick 调用（由 BattleSystem.tick 驱动）
   * @param {Object} player
   * @param {number} deltaMs
   * @param {Function} teleportFn teleport(source, subZone) 传送函数引用
   */
  tick(player, deltaMs, teleportFn) {
    if (!this.is_auto_play) return;
    if (!player.auto_play?.is_auto_play) return;

    // 更新 cd
    this._cooldowns.hp_potion = Math.max(0, this._cooldowns.hp_potion - deltaMs);
    this._cooldowns.mp_potion = Math.max(0, this._cooldowns.mp_potion - deltaMs);
    this._cooldowns.heal_skill = Math.max(0, this._cooldowns.heal_skill - deltaMs);

    // auto_consume
    this._autoConsumeHP(player, deltaMs);
    this._autoConsumeMP(player, deltaMs);

    // auto_heal_skill
    this._autoHealSkill(player, deltaMs);

    // auto_resupply 检查（每 1000ms 一次）
    this._resupplyCheckTimer = (this._resupplyCheckTimer || 0) + deltaMs;
    if (this._resupplyCheckTimer >= 1000) {
      this._resupplyCheckTimer = 0;
      this._autoResupplyCheck(player, teleportFn);
    }
  },

  _autoConsumeHP(player, deltaMs) {
    const cfg = player.auto_play?.auto_consume?.hp_potion;
    if (!cfg?.enabled || !cfg?.selected_item_key) return;
    if (this._cooldowns.hp_potion > 0) return;
    if (player.hp / player.maxHp > cfg.threshold) return;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return;

    // 消耗药剂
    const consumed = InventorySystem.remove(player, cfg.selected_item_key, 1);
    if (!consumed) return;

    // 恢复量
    const baseRecovery = this._getPotionRecovery(cfg.selected_item_key);
    const healBonus = player.healBonus || 0;
    const recovered = Math.floor(baseRecovery * (1 + healBonus));
    player.hp = Math.min(player.maxHp, player.hp + recovered);

    this._cooldowns.hp_potion = 5000;
    eventBus.emit('autoplay.consume_hp', { item: cfg.selected_item_key, recovered });
  },

  _autoConsumeMP(player, deltaMs) {
    const cfg = player.auto_play?.auto_consume?.mp_potion;
    if (!cfg?.enabled || !cfg?.selected_item_key) return;
    if (this._cooldowns.mp_potion > 0) return;
    if (player.mp / player.maxMp > cfg.threshold) return;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return;

    const consumed = InventorySystem.remove(player, cfg.selected_item_key, 1);
    if (!consumed) return;

    const baseRecovery = this._getPotionRecovery(cfg.selected_item_key);
    const mpRecoveryBonus = player.mpRecoveryBonus || 0;
    const recovered = Math.floor(baseRecovery * (1 + mpRecoveryBonus));
    player.mp = Math.min(player.maxMp, player.mp + recovered);

    this._cooldowns.mp_potion = 5000;
    eventBus.emit('autoplay.consume_mp', { item: cfg.selected_item_key, recovered });
  },

  _autoHealSkill(player, deltaMs) {
    const cfg = player.auto_play?.auto_heal_skill;
    if (!cfg?.enabled || !cfg?.selected_skill_key) return;
    if (this._cooldowns.heal_skill > 0) return;

    const skill = this._findSkill(cfg.selected_skill_key, player);
    if (!skill) return;

    const mpCost = skill.cost?.mp || 0;
    if (player.mp < mpCost) return;

    // 施放武功（这里简化处理，实际应由武功系统执行）
    player.mp = Math.max(0, player.mp - mpCost);
    const healBonus = player.healBonus || 0;
    const healAmount = Math.floor((skill.power || 0) * (1 + healBonus));
    player.hp = Math.min(player.maxHp, player.hp + healAmount);

    this._cooldowns.heal_skill = skill.coolDown || 1000;
    eventBus.emit('autoplay.heal_skill', { skill: cfg.selected_skill_key, healAmount });
  },

  _autoResupplyCheck(player, teleportFn) {
    const rules = player.auto_play?.auto_resupply?.trigger_rules;
    if (!rules) return;

    let triggered = false;
    if (rules.hp?.enabled && rules.hp?.selected_potion) {
      if (InventorySystem.count(player, rules.hp.selected_potion) < rules.hp.trigger_threshold) {
        triggered = true;
      }
    }
    if (rules.mp?.enabled && rules.mp?.selected_potion) {
      if (InventorySystem.count(player, rules.mp.selected_potion) < rules.mp.trigger_threshold) {
        triggered = true;
      }
    }

    if (triggered && teleportFn) {
      // 保存当前位置
      if (player.location?.current_sub_zone_key) {
        player.location.last_wilderness_sub_zone = player.location.current_sub_zone_key;
      }
      teleportFn('auto_resupply', 'town_xuanbo');
    }
  },

  _getPotionRecovery(itemKey) {
    const recoveries = {
      'hp_potion_grade1': 70,
      'hp_potion_grade2': 160,
      'hp_potion_grade3': 300,
      'mp_potion_grade1': 70,
      'mp_potion_grade2': 160,
      'mp_potion_grade3': 320,
    };
    return recoveries[itemKey] || 50;
  },

  _findSkill(skillKey, player) {
    if (!player.learned_martial_arts?.includes(skillKey)) return null;
    return { key: skillKey, power: 100, coolDown: 1000, cost: { mp: 20 } };
  },

  /**
   * 停止时调用（切换 zone、死亡、金币不足时由外部调用）
   */
  notifyStop(player, reason) {
    this.stop(player, reason);
  }
};