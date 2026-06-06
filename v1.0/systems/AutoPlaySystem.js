/**
 * @file systems/AutoPlaySystem.js
 * @desc is_auto_play 状态机 + 12项清挂机规则 + auto_consume + auto_heal_skill + auto_resupply
 * @ref 10_consumables.auto_consume / auto_heal_skill / auto_resupply
 */
import { InventorySystem } from './InventorySystem.js';
import { ConsumableSystem } from './ConsumableSystem.js';
import { eventBus } from '../core/EventBus.js';

function createCooldownState() {
  return { hp_potion: 0, mp_potion: 0, heal_skill: 0 };
}

export const AutoPlaySystem = {
  is_auto_play: false,
  _activePlayer: null,
  _cooldowns: createCooldownState(),
  _resupplyCheckTimer: 0,
  _potionShopItems: [],

  setPotionShopItems(items = []) {
    this._potionShopItems = Array.isArray(items) ? items : [];
  },

  resetRuntimeState() {
    this.is_auto_play = false;
    this._activePlayer = null;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
  },

  syncFromPlayer(player) {
    this.resetRuntimeState();
    this._activePlayer = player || null;
    this.is_auto_play = !!player?.auto_play?.is_auto_play;
  },

  _ensurePlayerContext(player) {
    if (this._activePlayer === player) return;

    this._activePlayer = player || null;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
    this.is_auto_play = !!player?.auto_play?.is_auto_play;
  },

  /**
   * 进入挂机状态
   */
  start(player) {
    this._ensurePlayerContext(player);
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = true;
    this.is_auto_play = true;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
    eventBus.emit('autoplay.start', {});
  },

  /**
   * 停止挂机（4条退出规则统一出口）
   */
  stop(player, reason = 'manual') {
    this._ensurePlayerContext(player);
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = false;
    this.is_auto_play = false;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
    eventBus.emit('autoplay.stop', { reason });
  },

  /**
   * 每 100ms tick 调用（由 BattleSystem.tick 驱动）
   * @param {Object} player
   * @param {number} deltaMs
   * @param {Function} teleportFn teleport(source, subZone) 传送函数引用
   */
  tick(player, deltaMs, teleportFn) {
    this._ensurePlayerContext(player);
    if (!player.auto_play?.is_auto_play) {
      this.is_auto_play = false;
      return;
    }
    this.is_auto_play = true;

    // 更新 cd
    this._cooldowns.hp_potion = Math.max(0, this._cooldowns.hp_potion - deltaMs);
    this._cooldowns.mp_potion = Math.max(0, this._cooldowns.mp_potion - deltaMs);
    this._cooldowns.heal_skill = Math.max(0, this._cooldowns.heal_skill - deltaMs);

    // auto_consume
    const consumedHp = this._autoConsumeHP(player, deltaMs);
    const consumedMp = this._autoConsumeMP(player, deltaMs);
    if (consumedHp || consumedMp) {
      this._autoResupplyCheck(player, teleportFn);
      if (!player.auto_play?.is_auto_play) return;
    }

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
    if (!cfg?.enabled || !cfg?.selected_item_key) return false;
    if (this._cooldowns.hp_potion > 0) return false;
    if (player.hp / player.maxHp > cfg.threshold) return false;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return false;

    const result = ConsumableSystem.use(player, cfg.selected_item_key, 1, { source: 'auto' });
    if (!result.success) return false;

    this._cooldowns.hp_potion = cfg.cooldown ?? 5000;
    return true;
  },

  _autoConsumeMP(player, deltaMs) {
    const cfg = player.auto_play?.auto_consume?.mp_potion;
    if (!cfg?.enabled || !cfg?.selected_item_key) return false;
    if (this._cooldowns.mp_potion > 0) return false;
    if (player.mp / player.maxMp > cfg.threshold) return false;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return false;

    const result = ConsumableSystem.use(player, cfg.selected_item_key, 1, { source: 'auto' });
    if (!result.success) return false;

    this._cooldowns.mp_potion = cfg.cooldown ?? 5000;
    return true;
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
    const healAmount = Math.floor((skill.effect?.value || skill.power || 0) * (1 + healBonus));
    player.hp = Math.min(player.maxHp, player.hp + healAmount);

    this._cooldowns.heal_skill = skill.coolDown || 1000;
    eventBus.emit('autoplay.heal_skill', { skill: cfg.selected_skill_key, healAmount });
  },

  _autoResupplyCheck(player, teleportFn) {
    if (!this._willTriggerResupply(player)) return false;

    const previousSubZone = player.location?.current_sub_zone_key || player.location?.last_wilderness_sub_zone || null;
    if (previousSubZone) {
      player.location = player.location || {};
      player.location.last_wilderness_sub_zone = previousSubZone;
    }

    if (teleportFn) {
      teleportFn('auto_resupply', null);
    } else {
      player.location = player.location || {};
      player.location.current_sub_zone_key = null;
      player.location.current_map_key = 'town_xuanbo';
    }

    // Town full restore.
    player.hp = player.maxHp;
    player.mp = player.maxMp;

    const purchaseSummary = this._autoBuyPotions(player);
    if (this._willTriggerResupply(player)) {
      player._stopped_reason = 'auto_resupply_gold_insufficient';
      this.stop(player, 'auto_resupply_gold_insufficient');
      return true;
    }

    const target = player.location?.last_wilderness_sub_zone;
    if (target && teleportFn) {
      teleportFn('auto_resupply', target);
    } else if (target) {
      player.location.current_sub_zone_key = target;
      player.location.current_map_key = 'wilderness_xuanbo_suburb';
    }

    eventBus.emit('autoplay.resupply', purchaseSummary);
    return true;
  },

  _willTriggerResupply(player) {
    const rules = player.auto_play?.auto_resupply?.trigger_rules;
    if (!rules) return false;

    return this._isResupplyRuleTriggered(player, rules.hp)
      || this._isResupplyRuleTriggered(player, rules.mp);
  },

  _isResupplyRuleTriggered(player, rule) {
    if (!rule?.enabled || !rule?.selected_potion) return false;
    return InventorySystem.count(player, rule.selected_potion) < (rule.trigger_threshold ?? 0);
  },

  _autoBuyPotions(player) {
    const purchaseRules = player.auto_play?.auto_resupply?.purchase_rules;
    const summary = { bought: {}, gold_spent: 0 };
    if (!purchaseRules) return summary;

    for (const rule of [purchaseRules.hp, purchaseRules.mp]) {
      if (!rule?.enabled || !rule?.selected_potion) continue;

      const current = InventorySystem.count(player, rule.selected_potion);
      const need = (rule.target_quantity ?? 0) - current;
      if (need <= 0) continue;

      const unitPrice = this._getPotionBuyPrice(rule.selected_potion);
      if (unitPrice <= 0) continue;

      const affordable = Math.min(need, Math.floor((player.resources?.gold || 0) / unitPrice));
      if (affordable <= 0) continue;

      const result = InventorySystem.add(player, rule.selected_potion, affordable);
      const bought = result.added ?? (result.success ? affordable : 0);
      if (bought <= 0) continue;

      const spent = bought * unitPrice;
      player.resources.gold -= spent;
      summary.bought[rule.selected_potion] = (summary.bought[rule.selected_potion] || 0) + bought;
      summary.gold_spent += spent;
    }

    return summary;
  },

  _getPotionBuyPrice(itemKey) {
    const item = this._potionShopItems.find(entry => entry.item_key === itemKey);
    return item?.buy_price || 0;
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
