import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventBus, eventBus } from '../core/EventBus.js?v=release-20260830-3';
import { GameLoop } from '../core/GameLoop.js?v=release-20260830-3';
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-3';
import { runStartupSequence } from '../core/StartupSequence.js?v=release-20260830-3';
import { validateGameConfig } from '../core/ConfigValidator.js?v=release-20260830-3';
import { Monster } from '../entities/Monster.js?v=release-20260830-3';
import { runCharacterCreationFlow } from '../flows/character_creation_flow.js?v=release-20260830-3';
import { executeDeletion } from '../flows/character_deletion_flow.js?v=release-20260830-3';
import { executeSlotUnlock } from '../flows/slot_unlock_flow.js?v=release-20260830-3';
import { exportSave, importSave } from '../flows/save_transfer.js?v=release-20260830-3';
import { AttributeSystem } from '../systems/AttributeSystem.js?v=release-20260830-3';
import { AutoPlaySystem } from '../systems/AutoPlaySystem.js?v=release-20260830-3';
import { AutoSellSystem } from '../systems/AutoSellSystem.js?v=release-20260830-3';
import { AutoStoreSystem } from '../systems/AutoStoreSystem.js?v=release-20260830-3';
import { BattleSystem } from '../systems/BattleSystem.js?v=release-20260830-3';
import { BoxSystem } from '../systems/BoxSystem.js?v=release-20260830-3';
import { BuffSystem } from '../systems/BuffSystem.js?v=release-20260830-3';
import { ConsumableSystem } from '../systems/ConsumableSystem.js?v=release-20260830-3';
import { DamageSystem } from '../systems/DamageSystem.js?v=release-20260830-3';
import { DropSystem } from '../systems/DropSystem.js?v=release-20260830-3';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260830-3';
import { InventorySystem } from '../systems/InventorySystem.js?v=release-20260830-3';
import { UIState } from '../systems/NPCSystem.js?v=release-20260830-3';
import { OfflineSimulator } from '../systems/OfflineSimulator.js?v=release-20260830-3';
import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260830-3';
import { ShopSystem } from '../systems/ShopSystem.js?v=release-20260830-3';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260830-3';
import { TaskSystem } from '../systems/TaskSystem.js?v=release-20260830-3';
import { TeleportSystem } from '../systems/TeleportSystem.js?v=release-20260830-3';
import { WarehouseSystem } from '../systems/WarehouseSystem.js?v=release-20260830-3';
import { buildShopItems } from '../ui/ShopUI.js?v=release-20260830-3';
import { renderQuestPanel } from '../ui/TaskUI.js?v=release-20260830-3';
import { base64Decode, base64Encode } from '../utils/crypto.js?v=release-20260830-3';
import { applyDeathExpLoss, assignQigongPoint, grantExp, onLevelUp } from '../utils/formulas.js?v=release-20260830-3';
import { restoreRuntimePlayerFromSave } from '../utils/player_restore.js?v=release-20260830-3';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const MODULE_VERSION = 'release-20260830-3';

class MemoryStorage {
  constructor() {
    Object.defineProperty(this, '_failKey', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, '_failRemoveKey', { value: null, writable: true, enumerable: false });
  }

  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
  }

  setItem(key, value) {
    if (this._failKey === key) {
      this._failKey = null;
      throw new Error(`forced write failure: ${key}`);
    }
    this[key] = String(value);
  }

  removeItem(key) {
    if (this._failRemoveKey === key) {
      this._failRemoveKey = null;
      throw new Error(`forced remove failure: ${key}`);
    }
    delete this[key];
  }

  clear() {
    for (const key of Object.keys(this)) delete this[key];
  }

  failOnce(key) {
    this._failKey = key;
  }

  failRemoveOnce(key) {
    this._failRemoveKey = key;
  }

  get length() {
    return Object.keys(this).length;
  }

  key(index) {
    return Object.keys(this)[index] ?? null;
  }
}

globalThis.localStorage = new MemoryStorage();

function loadJson(name) {
  return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
}

function walkFiles(dir, suffix) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) result.push(...walkFiles(path, suffix));
    else if (path.endsWith(suffix)) result.push(path);
  }
  return result;
}

async function withRandom(values, callback) {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[Math.min(index++, values.length - 1)] ?? 0.5;
  try {
    return await callback();
  } finally {
    Math.random = original;
  }
}

function battleConfig(overrides = {}) {
  return {
    combat_constants: {
      armorBreakDefReduce: 0.5,
      comboHits: 2,
      shieldDamageReduceRate: 0.5,
      leechRate: 0.3,
      counterDamageRate: 1,
      skillCritDamageBonus: 0.5,
    },
    battle_flow: {
      battle_model: {
        elite_cap_per_zone: 1,
        monster_spawn: {
          initial_spawn_count: 1,
          same_zone_monster_cap: 8,
          spawn_interval_seconds: 1,
          spawn_weight: { elite_vs_normal: '1:50' },
        },
      },
    },
    exp_to_next_level: { 1: 100, 2: 200, 10: 1000 },
    current_level_cap: 100,
    attribute_points: { gain_per_level: { 2: 1 } },
    ...overrides,
  };
}

function makeBattlePlayer(overrides = {}) {
  return {
    _isPlayer: true,
    id: 'test-player',
    name: '测试角色',
    career: 'warrior_blade',
    career_family: 'blade',
    faction: 'neutral',
    level: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    atkMin: 10,
    atkMax: 10,
    def: 0,
    mdef: 0,
    matk: 0,
    hit: 0,
    missing: 0,
    critR: 0,
    critB: 1.5,
    skillCritRate: 0,
    combo: 0,
    shieldRate: 0,
    counterDamage: 0,
    armorBreak: 0,
    leech: 0,
    weaponSkillBonus: 0,
    weaponExtraDamage: 0,
    resources: { gold: 0, training: 0, merit: 0 },
    statistics: { total_kills: 0, total_deaths: 0, total_gold_earned: 0, total_playtime_ms: 0 },
    qigong: { available_points: 1, invested: {} },
    learned_martial_arts: [],
    inventory: { capacity: 50, slots: [], equipment_instances: {} },
    warehouse: { capacity: 50, slots: [], equipment_instances: {} },
    equipped: {},
    buffs: [],
    quests: { accepted: [], completed: [] },
    location: { current_map_key: 'town_xuanbo', current_sub_zone_key: null },
    auto_play: { is_auto_play: true, auto_attack: { attack_type: 'normal', selected_skill_key: null } },
    ...overrides,
  };
}

function createBattle({ player, config = battleConfig(), monstersData = [], martialArtsData = [], dropSystemRef = null, currentSubZone = null }) {
  return new BattleSystem({
    config,
    player,
    monstersData,
    martialArtsData,
    attrSystemRef: { recompute() {} },
    dropSystemRef,
    subZonesData: currentSubZone ? [currentSubZone] : [],
    subZoneDropsData: [],
    currentSubZone,
  });
}

afterEach(() => {
  eventBus.clear();
  AutoPlaySystem.resetRuntimeState();
  UIState.active_npc = null;
  localStorage.clear();
});

test('内部 ES 模块统一发布标识，物品分类单例可跨系统共享', async () => {
  for (const file of walkFiles(ROOT, '.js')) {
    const source = readFileSync(file, 'utf8');
    for (const line of source.split('\n')) {
      if (line.includes('@type')) continue;
      const matches = line.matchAll(/(?:from\s+|^\s*import\s+|import\s*\(\s*)['"]([^'"]+\.js)(?:\?v=([^'"]+))?['"]/g);
      for (const match of matches) {
        assert.equal(match[2], MODULE_VERSION, `${file}: ${match[1]} 发布标识不一致`);
      }
    }
  }
  const bottomBarSource = readFileSync(join(ROOT, 'ui', 'BottomBarUI.js'), 'utf8');
  assert.match(bottomBarSource, /import \{ AutoPlaySystem \} from ['"]\.\.\/systems\/AutoPlaySystem\.js\?v=release-20260830-3['"]/);
  assert.match(bottomBarSource, /AutoPlaySystem\.castSupportSkill\(/);

  InventorySystem.setItemClassMap({
    equipmentKeys: ['blade_test'],
    boxKeys: ['box_test'],
    questItemKeys: ['quest_token'],
  });
  const player = makeBattlePlayer({
    inventory: {
      capacity: 10,
      slots: [
        { item_key: 'quest_token', count: 1 },
        { item_key: 'box_test', count: 1 },
      ],
      equipment_instances: {},
    },
    warehouse: { capacity: 10, slots: [], equipment_instances: {} },
  });

  assert.equal(WarehouseSystem.deposit(player, 'quest_token', 1).success, false);
  assert.equal(ShopSystem.sell(player, { type: 'shop', items: [] }, 'box_test', 1).success, false);

  BoxSystem.setTemplates({
    boxes: [{ key: 'box_test', name: '测试盒', openable_items: [{ item_key: 'blade_test', name: '测试刀', weight: 1 }] }],
    equipmentTemplates: [{ key: 'blade_test', slot: 'weapon', required_level: 1, base_stats: { atkMin: 1, atkMax: 2 } }],
  });
  const opened = await withRandom([0], () => BoxSystem.openBox(player, 'box_test', 1));
  assert.equal(opened.success, true);
  assert.equal(Object.values(player.inventory.equipment_instances).length, 1);

  InventorySystem.add(player, 'sell_test', 1);
  const sold = ShopSystem.sell(
    player,
    { type: 'shop', items: [{ item_key: 'sell_test', buy_price: 10 }] },
    'sell_test',
    -5,
  );
  assert.equal(sold.success, false);
  assert.equal(InventorySystem.count(player, 'sell_test'), 1);
  assert.equal(player.statistics.total_gold_earned, 0);
  assert.equal(ShopSystem.sell(
    player,
    { type: 'shop', items: [{ item_key: 'sell_test', buy_price: 10 }] },
    'sell_test',
    1,
  ).success, true);
  assert.equal(InventorySystem.count(player, 'sell_test'), 0);
  assert.equal(player.statistics.total_gold_earned, 5);
});

test('背包堆叠与装备实例不会交叉污染', () => {
  InventorySystem.setItemClassMap({ equipmentKeys: ['blade_guard'] });
  const player = makeBattlePlayer({
    inventory: {
      capacity: 3,
      slots: [{ item_key: null, instance_id: 'stale-id', count: 0 }],
      equipment_instances: {},
    },
  });

  assert.deepEqual(InventorySystem.add(player, 'hp_potion_grade1', 2), {
    success: true, added: 2, discarded: 0,
  });
  assert.equal('instance_id' in player.inventory.slots[0], false);
  assert.deepEqual(InventorySystem.add(player, 'blade_guard', 1), {
    success: false, added: 0, discarded: 1,
  });

  const instance = {
    instance_id: 'blade-instance', item_key: 'blade_guard', enhance_level: 0, synthesis_slots: [],
  };
  assert.equal(InventorySystem.addEquipmentInstance(player, {
    ...instance,
    instance_id: "bad'id",
    enhance_level: 11,
  }).success, false);
  assert.equal(player.inventory.slots.some(slot => slot.instance_id === "bad'id"), false);
  assert.equal(InventorySystem.addEquipmentInstance(player, instance).success, true);
  assert.equal(InventorySystem.addEquipmentInstance(player, instance).success, false);
  assert.equal(InventorySystem.count(player, 'blade_guard'), 0);
  assert.equal(InventorySystem.remove(player, 'blade_guard', 1), false);
  assert.ok(player.inventory.equipment_instances['blade-instance']);
});

test('绑定气功的热血石可按配置自动存仓', () => {
  const stoneKey = 'hot_blood_01--skill_level_up--1--blade_qigong_hit';
  const player = makeBattlePlayer({
    inventory: { capacity: 10, slots: [{ item_key: stoneKey, count: 2 }], equipment_instances: {} },
    warehouse: { capacity: 10, slots: [], equipment_instances: {} },
    auto_play: {
      auto_store: {
        enabled: true,
        stones: { rules: [{ category: 'hot_blood', attribute_key: 'skill_level_up', value: 1 }] },
        equipment: { item_keys: [] },
      },
    },
  });

  assert.deepEqual(AutoStoreSystem.parseStoneKey(stoneKey), {
    baseKey: 'hot_blood_01', category: 'hot_blood', attributeKey: 'skill_level_up', value: 1,
  });
  const result = AutoStoreSystem.storeConfiguredItems(player, { silent: true });
  assert.equal(result.stones_stored, 2);
  assert.equal(InventorySystem.count(player, stoneKey), 0);
  assert.equal(player.warehouse.slots[0].item_key, stoneKey);
  assert.equal(player.warehouse.slots[0].count, 2);
});

test('强化只消耗用户选中的强化石品类', async () => {
  const equipment = { key: 'blade_enhance', slot: 'weapon', required_level: 1, base_stats: {} };
  const player = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    inventory: {
      capacity: 10,
      slots: [
        { item_key: equipment.key, instance_id: 'enhance-instance', count: 1 },
        { item_key: 'enhance_stone_01', count: 1 },
        { item_key: 'enhance_stone_02', count: 2 },
      ],
      equipment_instances: {
        'enhance-instance': {
          instance_id: 'enhance-instance', item_key: equipment.key, enhance_level: '0', synthesis_slots: ['cold_jade_01--defAdd--1'],
        },
      },
    },
  });

  const insufficient = EnhanceSystem.enhance(player, 'enhance-instance', 'enhance_stone_01');
  assert.equal(insufficient.success, false);
  assert.equal(player.resources.gold, 10000);
  assert.equal(InventorySystem.count(player, 'enhance_stone_01'), 1);
  assert.equal(InventorySystem.count(player, 'enhance_stone_02'), 2);

  const enhanced = await withRandom([0], () => EnhanceSystem.enhance(
    player,
    'enhance-instance',
    'enhance_stone_02',
  ));
  assert.equal(enhanced.success, true);
  assert.equal(player.inventory.equipment_instances['enhance-instance'].enhance_level, 1);
  assert.equal(InventorySystem.count(player, 'enhance_stone_01'), 1);
  assert.equal(InventorySystem.count(player, 'enhance_stone_02'), 0);
  assert.equal(player.resources.gold, 9000);
});

test('强化拒绝畸形石头数量且不会扣除资源', () => {
  const equipment = { key: 'blade_malformed_stones', slot: 'weapon', required_level: 1, base_stats: {} };
  const player = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    inventory: {
      capacity: 10,
      slots: [
        { item_key: equipment.key, instance_id: 'malformed-stone-equipment', count: 1 },
        { item_key: 'enhance_stone_bad', count: 1.5 },
      ],
      equipment_instances: {
        'malformed-stone-equipment': {
          instance_id: 'malformed-stone-equipment', item_key: equipment.key, enhance_level: 0, synthesis_slots: [],
        },
      },
    },
  });

  const result = EnhanceSystem.enhance(player, 'malformed-stone-equipment', 'enhance_stone_bad');
  assert.equal(result.success, false);
  assert.equal(player.resources.gold, 10000);
  assert.equal(player.inventory.slots[1].count, 1.5);
  assert.equal(player.inventory.equipment_instances['malformed-stone-equipment'].enhance_level, 0);
});

