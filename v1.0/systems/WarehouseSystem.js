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
    const itemClass = this._getItemClass(itemKey);
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

  _getItemClass(itemKey) {
    const equipKeys = [
      'blade_base_001', 'blade_base_002', 'blade_t1_001',
      'blade_chest_base_001', 'blade_chest_base_002',
      'gloves_base_001', 'boots_base_001', 'inner_armor_base_001',
      'amulet_base_001', 'ring_base_001', 'earring_base_001', 'cape_base_001'
    ];
    if (equipKeys.includes(itemKey)) return 'equipment';
    const stoneKeys = ['cold_jade_01', 'vajra_01', 'enhance_stone_01', 'hot_blood_01'];
    if (stoneKeys.includes(itemKey)) return 'stones';
    const boxKeys = ['box_xuanbo_01'];
    if (boxKeys.includes(itemKey)) return 'boxes';
    return 'quest_items';
  }
};