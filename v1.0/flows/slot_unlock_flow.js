/**
 * @file flows/slot_unlock_flow.js
 * @desc 角色槽位解锁事务：玩家金币与全局槽位必须同时持久化
 */
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { storage } from '../utils/storage.js?v=release-20260830-3';

const UNLOCKING_SLOTS = new Set();

export async function executeSlotUnlock(slotIndex, globalSave, {
  activePlayer = null,
  payerSlot = null,
  cost = 100,
} = {}) {
  const slot = Number(slotIndex);
  const payer = Number(payerSlot);
  const normalizedGlobalSave = SaveManager.normalizeGlobalState(globalSave);
  if (!normalizedGlobalSave
    || !Number.isInteger(slot)
    || slot < 1
    || slot > 10
    || !Number.isSafeInteger(cost)
    || cost <= 0) {
    return { success: false, globalSave, message: '角色槽位或全局存档无效' };
  }

  if (UNLOCKING_SLOTS.has(slot)) {
    return { success: false, globalSave, message: `第 ${slot} 号位正在解锁，请稍候` };
  }
  UNLOCKING_SLOTS.add(slot);
  try {
    return await executeSlotUnlockTransaction(slot, payer, globalSave, normalizedGlobalSave, activePlayer, cost);
  } finally {
    UNLOCKING_SLOTS.delete(slot);
  }
}

async function executeSlotUnlockTransaction(slot, payer, globalSave, normalizedGlobalSave, activePlayer, cost) {
  const unlocked = normalizedGlobalSave.character_slots.unlocked_count;
  if (slot <= unlocked) return { success: false, globalSave, message: '该槽位已经解锁' };
  if (slot !== unlocked + 1) {
    return { success: false, globalSave, message: `请先解锁第 ${unlocked + 1} 号位` };
  }
  if (!Number.isInteger(payer) || payer < 1 || payer > unlocked) {
    return { success: false, globalSave, message: '请先进入任意角色后再解锁栏位' };
  }

  const payerSave = await SaveManager.restorePlayerFromSave(payer);
  if (!payerSave) {
    return { success: false, globalSave, message: '支付角色存档不可用，请重新进入角色后再试' };
  }
  if (activePlayer && payerSave.player?.id !== activePlayer.id) {
    return { success: false, globalSave, message: '支付角色与存档槽不匹配，请重新进入角色后再试' };
  }
  const playerData = activePlayer || payerSave;
  const resources = playerData?.resources;
  if (!resources || !Number.isSafeInteger(resources.gold) || resources.gold < cost) {
    return { success: false, globalSave, message: `金币不足（需要 ${cost}）` };
  }

  const primaryKey = `player-${payer}`;
  const shadowKey = `${primaryKey}-bak`;
  const previousPrimary = storage.get(primaryKey);
  const previousShadow = storage.get(shadowKey);
  const previousGold = resources.gold;
  const previousTimestamp = playerData.offline?.last_save_timestamp;

  resources.gold -= cost;
  if (activePlayer) {
    eventBus.emit('resources.changed', {
      player: activePlayer,
      resource: 'gold',
      amount: cost,
      action: 'remove',
    });
  }

  const payerSaved = activePlayer
    ? await SaveManager.savePlayerState(activePlayer, payer)
    : await SaveManager.savePlayerSnapshot(payerSave, payer, { preserveOfflineTimestamp: true });
  if (!payerSaved) {
    resources.gold = previousGold;
    if (playerData.offline) playerData.offline.last_save_timestamp = previousTimestamp;
    if (activePlayer) {
      eventBus.emit('resources.changed', {
        player: activePlayer,
        resource: 'gold',
        amount: cost,
        action: 'add',
      });
    }
    return { success: false, globalSave, message: '金币扣除存档失败，请稍后重试' };
  }

  globalSave.character_slots = normalizedGlobalSave.character_slots;
  globalSave.schema_version = normalizedGlobalSave.schema_version;
  globalSave.character_slots.unlocked_count = slot;
  if (!await SaveManager.saveGlobalState(globalSave)) {
    globalSave.character_slots.unlocked_count = unlocked;
    resources.gold = previousGold;
    if (playerData.offline) playerData.offline.last_save_timestamp = previousTimestamp;
    SaveManager.invalidatePendingPlayerWrites(payer);
    const primaryRestored = restoreStorageValue(primaryKey, previousPrimary);
    const shadowRestored = restoreStorageValue(shadowKey, previousShadow);
    if (activePlayer) {
      eventBus.emit('resources.changed', {
        player: activePlayer,
        resource: 'gold',
        amount: cost,
        action: 'add',
      });
    }
    return {
      success: false,
      globalSave,
      message: primaryRestored && shadowRestored
        ? '栏位状态写入失败，金币已退回'
        : '栏位状态写入失败，且金币存档未能完整恢复',
    };
  }

  return {
    success: true,
    globalSave,
    payerSlot: payer,
    remainingGold: resources.gold,
    message: `第 ${slot} 号位已解锁，消耗 ${cost} 金币`,
  };
}

function restoreStorageValue(key, value) {
  return value == null ? storage.remove(key) : storage.set(key, value);
}