test('任务提交先校验完整奖励，再原子扣除物品并转职', () => {
  const template = {
    key: 'quest_atomic', name: '原子转职', type: 'career_transfer', required_transfer: 0,
    prerequisite: { level: 10 }, faction: 'positive', dialogue: {},
    objectives: [{ stage: 1, items: [{ item_key: 'quest_token_atomic', count: 2 }] }],
    rewards: [
      { type: 'set_faction', faction: 'positive' },
      { type: 'unlock_career', careers: ['warrior_blade_transfer_1st'] },
    ],
  };
  const accepted = {
    ...structuredClone(template), current_stage: '1', completed_stages: [1], accepted_at: Date.now(),
  };
  InventorySystem.setItemClassMap({ questItemKeys: ['quest_token_atomic'] });
  const player = makeBattlePlayer({
    level: 10,
    career_history: ['warrior_blade'],
    inventory: {
      capacity: 10,
      slots: [{ item_key: 'quest_token_atomic', count: 2 }],
      equipment_instances: {},
    },
    quests: { accepted: [accepted], completed: [] },
  });
  UIState.active_npc = { npc_key: 'quest_npc' };

  const invalidReward = TaskSystem.submitQuest(player, accepted, [template], []);
  assert.equal(invalidReward.success, false);
  assert.equal(InventorySystem.count(player, 'quest_token_atomic'), 2);
  assert.equal(player.career, 'warrior_blade');
  assert.equal(player.quests.accepted.length, 1);

  const completed = TaskSystem.submitQuest(player, accepted, [template], [
    { key: 'warrior_blade_transfer_1st', career_family: 'blade' },
  ]);
  assert.equal(completed.success, true);
  assert.equal(InventorySystem.count(player, 'quest_token_atomic'), 0);
  assert.equal(player.career, 'warrior_blade_transfer_1st');
  assert.equal(player.faction, 'positive');
  assert.deepEqual(player.quests.completed, ['quest_atomic']);
  assert.equal(player.quests.accepted.length, 0);
  assert.equal(TaskSystem._getTransferCount({
    career: 'warrior_blade', career_history: ['warrior_blade_transfer_3st_Z'],
  }), 3);
});

test('任务提交拒绝重复目标数量溢出且不改动角色', () => {
  const template = {
    key: 'quest_overflow', name: '溢出任务', type: 'career_transfer', required_transfer: 0,
    prerequisite: { level: 1 },
    objectives: [{
      stage: 1,
      items: [
        { item_key: 'overflow_token', count: Number.MAX_SAFE_INTEGER },
        { item_key: 'overflow_token', count: 1 },
      ],
    }],
    rewards: [{ type: 'set_faction', faction: 'positive' }],
  };
  const accepted = {
    ...structuredClone(template), current_stage: 1, completed_stages: [1], accepted_at: Date.now(),
  };
  const player = makeBattlePlayer({
    quests: { accepted: [accepted], completed: [] },
    inventory: { capacity: 10, slots: [], equipment_instances: {} },
  });
  UIState.active_npc = { npc_key: 'quest_npc' };

  const result = TaskSystem.submitQuest(player, accepted, [template], []);
  assert.equal(result.success, false);
  assert.equal(result.message, '任务目标数据无效');
  assert.equal(player.faction, 'neutral');
  assert.equal(player.quests.accepted.length, 1);
});

test('已接任务保留转职条件，且多阶段未全部收齐时不会误报可提交', () => {
  const template = {
    key: 'quest_multistage_ui', name: '多阶段试炼', type: 'career_transfer',
    required_transfer: 0, target_transfer: 1, prerequisite: { level: 10 },
    objectives: [
      { stage: 1, items: [{ item_key: 'stage_one_token', count: 1 }] },
      { stage: 2, items: [{ item_key: 'stage_two_token', count: 1 }] },
    ],
    rewards: [{ type: 'unlock_career', careers: ['warrior_blade_transfer_1st'] }],
    dialogue: {},
  };
  InventorySystem.setItemClassMap({ questItemKeys: ['stage_one_token', 'stage_two_token'] });
  TaskSystem.setTemplates([template]);
  const player = makeBattlePlayer({
    level: 10,
    quests: { accepted: [], completed: [] },
    inventory: {
      capacity: 10,
      slots: [{ item_key: 'stage_one_token', count: 1 }],
      equipment_instances: {},
    },
  });

  assert.equal(TaskSystem.acceptQuest(player, template).success, true);
  assert.equal(player.quests.accepted[0].target_transfer, 1);
  assert.deepEqual(player.quests.accepted[0].prerequisite, { level: 10 });
  const collecting = renderQuestPanel(player);
  assert.match(collecting, /转职 · 1转/);
  assert.match(collecting, /需 Lv10/);
  assert.doesNotMatch(collecting, /前往门主提交/);

  assert.equal(InventorySystem.add(player, 'stage_two_token', 1).success, true);
  assert.match(renderQuestPanel(player), /前往门主提交/);
});

test('商店与仓库只按实例移动装备，不会留下孤立数据', () => {
  InventorySystem.setItemClassMap({ equipmentKeys: ['blade_trade'] });
  const player = makeBattlePlayer({
    _equipTemplates: [{ key: 'blade_trade', slot: 'weapon', required_level: 10 }],
    inventory: {
      capacity: 3,
      slots: [{ item_key: 'blade_trade', instance_id: 'trade-instance', count: 1 }],
      equipment_instances: {
        'trade-instance': { instance_id: 'trade-instance', item_key: 'blade_trade', enhance_level: 0, synthesis_slots: [] },
      },
    },
    warehouse: { capacity: 3, slots: [], equipment_instances: {} },
  });

  assert.equal(ShopSystem.sell(player, { type: 'shop', items: [] }, 'blade_trade', 1).success, false);
  assert.equal(WarehouseSystem.deposit(player, 'wrong-key', 1, { instanceId: 'trade-instance' }).success, false);
  assert.equal(WarehouseSystem.deposit(player, 'blade_trade', 1, { instanceId: 'trade-instance' }).success, true);
  assert.equal(player.inventory.equipment_instances['trade-instance'], undefined);
  assert.ok(player.warehouse.equipment_instances['trade-instance']);
  assert.equal(WarehouseSystem.withdraw(player, 'blade_trade', 1, { instanceId: 'trade-instance' }).success, true);
  assert.ok(player.inventory.equipment_instances['trade-instance']);
  assert.equal(player.warehouse.equipment_instances['trade-instance'], undefined);

  const sold = ShopSystem.sellEquipmentInstance(player, 'trade-instance');
  assert.equal(sold.success, true);
  assert.equal(player.resources.gold, 1000);
  assert.equal(player.inventory.equipment_instances['trade-instance'], undefined);
  assert.equal(player.inventory.slots.some(slot => slot.instance_id === 'trade-instance'), false);
});

test('商店界面与自动补给统一应用 NPC 价格倍率', () => {
  const npc = {
    shop_type: 'potion',
    price_multiplier: 1.5,
    items: [{ item_key: 'hp_potion_grade1', name: '倍率药品', buy_price: 10 }],
  };
  assert.deepEqual(buildShopItems([npc], [], 'potion'), [{
    item_key: 'hp_potion_grade1',
    name: '倍率药品',
    buy_price: 15,
    icon: '🍶',
    slot: null,
    careers: [],
  }]);
  AutoPlaySystem.setPotionShopItems(npc.items, npc.price_multiplier);
  assert.equal(AutoPlaySystem._getPotionBuyPrice('hp_potion_grade1'), 15);
});

test('金币达到安全整数上限时出售保持原子性', () => {
  InventorySystem.setItemClassMap({ equipmentKeys: ['blade_cap'] });
  const player = makeBattlePlayer({
    resources: { gold: Number.MAX_SAFE_INTEGER, training: 0, merit: 0 },
    statistics: {
      total_kills: 0,
      total_deaths: 0,
      total_gold_earned: Number.MAX_SAFE_INTEGER,
      total_playtime_ms: 0,
    },
    _equipTemplates: [{ key: 'blade_cap', slot: 'weapon', required_level: 1 }],
    inventory: {
      capacity: 3,
      slots: [
        { item_key: 'sell_cap', count: 1 },
        { item_key: 'blade_cap', instance_id: 'blade-cap-instance', count: 1 },
        { item_key: 'cold_jade_01--defAdd--1', count: 1 },
      ],
      equipment_instances: {
        'blade-cap-instance': {
          instance_id: 'blade-cap-instance', item_key: 'blade_cap', enhance_level: 0, synthesis_slots: [],
        },
      },
    },
  });

  assert.equal(ShopSystem.sell(
    player,
    { type: 'shop', items: [{ item_key: 'sell_cap', buy_price: 10 }] },
    'sell_cap',
    1,
  ).success, false);
  assert.equal(InventorySystem.count(player, 'sell_cap'), 1);
  assert.equal(ShopSystem.sellEquipmentInstance(player, 'blade-cap-instance').success, false);
  assert.ok(player.inventory.equipment_instances['blade-cap-instance']);
  assert.equal(player.resources.gold, Number.MAX_SAFE_INTEGER);
  player.auto_play.auto_sell = {
    enabled: true,
    categories: { cold_jade: { rules: { defAdd: { enabled: true, max_value: 1 } } } },
    equipment: { enabled: false, item_keys: [] },
  };
  assert.equal(AutoSellSystem.hasSellableConfiguredItems(player), false);
});

test('药剂使用按真实转职阶段判定，无效数量与负恢复不消耗', () => {
  InventorySystem.setItemClassMap({ consumableKeys: ['hp_potion_grade3'] });
  const player = makeBattlePlayer({
    level: 60,
    career: 'warrior_blade',
    career_history: ['warrior_blade', 'warrior_blade_transfer_3st_Z'],
    hp: 10,
    maxHp: 500,
    healBonus: -2,
    inventory: {
      capacity: 10,
      slots: [{ item_key: 'hp_potion_grade3', count: 2 }],
      equipment_instances: {},
    },
  });

  assert.equal(ConsumableSystem.canUse(player, 'hp_potion_grade3'), true);
  assert.equal(ConsumableSystem.use(player, 'hp_potion_grade3', -1).success, false);
  assert.equal(ConsumableSystem.use(player, 'hp_potion_grade3', 1).success, false);
  assert.equal(InventorySystem.count(player, 'hp_potion_grade3'), 2);
  player.healBonus = 0;
  const used = ConsumableSystem.use(player, 'hp_potion_grade3', 1, { emitEvent: false });
  assert.equal(used.success, true);
  assert.equal(player.hp, 310);
  assert.equal(InventorySystem.count(player, 'hp_potion_grade3'), 1);
});

