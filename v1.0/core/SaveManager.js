/**
 * @file core/SaveManager.js
 * @desc 存档管理：save_player_state / save_global_state / restore_player_from_save
 * @ref 13_save.save_player_state / 13_save.restore_player_from_save / 13_save.redundancy
 */
import { storage } from '../utils/storage.js?v=release-20260830-1';
import { computeChecksum } from '../utils/crypto.js?v=release-20260830-1';

const SAVE_VERSION = '1.0';
const PRIMARY_KEY = (slot) => `player-${slot}`;
const SHADOW_KEY = (slot) => `player-${slot}-bak`;
const GLOBAL_KEY = 'game';

export const SaveManager = {
  /**
   * 写盘保护守卫：import_in_progress 期间所有写盘操作 no-op
   */
  _guard() {
    return storage.get('import_in_progress') === 'true';
  },

  /**
   * 保存玩家存档（双存档冗余）
   * @param {Object} player
   * @param {number} slotIndex 1..10
   */
  async savePlayerState(player, slotIndex) {
    if (this._guard()) return false;

    const now = Date.now();
    if (!player.offline) player.offline = {};
    const previousTimestamp = player.offline.last_save_timestamp;
    player.offline.last_save_timestamp = now;

    const save = this._buildPlayerSave(player, now);
    const checksum = await computeChecksum(save, SAVE_VERSION, now);
    const payload = { data: save, version: SAVE_VERSION, saved_at: now, checksum };

    const json = JSON.stringify(payload);
    const saved = this._writeRedundantPlayerPayload(slotIndex, json);
    if (!saved) player.offline.last_save_timestamp = previousTimestamp;
    return saved;
  },

  /**
   * 直接保存已反序列化的存档体，供角色列表等无运行时 player 的流程使用。
   * preserveOfflineTimestamp 用于避免列表操作重置离线收益起算时间。
   */
  async savePlayerSnapshot(saveData, slotIndex, { preserveOfflineTimestamp = false } = {}) {
    if (this._guard() || !saveData) return false;

    const now = Date.now();
    const savedAt = preserveOfflineTimestamp
      ? Number(saveData.offline?.last_save_timestamp) || now
      : now;
    const save = JSON.parse(JSON.stringify(saveData));
    save.offline = save.offline || {};
    save.offline.last_save_timestamp = savedAt;

    const checksum = await computeChecksum(save, SAVE_VERSION, savedAt);
    const payload = { data: save, version: SAVE_VERSION, saved_at: savedAt, checksum };
    const json = JSON.stringify(payload);
    return this._writeRedundantPlayerPayload(slotIndex, json);
  },

  /**
   * 同步保存（页面卸载场景专用）。
   * WebCrypto checksum 是异步的，pagehide/beforeunload 里可能跑不完；
   * 这里写 checksum:null 的快照，下次正常保存会覆盖成带校验版本。
   */
  savePlayerStateSync(player, slotIndex) {
    if (this._guard()) return false;

    const now = Date.now();
    if (!player.offline) player.offline = {};
    const previousTimestamp = player.offline.last_save_timestamp;
    player.offline.last_save_timestamp = now;

    const save = this._buildPlayerSave(player, now);
    const payload = { data: save, version: SAVE_VERSION, saved_at: now, checksum: null };
    const json = JSON.stringify(payload);
    const saved = this._writeRedundantPlayerPayload(slotIndex, json);
    if (!saved) player.offline.last_save_timestamp = previousTimestamp;
    return saved;
  },

  /**
   * 保存全局存档
   * @param {Object} globalSave
   */
  async saveGlobalState(globalSave) {
    if (this._guard()) return false;
    return storage.set(GLOBAL_KEY, JSON.stringify(globalSave));
  },

  /**
   * 恢复玩家存档（含双存档恢复逻辑）
   * @param {number} slotIndex
   * @returns {Object|null} 玩家存档数据 或 null
   */
  async restorePlayerFromSave(slotIndex) {
    const valid = await this.readValidPlayerPayload(slotIndex);
    return valid?.data || null;
  },

  /**
   * 读取带外层包装的有效存档；主存档损坏时自动使用影子副本修复。
   */
  async readValidPlayerPayload(slotIndex, { repairPrimary = true } = {}) {
    const primaryRaw = storage.get(PRIMARY_KEY(slotIndex));
    const shadowRaw = storage.get(SHADOW_KEY(slotIndex));

    const primary = await this._validatePlayerPayload(primaryRaw);
    const shadow = primary.valid ? { valid: false, data: null, raw: null } : await this._validatePlayerPayload(shadowRaw);

    if (primary.valid || shadow.valid) {
      const chosen = primary.valid ? primary : shadow;
      if (!primary.valid && shadow.valid) {
        console.warn('[存档] 检测到主存档损坏，已从影子存档恢复');
        if (repairPrimary && !storage.set(PRIMARY_KEY(slotIndex), shadow.raw)) {
          console.warn('[存档] 影子存档有效，但主存档修复写入失败');
        }
      }
      return {
        data: chosen.data,
        payload: JSON.parse(chosen.raw),
        raw: chosen.raw,
        recoveredFromShadow: !primary.valid && shadow.valid,
      };
    }

    return null;
  },

  async _validatePlayerPayload(raw) {
    if (!raw) return { valid: false, data: null, raw: null };

    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== SAVE_VERSION || !parsed.data || typeof parsed.data !== 'object') {
        return { valid: false, data: null, raw: null };
      }
      if (parsed.checksum === null) {
        return { valid: true, data: parsed.data, raw: JSON.stringify(parsed) };
      }
      const expected = await computeChecksum(parsed.data, parsed.version, parsed.saved_at);
      const valid = expected === parsed.checksum;
      return { valid, data: valid ? parsed.data : null, raw: valid ? JSON.stringify(parsed) : null };
    } catch {
      return { valid: false, data: null, raw: null };
    }
  },

  /**
   * 恢复全局存档
   * @returns {Object|null}
   */
  restoreGlobalState() {
    const raw = storage.get(GLOBAL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  _writeRedundantPlayerPayload(slotIndex, json) {
    const primaryKey = PRIMARY_KEY(slotIndex);
    const shadowKey = SHADOW_KEY(slotIndex);
    const previousPrimary = storage.get(primaryKey);
    const previousShadow = storage.get(shadowKey);
    const primaryOk = storage.set(primaryKey, json);
    const shadowOk = primaryOk && storage.set(shadowKey, json);
    if (primaryOk && shadowOk) return true;

    this._restoreStorageValue(primaryKey, previousPrimary);
    this._restoreStorageValue(shadowKey, previousShadow);
    return false;
  },

  _restoreStorageValue(key, value) {
    if (value == null) storage.remove(key);
    else storage.set(key, value);
  },

  /**
   * 构造玩家存档体（不含外层包装）
   * @param {Object} player
   */
  _buildPlayerSave(player, savedAt = Date.now()) {
    return {
      player: {
        id: player.id,
        name: player.name,
        level: player.level,
        exp: player.exp,
        career: player.career,
        career_history: player.career_history || [],
        faction: player.faction || 'neutral',
        hp: player.hp,
        mp: player.mp,
      },
      resources: {
        gold: player.resources?.gold || 0,
        training: player.resources?.training || 0,
        merit: player.resources?.merit || 0,
      },
      qigong: {
        available_points: player.qigong?.available_points ?? 1,
        invested: player.qigong?.invested || {},
        attribute_reset_count: player.qigong?.attribute_reset_count || 0,
      },
      learned_martial_arts: player.learned_martial_arts || [],
      equipped: this._copyEquipped(player.equipped),
      inventory: this._copyInventory(player.inventory),
      warehouse: this._copyInventory(player.warehouse),
      quests: {
        accepted: player.quests?.accepted || [],
        completed: player.quests?.completed || [],
      },
      location: {
        current_map_key: player.location?.current_map_key || 'town_xuanbo',
        current_sub_zone_key: player.location?.current_sub_zone_key || null,
        last_wilderness_sub_zone: player.location?.last_wilderness_sub_zone || null,
      },
      auto_play: this._copyAutoPlay(player.auto_play),
      offline: {
        last_save_timestamp: savedAt,
      },
      statistics: {
        total_kills: player.statistics?.total_kills ?? 0,
        total_playtime_ms: player.statistics?.total_playtime_ms ?? 0,
        total_gold_earned: player.statistics?.total_gold_earned ?? 0,
        total_deaths: player.statistics?.total_deaths ?? 0,
      },
    };
  },

  _copyEquipped(equipped) {
    if (!equipped) return {};
    const copy = {};
    for (const [k, v] of Object.entries(equipped)) {
      if (v === null) {
        copy[k] = v;
      } else if (Array.isArray(v)) {
        copy[k] = v.map(item => item ? { instance_id: item.instance_id } : null);
      } else if (v.instance_id) {
        copy[k] = { instance_id: v.instance_id };
      } else {
        copy[k] = v;
      }
    }
    return copy;
  },

  _copyInventory(inv) {
    return {
      capacity: inv?.capacity ?? 50,
      slots: JSON.parse(JSON.stringify(inv?.slots ?? [])),
      equipment_instances: JSON.parse(JSON.stringify(inv?.equipment_instances ?? {})),
    };
  },

  _copyAutoPlay(autoPlay) {
    const copy = JSON.parse(JSON.stringify(autoPlay || {}));
    return {
      ...copy,
      is_auto_play: copy.is_auto_play ?? false,
      auto_attack: {
        attack_type: 'normal',
        selected_skill_key: null,
        ...(copy.auto_attack || {}),
      },
      auto_consume: {
        ...copy.auto_consume,
        hp_potion: {
          enabled: true,
          selected_item_key: null,
          threshold: 0.30,
          ...(copy.auto_consume?.hp_potion || {}),
        },
        mp_potion: {
          enabled: true,
          selected_item_key: null,
          threshold: 0.30,
          ...(copy.auto_consume?.mp_potion || {}),
        },
      },
      auto_heal_skill: {
        enabled: false,
        selected_skill_key: null,
        threshold: 0.50,
        ...(copy.auto_heal_skill || {}),
      },
      auto_buff_skill: {
        enabled: false,
        selected_skill_key: null,
        ...(copy.auto_buff_skill || {}),
      },
      auto_resupply: {
        ...copy.auto_resupply,
        trigger_rules: {
          ...copy.auto_resupply?.trigger_rules,
          hp: { enabled: false, selected_potion: null, trigger_threshold: 5, ...(copy.auto_resupply?.trigger_rules?.hp || {}) },
          mp: { enabled: false, selected_potion: null, trigger_threshold: 5, ...(copy.auto_resupply?.trigger_rules?.mp || {}) },
        },
        purchase_rules: {
          ...copy.auto_resupply?.purchase_rules,
          hp: { enabled: false, selected_potion: null, target_quantity: 10, ...(copy.auto_resupply?.purchase_rules?.hp || {}) },
          mp: { enabled: false, selected_potion: null, target_quantity: 10, ...(copy.auto_resupply?.purchase_rules?.mp || {}) },
        },
      },
      auto_sell: {
        ...copy.auto_sell,
        enabled: copy.auto_sell?.enabled ?? false,
        categories: copy.auto_sell?.categories || {},
        equipment: {
          ...copy.auto_sell?.equipment,
          enabled: copy.auto_sell?.equipment?.enabled ?? false,
          item_keys: copy.auto_sell?.equipment?.item_keys || [],
        },
      },
      auto_store: {
        ...copy.auto_store,
        enabled: copy.auto_store?.enabled ?? false,
        stones: {
          ...copy.auto_store?.stones,
          rules: copy.auto_store?.stones?.rules || [],
        },
        equipment: {
          ...copy.auto_store?.equipment,
          item_keys: copy.auto_store?.equipment?.item_keys || [],
        },
      },
    };
  },

  GLOBAL_KEY: () => GLOBAL_KEY,
  PLAYER_KEY: (slot) => PRIMARY_KEY(slot),
};
