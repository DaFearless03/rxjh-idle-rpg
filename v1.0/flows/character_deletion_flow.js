/**
 * @file flows/character_deletion_flow.js
 * @desc 3步角色删除流程
 * @ref 13_save.character_deletion_flow
 */
import { storage } from '../utils/storage.js';
import { SaveManager } from '../core/SaveManager.js';
import { eventBus } from '../core/EventBus.js';

/**
 * 触发删除前的二次确认信息
 * @param {number} slotIndex
 * @param {Object} characterData 角色数据（用于显示 name / level / career）
 * @returns {{ confirmBody: string, characterData }}
 */
export function getDeletionConfirmInfo(slotIndex, characterData) {
  const careerDisplay = characterData?.career || '未知职业';
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
  // 1. 清存档
  storage.remove(`player-${slotIndex}`);
  storage.remove(`player-${slotIndex}-bak`);

  // 2. 若 last_used_slot 指向被删角色 → 置 null
  if (globalSave.character_slots.last_used_slot === slotIndex) {
    globalSave.character_slots.last_used_slot = null;
  }

  // 3. unlocked_count 不回退（已解锁槽位永久保留）

  // 4. 写全局存档
  await SaveManager.saveGlobalState(globalSave);

  eventBus.emit('character.deleted', { slotIndex });
  return { success: true, globalSave };
}

/**
 * 检查是否还有任何角色存档
 * @returns {boolean}
 */
export function hasAnyCharacter() {
  return storage.keys().some(k => k.startsWith('player-') && !k.endsWith('-bak'));
}