test('开盒拒绝无效批量，不会意外消耗盒子', () => {
  InventorySystem.setItemClassMap({ boxKeys: ['box_count_test'], consumableKeys: ['hp_potion_grade1'] });
  BoxSystem.setTemplates({
    boxes: [{ key: 'box_count_test', openable_items: [{ item_key: 'hp_potion_grade1', name: '金创药', weight: 1 }] }],
  });
  const player = makeBattlePlayer({
    inventory: {
      capacity: 10,
      slots: [{ item_key: 'box_count_test', count: 1 }],
      equipment_instances: {},
    },
  });

  assert.equal(BoxSystem.openBox(player, 'box_count_test', -1).success, false);
  assert.equal(InventorySystem.count(player, 'box_count_test'), 1);
  assert.equal(BoxSystem.openBox(player, 'box_count_test', 1).success, true);
  assert.equal(InventorySystem.count(player, 'box_count_test'), 0);
  assert.equal(InventorySystem.count(player, 'hp_potion_grade1'), 1);
});

test('同一地图任何生成路径都不会同时保留多只精英怪', async () => {
  const elite = { key: 'elite_test', name: '精英测试怪', monster_type: 'elite', level: 1, hp: 10, atk: 1, def: 0, exp: 0 };
  const zone = { key: 'zone_test', parent_map_key: 'map_test', monsters: [elite.key] };
  const config = battleConfig();
  config.battle_flow.battle_model.monster_spawn.initial_spawn_count = 8;
  const player = makeBattlePlayer();
  const battle = createBattle({ player, config, monstersData: [elite], currentSubZone: zone });
  try {
    await withRandom([0], () => {
      battle.ensureInitialSpawn();
      for (let index = 0; index < 10; index += 1) battle._trySpawn();
    });
    assert.equal(battle.monsters.filter(monster => monster.monster_type === 'elite').length, 1);
  } finally {
    battle.destroy();
  }
});

test('战斗刷怪使用模型层数量上限、预热与攻击间隔配置', () => {
  const config = battleConfig();
  config.battle_flow.battle_model.same_zone_monster_cap = 2;
  config.battle_flow.battle_model.monster_spawn.same_zone_monster_cap = 8;
  config.battle_flow.battle_model.monster_spawn.initial_spawn_count = 6;
  config.battle_flow.battle_model.monster_spawn.preheat_seconds = 0.25;
  config.battle_flow.battle_model.monster_attack = { atk_interval_ms: 750 };
  const normal = {
    key: 'normal_config_test', name: '配置测试怪', monster_type: 'normal',
    level: 1, hp: 10, atk: 1, def: 0, exp: 0,
  };
  const zone = { key: 'zone_config_test', monsters: [normal.key] };
  const battle = createBattle({
    player: makeBattlePlayer(), config, monstersData: [normal], currentSubZone: zone,
  });
  try {
    battle.ensureInitialSpawn();
    assert.equal(battle.monsters.length, 2);
    assert.equal(battle.monsters[0].preheatRemaining, 250);
    assert.equal(battle.monsters[0]._atkIntervalMs, 750);
  } finally {
    battle.destroy();
  }
});

test('怪物被反伤击杀会完整结算击杀，且高等级差不给经验', async () => {
  const player = makeBattlePlayer({ level: 10, counterDamage: 1 });
  const dropSystem = new DropSystem({ config: { monster_drop_box: null } });
  const battle = createBattle({ player, dropSystemRef: dropSystem });
  const monster = new Monster({ key: 'weak', name: '弱怪', monster_type: 'normal', level: 1, hp: 5, atk: 10, def: 0, hit: 0, missing: 0, critR: 0, exp: 100 });
  monster.preheatRemaining = 0;
  battle.monsters = [monster];
  try {
    await withRandom([0.5], () => battle._monsterAttacks(100));
    assert.equal(battle.monsters.length, 0);
    assert.equal(player.statistics.total_kills, 1);
    assert.equal(player.exp, 0);
  } finally {
    battle.destroy();
  }
});

test('角色死亡通过统一状态机停止挂机并发出原因事件', () => {
  const player = makeBattlePlayer({
    auto_play: { is_auto_play: true },
    location: { current_map_key: 'field', current_sub_zone_key: 'zone_test' },
  });
  AutoPlaySystem.syncFromPlayer(player);
  const battle = createBattle({ player });
  let stopReason = null;
  eventBus.on('autoplay.stop', ({ reason }) => { stopReason = reason; });
  try {
    battle._onPlayerDeath();
    assert.equal(player.auto_play.is_auto_play, false);
    assert.equal(AutoPlaySystem.is_auto_play, false);
    assert.equal(stopReason, 'death');
  } finally {
    battle.destroy();
  }
});

test('群体武功一次扣蓝并命中配置数量的目标', async () => {
  const skill = {
    key: 'aoe_test', name: '横扫测试', type: 'damage', target: 'aoe',
    cost: { mp: 5 }, effect: { value: 20, target_count: 2 },
  };
  const player = makeBattlePlayer({
    mp: 50,
    skillCritRate: 1,
    learned_martial_arts: [skill.key],
    auto_play: { is_auto_play: true, auto_attack: { attack_type: 'skill', selected_skill_key: skill.key } },
  });
  const battle = createBattle({ player, martialArtsData: [skill] });
  const skillEvents = [];
  eventBus.on('battle.player_skill', data => skillEvents.push(data));
  battle.monsters = [1, 2, 3].map(index => {
    const monster = new Monster({ key: `target_${index}`, name: `目标${index}`, hp: 100, atk: 0, def: 0, hit: 0, missing: 0, critR: 0, exp: 0 });
    monster.preheatRemaining = 0;
    return monster;
  });
  try {
    await withRandom([0.5], () => battle._playerAttack());
    assert.equal(player.mp, 45);
    assert.deepEqual(battle.monsters.map(monster => monster.hp), [48, 48, 100]);
    assert.deepEqual(skillEvents.map(event => event.skill_crit_suffix), [' (暴击!)', ' (暴击!)']);
  } finally {
    battle.destroy();
  }
});

test('已学习但不再满足职业条件的武功不会被战斗或自动技能激活', async () => {
  const damageSkill = {
    key: 'spear_only_damage', name: '枪客测试武功', type: 'damage', target: 'single',
    cost: { mp: 5 }, effect: { value: 90 },
    requirement: { level: 1, career_family: 'spear', min_transfer: 0 },
  };
  const healSkill = {
    key: 'staff_only_heal', name: '医师测试治疗', type: 'heal', target: 'single', coolDown: 1000,
    cost: { mp: 5 }, effect: { value: 50 },
    requirement: { level: 1, career_family: 'staff', min_transfer: 0 },
  };
  const player = makeBattlePlayer({
    hp: 50,
    mp: 50,
    learned_martial_arts: [damageSkill.key, healSkill.key],
    auto_play: { is_auto_play: true, auto_attack: { attack_type: 'skill', selected_skill_key: damageSkill.key } },
  });
  const battle = createBattle({ player, martialArtsData: [damageSkill] });
  const monster = new Monster({
    key: 'cross_career_target', name: '跨职业目标', hp: 100, atk: 0, def: 0,
    hit: 0, missing: 0, critR: 0, exp: 0,
  });
  monster.preheatRemaining = 0;
  battle.monsters = [monster];
  AutoPlaySystem.setMartialArtsData([healSkill]);
  try {
    await withRandom([0.5], () => battle._playerAttack());
    assert.equal(monster.hp, 90);
    assert.equal(player.mp, 50);
    assert.equal(AutoPlaySystem.castSupportSkill(player, healSkill.key).success, false);
    assert.equal(player.hp, 50);
    assert.equal(player.mp, 50);
  } finally {
    battle.destroy();
  }
});

test('连击伤害保持整数，吸血与反伤返回实际结算值', async () => {
  const damage = new DamageSystem({
    combatConstants: {
      armorBreakDefReduce: 0.5,
      comboHits: 2,
      shieldDamageReduceRate: 0.5,
      leechRate: 0.2,
      counterDamageRate: 0.5,
      skillCritDamageBonus: 0.5,
    },
  });
  const attacker = makeBattlePlayer({ hp: 50, atkMin: 10, atkMax: 10, armorBreak: 1, combo: 1, leech: 1 });
  const target = { hp: 100, maxHp: 100, def: 3, mdef: 0, missing: 0, shieldRate: 0, counterDamage: 1 };

  const result = await withRandom([0, 0, 0, 0, 0], () => damage.attack_resolution_pipeline(attacker, target));
  assert.equal(result.actualDmg, 17);
  assert.equal(Number.isInteger(result.actualDmg), true);
  assert.equal(result.leechHeal, 3);
  assert.equal(result.reflectedDmg, 8);
  assert.equal(attacker.hp, 45);
});

test('过量伤害不会放大吸血、反伤或战斗日志伤害', async () => {
  const damage = new DamageSystem({
    combatConstants: {
      armorBreakDefReduce: 0.5,
      comboHits: 2,
      shieldDamageReduceRate: 0.5,
      leechRate: 1,
      counterDamageRate: 1,
      skillCritDamageBonus: 0.5,
    },
  });
  const attacker = makeBattlePlayer({ hp: 1, maxHp: 100, atkMin: 100, atkMax: 100, leech: 1 });
  const target = { hp: 5, maxHp: 5, def: 0, mdef: 0, missing: 0, shieldRate: 0, counterDamage: 1 };

  const result = await withRandom([0.5, 0.5, 0, 0], () => damage.attack_resolution_pipeline(attacker, target));
  assert.equal(result.finalDmg, 100);
  assert.equal(result.actualDmg, 5);
  assert.equal(result.leechHeal, 5);
  assert.equal(result.reflectedDmg, 5);
  assert.equal(attacker.hp, 1);
});

test('武功暴击与破甲会进入真实结算结果', async () => {
  const damage = new DamageSystem({ combatConstants: battleConfig().combat_constants });
  const attacker = makeBattlePlayer({
    atkMin: 10,
    atkMax: 10,
    matk: 20,
    armorBreak: 1,
    skillCritRate: 1,
  });
  const target = { hp: 100, maxHp: 100, def: 10, mdef: 10, missing: 0, shieldRate: 0, counterDamage: 0 };
  const skill = { effect: { value: 5 } };

  const result = await withRandom([0, 0, 0, 0, 0], () => damage.attack_resolution_pipeline(attacker, target, 'skill', skill));
  assert.equal(result.isCrit, true);
  assert.equal(result.isArmorBroken, true);
  assert.ok(result.actualDmg > 0);
});

test('反伤同归于尽时即使击杀升级也仍会结算玩家死亡', async () => {
  const player = makeBattlePlayer({
    hp: 1,
    maxHp: 100,
    atkMin: 10,
    atkMax: 10,
    location: { current_map_key: 'wilderness_xuanbo_suburb', current_sub_zone_key: 'counter_zone' },
  });
  const battle = createBattle({ player });
  const monster = new Monster({
    key: 'lethal_counter_target', name: '反伤目标', hp: 1, atk: 0, def: 0,
    hit: 0, missing: 0, critR: 0, exp: 100, counterDamage: 1,
  });
  monster.preheatRemaining = 0;
  battle.monsters = [monster];

  try {
    const continued = await withRandom([0.5], () => battle._resolvePlayerAttack(monster, null));
    assert.equal(continued, false);
    assert.equal(player.level, 2);
    assert.equal(player.statistics.total_deaths, 1);
    assert.equal(player.auto_play.is_auto_play, false);
    assert.equal(player.location.current_sub_zone_key, null);
    assert.equal(player.hp, player.maxHp);
  } finally {
    battle.destroy();
  }
});

test('破甲面对缺失防御字段仍返回有限伤害', async () => {
  const damage = new DamageSystem({ combatConstants: battleConfig().combat_constants });
  const attacker = makeBattlePlayer({
    atkMin: 10,
    atkMax: 10,
    matk: 10,
    armorBreak: 1,
    skillCritRate: 0,
  });
  const target = { hp: 100, maxHp: 100, missing: 0, shieldRate: 0, counterDamage: 0 };

  const normal = await withRandom([0.5], () => damage.normal_attack_damage(attacker, target));
  const skill = await withRandom([0.5], () => damage.attack_resolution_pipeline(
    attacker,
    target,
    'skill',
    { effect: { value: 1 } },
  ));
  assert.equal(Number.isFinite(normal.finalDmg), true);
  assert.equal(Number.isFinite(skill.actualDmg), true);
});

test('武功攻击力使用已强化武器的攻击上限', () => {
  const config = loadJson('config.json');
  const attrSystem = new AttributeSystem({ attributeConstants: config.attribute_constants });
  const player = makeBattlePlayer({
    str: 8, dex: 9, sta: 15, int: 8,
    baseHp: 100, baseMp: 100, hpGrowth: 60, mpGrowth: 20, _hooks: {},
    _equipTemplates: [{ key: 'blade_test', slot: 'weapon', base_stats: { atkMin: 8, atkMax: 12, maxHp: 50 } }],
    inventory: {
      capacity: 50,
      slots: [],
      equipment_instances: {
        weapon_1: { instance_id: 'weapon_1', item_key: 'blade_test', enhance_level: 2, synthesis_slots: [] },
      },
    },
    equipped: { weapon: { instance_id: 'weapon_1' } },
  });
  attrSystem.recompute(player);
  assert.equal(player.matk, 28);

  player.hp = player.maxHp;
  const equippedMaxHp = player.maxHp;
  player.equipped.weapon = null;
  attrSystem.recompute(player);
  assert.ok(player.maxHp < equippedMaxHp);
  assert.equal(player.hp, player.maxHp);
});

