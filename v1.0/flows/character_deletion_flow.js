/**
 * @file flows/character_deletion_flow.js
 * @desc 3步角色删除流程
 * @ref 13_save.character_deletion_flow
 */
import { storage } from '../utils/storage.js?v=release-20260830-3';
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

/**
 * 触发删除前的二次确认信息
 * @param {number} slotIndex
 * @param {Object} characterData 角色数据（用于显示 name / level / career）
 * @returns {{ confirmBody: string, characterData }}
 */
export function getDeletionConfirmInfo(slotIndex, characterData, careersData = []) {
  const careerKey = characterData?.player?.career || characterData?.career;
  const careerDisplay = careersData.find(career => career.key === careerKey)?.name || careerKey || '未知职业';
  const name = characterData?.player?.name || `槽位${slotIndex}`;
  const level = characterData?.player?.level || '?';
  return {
    confirmBody: `确认删除「${name}」（Lv${level} ${careerDisplay}）？此操作不可恢复。`,
    characterData,
  };
}

/**
 * 执行删除
 * @param {number} slotIndex
 * @param {Object} globalSave
 * @returns {Object} { success, globalSave }
 */
export async function executeDeletion(slotIndex, globalSave) {
  const slot = Number(slotIndex);
  const normalizedGlobalSave = SaveManager.normalizeGlobalState(globalSave);
  if (!Number.isInteger(slot)
    || slot < 1
    || slot > 10
    || !normalizedGlobalSave
    || slot > normalizedGlobalSave.character_slots.unlocked_count) {
    return { success: false, globalSave, message: '角色槽位或全局存档无效' };
  }
  globalSave.character_slots = normalizedGlobalSave.character_slots;
  globalSave.schema_version = normalizedGlobalSave.schema_version;
  const primaryKey = `player-${slot}`;
  const shadowKey = `${primaryKey}-bak`;
  const primaryBackup = storage.get(primaryKey);
  const shadowBackup = storage.get(shadowKey);
  if (primaryBackup == null && shadowBackup == null) {
    return { success: false, globalSave, message: '该槽位没有角色' };
  }
  const previousLastUsedSlot = globalSave.character_slots.last_used_slot;

  // 1. 清存档
  SaveManager.invalidatePendingPlayerWrites(slot);
  const primaryRemoved = storage.remove(primaryKey);
  const shadowRemoved = storage.remove(shadowKey);
  if (!primaryRemoved || !shadowRemoved) {
    const primaryRestored = restoreStorageValue(primaryKey, primaryBackup);
    const shadowRestored = restoreStorageValue(shadowKey, shadowBackup);
    const restored = primaryRestored && shadowRestored;
    return {
      success: false,
      globalSave,
      message: restored ? '角色存档删除失败' : '角色存档删除失败，且旧存档未能完整恢复',
    };
  }

  // 2. 若 last_used_slot 指向被删角色 → 置 null
  if (globalSave.character_slots.last_used_slot === slot) {
    globalSave.character_slots.last_used_slot = null;
  }

  // 3. unlocked_count 不回退（已解锁槽位永久保留）

  // 4. 写全局存档
  if (!await SaveManager.saveGlobalState(globalSave)) {
    globalSave.character_slots.last_used_slot = previousLastUsedSlot;
    const primaryRestored = restoreStorageValue(primaryKey, primaryBackup);
    const shadowRestored = restoreStorageValue(shadowKey, shadowBackup);
    const restored = primaryRestored && shadowRestored;
    return {
      success: false,
      globalSave,
      message: restored ? '全局存档写入失败' : '全局存档写入失败，且角色存档未能完整恢复',
    };
  }

  eventBus.emit('character.deleted', { slotIndex: slot });
  return { success: true, globalSave };
}

function restoreStorageValue(key, value) {
  return value == null ? storage.remove(key) : storage.set(key, value);
}
