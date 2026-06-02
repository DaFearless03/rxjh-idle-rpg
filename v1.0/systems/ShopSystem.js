/**
 * @file systems/ShopSystem.js
 * @desc 商店买卖：价格倍率 / forbidden 检查
 * @ref 08_maps_npc_quests shop npc
 */
import { InventorySystem } from './InventorySystem.js';

export const ShopSystem = {
  FORBIDDEN_SELL_TYPES: ['quest_items'],

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

    const price = Math.floor(itemEntry.buy_price * (npcData.price_multiplier || 1.0)) * count;
    if ((player.resources?.gold || 0) < price) {
      return { success: false, message: `金币不足，需要 ${price} 金币` };
    }

    player.resources.gold -= price;
    const result = InventorySystem.add(player, itemKey, count);
    if (result.success) {
      console.log(`[商店] 购买 ${itemEntry.name} x${count}，花费 ${price} 金币`);
      return { success: true, message: `购买成功` };
    } else {
      // 背包满，退金币
      player.resources.gold += price;
      return { success: false, message: '背包已满，购买失败' };
    }
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
    const sellPrice = itemEntry?.buy_price ? Math.floor(itemEntry.buy_price * 0.5) : 1;
    const totalPrice = sellPrice * count;

    InventorySystem.remove(player, itemKey, count);
    player.resources.gold += totalPrice;
    console.log(`[商店] 出售 ${itemKey} x${count}，获得 ${totalPrice} 金币`);
    return { success: true, message: `出售成功，获得 ${totalPrice} 金币` };
  }
};