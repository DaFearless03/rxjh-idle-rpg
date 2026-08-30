/**
 * @file systems/InventorySystem.js
 * @desc 背包系统：count / add / remove / addEquipmentInstance
 * @ref 11_inventory.md InventorySystem 标准函数
 */
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

function isSafeIdentifier(value, maxLength = 256) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/.test(value);
}

export const InventorySystem = {
  _itemClasses: {
    equipment: new Set(),
    stones: new Set(),
    consumables: new Set(),
    boxes: new Set(),
    quest_items: new Set(),
  },

  /**
   * 注册数据驱动的物品分类，避免新增配置后仍走硬编码 fallback。
   */
  setItemClassMap({
    equipmentKeys = [],
    stoneKeys = [],
    consumableKeys = [],
    boxKeys = [],
    questItemKeys = [],
  } = {}) {
    this._itemClasses = {
      equipment: new Set(equipmentKeys),
      stones: new Set(stoneKeys),
      consumables: new Set(consumableKeys),
      boxes: new Set(boxKeys),
      quest_items: new Set(questItemKeys),
    };
  },

  /**
   * 返回背包中该物品总数（仅 inventory，不查 warehouse）
   * 装备实例按 instance_id 单件存储，不参与堆叠 count
   * @param {Object} player
   * @param {string} itemKey
   * @returns {number}
   */
  count(player, itemKey) {
    if (!isSafeIdentifier(itemKey)) return 0;
    const slots = player?.inventory?.slots || [];
    return slots.reduce((sum, slot) => {
      if (slot?.item_key === itemKey && !slot.instance_id) {
        const slotCount = Number(slot.count);
        return sum + (Number.isFinite(slotCount) && slotCount > 0 ? Math.floor(slotCount) : 0);
      }
      return sum;
    }, 0);
  },

  /**
   * 添加物品到背包；按规则尝试堆叠 / 新建槽位 / 拒绝
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {{ success: boolean, added: number, discarded: number }}
   */
  add(player, itemKey, count) {
    const normalizedCount = this._normalizeCount(count);
    if (!this._ensureInventory(player) || !isSafeIdentifier(itemKey) || !normalizedCount) {
      return { success: false, added: 0, discarded: 0 };
    }
    if (this._getItemClass(itemKey, player) === 'equipment') {
      return { success: false, added: 0, discarded: normalizedCount };
    }

    const slots = player.inventory.slots;
    const maxStack = this._getMaxStack(itemKey, player);
    const isQuestItem = this._getItemClass(itemKey, player) === 'quest_items';
    const snapshot = isQuestItem ? JSON.parse(JSON.stringify(slots)) : null;
    let remaining = normalizedCount;
    let added = 0;
    let discarded = 0;

    // step 1: 尝试堆叠到已有同 key 槽位
    for (const slot of slots) {
      if (slot?.item_key !== itemKey || slot.instance_id) continue;
      const currentCount = Number.isFinite(Number(slot.count)) ? Math.max(0, Math.floor(Number(slot.count))) : 0;
      slot.count = currentCount;
      const room = maxStack - currentCount;
      if (room <= 0) continue;
      const take = Math.min(remaining, room);
      slot.count += take;
      remaining -= take;
      added += take;
      if (remaining === 0) break;
    }

    // step 2: 剩余数量 → 新建槽位
    if (remaining > 0) {
      const capacity = player.inventory.capacity;
      for (const slot of slots) {
        if (!slot?.item_key || Number(slot.count) <= 0) {
          // 找空槽位复用
          slot.item_key = itemKey;
          delete slot.instance_id;
          const take = Math.min(remaining, maxStack);
          slot.count = take;
          remaining -= take;
          added += take;
          if (remaining === 0) break;
        }
      }

      // 还有剩余且有容量时新建槽位
      while (remaining > 0 && slots.length < capacity) {
        const take = Math.min(remaining, maxStack);
        slots.push({ item_key: itemKey, count: take });
        remaining -= take;
        added += take;
      }
    }

    // step 3: 超出容量的部分
    if (remaining > 0) {
      // 任务物品特例：step 3 不丢弃，改为 success=False
      if (isQuestItem) {
        if (snapshot) {
          player.inventory.slots.length = 0;
          player.inventory.slots.push(...snapshot);
        }
        return { success: false, added: 0, discarded: normalizedCount };
      }
      discarded = remaining;
      remaining = 0;
    }

    this._emitChanged(player, itemKey, added, 'add');
    return { success: discarded === 0, added, discarded };
  },

  /**
   * 装备实例专属接口（不堆叠，按 instance_id 存 equipment_instances）
   * @param {Object} player
   * @param {Object} newInstance { instance_id, item_key, enhance_level, synthesis_slots }
   * @returns {{ success: boolean, added: number, discarded: number }}
   */
  addEquipmentInstance(player, newInstance) {
    if (!this._ensureInventory(player) || !newInstance || typeof newInstance !== 'object') {
      return { success: false, added: 0, discarded: 1 };
    }
    const eid = typeof newInstance.instance_id === 'string' ? newInstance.instance_id.trim() : '';
    const itemKey = typeof newInstance.item_key === 'string' ? newInstance.item_key.trim() : '';
    const enhanceLevel = Number(newInstance.enhance_level ?? 0);
    const synthesisSlots = newInstance.synthesis_slots ?? [];
    const extra = newInstance.extra ?? {};
    const desc = newInstance.desc ?? '';
    if (!isSafeIdentifier(eid)
      || !isSafeIdentifier(itemKey)
      || !Number.isSafeInteger(enhanceLevel)
      || enhanceLevel < 0
      || enhanceLevel > 10
      || !Array.isArray(synthesisSlots)
      || synthesisSlots.length > 4
      || !synthesisSlots.every(stone => stone == null || isSafeIdentifier(stone))
      || !extra
      || typeof extra !== 'object'
      || Array.isArray(extra)
      || Object.keys(extra).length > 100
      || !Object.entries(extra).every(([key, value]) => isSafeIdentifier(key) && Number.isFinite(value))
      || typeof desc !== 'string'
      || desc.length > 5000) {
      return { success: false, added: 0, discarded: 1 };
    }

    const ei = player.inventory.equipment_instances;
    const slots = player.inventory.slots;
    const capacity = player.inventory.capacity;
    const duplicate = ei[eid]
      || slots.some(slot => slot?.instance_id === eid)
      || player.warehouse?.equipment_instances?.[eid]
      || player.warehouse?.slots?.some(slot => slot?.instance_id === eid);
    if (duplicate) return { success: false, added: 0, discarded: 1 };

    // 检查是否有空余容量（空槽位 或 slots < capacity）
    const emptySlot = slots.find(s => !s?.item_key || Number(s.count) <= 0);
    const hasSpace = emptySlot || slots.length < capacity;

    if (!hasSpace) {
      return { success: false, added: 0, discarded: 1 };
    }

    // 占用一个槽位（复用空槽或新建）
    if (emptySlot) {
      emptySlot.item_key = itemKey;
      emptySlot.instance_id = eid;
      emptySlot.count = 1;
    } else {
      slots.push({ item_key: itemKey, instance_id: eid, count: 1 });
    }

    // 存实例数据
    ei[eid] = {
      instance_id: eid,
      item_key: itemKey,
      enhance_level: enhanceLevel,
      synthesis_slots: [...synthesisSlots],
      desc,
      extra: { ...extra },
    };
    player.inventory.equipment_instances = ei;

    this._emitChanged(player, itemKey, 1, 'add');
    return { success: true, added: 1, discarded: 0 };
  },

  /**
   * 从背包移除指定数量；原子性保护，不足时返回 False
   * @param {Object} player
   * @param {string} itemKey
   * @param {number} count
   * @returns {boolean}
   */
  remove(player, itemKey, count) {
    const normalizedCount = this._normalizeCount(count);
    if (!this._ensureInventory(player) || !isSafeIdentifier(itemKey) || !normalizedCount) return false;
    if (this._getItemClass(itemKey, player) === 'equipment') return false;
    if (this.count(player, itemKey) < normalizedCount) return false;
    const slots = player.inventory.slots;
    let remaining = normalizedCount;
    for (const slot of slots) {
      if (slot?.item_key !== itemKey || slot.instance_id) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count === 0) {
        slot.item_key = null;
        delete slot.instance_id;
      }
      if (remaining === 0) break;
    }
    this._emitChanged(player, itemKey, normalizedCount, 'remove');
    return true;
  },

  _emitChanged(player, itemKey, changedCount, action) {
    if (changedCount <= 0) return;
    eventBus.emit('inventory.changed', {
      player,
      item_key: itemKey,
      action,
      changed_count: changedCount,
      count: this.count(player, itemKey),
    });
  },

  addToContainer(container, itemKey, count) {
    // 对指定 container（仓库）执行 add 逻辑（复用 add 的堆叠/容量逻辑）
    const normalizedCount = this._normalizeCount(count);
    if (!container || typeof container !== 'object' || !isSafeIdentifier(itemKey) || !normalizedCount) {
      return { success: false, added: 0, discarded: 0 };
    }
    if (this._getItemClass(itemKey, {}) === 'equipment') {
      return { success: false, added: 0, discarded: normalizedCount };
    }
    if (!Array.isArray(container.slots)) container.slots = [];
    const slots = container.slots;
    const maxStack = this._getMaxStack(itemKey, {});
    let remaining = normalizedCount;
    let added = 0;
    let discarded = 0;

    for (const slot of slots) {
      if (slot?.item_key !== itemKey || slot.instance_id) continue;
      const currentCount = Number.isFinite(Number(slot.count)) ? Math.max(0, Math.floor(Number(slot.count))) : 0;
      slot.count = currentCount;
      const room = maxStack - currentCount;
      if (room <= 0) continue;
      const take = Math.min(remaining, room);
      slot.count += take;
      remaining -= take;
      added += take;
      if (remaining === 0) break;
    }

    if (remaining > 0) {
      const capacity = this._normalizeCapacity(container.capacity);
      for (const slot of slots) {
        if (slot?.item_key && Number(slot.count) > 0) continue;
        slot.item_key = itemKey;
        delete slot.instance_id;
        const take = Math.min(remaining, maxStack);
        slot.count = take;
        remaining -= take;
        added += take;
        if (remaining === 0) break;
      }
      while (remaining > 0 && slots.length < capacity) {
        const take = Math.min(remaining, maxStack);
        slots.push({ item_key: itemKey, count: take });
        remaining -= take;
        added += take;
      }
    }

    if (remaining > 0) discarded = remaining;
    return { success: remaining === 0, added, discarded };
  },

  /**
   * 按 item_key 找对应 max_stack
   * @param {string} itemKey
   * @param {Object} player
   * @returns {number}
   */
  _getMaxStack(itemKey, player) {
    const itemClass = this._getItemClass(itemKey, player);
    if (itemClass === 'equipment') return 1;
    if (itemClass === 'boxes') return 999;
    if (itemClass === 'consumables') return 999;
    return 99;
  },

  /**
   * 根据 item_key 判断 item_class
   * @param {string} itemKey
   * @param {Object} player
   * @returns {string}
   */
  _getItemClass(itemKey, player) {
    const normalizedKey = typeof itemKey === 'string' ? itemKey : '';
    if (!normalizedKey) return 'unknown';
    for (const [itemClass, keys] of Object.entries(this._itemClasses)) {
      if (keys.has(normalizedKey)) return itemClass;
    }

    // Fallbacks cover old saves or test keys before templates are registered.
    if (normalizedKey.startsWith('box_')) return 'boxes';
    if (
      normalizedKey.startsWith('cold_jade') ||
      normalizedKey.startsWith('vajra') ||
      normalizedKey.startsWith('enhance_stone') ||
      normalizedKey.startsWith('hot_blood')
    ) return 'stones';
    if (normalizedKey.includes('_potion_')) return 'consumables';
    if (player?.inventory?.equipment_instances) {
      for (const inst of Object.values(player.inventory.equipment_instances)) {
        if (inst?.item_key === normalizedKey) return 'equipment';
      }
    }
    return 'unknown';
  },

  _normalizeCount(count) {
    const value = Number(count);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  },

  _normalizeCapacity(capacity) {
    const value = Number(capacity);
    return Number.isSafeInteger(value) && value >= 1 && value <= 1000 ? value : 50;
  },

  _ensureInventory(player) {
    if (!player || typeof player !== 'object') return false;
    if (!player.inventory || typeof player.inventory !== 'object') {
      player.inventory = { capacity: 50, slots: [], equipment_instances: {} };
    }
    if (!Array.isArray(player.inventory.slots)) player.inventory.slots = [];
    if (!player.inventory.equipment_instances || typeof player.inventory.equipment_instances !== 'object' || Array.isArray(player.inventory.equipment_instances)) {
      player.inventory.equipment_instances = {};
    }
    player.inventory.capacity = this._normalizeCapacity(player.inventory.capacity);
    return true;
  }
};
