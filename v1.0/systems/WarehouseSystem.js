/**
 * @file systems/WarehouseSystem.js
 * @desc 仓库系统：deposit / withdraw
 * @ref 11_inventory.md warehouse_operation_limit / forbidden_types
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

export const WarehouseSystem = {
  FORBIDDEN_TYPES: ['quest_items'],

  _ensureContainers(player) {
    if (!player || typeof player !== 'object') return false;
    player.inventory = player.inventory || { capacity: 50, slots: [], equipment_instances: {} };
    player.inventory.slots = Array.isArray(player.inventory.slots) ? player.inventory.slots : [];
    player.inventory.equipment_instances = player.inventory.equipment_instances && typeof player.inventory.equipment_instances === 'object'
      && !Array.isArray(player.inventory.equipment_instances) ? player.inventory.equipment_instances : {};
    player.inventory.capacity = InventorySystem._normalizeCapacity(player.inventory.capacity);
    player.warehouse = player.warehouse || { capacity: 50, slots: [], equipment_instances: {} };
    player.warehouse.slots = Array.isArray(player.warehouse.slots) ? player.warehouse.slots : [];
    player.warehouse.equipment_instances = player.warehouse.equipment_instances && typeof player.warehouse.equipment_instances === 'object'
      && !Array.isArray(player.warehouse.equipment_instances) ? player.warehouse.equipment_instances : {};
    player.warehouse.capacity = InventorySystem._normalizeCapacity(player.warehouse.capacity);
    return true;
  },

  _hasFreeSlot(container) {
    const slots = container.slots || [];
    return slots.some(slot => !slot?.item_key || Number(slot.count) <= 0) || slots.length < container.capacity;
  },

  _putInstanceSlot(container, instance) {
    if (!instance?.instance_id || !instance?.item_key || container.equipment_instances[instance.instance_id]
      || container.slots.some(slot => slot?.instance_id === instance.instance_id)) return false;
    const slot = { item_key: instance.item_key, instance_id: instance.instance_id, count: 1 };
    const emptyIndex = container.slots.findIndex(entry => !entry?.item_key || Number(entry.count) <= 0);
    if (emptyIndex >= 0) container.slots[emptyIndex] = slot;
    else container.slots.push(slot);
    container.equipment_instances[instance.instance_id] = instance;
    return true;
  },

  _isEquipped(player, instanceId) {
    return Object.values(player.equipped || {}).some(value => {
      const entries = Array.isArray(value) ? value : [value];
      return entries.some(entry => (typeof entry === 'string' ? entry : entry?.instance_id) === instanceId);
    });
  },

  _removeInstanceSlot(container, instanceId) {
    const index = container.slots.findIndex(slot => slot.instance_id === instanceId);
    if (index < 0) return false;
    container.slots.splice(index, 1);
    delete container.equipment_instances[instanceId];
    return true;
  },

  /**
   * 从背包存入仓库
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, deposited: number }}
   */
  deposit(player, itemKey, count, { instanceId = null } = {}) {
    if (!this._ensureContainers(player) || typeof itemKey !== 'string' || !itemKey) {
      return { success: false, deposited: 0 };
    }
    const itemClass = this._getItemClass(itemKey, player);
    if (this.FORBIDDEN_TYPES.includes(itemClass)) {
      return { success: false, deposited: 0 };
    }

    if (instanceId) {
      const instance = player.inventory.equipment_instances[instanceId];
      const sourceSlot = player.inventory.slots.find(slot => slot.instance_id === instanceId);
      if (!instance || !sourceSlot || sourceSlot.item_key !== itemKey || instance.item_key !== itemKey
        || this._isEquipped(player, instanceId) || !this._hasFreeSlot(player.warehouse)
        || player.warehouse.equipment_instances[instanceId]
        || player.warehouse.slots.some(slot => slot?.instance_id === instanceId)) {
        return { success: false, deposited: 0 };
      }
      if (!this._putInstanceSlot(player.warehouse, instance) || !this._removeInstanceSlot(player.inventory, instanceId)) {
        this._removeInstanceSlot(player.warehouse, instanceId);
        return { success: false, deposited: 0 };
      }
      eventBus.emit('inventory.changed', { player, item_key: itemKey, action: 'warehouse_deposit', changed_count: 1, count: 0 });
      return { success: true, deposited: 1 };
    }

    if (itemClass === 'equipment') return { success: false, deposited: 0 };
    const normalizedCount = InventorySystem._normalizeCount(count);
    if (!normalizedCount) return { success: false, deposited: 0 };
    if (InventorySystem.count(player, itemKey) < normalizedCount) {
      return { success: false, deposited: 0 };
    }
    const candidate = {
      ...player.warehouse,
      slots: player.warehouse.slots.map(slot => ({ ...slot })),
    };
    const result = InventorySystem.addToContainer(candidate, itemKey, normalizedCount);
    if (!result.success) return { success: false, deposited: 0 };
    if (!InventorySystem.remove(player, itemKey, normalizedCount)) {
      return { success: false, deposited: 0 };
    }
    player.warehouse.slots = candidate.slots;
    eventBus.emit('inventory.changed', {
      player,
      item_key: itemKey,
      action: 'warehouse_deposit',
      changed_count: normalizedCount,
      count: InventorySystem.count(player, itemKey),
    });
    return { success: true, deposited: normalizedCount };
  },

  /**
   * 从仓库取出到背包
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, withdrawn: number }}
   */
  withdraw(player, itemKey, count, { instanceId = null } = {}) {
    if (!this._ensureContainers(player) || typeof itemKey !== 'string' || !itemKey) {
      return { success: false, withdrawn: 0 };
    }
    if (instanceId) {
      const instance = player.warehouse.equipment_instances[instanceId];
      const sourceSlot = player.warehouse.slots.find(slot => slot.instance_id === instanceId);
      if (!instance || !sourceSlot || sourceSlot.item_key !== itemKey || instance.item_key !== itemKey
        || !this._hasFreeSlot(player.inventory)
        || player.inventory.equipment_instances[instanceId]
        || player.inventory.slots.some(slot => slot?.instance_id === instanceId)) {
        return { success: false, withdrawn: 0 };
      }
      if (!this._putInstanceSlot(player.inventory, instance) || !this._removeInstanceSlot(player.warehouse, instanceId)) {
        this._removeInstanceSlot(player.inventory, instanceId);
        return { success: false, withdrawn: 0 };
      }
      eventBus.emit('inventory.changed', { player, item_key: itemKey, action: 'warehouse_withdraw', changed_count: 1, count: 1 });
      return { success: true, withdrawn: 1 };
    }

    if (this._getItemClass(itemKey, player) === 'equipment') return { success: false, withdrawn: 0 };
    const normalizedCount = InventorySystem._normalizeCount(count);
    if (!normalizedCount) return { success: false, withdrawn: 0 };
    const whSlots = player.warehouse?.slots || [];
    let available = 0;
    for (const s of whSlots) {
      if (s.item_key === itemKey && !s.instance_id) {
        const slotCount = Number(s.count);
        if (Number.isFinite(slotCount) && slotCount > 0) available += Math.floor(slotCount);
      }
    }
    if (available < normalizedCount) return { success: false, withdrawn: 0 };

    const candidateInventory = {
      ...player.inventory,
      slots: player.inventory.slots.map(slot => ({ ...slot })),
      equipment_instances: { ...player.inventory.equipment_instances },
    };
    const addResult = InventorySystem.addToContainer(candidateInventory, itemKey, normalizedCount);
    if (!addResult.success) return { success: false, withdrawn: 0 };

    let remaining = normalizedCount;
    for (const slot of whSlots) {
      if (slot.item_key !== itemKey || slot.instance_id) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count === 0) {
        slot.item_key = null;
        delete slot.instance_id;
      }
      if (remaining === 0) break;
    }

    player.inventory.slots = candidateInventory.slots;
    eventBus.emit('inventory.changed', { player, item_key: itemKey, action: 'warehouse_withdraw', changed_count: normalizedCount, count: InventorySystem.count(player, itemKey) });
    return { success: true, withdrawn: normalizedCount };
  },

  _getItemClass(itemKey, player) {
    return InventorySystem._getItemClass(itemKey, player);
  }
};
