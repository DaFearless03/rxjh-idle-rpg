/**
 * @file flows/character_creation_flow.js
 * @desc 4步角色创建流程
 * @ref 13_save.character_creation_flow
 */
import { storage } from '../utils/storage.js?v=release-20260830-3';
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-3';
import { generateUUID } from '../utils/uuid.js?v=release-20260830-3';
import { createEquipmentInstance } from '../entities/EquipmentInstance.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

const BASE_CAREERS = ['warrior_blade', 'warrior_sword', 'warrior_spear', 'healer'];
const STARTING_WEAPON_BY_FAMILY = {
  blade: 'blade_base_001',
  sword: 'sword_base_001',
  spear: 'spear_base_001',
  staff: 'staff_base_001',
};
const PERSISTING_SLOTS = new Set();

/**
 * @param {Object} opts
 * @param {Object} opts.careersData   职业配置列表
 * @param {Object} opts.globalSave   当前全局存档
 */
export function runCharacterCreationFlow(opts) {
  const { careersData, equipmentsData = [], globalSave, attributeConstants = {} } = opts;

  // 返回 step 函数供外部调用（console 环境下直接执行）
  return {
    step1_selectCareer: (careerKey) => {
      if (!BASE_CAREERS.includes(careerKey)) {
        return { success: false, message: '无效职业，仅支持 4 个 base 职业' };
      }
      return { success: true, selectedCareer: careerKey };
    },

    step2_inputName: validateCharacterName,

    step3_initializeSave: (careerKey, name, targetSlotIndex) => {
      const careerSelection = BASE_CAREERS.includes(careerKey);
      if (!careerSelection) return { success: false, message: '无效职业，仅支持 4 个 base 职业' };
      const nameValidation = validateCharacterName(name);
      if (!nameValidation.success) return nameValidation;
      const career = careersData.find(c => c.key === careerKey);
      if (!career) return { success: false, message: '职业不存在' };

      let slotIndex;
      try {
        slotIndex = resolveSlotIndex(targetSlotIndex, globalSave);
      } catch (err) {
        return { success: false, message: err.message || '无法选择角色槽位' };
      }
      const now = Date.now();
      const maxHp = career.base_stats.baseHp
        + (career.base_stats.sta || 0) * (attributeConstants.staToHp || 0);
      const maxMp = career.base_stats.baseMp
        + (career.base_stats.int || 0) * (attributeConstants.intToMp || 0);

      const newSave = {
        player: {
          id: generateUUID(),
          name,
          level: 1,
          exp: 0,
          career: careerKey,
          career_history: [careerKey],
          faction: 'neutral',
          hp: maxHp,
          mp: maxMp,
        },
        resources: { gold: 100, training: 0, merit: 0 },
        qigong: { available_points: 1, invested: {}, attribute_reset_count: 0 },
        learned_martial_arts: [],
        equipped: {
          weapon: null, chest: null, gloves: [null, null], boots: null,
          inner_armor: null, ring: [null, null], amulet: null,
          earring: [null, null], cape: null,
        },
        inventory: { capacity: 50, slots: [], equipment_instances: {} },
        warehouse: { capacity: 50, slots: [], equipment_instances: {} },
        quests: { accepted: [], completed: [] },
        location: { current_map_key: 'town_xuanbo', current_sub_zone_key: null, last_wilderness_sub_zone: null },
        auto_play: {
          is_auto_play: false,
          auto_attack: { attack_type: 'normal', selected_skill_key: null },
          auto_consume: {
            hp_potion: { enabled: true, selected_item_key: null, threshold: 0.30 },
            mp_potion: { enabled: true, selected_item_key: null, threshold: 0.30 },
          },
          auto_heal_skill: { enabled: false, selected_skill_key: null, threshold: 0.50 },
          auto_buff_skill: { enabled: false, selected_skill_key: null },
          auto_resupply: {
            trigger_rules: {
              hp: { enabled: false, selected_potion: null, trigger_threshold: 5 },
              mp: { enabled: false, selected_potion: null, trigger_threshold: 5 },
            },
            purchase_rules: {
              hp: { enabled: false, selected_potion: null, target_quantity: 10 },
              mp: { enabled: false, selected_potion: null, target_quantity: 10 },
            },
          },
          auto_sell: {
            enabled: false,
            categories: {},
            equipment: { enabled: false, item_keys: [] },
          },
          auto_store: {
            enabled: false,
            stones: { rules: [] },
            equipment: { item_keys: [] },
          },
        },
        offline: { last_save_timestamp: now },
        statistics: { total_kills: 0, total_playtime_ms: 0, total_gold_earned: 0, total_deaths: 0 },
      };
      if (!addStartingWeapon(newSave, career, equipmentsData)) {
        return { success: false, message: '初始武器配置缺失，无法创建角色' };
      }

      return { success: true, save: newSave, slotIndex };
    },

    step4_persist: async (save, slotIndex, updatedGlobalSave) => {
      const slot = Number(slotIndex);
      const normalizedGlobalSave = SaveManager.normalizeGlobalState(updatedGlobalSave);
      if (!Number.isInteger(slot) || slot < 1 || slot > 10
        || !normalizedGlobalSave
        || slot > normalizedGlobalSave.character_slots.unlocked_count
        || !BASE_CAREERS.includes(save?.player?.career)
        || !careersData.some(career => career.key === save?.player?.career && career.stage === 'base')
        || !SaveManager.isValidPlayerSaveData(save)) {
        return { success: false, message: '角色或全局存档结构无效' };
      }
      if (PERSISTING_SLOTS.has(slot)) {
        return { success: false, message: `槽位 ${slot} 正在创建角色，请稍候` };
      }
      PERSISTING_SLOTS.add(slot);
      try {
        updatedGlobalSave.character_slots = normalizedGlobalSave.character_slots;
        updatedGlobalSave.schema_version = normalizedGlobalSave.schema_version;
        const previousLastUsedSlot = updatedGlobalSave.character_slots.last_used_slot;
        const primaryKey = `player-${slot}`;
        const shadowKey = `${primaryKey}-bak`;
        const previousPrimary = storage.get(primaryKey);
        const previousShadow = storage.get(shadowKey);
        if (previousPrimary != null || previousShadow != null) {
          return { success: false, message: `槽位 ${slot} 已有角色` };
        }
        // 写入玩家存档
        const playerSaved = await SaveManager.savePlayerState(buildPlayerFromSave(save), slot);
        if (!playerSaved) return { success: false, message: '角色存档写入失败' };
        // 更新全局存档
        updatedGlobalSave.character_slots.last_used_slot = slot;
        const globalSaved = await SaveManager.saveGlobalState(updatedGlobalSave);
        if (!globalSaved) {
          updatedGlobalSave.character_slots.last_used_slot = previousLastUsedSlot;
          SaveManager.invalidatePendingPlayerWrites(slot);
          const primaryRestored = restoreStorageValue(primaryKey, previousPrimary);
          const shadowRestored = restoreStorageValue(shadowKey, previousShadow);
          return {
            success: false,
            message: primaryRestored && shadowRestored
              ? '全局存档写入失败'
              : '全局存档写入失败，且角色存档未能完整恢复',
          };
        }
        eventBus.emit('character.created', { slotIndex: slot, name: save.player.name });
        return { success: true, slotIndex: slot };
      } finally {
        PERSISTING_SLOTS.delete(slot);
      }
    }
  };
}

