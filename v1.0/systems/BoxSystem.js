/**
 * @file systems/BoxSystem.js
 * @desc 开盒系统：按 openable_items.weight 加权随机，支持批量开盒。
 * @ref 12_boxes.md
 */
import { InventorySystem } from './InventorySystem.js';
import { eventBus } from '../core/EventBus.js';
import { createEquipmentInstance } from '../entities/EquipmentInstance.js';

function toPositiveInt(value, fallback = 1) {
  return Math.max(1, Math.floor(Number(value) || fallback));
}

function aggregate(list, item) {
  const found = list.find(entry => entry.item_key === item.item_key);
  if (found) found.count += item.count || 1;
  else list.push({ ...item, count: item.count || 1 });
}

export const BoxSystem = {
  _boxes: new Map(),
  _equipments: new Map(),

  setTemplates({ boxes = [], equipmentTemplates = [] } = {}) {
    this._boxes = new Map((boxes || []).map(box => [box.key, box]));
    this._equipments = new Map((equipmentTemplates || []).map(item => [item.key, item]));
  },

  getBox(boxKey) {
    return this._boxes.get(boxKey) || null;
  },

  openBox(player, boxKey, count = 1) {
    const box = this.getBox(boxKey);
    const openCount = toPositiveInt(count);
    if (!player || !box) {
      return { success: false, message: '盒子不存在', obtained: [], discarded: [] };
    }
    if (!Array.isArray(box.openable_items) || box.openable_items.length === 0) {
      return { success: false, message: '该盒子没有配置奖池', obtained: [], discarded: [] };
    }
    if (InventorySystem.count(player, boxKey) < openCount) {
      return { success: false, message: '盒子数量不足', obtained: [], discarded: [] };
    }

    const removed = InventorySystem.remove(player, boxKey, openCount);
    if (!removed) {
      return { success: false, message: '盒子扣除失败', obtained: [], discarded: [] };
    }

    const obtained = [];
    const discarded = [];
    for (let i = 0; i < openCount; i += 1) {
      const reward = this._pickReward(box);
      if (!reward) continue;
      const itemKey = reward.item_key;
      const name = reward.name || itemKey;
      const itemClass = InventorySystem._getItemClass(itemKey, player);

      if (itemClass === 'equipment') {
        const tpl = this._equipments.get(itemKey);
        if (!tpl) {
          aggregate(discarded, { item_key: itemKey, name, count: 1, reason: 'missing_equipment_template' });
          continue;
        }
        const result = InventorySystem.addEquipmentInstance(player, createEquipmentInstance(tpl));
        if (result.success) {
          aggregate(obtained, { item_key: itemKey, name, count: 1, item_class: itemClass });
          eventBus.emit('drop.equipment', { equipment_key: itemKey, equipment_name: name, source: 'box' });
        } else {
          aggregate(discarded, { item_key: itemKey, name, count: 1, reason: 'inventory_full' });
        }
        continue;
      }

      const result = InventorySystem.add(player, itemKey, 1);
      if (result.added > 0) {
        aggregate(obtained, { item_key: itemKey, name, count: result.added, item_class: itemClass });
        if (itemClass === 'consumables') {
          eventBus.emit('drop.potion', { item_key: itemKey, item_name: name, count: result.added, source: 'box' });
        } else if (itemClass === 'stones') {
          eventBus.emit('drop.stone', { stone_key: itemKey, stone_base_name: name, source: 'box' });
        }
      }
      if (result.discarded > 0) {
        aggregate(discarded, { item_key: itemKey, name, count: result.discarded, reason: 'inventory_full' });
      }
    }

    const discardedCount = discarded.reduce((sum, item) => sum + item.count, 0);
    if (discardedCount > 0) {
      eventBus.emit('drop.discarded', { item_key: boxKey, item_name: box.name || boxKey, count: discardedCount, reason: 'box_reward_inventory_full' });
    }

    return {
      success: true,
      box_key: boxKey,
      box_name: box.name || boxKey,
      opened: openCount,
      obtained,
      discarded,
      message: `开启 ${box.name || boxKey} ×${openCount}`,
    };
  },

  _pickReward(box) {
    const pool = (box.openable_items || []).filter(item => Number(item.weight) > 0);
    const total = pool.reduce((sum, item) => sum + Number(item.weight), 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const item of pool) {
      roll -= Number(item.weight);
      if (roll <= 0) return item;
    }
    return pool[pool.length - 1] || null;
  },
};
