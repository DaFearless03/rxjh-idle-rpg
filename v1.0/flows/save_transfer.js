/**
 * @file flows/save_transfer.js
 * @desc 导出 base64 / 全量导入 / 单角色导入 / import_in_progress 事务
 * @ref 13_save.save_transfer
 */
import { storage } from '../utils/storage.js?v=release-20260830-3';
import { base64Encode, base64Decode, computeChecksum } from '../utils/crypto.js?v=release-20260830-3';
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-3';

const SAVE_VERSION = '1.0';
const PLAYER_KEY_RE = /^player-([1-9]|10)$/;
const SAVE_KEY_RE = /^(?:game|player-(?:[1-9]|10)(?:-bak)?)$/;
const IMPORT_MARKER = 'import_in_progress';
const IMPORT_BACKUP_KEY = 'import_backup';
const MAX_IMPORT_TEXT_LENGTH = 32 * 1024 * 1024;

/**
 * 导出存档
 * @param {Object} opts
 * @param {boolean} opts.include_all_characters  true=导出全部+global；false=仅当前角色
 * @returns {Promise<string|null>} base64 字符串或 null
 */
export async function exportSave(opts = {}) {
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
    const skippedSlots = [];
    const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
    for (let slot = 1; slot <= unlocked; slot++) {
      const key = `player-${slot}`;
      const valid = await SaveManager.readValidPlayerPayload(slot);
      if (valid) {
        players[key] = valid.payload;
      } else if (storage.get(key) || storage.get(`${key}-bak`)) {
        skippedSlots.push(slot);
      }
    }
    if (skippedSlots.length > 0) {
      console.warn(`[导出] 已跳过无法恢复的损坏槽位：${skippedSlots.join(', ')}`);
      exportMeta.skipped_slots = skippedSlots;
    }
    const pack = { include_all_characters: true, game: globalSave, players, export_meta: exportMeta };
    return base64Encode(pack);
  } else {
    // 仅当前角色
    const globalSave = SaveManager.restoreGlobalState();
    const slot = globalSave?.character_slots?.last_used_slot;
    if (!slot) return null;
    const valid = await SaveManager.readValidPlayerPayload(slot);
    if (!valid) return null;
    const pack = { include_all_characters: false, player: { slot_index: slot, data: valid.payload }, export_meta: exportMeta };
    return base64Encode(pack);
  }
}

/**
 * 导入存档
 * @param {string} base64Str
 * @returns {{ success: boolean, message: string }}
 */
export async function importSave(base64Str) {
  if (typeof base64Str !== 'string' || !base64Str || base64Str.length > MAX_IMPORT_TEXT_LENGTH) {
    return { success: false, message: '存档文本为空或超出大小限制' };
  }
  let pack;
  try {
    pack = base64Decode(base64Str);
    if (!pack) return { success: false, message: '存档包损坏（base64解码失败）' };
  } catch {
    return { success: false, message: '存档包损坏（JSON解析失败）' };
  }

  // 校验 schema_version
  if (!pack.export_meta) {
    return { success: false, message: '存档包损坏（缺少导出信息）' };
  }

  const version = pack.export_meta.schema_version;
  if (version !== SAVE_VERSION) {
    // v1.0 不做迁移，直接拒绝
    return { success: false, message: `存档版本不匹配（导出:${version} / 当前:${SAVE_VERSION}）` };
  }

  const includeAll = pack.include_all_characters === true || (pack.include_all_characters == null && pack.players != null);

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
  const normalizedGame = normalizeImportedGlobalState(pack.game);
  if (!normalizedGame) {
    return { success: false, message: '全量存档包缺少全局存档' };
  }
  if (!pack.players || typeof pack.players !== 'object' || Array.isArray(pack.players)) {
    return { success: false, message: '全量存档包缺少角色存档' };
  }

  const normalizedPlayers = {};
  const playerIds = new Set();
  for (const [key, data] of Object.entries(pack.players)) {
    const match = key.match(PLAYER_KEY_RE);
    if (!match) return { success: false, message: `角色槽位键无效：${key}` };
    if (Number(match[1]) > normalizedGame.character_slots.unlocked_count) {
      return { success: false, message: `${key} 超出已解锁槽位范围` };
    }
    const normalized = await normalizePlayerPayload(data);
    if (!normalized.success) {
      return { success: false, message: `${key} ${normalized.message}` };
    }
    const playerId = normalized.payload.data.player.id;
    if (playerIds.has(playerId)) {
      return { success: false, message: `角色 ID 重复：${playerId}` };
    }
    playerIds.add(playerId);
    normalizedPlayers[key] = normalized.payload;
  }

  const backupEntries = captureSaveEntries();

  // 1.5 写入事务标记
  if (!beginImportTransaction('full', backupEntries)) {
    return { success: false, message: '导入失败：无法建立事务标记' };
  }
  SaveManager.invalidatePendingPlayerWrites();

  // 2. 清空当前所有 player-* + game key
  for (const key of [...storage.keys()]) {
    if (SAVE_KEY_RE.test(key)) {
      if (!storage.remove(key)) {
        return rollbackFullImport(backupEntries, '导入失败：无法清理旧存档');
      }
    }
  }

  // 3. 写入导入包
  if (!storage.set('game', JSON.stringify(normalizedGame))) {
    return rollbackFullImport(backupEntries, '导入失败：全局存档写入失败（存储空间不足？）');
  }
  for (const [key, payload] of Object.entries(normalizedPlayers)) {
    const json = JSON.stringify(payload);
    if (!storage.set(key, json) || !storage.set(`${key}-bak`, json)) {
      return rollbackFullImport(backupEntries, '导入失败：角色存档写入失败（存储空间不足？）');
    }
  }

  // 4. last_used_slot 沿用导入包（若指向不存在角色则置 null）
  if (normalizedGame.character_slots.last_used_slot != null) {
    const slot = normalizedGame.character_slots.last_used_slot;
    if (!storage.get(`player-${slot}`)) {
      normalizedGame.character_slots.last_used_slot = null;
      if (!storage.set('game', JSON.stringify(normalizedGame))) {
        return rollbackFullImport(backupEntries, '导入失败：全局存档写入失败（存储空间不足？）');
      }
    }
  }

  // 5. 清除事务标记；清理失败时恢复原存档，避免下次启动误清空导入结果。
  if (!finishImportTransaction()) {
    return rollbackFullImport(backupEntries, '导入失败：无法结束导入事务');
  }
  return { success: true, message: '导入成功，请刷新页面' };
}

