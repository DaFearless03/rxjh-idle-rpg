/**
 * @file systems/WarehouseSystem.js
 * @desc 仓库系统：deposit / withdraw
 * @ref 11_inventory.md warehouse_operation_limit / forbidden_types
 */
import { InventorySystem } from './InventorySystem.js';

export const WarehouseSystem = {
  FORBIDDEN_TYPES: ['quest_items'],

  /**
   * 从背包存入仓库
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, deposited: number }}
   */
  deposit(player, itemKey, count) {
    const itemClass = this._getItemClass(itemKey, player);
    if (this.FORBIDDEN_TYPES.includes(itemClass)) {
      return { success: false, deposited: 0 };
    }

    const removed = InventorySystem.remove(player, itemKey, count);
    if (!removed) return { success: false, deposited: 0 };

    const result = InventorySystem.addToContainer(player.warehouse, itemKey, count);
    return { success: result.success, deposited: count - result.discarded };
  },

  /**
   * 从仓库取出到背包
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, withdrawn: number }}
   */
  withdraw(player, itemKey, count) {
    const whSlots = player.warehouse?.slots || [];
    let available = 0;
    for (const s of whSlots) {
      if (s.item_key === itemKey) available += s.count;
    }
    if (available < count) return { success: false, withdrawn: 0 };

    let remaining = count;
    for (const slot of whSlots) {
      if (slot.item_key !== itemKey) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count === 0) slot.item_key = null;
      if (remaining === 0) break;
    }

    const result = InventorySystem.add(player, itemKey, count);
    return { success: result.success, withdrawn: count - result.discarded };
  },

  _getItemClass(itemKey, player) {
    return InventorySystem._getItemClass(itemKey, player);
  }
};