/**
 * 解析 slot_index（优先级：target_slot_index > 第一个空槽 > 抛错）
 */
function resolveSlotIndex(targetSlotIndex, globalSave) {
  const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
  if (targetSlotIndex != null) {
    const slotIndex = Number(targetSlotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > unlocked) {
      throw new Error(`槽位 ${targetSlotIndex} 未解锁`);
    }
    if (storage.get(`player-${slotIndex}`) || storage.get(`player-${slotIndex}-bak`)) {
      throw new Error(`槽位 ${slotIndex} 已有角色`);
    }
    return slotIndex;
  }
  // 找第一个空槽
  for (let i = 1; i <= unlocked; i++) {
    if (!storage.get(`player-${i}`) && !storage.get(`player-${i}-bak`)) return i;
  }
  throw new Error('没有可用的角色槽位');
}

function validateCharacterName(name) {
  if (typeof name !== 'string' || name.length === 0) return { success: false, message: '角色名不能为空' };
  if (name.length > 10) return { success: false, message: '角色名不超过 10 个字符' };
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) return { success: false, message: '仅支持中文/英文/数字/下划线' };
  return { success: true, name };
}

function addStartingWeapon(save, career, equipmentsData) {
  const weaponKey = STARTING_WEAPON_BY_FAMILY[career?.career_family];
  const template = equipmentsData.find(item => item.key === weaponKey);
  if (!template) return false;
  const instance = createEquipmentInstance(template);
  save.inventory.equipment_instances[instance.instance_id] = instance;
  save.inventory.slots.push({ item_key: instance.item_key, count: 1, instance_id: instance.instance_id });
  return true;
}

function restoreStorageValue(key, value) {
  return value == null ? storage.remove(key) : storage.set(key, value);
}

function buildPlayerFromSave(save) {
  return {
    ...save.player,
    resources: save.resources,
    qigong: save.qigong,
    learned_martial_arts: save.learned_martial_arts,
    equipped: save.equipped,
    inventory: save.inventory,
    warehouse: save.warehouse,
    quests: save.quests,
    location: save.location,
    auto_play: save.auto_play,
    offline: save.offline,
    statistics: save.statistics,
    _hooks: {},
  };
}

export function getBaseCareers() {
  return BASE_CAREERS;
}
