/**
 * @file core/SaveManager.js
 * @desc 存档管理：save_player_state / save_global_state / restore_player_from_save
 * @ref 13_save.save_player_state / 13_save.restore_player_from_save / 13_save.redundancy
 */
import { storage } from '../utils/storage.js';
import { computeChecksum } from '../utils/crypto.js';

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
    if (this._guard()) return;

    const now = Date.now();
    if (!player.offline) player.offline = {};
    player.offline.last_save_timestamp = now;

    const save = this._buildPlayerSave(player, now);
    const checksum = await computeChecksum(save, SAVE_VERSION, now);
    const payload = { data: save, version: SAVE_VERSION, saved_at: now, checksum };

    const json = JSON.stringify(payload);
    storage.set(PRIMARY_KEY(slotIndex), json);
    storage.set(SHADOW_KEY(slotIndex), json);
  },

  /**
   * 保存全局存档
   * @param {Object} globalSave
   */
  async saveGlobalState(globalSave) {
    if (this._guard()) return;
    storage.set(GLOBAL_KEY, JSON.stringify(globalSave));
  },

  /**
   * 恢复玩家存档（含双存档恢复逻辑）
   * @param {number} slotIndex
   * @returns {Object|null} 玩家存档数据 或 null
   */
  async restorePlayerFromSave(slotIndex) {
    const primaryRaw = storage.get(PRIMARY_KEY(slotIndex));
    const shadowRaw = storage.get(SHADOW_KEY(slotIndex));

    const primary = await this._validatePlayerPayload(primaryRaw);
    const shadow = primary.valid ? { valid: false, data: null, raw: null } : await this._validatePlayerPayload(shadowRaw);

    if (primary.valid || shadow.valid) {
      // 用 primary 恢复后把 shadow 同步为一致（只有 shadow 可用时提示用户）
      if (!primary.valid && shadow.valid) {
        console.warn('[存档] 检测到主存档损坏，已从影子存档恢复');
        storage.set(PRIMARY_KEY(slotIndex), shadow.raw);
      }
      return primary.valid ? primary.data : shadow.data;
    }

    return null;
  },

  async _validatePlayerPayload(raw) {
    if (!raw) return { valid: false, data: null, raw: null };

    try {
      const parsed = JSON.parse(raw);
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
      auto_play: {
        is_auto_play: player.auto_play?.is_auto_play ?? false,
        auto_consume: {
          hp_potion: {
            enabled: player.auto_play?.auto_consume?.hp_potion?.enabled ?? true,
            selected_item_key: player.auto_play?.auto_consume?.hp_potion?.selected_item_key ?? null,
            threshold: player.auto_play?.auto_consume?.hp_potion?.threshold ?? 0.30,
          },
          mp_potion: {
            enabled: player.auto_play?.auto_consume?.mp_potion?.enabled ?? true,
            selected_item_key: player.auto_play?.auto_consume?.mp_potion?.selected_item_key ?? null,
            threshold: player.auto_play?.auto_consume?.mp_potion?.threshold ?? 0.30,
          },
        },
        auto_heal_skill: {
          enabled: player.auto_play?.auto_heal_skill?.enabled ?? false,
          selected_skill_key: player.auto_play?.auto_heal_skill?.selected_skill_key ?? null,
        },
        auto_resupply: {
          trigger_rules: {
            hp: player.auto_play?.auto_resupply?.trigger_rules?.hp ?? { enabled: false, selected_potion: null, trigger_threshold: 5 },
            mp: player.auto_play?.auto_resupply?.trigger_rules?.mp ?? { enabled: false, selected_potion: null, trigger_threshold: 5 },
          },
          purchase_rules: {
            hp: player.auto_play?.auto_resupply?.purchase_rules?.hp ?? { enabled: false, selected_potion: null, target_quantity: 10 },
            mp: player.auto_play?.auto_resupply?.purchase_rules?.mp ?? { enabled: false, selected_potion: null, target_quantity: 10 },
          },
        },
      },
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

  GLOBAL_KEY: () => GLOBAL_KEY,
  PLAYER_KEY: (slot) => PRIMARY_KEY(slot),
};
