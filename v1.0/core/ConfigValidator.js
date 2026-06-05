/**
 * @file core/ConfigValidator.js
 * @desc 启动配置校验：关键引用 fail-fast，避免进入游戏后才崩。
 * @ref 14_tech.data_loading.validate_against_schema / PHASE_6_PROMPT
 */

const FACTION_CLASSES = new Set(['neutral', 'positive', 'negative']);
const CAREER_FAMILY_CLASSES = new Set(['blade', 'sword', 'spear', 'staff']);
const MONSTER_TYPE_CLASSES = new Set(['normal', 'elite', 'boss']);
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

function keysOf(list = []) {
  return new Set((Array.isArray(list) ? list : []).map(item => item?.key).filter(Boolean));
}

function pushIf(errors, condition, message) {
  if (condition) errors.push(message);
}

function warnIf(warnings, condition, message) {
  if (condition) warnings.push(message);
}

function asArray(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function validateUniqueKeys(errors, label, list = []) {
  const seen = new Set();
  for (const item of list || []) {
    if (!item?.key) {
      errors.push(`${label}: missing key`);
      continue;
    }
    if (seen.has(item.key)) errors.push(`${label}: duplicate key ${item.key}`);
    seen.add(item.key);
  }
}

function flattenStones(stonesData = {}) {
  return Object.values(stonesData).flatMap(group => Array.isArray(group) ? group : []);
}

export function validateGameConfig(data) {
  const errors = [];
  const warnings = [];
  const {
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

  const stones = flattenStones(stonesData);
  const careerKeys = keysOf(careersData);
  const monsterKeys = keysOf(monstersData);
  const equipmentKeys = keysOf(equipmentsData);
  const stoneKeys = keysOf(stones);
  const subZoneKeys = keysOf(subZonesData);
  const boxKeys = keysOf(boxesData);
  const buffKeys = keysOf(buffsData);
  const questItemKeys = new Set(Object.keys(questsData.quest_items || {}));
  const potionKeys = new Set(
    npcsData
      .filter(npc => npc.shop_type === 'potion')
      .flatMap(npc => npc.items || [])
      .map(item => item.item_key)
      .filter(Boolean)
  );
  const itemKeys = new Set([...equipmentKeys, ...stoneKeys, ...potionKeys, ...questItemKeys, ...boxKeys]);

  validateUniqueKeys(errors, 'careers', careersData);
  validateUniqueKeys(errors, 'monsters', monstersData);
  validateUniqueKeys(errors, 'equipments', equipmentsData);
  validateUniqueKeys(errors, 'stones', stones);
  validateUniqueKeys(errors, 'sub_zones', subZonesData);
  validateUniqueKeys(errors, 'boxes', boxesData);

  for (const career of careersData) {
    pushIf(errors, !FACTION_CLASSES.has(career.faction), `career ${career.key}: invalid faction ${career.faction}`);
    pushIf(errors, !CAREER_FAMILY_CLASSES.has(career.career_family), `career ${career.key}: invalid career_family ${career.career_family}`);
  }

  for (const equipment of equipmentsData) {
    pushIf(errors, !FACTION_CLASSES.has(equipment.faction), `equipment ${equipment.key}: invalid faction ${equipment.faction}`);
    for (const family of asArray(equipment.required_career)) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(family), `equipment ${equipment.key}: invalid required_career ${family}`);
    }
  }

  for (const monster of monstersData) {
    pushIf(errors, !MONSTER_TYPE_CLASSES.has(monster.monster_type), `monster ${monster.key}: invalid monster_type ${monster.monster_type}`);
    for (const drop of monster.drop_items || []) {
      pushIf(errors, !questItemKeys.has(drop.item_key), `monster ${monster.key}: drop_items ${drop.item_key} missing in quest_items`);
    }
  }

  for (const quest of questsData.quest_templates || []) {
    if (quest.faction) {
      pushIf(errors, !FACTION_CLASSES.has(quest.faction), `quest ${quest.key}: invalid faction ${quest.faction}`);
    }
    for (const stage of quest.objectives || []) {
      for (const item of stage.items || []) {
        pushIf(errors, !questItemKeys.has(item.item_key), `quest ${quest.key}: objective item ${item.item_key} missing in quest_items`);
        if (item.drop_monster) {
          warnIf(warnings, !monsterKeys.has(item.drop_monster), `quest ${quest.key}: drop_monster ${item.drop_monster} missing in monsters`);
        }
      }
    }
    for (const reward of quest.rewards || []) {
      if (reward.type === 'unlock_career') {
        for (const careerKey of reward.careers || []) {
          warnIf(warnings, !careerKeys.has(careerKey), `quest ${quest.key}: reward career ${careerKey} missing in careers`);
        }
      }
      if (reward.type === 'set_faction') {
        pushIf(errors, !FACTION_CLASSES.has(reward.faction), `quest ${quest.key}: reward invalid faction ${reward.faction}`);
      }
    }
  }

  for (const dropTable of subZoneDropsData) {
    warnIf(warnings, dropTable.sub_zone_key !== 'default' && !subZoneKeys.has(dropTable.sub_zone_key), `sub_zone_drops ${dropTable.key}: sub_zone_key ${dropTable.sub_zone_key} missing`);
    for (const roll of dropTable.drop_rolls || []) {
      for (const item of roll.equipment_pool || []) {
        warnIf(warnings, !equipmentKeys.has(item.key), `sub_zone_drops ${dropTable.key}: equipment_pool ${item.key} missing in equipments`);
      }
      for (const item of roll.stone_pool || []) {
        warnIf(warnings, !stoneKeys.has(item.key), `sub_zone_drops ${dropTable.key}: stone_pool ${item.key} missing in stones`);
      }
    }
  }

  for (const [subZoneKey, boxKey] of Object.entries(monsterDropBoxData.box_type_by_map || {})) {
    pushIf(errors, !subZoneKeys.has(subZoneKey), `monster_drop_box: sub_zone ${subZoneKey} missing`);
    pushIf(errors, !boxKeys.has(boxKey), `monster_drop_box: box ${boxKey} missing in boxes`);
  }

  for (const box of boxesData) {
    pushIf(errors, !Array.isArray(box.openable_items) || box.openable_items.length === 0, `box ${box.key}: openable_items empty`);
    for (const item of box.openable_items || []) {
      pushIf(errors, !itemKeys.has(item.item_key), `box ${box.key}: reward ${item.item_key} missing in item config`);
      pushIf(errors, !(Number(item.weight) > 0), `box ${box.key}: reward ${item.item_key} invalid weight`);
    }
  }

  for (const stone of stones) {
    for (const hook of stone.attribute?.pool || []) {
      pushIf(errors, !STONE_ATTRIBUTE_HOOKS.has(hook.key), `stone ${stone.key}: unknown attribute hook ${hook.key}`);
    }
  }

  for (const qigong of qigongsData) {
    for (const family of asArray(qigong.career_family)) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(family), `qigong ${qigong.key}: invalid career_family ${family}`);
    }
  }

  for (const art of martialArtsData) {
    const req = art.requirement || {};
    if (req.career_family) {
      pushIf(errors, !CAREER_FAMILY_CLASSES.has(req.career_family), `martial_art ${art.key}: invalid career_family ${req.career_family}`);
    }
    if (req.faction) {
      pushIf(errors, !FACTION_CLASSES.has(req.faction), `martial_art ${art.key}: invalid faction ${req.faction}`);
    }
    if (art.type === 'buff' && art.effect?.buff_key) {
      pushIf(errors, !buffKeys.has(art.effect.buff_key), `martial_art ${art.key}: buff_key ${art.effect.buff_key} missing in buffs`);
    }
  }

  for (const npc of npcsData) {
    for (const item of npc.items || []) {
      const key = item.item_key || item.key;
      warnIf(warnings, !!key && !itemKeys.has(key), `npc ${npc.key}: shop item ${key} missing in item config`);
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
