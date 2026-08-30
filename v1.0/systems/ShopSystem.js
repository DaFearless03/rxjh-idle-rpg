/**
 * @file systems/ShopSystem.js
 * @desc 商店买卖：价格倍率 / forbidden 检查
 * @ref 08_maps_npc_quests shop npc
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { createEquipmentInstance } from '../entities/EquipmentInstance.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { canCreditSafeInteger } from '../utils/numbers.js?v=release-20260830-3';

function getEmptySlotCount(player) {
  const slots = player.inventory?.slots || [];
  const rawCapacity = Number(player.inventory?.capacity);
  const capacity = Number.isSafeInteger(rawCapacity) && rawCapacity >= 0 ? rawCapacity : 50;
  return slots.filter(slot => !slot?.item_key || (slot.count || 0) <= 0).length
    + Math.max(0, capacity - slots.length);
}

function getStackableSpace(player, itemKey) {
  const slots = player.inventory?.slots || [];
  const maxStack = InventorySystem._getMaxStack(itemKey, player);
  const existingRoom = slots.reduce((sum, slot) => {
    if (slot?.item_key !== itemKey || slot.instance_id) return sum;
    return sum + Math.max(0, maxStack - (slot.count || 0));
  }, 0);
  return existingRoom + getEmptySlotCount(player) * maxStack;
}

function logShop(message) {
  if (globalThis.__rxjhOfflineSimulation) return;
  console.log(message);
}

function isShopNpc(npcData) {
  return !!npcData && ['shop', 'shop_and_enhance'].includes(npcData.type);
}

function normalizePositiveCount(count) {
  const value = Number(count);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function ensurePlayerResources(player) {
  if (!player || typeof player !== 'object') return false;
  if (!player.resources || typeof player.resources !== 'object') player.resources = {};
  const gold = Number(player.resources.gold);
  if (!Number.isSafeInteger(gold) || gold < 0) return false;
  player.resources.gold = gold;
  return true;
}

function canApplySaleCredit(player, amount) {
  player.statistics = player.statistics && typeof player.statistics === 'object'
    ? player.statistics
    : {};
  const earned = player.statistics.total_gold_earned ?? 0;
  return canCreditSafeInteger(player.resources.gold, amount)
    && canCreditSafeInteger(earned, amount);
}

function isEquipped(player, instanceId) {
  return Object.values(player?.equipped || {}).some(value => {
    const entries = Array.isArray(value) ? value : [value];
    return entries.some(entry => (typeof entry === 'string' ? entry : entry?.instance_id) === instanceId);
  });
}

export const ShopSystem = {
  FORBIDDEN_SELL_TYPES: ['quest_items', 'boxes'],

  canRecordSale(player, amount) {
    return ensurePlayerResources(player)
      && Number.isSafeInteger(amount)
      && amount >= 0
      && canApplySaleCredit(player, amount);
  },

  getSellPrice(itemKey, npcData = null) {
    const baseKey = String(itemKey || '').split('--')[0];
    const itemEntry = (npcData?.items || []).find(i => i.item_key === baseKey);
    const fixedPrices = {
      hp_potion_grade1: 1, mp_potion_grade1: 1,
      hp_potion_grade2: 5, mp_potion_grade2: 5,
      hp_potion_grade3: 12, mp_potion_grade3: 12,
      enhance_stone_01: 15, cold_jade_01: 20, vajra_01: 20, hot_blood_01: 25,
      enhance_stone_02: 15, cold_jade_02: 20, vajra_02: 20, hot_blood_02: 25,
    };
    const configuredPrice = Number(itemEntry?.buy_price);
    return fixedPrices[baseKey] ?? (Number.isFinite(configuredPrice) && configuredPrice > 0
      ? Math.max(1, Math.floor(configuredPrice * 0.5))
      : 1);
  },

  getEquipmentSellPrice(player, itemKey) {
    const template = player?._equipTemplates?.find(item => item.key === itemKey);
    if (!template) return 1;
    const rawLevel = Number(template.required_level);
    const level = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.floor(rawLevel) : 1;
    if (template.slot === 'weapon') return level < 35 ? level * 100 : level * 1000;
    if (template.slot === 'gloves') return level * 20;
    if (['chest', 'boots', 'inner_armor', 'cape'].includes(template.slot)) return level * 500;
    return 1;
  },

  /**
   * 向 NPC 购买物品
   * @param {Object} player
   * @param {Object} npcData npc.json 中的 NPC 对象
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, message: string }}
   */
  buy(player, npcData, itemKey, count = 1) {
    if (!isShopNpc(npcData)) {
      return { success: false, message: '该 NPC 不提供商店服务' };
    }
    if (!ensurePlayerResources(player)) return { success: false, message: '玩家金币数据异常' };

    const itemEntry = (npcData.items || []).find(i => i.item_key === itemKey);
    if (!itemEntry) {
      return { success: false, message: `该物品不在商店中` };
    }

    count = normalizePositiveCount(count);
    if (!count) return { success: false, message: '购买数量无效' };
    const unitPrice = Number(itemEntry.buy_price);
    const rawMultiplier = npcData.price_multiplier == null ? 1 : Number(npcData.price_multiplier);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(rawMultiplier) || rawMultiplier <= 0) {
      return { success: false, message: '商店价格配置异常' };
    }
    const price = Math.max(1, Math.floor(unitPrice * rawMultiplier)) * count;
    if (!Number.isSafeInteger(price)) return { success: false, message: '购买金额超出限制' };
    if ((player.resources?.gold || 0) < price) {
      return { success: false, message: `金币不足，需要 ${price} 金币` };
    }

    const slotsBefore = structuredClone(player.inventory?.slots || []);
    const instancesBefore = structuredClone(player.inventory?.equipment_instances || {});
    const itemClass = InventorySystem._getItemClass(itemKey, player);
    let success = true;

    if (itemClass === 'equipment') {
      const template = player._equipTemplates?.find(item => item.key === itemKey);
      if (!template) return { success: false, message: '装备模板不存在，购买失败' };
      if (getEmptySlotCount(player) < count) {
        return { success: false, message: '背包空格不足，购买失败' };
      }
      for (let index = 0; index < count; index += 1) {
        if (!InventorySystem.addEquipmentInstance(player, createEquipmentInstance(template)).success) {
          success = false;
          break;
        }
      }
    } else {
      if (getStackableSpace(player, itemKey) < count) {
        return { success: false, message: '背包空格不足，购买失败' };
      }
      success = InventorySystem.add(player, itemKey, count).success;
    }

    if (!success) {
      player.inventory.slots = slotsBefore;
      player.inventory.equipment_instances = instancesBefore;
      return { success: false, message: '背包已满，购买失败' };
    }

    player.resources.gold -= price;
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: price, action: 'remove' });
    logShop(`[商店] 购买 ${itemEntry.name || itemKey} x${count}，花费 ${price} 金币`);
    return { success: true, message: `购买成功` };
  },

  /**
   * 向 NPC 出售物品
   * @param {Object} player
   * @param {Object} npcData
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, message: string }}
   */
  sell(player, npcData, itemKey, count = 1) {
    if (!isShopNpc(npcData)) {
      return { success: false, message: '该 NPC 不提供商店服务' };
    }
    if (!ensurePlayerResources(player)) return { success: false, message: '玩家金币数据异常' };

    count = normalizePositiveCount(count);
    if (!count) return { success: false, message: '出售数量无效' };

    // 检查物品类
    const itemClass = InventorySystem._getItemClass(itemKey, player);
    if (this.FORBIDDEN_SELL_TYPES.includes(itemClass)) {
      return { success: false, message: '该物品不可出售' };
    }
    if (itemClass === 'equipment') {
      return { success: false, message: '请选择具体装备出售' };
    }

    const have = InventorySystem.count(player, itemKey);
    if (have < count) {
      return { success: false, message: `物品不足，需要 ${count} 个` };
    }

    // 找商店物品条目（算 sell_price）
    const sellPrice = this.getSellPrice(itemKey, npcData);
    const totalPrice = sellPrice * count;
    if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
      return { success: false, message: '出售金额超出限制' };
    }
    if (!canApplySaleCredit(player, totalPrice)) {
      return { success: false, message: '金币已达上限，无法出售' };
    }

    if (!InventorySystem.remove(player, itemKey, count)) {
      return { success: false, message: '物品移除失败' };
    }
    player.resources.gold += totalPrice;
    player.statistics = player.statistics || {};
    player.statistics.total_gold_earned = (player.statistics.total_gold_earned || 0) + totalPrice;
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: totalPrice, action: 'add' });
    logShop(`[商店] 出售 ${itemKey} x${count}，获得 ${totalPrice} 金币`);
    return { success: true, message: `出售成功，获得 ${totalPrice} 金币` };
  },

  sellEquipmentInstance(player, instanceId) {
    if (!ensurePlayerResources(player)) return { success: false, message: '玩家金币数据异常' };
    const slot = player.inventory?.slots?.find(entry => entry.instance_id === instanceId && entry.item_key);
    const instance = player.inventory?.equipment_instances?.[instanceId];
    if (!slot || !instance || slot.item_key !== instance.item_key || isEquipped(player, instanceId)) {
      return { success: false, message: '装备必须先卸下并放入背包' };
    }
    const itemClass = InventorySystem._getItemClass(instance.item_key, player);
    if (this.FORBIDDEN_SELL_TYPES.includes(itemClass)) return { success: false, message: '该物品不可出售' };
    const earnedGold = this.getEquipmentSellPrice(player, instance.item_key);
    if (!Number.isSafeInteger(earnedGold) || earnedGold < 0 || !canApplySaleCredit(player, earnedGold)) {
      return { success: false, message: '金币已达上限，无法出售' };
    }
    slot.item_key = null;
    slot.instance_id = null;
    slot.count = 0;
    delete player.inventory.equipment_instances[instanceId];
    player.resources.gold += earnedGold;
    player.statistics.total_gold_earned = (player.statistics.total_gold_earned || 0) + earnedGold;
    eventBus.emit('inventory.changed', { player, item_key: instance.item_key, action: 'remove', changed_count: 1, count: 0 });
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: earnedGold, action: 'add' });
    return { success: true, message: `出售成功，获得 ${earnedGold} 金币` };
  }
};
