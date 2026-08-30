/**
 * @file core/SaveManager.js
 * @desc 存档管理：save_player_state / save_global_state / restore_player_from_save
 * @ref 13_save.save_player_state / 13_save.restore_player_from_save / 13_save.redundancy
 */
import { storage } from '../utils/storage.js?v=release-20260830-3';
import { computeChecksum } from '../utils/crypto.js?v=release-20260830-3';

const SAVE_VERSION = '1.0';
const PRIMARY_KEY = (slot) => `player-${slot}`;
const SHADOW_KEY = (slot) => `player-${slot}-bak`;
const GLOBAL_KEY = 'game';
const MAX_CONTAINER_CAPACITY = 1000;
const MAX_COLLECTION_SIZE = 10000;

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value, maxLength = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isSafeIdentifier(value, maxLength = 256) {
  return isNonEmptyString(value, maxLength) && /^[A-Za-z0-9_.:-]+$/.test(value);
}

function isSafeText(value, maxLength = 5000) {
  return typeof value === 'string' && value.length <= maxLength && !/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function isNonNegativeFinite(value) {
  return Number.isFinite(value) && value >= 0;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isIdentifierArray(value, maxLength = MAX_COLLECTION_SIZE) {
  return Array.isArray(value)
    && value.length <= maxLength
    && value.every(item => isSafeIdentifier(item));
}

function hasUniqueValues(value) {
  return Array.isArray(value) && new Set(value).size === value.length;
}

function isPositiveIntegerLike(value, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= max;
}

function validateQuestInstance(quest) {
  if (!isRecord(quest) || !isSafeIdentifier(quest.key)) return false;
  if (quest.type != null && !isSafeIdentifier(quest.type)) return false;
  if (quest.name != null && !isSafeText(quest.name, 256)) return false;
  if (quest.description != null && !isSafeText(quest.description)) return false;
  if (quest.faction != null && !['neutral', 'positive', 'negative'].includes(quest.faction)) return false;
  if (quest.required_transfer != null && !isNonNegativeSafeInteger(quest.required_transfer)) return false;
  if (quest.target_transfer != null && !isPositiveIntegerLike(quest.target_transfer, 1000)) return false;
  if (quest.prerequisite != null
    && (!isRecord(quest.prerequisite) || !isPositiveIntegerLike(quest.prerequisite.level, 1000))) return false;
  if (!isPositiveIntegerLike(quest.current_stage, 1000)) return false;
  if (!Array.isArray(quest.completed_stages)
    || quest.completed_stages.length > 1000
    || !quest.completed_stages.every(stage => isPositiveIntegerLike(stage, 1000))) return false;
  if (!Array.isArray(quest.objectives) || quest.objectives.length > 1000) return false;
  for (const objective of quest.objectives) {
    if (!isRecord(objective) || !isPositiveIntegerLike(objective.stage, 1000)) return false;
    if (objective.name != null && !isSafeText(objective.name, 256)) return false;
    if (!Array.isArray(objective.items) || objective.items.length > 1000) return false;
    for (const item of objective.items) {
      if (!isRecord(item)
        || !isSafeIdentifier(item.item_key)
        || !isPositiveIntegerLike(item.count)) return false;
      if (item.item_name != null && !isSafeText(item.item_name, 256)) return false;
      if (item.drop_monster != null && !isSafeIdentifier(item.drop_monster)) return false;
    }
  }
  if (!Array.isArray(quest.rewards) || quest.rewards.length > 1000) return false;
  for (const reward of quest.rewards) {
    if (!isRecord(reward) || !isSafeIdentifier(reward.type)) return false;
    if (reward.careers != null && !isIdentifierArray(reward.careers, 100)) return false;
    if (reward.faction != null && !['neutral', 'positive', 'negative'].includes(reward.faction)) return false;
    if (reward.amount != null && !isNonNegativeSafeInteger(reward.amount)) return false;
  }
  if (quest.dialogue != null) {
    if (!isRecord(quest.dialogue)
      || Object.values(quest.dialogue).some(value => !isSafeText(value))) return false;
  }
  if (quest.stage_advance_notified != null && typeof quest.stage_advance_notified !== 'boolean') return false;
  if (quest.accepted_at != null && (!Number.isSafeInteger(quest.accepted_at) || quest.accepted_at <= 0)) return false;
  return true;
}

function getEquippedInstanceId(value) {
  if (typeof value === 'string') return isSafeIdentifier(value) ? value : null;
  if (!isRecord(value)) return null;
  return isSafeIdentifier(value.instance_id) ? value.instance_id : null;
}

function collectEquippedInstanceIds(equipped, equipmentInstances) {
  if (!isRecord(equipped)) return null;
  const multiSlots = new Set(['gloves', 'ring', 'earring']);
  const validSlots = new Set([
    'weapon', 'chest', 'gloves', 'boots', 'inner_armor',
    'ring', 'amulet', 'earring', 'cape',
  ]);
  const seen = new Set();

  for (const [slot, value] of Object.entries(equipped)) {
    if (!validSlots.has(slot)) return null;
    const entries = multiSlots.has(slot)
      ? (Array.isArray(value) && value.length <= 2 ? value : null)
      : (!Array.isArray(value) ? [value] : null);
    if (!entries) return null;
    for (const entry of entries) {
      if (entry == null) continue;
      const instanceId = getEquippedInstanceId(entry);
      if (!instanceId || seen.has(instanceId) || !isRecord(equipmentInstances?.[instanceId])) return null;
      seen.add(instanceId);
    }
  }
  return seen;
}

function validateContainer(container, equippedInstanceIds = new Set()) {
  if (!isRecord(container)) return false;
  if (!Number.isSafeInteger(container.capacity)
    || container.capacity < 1
    || container.capacity > MAX_CONTAINER_CAPACITY) return false;
  if (!Array.isArray(container.slots)
    || container.slots.length > container.capacity
    || container.slots.length > MAX_COLLECTION_SIZE) return false;
  if (!isRecord(container.equipment_instances)
    || Object.keys(container.equipment_instances).length > MAX_COLLECTION_SIZE) return false;

  const slottedInstances = new Map();
  for (const slot of container.slots) {
    if (!isRecord(slot)) return false;
    const itemKey = slot.item_key;
    const instanceId = slot.instance_id;
    const count = slot.count;
    if (!isNonNegativeSafeInteger(count)) return false;
    if (instanceId == null && count > 999) return false;
    if (itemKey != null && !isSafeIdentifier(itemKey)) return false;
    if (instanceId != null && !isSafeIdentifier(instanceId)) return false;
    if (count === 0 && (itemKey != null || instanceId != null)) return false;
    if (count > 0 && !isSafeIdentifier(itemKey)) return false;
    if (instanceId != null) {
      if (count !== 1 || slottedInstances.has(instanceId)) return false;
      slottedInstances.set(instanceId, itemKey);
    }
  }

  for (const [instanceId, instance] of Object.entries(container.equipment_instances)) {
    if (!isSafeIdentifier(instanceId) || !isRecord(instance)) return false;
    if (instance.instance_id !== instanceId || !isSafeIdentifier(instance.item_key)) return false;
    if (!isNonNegativeSafeInteger(instance.enhance_level) || instance.enhance_level > 10) return false;
    if (!Array.isArray(instance.synthesis_slots)
      || instance.synthesis_slots.length > 4
      || !instance.synthesis_slots.every(stone => stone == null || isSafeIdentifier(stone))) return false;
    if (instance.desc != null && !isSafeText(instance.desc)) return false;
    if (instance.extra != null) {
      if (!isRecord(instance.extra) || Object.keys(instance.extra).length > 100) return false;
      for (const [key, value] of Object.entries(instance.extra)) {
        if (!isSafeIdentifier(key) || !Number.isFinite(value)) return false;
      }
    }
  }
  for (const [instanceId, itemKey] of slottedInstances) {
    if (container.equipment_instances[instanceId]?.item_key !== itemKey) return false;
  }
  for (const instanceId of Object.keys(container.equipment_instances)) {
    const slotted = slottedInstances.has(instanceId);
    const equipped = equippedInstanceIds.has(instanceId);
    if (slotted === equipped) return false;
  }
  return true;
}

function isOptionalIdentifier(value) {
  return value == null || isSafeIdentifier(value);
}

function validateAutoPlayChoice(config, keyName, { threshold = false } = {}) {
  if (!isRecord(config) || typeof config.enabled !== 'boolean' || !isOptionalIdentifier(config[keyName])) return false;
  return !threshold || (Number.isFinite(config.threshold) && config.threshold >= 0 && config.threshold <= 1);
}

function validateAutoPlay(autoPlay) {
  if (!isRecord(autoPlay) || typeof autoPlay.is_auto_play !== 'boolean') return false;
  if (autoPlay.auto_attack != null) {
    if (!isRecord(autoPlay.auto_attack)
      || !['normal', 'skill'].includes(autoPlay.auto_attack.attack_type)
      || !isOptionalIdentifier(autoPlay.auto_attack.selected_skill_key)) return false;
  }
  if (autoPlay.auto_consume != null) {
    if (!isRecord(autoPlay.auto_consume)) return false;
    for (const key of ['hp_potion', 'mp_potion']) {
      if (autoPlay.auto_consume[key] != null
        && !validateAutoPlayChoice(autoPlay.auto_consume[key], 'selected_item_key', { threshold: true })) return false;
    }
  }
  if (autoPlay.auto_heal_skill != null
    && !validateAutoPlayChoice(autoPlay.auto_heal_skill, 'selected_skill_key', { threshold: true })) return false;
  if (autoPlay.auto_buff_skill != null
    && !validateAutoPlayChoice(autoPlay.auto_buff_skill, 'selected_skill_key')) return false;

  if (autoPlay.auto_resupply != null) {
    if (!isRecord(autoPlay.auto_resupply)) return false;
    for (const [group, quantityKey] of [['trigger_rules', 'trigger_threshold'], ['purchase_rules', 'target_quantity']]) {
      const rules = autoPlay.auto_resupply[group];
      if (rules == null) continue;
      if (!isRecord(rules)) return false;
      for (const kind of ['hp', 'mp']) {
        const rule = rules[kind];
        if (rule == null) continue;
        if (!isRecord(rule)
          || typeof rule.enabled !== 'boolean'
          || !isOptionalIdentifier(rule.selected_potion)
          || !isPositiveIntegerLike(rule[quantityKey], 1000000)) return false;
      }
    }
  }

  if (autoPlay.auto_sell != null) {
    const autoSell = autoPlay.auto_sell;
    if (!isRecord(autoSell) || typeof autoSell.enabled !== 'boolean') return false;
    if (autoSell.categories != null) {
      if (!isRecord(autoSell.categories) || Object.keys(autoSell.categories).length > 100) return false;
      for (const [category, categoryConfig] of Object.entries(autoSell.categories)) {
        if (!isSafeIdentifier(category)
          || !isRecord(categoryConfig)
          || !isRecord(categoryConfig.rules)
          || Object.keys(categoryConfig.rules).length > 1000) return false;
        for (const [attribute, rule] of Object.entries(categoryConfig.rules)) {
          if (!isSafeIdentifier(attribute)
            || !isRecord(rule)
            || typeof rule.enabled !== 'boolean'
            || !isNonNegativeFinite(rule.max_value)) return false;
        }
      }
    }
    if (autoSell.equipment != null
      && (!isRecord(autoSell.equipment)
        || typeof autoSell.equipment.enabled !== 'boolean'
        || !isIdentifierArray(autoSell.equipment.item_keys || [], 1000))) return false;
  }

  if (autoPlay.auto_store != null) {
    const autoStore = autoPlay.auto_store;
    if (!isRecord(autoStore) || typeof autoStore.enabled !== 'boolean') return false;
    if (autoStore.stones != null) {
      const rules = autoStore.stones?.rules;
      if (!Array.isArray(rules) || rules.length > 1000) return false;
      for (const rule of rules) {
        if (!isRecord(rule)
          || !['cold_jade', 'vajra', 'enhance', 'hot_blood'].includes(rule.category)
          || !isOptionalIdentifier(rule.attribute_key)
          || (rule.value != null && !Number.isFinite(rule.value))) return false;
      }
    }
    if (autoStore.equipment != null
      && (!isRecord(autoStore.equipment)
        || !isIdentifierArray(autoStore.equipment.item_keys || [], 1000))) return false;
  }
  return true;
}

export const SaveManager = {
  _writeEpoch: 0,
  _slotWriteVersions: new Map(),
  _slotWriteTrackers: new Map(),

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
    const slot = this._normalizeSlotIndex(slotIndex);
    if (this._guard() || !player || slot === null) return false;
    const writeToken = this._nextPlayerWriteToken(slot);
    const tracker = this._createPlayerWriteTracker(slot, writeToken);

    const now = Date.now();
    if (!player.offline) player.offline = {};

    try {
      const save = this._buildPlayerSave(player, now);
      if (!this.isValidPlayerSaveData(save)) throw new Error('玩家存档结构无效');
      const checksum = await computeChecksum(save, SAVE_VERSION, now);
      if (!this._isCurrentPlayerWrite(slot, writeToken)) {
        return this._resolveSupersededPlayerWrite(slot, tracker);
      }
      if (this._guard()) {
        tracker.resolve(false);
        return false;
      }
      const payload = { data: save, version: SAVE_VERSION, saved_at: now, checksum };
      const saved = this._writeRedundantPlayerPayload(slot, JSON.stringify(payload));
      if (saved) {
        player.offline.last_save_timestamp = now;
      }
      tracker.resolve(saved);
      return saved;
    } catch (error) {
      console.warn('[存档] 玩家快照构造或校验失败:', error);
      tracker.resolve(false);
      return false;
    }
  },

  /**
   * 直接保存已反序列化的存档体，供角色列表等无运行时 player 的流程使用。
   * preserveOfflineTimestamp 用于避免列表操作重置离线收益起算时间。
   */
  async savePlayerSnapshot(saveData, slotIndex, { preserveOfflineTimestamp = false } = {}) {
    const slot = this._normalizeSlotIndex(slotIndex);
    if (this._guard() || !saveData || slot === null) return false;
    const writeToken = this._nextPlayerWriteToken(slot);
    const tracker = this._createPlayerWriteTracker(slot, writeToken);

    try {
      const now = Date.now();
      const savedAt = preserveOfflineTimestamp
        ? Number(saveData.offline?.last_save_timestamp) || now
        : now;
      const save = JSON.parse(JSON.stringify(saveData));
      save.offline = save.offline || {};
      save.offline.last_save_timestamp = savedAt;
      if (!this.isValidPlayerSaveData(save)) {
        tracker.resolve(false);
        return false;
      }

      const checksum = await computeChecksum(save, SAVE_VERSION, savedAt);
      if (!this._isCurrentPlayerWrite(slot, writeToken)) {
        return this._resolveSupersededPlayerWrite(slot, tracker);
      }
      if (this._guard()) {
        tracker.resolve(false);
        return false;
      }
      const payload = { data: save, version: SAVE_VERSION, saved_at: savedAt, checksum };
      const saved = this._writeRedundantPlayerPayload(slot, JSON.stringify(payload));
      tracker.resolve(saved);
      return saved;
    } catch (error) {
      console.warn('[存档] 存档快照构造或校验失败:', error);
      tracker.resolve(false);
      return false;
    }
  },

  /**
   * 同步保存（页面卸载场景专用）。
   * WebCrypto checksum 是异步的，pagehide/beforeunload 里可能跑不完；
   * 这里写 checksum:null 的快照，下次正常保存会覆盖成带校验版本。
   */
  savePlayerStateSync(player, slotIndex) {
    const slot = this._normalizeSlotIndex(slotIndex);
    if (this._guard() || !player || slot === null) return false;
    const writeToken = this._nextPlayerWriteToken(slot);

    const now = Date.now();
    if (!player.offline) player.offline = {};

    try {
      const save = this._buildPlayerSave(player, now);
      if (!this.isValidPlayerSaveData(save)) throw new Error('玩家存档结构无效');
      const payload = { data: save, version: SAVE_VERSION, saved_at: now, checksum: null };
      const json = JSON.stringify(payload);
      const saved = this._writeRedundantPlayerPayload(slot, json);
      if (saved) {
        player.offline.last_save_timestamp = now;
      }
      this._slotWriteTrackers.set(slot, {
        token: writeToken,
        promise: Promise.resolve(saved),
        resolve() {},
      });
      return saved;
    } catch (error) {
      this._slotWriteTrackers.set(slot, {
        token: writeToken,
        promise: Promise.resolve(false),
        resolve() {},
      });
      console.warn('[存档] 同步快照构造失败:', error);
      return false;
    }
  },

  /**
   * 保存全局存档
   * @param {Object} globalSave
   */
  async saveGlobalState(globalSave) {
    if (this._guard()) return false;
    const normalized = this.normalizeGlobalState(globalSave);
    if (!normalized) return false;
    return storage.set(GLOBAL_KEY, JSON.stringify(normalized));
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
    const slot = this._normalizeSlotIndex(slotIndex);
    if (slot === null) return null;
    const primaryKey = PRIMARY_KEY(slot);
    const shadowKey = SHADOW_KEY(slot);
    const primaryRaw = storage.get(primaryKey);
    const shadowRaw = storage.get(shadowKey);
    const [primary, shadow] = await Promise.all([
      this._validatePlayerPayload(primaryRaw),
      this._validatePlayerPayload(shadowRaw),
    ]);

    if (!primary.valid && !shadow.valid) return null;

    const useShadow = shadow.valid && (!primary.valid || shadow.savedAt > primary.savedAt);
    const chosen = useShadow ? shadow : primary;
    if (useShadow) {
      console.warn(primary.valid
        ? '[存档] 影子存档较新，已恢复最新快照'
        : '[存档] 检测到主存档损坏，已从影子存档恢复');
      if (repairPrimary && primaryRaw !== chosen.raw && !storage.set(primaryKey, chosen.raw)) {
        console.warn('[存档] 影子存档有效，但主存档修复写入失败');
      }
    } else if ((!shadow.valid || shadow.raw !== chosen.raw) && !storage.set(shadowKey, chosen.raw)) {
      console.warn('[存档] 主存档有效，但影子存档修复写入失败');
    }

    return {
      data: chosen.data,
      payload: chosen.payload,
      raw: chosen.raw,
      recoveredFromShadow: useShadow,
    };
  },

  async _validatePlayerPayload(raw) {
    if (!raw) return { valid: false, data: null, raw: null, payload: null, savedAt: 0 };

    try {
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed.saved_at);
      if (parsed.version !== SAVE_VERSION
        || !Number.isSafeInteger(savedAt)
        || savedAt <= 0
        || !this.isValidPlayerSaveData(parsed.data)) {
        return { valid: false, data: null, raw: null, payload: null, savedAt: 0 };
      }
      if (parsed.checksum === null) {
        return { valid: true, data: parsed.data, raw: JSON.stringify(parsed), payload: parsed, savedAt };
      }
      const expected = await computeChecksum(parsed.data, parsed.version, parsed.saved_at);
      const valid = expected === parsed.checksum;
      return {
        valid,
        data: valid ? parsed.data : null,
        raw: valid ? JSON.stringify(parsed) : null,
        payload: valid ? parsed : null,
        savedAt: valid ? savedAt : 0,
      };
    } catch {
      return { valid: false, data: null, raw: null, payload: null, savedAt: 0 };
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
      return this.normalizeGlobalState(JSON.parse(raw));
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

    const primaryRestored = this._restoreStorageValue(primaryKey, previousPrimary);
    const shadowRestored = this._restoreStorageValue(shadowKey, previousShadow);
    if (!primaryRestored || !shadowRestored) {
      console.error('[存档] 双存档写入失败，且旧快照未能完整回滚');
    }
    return false;
  },

  _restoreStorageValue(key, value) {
    return value == null ? storage.remove(key) : storage.set(key, value);
  },

  _normalizeSlotIndex(slotIndex) {
    const slot = Number(slotIndex);
    return Number.isInteger(slot) && slot >= 1 && slot <= 10 ? slot : null;
  },

  _nextPlayerWriteToken(slotIndex) {
    const version = (this._slotWriteVersions.get(slotIndex) || 0) + 1;
    this._slotWriteVersions.set(slotIndex, version);
    return { epoch: this._writeEpoch, version };
  },

  _isCurrentPlayerWrite(slotIndex, token) {
    return token.epoch === this._writeEpoch
      && token.version === this._slotWriteVersions.get(slotIndex);
  },

  _createPlayerWriteTracker(slotIndex, token) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const tracker = { token, promise, resolve };
    this._slotWriteTrackers.set(slotIndex, tracker);
    return tracker;
  },

  async _resolveSupersededPlayerWrite(slotIndex, tracker) {
    const latest = this._slotWriteTrackers.get(slotIndex);
    const saved = latest && latest !== tracker ? await latest.promise : false;
    tracker.resolve(saved);
    return saved;
  },

  invalidatePendingPlayerWrites(slotIndex = null) {
    const slot = slotIndex == null ? null : this._normalizeSlotIndex(slotIndex);
    if (slotIndex != null && slot === null) return false;
    if (slot === null) {
      this._writeEpoch += 1;
      this._slotWriteVersions.clear();
      for (const tracker of this._slotWriteTrackers.values()) tracker.resolve(false);
      this._slotWriteTrackers.clear();
    } else {
      const token = this._nextPlayerWriteToken(slot);
      const previous = this._slotWriteTrackers.get(slot);
      previous?.resolve(false);
      this._slotWriteTrackers.set(slot, {
        token,
        promise: Promise.resolve(false),
        resolve() {},
      });
    }
    return true;
  },

  isValidPlayerSaveData(data) {
    if (!isRecord(data)) return false;
    const player = data.player;
    if (!isRecord(player)) return false;
    if (!isSafeIdentifier(player.id, 128)
      || !/^[\u4e00-\u9fa5a-zA-Z0-9_]{1,10}$/.test(player.name)
      || !isSafeIdentifier(player.career, 128)) return false;
    if (!Number.isSafeInteger(player.level) || player.level < 1 || player.level > 1000) return false;
    if (!isNonNegativeSafeInteger(player.exp)
      || !isNonNegativeFinite(player.hp)
      || !isNonNegativeFinite(player.mp)) return false;
    if (!isIdentifierArray(player.career_history || [], 1000)
      || !hasUniqueValues(player.career_history || [])) return false;
    if (player.faction != null && !['neutral', 'positive', 'negative'].includes(player.faction)) return false;

    if (!isRecord(data.resources)
      || !['gold', 'training', 'merit'].every(key => isNonNegativeSafeInteger(data.resources[key]))) return false;
    if (!isRecord(data.qigong)
      || !isNonNegativeSafeInteger(data.qigong.available_points)
      || !isNonNegativeSafeInteger(data.qigong.attribute_reset_count)
      || !isRecord(data.qigong.invested)
      || Object.keys(data.qigong.invested).length > MAX_COLLECTION_SIZE) return false;
    let investedPoints = 0;
    for (const [key, points] of Object.entries(data.qigong.invested)) {
      if (!isSafeIdentifier(key) || !isNonNegativeSafeInteger(points)) return false;
      if (points > Number.MAX_SAFE_INTEGER - investedPoints) return false;
      investedPoints += points;
    }
    if (!isIdentifierArray(data.learned_martial_arts || [])
      || !hasUniqueValues(data.learned_martial_arts || [])) return false;
    const equippedInstanceIds = collectEquippedInstanceIds(data.equipped, data.inventory?.equipment_instances);
    if (!equippedInstanceIds
      || !validateContainer(data.inventory, equippedInstanceIds)
      || !validateContainer(data.warehouse)) return false;
    const warehouseInstanceIds = new Set(Object.keys(data.warehouse.equipment_instances));
    if (Object.keys(data.inventory.equipment_instances)
      .some(instanceId => warehouseInstanceIds.has(instanceId))) return false;

    if (!isRecord(data.quests)
      || !Array.isArray(data.quests.accepted)
      || data.quests.accepted.length > MAX_COLLECTION_SIZE
      || !data.quests.accepted.every(validateQuestInstance)
      || !hasUniqueValues(data.quests.accepted.map(quest => quest.key))
      || !isIdentifierArray(data.quests.completed || [])
      || !hasUniqueValues(data.quests.completed || [])
      || data.quests.accepted.some(quest => data.quests.completed.includes(quest.key))) return false;
    if (!isRecord(data.location)
      || !isSafeIdentifier(data.location.current_map_key)
      || (data.location.current_sub_zone_key != null && !isSafeIdentifier(data.location.current_sub_zone_key))
      || (data.location.last_wilderness_sub_zone != null && !isSafeIdentifier(data.location.last_wilderness_sub_zone))) return false;
    if (!validateAutoPlay(data.auto_play)) return false;
    if (!isRecord(data.offline)
      || !Number.isSafeInteger(data.offline.last_save_timestamp)
      || data.offline.last_save_timestamp <= 0) return false;
    if (!isRecord(data.statistics)
      || !['total_kills', 'total_gold_earned', 'total_deaths']
        .every(key => isNonNegativeSafeInteger(data.statistics[key]))
      || !isNonNegativeFinite(data.statistics.total_playtime_ms)
      || data.statistics.total_playtime_ms > Number.MAX_SAFE_INTEGER) return false;
    return true;
  },

  normalizeGlobalState(globalSave) {
    if (!isRecord(globalSave)) return null;
    if (globalSave.schema_version != null && globalSave.schema_version !== SAVE_VERSION) return null;
    const rawSlots = isRecord(globalSave.character_slots) ? globalSave.character_slots : {};
    const rawUnlocked = Number(rawSlots.unlocked_count);
    const unlockedCount = Number.isInteger(rawUnlocked)
      ? Math.min(10, Math.max(3, rawUnlocked))
      : 3;
    const rawLastUsed = Number(rawSlots.last_used_slot);
    const lastUsedSlot = rawSlots.last_used_slot == null
      ? null
      : (Number.isInteger(rawLastUsed) && rawLastUsed >= 1 && rawLastUsed <= unlockedCount ? rawLastUsed : null);
    return {
      ...globalSave,
      schema_version: SAVE_VERSION,
      character_slots: {
        ...rawSlots,
        unlocked_count: unlockedCount,
        last_used_slot: lastUsedSlot,
      },
    };
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
        career_history: JSON.parse(JSON.stringify(player.career_history || [])),
        faction: player.faction || 'neutral',
        hp: player.hp,
        mp: player.mp,
      },
      resources: {
        gold: player.resources?.gold ?? 0,
        training: player.resources?.training ?? 0,
        merit: player.resources?.merit ?? 0,
      },
      qigong: {
        available_points: player.qigong?.available_points ?? 1,
        invested: JSON.parse(JSON.stringify(player.qigong?.invested || {})),
        attribute_reset_count: player.qigong?.attribute_reset_count ?? 0,
      },
      learned_martial_arts: JSON.parse(JSON.stringify(player.learned_martial_arts || [])),
      equipped: this._copyEquipped(player.equipped),
      inventory: this._copyInventory(player.inventory),
      warehouse: this._copyInventory(player.warehouse),
      quests: {
        accepted: JSON.parse(JSON.stringify(player.quests?.accepted || [])),
        completed: JSON.parse(JSON.stringify(player.quests?.completed || [])),
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
    const copyEntry = (entry) => {
      if (entry == null) return null;
      const instanceId = typeof entry === 'string' ? entry : entry.instance_id;
      return instanceId ? { instance_id: instanceId } : null;
    };
    const copy = {};
    for (const [k, v] of Object.entries(equipped)) {
      copy[k] = Array.isArray(v) ? v.map(copyEntry) : copyEntry(v);
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
