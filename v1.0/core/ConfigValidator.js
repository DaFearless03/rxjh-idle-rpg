/**
 * @file core/ConfigValidator.js
 * @desc 启动配置校验：关键引用 fail-fast，避免进入游戏后才崩。
 * @ref 14_tech.data_loading.validate_against_schema / PHASE_6_PROMPT
 */

const FACTION_CLASSES = new Set(['neutral', 'positive', 'negative']);
const CAREER_FAMILY_CLASSES = new Set(['blade', 'sword', 'spear', 'staff']);
const MONSTER_TYPE_CLASSES = new Set(['normal', 'elite', 'boss']);
const QUEST_TYPES = new Set(['career_transfer']);
const QUEST_REWARD_TYPES = new Set(['unlock_career', 'set_faction']);
const STARTING_WEAPON_BY_FAMILY = {
  blade: 'blade_base_001',
  sword: 'sword_base_001',
  spear: 'spear_base_001',
  staff: 'staff_base_001',
};
const EQUIPMENT_SLOTS = new Set([
  'weapon', 'chest', 'gloves', 'boots', 'inner_armor',
  'ring', 'amulet', 'earring', 'cape',
]);
const QIGONG_EFFECT_TYPES = new Set([
  'atkMin', 'atkMax', 'def', 'maxHp', 'maxMp', 'mdef', 'missing', 'hit',
  'weaponSkillBonus', 'critR', 'critB', 'hpRecovery', 'mpRecovery', 'leech',
  'combo', 'shieldRate', 'counterDamage', 'armorBreak', 'skillCritRate',
  'healBonus', 'mpCostReduce', 'mpRecoveryBonus', 'buffDuration', 'mf', 'gf',
  'atkMinPct', 'atkMaxPct', 'hitPct', 'missingPct', 'maxHpPct', 'maxMpPct',
]);
const ATTRIBUTE_CONSTANT_KEYS = [
  'baseHit', 'dexToHit', 'levelToHit', 'baseMissing', 'dexToMissing',
  'levelToMissing', 'baseAtk', 'strToAtk', 'baseDef', 'staToDef',
  'staToHp', 'intToMp', 'matk_weapon_ratio',
];
const STONE_ATTRIBUTE_HOOKS = new Set([
  'atkSelfAdd',
  'defAdd',
  'enhanceSuccessRateAdd',
  'goldDropBonusAdd',
  'hitAdd',
  'maxHpAdd',
  'missingAdd',
  'skill_level_up',
  'weaponExtraDamageAdd',
  'weaponSkillBonusAdd',
]);
const EQUIPMENT_STAT_KEYS = new Set([
  'atkMin', 'atkMax', 'def', 'hit', 'maxHp', 'maxMp', 'missing', 'matk', 'mdef', 'qigong',
]);
const EQUIPMENT_AFFIX_KEYS = new Set(
  [...EQUIPMENT_STAT_KEYS].filter(key => key !== 'qigong')
);
const STONE_CATEGORY_PREFIXES = {
  cold_jade: 'cold_jade_',
  vajra: 'vajra_',
  enhance: 'enhance_stone_',
  hot_blood: 'hot_blood_',
};
const BUFF_ATTRIBUTE_HOOKS = new Set([
  'atkSelfPct', 'defPct', 'hitPct', 'missingPct', 'maxHpPct', 'maxMpPct',
]);
const NPC_TYPES = new Set(['shop', 'shop_and_enhance', 'quest', 'warehouse']);
const NPC_SHOP_TYPES = new Set(['weapon', 'chest', 'potion']);

