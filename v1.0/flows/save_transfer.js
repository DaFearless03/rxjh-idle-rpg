/**
 * @file flows/save_transfer.js
 * @desc 导出 base64 / 全量导入 / 单角色导入 / import_in_progress 事务
 * @ref 13_save.save_transfer
 */
import { storage } from '../utils/storage.js';
import { base64Encode, base64Decode, computeChecksum } from '../utils/crypto.js';
import { SaveManager } from '../core/SaveManager.js';

const SAVE_VERSION = '1.0';
const PLAYER_KEY_RE = /^player-\d+$/;

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
    for (const key of storage.keys().filter(k => PLAYER_KEY_RE.test(k)).sort(sortPlayerKeys)) {
      if (PLAYER_KEY_RE.test(key)) {
        const raw = storage.get(key);
        if (raw) {
          players[key] = JSON.parse(raw);
        }
      }
    }
    const pack = { include_all_characters: true, game: globalSave, players, export_meta: exportMeta };
    return base64Encode(pack);
  } else {
    // 仅当前角色
    const globalSave = SaveManager.restoreGlobalState();
    const slot = globalSave?.character_slots?.last_used_slot;
    if (!slot) return null;
    const raw = storage.get(`player-${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pack = { include_all_characters: false, player: { slot_index: slot, data: parsed }, export_meta: exportMeta };
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
  if (!pack.game || typeof pack.game !== 'object') {
    return { success: false, message: '全量存档包缺少全局存档' };
  }
  if (!pack.players || typeof pack.players !== 'object') {
    return { success: false, message: '全量存档包缺少角色存档' };
  }

  const normalizedPlayers = {};
  for (const [key, data] of Object.entries(pack.players)) {
    if (!PLAYER_KEY_RE.test(key)) continue;
    const normalized = await normalizePlayerPayload(data);
    if (!normalized.success) {
      return { success: false, message: `${key} ${normalized.message}` };
    }
    normalizedPlayers[key] = normalized.payload;
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
    for (const [key, payload] of Object.entries(normalizedPlayers)) {
      const json = JSON.stringify(payload);
      storage.set(key, json);
      storage.set(`${key}-bak`, json);
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
async function partialReplaceActions(pack) {
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
  const normalized = await normalizePlayerPayload(playerData);
  if (!normalized.success) return { success: false, message: normalized.message };
  const json = JSON.stringify(normalized.payload);
  storage.set(`player-${targetSlot}`, json);
  storage.set(`player-${targetSlot}-bak`, json);

  return { success: true, message: '角色导入成功' };
}

function sortPlayerKeys(a, b) {
  return Number(a.split('-')[1]) - Number(b.split('-')[1]);
}

function isWrappedPlayerPayload(payload) {
  return payload
    && typeof payload === 'object'
    && payload.data
    && payload.version
    && payload.saved_at
    && payload.checksum;
}

async function normalizePlayerPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { success: false, message: '角色数据无效' };
  }

  if (isWrappedPlayerPayload(payload)) {
    if (payload.version !== SAVE_VERSION) {
      return { success: false, message: `角色存档版本不匹配（导出:${payload.version} / 当前:${SAVE_VERSION}）` };
    }
    const expected = await computeChecksum(payload.data, payload.version, payload.saved_at);
    if (expected !== payload.checksum) {
      return { success: false, message: '角色存档校验失败' };
    }
    return { success: true, payload };
  }

  // 兼容旧导出包：旧实现只导出了 data，导入前补回 SaveManager 外层包装。
  if (!payload.player || !payload.resources || !payload.location) {
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
