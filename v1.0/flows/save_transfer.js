/**
 * @file flows/save_transfer.js
 * @desc 导出 base64 / 全量导入 / 单角色导入 / import_in_progress 事务
 * @ref 13_save.save_transfer
 */
import { storage } from '../utils/storage.js';
import { base64Encode, base64Decode } from '../utils/crypto.js';
import { SaveManager } from '../core/SaveManager.js';

const SAVE_VERSION = '1.0';

/**
 * 导出存档
 * @param {Object} opts
 * @param {boolean} opts.include_all_characters  true=导出全部+global；false=仅当前角色
 * @returns {string|null} base64 字符串或 null
 */
export function exportSave(opts = {}) {
  const { include_all_characters = true } = opts;
  const exportMeta = {
    schema_version: SAVE_VERSION,
    exported_at: new Date().toISOString(),
    source_device_id: 'v1.0-client',
  };

  if (include_all_characters) {
    // 导出全部角色 + global
    const globalSave = SaveManager.restoreGlobalState();
    const players = {};
    for (const key of storage.keys()) {
      if (key.startsWith('player-') && !key.endsWith('-bak')) {
        const raw = storage.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          // 去掉外层包装，只取 data
          players[key] = parsed.data || parsed;
        }
      }
    }
    const pack = { game: globalSave, players, export_meta: exportMeta };
    return base64Encode(pack);
  } else {
    // 仅当前角色
    const globalSave = SaveManager.restoreGlobalState();
    const slot = globalSave?.character_slots?.last_used_slot;
    if (!slot) return null;
    const raw = storage.get(`player-${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const playerData = parsed.data || parsed;
    const pack = { player: { slot_index: slot, data: playerData }, export_meta: exportMeta };
    return base64Encode(pack);
  }
}

/**
 * 导入存档
 * @param {string} base64Str
 * @returns {{ success: boolean, message: string }}
 */
export async function importSave(base64Str) {
  let pack;
  try {
    pack = base64Decode(base64Str);
    if (!pack) return { success: false, message: '存档包损坏（base64解码失败）' };
  } catch {
    return { success: false, message: '存档包损坏（JSON解析失败）' };
  }

  // 校验 schema_version
  const version = pack.export_meta?.schema_version;
  if (version !== SAVE_VERSION) {
    // v1.0 不做迁移，直接拒绝
    return { success: false, message: `存档版本不匹配（导出:${version} / 当前:${SAVE_VERSION}）` };
  }

  const includeAll = pack.players != null; // 通过有无 players 字段判断是否全量包

  if (includeAll) {
    return fullReplaceActions(pack);
  } else {
    return partialReplaceActions(pack);
  }
}

/**
 * 全量导入（5步 + import_in_progress 事务标记）
 */
async function fullReplaceActions(pack) {
  // 1. 校验版本
  if (pack.export_meta?.schema_version !== SAVE_VERSION) {
    return { success: false, message: '版本不匹配' };
  }

  // 1.5 写入事务标记
  storage.set('import_in_progress', 'true');

  try {
    // 2. 清空当前所有 player-* + game key
    for (const key of [...storage.keys()]) {
      if (key.startsWith('player-') || key === 'game') {
        storage.remove(key);
      }
    }

    // 3. 写入导入包
    if (pack.game) {
      storage.set('game', JSON.stringify(pack.game));
    }
    if (pack.players) {
      for (const [key, data] of Object.entries(pack.players)) {
        storage.set(key, JSON.stringify(data));
      }
    }

    // 4. last_used_slot 沿用导入包（若指向不存在角色则置 null）
    if (pack.game?.character_slots?.last_used_slot != null) {
      const slot = pack.game.character_slots.last_used_slot;
      if (!storage.get(`player-${slot}`)) {
        pack.game.character_slots.last_used_slot = null;
        storage.set('game', JSON.stringify(pack.game));
      }
    }
  } finally {
    // 5. 清除事务标记
    storage.remove('import_in_progress');
  }

  return { success: true, message: '导入成功，请刷新页面' };
}

/**
 * 单角色导入（无事务标记）
 */
function partialReplaceActions(pack) {
  // 1. 校验版本
  if (pack.export_meta?.schema_version !== SAVE_VERSION) {
    return { success: false, message: '版本不匹配' };
  }

  // 2. 校验目标槽位
  const targetSlot = pack.player?.slot_index;
  const globalSave = SaveManager.restoreGlobalState();
  const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
  if (!targetSlot || targetSlot < 1 || targetSlot > unlocked) {
    return { success: false, message: '目标槽位未解锁，请先在游戏中解锁该栏位' };
  }

  // 3. 仅替换对应槽位
  const playerData = pack.player?.data;
  if (!playerData) return { success: false, message: '角色数据无效' };
  storage.set(`player-${targetSlot}`, JSON.stringify(playerData));

  return { success: true, message: '角色导入成功' };
}