/**
 * @file systems/OfflineSimulator.js
 * @desc 离线模拟引擎：settle_offline_rewards + is_in_offline_simulation flag
 * @ref 13_save.simulation_flow
 */
import { SaveManager } from '../core/SaveManager.js';
import { InventorySystem } from './InventorySystem.js';
import { DropSystem } from './DropSystem.js';
import { AttributeSystem } from './AttributeSystem.js';
import { eventBus } from '../core/EventBus.js';
import { applyDeathExpLoss } from '../utils/formulas.js';

export const OfflineSimulator = {
  is_in_offline_simulation: false,

  /**
   * 完整离线结算
   * @param {Object} save  完整存档对象（含 player / location / auto_play / offline 等）
   * @param {Object} opts
   * @param {Function} opts.onProgress  进度回调（percent: 0-100）
   * @param {Function} opts.onSummary  结算完成回调（summary object）
   * @returns {Object|null} summary 或 null（无收益）
   */
  async settle_offline_rewards(save, opts = {}) {
    const { onProgress = () => {}, onSummary = () => {} } = opts;

    // 触发条件校验
    if (!save.auto_play?.is_auto_play || !save.location?.current_sub_zone_key) {
      return null;
    }

    const now = Date.now();
    const elapsed_ms = now - (save.offline?.last_save_timestamp || now);
    const elapsed_s = elapsed_ms / 1000;
    const sim_seconds = Math.min(elapsed_s, 86400); // 24h cap
    if (sim_seconds < 1) return null;

    this.is_in_offline_simulation = true;

    try {
      const summary = await this._runSimulation(save, sim_seconds, onProgress);
      // 保存离线后的玩家状态
      await SaveManager.savePlayerState(summary.player, save._slotIndex || 1);
      onSummary(summary);
      return summary;
    } finally {
      this.is_in_offline_simulation = false;
    }
  },

  async _runSimulation(save, sim_seconds, onProgress) {
    const TICK_MS = 100;
    const BATCH_TICKS = 600; // 60s per batch
    const total_ticks = Math.floor(sim_seconds * 1000 / TICK_MS);

    const player = this._restorePlayerFromSave(save);
    const level = player.level;
    const expToNext = save._expToNextLevel?.[level] || 999999;

    const summary = {
      elapsed_s: sim_seconds,
      kills: 0,
      exp_gained: 0,
      gold_gained: 0,
      potions_consumed: {},
      items_obtained: [],
      boxes_obtained: 0,
      items_discarded: 0,
      deaths: 0,
      died_at_s: null,
      resupply_trips: 0,
      gold_spent_on_potions: 0,
      stopped_reason: null,
      quest_item_lost: null,
      level_ups: [],
      _player: player,
    };

    const battle = save._battleSystem;
    const attrSys = save._attrSys;
    const dropSys = save._dropSys;
    const subZonesData = save._subZonesData;
    const currentSubZone = subZonesData?.find(sz => sz.key === save.location.current_sub_zone_key) || null;

    const originalOnLevelUp = eventBus._events?.['player.level_up'];
    eventBus.on('player.level_up', (data) => {
      summary.level_ups.push(data);
    });

    try {
      for (let tick = 0; tick < total_ticks; tick++) {
        if (battle) {
          battle._quiet = true;
          battle.tick(TICK_MS);
          battle._quiet = false;
        }

        // 更新统计
        summary.gold_gained = player.resources?.gold || 0;
        summary.kills = player.statistics?.total_kills || 0;

        // 死亡检测
        if (player.hp <= 0) {
          summary.deaths += 1;
          summary.died_at_s = tick * TICK_MS / 1000;
          // 死亡处理：传送回城 + is_auto_play=false
          player.location.current_map_key = 'town_xuanbo';
          player.location.current_sub_zone_key = null;
          player.auto_play.is_auto_play = false;
          this._applyPlayerDeath(player, save._expToNextLevel);
          break;
        }

        // 停止检测
        if (!player.auto_play.is_auto_play) {
          summary.stopped_reason = player._stopped_reason || 'player_stopped';
          break;
        }

        // 背包满检测（任务物品）
        if (player._quest_item_blocked) {
          summary.stopped_reason = 'inventory_full_quest_item';
          summary.quest_item_lost = player._quest_item_lost_info;
          player.auto_play.is_auto_play = false;
          break;
        }

        // 进度报告 + yield
        if ((tick + 1) % BATCH_TICKS === 0) {
          onProgress(Math.min(100, Math.floor((tick + 1) / total_ticks * 100)));
          await this._yieldToUI();
        }
      }
    } finally {
      eventBus.off('player.level_up');
      if (originalOnLevelUp) eventBus.on('player.level_up', originalOnLevelUp);
    }

    onProgress(100);

    // 恢复 hp/mp clamp
    player.hp = Math.max(0, Math.min(player.hp, player.maxHp));
    player.mp = Math.max(0, Math.min(player.mp, player.maxMp));

    return summary;
  },

  _restorePlayerFromSave(save) {
    const data = save.player;
    const player = {
      id: data.id,
      name: data.name,
      level: data.level,
      exp: data.exp,
      career: data.career,
      career_history: data.career_history || [],
      faction: data.faction || 'neutral',
      hp: data.hp,
      mp: data.mp,
      resources: save.resources || { gold: 0, training: 0, merit: 0 },
      qigong: save.qigong || { available_points: 1, invested: {}, attribute_reset_count: 0 },
      learned_martial_arts: save.learned_martial_arts || [],
      equipped: save.equipped || {},
      inventory: save.inventory || { capacity: 50, slots: [], equipment_instances: {} },
      warehouse: save.warehouse || { capacity: 50, slots: [], equipment_instances: {} },
      quests: save.quests || { accepted: [], completed: [] },
      location: save.location || { current_map_key: 'town_xuanbo', current_sub_zone_key: null, last_wilderness_sub_zone: null },
      auto_play: save.auto_play || { is_auto_play: false, auto_consume: {}, auto_heal_skill: {}, auto_resupply: {} },
      offline: save.offline || { last_save_timestamp: Date.now() },
      statistics: save.statistics || { total_kills: 0, total_playtime_ms: 0, total_gold_earned: 0, total_deaths: 0 },
    };

    // AttributeSystem.recompute
    const attrSys = new AttributeSystem({ attributeConstants: save._attributeConstants });
    attrSys.recompute(player);

    // clamp hp/mp
    player.hp = Math.max(0, Math.min(player.hp, player.maxHp));
    player.mp = Math.max(0, Math.min(player.mp, player.maxMp));

    // 重置运行时瞬态
    player.cooldowns = {};
    player.buffs = [];
    player.last_hp_potion_time = 0;
    player.last_mp_potion_time = 0;
    player.last_heal_cast_time = 0;
    player._hooks = {};

    return player;
  },

  _applyPlayerDeath(player, expToNextLevel) {
    const loss = Math.floor((expToNextLevel?.[player.level] || 0) * 0.01);
    player.exp = Math.max(0, player.exp - loss);
    player.hp = player.maxHp;
    player.mp = player.maxMp;
  },

  _yieldToUI() {
    return new Promise(resolve => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => resolve(), { timeout: 50 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  },

  /**
   * 快速模拟（测试用，不走完整的 battle_system）
   * @param {number} hours
   */
  async fastForwardOffline(hours) {
    const seconds = hours * 3600;
    const summary = {
      elapsed_s: seconds,
      kills: Math.floor(Math.random() * 100 * hours),
      exp_gained: Math.floor(Math.random() * 10000 * hours),
      gold_gained: Math.floor(Math.random() * 5000 * hours),
      potions_consumed: {},
      items_obtained: [],
      boxes_obtained: Math.floor(Math.random() * 5 * hours),
      items_discarded: 0,
      deaths: 0,
      died_at_s: null,
      resupply_trips: 0,
      gold_spent_on_potions: 0,
      stopped_reason: null,
      quest_item_lost: null,
      level_ups: [],
    };
    console.log(`[离线模拟] 模拟 ${hours} 小时离线收益:`, summary);
    return summary;
  }
};