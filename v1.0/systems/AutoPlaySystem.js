/**
 * @file systems/AutoPlaySystem.js
 * @desc is_auto_play 状态机 + 12项清挂机规则 + auto_consume + auto_heal_skill + auto_resupply
 * @ref 10_consumables.auto_consume / auto_heal_skill / auto_resupply
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-1';
import { ConsumableSystem } from './ConsumableSystem.js?v=release-20260830-1';
import { AutoSellSystem } from './AutoSellSystem.js?v=release-20260830-1';
import { AutoStoreSystem } from './AutoStoreSystem.js?v=release-20260830-1';
import { BuffSystem } from './BuffSystem.js?v=release-20260830-1';
import { eventBus } from '../core/EventBus.js?v=release-20260830-1';

function createCooldownState() {
  return { hp_potion: 0, mp_potion: 0, heal_skill: 0, buff_skill: 0 };
}

export const AutoPlaySystem = {
  is_auto_play: false,
  _activePlayer: null,
  _cooldowns: createCooldownState(),
  _resupplyCheckTimer: 0,
  _potionShopItems: [],
  _martialArtsData: [],

  setPotionShopItems(items = []) {
    this._potionShopItems = Array.isArray(items) ? items : [];
  },

  setMartialArtsData(items = []) {
    this._martialArtsData = Array.isArray(items) ? items : [];
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
    this._cooldowns.hp_potion = Math.max(0, this._cooldowns.hp_potion - deltaMs);
    this._cooldowns.mp_potion = Math.max(0, this._cooldowns.mp_potion - deltaMs);
    this._cooldowns.heal_skill = Math.max(0, this._cooldowns.heal_skill - deltaMs);
    this._cooldowns.buff_skill = Math.max(0, this._cooldowns.buff_skill - deltaMs);

    if (!player.auto_play?.is_auto_play) {
      this.is_auto_play = false;
      return;
    }
    this.is_auto_play = true;

    // auto_consume
    const consumedHp = this._autoConsumeHP(player, deltaMs);
    const consumedMp = this._autoConsumeMP(player, deltaMs);
    if (consumedHp || consumedMp) {
      this._autoResupplyCheck(player, teleportFn);
      if (!player.auto_play?.is_auto_play) return;
    }

    // auto_heal_skill
    this._autoHealSkill(player);
    this._autoBuffSkill(player);

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

  _autoHealSkill(player) {
    const cfg = player.auto_play?.auto_heal_skill;
    if (!cfg?.enabled || !cfg?.selected_skill_key) return;
    if (player.hp / Math.max(1, player.maxHp) > (cfg.threshold ?? 0.5)) return;
    this.castSupportSkill(player, cfg.selected_skill_key, { source: 'auto' });
  },

  _autoBuffSkill(player) {
    const cfg = player.auto_play?.auto_buff_skill;
    if (!cfg?.enabled || !cfg?.selected_skill_key) return;
    const skill = this._findSkill(cfg.selected_skill_key, player);
    const buffKey = skill?.effect?.buff_key;
    if (!skill || skill.type !== 'buff' || !buffKey) return;
    if (player.buffs?.some(buff => buff.key === buffKey && (buff.duration === -1 || buff.remaining > 0))) return;
    this.castSupportSkill(player, cfg.selected_skill_key, { source: 'auto' });
  },

  castSupportSkill(player, skillKey, { source = 'manual' } = {}) {
    this._ensurePlayerContext(player);
    const skill = this._findSkill(skillKey, player);
    if (!skill || !['heal', 'buff'].includes(skill.type)) {
      return { success: false, message: '该辅助武功未学习或不存在' };
    }

    const cooldownKey = skill.type === 'heal' ? 'heal_skill' : 'buff_skill';
    if (this._cooldowns[cooldownKey] > 0) {
      return { success: false, message: '武功尚在冷却中' };
    }
    if (skill.type === 'heal' && player.hp >= player.maxHp) {
      return { success: false, message: '生命值已满' };
    }

    const mpCost = Math.max(0, Math.floor((skill.cost?.mp || 0) * (1 - (player.mpCostReduce || 0))));
    if (player.mp < mpCost) return { success: false, message: `内功不足，需要 ${mpCost}` };

    let result;
    if (skill.type === 'heal') {
      const healAmount = Math.max(0, Math.floor((skill.effect?.value || 0) * (1 + (player.healBonus || 0))));
      const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
      player.hp += actualHeal;
      result = { success: true, message: `${skill.name}恢复 ${actualHeal} 点生命`, healAmount: actualHeal };
      eventBus.emit('autoplay.heal_skill', { player, skill: skill.key, skillName: skill.name, healAmount: actualHeal, source });
    } else {
      const buffKey = skill.effect?.buff_key;
      const template = BuffSystem._buffTemplates[buffKey];
      if (!template) return { success: false, message: '增益配置不存在' };
      const duration = template.duration === -1
        ? -1
        : Math.max(0, template.duration + (player.buffDuration || 0));
      const applied = BuffSystem.applyBuff(player, buffKey, duration);
      if (!applied.success) return applied;
      result = { success: true, message: `${skill.name}施放成功`, buffKey };
      eventBus.emit('autoplay.buff_skill', { player, skill: skill.key, skillName: skill.name, buffKey, source });
    }

    player.mp = Math.max(0, player.mp - mpCost);
    this._cooldowns[cooldownKey] = skill.coolDown || 1000;
    eventBus.emit('battle.player_status_changed', { player, reason: `${skill.type}_skill_cast` });
    return result;
  },

  _autoResupplyCheck(player, teleportFn) {
    const shouldResupply = this._willTriggerResupply(player);
    const shouldAutoStore = this._shouldReturnForAutoStore(player);
    const shouldAutoSell = this._shouldReturnForAutoSell(player);
    if (!shouldResupply && !shouldAutoStore && !shouldAutoSell) return false;
    const source = shouldResupply ? 'auto_resupply' : shouldAutoStore ? 'auto_store' : 'auto_sell';

    const previousSubZone = player.location?.current_sub_zone_key || player.location?.last_wilderness_sub_zone || null;
    if (previousSubZone) {
      player.location = player.location || {};
      player.location.last_wilderness_sub_zone = previousSubZone;
    }

    if (teleportFn) {
      teleportFn(source, null);
    } else {
      player.location = player.location || {};
      player.location.current_sub_zone_key = null;
      player.location.current_map_key = 'town_xuanbo';
    }

    // Town full restore.
    player.hp = player.maxHp;
    player.mp = player.maxMp;

    let purchaseSummary = { bought: {}, gold_spent: 0 };
    if (shouldResupply) {
      purchaseSummary = this._autoBuyPotions(player);
      if (this._willTriggerResupply(player)) {
        player._stopped_reason = 'auto_resupply_gold_insufficient';
        this.stop(player, 'auto_resupply_gold_insufficient');
        return true;
      }
    }

    const target = player.location?.last_wilderness_sub_zone;
    if (target && teleportFn) {
      teleportFn(source, target);
    } else if (target) {
      player.location.current_sub_zone_key = target;
      player.location.current_map_key = 'wilderness_xuanbo_suburb';
    }

    if (shouldResupply) {
      eventBus.emit('autoplay.resupply', purchaseSummary);
    }
    return true;
  },

  _shouldReturnForAutoSell(player) {
    if (!player.auto_play?.auto_sell?.enabled) return false;
    const slots = player.inventory?.slots || [];
    const capacity = player.inventory?.capacity || 50;
    const used = slots.filter(slot => slot?.item_key && (slot.count || 0) > 0).length;
    return used >= capacity && AutoSellSystem.hasSellableConfiguredItems(player);
  },

  _shouldReturnForAutoStore(player) {
    if (!player.auto_play?.auto_store?.enabled) return false;
    const slots = player.inventory?.slots || [];
    const capacity = player.inventory?.capacity || 50;
    const used = slots.filter(slot => slot?.item_key && (slot.count || 0) > 0).length;
    return used >= capacity && AutoStoreSystem.hasStorableConfiguredItems(player);
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
      eventBus.emit('resources.changed', { player, resource: 'gold', amount: spent, action: 'remove' });
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
    return this._martialArtsData.find(skill => skill.key === skillKey) || null;
  },

  /**
   * 停止时调用（切换 zone、死亡、金币不足时由外部调用）
   */
  notifyStop(player, reason) {
    this.stop(player, reason);
  }
};