test('医师治疗与增益使用真实武功配置、消耗内功并进入冷却', () => {
  const martialArts = loadJson('martial_arts.json').martial_arts;
  const buffs = loadJson('buffs.json').buffs;
  AutoPlaySystem.setMartialArtsData(martialArts);
  BuffSystem.setTemplates(buffs);
  const player = makeBattlePlayer({
    career: 'healer_transfer_1st', career_family: 'staff', career_history: ['healer', 'healer_transfer_1st'],
    level: 20, hp: 10, maxHp: 200, mp: 100, maxMp: 100,
    learned_martial_arts: ['staff_fury_heal', 'staff_fury_taiji'],
    auto_play: { is_auto_play: false },
  });

  const healed = AutoPlaySystem.castSupportSkill(player, 'staff_fury_heal');
  assert.equal(healed.success, true);
  assert.equal(player.hp, 120);
  assert.equal(player.mp, 90);
  assert.equal(AutoPlaySystem.castSupportSkill(player, 'staff_fury_heal').success, false);

  const buffed = AutoPlaySystem.castSupportSkill(player, 'staff_fury_taiji');
  assert.equal(buffed.success, true);
  assert.equal(player.mp, 70);
  assert.equal(player.buffs.some(buff => buff.key === 'atk_up_20'), true);
});

test('Buff 拒绝异常持续时间，并在刷新时同步事件与倒计时', () => {
  BuffSystem.setTemplates([{
    key: 'validated_buff', name: '校验增益', duration: 1000, stackable: false,
    effect_type: 'attribute', attribute_mods: { atkSelfPct: 0.1 },
  }]);
  const player = makeBattlePlayer({ buffs: [] });
  let appliedEvents = 0;
  let refreshed = false;
  eventBus.on('buff.applied', event => {
    appliedEvents += 1;
    refreshed = !!event.refreshed;
  });

  assert.equal(BuffSystem.applyBuff(player, 'validated_buff', Number.NaN).success, false);
  assert.equal(BuffSystem.applyBuff(player, 'validated_buff', 0).success, false);
  assert.equal(BuffSystem.applyBuff(player, 'validated_buff', 500).success, true);
  BuffSystem.tick(player, -100);
  assert.equal(player.buffs[0].remaining, 500);
  BuffSystem.tick(player, 100);
  assert.equal(player.buffs[0].remaining, 400);
  assert.equal(BuffSystem.applyBuff(player, 'validated_buff', 800).success, true);
  assert.equal(player.buffs[0].remaining, 800);
  assert.equal(appliedEvents, 2);
  assert.equal(refreshed, true);
});

test('可叠加 Buff 使用单一实例并受最大层数约束', () => {
  BuffSystem.setTemplates([{
    key: 'stacked_buff', name: '叠层增益', duration: 1000, stackable: true, max_stacks: 2,
    effect_type: 'attribute', attribute_mods: { atkSelfPct: 0.1 },
  }]);
  const player = makeBattlePlayer({ buffs: [] });

  assert.equal(BuffSystem.applyBuff(player, 'stacked_buff').success, true);
  assert.equal(BuffSystem.applyBuff(player, 'stacked_buff').success, true);
  assert.equal(BuffSystem.applyBuff(player, 'stacked_buff').success, true);
  assert.equal(player.buffs.length, 1);
  assert.equal(player.buffs[0].stacks, 2);

  const hooks = {};
  BuffSystem.collectBuffHooks(player, hooks);
  assert.equal(hooks.atkSelfPct, 0.2);
});

test('自动增益会补足可叠加 Buff，但不会超过最大层数', () => {
  const buff = {
    key: 'auto_stacked_buff', name: '自动叠层', duration: 1000, stackable: true, max_stacks: 2,
    effect_type: 'attribute', attribute_mods: { defPct: 0.1 },
  };
  const skill = {
    key: 'auto_stacked_skill', name: '自动叠层武功', type: 'buff', target: 'single', coolDown: 1,
    cost: { mp: 1 }, requirement: { level: 1, min_transfer: 0 }, effect: { buff_key: buff.key },
  };
  BuffSystem.setTemplates([buff]);
  AutoPlaySystem.setMartialArtsData([skill]);
  const player = makeBattlePlayer({
    learned_martial_arts: [skill.key],
    buffs: [],
    auto_play: {
      is_auto_play: true,
      auto_buff_skill: { enabled: true, selected_skill_key: skill.key },
    },
  });

  AutoPlaySystem.tick(player, 1);
  AutoPlaySystem.tick(player, 1);
  AutoPlaySystem.tick(player, 1);
  assert.equal(player.buffs.length, 1);
  assert.equal(player.buffs[0].stacks, 2);
  assert.equal(player.mp, 98);
});

test('自动补给目标低于触发线时会补足到触发线，避免立即误停', () => {
  AutoPlaySystem.setPotionShopItems([{ item_key: 'hp_potion_grade1', buy_price: 1 }]);
  InventorySystem.setItemClassMap({ consumableKeys: ['hp_potion_grade1'] });
  const player = makeBattlePlayer({
    resources: { gold: 100, training: 0, merit: 0 },
    auto_play: {
      is_auto_play: true,
      auto_resupply: {
        trigger_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', trigger_threshold: 10 },
        },
        purchase_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', target_quantity: 5 },
        },
      },
    },
  });

  const summary = AutoPlaySystem._autoBuyPotions(player);
  assert.equal(summary.bought.hp_potion_grade1, 10);
  assert.equal(summary.gold_spent, 10);
  assert.equal(InventorySystem.count(player, 'hp_potion_grade1'), 10);
  assert.equal(AutoPlaySystem._willTriggerResupply(player), false);
});

test('自动补给金币不足时仍会上报已经购买的药品花费', () => {
  AutoPlaySystem.setPotionShopItems([{ item_key: 'hp_potion_grade1', buy_price: 1 }]);
  InventorySystem.setItemClassMap({ consumableKeys: ['hp_potion_grade1'] });
  const player = makeBattlePlayer({
    resources: { gold: 3, training: 0, merit: 0 },
    location: {
      current_map_key: 'resupply_map',
      current_sub_zone_key: 'resupply_zone',
      last_wilderness_sub_zone: 'resupply_zone',
    },
    auto_play: {
      is_auto_play: true,
      auto_resupply: {
        trigger_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', trigger_threshold: 5 },
        },
        purchase_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', target_quantity: 5 },
        },
      },
    },
  });
  let reported = null;
  eventBus.on('autoplay.resupply', summary => { reported = summary; });
  AutoPlaySystem.syncFromPlayer(player);

  assert.equal(AutoPlaySystem._autoResupplyCheck(player, () => true), true);
  assert.deepEqual(reported, { bought: { hp_potion_grade1: 3 }, gold_spent: 3 });
  assert.equal(player.resources.gold, 0);
  assert.equal(player.auto_play.is_auto_play, false);
  assert.equal(player._stopped_reason, 'auto_resupply_gold_insufficient');
});

test('战斗系统会拒绝可能导致单帧死循环的极小攻击与刷怪间隔', () => {
  const config = battleConfig();
  config.battle_flow.battle_model.monster_spawn.spawn_interval_seconds = Number.EPSILON;
  config.battle_flow.battle_model.monster_attack = { atk_interval_ms: Number.EPSILON };
  const monsterTemplate = {
    key: 'interval_guard_monster', name: '间隔测试怪', monster_type: 'normal',
    level: 1, hp: 10, atk: 1, def: 0, exp: 1,
  };
  const zone = { key: 'interval_guard_zone', monsters: [monsterTemplate.key] };
  const battle = createBattle({ player: makeBattlePlayer(), config, monstersData: [monsterTemplate], currentSubZone: zone });

  assert.equal(battle._spawnIntervalMs, 1000);
  assert.equal(battle._spawnMonster(monsterTemplate)._atkIntervalMs, 1000);
  assert.doesNotThrow(() => battle.tick(Number.NaN));
  battle.destroy();
});

test('离线新施放的属性增益会立即参与后续战斗属性', async () => {
  const config = loadJson('config.json');
  const careers = loadJson('careers.json').careers;
  const equipments = loadJson('equipments.json').equipments;
  const martialArts = loadJson('martial_arts.json').martial_arts;
  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  BuffSystem.setTemplates(loadJson('buffs.json').buffs);
  AutoPlaySystem.setMartialArtsData(martialArts);
  const attrSystem = new AttributeSystem({
    attributeConstants: config.attribute_constants,
    qigongSystemRef: QigongSystem,
    buffSystemRef: BuffSystem,
  });
  const flow = runCharacterCreationFlow({
    careersData: careers,
    equipmentsData: equipments,
    attributeConstants: config.attribute_constants,
    globalSave: { character_slots: { unlocked_count: 3, last_used_slot: null } },
  });
  const save = flow.step3_initializeSave('healer', '离线增益', 1).save;
  const zone = { key: 'offline_buff_zone', parent_map_key: 'offline_map', monsters: ['passive_dummy'] };
  save.location.current_sub_zone_key = zone.key;
  save.location.current_map_key = zone.parent_map_key;
  save.auto_play.is_auto_play = true;
  save.auto_play.auto_buff_skill = { enabled: true, selected_skill_key: 'staff_fury_taiji' };
  save.learned_martial_arts = ['staff_fury_taiji'];
  save.player.level = 20;
  save.player.career = 'healer_transfer_1st';
  save.player.career_history = ['healer', 'healer_transfer_1st'];
  save.player.hp = Number.MAX_SAFE_INTEGER;
  save.player.mp = Number.MAX_SAFE_INTEGER;
  Object.assign(save, {
    _config: config,
    _attrSys: attrSystem,
    _buffSys: BuffSystem,
    _careersData: careers,
    _equipmentsData: equipments,
    _martialArtsData: martialArts,
    _monstersData: [{
      key: 'passive_dummy', name: '木桩', passive: true, monster_type: 'normal',
      level: 1, hp: 9999, atk: 0, def: 0, hit: 0, missing: 0, critR: 0, exp: 0,
    }],
    _subZonesData: [zone],
    _subZoneDropsData: [],
    _attributeConstants: config.attribute_constants,
  });
  const baseline = OfflineSimulator._restorePlayerFromSave(save).atkMin;
  const summary = await OfflineSimulator._runSimulation(save, 1, () => {});

  assert.equal(summary._player.buffs.some(buff => buff.key === 'atk_up_20'), true);
  assert.ok(summary._player.atkMin > baseline);
  assert.equal(summary._player.mp, summary._player.maxMp - 20);
});

test('离线补给即使同时自动出售，也会准确统计买药花费与毛收益', async () => {
  InventorySystem.setItemClassMap({
    stoneKeys: ['vajra_01'],
    consumableKeys: ['hp_potion_grade1'],
  });
  AutoPlaySystem.setPotionShopItems([{ item_key: 'hp_potion_grade1', buy_price: 1 }]);
  const player = makeBattlePlayer({
    resources: { gold: 0, training: 0, merit: 0 },
    inventory: {
      capacity: 1,
      slots: [{ item_key: 'vajra_01--atkSelfAdd--1', count: 1 }],
      equipment_instances: {},
    },
    location: {
      current_map_key: 'offline_resupply_map',
      current_sub_zone_key: 'offline_resupply_zone',
      last_wilderness_sub_zone: 'offline_resupply_zone',
    },
    auto_play: {
      is_auto_play: true,
      auto_attack: { attack_type: 'normal', selected_skill_key: null },
      auto_resupply: {
        trigger_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', trigger_threshold: 2 },
        },
        purchase_rules: {
          hp: { enabled: true, selected_potion: 'hp_potion_grade1', target_quantity: 2 },
        },
      },
      auto_sell: {
        enabled: true,
        categories: { vajra: { rules: { atkSelfAdd: { enabled: true, max_value: 1 } } } },
        equipment: { enabled: false, item_keys: [] },
      },
      auto_store: { enabled: false, stones: { rules: [] }, equipment: { item_keys: [] } },
    },
  });
  const save = SaveManager._buildPlayerSave(player, 1000);
  const zone = { key: 'offline_resupply_zone', parent_map_key: 'offline_resupply_map', monsters: ['offline_resupply_dummy'] };
  Object.assign(save, {
    _config: battleConfig(),
    _attrSys: { recompute() {} },
    _careersData: [],
    _equipmentsData: [],
    _martialArtsData: [],
    _monstersData: [{
      key: 'offline_resupply_dummy', name: '补给木桩', passive: true, monster_type: 'normal',
      level: 1, hp: 9999, atk: 0, def: 0, hit: 0, missing: 0, critR: 0, exp: 0,
    }],
    _subZonesData: [zone],
    _subZoneDropsData: [],
  });

  const summary = await OfflineSimulator._runSimulation(save, 1, () => {});
  assert.equal(summary.gold_spent_on_potions, 2);
  assert.equal(summary.gold_gained, 20);
  assert.equal(summary._player.resources.gold, 18);
  assert.equal(InventorySystem.count(summary._player, 'hp_potion_grade1'), 2);
});

