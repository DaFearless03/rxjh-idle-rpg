/**
 * @file ui/WarehouseUI.js
 * @desc 仓库双区渲染 helper。交互仍由 BottomBarUI 的存取流程托管。
 */

import { renderBagTile } from './InventoryUI.js?v=release-20260611-7';

const WH_CAPACITY = 50;

function normalizeWarehouseSlot(slot) {
  if (!slot) return null;
  return {
    item_key: slot.item_key || slot.key,
    key: slot.key || slot.item_key,
    icon: slot.icon,
    name: slot.name,
    count: slot.count || 0,
    quest: slot.quest,
    instance_id: slot.instance_id,
  };
}

function renderWarehouseTiles(slots, player) {
  const normalized = (slots || []).map(normalizeWarehouseSlot).filter(s => s && s.count > 0 && (s.item_key || s.key));
  const tiles = normalized.map(slot => renderBagTile(slot, player));
  while (tiles.length < WH_CAPACITY) tiles.push('<div class="bag-tile empty"></div>');
  return tiles.join('');
}

function isEquipped(player, instanceId) {
  if (!instanceId) return false;
  return Object.values(player.equipped || {}).some(value => {
    const entries = Array.isArray(value) ? value : [value];
    return entries.some(entry => (typeof entry === 'string' ? entry : entry?.instance_id) === instanceId);
  });
}

export function mountWarehouseGrids(player, options = {}) {
  const {
    warehouseGridId = 'whWarehouseGrid',
    bagGridId = 'whBagGrid',
    warehouseCountId = 'whWarehouseCount',
    bagCountId = 'whBagCount',
    goldId = 'whPlayerGold',
  } = options;

  if (!player) return;
  const warehouseGrid = document.getElementById(warehouseGridId);
  const bagGrid = document.getElementById(bagGridId);
  const warehouseCount = document.getElementById(warehouseCountId);
  const bagCount = document.getElementById(bagCountId);
  const gold = document.getElementById(goldId);
  const warehouseSlots = player.warehouse?.slots || [];
  const bagSlots = (player.inventory?.slots || []).filter(slot => !isEquipped(player, slot.instance_id));
  const warehouseUsed = warehouseSlots.filter(s => (s.count || 0) > 0).length;
  const bagUsed = bagSlots.filter(s => (s.count || 0) > 0).length;
  const warehouseCapacity = player.warehouse?.capacity || WH_CAPACITY;
  const bagCapacity = player.inventory?.capacity || WH_CAPACITY;

  const warehousePlayer = {
    ...player,
    _equipTemplates: player._equipTemplates || window._equipTemplates || [],
    inventory: {
      ...(player.inventory || {}),
      equipment_instances: player.warehouse?.equipment_instances || {},
    },
    equipped: {},
  };
  const bagPlayer = {
    ...player,
    _equipTemplates: player._equipTemplates || window._equipTemplates || [],
    equipped: {},
  };
  if (warehouseGrid) warehouseGrid.innerHTML = renderWarehouseTiles(warehouseSlots, warehousePlayer);
  if (bagGrid) bagGrid.innerHTML = renderWarehouseTiles(bagSlots, bagPlayer);
  if (warehouseCount) warehouseCount.textContent = `${warehouseUsed} / ${warehouseCapacity}`;
  if (bagCount) bagCount.textContent = `${bagUsed} / ${bagCapacity}`;
  if (gold) gold.textContent = (player.resources?.gold || player.gold || 0).toLocaleString();
}