/**
 * 单角色导入：仅替换目标槽位，失败时回滚目标槽位主备存档。
 */
async function partialReplaceActions(pack) {
  // 1. 校验版本
  if (pack.export_meta?.schema_version !== SAVE_VERSION) {
    return { success: false, message: '版本不匹配' };
  }

  // 2. 校验目标槽位
  const targetSlot = Number(pack.player?.slot_index);
  const globalSave = SaveManager.restoreGlobalState();
  if (!globalSave) {
    return { success: false, message: '请先初始化游戏存档，再导入单个角色' };
  }
  const unlocked = globalSave.character_slots.unlocked_count;
  if (!Number.isInteger(targetSlot) || targetSlot < 1 || targetSlot > unlocked) {
    return { success: false, message: '目标槽位未解锁，请先在游戏中解锁该栏位' };
  }

  // 3. 仅替换对应槽位
  const playerData = pack.player?.data;
  if (!playerData) return { success: false, message: '角色数据无效' };
  const normalized = await normalizePlayerPayload(playerData);
  if (!normalized.success) return { success: false, message: normalized.message };
  const importedPlayerId = normalized.payload.data.player.id;
  for (let slot = 1; slot <= unlocked; slot++) {
    if (slot === targetSlot) continue;
    const existing = await SaveManager.restorePlayerFromSave(slot);
    if (existing?.player?.id === importedPlayerId) {
      return { success: false, message: `该角色已存在于第 ${slot} 号位` };
    }
  }
  const json = JSON.stringify(normalized.payload);

  const primaryKey = `player-${targetSlot}`;
  const shadowKey = `${primaryKey}-bak`;
  const previousPrimary = storage.get(primaryKey);
  const previousShadow = storage.get(shadowKey);
  const backupEntries = [
    [primaryKey, previousPrimary],
    [shadowKey, previousShadow],
  ];
  if (!beginImportTransaction('partial', backupEntries)) {
    return { success: false, message: '导入失败：无法建立事务标记' };
  }
  SaveManager.invalidatePendingPlayerWrites(targetSlot);
  const primaryOk = storage.set(primaryKey, json);
  const shadowOk = primaryOk ? storage.set(shadowKey, json) : false;
  if (!primaryOk || !shadowOk) {
    return rollbackPartialImport(
      primaryKey,
      previousPrimary,
      shadowKey,
      previousShadow,
      '存档写入失败（存储空间不足？）',
    );
  }
  if (!finishImportTransaction()) {
    return rollbackPartialImport(
      primaryKey,
      previousPrimary,
      shadowKey,
      previousShadow,
      '导入失败：无法结束导入事务',
    );
  }

  return { success: true, message: '角色导入成功' };
}

function restoreSlotBackup(key, value) {
  return value == null ? storage.remove(key) : storage.set(key, value);
}