test('存档恢复生成独立运行时对象，离线结算也拒绝缺失槽位', async () => {
  const save = SaveManager._buildPlayerSave(makeBattlePlayer({
    career_history: ['warrior_blade'],
    offline: { last_save_timestamp: Date.now() - 120000 },
  }), Date.now() - 120000);
  const first = restoreRuntimePlayerFromSave(save);
  const second = restoreRuntimePlayerFromSave(save);

  first.resources.gold = 99;
  first.inventory.slots.push({ item_key: 'isolation_test', count: 1 });
  first.quests.completed.push('isolation_quest');

  assert.equal(save.resources.gold, 0);
  assert.equal(second.resources.gold, 0);
  assert.equal(save.inventory.slots.length, 0);
  assert.equal(second.inventory.slots.length, 0);
  assert.deepEqual(save.quests.completed, []);
  await assert.rejects(
    OfflineSimulator.settle_offline_rewards({
      ...save,
      auto_play: { ...save.auto_play, is_auto_play: true },
      location: { ...save.location, current_sub_zone_key: 'zone_without_slot' },
    }),
    /槽位无效/,
  );
});

test('热血石绑定具体气功并提升有效等级', () => {
  const qigongs = loadJson('qigong.json').qigongs;
  QigongSystem.setTemplates(qigongs);
  const player = makeBattlePlayer({
    career_family: 'blade',
    qigong: { available_points: 0, invested: { blade_qigong_hit: 1 } },
    _equipTemplates: [{ key: 'cape_test', slot: 'cape', base_stats: {} }],
    inventory: {
      capacity: 50,
      slots: [],
      equipment_instances: {
        cape_1: {
          instance_id: 'cape_1', item_key: 'cape_test', enhance_level: 0,
          synthesis_slots: ['hot_blood_01--skill_level_up--1--blade_qigong_hit'],
        },
      },
    },
    equipped: { cape: { instance_id: 'cape_1' } },
  });

  const entry = QigongSystem.listAvailableQigongs(player).find(item => item.key === 'blade_qigong_hit');
  assert.equal(entry.invested, 1);
  assert.equal(entry.effectiveLevel, 2);
  assert.equal(
    QigongSystem.bindSkillLevelStone(player, 'hot_blood_01--skill_level_up--1', () => 0),
    'hot_blood_01--skill_level_up--1--blade_qigong_hit',
  );
  assert.doesNotThrow(() => QigongSystem.bindSkillLevelStone(
    player,
    'hot_blood_01--skill_level_up--1',
    () => Number.NaN,
  ));
});

test('耳环的全部气功等级加成会进入有效等级且不重复计算', () => {
  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  const player = makeBattlePlayer({
    career_family: 'blade',
    qigong: { available_points: 0, invested: { blade_qigong_atk_min: 1 } },
    _equipTemplates: [{ key: 'earring_qigong_test', slot: 'earring', base_stats: { qigong: 2 } }],
    inventory: {
      capacity: 50,
      slots: [],
      equipment_instances: {
        earring_1: { instance_id: 'earring_1', item_key: 'earring_qigong_test', enhance_level: 0, synthesis_slots: [] },
        misplaced_earring: { instance_id: 'misplaced_earring', item_key: 'earring_qigong_test', enhance_level: 0, synthesis_slots: [] },
      },
    },
    equipped: {
      weapon: { instance_id: 'misplaced_earring' },
      earring: ['earring_1', { instance_id: 'earring_1' }],
    },
  });

  const entry = QigongSystem.listAvailableQigongs(player).find(item => item.key === 'blade_qigong_atk_min');
  assert.equal(entry.invested, 1);
  assert.equal(entry.effectiveLevel, 3);
});

test('气功投点拒绝未解锁、跨职业和无效点数', () => {
  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  const player = makeBattlePlayer({
    level: 1,
    career: 'warrior_blade',
    career_family: 'blade',
    career_history: ['warrior_blade'],
    qigong: { available_points: 5, invested: {} },
  });

  assert.equal(QigongSystem.investQigong(player, 'blade_qigong_counter', 1).success, false);
  assert.equal(QigongSystem.investQigong(player, 'staff_qigong_maxhp', 1).success, false);
  assert.equal(QigongSystem.investQigong(player, 'blade_qigong_atk_min', Number.NaN).success, false);
  assert.equal(QigongSystem.investQigong(player, 'blade_qigong_atk_min', 0.5).success, false);
  assert.equal(QigongSystem.investQigong(player, 'blade_qigong_atk_min', -1).success, false);
  assert.equal(player.qigong.available_points, 5);
  assert.deepEqual(player.qigong.invested, {});

  player.qigong.invested = { staff_qigong_maxhp: 1, blade_qigong_counter: 1 };
  const hooks = {};
  QigongSystem.collectQigongHooks(player, hooks);
  assert.deepEqual(hooks, {});
});

test('双存档任一写入失败会回滚，并可从影子存档自愈和导出', async () => {
  const player = makeBattlePlayer({
    name: '可靠存档',
    offline: { last_save_timestamp: 123 },
    auto_play: { is_auto_play: false },
  });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  const previousPrimary = localStorage.getItem('player-1');
  const previousShadow = localStorage.getItem('player-1-bak');
  const previousTimestamp = player.offline.last_save_timestamp;

  player.name = '不应落盘';
  localStorage.failOnce('player-1-bak');
  assert.equal(await SaveManager.savePlayerState(player, 1), false);
  assert.equal(localStorage.getItem('player-1'), previousPrimary);
  assert.equal(localStorage.getItem('player-1-bak'), previousShadow);
  assert.equal(player.offline.last_save_timestamp, previousTimestamp);

  localStorage.setItem('player-1', '{corrupt');
  const recovered = await SaveManager.readValidPlayerPayload(1);
  assert.equal(recovered.recoveredFromShadow, true);
  assert.equal(recovered.data.player.name, '可靠存档');
  assert.equal(localStorage.getItem('player-1'), previousShadow);

  assert.equal(await SaveManager.saveGlobalState({ character_slots: { unlocked_count: 1, last_used_slot: 1 } }), true);
  const exported = base64Decode(await exportSave({ include_all_characters: true }));
  assert.equal(exported.players['player-1'].data.player.name, '可靠存档');
});

test('全局存档保留三个基础栏位，并拒绝非整数存档时间戳', async () => {
  const normalized = SaveManager.normalizeGlobalState({
    character_slots: { unlocked_count: 1, last_used_slot: 1 },
  });
  assert.equal(normalized.character_slots.unlocked_count, 3);

  const save = SaveManager._buildPlayerSave(
    makeBattlePlayer({ name: '时间校验', offline: { last_save_timestamp: 1 } }),
    1000,
  );
  save.offline.last_save_timestamp = 1.5;
  assert.equal(SaveManager.isValidPlayerSaveData(save), false);

  save.offline.last_save_timestamp = 1000;
  const payload = await SaveManager._validatePlayerPayload(JSON.stringify({
    data: save,
    version: '1.0',
    saved_at: 1000.5,
    checksum: null,
  }));
  assert.equal(payload.valid, false);
});

test('同步新快照不会被仍在计算校验和的旧保存覆盖', async () => {
  const player = makeBattlePlayer({ name: '旧快照', offline: { last_save_timestamp: 1 } });
  const subtle = globalThis.crypto.subtle;
  const originalDigest = subtle.digest;
  subtle.digest = async function delayedDigest(...args) {
    await new Promise(resolve => setTimeout(resolve, 20));
    return originalDigest.apply(this, args);
  };
  try {
    const pendingOldSave = SaveManager.savePlayerState(player, 1);
    player.name = '同步新快照';
    assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
    assert.equal(await pendingOldSave, true);
    const restored = await SaveManager.restorePlayerFromSave(1);
    assert.equal(restored.player.name, '同步新快照');
  } finally {
    subtle.digest = originalDigest;
  }
});

test('并发保存的最新写入失败时不会留下未落盘的离线时间戳', async () => {
  const player = makeBattlePlayer({ name: '并发失败', offline: { last_save_timestamp: 123 } });
  const subtle = globalThis.crypto.subtle;
  const originalDigest = subtle.digest;
  subtle.digest = async function delayedDigest(...args) {
    await new Promise(resolve => setTimeout(resolve, 20));
    return originalDigest.apply(this, args);
  };
  try {
    const olderSave = SaveManager.savePlayerState(player, 1);
    player.name = '最新失败';
    const newerSave = SaveManager.savePlayerState(player, 1);
    localStorage.failOnce('player-1-bak');

    assert.equal(await newerSave, false);
    assert.equal(await olderSave, false);
    assert.equal(player.offline.last_save_timestamp, 123);
    assert.equal(localStorage.getItem('player-1'), null);
    assert.equal(localStorage.getItem('player-1-bak'), null);
  } finally {
    subtle.digest = originalDigest;
  }
});

test('异步保存会冻结嵌套快照，校验和计算期间的运行时变化不会污染存档', async () => {
  const player = makeBattlePlayer({
    name: '嵌套快照',
    career_history: ['warrior_blade'],
    learned_martial_arts: ['blade_skill_test'],
    qigong: { available_points: 1, invested: { blade_qigong_atk_min: 1 }, attribute_reset_count: 0 },
    quests: { accepted: [], completed: ['quest_before_save'] },
    offline: { last_save_timestamp: 1 },
  });
  const subtle = globalThis.crypto.subtle;
  const originalDigest = subtle.digest;
  subtle.digest = async function delayedDigest(...args) {
    await new Promise(resolve => setTimeout(resolve, 20));
    return originalDigest.apply(this, args);
  };
  try {
    const pendingSave = SaveManager.savePlayerState(player, 1);
    player.career_history.push('warrior_blade_transfer_1st');
    player.learned_martial_arts.push('blade_skill_after_save');
    player.qigong.invested.blade_qigong_atk_min = 2;
    player.quests.completed.push('quest_after_save');
    assert.equal(await pendingSave, true);

    const restored = await SaveManager.restorePlayerFromSave(1);
    assert.deepEqual(restored.player.career_history, ['warrior_blade']);
    assert.deepEqual(restored.learned_martial_arts, ['blade_skill_test']);
    assert.deepEqual(restored.qigong.invested, { blade_qigong_atk_min: 1 });
    assert.deepEqual(restored.quests.completed, ['quest_before_save']);
  } finally {
    subtle.digest = originalDigest;
  }
});

test('旧存档双槽中的字符串装备引用可被规范化后继续保存', () => {
  const player = makeBattlePlayer({
    equipped: { gloves: ['legacy-glove-id', null] },
    inventory: {
      capacity: 10,
      slots: [],
      equipment_instances: {
        'legacy-glove-id': {
          instance_id: 'legacy-glove-id',
          item_key: 'legacy_glove',
          enhance_level: 0,
          synthesis_slots: [],
        },
      },
    },
  });
  assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
  const saved = JSON.parse(localStorage.getItem('player-1')).data;
  assert.deepEqual(saved.equipped.gloves, [{ instance_id: 'legacy-glove-id' }, null]);
  assert.equal(SaveManager.isValidPlayerSaveData(saved), true);
});

