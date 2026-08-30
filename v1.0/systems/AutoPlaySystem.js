/**
 * @file systems/AutoPlaySystem.js
 * @desc is_auto_play 状态机 + 12项清挂机规则 + auto_consume + auto_heal_skill + auto_resupply
 * @ref 10_consumables.auto_consume / auto_heal_skill / auto_resupply
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { ConsumableSystem } from './ConsumableSystem.js?v=release-20260830-3';
import { AutoSellSystem } from './AutoSellSystem.js?v=release-20260830-3';
import { AutoStoreSystem } from './AutoStoreSystem.js?v=release-20260830-3';
import { BuffSystem } from './BuffSystem.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { isMartialArtUsable } from '../utils/martial_arts.js?v=release-20260830-3';

function createCooldownState() {
  return { hp_potion: 0, mp_potion: 0, heal_skill: 0, buff_skill: 0 };
}

export const AutoPlaySystem = {
  is_auto_play: false,
  _activePlayer: null,
  _cooldowns: createCooldownState(),
  _resupplyCheckTimer: 0,
  _potionShopItems: [],
  _potionShopPriceMultiplier: 1,
  _martialArtsData: [],

  setPotionShopItems(items = [], priceMultiplier = 1) {
    this._potionShopItems = Array.isArray(items) ? items : [];
    const multiplier = Number(priceMultiplier);
    this._potionShopPriceMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
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
    if (!player || typeof player !== 'object') return false;
    this._ensurePlayerContext(player);
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = true;
    this.is_auto_play = true;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
    eventBus.emit('autoplay.start', {});
    return true;
  },

  /**
   * 停止挂机（4条退出规则统一出口）
   */
  stop(player, reason = 'manual') {
    if (!player || typeof player !== 'object') return false;
    this._ensurePlayerContext(player);
    player.auto_play = player.auto_play || {};
    player.auto_play.is_auto_play = false;
    this.is_auto_play = false;
    this._cooldowns = createCooldownState();
    this._resupplyCheckTimer = 0;
    eventBus.emit('autoplay.stop', { reason });
    return true;
  },

  /**
   * 每 100ms tick 调用（由 BattleSystem.tick 驱动）
   * @param {Object} player
   * @param {number} deltaMs
   * @param {Function} teleportFn teleport(source, subZone) 传送函数引用
   */
  tick(player, deltaMs, teleportFn) {
    if (!player || typeof player !== 'object') return;
    this._ensurePlayerContext(player);
    const elapsedMs = Number(deltaMs);
    deltaMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
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
    const hp = Number(player.hp);
    const maxHp = Number(player.maxHp);
    const threshold = Number(cfg.threshold);
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0
      || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) return false;
    if (hp / maxHp > threshold) return false;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return false;

    const result = ConsumableSystem.use(player, cfg.selected_item_key, 1, { source: 'auto' });
    if (!result.success) return false;

    const cooldown = Number(cfg.cooldown);
    this._cooldowns.hp_potion = Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 5000;
    return true;
  },

  _autoConsumeMP(player, deltaMs) {
    const cfg = player.auto_play?.auto_consume?.mp_potion;
    if (!cfg?.enabled || !cfg?.selected_item_key) return false;
    if (this._cooldowns.mp_potion > 0) return false;
    const mp = Number(player.mp);
    const maxMp = Number(player.maxMp);
    const threshold = Number(cfg.threshold);
    if (!Number.isFinite(mp) || !Number.isFinite(maxMp) || maxMp <= 0
      || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) return false;
    if (mp / maxMp > threshold) return false;
    if (InventorySystem.count(player, cfg.selected_item_key) <= 0) return false;

    const result = ConsumableSystem.use(player, cfg.selected_item_key, 1, { source: 'auto' });
    if (!result.success) return false;

    const cooldown = Number(cfg.cooldown);
    this._cooldowns.mp_potion = Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 5000;
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
    const activeBuff = player.buffs?.find(buff =>
      buff.key === buffKey && (buff.duration === -1 || buff.remaining > 0)
    );
    if (activeBuff) {
      const maxStacks = Number.isSafeInteger(activeBuff.max_stacks) && activeBuff.max_stacks >= 1
        ? Math.min(activeBuff.max_stacks, 100)
        : 1;
      const stacks = Number.isSafeInteger(activeBuff.stacks) && activeBuff.stacks >= 1
        ? activeBuff.stacks
        : 1;
      if (!activeBuff.stackable || stacks >= maxStacks) return;
    }
    this.castSupportSkill(player, cfg.selected_skill_key, { source: 'auto' });
  },

  castSupportSkill(player, skillKey, { source = 'manual' } = {}) {
    if (!player || typeof player !== 'object') return { success: false, message: '角色数据无效' };
    this._ensurePlayerContext(player);
    const skill = this._findSkill(skillKey, player);
    if (!skill || !['heal', 'buff'].includes(skill.type)) {
      return { success: false, message: '该辅助武功未学习或不存在' };
    }

    const cooldownKey = skill.type === 'heal' ? 'heal_skill' : 'buff_skill';
    if (this._cooldowns[cooldownKey] > 0) {
      return { success: false, message: '武功尚在冷却中' };
    }
    const hp = Number(player.hp);
    const maxHp = Number(player.maxHp);
    const mp = Number(player.mp);
    if (![hp, maxHp, mp].every(Number.isFinite) || maxHp <= 0 || hp < 0 || mp < 0) {
      return { success: false, message: '角色状态数据异常' };
    }
    if (skill.type === 'heal' && hp >= maxHp) {
      return { success: false, message: '生命值已满' };
    }

    const configuredMpCost = Number(skill.cost?.mp ?? 0);
    const rawMpCostReduce = Number(player.mpCostReduce);
    if (!Number.isFinite(configuredMpCost) || configuredMpCost < 0) return { success: false, message: '武功消耗配置无效' };
    const mpCostReduce = Number.isFinite(rawMpCostReduce) ? Math.max(0, Math.min(1, rawMpCostReduce)) : 0;
    const mpCost = Math.max(0, Math.floor(configuredMpCost * (1 - mpCostReduce)));
    if (mp < mpCost) return { success: false, message: `内功不足，需要 ${mpCost}` };

    let result;
    if (skill.type === 'heal') {
      const configuredHeal = Number(skill.effect?.value);
      const rawHealBonus = Number(player.healBonus);
      if (!Number.isFinite(configuredHeal) || configuredHeal <= 0) return { success: false, message: '治疗武功配置无效' };
      const healBonus = Number.isFinite(rawHealBonus) ? rawHealBonus : 0;
      const healAmount = Math.max(0, Math.floor(configuredHeal * (1 + healBonus)));
      if (healAmount <= 0) return { success: false, message: '当前治疗效果为 0' };
      const actualHeal = Math.min(healAmount, maxHp - hp);
      player.hp += actualHeal;
      result = { success: true, message: `${skill.name}恢复 ${actualHeal} 点生命`, healAmount: actualHeal };
      eventBus.emit('autoplay.heal_skill', { player, skill: skill.key, skillName: skill.name, healAmount: actualHeal, source });
    } else {
      const buffKey = skill.effect?.buff_key;
      const template = BuffSystem._buffTemplates[buffKey];
      if (!template) return { success: false, message: '增益配置不存在' };
      const templateDuration = Number(template.duration);
      const rawDurationBonus = Number(player.buffDuration);
      if (!Number.isFinite(templateDuration) || (templateDuration !== -1 && templateDuration <= 0)) {
        return { success: false, message: '增益持续时间配置无效' };
      }
      const durationBonus = Number.isFinite(rawDurationBonus) ? rawDurationBonus : 0;
      const duration = templateDuration === -1
        ? -1
        : Math.max(1, templateDuration + durationBonus);
      const applied = BuffSystem.applyBuff(player, buffKey, duration);
      if (!applied.success) return applied;
      result = { success: true, message: `${skill.name}施放成功`, buffKey };
      eventBus.emit('autoplay.buff_skill', { player, skill: skill.key, skillName: skill.name, buffKey, source });
    }

    player.mp = Math.max(0, mp - mpCost);
    const configuredCooldown = Number(skill.coolDown ?? 1000);
    this._cooldowns[cooldownKey] = Number.isFinite(configuredCooldown) && configuredCooldown > 0
      ? configuredCooldown
      : 1000;
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
    if (!previousSubZone) {
      player._stopped_reason = 'auto_return_zone_missing';
      this.stop(player, 'auto_return_zone_missing');
      return false;
    }
    if (previousSubZone) {
      player.location = player.location || {};
      player.location.last_wilderness_sub_zone = previousSubZone;
    }

    if (teleportFn) {
      if (teleportFn(source, null) === false) {
        this.stop(player, 'auto_return_to_town_failed');
        return false;
      }
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
      eventBus.emit('autoplay.resupply', purchaseSummary);
      if (this._willTriggerResupply(player)) {
        player._stopped_reason = 'auto_resupply_gold_insufficient';
        this.stop(player, 'auto_resupply_gold_insufficient');
        return true;
      }
    }

    const target = player.location?.last_wilderness_sub_zone;
    if (target && teleportFn) {
      if (teleportFn(source, target) === false) {
        player._stopped_reason = 'auto_return_zone_invalid';
        this.stop(player, 'auto_return_zone_invalid');
        return true;
      }
    } else if (target) {
      player.location.current_sub_zone_key = target;
      player.location.current_map_key = 'wilderness_xuanbo_suburb';
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
    const threshold = Number(rule.trigger_threshold);
    return Number.isSafeInteger(threshold) && threshold > 0
      && InventorySystem.count(player, rule.selected_potion) < threshold;
  },

  _autoBuyPotions(player) {
    const purchaseRules = player.auto_play?.auto_resupply?.purchase_rules;
    const summary = { bought: {}, gold_spent: 0 };
    const gold = Number(player.resources?.gold);
    if (!purchaseRules || !Number.isSafeInteger(gold) || gold < 0) return summary;

    const triggerRules = player.auto_play?.auto_resupply?.trigger_rules || {};
    for (const kind of ['hp', 'mp']) {
      const rule = purchaseRules[kind];
      if (!rule?.enabled || !rule?.selected_potion) continue;

      const current = InventorySystem.count(player, rule.selected_potion);
      const configuredTarget = Number(rule.target_quantity);
      if (!Number.isSafeInteger(configuredTarget) || configuredTarget <= 0) continue;
      const trigger = triggerRules[kind];
      const triggerThreshold = trigger?.enabled && trigger.selected_potion === rule.selected_potion
        ? Number(trigger.trigger_threshold)
        : 0;
      const targetQuantity = Number.isSafeInteger(triggerThreshold) && triggerThreshold > 0
        ? Math.max(configuredTarget, triggerThreshold)
        : configuredTarget;
      const need = targetQuantity - current;
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
    const price = Number(item?.buy_price);
    const adjustedPrice = Math.floor(price * this._potionShopPriceMultiplier);
    return Number.isSafeInteger(adjustedPrice) && adjustedPrice > 0 ? adjustedPrice : 0;
  },

  _findSkill(skillKey, player) {
    const skill = this._martialArtsData.find(item => item.key === skillKey) || null;
    return isMartialArtUsable(player, skill) ? skill : null;
  },

  /**
   * 停止时调用（切换 zone、死亡、金币不足时由外部调用）
   */
  notifyStop(player, reason) {
    this.stop(player, reason);
  }
};
