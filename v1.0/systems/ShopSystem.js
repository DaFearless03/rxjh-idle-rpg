/**
 * @file systems/ShopSystem.js
 * @desc 商店买卖：价格倍率 / forbidden 检查
 * @ref 08_maps_npc_quests shop npc
 */
import { InventorySystem } from './InventorySystem.js';
import { createEquipmentInstance } from '../entities/EquipmentInstance.js';

export const ShopSystem = {
  FORBIDDEN_SELL_TYPES: ['quest_items', 'boxes'],

  /**
   * 向 NPC 购买物品
   * @param {Object} player
   * @param {Object} npcData npc.json 中的 NPC 对象
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, message: string }}
   */
  buy(player, npcData, itemKey, count = 1) {
    if (!npcData || npcData.type === 'warehouse' || npcData.type === 'quest') {
      return { success: false, message: '该 NPC 不提供商店服务' };
    }

    const itemEntry = (npcData.items || []).find(i => i.item_key === itemKey);
    if (!itemEntry) {
      return { success: false, message: `该物品不在商店中` };
    }

    count = Math.max(1, Math.floor(Number(count) || 1));
    const price = Math.floor(itemEntry.buy_price * (npcData.price_multiplier || 1.0)) * count;
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
      for (let index = 0; index < count; index += 1) {
        if (!InventorySystem.addEquipmentInstance(player, createEquipmentInstance(template)).success) {
          success = false;
          break;
        }
      }
    } else {
      success = InventorySystem.add(player, itemKey, count).success;
    }

    if (!success) {
      player.inventory.slots = slotsBefore;
      player.inventory.equipment_instances = instancesBefore;
      return { success: false, message: '背包已满，购买失败' };
    }

    player.resources.gold -= price;
    console.log(`[商店] 购买 ${itemEntry.name || itemKey} x${count}，花费 ${price} 金币`);
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
    if (!npcData || npcData.type === 'warehouse' || npcData.type === 'quest') {
      return { success: false, message: '该 NPC 不提供商店服务' };
    }

    // 检查物品类
    const itemClass = InventorySystem._getItemClass(itemKey, player);
    if (this.FORBIDDEN_SELL_TYPES.includes(itemClass)) {
      return { success: false, message: '该物品不可出售' };
    }

    const have = InventorySystem.count(player, itemKey);
    if (have < count) {
      return { success: false, message: `物品不足，需要 ${count} 个` };
    }

    // 找商店物品条目（算 sell_price）
    const itemEntry = (npcData.items || []).find(i => i.item_key === itemKey);
    const fixedPrices = {
      hp_potion_grade1: 1, mp_potion_grade1: 1,
      hp_potion_grade2: 5, mp_potion_grade2: 5,
      hp_potion_grade3: 12, mp_potion_grade3: 12,
      enhance_stone_01: 15, cold_jade_01: 20, vajra_01: 20, hot_blood_01: 25,
    };
    const sellPrice = fixedPrices[itemKey] ?? (itemEntry?.buy_price ? Math.max(1, Math.floor(itemEntry.buy_price * 0.5)) : 1);
    const totalPrice = sellPrice * count;

    InventorySystem.remove(player, itemKey, count);
    player.resources.gold += totalPrice;
    console.log(`[商店] 出售 ${itemKey} x${count}，获得 ${totalPrice} 金币`);
    return { success: true, message: `出售成功，获得 ${totalPrice} 金币` };
  },

  sellEquipmentInstance(player, instanceId, sellPrice) {
    const slot = player.inventory?.slots?.find(entry => entry.instance_id === instanceId && entry.item_key);
    const instance = player.inventory?.equipment_instances?.[instanceId];
    if (!slot || !instance) return { success: false, message: '装备不在背包中' };
    const itemClass = InventorySystem._getItemClass(instance.item_key, player);
    if (this.FORBIDDEN_SELL_TYPES.includes(itemClass)) return { success: false, message: '该物品不可出售' };
    slot.item_key = null;
    slot.instance_id = null;
    slot.count = 0;
    delete player.inventory.equipment_instances[instanceId];
    player.resources.gold += Math.max(0, Number(sellPrice) || 0);
    return { success: true, message: `出售成功，获得 ${sellPrice} 金币` };
  }
};