test('主影子分叉时选择较新有效副本，并拒绝伪造的空同步快照', async () => {
  const player = makeBattlePlayer({ name: '较旧主档', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
  const olderPrimary = localStorage.getItem('player-1');
  const newerShadow = JSON.parse(olderPrimary);
  newerShadow.saved_at += 1000;
  newerShadow.data.offline.last_save_timestamp = newerShadow.saved_at;
  newerShadow.data.player.name = '较新影子档';
  localStorage.setItem('player-1-bak', JSON.stringify(newerShadow));

  const recovered = await SaveManager.readValidPlayerPayload(1);
  assert.equal(recovered.recoveredFromShadow, true);
  assert.equal(recovered.data.player.name, '较新影子档');
  assert.equal(localStorage.getItem('player-1'), localStorage.getItem('player-1-bak'));

  const forged = { version: '1.0', saved_at: Date.now(), checksum: null, data: {} };
  localStorage.setItem('player-2', JSON.stringify(forged));
  localStorage.setItem('player-2-bak', JSON.stringify(forged));
  assert.equal(await SaveManager.restorePlayerFromSave(2), null);
});

test('存档拒绝嵌套污染，且同步快照构造失败不会覆盖旧档', async () => {
  const player = makeBattlePlayer({ name: '结构守卫', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
  const validRaw = localStorage.getItem('player-1');
  const validData = JSON.parse(validRaw).data;
  const orphaned = structuredClone(validData);
  orphaned.inventory.equipment_instances.orphan = {
    instance_id: 'orphan', item_key: 'blade_orphan', enhance_level: 0, synthesis_slots: [],
  };
  assert.equal(SaveManager.isValidPlayerSaveData(orphaned), false);
  const oversizedStack = structuredClone(validData);
  oversizedStack.inventory.slots.push({ item_key: 'hp_potion_grade1', count: 1000 });
  assert.equal(SaveManager.isValidPlayerSaveData(oversizedStack), false);
  const fractionalExp = structuredClone(validData);
  fractionalExp.player.exp = 0.5;
  assert.equal(SaveManager.isValidPlayerSaveData(fractionalExp), false);
  const malformed = JSON.parse(validRaw);
  malformed.data.inventory.slots.push({ item_key: '<script>', count: 1 });
  malformed.saved_at += 1;
  malformed.data.offline.last_save_timestamp = malformed.saved_at;
  localStorage.setItem('player-1', JSON.stringify(malformed));
  localStorage.setItem('player-1-bak', JSON.stringify(malformed));
  assert.equal(await SaveManager.restorePlayerFromSave(1), null);

  const unsafeQuest = structuredClone(validData);
  unsafeQuest.quests.accepted = [{
    key: 'unsafe_quest',
    faction: 'positive" onclick="alert(1)',
    current_stage: 1,
    completed_stages: [],
    objectives: [],
    rewards: [],
  }];
  assert.equal(SaveManager.isValidPlayerSaveData(unsafeQuest), false);

  localStorage.setItem('player-1', validRaw);
  localStorage.setItem('player-1-bak', validRaw);
  const previousTimestamp = player.offline.last_save_timestamp;
  player.auto_play.circular = player.auto_play;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(SaveManager.savePlayerStateSync(player, 1), false);
  } finally {
    console.warn = originalWarn;
    delete player.auto_play.circular;
  }
  assert.equal(localStorage.getItem('player-1'), validRaw);
  assert.equal(localStorage.getItem('player-1-bak'), validRaw);
  assert.equal(player.offline.last_save_timestamp, previousTimestamp);
});

test('存档拒绝重复装备位置与跨容器实例复制', () => {
  const base = SaveManager._buildPlayerSave(makeBattlePlayer({ offline: { last_save_timestamp: 1 } }), 1);
  const equipment = {
    instance_id: 'dup_equipment', item_key: 'blade_dup', enhance_level: 0,
    synthesis_slots: [], desc: '', extra: {},
  };

  const bothEquippedAndSlotted = structuredClone(base);
  bothEquippedAndSlotted.inventory.equipment_instances[equipment.instance_id] = structuredClone(equipment);
  bothEquippedAndSlotted.inventory.slots.push({ item_key: equipment.item_key, instance_id: equipment.instance_id, count: 1 });
  bothEquippedAndSlotted.equipped.weapon = { instance_id: equipment.instance_id };
  assert.equal(SaveManager.isValidPlayerSaveData(bothEquippedAndSlotted), false);

  const copiedAcrossContainers = structuredClone(base);
  copiedAcrossContainers.inventory.equipment_instances[equipment.instance_id] = structuredClone(equipment);
  copiedAcrossContainers.inventory.slots.push({ item_key: equipment.item_key, instance_id: equipment.instance_id, count: 1 });
  copiedAcrossContainers.warehouse.equipment_instances[equipment.instance_id] = structuredClone(equipment);
  copiedAcrossContainers.warehouse.slots.push({ item_key: equipment.item_key, instance_id: equipment.instance_id, count: 1 });
  assert.equal(SaveManager.isValidPlayerSaveData(copiedAcrossContainers), false);

});

test('全量导入原子替换存档并拒绝越界角色槽位', async () => {
  const exportedPlayer = makeBattlePlayer({ name: '导出角色', offline: { last_save_timestamp: 1 } });
  assert.equal(await SaveManager.savePlayerState(exportedPlayer, 1), true);
  assert.equal(await SaveManager.saveGlobalState({
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  }), true);
  const packText = await exportSave({ include_all_characters: true });

  exportedPlayer.name = '本地新角色';
  assert.equal(await SaveManager.savePlayerState(exportedPlayer, 1), true);
  const imported = await importSave(packText);
  assert.equal(imported.success, true);
  assert.equal((await SaveManager.restorePlayerFromSave(1)).player.name, '导出角色');
  assert.equal(localStorage.getItem('import_in_progress'), null);

  const invalidPack = base64Decode(packText);
  invalidPack.players['player-11'] = invalidPack.players['player-1'];
  const rejected = await importSave(base64Encode(invalidPack));
  assert.equal(rejected.success, false);
  assert.equal((await SaveManager.restorePlayerFromSave(1)).player.name, '导出角色');
});

test('全量与单角色导入都拒绝跨槽复制同一角色身份', async () => {
  const first = makeBattlePlayer({ id: 'unique-player-1', name: '角色甲', offline: { last_save_timestamp: 1 } });
  const second = makeBattlePlayer({ id: 'unique-player-2', name: '角色乙', offline: { last_save_timestamp: 1 } });
  assert.equal(await SaveManager.savePlayerState(first, 1), true);
  assert.equal(await SaveManager.savePlayerState(second, 2), true);
  assert.equal(await SaveManager.saveGlobalState({
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  }), true);

  const fullPack = base64Decode(await exportSave({ include_all_characters: true }));
  fullPack.players['player-2'] = structuredClone(fullPack.players['player-1']);
  const rejectedFull = await importSave(base64Encode(fullPack));
  assert.equal(rejectedFull.success, false);
  assert.match(rejectedFull.message, /角色 ID 重复/);
  assert.equal((await SaveManager.restorePlayerFromSave(2)).player.id, 'unique-player-2');

  const partialPack = base64Decode(await exportSave({ include_all_characters: false }));
  partialPack.player.slot_index = 2;
  const rejectedPartial = await importSave(base64Encode(partialPack));
  assert.equal(rejectedPartial.success, false);
  assert.match(rejectedPartial.message, /已存在于第 1 号位/);
  assert.equal((await SaveManager.restorePlayerFromSave(2)).player.id, 'unique-player-2');
});

test('单角色导入写影子失败时完整回滚且清除事务标记', async () => {
  const player = makeBattlePlayer({ name: '待导入版本', offline: { last_save_timestamp: 1 } });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  assert.equal(await SaveManager.saveGlobalState({
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  }), true);
  const partialPack = await exportSave({ include_all_characters: false });

  player.name = '应保留版本';
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  localStorage.failOnce('player-1-bak');
  const imported = await importSave(partialPack);
  assert.equal(imported.success, false);
  assert.equal((await SaveManager.restorePlayerFromSave(1)).player.name, '应保留版本');
  assert.equal(localStorage.getItem('import_in_progress'), null);
});

test('启动时会从持久化事务备份恢复被中断的全量导入', async () => {
  const player = makeBattlePlayer({ name: '导入前角色', offline: { last_save_timestamp: 1 } });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  assert.equal(await SaveManager.saveGlobalState({
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  }), true);
  const originalEntries = ['game', 'player-1', 'player-1-bak']
    .map(key => [key, localStorage.getItem(key)]);
  localStorage.setItem('import_backup', JSON.stringify({
    version: '1.0', kind: 'full', entries: originalEntries,
  }));
  localStorage.setItem('import_in_progress', 'true');
  localStorage.setItem('game', '{interrupted');
  localStorage.setItem('player-1', '{interrupted');
  localStorage.setItem('player-1-bak', '{interrupted');
  localStorage.setItem('player-2', '{partial-new-save');
  localStorage.setItem('player-preferences', 'unrelated');

  let shownCharacters = null;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await runStartupSequence({
      onFirstLaunch: () => assert.fail('不应进入首次启动'),
      onNoCharacter: () => assert.fail('不应进入无角色流程'),
      onShowMultiSaveList: ({ characters }) => { shownCharacters = characters; },
    });
  } finally {
    console.warn = originalWarn;
  }

  for (const [key, value] of originalEntries) assert.equal(localStorage.getItem(key), value);
  assert.equal(localStorage.getItem('player-2'), null);
  assert.equal(localStorage.getItem('player-preferences'), 'unrelated');
  assert.equal(localStorage.getItem('import_in_progress'), null);
  assert.equal(localStorage.getItem('import_backup'), null);
  assert.equal(shownCharacters?.[0]?.player?.name, '导入前角色');
});

test('损坏的导入事务备份会保留现场并阻止继续启动', async () => {
  const player = makeBattlePlayer({ name: '保留现场', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
  const primary = localStorage.getItem('player-1');
  localStorage.setItem('import_backup', '{corrupt');
  localStorage.setItem('import_in_progress', 'true');
  await assert.rejects(() => runStartupSequence({
    onFirstLaunch() {},
    onNoCharacter() {},
    onShowMultiSaveList() {},
  }), /旧存档恢复失败/);
  assert.equal(localStorage.getItem('player-1'), primary);
  assert.equal(localStorage.getItem('import_in_progress'), 'true');
  assert.equal(localStorage.getItem('import_backup'), '{corrupt');
});

test('缺少事务备份时不会破坏性重置现有存档', async () => {
  const player = makeBattlePlayer({ name: '保留旧档', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 1), true);
  const primary = localStorage.getItem('player-1');
  localStorage.setItem('import_in_progress', 'true');

  await assert.rejects(() => runStartupSequence({
    onFirstLaunch() {},
    onNoCharacter() {},
    onShowMultiSaveList() {},
  }), /缺少事务备份/);
  assert.equal(localStorage.getItem('player-1'), primary);
  assert.equal(localStorage.getItem('import_in_progress'), 'true');
});

test('全局存档丢失时从角色副本重建栏位信息', async () => {
  const player = makeBattlePlayer({ name: '找回角色', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 4), true);
  let shown = null;
  let firstLaunchCalled = false;
  await runStartupSequence({
    onFirstLaunch() { firstLaunchCalled = true; },
    onNoCharacter() {},
    onShowMultiSaveList(payload) { shown = payload; },
  });

  assert.equal(firstLaunchCalled, false);
  assert.equal(shown?.characters?.[0]?.slotIndex, 4);
  assert.equal(shown?.globalSave?.character_slots?.unlocked_count, 4);
  assert.equal(SaveManager.restoreGlobalState()?.character_slots?.unlocked_count, 4);
});

test('全局存档低估已解锁栏位时找回高栏位角色', async () => {
  const player = makeBattlePlayer({ name: '高栏位角色', offline: { last_save_timestamp: 1 } });
  assert.equal(SaveManager.savePlayerStateSync(player, 5), true);
  assert.equal(await SaveManager.saveGlobalState({
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: null },
  }), true);

  let shown = null;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await runStartupSequence({
      onFirstLaunch: () => assert.fail('不应进入首次启动'),
      onNoCharacter: () => assert.fail('不应进入无角色流程'),
      onShowMultiSaveList(payload) { shown = payload; },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(shown?.characters?.[0]?.slotIndex, 5);
  assert.equal(shown?.globalSave?.character_slots?.unlocked_count, 5);
  assert.equal(SaveManager.restoreGlobalState()?.character_slots?.unlocked_count, 5);
});

test('角色删除任一副本失败会恢复主影子与全局引用', async () => {
  const player = makeBattlePlayer({ name: '不可半删', offline: { last_save_timestamp: 1 } });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  const globalSave = {
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  };
  assert.equal(await SaveManager.saveGlobalState(globalSave), true);
  const primary = localStorage.getItem('player-1');
  const shadow = localStorage.getItem('player-1-bak');

  localStorage.failRemoveOnce('player-1-bak');
  const deleted = await executeDeletion(1, globalSave);
  assert.equal(deleted.success, false);
  assert.equal(localStorage.getItem('player-1'), primary);
  assert.equal(localStorage.getItem('player-1-bak'), shadow);
  assert.equal(globalSave.character_slots.last_used_slot, 1);
  assert.equal((await executeDeletion(4, globalSave)).success, false);
});

test('栏位解锁的全局写入失败时原样退回金币存档', async () => {
  const player = makeBattlePlayer({
    resources: { gold: 150, training: 0, merit: 0 },
    offline: { last_save_timestamp: 1 },
  });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  const globalSave = {
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  };
  assert.equal(await SaveManager.saveGlobalState(globalSave), true);
  const primary = localStorage.getItem('player-1');
  const shadow = localStorage.getItem('player-1-bak');
  const previousTimestamp = player.offline.last_save_timestamp;

  localStorage.failOnce('game');
  const result = await executeSlotUnlock(4, globalSave, { activePlayer: player, payerSlot: 1 });
  assert.equal(result.success, false);
  assert.match(result.message, /金币已退回/);
  assert.equal(player.resources.gold, 150);
  assert.equal(player.offline.last_save_timestamp, previousTimestamp);
  assert.equal(globalSave.character_slots.unlocked_count, 3);
  assert.equal(localStorage.getItem('player-1'), primary);
  assert.equal(localStorage.getItem('player-1-bak'), shadow);
});

test('栏位解锁拒绝使用与支付槽不匹配的活动角色', async () => {
  const savedPlayer = makeBattlePlayer({
    id: 'saved-player',
    resources: { gold: 150, training: 0, merit: 0 },
  });
  assert.equal(await SaveManager.savePlayerState(savedPlayer, 1), true);
  const primary = localStorage.getItem('player-1');
  const shadow = localStorage.getItem('player-1-bak');
  const activePlayer = makeBattlePlayer({
    id: 'different-player',
    resources: { gold: 150, training: 0, merit: 0 },
  });
  const globalSave = {
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  };

  const result = await executeSlotUnlock(4, globalSave, { activePlayer, payerSlot: 1 });

  assert.equal(result.success, false);
  assert.match(result.message, /不匹配/);
  assert.equal(activePlayer.resources.gold, 150);
  assert.equal(globalSave.character_slots.unlocked_count, 3);
  assert.equal(localStorage.getItem('player-1'), primary);
  assert.equal(localStorage.getItem('player-1-bak'), shadow);
});

test('并发栏位解锁只会扣款并提交一次', async () => {
  const player = makeBattlePlayer({
    id: 'concurrent-unlock-player',
    resources: { gold: 150, training: 0, merit: 0 },
  });
  assert.equal(await SaveManager.savePlayerState(player, 1), true);
  const globalSave = {
    schema_version: '1.0',
    character_slots: { unlocked_count: 3, last_used_slot: 1 },
  };

  const [first, second] = await Promise.all([
    executeSlotUnlock(4, globalSave, { activePlayer: player, payerSlot: 1 }),
    executeSlotUnlock(4, globalSave, { activePlayer: player, payerSlot: 1 }),
  ]);

  assert.equal([first, second].filter(result => result.success).length, 1);
  assert.equal([first, second].filter(result => !result.success).length, 1);
  assert.equal(player.resources.gold, 50);
  assert.equal(globalSave.character_slots.unlocked_count, 4);
  assert.equal((await SaveManager.restorePlayerFromSave(1)).resources.gold, 50);
});

test('掉落使用地图金币范围、布尔开关和等级差衰减', async () => {
  const dropSystem = new DropSystem({ config: { monster_drop_box: null } });
  const player = makeBattlePlayer();
  const monster = { level: 1, map_key: null, drop_items: [] };
  const enabledTable = {
    drop_rolls: [{ trigger: 'always', enabled: true, roll_count: 1, equipment_pool: [], stone_pool: [] }],
  };
  await withRandom([0, 0.999999], () => dropSystem.evaluate(player, monster, enabledTable, { gold_range: [3, 5] }));
  assert.equal(player.resources.gold, 5);
  assert.equal(player.statistics.total_gold_earned, 5);

  const disabledTable = {
    drop_rolls: [{ trigger: 'always', enabled: false, roll_count: 1, equipment_pool: [], stone_pool: [] }],
  };
  await withRandom([0, 0.999999], () => dropSystem.evaluate(player, monster, disabledTable, { gold_range: [100, 100] }));
  assert.equal(player.resources.gold, 5);
  assert.deepEqual(dropSystem.getLevelDifferenceModifiers(10, 1), {
    rate_modifier: 0, exp_modifier: 0, training_modifier: 0, gold_modifier: 0,
  });
});

test('掉落按实际可入账数量汇总，并兼容旧任务阶段字符串', async () => {
  const player = makeBattlePlayer({
    resources: {
      gold: Number.MAX_SAFE_INTEGER - 2,
      training: Number.MAX_SAFE_INTEGER,
      merit: 0,
    },
    statistics: {
      total_kills: 0,
      total_deaths: 0,
      total_gold_earned: Number.MAX_SAFE_INTEGER - 1,
      total_playtime_ms: 0,
    },
  });
  const dropSystem = new DropSystem();
  const table = {
    drop_rolls: [{ trigger: 'always', enabled: true, roll_count: 1, equipment_pool: [], stone_pool: [] }],
  };
  const summary = await withRandom([0, 0.999999], () => dropSystem.evaluate(
    player,
    { level: 1, map_key: null, drop_items: [] },
    table,
    { gold_range: [5, 5] },
  ));
  assert.equal(summary.gold, 1);
  assert.equal(summary.training, 0);
  assert.equal(player.resources.gold, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(player.statistics.total_gold_earned, Number.MAX_SAFE_INTEGER);

  InventorySystem.setItemClassMap({ questItemKeys: ['legacy_token'] });
  let stageChecks = 0;
  player.inventory = { capacity: 10, slots: [], equipment_instances: {} };
  player.quests = {
    accepted: [{
      key: 'legacy_quest',
      current_stage: '1',
      objectives: [{ stage: '1', items: [{ item_key: 'legacy_token', count: 1 }] }],
    }],
    completed: [],
  };
  const questDropSystem = new DropSystem({
    taskSystemRef: { stageAdvanceCheck() { stageChecks += 1; } },
  });
  await withRandom([0], () => questDropSystem.evaluate(
    player,
    { level: 1, map_key: null, drop_items: [{ item_key: 'legacy_token', droprate: 1 }] },
    null,
  ));
  assert.equal(InventorySystem.count(player, 'legacy_token'), 1);
  assert.equal(player.quests.accepted[0].current_stage, 1);
  assert.equal(stageChecks, 1);
});

test('多个已接任务需要同一物品时，掉落不会被先遇到的已满额任务阻断', async () => {
  InventorySystem.setItemClassMap({ questItemKeys: ['shared_token'] });
  const player = makeBattlePlayer();
  player.inventory = {
    capacity: 10,
    slots: [{ item_key: 'shared_token', count: 1 }],
    equipment_instances: {},
  };
  player.quests = {
    accepted: [
      { key: 'already_ready', current_stage: 1, objectives: [{ stage: 1, items: [{ item_key: 'shared_token', count: 1 }] }] },
      { key: 'still_collecting', current_stage: 1, objectives: [{ stage: 1, items: [{ item_key: 'shared_token', count: 2 }] }] },
    ],
    completed: [],
  };
  let stageChecks = 0;
  const dropSystem = new DropSystem({ taskSystemRef: { stageAdvanceCheck() { stageChecks += 1; } } });

  await withRandom([0], () => dropSystem.evaluate(
    player,
    { level: 1, map_key: null, drop_items: [{ item_key: 'shared_token', droprate: 1 }] },
    null,
  ));

  assert.equal(InventorySystem.count(player, 'shared_token'), 2);
  assert.equal(stageChecks, 1);
});

test('任务物品因背包满丢失时同步停止挂机状态并发出事件', async () => {
  InventorySystem.setItemClassMap({ questItemKeys: ['blocked_token'] });
  const player = makeBattlePlayer({ auto_play: { is_auto_play: true } });
  player.inventory = {
    capacity: 1,
    slots: [{ item_key: 'hp_potion_grade1', count: 1 }],
    equipment_instances: {},
  };
  player.quests = {
    accepted: [{
      key: 'blocked_quest',
      current_stage: 1,
      objectives: [{ stage: 1, items: [{ item_key: 'blocked_token', count: 1 }] }],
    }],
    completed: [],
  };
  AutoPlaySystem.syncFromPlayer(player);
  let stopReason = null;
  eventBus.on('autoplay.stop', ({ reason }) => { stopReason = reason; });
  const dropSystem = new DropSystem({ taskSystemRef: { stageAdvanceCheck() {} } });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await withRandom([0], () => dropSystem.evaluate(
      player,
      { level: 1, map_key: null, drop_items: [{ item_key: 'blocked_token', droprate: 1 }] },
      null,
    ));
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(player._quest_item_blocked, true);
  assert.equal(player._stopped_reason, 'inventory_full_quest_item');
  assert.equal(player.auto_play.is_auto_play, false);
  assert.equal(AutoPlaySystem.is_auto_play, false);
  assert.equal(stopReason, 'inventory_full_quest_item');
});

test('传送先校验目标，成功后清空旧战场并停止手动切图挂机', () => {
  const player = makeBattlePlayer({
    location: { current_map_key: 'wilderness_xuanbo_suburb', current_sub_zone_key: 'zone_a' },
    auto_play: { is_auto_play: true },
  });
  const monster = { key: 'stale_monster' };
  const game = {
    subZonesData: [{ key: 'zone_a' }, { key: 'zone_b' }],
    battle: {
      monsters: [monster],
      _mainTargetKey: 'stale-target',
      _currentSubZone: { key: 'zone_a' },
      _initialSpawned: true,
      _spawnTimerMs: 900,
      _playerAtkCd: 800,
    },
  };

  assert.equal(TeleportSystem.teleport('unknown_zone', 'player_click', player, game), false);
  assert.equal(player.location.current_sub_zone_key, 'zone_a');
  assert.equal(player.auto_play.is_auto_play, true);
  assert.deepEqual(game.battle.monsters, [monster]);

  assert.equal(TeleportSystem.teleport('zone_b', 'player_click', player, game), true);
  assert.equal(player.location.current_sub_zone_key, 'zone_b');
  assert.equal(player.location.last_wilderness_sub_zone, 'zone_a');
  assert.equal(player.auto_play.is_auto_play, false);
  assert.deepEqual(game.battle.monsters, []);
  assert.equal(game.battle._mainTargetKey, null);
  assert.equal(game.battle._currentSubZone.key, 'zone_b');
  assert.equal(game.battle._initialSpawned, false);
  assert.equal(game.battle._spawnTimerMs, 0);
  assert.equal(game.battle._playerAtkCd, 0);
});

test('经验、死亡惩罚与旧气功接口拒绝无效数值', () => {
  const player = makeBattlePlayer({ level: 1, exp: 0, qigong: { available_points: 2, skills: {} } });
  const config = {
    current_level_cap: 3,
    exp_to_next_level: { 1: 100, 2: 100 },
  };
  assert.equal(grantExp(player, -100, config), 0);
  assert.equal(grantExp(player, Number.NaN, config), 0);
  assert.equal(grantExp(player, 0.5, config), 0);
  assert.equal(player.exp, 0);
  assert.equal(grantExp(player, 250, config), 2);
  assert.equal(player.level, 3);
  assert.equal(player.exp, 0);
  assert.equal(assignQigongPoint(player, 'blade_qigong_atk_min', -1), false);
  assert.equal(assignQigongPoint(player, 'blade_qigong_atk_min', 0.5), false);
  assert.equal(assignQigongPoint(player, 'blade_qigong_atk_min', 1), true);
  assert.equal(player.qigong.available_points, 1);
  player.qigong.available_points = 1;
  player.qigong.skills.blade_qigong_atk_min = Number.MAX_SAFE_INTEGER;
  assert.equal(assignQigongPoint(player, 'blade_qigong_atk_min', 1), false);
  assert.equal(player.qigong.available_points, 1);
  player.qigong = { available_points: Number.MAX_SAFE_INTEGER, invested: {} };
  assert.equal(onLevelUp(player, 1, 2, {
    attribute_points: { gain_per_level: { 2: 1 } },
  }, () => {}), 0);
  assert.equal(player.qigong.available_points, Number.MAX_SAFE_INTEGER);
  player.level = 2;
  player.exp = 99;
  assert.equal(applyDeathExpLoss(player, config), 1);
  assert.equal(player.exp, 98);
});

test('新角色以满生命内功创建，并由统一流程发放职业初始武器', async () => {
  const careers = loadJson('careers.json').careers;
  const equipments = loadJson('equipments.json').equipments;
  const constants = loadJson('config.json').attribute_constants;
  const flow = runCharacterCreationFlow({
    careersData: careers,
    equipmentsData: equipments,
    attributeConstants: constants,
    globalSave: { character_slots: { unlocked_count: 3, last_used_slot: null } },
  });
  const initialized = flow.step3_initializeSave('warrior_blade', '初始属性', 1);
  assert.equal(initialized.success, true);
  assert.equal(initialized.save.player.hp, 145);
  assert.equal(initialized.save.player.mp, 116);
  assert.equal(initialized.save.inventory.slots.length, 1);
  assert.equal(initialized.save.inventory.slots[0].item_key, 'blade_base_001');
  assert.equal(Object.keys(initialized.save.inventory.equipment_instances).length, 1);
  const lockedGlobalSave = { character_slots: { unlocked_count: 3, last_used_slot: null } };
  const lockedPersist = await flow.step4_persist(initialized.save, 4, lockedGlobalSave);
  assert.equal(lockedPersist.success, false);
  assert.equal(localStorage.getItem('player-4'), null);

  const missingWeaponFlow = runCharacterCreationFlow({
    careersData: careers,
    equipmentsData: [],
    attributeConstants: constants,
    globalSave: { character_slots: { unlocked_count: 3, last_used_slot: null } },
  });
  assert.equal(missingWeaponFlow.step3_initializeSave('warrior_blade', '缺少武器', 2).success, false);
});

test('合成与强化的每次结果提示不展示成功概率', async () => {
  const enhanceEquipment = { key: 'weapon_probability_test', slot: 'weapon', required_level: 1, base_stats: { atkMin: 1, atkMax: 2 } };
  const enhancePlayer = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [enhanceEquipment],
    inventory: {
      capacity: 50,
      slots: [
        { item_key: enhanceEquipment.key, instance_id: 'weapon_probability_1', count: 1 },
        { item_key: 'enhance_stone_01', count: 1 },
      ],
      equipment_instances: {
        weapon_probability_1: { instance_id: 'weapon_probability_1', item_key: enhanceEquipment.key, enhance_level: 0, synthesis_slots: [] },
      },
    },
  });
  const enhanced = await withRandom([0], () => EnhanceSystem.enhance(enhancePlayer, 'weapon_probability_1'));
  assert.equal(enhanced.success, true);
  assert.doesNotMatch(enhanced.message, /成功率|概率|%/);

  const synthesisEquipment = { key: 'cape_probability_test', slot: 'cape', required_level: 1, base_stats: {} };
  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  const synthesisPlayer = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [synthesisEquipment],
    qigong: { available_points: 0, invested: { blade_qigong_hit: 1 } },
    inventory: {
      capacity: 50,
      slots: [
        { item_key: synthesisEquipment.key, instance_id: 'cape_2', count: 1 },
        { item_key: 'hot_blood_01--skill_level_up--1', count: 1 },
      ],
      equipment_instances: {
        cape_2: { instance_id: 'cape_2', item_key: synthesisEquipment.key, enhance_level: 0, synthesis_slots: [] },
      },
    },
  });
  const synthesized = await withRandom([0], () => SynthesisSystem.synthesize(
    synthesisPlayer,
    'cape_2',
    'hot_blood_01--skill_level_up--1',
  ));
  assert.equal(synthesized.success, true);
  assert.doesNotMatch(synthesized.message, /成功率|概率|%/);
  assert.match(synthesisPlayer.inventory.equipment_instances.cape_2.synthesis_slots[0], /--blade_qigong_hit$/);
});

test('刀剑笑对所有职业使用中性称呼', () => {
  const source = readFileSync(join(ROOT, 'ui', 'NPCDialogUI.js'), 'utf8');
  const dialogue = source.match(/line: '「([^']*趁手的新兵器[^']*)」'/)?.[1] || '';
  assert.match(dialogue, /少侠/);
  assert.doesNotMatch(dialogue, /刀客|剑客|枪客|医师/);
});

test('旧存档合成孔位空洞会先紧凑化，不会追加出超限孔位', async () => {
  const equipment = { key: 'weapon_legacy_holes', slot: 'weapon', required_level: 1, base_stats: {} };
  const player = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    inventory: {
      capacity: 50,
      slots: [
        { item_key: equipment.key, instance_id: 'legacy_holes_1', count: 1 },
        { item_key: 'vajra_01--atkSelfAdd--2', count: 1 },
      ],
      equipment_instances: {
        legacy_holes_1: {
          instance_id: 'legacy_holes_1',
          item_key: equipment.key,
          enhance_level: 0,
          synthesis_slots: ['vajra_01--atkSelfAdd--1', null, null, null],
        },
      },
    },
  });

  const result = await withRandom([0], () => SynthesisSystem.synthesize(
    player,
    'legacy_holes_1',
    'vajra_01--atkSelfAdd--2',
  ));
  assert.equal(result.success, true);
  assert.deepEqual(player.inventory.equipment_instances.legacy_holes_1.synthesis_slots, [
    'vajra_01--atkSelfAdd--1',
    'vajra_01--atkSelfAdd--2',
  ]);
});

