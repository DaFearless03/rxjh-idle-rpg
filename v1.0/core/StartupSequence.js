/**
 * @file core/StartupSequence.js
 * @desc 4步启动检测
 * @ref 13_save.startup_sequence
 */
import { storage } from '../utils/storage.js?v=release-20260830-3';
import { SaveManager } from './SaveManager.js?v=release-20260830-3';

const IMPORT_MARKER = 'import_in_progress';
const IMPORT_BACKUP_KEY = 'import_backup';
const SAVE_KEY_RE = /^(?:game|player-(?:[1-9]|10)(?:-bak)?)$/;

/**
 * @param {Object} opts
 * @param {Function} opts.onFirstLaunch         首次启动回调
 * @param {Function} opts.onNoCharacter         有globalSave但无角色回调
 * @param {Function} opts.onShowMultiSaveList   显示多存档列表回调（含角色数据）
 */
export async function runStartupSequence(opts) {
  const { onFirstLaunch, onNoCharacter, onShowMultiSaveList } = opts;

  // 1) 检测 import_in_progress 脏状态
  if (storage.get(IMPORT_MARKER) === 'true') {
    const recovery = recoverInterruptedImport();
    if (recovery === 'failed') {
      throw new Error('上次存档导入中断，旧存档恢复失败；已保留现场，请勿继续写入');
    }
    if (recovery === 'missing') {
      throw new Error('上次存档导入中断，但缺少事务备份；已保留现场，请勿继续写入');
    }
    console.warn('[启动] 检测到未完成导入，已恢复导入前存档');
  }

  // 2) 检查 global_save 是否存在
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) {
    const recoveredCharacters = await loadCharactersInRange(1, 10);
    if (recoveredCharacters.length > 0) {
      const highestSlot = Math.max(...recoveredCharacters.map(character => character.slotIndex));
      const recoveredGlobalSave = SaveManager.normalizeGlobalState({
        schema_version: '1.0',
        character_slots: {
          unlocked_count: Math.max(3, highestSlot),
          last_used_slot: null,
        },
      });
      if (!recoveredGlobalSave || !await SaveManager.saveGlobalState(recoveredGlobalSave)) {
        throw new Error('已找回角色存档，但全局存档重建失败');
      }
      console.warn('[启动] 全局存档缺失或损坏，已根据角色存档重建');
      await onShowMultiSaveList({ globalSave: recoveredGlobalSave, characters: recoveredCharacters });
      return;
    }
    await onFirstLaunch();
    return;
  }

  const characters = await loadCharactersInRange(1, 10);
  if (characters.length === 0) {
    await onNoCharacter();
    return;
  }

  const highestSlot = Math.max(...characters.map(character => character.slotIndex));
  const unlockedCount = globalSave.character_slots?.unlocked_count ?? 3;
  if (highestSlot > unlockedCount) {
    globalSave.character_slots.unlocked_count = highestSlot;
    if (!await SaveManager.saveGlobalState(globalSave)) {
      throw new Error('发现未登记的角色槽位，但全局存档修复失败');
    }
    console.warn('[启动] 已恢复全局存档中遗漏的角色槽位');
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

function recoverInterruptedImport() {
  const raw = storage.get(IMPORT_BACKUP_KEY);
  if (!raw) return 'missing';

  let backup;
  try {
    backup = JSON.parse(raw);
  } catch {
    return 'failed';
  }
  if (backup?.version !== '1.0'
    || !['full', 'partial'].includes(backup.kind)
    || !Array.isArray(backup.entries)
    || backup.entries.some(entry => !Array.isArray(entry)
      || entry.length !== 2
      || !SAVE_KEY_RE.test(entry[0])
      || (entry[1] != null && typeof entry[1] !== 'string'))) {
    return 'failed';
  }

  const entries = backup.entries;
  const keep = new Set(entries.map(([key]) => key));
  if (backup.kind === 'full') {
    for (const key of storage.keys()) {
      if (SAVE_KEY_RE.test(key) && !keep.has(key) && !storage.remove(key)) {
        return 'failed';
      }
    }
  }
  for (const [key, value] of entries) {
    const restored = value == null ? storage.remove(key) : storage.set(key, value);
    if (!restored) return 'failed';
  }
  if (!entries.every(([key, value]) => storage.get(key) === value)) return 'failed';
  if (!storage.remove(IMPORT_MARKER)) return 'failed';
  if (!storage.remove(IMPORT_BACKUP_KEY)) {
    console.warn('[启动] 存档已恢复，但旧导入备份清理失败');
  }
  return 'restored';
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
  const maxSlot = globalSave.character_slots?.unlocked_count ?? 3;
  return loadCharactersInRange(1, maxSlot);
}

async function loadCharactersInRange(startSlot, endSlot) {
  const characters = [];
  for (let i = startSlot; i <= endSlot; i++) {
    const data = await SaveManager.restorePlayerFromSave(i);
    if (data) characters.push({ slotIndex: i, ...data });
  }
  return characters;
}
