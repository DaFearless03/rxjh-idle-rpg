/**
 * @file core/StartupSequence.js
 * @desc 4步启动检测
 * @ref 13_save.startup_sequence
 */
import { storage } from '../utils/storage.js';
import { SaveManager } from './SaveManager.js';

/**
 * @param {Object} opts
 * @param {Function} opts.onFirstLaunch         首次启动回调
 * @param {Function} opts.onNoCharacter         有globalSave但无角色回调
 * @param {Function} opts.onShowMultiSaveList   显示多存档列表回调（含角色数据）
 */
export function runStartupSequence(opts) {
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
    onFirstLaunch();
    return;
  }

  // 2) 检查 global_save 是否存在
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) {
    onFirstLaunch();
    return;
  }

  // 3) 检查有无 player-* 存档
  const hasPlayer = storage.keys().some(k => k.startsWith('player-') && !k.endsWith('-bak'));
  if (!hasPlayer) {
    onNoCharacter();
    return;
  }

  // 4) 校验 last_used_slot 有效性
  if (globalSave.character_slots?.last_used_slot != null) {
    const slot = globalSave.character_slots.last_used_slot;
    if (!storage.get(`player-${slot}`)) {
      globalSave.character_slots.last_used_slot = null;
      SaveManager.saveGlobalState(globalSave);
    }
  }

  // 加载所有角色数据用于显示列表
  const characters = [];
  const maxSlot = globalSave.character_slots?.unlocked_count ?? 3;
  for (let i = 1; i <= maxSlot; i++) {
    const raw = storage.get(`player-${i}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const data = parsed.data || parsed;
        characters.push({ slotIndex: i, ...data });
      } catch {
        // 损坏的存档忽略
      }
    }
  }

  onShowMultiSaveList({ globalSave, characters });
}

/**
 * 读取所有角色存档（用于 multi_save 列表）
 */
export function loadAllCharacters() {
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) return [];

  const characters = [];
  const maxSlot = globalSave.character_slots?.unlocked_count ?? 3;
  for (let i = 1; i <= maxSlot; i++) {
    const raw = storage.get(`player-${i}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const data = parsed.data || parsed;
        characters.push({ slotIndex: i, ...data });
      } catch {
        // 损坏的存档忽略
      }
    }
  }
  return characters;
}