test('合成绑定后的石头键超长时不扣除石头和金币', () => {
  const equipment = { key: 'cape_long_stone', slot: 'cape', required_level: 1, base_stats: {} };
  const longStoneKey = `hot_blood_${'x'.repeat(220)}--skill_level_up--1`;
  assert.ok(longStoneKey.length <= 256);
  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  const player = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    qigong: { available_points: 0, invested: { blade_qigong_hit: 1 } },
    inventory: {
      capacity: 10,
      slots: [
        { item_key: equipment.key, instance_id: 'cape-long-stone-instance', count: 1 },
        { item_key: longStoneKey, count: 1 },
      ],
      equipment_instances: {
        'cape-long-stone-instance': {
          instance_id: 'cape-long-stone-instance', item_key: equipment.key, enhance_level: 0, synthesis_slots: [],
        },
      },
    },
  });

  const result = SynthesisSystem.synthesize(player, 'cape-long-stone-instance', longStoneKey);
  assert.equal(result.success, false);
  assert.equal(result.message, '合成石数据无效');
  assert.equal(InventorySystem.count(player, longStoneKey), 1);
  assert.equal(player.resources.gold, 10000);
  assert.deepEqual(player.inventory.equipment_instances['cape-long-stone-instance'].synthesis_slots, []);
});

