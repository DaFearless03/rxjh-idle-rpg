/**
 * @file flows/character_creation_flow.js
 * @desc 4步角色创建流程
 * @ref 13_save.character_creation_flow
 */
import { storage } from '../utils/storage.js';
import { SaveManager } from '../core/SaveManager.js';
import { generateUUID } from '../utils/uuid.js';
import { eventBus } from '../core/EventBus.js';

const BASE_CAREERS = ['warrior_blade', 'warrior_sword', 'warrior_spear', 'healer'];

/**
 * @param {Object} opts
 * @param {Object} opts.careersData   职业配置列表
 * @param {Object} opts.globalSave   当前全局存档
 * @param {Function} opts.onComplete 创建完成回调（传入 player 对象）
 */
export function runCharacterCreationFlow(opts) {
  const { careersData, globalSave, onComplete } = opts;

  // 返回 step 函数供外部调用（console 环境下直接执行）
  return {
    step1_selectCareer: (careerKey) => {
      if (!BASE_CAREERS.includes(careerKey)) {
        return { success: false, message: '无效职业，仅支持 4 个 base 职业' };
      }
      return { success: true, selectedCareer: careerKey };
    },

    step2_inputName: (name) => {
      if (!name || name.length === 0) return { success: false, message: '角色名不能为空' };
      if (name.length > 10) return { success: false, message: '角色名不超过 10 个字符' };
      if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) return { success: false, message: '仅支持中文/英文/数字/下划线' };
      return { success: true, name };
    },

    step3_initializeSave: (careerKey, name, targetSlotIndex) => {
      const career = careersData.find(c => c.key === careerKey);
      if (!career) return { success: false, message: '职业不存在' };

      let slotIndex;
      try {
        slotIndex = resolveSlotIndex(targetSlotIndex, globalSave);
      } catch (err) {
        return { success: false, message: err.message || '无法选择角色槽位' };
      }
      const now = Date.now();

      const newSave = {
        player: {
          id: generateUUID(),
          name,
          level: 1,
          exp: 0,
          career: careerKey,
          career_history: [careerKey],
          faction: 'neutral',
          hp: career.base_stats.baseHp,
          mp: career.base_stats.baseMp,
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
          auto_consume: {
            hp_potion: { enabled: true, selected_item_key: null, threshold: 0.30 },
            mp_potion: { enabled: true, selected_item_key: null, threshold: 0.30 },
          },
          auto_heal_skill: { enabled: false, selected_skill_key: null },
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
        },
        offline: { last_save_timestamp: now },
        statistics: { total_kills: 0, total_playtime_ms: 0, total_gold_earned: 0, total_deaths: 0 },
      };

      return { success: true, save: newSave, slotIndex };
    },

    step4_persist: async (save, slotIndex, updatedGlobalSave) => {
      // 写入玩家存档
      await SaveManager.savePlayerState(buildPlayerFromSave(save), slotIndex);
      // 更新全局存档
      updatedGlobalSave.character_slots.last_used_slot = slotIndex;
      await SaveManager.saveGlobalState(updatedGlobalSave);
      eventBus.emit('character.created', { slotIndex, name: save.player.name });
      return { success: true, slotIndex };
    }
  };
}

/**
 * 解析 slot_index（优先级：target_slot_index > 第一个空槽 > 抛错）
 */
function resolveSlotIndex(targetSlotIndex, globalSave) {
  const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
  if (targetSlotIndex != null) {
    if (targetSlotIndex < 1 || targetSlotIndex > unlocked) {
      throw new Error(`槽位 ${targetSlotIndex} 未解锁`);
    }
    if (storage.get(`player-${targetSlotIndex}`)) {
      throw new Error(`槽位 ${targetSlotIndex} 已有角色`);
    }
    return targetSlotIndex;
  }
  // 找第一个空槽
  for (let i = 1; i <= unlocked; i++) {
    if (!storage.get(`player-${i}`)) return i;
  }
  throw new Error('没有可用的角色槽位');
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
