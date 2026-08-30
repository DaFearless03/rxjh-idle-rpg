/**
 * @file systems/AutoStoreSystem.js
 * @desc 自动回城时按配置将背包中的石头与装备存入仓库。
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-1';
import { WarehouseSystem } from './WarehouseSystem.js?v=release-20260830-1';
import { eventBus } from '../core/EventBus.js?v=release-20260830-1';

const STONE_CATEGORY_PREFIXES = {
  enhance: 'enhance_stone_',
  vajra: 'vajra_',
  cold_jade: 'cold_jade_',
  hot_blood: 'hot_blood_',
};

function parseStoneKey(itemKey) {
  const parts = String(itemKey || '').split('--');
  const baseKey = parts[0] || '';
  const category = Object.entries(STONE_CATEGORY_PREFIXES)
    .find(([, prefix]) => baseKey.startsWith(prefix))?.[0] || null;
  if (!category) return null;
  if (category === 'enhance') {
    return { baseKey, category, attributeKey: null, value: null };
  }
  if (parts.length !== 3) return null;
  const value = Number(parts[2]);
  if (!parts[1] || !Number.isFinite(value)) return null;
  return { baseKey, category, attributeKey: parts[1], value };
}

function matchesStoneRule(player, itemKey) {
  const stone = parseStoneKey(itemKey);
  const rules = player?.auto_play?.auto_store?.stones?.rules || [];
  if (!stone) return false;
  return rules.some(rule =>
    rule?.category === stone.category
    && (stone.category === 'enhance'
      || (rule.attribute_key === stone.attributeKey && Number(rule.value) === stone.value))
  );
}

function matchesEquipmentRule(player, slot) {
  const itemKeys = player?.auto_play?.auto_store?.equipment?.item_keys || [];
  return !!slot?.instance_id && itemKeys.includes(slot.item_key);
}

function occupiedSlotCount(container) {
  return (container?.slots || []).filter(slot => slot?.item_key && (slot.count || 0) > 0).length;
}

function stackDepositCapacity(player, itemKey) {
  const warehouse = player?.warehouse || { capacity: 50, slots: [] };
  const maxStack = InventorySystem._getMaxStack(itemKey, player);
  const existingRoom = (warehouse.slots || []).reduce((sum, slot) => {
    if (slot?.item_key !== itemKey || slot.instance_id) return sum;
    return sum + Math.max(0, maxStack - Number(slot.count || 0));
  }, 0);
  const freeSlots = Math.max(0, Number(warehouse.capacity || 50) - occupiedSlotCount(warehouse));
  return existingRoom + freeSlots * maxStack;
}

function canDepositSlot(player, slot) {
  if (slot?.instance_id) {
    const warehouse = player?.warehouse || { capacity: 50, slots: [] };
    return occupiedSlotCount(warehouse) < Number(warehouse.capacity || 50);
  }
  return stackDepositCapacity(player, slot?.item_key) > 0;
}

export const AutoStoreSystem = {
  parseStoneKey,

  hasStorableConfiguredItems(player) {
    if (!player?.auto_play?.auto_store?.enabled) return false;
    return (player.inventory?.slots || []).some(slot =>
      slot?.item_key
      && (slot.count || 0) > 0
      && (matchesStoneRule(player, slot.item_key) || matchesEquipmentRule(player, slot))
      && canDepositSlot(player, slot)
    );
  },

  storeConfiguredItems(player, { silent = false } = {}) {
    const emptySummary = { stored: 0, stones_stored: 0, equipment_stored: 0, items: {} };
    if (!player?.auto_play?.auto_store?.enabled) return emptySummary;

    const summary = { ...emptySummary, items: {} };
    const slots = [...(player.inventory?.slots || [])];
    for (const slot of slots) {
      if (!slot?.item_key || (slot.count || 0) <= 0) continue;
      const isEquipment = matchesEquipmentRule(player, slot);
      const isStone = !slot.instance_id && matchesStoneRule(player, slot.item_key);
      if ((!isEquipment && !isStone) || !canDepositSlot(player, slot)) continue;

      const itemKey = slot.item_key;
      const count = isEquipment
        ? 1
        : Math.min(Number(slot.count || 0), stackDepositCapacity(player, itemKey));
      if (count <= 0) continue;
      const result = WarehouseSystem.deposit(player, itemKey, count, { instanceId: slot.instance_id || null });
      if (!result.success || result.deposited <= 0) continue;

      summary.stored += result.deposited;
      if (isEquipment) summary.equipment_stored += result.deposited;
      else summary.stones_stored += result.deposited;
      summary.items[itemKey] = (summary.items[itemKey] || 0) + result.deposited;
    }

    if (summary.stored > 0 && !silent) eventBus.emit('autoplay.auto_store', summary);
    return summary;
  },
};
