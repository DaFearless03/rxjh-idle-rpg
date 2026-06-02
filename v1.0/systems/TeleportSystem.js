/**
 * @file systems/TeleportSystem.js
 * @desc teleport(sub_zone, source) + source 标记例外
 * @ref 08_maps_npc_quests.teleport_system / 10_consumables.is_auto_play.exit_triggers
 */
import { eventBus } from '../core/EventBus.js';
import { forceCloseDialog } from './NPCSystem.js';
import { AutoPlaySystem } from './AutoPlaySystem.js';

export const TeleportSystem = {
  /**
   * 传送玩家到指定 sub_zone
   * @param {string} subZoneKey 目标 sub_zone key
   * @param {string} source 触发来源：'player_click' | 'auto_resupply' | 'player_death' | 'gm'
   * @param {Object} player
   * @param {Object} game BattleSystem 引用（用于重置战斗现场）
   */
  teleport(subZoneKey, source, player, game) {
    const prev = player.location?.current_sub_zone_key || null;

    if (source === 'player_click' && player.auto_play?.is_auto_play) {
      AutoPlaySystem.stop(player, 'zone_change');
    }

    // 更新位置
    player.location = player.location || {};
    if (prev) {
      player.location.last_wilderness_sub_zone = prev;
    }
    player.location.current_sub_zone_key = subZoneKey;
    player.location.current_map_key = subZoneKey ? 'wilderness_xuanbo_suburb' : 'town_xuanbo';

    // 位置改变后重建战斗现场，避免旧地图怪物残留。
    if (game?.battle) {
      game.battle.monsters = [];
      game.battle._mainTargetKey = null;
      game.battle._currentSubZone = game.subZonesData?.find(s => s.key === subZoneKey) || null;
      game.battle._initialSpawned = false;
    }

    // 关闭 NPC 对话
    forceCloseDialog();

    eventBus.emit('teleport.done', { from: prev, to: subZoneKey, source });
    return true;
  },

  /**
   * 回城（auto_resupply 用）
   */
  teleportToTown(player, game) {
    return this.teleport(null, 'auto_resupply', player, game);
  },

  /**
   * 传送回上一个野外 zone（auto_resupply 用）
   */
  teleportBack(player, game) {
    const target = player.location?.last_wilderness_sub_zone;
    if (target) {
      return this.teleport(target, 'auto_resupply', player, game);
    }
    return false;
  }
};