function captureSaveEntries() {
  return storage.keys()
    .filter(key => SAVE_KEY_RE.test(key))
    .map(key => [key, storage.get(key)]);
}

function beginImportTransaction(kind, entries) {
  if (storage.get(IMPORT_MARKER) === 'true') return false;
  const backup = JSON.stringify({ version: SAVE_VERSION, kind, entries });
  if (!storage.set(IMPORT_BACKUP_KEY, backup)) return false;
  if (storage.set(IMPORT_MARKER, 'true')) return true;
  storage.remove(IMPORT_BACKUP_KEY);
  return false;
}

function finishImportTransaction() {
  if (!storage.remove(IMPORT_MARKER)) return false;
  if (!storage.remove(IMPORT_BACKUP_KEY)) {
    console.warn('[导入] 导入已完成，但旧事务备份清理失败');
  }
  return true;
}

function restoreSaveEntries(entries) {
  const keep = new Set(entries.map(([key]) => key));
  let restored = true;
  for (const key of [...storage.keys()]) {
    if (SAVE_KEY_RE.test(key) && !keep.has(key)) {
      restored = storage.remove(key) && restored;
    }
  }
  for (const [key, value] of entries) {
    restored = restoreSlotBackup(key, value) && restored;
  }
  return restored && entries.every(([key, value]) => storage.get(key) === value);
}

function rollbackFullImport(backupEntries, message) {
  const restored = restoreSaveEntries(backupEntries);
  const markerRemoved = restored && storage.remove(IMPORT_MARKER);
  if (markerRemoved) storage.remove(IMPORT_BACKUP_KEY);
  return {
    success: false,
    message: restored && markerRemoved ? message : `${message}；旧存档回滚不完整，将在下次启动清理脏状态`,
  };
}

function rollbackPartialImport(primaryKey, previousPrimary, shadowKey, previousShadow, message) {
  const primaryRestored = restoreSlotBackup(primaryKey, previousPrimary);
  const shadowRestored = restoreSlotBackup(shadowKey, previousShadow);
  const restored = primaryRestored && shadowRestored
    && storage.get(primaryKey) === previousPrimary
    && storage.get(shadowKey) === previousShadow;
  const markerRemoved = restored && storage.remove(IMPORT_MARKER);
  if (markerRemoved) storage.remove(IMPORT_BACKUP_KEY);
  return {
    success: false,
    message: restored && markerRemoved ? message : `${message}；旧存档回滚不完整，将在下次启动清理脏状态`,
  };
}

function isWrappedPlayerPayload(payload) {
  return payload
    && typeof payload === 'object'
    && Object.prototype.hasOwnProperty.call(payload, 'data')
    && Object.prototype.hasOwnProperty.call(payload, 'version')
    && Object.prototype.hasOwnProperty.call(payload, 'saved_at')
    && Object.prototype.hasOwnProperty.call(payload, 'checksum');
}

async function normalizePlayerPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { success: false, message: '角色数据无效' };
  }

  if (isWrappedPlayerPayload(payload)) {
    if (payload.version !== SAVE_VERSION) {
      return { success: false, message: `角色存档版本不匹配（导出:${payload.version} / 当前:${SAVE_VERSION}）` };
    }
    const savedAt = Number(payload.saved_at);
    if (!Number.isSafeInteger(savedAt) || savedAt <= 0 || !SaveManager.isValidPlayerSaveData(payload.data)) {
      return { success: false, message: '角色数据结构无效' };
    }
    const checksum = await computeChecksum(payload.data, payload.version, payload.saved_at);
    if (payload.checksum !== null && checksum !== payload.checksum) {
      return { success: false, message: '角色存档校验失败' };
    }
    return {
      success: true,
      payload: {
        data: payload.data,
        version: payload.version,
        saved_at: payload.saved_at,
        checksum,
      },
    };
  }

  // 兼容旧导出包：旧实现只导出了 data，导入前补回 SaveManager 外层包装。
  if (!SaveManager.isValidPlayerSaveData(payload)) {
    return { success: false, message: '角色数据结构无效' };
  }

  const savedAt = payload.offline?.last_save_timestamp || Date.now();
  const checksum = await computeChecksum(payload, SAVE_VERSION, savedAt);
  return {
    success: true,
    payload: {
      data: payload,
      version: SAVE_VERSION,
      saved_at: savedAt,
      checksum,
    },
  };
}

function normalizeImportedGlobalState(globalSave) {
  const rawUnlocked = Number(globalSave?.character_slots?.unlocked_count);
  if (!Number.isInteger(rawUnlocked) || rawUnlocked < 1 || rawUnlocked > 10) return null;
  return SaveManager.normalizeGlobalState(globalSave);
}
