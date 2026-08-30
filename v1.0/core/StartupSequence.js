/**
 * @file core/StartupSequence.js
 * @desc 4步启动检测
 * @ref 13_save.startup_sequence
 */
import { storage } from '../utils/storage.js?v=release-20260830-1';
import { SaveManager } from './SaveManager.js?v=release-20260830-1';

/**
 * @param {Object} opts
 * @param {Function} opts.onFirstLaunch         首次启动回调
 * @param {Function} opts.onNoCharacter         有globalSave但无角色回调
 * @param {Function} opts.onShowMultiSaveList   显示多存档列表回调（含角色数据）
 */
export async function runStartupSequence(opts) {
  const { onFirstLaunch, onNoCharacter, onShowMultiSaveList } = opts;

  // 1) 检测 import_in_progress 脏状态
  if (storage.get('import_in_progress') === 'true') {
    // 清空所有脏数据
    for (const key of storage.keys()) {
      if (key.startsWith('player-') || key === 'game' || key === 'import_in_progress') {
        storage.remove(key);
      }
    }
    console.warn('[启动] 上次导入未完成，存档已重置');
    await onFirstLaunch();
    return;
  }

  // 2) 检查 global_save 是否存在
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) {
    await onFirstLaunch();
    return;
  }

  const characters = await loadCharacters(globalSave);
  if (characters.length === 0) {
    await onNoCharacter();
    return;
  }

  // 4) 校验 last_used_slot 有效性
  if (globalSave.character_slots?.last_used_slot != null) {
    const slot = globalSave.character_slots.last_used_slot;
    if (!characters.some(character => character.slotIndex === slot)) {
      globalSave.character_slots.last_used_slot = null;
      if (!await SaveManager.saveGlobalState(globalSave)) {
        console.warn('[启动] 无效的最近角色槽位未能写回存档');
      }
    }
  }

  await onShowMultiSaveList({ globalSave, characters });
}

/**
 * 读取所有角色存档（用于 multi_save 列表）
 */
export async function loadAllCharacters() {
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) return [];
  return loadCharacters(globalSave);
}

async function loadCharacters(globalSave) {
  const characters = [];
  const maxSlot = globalSave.character_slots?.unlocked_count ?? 3;
  for (let i = 1; i <= maxSlot; i++) {
    const data = await SaveManager.restorePlayerFromSave(i);
    if (data) characters.push({ slotIndex: i, ...data });
  }
  return characters;
}