function keysOf(list = []) {
  return new Set((Array.isArray(list) ? list : []).map(item => item?.key).filter(Boolean));
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteInRange(value, min = -Infinity, max = Infinity) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function isSafeIntegerInRange(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function isSafeIdentifier(value, maxLength = 256) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/.test(value);
}

function pushIf(errors, condition, message) {
  if (condition) errors.push(message);
}

function asArray(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function validateUniqueKeys(errors, label, list = []) {
  const seen = new Set();
  for (const item of list || []) {
    if (!isRecord(item) || !isSafeIdentifier(item.key)) {
      errors.push(`${label}: missing or invalid key`);
      continue;
    }
    if (seen.has(item.key)) errors.push(`${label}: duplicate key ${item.key}`);
    seen.add(item.key);
  }
}

function validateRange(errors, label, range, { integer = false, min = 0 } = {}) {
  const validNumber = integer ? isSafeIntegerInRange : isFiniteInRange;
  if (!Array.isArray(range)
    || range.length !== 2
    || !validNumber(range[0], min)
    || !validNumber(range[1], min)
    || range[0] > range[1]) {
    errors.push(`${label}: invalid range`);
  }
}

function validateCoreConfig(errors, config) {
  if (!isRecord(config)) {
    errors.push('config: missing or invalid root object');
    return;
  }

  const levelCap = config.current_level_cap;
  const maxLevelCap = config.level_cap_max;
  pushIf(errors, !isSafeIntegerInRange(maxLevelCap, 1, 1000), 'config: invalid level_cap_max');
  pushIf(errors,
    !isSafeIntegerInRange(levelCap, 1, Number.isSafeInteger(maxLevelCap) ? maxLevelCap : 1000),
    'config: invalid current_level_cap');

  pushIf(errors, !isRecord(config.exp_to_next_level), 'config: exp_to_next_level must be an object');
  pushIf(errors, !isRecord(config.attribute_points?.gain_per_level), 'config: attribute_points.gain_per_level must be an object');
  if (isSafeIntegerInRange(levelCap, 1, 1000)) {
    for (let level = 1; level < levelCap; level += 1) {
      pushIf(errors,
        !isSafeIntegerInRange(config.exp_to_next_level?.[level], 1),
        `config: invalid exp_to_next_level.${level}`);
    }
    for (let level = 1; level <= levelCap; level += 1) {
      pushIf(errors,
        !isSafeIntegerInRange(config.attribute_points?.gain_per_level?.[level], 0),
        `config: invalid attribute_points.gain_per_level.${level}`);
    }
  }

  pushIf(errors, !isRecord(config.attribute_constants), 'config: attribute_constants must be an object');
  for (const key of ATTRIBUTE_CONSTANT_KEYS) {
    pushIf(errors,
      !isFiniteInRange(config.attribute_constants?.[key], 0),
      `config: invalid attribute_constants.${key}`);
  }

  const combat = config.combat_constants;
  pushIf(errors, !isRecord(combat), 'config: combat_constants must be an object');
  for (const key of ['armorBreakDefReduce', 'leechRate', 'shieldDamageReduceRate']) {
    pushIf(errors, !isFiniteInRange(combat?.[key], 0, 1), `config: invalid combat_constants.${key}`);
  }
  for (const key of ['counterDamageRate', 'skillCritDamageBonus']) {
    pushIf(errors, !isFiniteInRange(combat?.[key], 0), `config: invalid combat_constants.${key}`);
  }
  pushIf(errors, !isSafeIntegerInRange(combat?.comboHits, 1, 100), 'config: invalid combat_constants.comboHits');

  const model = config.battle_flow?.battle_model;
  const spawn = model?.monster_spawn;
  const monsterCap = model?.same_zone_monster_cap ?? spawn?.same_zone_monster_cap;
  pushIf(errors, !isRecord(model), 'config: battle_flow.battle_model must be an object');
  pushIf(errors, !isRecord(spawn), 'config: battle model monster_spawn must be an object');
  pushIf(errors, !isSafeIntegerInRange(monsterCap, 1, 1000), 'config: invalid same_zone_monster_cap');
  pushIf(errors,
    !isSafeIntegerInRange(model?.elite_cap_per_zone, 0, Number.isSafeInteger(monsterCap) ? monsterCap : 1000),
    'config: invalid elite_cap_per_zone');
  pushIf(errors,
    !isSafeIntegerInRange(spawn?.initial_spawn_count, 0, Number.isSafeInteger(monsterCap) ? monsterCap : 1000),
    'config: invalid initial_spawn_count');
  pushIf(errors, !isFiniteInRange(spawn?.spawn_interval_seconds, 0.01, 3600), 'config: invalid spawn_interval_seconds');
  pushIf(errors, !isFiniteInRange(spawn?.preheat_seconds, 0, 3600), 'config: invalid preheat_seconds');
  pushIf(errors,
    !isFiniteInRange(model?.monster_attack?.atk_interval_ms, 10, 3600000),
    'config: invalid monster_attack.atk_interval_ms');
  const ratio = String(spawn?.spawn_weight?.elite_vs_normal || '').split(':').map(Number);
  pushIf(errors,
    ratio.length !== 2
      || ratio.some(weight => !isFiniteInRange(weight, Number.EPSILON))
      || !Number.isFinite(ratio.reduce((sum, weight) => sum + weight, 0)),
    'config: invalid spawn_weight.elite_vs_normal');
}

function flattenStones(stonesData = {}) {
  return Object.values(stonesData).flatMap(group => Array.isArray(group) ? group : []);
}

export function validateGameConfig(data) {
  const errors = [];
  const warnings = [];
  let {
    config = null,
    careersData = [],
    monstersData = [],
    equipmentsData = [],
    stonesData = {},
    subZonesData = [],
    subZoneDropsData = [],
    monsterDropBoxData = {},
    boxesData = [],
    npcsData = [],
    questsData = {},
    qigongsData = [],
    buffsData = [],
    martialArtsData = [],
  } = data || {};

  const collections = {
    careers: careersData,
    monsters: monstersData,
    equipments: equipmentsData,
    sub_zones: subZonesData,
    sub_zone_drops: subZoneDropsData,
    boxes: boxesData,
    npcs: npcsData,
    qigongs: qigongsData,
    buffs: buffsData,
    martial_arts: martialArtsData,
  };
  for (const [label, list] of Object.entries(collections)) {
    pushIf(errors, !Array.isArray(list) || list.length === 0, `${label}: expected non-empty array`);
  }
  pushIf(errors, !isRecord(stonesData), 'stones: expected object of arrays');
  pushIf(errors, !isRecord(questsData), 'quests: expected object');
  pushIf(errors, !isRecord(monsterDropBoxData), 'monster_drop_box: expected object');
  careersData = Array.isArray(careersData) ? careersData : [];
  monstersData = Array.isArray(monstersData) ? monstersData : [];
  equipmentsData = Array.isArray(equipmentsData) ? equipmentsData : [];
  subZonesData = Array.isArray(subZonesData) ? subZonesData : [];
  subZoneDropsData = Array.isArray(subZoneDropsData) ? subZoneDropsData : [];
  boxesData = Array.isArray(boxesData) ? boxesData : [];
  npcsData = Array.isArray(npcsData) ? npcsData : [];
  qigongsData = Array.isArray(qigongsData) ? qigongsData : [];
  buffsData = Array.isArray(buffsData) ? buffsData : [];
  martialArtsData = Array.isArray(martialArtsData) ? martialArtsData : [];
  stonesData = isRecord(stonesData) ? stonesData : {};
  questsData = isRecord(questsData) ? questsData : {};
  monsterDropBoxData = isRecord(monsterDropBoxData) ? monsterDropBoxData : {};

  validateCoreConfig(errors, config);

  const stones = flattenStones(stonesData);
  const questTemplates = Array.isArray(questsData.quest_templates) ? questsData.quest_templates : [];
  const questItems = isRecord(questsData.quest_items) ? questsData.quest_items : {};
  pushIf(errors, questTemplates.length === 0, 'quest_templates: expected non-empty array');
  pushIf(errors, !isRecord(questsData.quest_items), 'quest_items: expected object');
  for (const [group, items] of Object.entries(stonesData)) {
    pushIf(errors, !Array.isArray(items) || items.length === 0, `stones.${group}: expected non-empty array`);
  }
  const careerKeys = keysOf(careersData);
  const monsterKeys = keysOf(monstersData);
  const equipmentKeys = keysOf(equipmentsData);
  const stoneKeys = keysOf(stones);
  const subZoneKeys = keysOf(subZonesData);
  const boxKeys = keysOf(boxesData);
  const buffKeys = keysOf(buffsData);
  const questKeys = keysOf(questTemplates);
  const questItemKeys = new Set(Object.keys(questItems));
  for (const [key, item] of Object.entries(questItems)) {
    pushIf(errors, !isSafeIdentifier(key), `quest_items: invalid key ${key}`);
    pushIf(errors, !isRecord(item), `quest_items ${key}: expected object`);
    pushIf(errors, typeof item?.name !== 'string' || !item.name, `quest_items ${key}: invalid name`);
    pushIf(errors, !isSafeIntegerInRange(item?.sell_price, 0), `quest_items ${key}: invalid sell_price`);
  }
  const potionKeys = new Set(
    npcsData
      .filter(npc => isRecord(npc) && npc.shop_type === 'potion')
      .flatMap(npc => npc.items || [])
      .map(item => item?.item_key)
      .filter(Boolean)
  );
  const itemKeys = new Set([...equipmentKeys, ...stoneKeys, ...potionKeys, ...questItemKeys, ...boxKeys]);
  const itemClassGroups = {
    equipment: equipmentKeys,
    stone: stoneKeys,
    potion: potionKeys,
    quest_item: questItemKeys,
    box: boxKeys,
  };
  const itemClassOwners = new Map();
  for (const [itemClass, keys] of Object.entries(itemClassGroups)) {
    for (const key of keys) {
      const previousClass = itemClassOwners.get(key);
      if (previousClass && previousClass !== itemClass) {
        errors.push(`item ${key}: belongs to both ${previousClass} and ${itemClass}`);
      } else {
        itemClassOwners.set(key, itemClass);
      }
    }
  }

  validateUniqueKeys(errors, 'careers', careersData);
  validateUniqueKeys(errors, 'monsters', monstersData);
  validateUniqueKeys(errors, 'equipments', equipmentsData);
  validateUniqueKeys(errors, 'stones', stones);
  validateUniqueKeys(errors, 'sub_zones', subZonesData);
  validateUniqueKeys(errors, 'sub_zone_drops', subZoneDropsData);
  validateUniqueKeys(errors, 'boxes', boxesData);
  validateUniqueKeys(errors, 'npcs', npcsData);
  validateUniqueKeys(errors, 'quest_templates', questTemplates);
  validateUniqueKeys(errors, 'qigongs', qigongsData);
  validateUniqueKeys(errors, 'buffs', buffsData);
  validateUniqueKeys(errors, 'martial_arts', martialArtsData);

  careersData = careersData.filter(isRecord);
  monstersData = monstersData.filter(isRecord);
  equipmentsData = equipmentsData.filter(isRecord);
  subZonesData = subZonesData.filter(isRecord);
  subZoneDropsData = subZoneDropsData.filter(isRecord);
  boxesData = boxesData.filter(isRecord);
  npcsData = npcsData.filter(isRecord);
  qigongsData = qigongsData.filter(isRecord);
  buffsData = buffsData.filter(isRecord);
  martialArtsData = martialArtsData.filter(isRecord);
  const stoneRecords = stones.filter(isRecord);
  const questTemplateRecords = questTemplates.filter(isRecord);
  const careerByKey = new Map(careersData.map(career => [career.key, career]));
  const previousCareerStage = { t1: 'base', t2: 't1', t3: 't2' };
  const supportedLevelMax = isSafeIntegerInRange(config?.level_cap_max, 1, 1000)
    ? config.level_cap_max
    : 1000;
  const careerPaths = new Set();

  for (const career of careersData) {
    pushIf(errors, !FACTION_CLASSES.has(career.faction), `career ${career.key}: invalid faction ${career.faction}`);
    pushIf(errors, !CAREER_FAMILY_CLASSES.has(career.career_family), `career ${career.key}: invalid career_family ${career.career_family}`);
    pushIf(errors, !['base', 't1', 't2', 't3'].includes(career.stage), `career ${career.key}: invalid stage ${career.stage}`);
    pushIf(errors, !isRecord(career.attrGrow), `career ${career.key}: invalid attrGrow`);
    for (const key of ['str', 'dex', 'int', 'sta', 'hpGrowth', 'mpGrowth']) {
      pushIf(errors, !isFiniteInRange(career.attrGrow?.[key], 0), `career ${career.key}: invalid attrGrow.${key}`);
    }
    if (career.stage === 'base') {
      pushIf(errors, !isRecord(career.base_stats), `career ${career.key}: invalid base_stats`);
      for (const key of ['str', 'dex', 'int', 'sta', 'baseHp', 'baseMp']) {
        pushIf(errors, !isFiniteInRange(career.base_stats?.[key], 0), `career ${career.key}: invalid base_stats.${key}`);
      }
      pushIf(errors, career.faction !== 'neutral', `career ${career.key}: base career must be neutral`);
      pushIf(errors, career.requirement?.role !== career.key, `career ${career.key}: base requirement.role must match career key`);
    } else {
      const prerequisite = careerByKey.get(career.requirement?.career);
      pushIf(errors,
        !prerequisite,
        `career ${career.key}: prerequisite career ${career.requirement?.career} missing`);
      pushIf(errors,
        !!prerequisite && prerequisite.career_family !== career.career_family,
        `career ${career.key}: prerequisite must use the same career_family`);
      pushIf(errors,
        !!prerequisite && prerequisite.stage !== previousCareerStage[career.stage],
        `career ${career.key}: prerequisite must be stage ${previousCareerStage[career.stage]}`);
      pushIf(errors,
        !!prerequisite
          && Number.isFinite(prerequisite.requirement?.level)
          && Number.isFinite(career.requirement?.level)
          && career.requirement.level <= prerequisite.requirement.level,
        `career ${career.key}: requirement.level must increase from prerequisite`);
      if (career.stage === 't1') {
        pushIf(errors, career.faction !== 'neutral', `career ${career.key}: t1 career must be neutral`);
      } else if (career.stage === 't2') {
        pushIf(errors, !['positive', 'negative'].includes(career.faction), `career ${career.key}: t2 career must choose a faction`);
      } else if (career.stage === 't3') {
        pushIf(errors,
          !!prerequisite && career.faction !== prerequisite.faction,
          `career ${career.key}: t3 faction must match prerequisite`);
      }
    }
    pushIf(errors,
      !isSafeIntegerInRange(career.requirement?.level, 1, supportedLevelMax),
      `career ${career.key}: invalid requirement.level`);
    const pathFaction = ['base', 't1'].includes(career.stage) ? 'neutral' : career.faction;
    const pathKey = `${career.career_family}:${career.stage}:${pathFaction}`;
    pushIf(errors, careerPaths.has(pathKey), `careers: duplicate progression path ${pathKey}`);
    careerPaths.add(pathKey);
  }

  for (const equipment of equipmentsData) {
    pushIf(errors, !FACTION_CLASSES.has(equipment.faction), `equipment ${equipment.key}: invalid faction ${equipment.faction}`);
    pushIf(errors, !EQUIPMENT_SLOTS.has(equipment.slot), `equipment ${equipment.key}: invalid slot ${equipment.slot}`);
    pushIf(errors, !isSafeIntegerInRange(equipment.required_level, 0), `equipment ${equipment.key}: invalid required_level`);
    pushIf(errors, !isSafeIntegerInRange(equipment.required_transfer, 0), `equipment ${equipment.key}: invalid required_transfer`);
    pushIf(errors, typeof equipment.purchaseable !== 'boolean', `equipment ${equipment.key}: purchaseable must be boolean`);
    pushIf(errors, !isRecord(equipment.base_stats), `equipment ${equipment.key}: invalid base_stats`);
    for (const [stat, value] of Object.entries(equipment.base_stats || {})) {
      pushIf(errors, !EQUIPMENT_STAT_KEYS.has(stat), `equipment ${equipment.key}: unknown base_stats.${stat}`);
      pushIf(errors, !isFiniteInRange(value, 0), `equipment ${equipment.key}: invalid base_stats.${stat}`);
    }
    if (equipment.extra_affixes != null) {
      pushIf(errors, !isRecord(equipment.extra_affixes), `equipment ${equipment.key}: invalid extra_affixes`);
      for (const [stat, value] of Object.entries(isRecord(equipment.extra_affixes) ? equipment.extra_affixes : {})) {
        pushIf(errors, !EQUIPMENT_AFFIX_KEYS.has(stat), `equipment ${equipment.key}: unknown extra_affixes.${stat}`);
        pushIf(errors, !isFiniteInRange(value, 0), `equipment ${equipment.key}: invalid extra_affixes.${stat}`);
      }
    }
    if (equipment.base_stats?.atkMin != null || equipment.base_stats?.atkMax != null) {
      pushIf(errors,
        !isFiniteInRange(equipment.base_stats?.atkMin, 0)
          || !isFiniteInRange(equipment.base_stats?.atkMax, equipment.base_stats?.atkMin),
        `equipment ${equipment.key}: invalid attack range`);
    }
    for (const family of asArray(equipment.required_career)) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(family), `equipment ${equipment.key}: invalid required_career ${family}`);
    }
  }
  for (const [family, equipmentKey] of Object.entries(STARTING_WEAPON_BY_FAMILY)) {
    const equipment = equipmentsData.find(item => item.key === equipmentKey);
    pushIf(errors, !equipment, `starting equipment ${equipmentKey}: missing for ${family}`);
    pushIf(errors, !!equipment && equipment.slot !== 'weapon', `starting equipment ${equipmentKey}: must be a weapon`);
    pushIf(errors,
      !!equipment && !asArray(equipment.required_career).includes(family),
      `starting equipment ${equipmentKey}: career ${family} not allowed`);
  }

  for (const monster of monstersData) {
    pushIf(errors, !MONSTER_TYPE_CLASSES.has(monster.monster_type), `monster ${monster.key}: invalid monster_type ${monster.monster_type}`);
    pushIf(errors, !isSafeIntegerInRange(monster.level, 1), `monster ${monster.key}: invalid level`);
    pushIf(errors, !isSafeIntegerInRange(monster.exp, 0), `monster ${monster.key}: invalid exp`);
    for (const stat of ['atk', 'def']) {
      pushIf(errors, !isFiniteInRange(monster[stat], 0), `monster ${monster.key}: invalid ${stat}`);
    }
    for (const stat of ['hit', 'missing']) {
      if (monster[stat] != null) {
        pushIf(errors, !isFiniteInRange(monster[stat], 0), `monster ${monster.key}: invalid ${stat}`);
      }
    }
    for (const stat of ['armorBreak', 'shieldRate', 'counterDamage', 'leech']) {
      if (monster[stat] != null) {
        pushIf(errors, !isFiniteInRange(monster[stat], 0, 1), `monster ${monster.key}: invalid ${stat}`);
      }
    }
    pushIf(errors, !isFiniteInRange(monster.hp, Number.EPSILON), `monster ${monster.key}: invalid hp`);
    if (monster.critR != null) pushIf(errors, !isFiniteInRange(monster.critR, 0, 1), `monster ${monster.key}: invalid critR`);
    if (monster.critB != null) pushIf(errors, !isFiniteInRange(monster.critB, 1), `monster ${monster.key}: invalid critB`);
    if (monster.passive != null) pushIf(errors, typeof monster.passive !== 'boolean', `monster ${monster.key}: passive must be boolean`);
    pushIf(errors, monster.drop_items != null && !Array.isArray(monster.drop_items), `monster ${monster.key}: drop_items must be an array`);
    pushIf(errors, Array.isArray(monster.drop_items) && monster.drop_items.some(drop => !isRecord(drop)), `monster ${monster.key}: invalid drop_items entry`);
    for (const drop of Array.isArray(monster.drop_items) ? monster.drop_items.filter(isRecord) : []) {
      pushIf(errors, !questItemKeys.has(drop.item_key), `monster ${monster.key}: drop_items ${drop.item_key} missing in quest_items`);
      pushIf(errors, !isFiniteInRange(drop.droprate, 0, 1), `monster ${monster.key}: invalid drop rate for ${drop.item_key}`);
    }
  }

  for (const subZone of subZonesData) {
    pushIf(errors, !Array.isArray(subZone.monsters) || subZone.monsters.length === 0, `sub_zone ${subZone.key}: monsters empty`);
    for (const monsterKey of Array.isArray(subZone.monsters) ? subZone.monsters : []) {
      pushIf(errors, !monsterKeys.has(monsterKey), `sub_zone ${subZone.key}: monster ${monsterKey} missing`);
    }
    validateRange(errors, `sub_zone ${subZone.key} gold_range`, subZone.gold_range, { integer: true });
    if (subZone.level_range != null) {
      validateRange(errors, `sub_zone ${subZone.key} level_range`, subZone.level_range, { integer: true, min: 1 });
    }
  }

  for (const quest of questTemplateRecords) {
    pushIf(errors, !QUEST_TYPES.has(quest.type), `quest ${quest.key}: unsupported type ${quest.type}`);
    if (quest.faction) {
      pushIf(errors, !FACTION_CLASSES.has(quest.faction), `quest ${quest.key}: invalid faction ${quest.faction}`);
    }
    pushIf(errors, !isSafeIntegerInRange(quest.required_transfer, 0, 2), `quest ${quest.key}: invalid required_transfer`);
    pushIf(errors, !isSafeIntegerInRange(quest.target_transfer, 1, 3), `quest ${quest.key}: invalid target_transfer`);
    pushIf(errors,
      Number.isSafeInteger(quest.required_transfer)
        && Number.isSafeInteger(quest.target_transfer)
        && quest.target_transfer !== quest.required_transfer + 1,
      `quest ${quest.key}: target_transfer must follow required_transfer`);
    pushIf(errors, !isRecord(quest.prerequisite), `quest ${quest.key}: invalid prerequisite`);
    pushIf(errors,
      !isSafeIntegerInRange(quest.prerequisite?.level, 1, supportedLevelMax),
      `quest ${quest.key}: invalid prerequisite.level`);
    if (quest.target_transfer >= 2) {
      pushIf(errors,
        !['positive', 'negative'].includes(quest.faction),
        `quest ${quest.key}: transfer ${quest.target_transfer} requires a faction`);
    }
    pushIf(errors, !Array.isArray(quest.objectives) || quest.objectives.length === 0, `quest ${quest.key}: objectives empty`);
    const stageNumbers = new Set();
    const objectiveTotals = new Map();
    const objectiveItemKeys = new Set();
    for (const stage of Array.isArray(quest.objectives) ? quest.objectives : []) {
      if (!isRecord(stage)) {
        errors.push(`quest ${quest.key}: invalid objective`);
        continue;
      }
      pushIf(errors, !isSafeIntegerInRange(stage?.stage, 1, 1000), `quest ${quest.key}: invalid objective stage`);
      if (Number.isSafeInteger(stage?.stage)) {
        pushIf(errors, stageNumbers.has(stage.stage), `quest ${quest.key}: duplicate objective stage ${stage.stage}`);
        stageNumbers.add(stage.stage);
      }
      pushIf(errors, !Array.isArray(stage?.items) || stage.items.length === 0, `quest ${quest.key}: stage ${stage?.stage} items empty`);
      for (const item of Array.isArray(stage?.items) ? stage.items : []) {
        if (!isRecord(item)) {
          errors.push(`quest ${quest.key}: stage ${stage.stage} has invalid item`);
          continue;
        }
        pushIf(errors, !questItemKeys.has(item.item_key), `quest ${quest.key}: objective item ${item.item_key} missing in quest_items`);
        if (typeof item.item_key === 'string') {
          pushIf(errors, objectiveItemKeys.has(item.item_key), `quest ${quest.key}: duplicate objective item ${item.item_key}`);
          objectiveItemKeys.add(item.item_key);
        }
        if (item.drop_monster) {
          pushIf(errors, !monsterKeys.has(item.drop_monster), `quest ${quest.key}: drop_monster ${item.drop_monster} missing in monsters`);
          const sourceMonster = monstersData.find(monster => monster.key === item.drop_monster);
          pushIf(errors,
            !!sourceMonster
              && !(Array.isArray(sourceMonster.drop_items) ? sourceMonster.drop_items : [])
                .some(drop => drop?.item_key === item.item_key),
            `quest ${quest.key}: ${item.drop_monster} does not drop ${item.item_key}`);
        }
        pushIf(errors, !isSafeIntegerInRange(item.count, 1), `quest ${quest.key}: invalid objective count for ${item.item_key}`);
        if (typeof item.item_key === 'string' && isSafeIntegerInRange(item.count, 1)) {
          const existing = objectiveTotals.get(item.item_key) || 0;
          if (item.count > Number.MAX_SAFE_INTEGER - existing) {
            errors.push(`quest ${quest.key}: objective total overflow for ${item.item_key}`);
          } else {
            objectiveTotals.set(item.item_key, existing + item.count);
          }
        }
        if (item.exclusive_group != null) {
          pushIf(errors, !isSafeIdentifier(item.exclusive_group), `quest ${quest.key}: invalid exclusive_group`);
        }
      }
    }
    if (stageNumbers.size > 0) {
      const stages = [...stageNumbers].sort((a, b) => a - b);
      pushIf(errors, stages.some((stage, index) => stage !== index + 1), `quest ${quest.key}: objective stages must be sequential`);
    }
    pushIf(errors, !Array.isArray(quest.rewards) || quest.rewards.length === 0, `quest ${quest.key}: rewards empty`);
    const unlockedCareerKeys = [];
    const setFactionRewards = [];
    for (const reward of Array.isArray(quest.rewards) ? quest.rewards : []) {
      if (!isRecord(reward)) {
        errors.push(`quest ${quest.key}: invalid reward`);
        continue;
      }
      pushIf(errors, !QUEST_REWARD_TYPES.has(reward?.type), `quest ${quest.key}: unsupported reward type ${reward?.type}`);
      if (reward.type === 'unlock_career') {
        pushIf(errors, !Array.isArray(reward.careers) || reward.careers.length === 0, `quest ${quest.key}: reward careers empty`);
        for (const careerKey of Array.isArray(reward.careers) ? reward.careers : []) {
          pushIf(errors, !careerKeys.has(careerKey), `quest ${quest.key}: reward career ${careerKey} missing in careers`);
          unlockedCareerKeys.push(careerKey);
        }
      }
      if (reward.type === 'set_faction') {
        pushIf(errors, !FACTION_CLASSES.has(reward.faction), `quest ${quest.key}: reward invalid faction ${reward.faction}`);
        setFactionRewards.push(reward.faction);
      }
    }
    const expectedStage = { 1: 't1', 2: 't2', 3: 't3' }[quest.target_transfer];
    const expectedFaction = quest.target_transfer === 1 ? 'neutral' : quest.faction;
    const rewardedFamilies = new Map();
    const seenRewardCareers = new Set();
    for (const careerKey of unlockedCareerKeys) {
      const career = careerByKey.get(careerKey);
      pushIf(errors, seenRewardCareers.has(careerKey), `quest ${quest.key}: duplicate reward career ${careerKey}`);
      seenRewardCareers.add(careerKey);
      if (!career) continue;
      pushIf(errors, career.stage !== expectedStage, `quest ${quest.key}: reward career ${careerKey} must be stage ${expectedStage}`);
      pushIf(errors, career.faction !== expectedFaction, `quest ${quest.key}: reward career ${careerKey} has wrong faction`);
      pushIf(errors,
        career.requirement?.level !== quest.prerequisite?.level,
        `quest ${quest.key}: reward career ${careerKey} has mismatched level requirement`);
      rewardedFamilies.set(career.career_family, (rewardedFamilies.get(career.career_family) || 0) + 1);
    }
    for (const family of CAREER_FAMILY_CLASSES) {
      pushIf(errors,
        rewardedFamilies.get(family) !== 1,
        `quest ${quest.key}: must unlock exactly one ${family} career`);
    }
    if (quest.target_transfer === 2) {
      pushIf(errors,
        setFactionRewards.length !== 1 || setFactionRewards[0] !== quest.faction,
        `quest ${quest.key}: transfer 2 must set its selected faction`);
    } else {
      pushIf(errors, setFactionRewards.length > 0, `quest ${quest.key}: unexpected set_faction reward`);
    }
  }

  for (const dropTable of subZoneDropsData) {
    pushIf(errors, dropTable.sub_zone_key !== 'default' && !subZoneKeys.has(dropTable.sub_zone_key), `sub_zone_drops ${dropTable.key}: sub_zone_key ${dropTable.sub_zone_key} missing`);
    pushIf(errors, !Array.isArray(dropTable.drop_rolls) || dropTable.drop_rolls.length === 0, `sub_zone_drops ${dropTable.key}: drop_rolls empty`);
    for (const roll of Array.isArray(dropTable.drop_rolls) ? dropTable.drop_rolls : []) {
      if (!isRecord(roll)) {
        errors.push(`sub_zone_drops ${dropTable.key}: invalid roll`);
        continue;
      }
      pushIf(errors, typeof roll.enabled !== 'boolean', `sub_zone_drops ${dropTable.key}: roll enabled must be boolean`);
      pushIf(errors, roll.trigger !== 'always', `sub_zone_drops ${dropTable.key}: unsupported trigger ${roll.trigger}`);
      pushIf(errors, !isSafeIntegerInRange(roll.roll_count, 1, 1000), `sub_zone_drops ${dropTable.key}: invalid roll_count`);
      pushIf(errors, roll.equipment_pool != null && !Array.isArray(roll.equipment_pool), `sub_zone_drops ${dropTable.key}: equipment_pool must be an array`);
      pushIf(errors, roll.stone_pool != null && !Array.isArray(roll.stone_pool), `sub_zone_drops ${dropTable.key}: stone_pool must be an array`);
      pushIf(errors, Array.isArray(roll.equipment_pool) && roll.equipment_pool.some(item => !isRecord(item)), `sub_zone_drops ${dropTable.key}: invalid equipment_pool entry`);
      pushIf(errors, Array.isArray(roll.stone_pool) && roll.stone_pool.some(item => !isRecord(item)), `sub_zone_drops ${dropTable.key}: invalid stone_pool entry`);
      for (const item of Array.isArray(roll.equipment_pool) ? roll.equipment_pool.filter(isRecord) : []) {
        pushIf(errors, !equipmentKeys.has(item.key), `sub_zone_drops ${dropTable.key}: equipment_pool ${item.key} missing in equipments`);
        pushIf(errors, !isFiniteInRange(item.weight, Number.EPSILON), `sub_zone_drops ${dropTable.key}: invalid equipment weight ${item.key}`);
        pushIf(errors, !isFiniteInRange(item.drop_rate, 0, 1), `sub_zone_drops ${dropTable.key}: invalid equipment rate ${item.key}`);
      }
      for (const item of Array.isArray(roll.stone_pool) ? roll.stone_pool.filter(isRecord) : []) {
        pushIf(errors, !stoneKeys.has(item.key), `sub_zone_drops ${dropTable.key}: stone_pool ${item.key} missing in stones`);
        pushIf(errors, !isFiniteInRange(item.weight, Number.EPSILON), `sub_zone_drops ${dropTable.key}: invalid stone weight ${item.key}`);
        pushIf(errors, !isFiniteInRange(item.drop_rate, 0, 1), `sub_zone_drops ${dropTable.key}: invalid stone rate ${item.key}`);
      }
      for (const [poolName, pool] of [
        ['equipment_pool', roll.equipment_pool],
        ['stone_pool', roll.stone_pool],
      ]) {
        const weightTotal = (Array.isArray(pool) ? pool : [])
          .reduce((sum, item) => sum + Number(item?.weight || 0), 0);
        pushIf(errors, !Number.isFinite(weightTotal), `sub_zone_drops ${dropTable.key}: ${poolName} weight total overflow`);
      }
    }
  }

  const dropTableZones = new Set(subZoneDropsData.map(table => table.sub_zone_key));
  const seenDropTableZones = new Set();
  for (const dropTable of subZoneDropsData) {
    pushIf(errors,
      seenDropTableZones.has(dropTable.sub_zone_key),
      `sub_zone_drops: duplicate sub_zone_key ${dropTable.sub_zone_key}`);
    seenDropTableZones.add(dropTable.sub_zone_key);
  }
  for (const subZoneKey of subZoneKeys) {
    pushIf(errors, !dropTableZones.has(subZoneKey) && !dropTableZones.has('default'), `sub_zone ${subZoneKey}: missing drop table`);
  }

  pushIf(errors, !isFiniteInRange(monsterDropBoxData.drop_rate, 0, 1), 'monster_drop_box: invalid drop_rate');
  pushIf(errors, !isRecord(monsterDropBoxData.box_type_by_map), 'monster_drop_box: invalid box_type_by_map');
  for (const [subZoneKey, boxKey] of Object.entries(monsterDropBoxData.box_type_by_map || {})) {
    pushIf(errors, !subZoneKeys.has(subZoneKey), `monster_drop_box: sub_zone ${subZoneKey} missing`);
    pushIf(errors, !boxKeys.has(boxKey), `monster_drop_box: box ${boxKey} missing in boxes`);
  }

  for (const box of boxesData) {
    pushIf(errors, !Array.isArray(box.openable_items) || box.openable_items.length === 0, `box ${box.key}: openable_items empty`);
    pushIf(errors, Array.isArray(box.openable_items) && box.openable_items.some(item => !isRecord(item)), `box ${box.key}: invalid openable_items entry`);
    for (const item of Array.isArray(box.openable_items) ? box.openable_items.filter(isRecord) : []) {
      pushIf(errors, !itemKeys.has(item.item_key), `box ${box.key}: reward ${item.item_key} missing in item config`);
      pushIf(errors, !isFiniteInRange(item.weight, Number.EPSILON), `box ${box.key}: reward ${item.item_key} invalid weight`);
    }
    const rewardWeightTotal = (Array.isArray(box.openable_items) ? box.openable_items : [])
      .reduce((sum, item) => sum + Number(item?.weight || 0), 0);
    pushIf(errors, !Number.isFinite(rewardWeightTotal), `box ${box.key}: reward weight total overflow`);
  }

  for (const stone of stoneRecords) {
    pushIf(errors, !['cold_jade', 'vajra', 'enhance', 'hot_blood'].includes(stone.category), `stone ${stone.key}: invalid category ${stone.category}`);
    const expectedPrefix = STONE_CATEGORY_PREFIXES[stone.category];
    pushIf(errors, !!expectedPrefix && !stone.key.startsWith(expectedPrefix), `stone ${stone.key}: key does not match category ${stone.category}`);
    pushIf(errors, !isFiniteInRange(stone.drop?.drop_rate, 0, 1), `stone ${stone.key}: invalid drop_rate`);
    pushIf(errors, !isSafeIntegerInRange(stone.drop?.min_level, 1), `stone ${stone.key}: invalid min_level`);
    pushIf(errors, stone.attribute?.pool != null && !Array.isArray(stone.attribute.pool), `stone ${stone.key}: attribute.pool must be an array`);
    pushIf(errors, Array.isArray(stone.attribute?.pool) && stone.attribute.pool.some(hook => !isRecord(hook)), `stone ${stone.key}: invalid attribute.pool entry`);
    for (const hook of Array.isArray(stone.attribute?.pool) ? stone.attribute.pool.filter(isRecord) : []) {
      pushIf(errors, !STONE_ATTRIBUTE_HOOKS.has(hook.key), `stone ${stone.key}: unknown attribute hook ${hook.key}`);
      pushIf(errors, !isFiniteInRange(hook.weight, Number.EPSILON), `stone ${stone.key}: invalid hook weight ${hook.key}`);
      validateRange(errors, `stone ${stone.key} ${hook.key} value_range`, hook.value_range);
    }
    const hookWeightTotal = (Array.isArray(stone.attribute?.pool) ? stone.attribute.pool : [])
      .reduce((sum, hook) => sum + Number(hook?.weight || 0), 0);
    pushIf(errors, !Number.isFinite(hookWeightTotal), `stone ${stone.key}: attribute.pool weight total overflow`);
  }

  for (const qigong of qigongsData) {
    for (const family of asArray(qigong.career_family)) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(family), `qigong ${qigong.key}: invalid career_family ${family}`);
    }
    pushIf(errors, !isSafeIntegerInRange(qigong.unlock?.min_transfer, 0), `qigong ${qigong.key}: invalid min_transfer`);
    pushIf(errors, !isSafeIntegerInRange(qigong.unlock?.min_level, 1), `qigong ${qigong.key}: invalid min_level`);
    pushIf(errors, !isSafeIntegerInRange(qigong.max_level, 1), `qigong ${qigong.key}: invalid max_level`);
    pushIf(errors, !QIGONG_EFFECT_TYPES.has(qigong.effect?.type), `qigong ${qigong.key}: invalid effect ${qigong.effect?.type}`);
    pushIf(errors, !isFiniteInRange(qigong.effect?.base_value), `qigong ${qigong.key}: invalid base_value`);
    pushIf(errors, !isFiniteInRange(qigong.effect?.value_per_level), `qigong ${qigong.key}: invalid value_per_level`);
    pushIf(errors,
      Number.isFinite(qigong.effect?.base_value)
        && Number.isFinite(qigong.effect?.value_per_level)
        && Number.isSafeInteger(qigong.max_level)
        && !Number.isFinite(qigong.effect.base_value + qigong.effect.value_per_level * qigong.max_level),
      `qigong ${qigong.key}: effect total overflow`);
    pushIf(errors, !isSafeIntegerInRange(qigong.cost?.attribute_point, 1), `qigong ${qigong.key}: invalid point cost`);
  }

  for (const buff of buffsData) {
    pushIf(errors,
      !Number.isFinite(buff.duration) || (buff.duration !== -1 && buff.duration <= 0),
      `buff ${buff.key}: invalid duration`);
    pushIf(errors, buff.effect_type !== 'attribute', `buff ${buff.key}: unsupported effect_type ${buff.effect_type}`);
    pushIf(errors, !isRecord(buff.attribute_mods), `buff ${buff.key}: invalid attribute_mods`);
    for (const [hook, value] of Object.entries(buff.attribute_mods || {})) {
      pushIf(errors, !BUFF_ATTRIBUTE_HOOKS.has(hook), `buff ${buff.key}: unknown attribute_mods.${hook}`);
      pushIf(errors, !isFiniteInRange(value), `buff ${buff.key}: invalid attribute_mods.${hook}`);
    }
    for (const flag of ['stackable', 'is_debuff', 'dispellable']) {
      pushIf(errors, typeof buff[flag] !== 'boolean', `buff ${buff.key}: ${flag} must be boolean`);
    }
    if (buff.stackable) {
      pushIf(errors, !isSafeIntegerInRange(buff.max_stacks, 1, 100), `buff ${buff.key}: invalid max_stacks`);
    } else if (buff.max_stacks != null) {
      pushIf(errors, buff.max_stacks !== 1, `buff ${buff.key}: non-stackable max_stacks must be 1`);
    }
  }

  for (const art of martialArtsData) {
    const req = art.requirement || {};
    pushIf(errors, !['damage', 'heal', 'buff'].includes(art.type), `martial_art ${art.key}: invalid type ${art.type}`);
    pushIf(errors, !['single', 'aoe'].includes(art.target), `martial_art ${art.key}: invalid target ${art.target}`);
    pushIf(errors, !isSafeIntegerInRange(art.coolDown, 1), `martial_art ${art.key}: invalid coolDown`);
    pushIf(errors, !isSafeIntegerInRange(art.cost?.mp, 0), `martial_art ${art.key}: invalid mp cost`);
    pushIf(errors, !isSafeIntegerInRange(art.learning_cost?.training, 0), `martial_art ${art.key}: invalid learning cost`);
    pushIf(errors, !isSafeIntegerInRange(req.level, 1), `martial_art ${art.key}: invalid requirement.level`);
    pushIf(errors, !isSafeIntegerInRange(req.min_transfer, 0), `martial_art ${art.key}: invalid min_transfer`);
    if (req.career_family) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(req.career_family), `martial_art ${art.key}: invalid career_family ${req.career_family}`);
    }
    if (req.faction) {
      pushIf(errors, !FACTION_CLASSES.has(req.faction), `martial_art ${art.key}: invalid faction ${req.faction}`);
    }
    if (art.type === 'buff') {
      pushIf(errors,
        !isSafeIdentifier(art.effect?.buff_key) || !buffKeys.has(art.effect?.buff_key),
        `martial_art ${art.key}: buff_key ${art.effect?.buff_key || '(missing)'} missing in buffs`);
    } else {
      pushIf(errors, !isFiniteInRange(art.effect?.value, 0), `martial_art ${art.key}: invalid effect value`);
    }
    if (art.target === 'aoe') {
      pushIf(errors, !isSafeIntegerInRange(art.effect?.target_count, 1), `martial_art ${art.key}: invalid target_count`);
    }
  }

  for (const npc of npcsData) {
    pushIf(errors, !NPC_TYPES.has(npc.type), `npc ${npc.key}: invalid type ${npc.type}`);
    const isShop = npc.type === 'shop' || npc.type === 'shop_and_enhance';
    pushIf(errors, isShop && !NPC_SHOP_TYPES.has(npc.shop_type), `npc ${npc.key}: invalid shop_type ${npc.shop_type}`);
    pushIf(errors, !isFiniteInRange(npc.price_multiplier ?? 1, Number.EPSILON), `npc ${npc.key}: invalid price_multiplier`);
    pushIf(errors, npc.items != null && !Array.isArray(npc.items), `npc ${npc.key}: items must be an array`);
    pushIf(errors, npc.quests != null && !Array.isArray(npc.quests), `npc ${npc.key}: quests must be an array`);
    pushIf(errors, Array.isArray(npc.items) && npc.items.some(item => !isRecord(item)), `npc ${npc.key}: invalid items entry`);
    pushIf(errors, Array.isArray(npc.quests) && npc.quests.some(quest => !isRecord(quest)), `npc ${npc.key}: invalid quests entry`);
    for (const item of Array.isArray(npc.items) ? npc.items.filter(isRecord) : []) {
      const key = item.item_key || item.key;
      pushIf(errors, !!key && !itemKeys.has(key), `npc ${npc.key}: shop item ${key} missing in item config`);
      pushIf(errors, !isSafeIntegerInRange(item.buy_price, 1), `npc ${npc.key}: shop item ${key} invalid buy_price`);
    }
    for (const quest of Array.isArray(npc.quests) ? npc.quests.filter(isRecord) : []) {
      pushIf(errors, !questKeys.has(quest.key), `npc ${npc.key}: quest ${quest.key} missing in quest_templates`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidGameConfig(data) {
  const result = validateGameConfig(data);
  if (!result.ok) {
    console.error('[ConfigValidator] 配置校验失败', result.errors);
    throw new Error(`配置校验失败：\n${result.errors.slice(0, 20).join('\n')}${result.errors.length > 20 ? `\n...以及 ${result.errors.length - 20} 个问题` : ''}`);
  }
  if (result.warnings.length > 0) {
    console.warn('[ConfigValidator] 配置校验警告', result.warnings);
  }
  console.log('[ConfigValidator] 配置校验通过');
  return result;
}
