/**
 * @file systems/DropSystem.js
 * @desc 掉落系统：evaluate + 5个drop_*适配
 * @ref 09_economy_drops.md evaluation_flow / drop_adapters / drop_helpers
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { AutoPlaySystem } from './AutoPlaySystem.js?v=release-20260830-3';
import { createEquipmentInstance } from '../entities/EquipmentInstance.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { QigongSystem } from './QigongSystem.js?v=release-20260830-3';
import { creditSafeInteger } from '../utils/numbers.js?v=release-20260830-3';

export class DropSystem {
  /**
   * @param {Object} opts
   * @param {Object} opts.config 全局配置（sub_zone_drops / monster_drop_box / level_diff_modifier）
   * @param {Object} opts.equipmentsData 装备配置列表
   * @param {Object} opts.stonesData 石头配置（4类合并）
   */
  constructor(opts = {}) {
    this._config = opts.config || {};
    this._equipments = opts.equipmentsData || [];
    this._stones = opts.stonesData || {};
    this._taskSys = opts.taskSystemRef || null;
    this._questItems = opts.questItems || {};
  }

  /**
   * 怪物死亡时调用完整掉落流程
   * @param {Object} player
   * @param {Object} monster 怪物实例（含 level / map_key / drop_items）
   * @param {Object} subZoneDrop 对应 sub_zone_drops 配置
   * @ref 09_economy_drops.md evaluation_flow
   */
  evaluate(player, monster, subZoneDrop, subZone = null) {
    const summary = {
      gold: 0,
    };
    if (!player || !monster) return summary;
    const levelDiff = (Number(player.level) || 1) - (Number(monster.level) || 1);
    const mods = this._calcModifiers(levelDiff);

    // ===== 1. 经验 / 历练（Phase 1 已实现，这里仅记录 gold_modifier 用于 2a）=====
    // gold_modifier = mods.gold_modifier

    // ===== 1b. 历练掉落（100%获取，每次击杀1点，受 training_modifier 影响）=====
    if (mods.training_modifier > 0) {
      const finalTraining = Math.ceil(1 * mods.training_modifier);
      const creditedTraining = this._dropTraining(player, finalTraining);
      summary.training = (summary.training || 0) + creditedTraining;
    }

    // ===== 2. 地图掉落池判定 =====
    if (subZoneDrop && subZoneDrop.drop_rolls) {
      for (const roll of subZoneDrop.drop_rolls) {
        if (roll.trigger !== 'always') continue;
        if (roll.enabled === false || roll.enabled === 'false') continue;
        const rollCount = Number.isSafeInteger(Number(roll.roll_count)) && Number(roll.roll_count) > 0
          ? Number(roll.roll_count)
          : 0;
        for (let i = 0; i < rollCount; i++) {
          // 2a. 金币掉落（10%概率）
          if (mods.gold_modifier > 0 && Math.random() < 0.10) {
            const [configuredMin, configuredMax] = subZone?.gold_range || subZoneDrop.gold_range || [8, 15];
            const minGold = Math.max(0, Math.floor(Number(configuredMin) || 0));
            const maxGold = Math.max(minGold, Math.floor(Number(configuredMax) || minGold));
            const baseGold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
            const rawBonus = Number(player.goldDropBonus);
            const goldMultiplier = Math.max(0, 1 + (Number.isFinite(rawBonus) ? rawBonus : 0));
            const finalGold = Math.max(0, Math.floor(baseGold * goldMultiplier * mods.gold_modifier));
            summary.gold += this._dropGold(player, finalGold);
          }
          // 2b. 装备掉落
          if (roll.equipment_pool && roll.equipment_pool.length > 0) {
            const selected = this._weightedRandom(roll.equipment_pool);
            const actualRate = Math.max(0, Math.min(1,
              Number(selected?.drop_rate || 0) * Number(roll.drop_multiplier?.equipment_rate || 1) * mods.rate_modifier
            ));
            if (selected?.key && Math.random() < actualRate) {
              this._dropEquipment(player, selected.key);
            }
          }

          // 2c. 石头掉落
          if (roll.stone_pool && roll.stone_pool.length > 0) {
            const selectedStone = this._weightedRandom(roll.stone_pool);
            const actualStoneRate = Math.max(0, Math.min(1,
              Number(selectedStone?.drop_rate || 0) * Number(roll.drop_multiplier?.stone_rate || 1) * mods.rate_modifier
            ));
            if (selectedStone?.key && Math.random() < actualStoneRate) {
              this._dropStone(player, selectedStone.key);
            }
          }
        }
      }
    }

    // ===== 3. 怪物自身任务物品掉落 =====
    if (monster.drop_items && monster.drop_items.length > 0) {
      for (const di of monster.drop_items) {
        this._dropItemToPlayer(player, di);
      }
    }

    // ===== 4. 盒子掉落（概率 * level_diff_modifier）=====
    const boxConfig = this._config.monster_drop_box;
    if (boxConfig && monster.map_key) {
      const boxKey = boxConfig.box_type_by_map?.[monster.map_key];
      const boxRate = Math.max(0, Math.min(1, Number(boxConfig.drop_rate || 0) * mods.rate_modifier));
      if (boxKey && Math.random() < boxRate) {
        this._dropBox(player, boxKey);
      }
    }

    return summary;
  }

  // ========================
  // drop_* 适配层
  // ========================

  _dropTraining(player, amount) {
    player.resources = player.resources || { gold: 0, training: 0, merit: 0 };
    const credit = creditSafeInteger(player.resources.training, amount);
    player.resources.training = credit.value;
    if (credit.added > 0) {
      eventBus.emit('resources.changed', { player, resource: 'training', amount: credit.added, action: 'add' });
    }
    return credit.added;
  }

  _dropGold(player, amount) {
    player.resources = player.resources || { gold: 0, training: 0, merit: 0 };
    player.statistics = player.statistics || {};
    const goldCredit = creditSafeInteger(player.resources.gold, amount);
    const statisticsCredit = creditSafeInteger(player.statistics.total_gold_earned, amount);
    const credited = Math.min(goldCredit.added, statisticsCredit.added);
    player.resources.gold = goldCredit.value - goldCredit.added + credited;
    player.statistics.total_gold_earned = statisticsCredit.value - statisticsCredit.added + credited;
    if (credited <= 0) return 0;
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: credited, action: 'add' });
    this._logDrop(`[掉落] 金币 +${credited}`);
    return credited;
  }

  _dropEquipment(player, equipmentKey) {
    const template = this._equipments.find(e => e.key === equipmentKey);
    if (!template) return;
    const newInstance = createEquipmentInstance(template);
    const result = InventorySystem.addEquipmentInstance(player, newInstance);
    if (result.success) {
      this._logDrop(`[掉落] 装备 ${template.name}`);
      eventBus.emit('drop.equipment', { equipment_key: equipmentKey, equipment_name: template.name });
    } else {
      this._logDrop(`[掉落] 装备 ${template.name}（背包已满，已丢弃）`);
      eventBus.emit('drop.discarded', { item_key: equipmentKey, item_name: template.name, count: 1, reason: 'inventory_full' });
    }
  }

  _dropStone(player, stoneKey) {
    // 从分组石头数据中查找定义
    let stoneDef = null;
    for (const group of Object.values(this._stones || {})) {
      if (!Array.isArray(group)) continue;
      stoneDef = group.find(s => s.key === stoneKey);
      if (stoneDef) break;
    }
    // 生成带属性的最终 key（使用 -- 分隔符，因为属性 key 自身可能含 _）
    let finalKey = stoneKey;
    if (stoneDef && stoneDef.attribute && stoneDef.attribute.pool && stoneDef.attribute.pool.length > 0) {
      const poolItem = this._weightedRandom(stoneDef.attribute.pool);
      if (!poolItem?.key) return;
      const [rawMin, rawMax] = poolItem.value_range || [0, 0];
      const min = Number.isFinite(Number(rawMin)) ? Number(rawMin) : 0;
      const max = Number.isFinite(Number(rawMax)) ? Math.max(min, Number(rawMax)) : min;
      let value;
      if (min === max) {
        value = min;
      } else {
        value = Math.floor(Math.random() * (max - min + 1) + min);
      }
      finalKey = stoneKey + '--' + poolItem.key + '--' + value;
      if (poolItem.key === 'skill_level_up') {
        finalKey = QigongSystem.bindSkillLevelStone(player, finalKey);
      }
    }
    const result = InventorySystem.add(player, finalKey, 1);
    if (result.success) {
      this._logDrop(`[掉落] 石头 ${finalKey}`);
      eventBus.emit('drop.stone', { stone_key: finalKey, stone_base_name: this._getStoneName(stoneKey) });
    } else {
      this._logDrop(`[掉落] 石头 ${finalKey}（背包已满，已丢弃）`);
      eventBus.emit('drop.discarded', { item_key: finalKey, item_name: this._getStoneName(stoneKey), count: 1, reason: 'inventory_full' });
    }
  }

  _dropItemToPlayer(player, dropItem) {
    // Phase 3: 任务物品掉落校验
    if (!this._taskSys) return false;

    // 查找是否有任务需要这个 item（当前 stage）
    const itemKey = dropItem.item_key;
    if (typeof itemKey !== 'string' || !itemKey) return false;

    // 遍历已接任务检查
    const accepted = player.quests?.accepted || [];
    let matchedQuest = null;
    let requiredCount = 0;

    for (const quest of accepted) {
      const currentStage = Number(quest?.current_stage);
      if (!Number.isSafeInteger(currentStage) || currentStage <= 0) continue;
      quest.current_stage = currentStage;
      const stageBlock = quest.objectives?.find(s => Number(s?.stage) === currentStage);
      if (!stageBlock) continue;
      const item = stageBlock.items?.find(i => i.item_key === itemKey);
      if (item) {
        const count = Number(item.count);
        if (!Number.isSafeInteger(count) || count <= 0) continue;
        if (count > requiredCount) {
          matchedQuest = quest;
          requiredCount = count;
        }
      }
    }

    if (!matchedQuest) return false;  // 未接对应任务

    // 检查背包数量
    const currentCount = InventorySystem.count(player, itemKey);
    if (currentCount >= requiredCount) return false;  // 已够数

    // 判定掉率
    const configuredRate = Number(dropItem.droprate ?? 0.001);
    const droprate = Number.isFinite(configuredRate) ? Math.max(0, Math.min(1, configuredRate)) : 0;
    if (Math.random() >= droprate) return false;

    // 加入背包
    const result = InventorySystem.add(player, itemKey, 1);
    if (result.success) {
      this._logDrop(`[任务物品] ${itemKey} x1（${currentCount + 1}/${requiredCount}）`);
      // stage_advance_check
      this._taskSys.stageAdvanceCheck(player);
      return true;
    }

    player._quest_item_blocked = true;
    player._quest_item_lost_info = {
      item_key: itemKey,
      quest_key: matchedQuest.key,
      current_count: currentCount,
      required_count: requiredCount,
    };
    player._stopped_reason = 'inventory_full_quest_item';
    AutoPlaySystem.stop(player, 'inventory_full_quest_item');
    this._logDrop(`[任务物品] ${itemKey} 无法保存（背包已满），已停止挂机`, 'warn');
    eventBus.emit('drop.discarded', { item_key: itemKey, item_name: itemKey, count: 1, reason: 'inventory_full_quest_item' });
    return false;
  }

  _dropBox(player, boxKey) {
    const result = InventorySystem.add(player, boxKey, 1);
    if (result.success) {
      this._logDrop(`[掉落] 盒子 ${boxKey}`);
      eventBus.emit('drop.box', { box_key: boxKey, box_name: boxKey });
    } else {
      this._logDrop(`[掉落] 盒子 ${boxKey}（背包已满，已丢弃）`);
      eventBus.emit('drop.discarded', { item_key: boxKey, item_name: boxKey, count: 1, reason: 'inventory_full' });
    }
  }

  // ========================
  // helpers
  // ========================

  _logDrop(message, level = 'log') {
    if (globalThis.__rxjhOfflineSimulation) return;
    const logger = level === 'warn' ? console.warn : console.log;
    logger(message);
  }

  _calcModifiers(levelDiff) {
    let rate_modifier = 1.0;
    let exp_modifier = 1.0;
    let training_modifier = 1.0;
    let gold_modifier = 1.0;

    if (levelDiff <= 0) {
      rate_modifier = 1.0;
    } else if (levelDiff === 1) {
      rate_modifier = 0.90;
    } else if (levelDiff === 2) {
      rate_modifier = 0.70;
    } else if (levelDiff === 3) {
      rate_modifier = 0.50;
    } else if (levelDiff === 4) {
      rate_modifier = 0.30;
    } else if (levelDiff === 5) {
      rate_modifier = 0.10;
    } else {
      rate_modifier = 0.0;
    }

    if (levelDiff > 5) {
      exp_modifier = 0;
      training_modifier = 0;
      gold_modifier = 0;
    }

    return { rate_modifier, exp_modifier, training_modifier, gold_modifier };
  }

  getLevelDifferenceModifiers(playerLevel, monsterLevel) {
    return this._calcModifiers((Number(playerLevel) || 1) - (Number(monsterLevel) || 1));
  }

  _weightedRandom(pool) {
    const candidates = (Array.isArray(pool) ? pool : []).filter(item => {
      const weight = Number(item?.weight ?? 1);
      return Number.isFinite(weight) && weight > 0;
    });
    const totalWeight = candidates.reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null;
    let r = Math.random() * totalWeight;
    for (const item of candidates) {
      r -= Number(item.weight ?? 1);
      if (r <= 0) return item;
    }
    return candidates[candidates.length - 1] || null;
  }

  _getStoneName(stoneKey) {
    for (const group of Object.values(this._stones || {})) {
      if (!Array.isArray(group)) continue;
      const stone = group.find(s => s.key === stoneKey);
      if (stone) return stone.name || stoneKey;
    }
    return stoneKey;
  }
}
