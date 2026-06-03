/**
 * @file systems/OfflineSimulator.js
 * @desc 离线模拟引擎：settle_offline_rewards + is_in_offline_simulation flag
 * @ref 13_save.simulation_flow
 */
import { SaveManager } from '../core/SaveManager.js';
import { AttributeSystem } from './AttributeSystem.js';
import { BattleSystem } from './BattleSystem.js';
import { AutoPlaySystem } from './AutoPlaySystem.js';
import { eventBus } from '../core/EventBus.js';
import { restoreRuntimePlayerFromSave } from '../utils/player_restore.js';

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
      await SaveManager.savePlayerState(summary._player, save._slotIndex || 1);
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
    const startGold = player.resources?.gold || 0;
    const startDeaths = player.statistics?.total_deaths || 0;
    const startLevel = player.level || 1;
    const startExp = player.exp || 0;

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

    const subZonesData = save._subZonesData;
    const currentSubZone = subZonesData?.find(sz => sz.key === save.location.current_sub_zone_key) || null;
    const battle = new BattleSystem({
      config: save._config,
      player,
      monstersData: save._monstersData || [],
      attrSystemRef: save._attrSys,
      dropSystemRef: save._dropSys,
      subZonesData,
      subZoneDropsData: save._subZoneDropsData || [],
      currentSubZone,
      buffSystemRef: save._buffSys || null,
    });
    battle._quiet = true;

    const onLevelUp = (data) => {
      summary.level_ups.push(data);
    };
    const onMonsterDeath = (data) => {
      summary.kills += 1;
    };
    const onConsumeHp = (data) => {
      summary.potions_consumed[data.item] = (summary.potions_consumed[data.item] || 0) + 1;
    };
    const onConsumeMp = (data) => {
      summary.potions_consumed[data.item] = (summary.potions_consumed[data.item] || 0) + 1;
    };
    eventBus.on('player.level_up', onLevelUp);
    eventBus.on('monster.death', onMonsterDeath);
    eventBus.on('autoplay.consume_hp', onConsumeHp);
    eventBus.on('autoplay.consume_mp', onConsumeMp);
    AutoPlaySystem.syncFromPlayer(player);

    try {
      for (let tick = 0; tick < total_ticks; tick++) {
        battle.tick(TICK_MS);
        const goldBeforeAutoPlay = player.resources?.gold || 0;
        AutoPlaySystem.tick(player, TICK_MS, (source, zone) => {
          this._teleportOffline(player, battle, subZonesData, zone);
          if (source === 'auto_resupply' && zone === null) {
            summary.resupply_trips += 1;
          }
        });
        const goldAfterAutoPlay = player.resources?.gold || 0;
        if (goldAfterAutoPlay < goldBeforeAutoPlay) {
          summary.gold_spent_on_potions += goldBeforeAutoPlay - goldAfterAutoPlay;
        }

        // 更新统计
        summary.gold_gained = Math.max(0, (player.resources?.gold || 0) + summary.gold_spent_on_potions - startGold);
        summary.exp_gained = this._calcActualExpGained(player, startLevel, startExp, save._config);

        // 死亡检测
        if ((player.statistics?.total_deaths || 0) > startDeaths) {
          summary.deaths = (player.statistics?.total_deaths || 0) - startDeaths;
          summary.died_at_s = tick * TICK_MS / 1000;
          summary.stopped_reason = 'death';
          break;
        }

        // 背包满检测（任务物品）
        if (player._quest_item_blocked) {
          summary.stopped_reason = 'inventory_full_quest_item';
          summary.quest_item_lost = player._quest_item_lost_info;
          player.auto_play.is_auto_play = false;
          break;
        }

        // 停止检测
        if (!player.auto_play.is_auto_play) {
          summary.stopped_reason = player._stopped_reason || 'player_stopped';
          break;
        }

        // 进度报告 + yield
        if ((tick + 1) % BATCH_TICKS === 0) {
          onProgress(Math.min(100, Math.floor((tick + 1) / total_ticks * 100)));
          await this._yieldToUI();
        }
      }
    } finally {
      battle.destroy?.();
      eventBus.off('player.level_up', onLevelUp);
      eventBus.off('monster.death', onMonsterDeath);
      eventBus.off('autoplay.consume_hp', onConsumeHp);
      eventBus.off('autoplay.consume_mp', onConsumeMp);
      AutoPlaySystem.resetRuntimeState();
    }

    onProgress(100);

    // 恢复 hp/mp clamp
    player.hp = Math.max(0, Math.min(player.hp, player.maxHp));
    player.mp = Math.max(0, Math.min(player.mp, player.maxMp));

    return summary;
  },

  _teleportOffline(player, battle, subZonesData, subZoneKey) {
    const prev = player.location?.current_sub_zone_key || null;
    player.location = player.location || {};
    if (prev) {
      player.location.last_wilderness_sub_zone = prev;
    }
    player.location.current_sub_zone_key = subZoneKey;
    player.location.current_map_key = subZoneKey ? 'wilderness_xuanbo_suburb' : 'town_xuanbo';
    battle.monsters = [];
    battle._mainTargetKey = null;
    battle._currentSubZone = subZonesData?.find(s => s.key === subZoneKey) || null;
    battle._initialSpawned = false;
  },

  _restorePlayerFromSave(save) {
    const attrSystem = save._attrSys || new AttributeSystem({ attributeConstants: save._attributeConstants });
    return restoreRuntimePlayerFromSave(save, {
      careersData: save._careersData || [],
      equipmentsData: save._equipmentsData || [],
      attrSystem,
    });
  },

  _calcActualExpGained(player, startLevel, startExp, config) {
    const currentLevel = player.level || startLevel;
    const currentExp = player.exp || 0;
    const expTable = config?.exp_to_next_level || {};
    const levelCap = config?.current_level_cap ?? currentLevel;

    if (startLevel >= levelCap) return 0;
    if (currentLevel <= startLevel) return Math.max(0, currentExp - startExp);

    let gained = Math.max(0, (expTable[startLevel] || 0) - startExp);
    for (let level = startLevel + 1; level < Math.min(currentLevel, levelCap); level++) {
      gained += expTable[level] || 0;
    }
    if (currentLevel < levelCap) {
      gained += currentExp;
    }

    return gained;
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
