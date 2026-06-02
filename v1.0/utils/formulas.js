/**
 * @file utils/formulas.js
 * @desc 经验/升级相关公式
 * @ref 02_attributes.grant_exp / on_level_up / apply_death_exp_loss
 */

/**
 * 计算当前等级到下一级所需经验
 * @param {number} level 当前等级
 * @param {Object} expTable exp_to_next_level map
 * @returns {number}
 */
export function expToNextLevel(level, expTable) {
  return expTable[level] ?? 0;
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
  if (player.level >= config.current_level_cap) return;
  player.exp += amount;

  while (
    player.level < config.current_level_cap &&
    player.exp >= config.exp_to_next_level[player.level]
  ) {
    player.exp -= config.exp_to_next_level[player.level];
    const fromLevel = player.level;
    player.level += 1;
    if (onLevelUp) onLevelUp(player, fromLevel, player.level);
  }

  if (player.level >= config.current_level_cap) {
    player.exp = 0;
  }
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
  const gainedPoints = config.attribute_points.gain_per_level[toLevel] ?? 1;
  player.qigong = player.qigong || { available_points: 0 };
  player.qigong.available_points += gainedPoints;

  if (recomputeFn) recomputeFn(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
}

/**
 * 死亡经验惩罚
 * @param {Object} player
 * @param {Object} config 含 exp_to_next_level
 * @ref 02_attributes.apply_death_exp_loss
 */
export function applyDeathExpLoss(player, config) {
  const loss = Math.floor(config.exp_to_next_level[player.level] * 0.01);
  player.exp = Math.max(0, player.exp - loss);
}

/**
 * 气功点投点（Phase 1 不触发任何加成，仅记录）
 * @param {Object} player
 * @param {string} skillKey
 * @param {number} points
 */
export function assignQigongPoint(player, skillKey, points) {
  player.qigong = player.qigong || { available_points: 0 };
  if (player.qigong.available_points < points) return;
  player.qigong.available_points -= points;
  player.qigong.skills = player.qigong.skills || {};
  player.qigong.skills[skillKey] = (player.qigong.skills[skillKey] || 0) + points;
}