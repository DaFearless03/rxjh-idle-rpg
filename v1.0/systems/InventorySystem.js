/**
 * @file systems/InventorySystem.js
 * @desc 背包系统：count / add / remove / addEquipmentInstance
 * @ref 11_inventory.md InventorySystem 标准函数
 */
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
    const slots = player.inventory?.slots || [];
    return slots.reduce((sum, slot) => {
      if (slot.item_key === itemKey) return sum + slot.count;
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
    const slots = player.inventory?.slots || [];
    const maxStack = this._getMaxStack(itemKey, player);
    let remaining = count;
    let added = 0;
    let discarded = 0;

    // step 1: 尝试堆叠到已有同 key 槽位
    for (const slot of slots) {
      if (slot.item_key !== itemKey) continue;
      const room = maxStack - slot.count;
      if (room <= 0) continue;
      const take = Math.min(remaining, room);
      slot.count += take;
      remaining -= take;
      added += take;
      if (remaining === 0) break;
    }

    // step 2: 剩余数量 → 新建槽位
    if (remaining > 0) {
      const capacity = player.inventory?.capacity || 50;
      for (const slot of slots) {
        if (slot.count === 0) {
          // 找空槽位复用
          slot.item_key = itemKey;
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
      const itemClass = this._getItemClass(itemKey, player);
      if (itemClass === 'quest_items') {
        return { success: false, added: 0, discarded: count };
      }
      discarded = remaining;
      remaining = 0;
    }

    return { success: discarded === 0, added, discarded };
  },

  /**
   * 装备实例专属接口（不堆叠，按 instance_id 存 equipment_instances）
   * @param {Object} player
   * @param {Object} newInstance { instance_id, item_key, enhance_level, synthesis_slots }
   * @returns {{ success: boolean, added: number, discarded: number }}
   */
  addEquipmentInstance(player, newInstance) {
    const eid = newInstance.instance_id;
    const ei = player.inventory?.equipment_instances || {};
    const slots = player.inventory?.slots || [];
    const capacity = player.inventory?.capacity || 50;

    // 检查是否有空余容量（空槽位 或 slots < capacity）
    const emptySlot = slots.find(s => s.count === 0);
    const hasSpace = emptySlot || slots.length < capacity;

    if (!hasSpace) {
      return { success: false, added: 0, discarded: 1 };
    }

    // 占用一个槽位（复用空槽或新建）
    if (emptySlot) {
      emptySlot.item_key = newInstance.item_key;
      emptySlot.instance_id = eid;
      emptySlot.count = 1;
    } else {
      slots.push({ item_key: newInstance.item_key, instance_id: eid, count: 1 });
    }

    // 存实例数据
    ei[eid] = newInstance;
    player.inventory.equipment_instances = ei;

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
    if (this.count(player, itemKey) < count) return false;
    const slots = player.inventory?.slots || [];
    let remaining = count;
    for (const slot of slots) {
      if (slot.item_key !== itemKey) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count === 0) slot.item_key = null;
      if (remaining === 0) break;
    }
    return true;
  },

  addToContainer(container, itemKey, count) {
    // 对指定 container（仓库）执行 add 逻辑（复用 add 的堆叠/容量逻辑）
    const slots = container?.slots || [];
    const maxStack = this._getMaxStack(itemKey, {});
    let remaining = count;
    let added = 0;
    let discarded = 0;

    for (const slot of slots) {
      if (slot.item_key !== itemKey) continue;
      const room = maxStack - slot.count;
      if (room <= 0) continue;
      const take = Math.min(remaining, room);
      slot.count += take;
      remaining -= take;
      added += take;
      if (remaining === 0) break;
    }

    if (remaining > 0) {
      const capacity = container?.capacity || 50;
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
    for (const [itemClass, keys] of Object.entries(this._itemClasses)) {
      if (keys.has(itemKey)) return itemClass;
    }

    // Fallbacks cover old saves or test keys before templates are registered.
    if (itemKey.startsWith('box_')) return 'boxes';
    if (
      itemKey.startsWith('cold_jade') ||
      itemKey.startsWith('vajra') ||
      itemKey.startsWith('enhance_stone') ||
      itemKey.startsWith('hot_blood')
    ) return 'stones';
    if (itemKey.includes('_potion_')) return 'consumables';
    if (player.inventory?.equipment_instances) {
      for (const inst of Object.values(player.inventory.equipment_instances)) {
        if (inst.item_key === itemKey) return 'equipment';
      }
    }
    return 'unknown';
  }
};
