/**
 * @file utils/formulas.js
 * @desc 经验/升级相关公式
 * @ref 02_attributes.grant_exp / on_level_up / apply_death_exp_loss
 */
import { creditSafeInteger } from './numbers.js?v=release-20260830-3';


/**
 * 计算当前等级到下一级所需经验
 * @param {number} level 当前等级
 * @param {Object} expTable exp_to_next_level map
 * @returns {number}
 */
export function expToNextLevel(level, expTable) {
  const required = Number(expTable?.[level]);
  return Number.isSafeInteger(required) && required > 0 ? required : 0;
}

/**
 * 获得经验（可能跨多级）
 * @param {Object} player 玩家对象（引用）
 * @param {number} amount 经验量
 * @param {Object} config 含 exp_to_next_level / current_level_cap / attribute_points
 * @param {Function} onLevelUp 升级回调(from_level, to_level, gained_points)
 * @ref 02_attributes.grant_exp
 */
export function grantExp(player, amount, config, onLevelUp) {
  const cap = Number(config?.current_level_cap);
  const gainedExp = Number(amount);
  if (!player
    || !Number.isSafeInteger(player.level)
    || !Number.isSafeInteger(cap)
    || cap < 1
    || !Number.isSafeInteger(gainedExp)
    || gainedExp <= 0
    || player.level >= cap) return 0;
  if (expToNextLevel(player.level, config?.exp_to_next_level) <= 0) return 0;

  const currentExp = Number(player.exp);
  player.exp = creditSafeInteger(
    Number.isSafeInteger(currentExp) && currentExp >= 0 ? currentExp : 0,
    gainedExp,
  ).value;
  let levelsGained = 0;

  while (player.level < cap) {
    const requiredExp = expToNextLevel(player.level, config?.exp_to_next_level);
    if (requiredExp <= 0 || player.exp < requiredExp) break;
    player.exp -= requiredExp;
    const fromLevel = player.level;
    player.level += 1;
    levelsGained += 1;
    if (onLevelUp) onLevelUp(player, fromLevel, player.level);
  }

  if (player.level >= cap) {
    player.exp = 0;
  }
  return levelsGained;
}

/**
 * 升级回调（HP/MP 回满 + 气功点 +1）
 * @param {Object} player
 * @param {number} fromLevel
 * @param {number} toLevel
 * @param {Object} config 含 attribute_points.gain_per_level
 * @param {Function} recomputeFn AttributeSystem.recompute
 * @ref 02_attributes.on_level_up
 */
export function onLevelUp(player, fromLevel, toLevel, config, recomputeFn) {
  const configuredPoints = Number(config?.attribute_points?.gain_per_level?.[toLevel]);
  const gainedPoints = Number.isSafeInteger(configuredPoints) && configuredPoints >= 0
    ? configuredPoints
    : 1;
  player.qigong = player.qigong || { available_points: 0 };
  const currentPoints = Number(player.qigong.available_points);
  const pointsCredit = creditSafeInteger(
    Number.isSafeInteger(currentPoints) && currentPoints >= 0 ? currentPoints : 0,
    gainedPoints,
  );
  player.qigong.available_points = pointsCredit.value;

  refreshPrimaryAttributes(player);
  if (recomputeFn) recomputeFn(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  return pointsCredit.added;
}

function refreshPrimaryAttributes(player) {
  const baseStats = player._baseStats || {};
  const growth = player._attrGrow || {};
  const levelSteps = Math.max(0, (Number(player.level) || 1) - 1);
  for (const key of ['str', 'dex', 'int', 'sta']) {
    if (baseStats[key] == null || growth[key] == null) continue;
    player[key] = Math.floor(Number(baseStats[key] || 0) + levelSteps * Number(growth[key] || 0));
  }
}

/**
 * 死亡经验惩罚
 * @param {Object} player
 * @param {Object} config 含 exp_to_next_level
 * @ref 02_attributes.apply_death_exp_loss
 */
export function applyDeathExpLoss(player, config) {
  if (!player) return 0;
  const loss = Math.floor(expToNextLevel(player.level, config?.exp_to_next_level) * 0.01);
  const currentExp = Number(player.exp);
  player.exp = Math.max(0, (Number.isSafeInteger(currentExp) && currentExp >= 0 ? currentExp : 0) - loss);
  return loss;
}

/**
 * 气功点投点（Phase 1 不触发任何加成，仅记录）
 * @param {Object} player
 * @param {string} skillKey
 * @param {number} points
 */
export function assignQigongPoint(player, skillKey, points) {
  if (!player
    || typeof skillKey !== 'string'
    || !/^[A-Za-z0-9_.:-]+$/.test(skillKey)
    || !Number.isSafeInteger(points)
    || points <= 0) return false;
  player.qigong = player.qigong || { available_points: 0 };
  const available = Number(player.qigong.available_points);
  if (!Number.isSafeInteger(available) || available < points) return false;
  player.qigong.available_points -= points;
  player.qigong.skills = player.qigong.skills || {};
  const invested = Number(player.qigong.skills[skillKey]);
  const currentInvested = Number.isSafeInteger(invested) && invested >= 0 ? invested : 0;
  if (currentInvested > Number.MAX_SAFE_INTEGER - points) {
    player.qigong.available_points += points;
    return false;
  }
  player.qigong.skills[skillKey] = currentInvested + points;
  return true;
}
