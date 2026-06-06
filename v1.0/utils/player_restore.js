/**
 * @file utils/player_restore.js
 * @desc 存档恢复为运行时 player 对象的共享契约
 * @ref 13_save.restore_player_from_save
 */

const DEFAULT_EQUIPPED = {
  weapon: null,
  chest: null,
  gloves: [null, null],
  boots: null,
  inner_armor: null,
  ring: [null, null],
  amulet: null,
  earring: [null, null],
  cape: null,
};

/**
 * restore_player_from_save 契约：反序列化基础字段 → 重建职业运行时字段 → recompute → clamp → 清瞬态。
 */
export function restoreRuntimePlayerFromSave(save, opts = {}) {
  const {
    careersData = [],
    equipmentsData = [],
    attrSystem = null,
  } = opts;

  const player = {
    id: save.player?.id,
    name: save.player?.name,
    level: save.player?.level || 1,
    exp: save.player?.exp || 0,
    career: save.player?.career || 'warrior_blade',
    career_history: save.player?.career_history || [],
    faction: save.player?.faction || 'neutral',
    hp: save.player?.hp || 100,
    mp: save.player?.mp || 100,
    resources: save.resources || { gold: 0, training: 0, merit: 0 },
    qigong: save.qigong || { available_points: 1, invested: {}, attribute_reset_count: 0 },
    learned_martial_arts: save.learned_martial_arts || [],
    equipped: normalizeEquipped(save.equipped),
    inventory: save.inventory || { capacity: 50, slots: [], equipment_instances: {} },
    warehouse: save.warehouse || { capacity: 50, slots: [], equipment_instances: {} },
    quests: save.quests || { accepted: [], completed: [] },
    location: save.location || { current_map_key: 'town_xuanbo', current_sub_zone_key: null, last_wilderness_sub_zone: null },
    auto_play: save.auto_play || { is_auto_play: false, auto_consume: {}, auto_heal_skill: {}, auto_resupply: {} },
    offline: save.offline || { last_save_timestamp: Date.now() },
    statistics: save.statistics || { total_kills: 0, total_playtime_ms: 0, total_gold_earned: 0, total_deaths: 0 },
    _equipTemplates: equipmentsData,
    _isPlayer: true,
  };

  applyCareerRuntimeFields(player, careersData);

  if (attrSystem) attrSystem.recompute(player);
  player.hp = Math.max(0, Math.min(player.hp, player.maxHp || player.hp));
  player.mp = Math.max(0, Math.min(player.mp, player.maxMp || player.mp));

  player.cooldowns = {};
  player.buffs = [];
  player.last_hp_potion_time = 0;
  player.last_mp_potion_time = 0;
  player.last_heal_cast_time = 0;
  player._hooks = {};
  player._baseLevel = player.level;

  return player;
}

function normalizeEquipped(equipped) {
  const normalized = { ...cloneDefaultEquipped(), ...(equipped || {}) };
  for (const slot of ['gloves', 'ring', 'earring']) {
    const value = normalized[slot];
    normalized[slot] = Array.isArray(value) ? [value[0] || null, value[1] || null] : [value || null, null];
  }
  return normalized;
}

export function applyCareerRuntimeFields(player, careersData = []) {
  const currentCareer = careersData.find(c => c.key === player.career) || null;
  const careerFamily = currentCareer?.career_family || inferCareerFamily(player.career);
  const baseCareer = careersData.find(c => c.career_family === careerFamily && c.stage === 'base') || currentCareer || {};
  const baseStats = baseCareer.base_stats || currentCareer?.base_stats || {};
  const growth = currentCareer?.attrGrow || baseCareer.attrGrow || {};

  player.career_family = careerFamily;
  player.str = baseStats.str ?? 0;
  player.dex = baseStats.dex ?? 0;
  player.int = baseStats.int ?? 0;
  player.sta = baseStats.sta ?? 0;
  player.baseHp = baseStats.baseHp ?? 100;
  player.baseMp = baseStats.baseMp ?? 100;
  player.hpGrowth = growth.hpGrowth ?? 60;
  player.mpGrowth = growth.mpGrowth ?? 20;

  player._baseCritR = player._baseCritR ?? 0.30;
  player._baseCritB = player._baseCritB ?? 1.5;
  player._baseSkillCritRate = player._baseSkillCritRate ?? 0;
  player._baseCombo = player._baseCombo ?? 0;
  player._baseShieldRate = player._baseShieldRate ?? 0;
  player._baseCounterDamage = player._baseCounterDamage ?? 0;
  player._baseArmorBreak = player._baseArmorBreak ?? 0;
  player._baseLeech = player._baseLeech ?? 0;
  player._baseHpRecovery = player._baseHpRecovery ?? 1;
  player._baseMpRecovery = player._baseMpRecovery ?? 1;
  player._baseHealBonus = player._baseHealBonus ?? 0;
  player._baseMpCostReduce = player._baseMpCostReduce ?? 0;
  player._baseBuffDuration = player._baseBuffDuration ?? 0;
  player._baseMpRecoveryBonus = player._baseMpRecoveryBonus ?? 0;
  player._baseMf = player._baseMf ?? 0;
  player._baseGf = player._baseGf ?? 0;
  player._baseWeaponSkillBonus = player._baseWeaponSkillBonus ?? 0;
  player._baseWeaponExtraDamage = player._baseWeaponExtraDamage ?? 0;
  player._baseEnhanceSuccessRate = player._baseEnhanceSuccessRate ?? 0;
  player._baseGoldDropBonus = player._baseGoldDropBonus ?? 0;
}

function inferCareerFamily(careerKey = '') {
  if (careerKey.includes('blade')) return 'blade';
  if (careerKey.includes('sword')) return 'sword';
  if (careerKey.includes('spear')) return 'spear';
  if (careerKey.includes('healer') || careerKey.includes('staff')) return 'staff';
  return 'blade';
}

function cloneDefaultEquipped() {
  return JSON.parse(JSON.stringify(DEFAULT_EQUIPPED));
}