test('事件监听异常不会阻断同事件或后续游戏 tick', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const bus = new EventBus();
    let delivered = 0;
    bus.on('test', () => { throw new Error('expected'); });
    bus.on('test', () => { delivered += 1; });
    bus.emit('test');
    assert.equal(delivered, 1);

    const loop = new GameLoop({ tickIntervalMs: 5, maxDeltaMs: 10 });
    let healthyTicks = 0;
    const deltas = [];
    let droppedMs = 0;
    eventBus.on('game.loop_gap', data => { droppedMs += data.droppedMs; });
    loop.addTickListener(() => { throw new Error('expected'); });
    loop.addTickListener((_tick, deltaMs) => {
      assert.ok(deltaMs >= 0);
      deltas.push(deltaMs);
      healthyTicks += 1;
    });
    loop.start();
    const blockedUntil = Date.now() + 30;
    while (Date.now() < blockedUntil) {
      // 模拟浏览器后台冻结后恢复。
    }
    await new Promise(resolve => setTimeout(resolve, 35));
    loop.stop();
    assert.ok(healthyTicks >= 3);
    assert.ok(deltas.every(delta => delta <= 10));
    assert.ok(droppedMs > 0);
    assert.equal(loop.isRunning, false);
  } finally {
    console.error = originalError;
  }
});

test('全部数据文件可解析且跨配置引用校验通过', () => {
  const careers = loadJson('careers.json');
  const monsters = loadJson('monsters.json');
  const equipments = loadJson('equipments.json');
  const stones = loadJson('stones.json');
  const subZones = loadJson('sub_zones.json');
  const drops = loadJson('drops.json');
  const boxes = loadJson('boxes.json');
  const npcs = loadJson('npcs.json');
  const quests = loadJson('quests.json');
  const qigongs = loadJson('qigong.json');
  const buffs = loadJson('buffs.json');
  const martialArts = loadJson('martial_arts.json');

  for (const file of walkFiles(DATA_DIR, '.json')) assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8')), file);
  for (const table of drops.sub_zone_drops) {
    for (const roll of table.drop_rolls || []) assert.equal(typeof roll.enabled, 'boolean');
  }

  const result = validateGameConfig({
    config: loadJson('config.json'),
    careersData: careers.careers,
    monstersData: monsters.monsters,
    equipmentsData: equipments.equipments,
    stonesData: stones,
    subZonesData: subZones.sub_zones,
    subZoneDropsData: drops.sub_zone_drops,
    monsterDropBoxData: boxes.monster_drop_box,
    boxesData: boxes.boxes,
    npcsData: npcs.npcs,
    questsData: quests,
    qigongsData: qigongs.qigongs,
    buffsData: buffs.buffs,
    martialArtsData: martialArts.martial_arts,
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('配置校验器对畸形任务结构返回错误而不会崩溃', () => {
  const quests = loadJson('quests.json');
  quests.quest_templates = [
    null,
    {
      ...quests.quest_templates[0],
      objectives: [null],
      rewards: [null],
    },
  ];
  const result = validateGameConfig({
    config: loadJson('config.json'),
    careersData: loadJson('careers.json').careers,
    monstersData: loadJson('monsters.json').monsters,
    equipmentsData: loadJson('equipments.json').equipments,
    stonesData: loadJson('stones.json'),
    subZonesData: loadJson('sub_zones.json').sub_zones,
    subZoneDropsData: loadJson('drops.json').sub_zone_drops,
    monsterDropBoxData: loadJson('boxes.json').monster_drop_box,
    boxesData: loadJson('boxes.json').boxes,
    npcsData: loadJson('npcs.json').npcs,
    questsData: quests,
    qigongsData: loadJson('qigong.json').qigongs,
    buffsData: loadJson('buffs.json').buffs,
    martialArtsData: loadJson('martial_arts.json').martial_arts,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('invalid objective')));
  assert.ok(result.errors.some(error => error.includes('invalid reward')));
});

test('配置校验器拒绝歧义物品、重复地图掉落表、溢出任务和无效效果引用', () => {
  const config = loadJson('config.json');
  const boxes = loadJson('boxes.json');
  const drops = loadJson('drops.json');
  const careers = loadJson('careers.json');
  const equipments = loadJson('equipments.json');
  const monsters = loadJson('monsters.json');
  const stones = loadJson('stones.json');
  const qigongs = loadJson('qigong.json');
  const buffs = loadJson('buffs.json');
  const martialArts = loadJson('martial_arts.json');
  const quests = loadJson('quests.json');
  config.battle_flow.battle_model.monster_spawn.spawn_interval_seconds = Number.EPSILON;
  config.battle_flow.battle_model.monster_attack.atk_interval_ms = Number.EPSILON;
  boxes.boxes[0].key = equipments.equipments[0].key;
  equipments.equipments[0].extra_affixes = { unsupported: 1 };
  monsters.monsters[0].exp = 1.5;
  monsters.monsters[0].armorBreak = 2;
  stones.cold_jade_stones[0].category = 'vajra';
  stones.cold_jade_stones[0].attribute.pool[0].weight = Number.MAX_VALUE;
  stones.cold_jade_stones[0].attribute.pool[1].weight = Number.MAX_VALUE;
  qigongs.qigongs[0].max_level = Number.MAX_SAFE_INTEGER;
  qigongs.qigongs[0].effect.value_per_level = Number.MAX_VALUE;
  drops.sub_zone_drops.push({
    ...drops.sub_zone_drops[0],
    key: 'duplicate_zone_drop_test',
  });
  buffs.buffs[0].stackable = true;
  buffs.buffs[0].attribute_mods.unknownHook = 1;
  martialArts.martial_arts[0].learning_cost.training = 1.5;
  martialArts.martial_arts[1].coolDown = 0;
  const buffArt = martialArts.martial_arts.find(art => art.type === 'buff');
  delete buffArt.effect.buff_key;
  const repeatedObjective = quests.quest_templates[0].objectives[0].items[0];
  quests.quest_templates[0].objectives[0].items = [
    { ...repeatedObjective, count: Number.MAX_SAFE_INTEGER },
    { ...repeatedObjective, count: 1 },
  ];
  careers.careers.find(career => career.key === 'warrior_blade_transfer_1st').requirement.career = 'warrior_sword';
  quests.quest_templates[0].rewards[0].careers[0] = 'warrior_blade_transfer_2st_Z';
  quests.quest_templates.find(quest => quest.key === 'quest_transfer_2_positive')
    .rewards.find(reward => reward.type === 'set_faction').faction = 'negative';

  const result = validateGameConfig({
    config,
    careersData: careers.careers,
    monstersData: monsters.monsters,
    equipmentsData: equipments.equipments,
    stonesData: stones,
    subZonesData: loadJson('sub_zones.json').sub_zones,
    subZoneDropsData: drops.sub_zone_drops,
    monsterDropBoxData: boxes.monster_drop_box,
    boxesData: boxes.boxes,
    npcsData: loadJson('npcs.json').npcs,
    questsData: quests,
    qigongsData: qigongs.qigongs,
    buffsData: buffs.buffs,
    martialArtsData: martialArts.martial_arts,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('belongs to both equipment and box')));
  assert.ok(result.errors.some(error => error.includes('invalid spawn_interval_seconds')));
  assert.ok(result.errors.some(error => error.includes('invalid monster_attack.atk_interval_ms')));
  assert.ok(result.errors.some(error => error.includes('unknown extra_affixes.unsupported')));
  assert.ok(result.errors.some(error => error.includes('invalid exp')));
  assert.ok(result.errors.some(error => error.includes('invalid armorBreak')));
  assert.ok(result.errors.some(error => error.includes('key does not match category')));
  assert.ok(result.errors.some(error => error.includes('attribute.pool weight total overflow')));
  assert.ok(result.errors.some(error => error.includes('effect total overflow')));
  assert.ok(result.errors.some(error => error.includes('duplicate sub_zone_key')));
  assert.ok(result.errors.some(error => error.includes('unknown attribute_mods.unknownHook')));
  assert.ok(result.errors.some(error => error.includes('invalid max_stacks')));
  assert.ok(result.errors.some(error => error.includes('invalid learning cost')));
  assert.ok(result.errors.some(error => error.includes('invalid coolDown')));
  assert.ok(result.errors.some(error => error.includes('buff_key (missing)')));
  assert.ok(result.errors.some(error => error.includes('objective total overflow')));
  assert.ok(result.errors.some(error => error.includes('duplicate objective item')));
  assert.ok(result.errors.some(error => error.includes('prerequisite must use the same career_family')));
  assert.ok(result.errors.some(error => error.includes('must be stage t1')));
  assert.ok(result.errors.some(error => error.includes('transfer 2 must set its selected faction')));
});
