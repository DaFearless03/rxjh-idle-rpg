import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventBus, eventBus } from '../core/EventBus.js?v=release-20260830-1';
import { GameLoop } from '../core/GameLoop.js?v=release-20260830-1';
import { SaveManager } from '../core/SaveManager.js?v=release-20260830-1';
import { validateGameConfig } from '../core/ConfigValidator.js?v=release-20260830-1';
import { Monster } from '../entities/Monster.js?v=release-20260830-1';
import { runCharacterCreationFlow } from '../flows/character_creation_flow.js?v=release-20260830-1';
import { exportSave } from '../flows/save_transfer.js?v=release-20260830-1';
import { AttributeSystem } from '../systems/AttributeSystem.js?v=release-20260830-1';
import { AutoPlaySystem } from '../systems/AutoPlaySystem.js?v=release-20260830-1';
import { BattleSystem } from '../systems/BattleSystem.js?v=release-20260830-1';
import { BoxSystem } from '../systems/BoxSystem.js?v=release-20260830-1';
import { BuffSystem } from '../systems/BuffSystem.js?v=release-20260830-1';
import { DropSystem } from '../systems/DropSystem.js?v=release-20260830-1';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260830-1';
import { InventorySystem } from '../systems/InventorySystem.js?v=release-20260830-1';
import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260830-1';
import { ShopSystem } from '../systems/ShopSystem.js?v=release-20260830-1';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260830-1';
import { WarehouseSystem } from '../systems/WarehouseSystem.js?v=release-20260830-1';
import { base64Decode } from '../utils/crypto.js?v=release-20260830-1';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const MODULE_VERSION = 'release-20260830-1';

class MemoryStorage {
  constructor() {
    Object.defineProperty(this, '_failKey', { value: null, writable: true, enumerable: false });
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
    delete this[key];
  }

  clear() {
    for (const key of Object.keys(this)) delete this[key];
  }

  failOnce(key) {
    this._failKey = key;
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
  assert.match(bottomBarSource, /import \{ AutoPlaySystem \} from ['"]\.\.\/systems\/AutoPlaySystem\.js\?v=release-20260830-1['"]/);
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
  assert.equal(sold.success, true);
  assert.equal(InventorySystem.count(player, 'sell_test'), 0);
  assert.equal(player.statistics.total_gold_earned, 5);
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

test('群体武功一次扣蓝并命中配置数量的目标', async () => {
  const skill = {
    key: 'aoe_test', name: '横扫测试', type: 'damage', target: 'aoe',
    cost: { mp: 5 }, effect: { value: 20, target_count: 2 },
  };
  const player = makeBattlePlayer({
    mp: 50,
    learned_martial_arts: [skill.key],
    auto_play: { is_auto_play: true, auto_attack: { attack_type: 'skill', selected_skill_key: skill.key } },
  });
  const battle = createBattle({ player, martialArtsData: [skill] });
  battle.monsters = [1, 2, 3].map(index => {
    const monster = new Monster({ key: `target_${index}`, name: `目标${index}`, hp: 100, atk: 0, def: 0, hit: 0, missing: 0, critR: 0, exp: 0 });
    monster.preheatRemaining = 0;
    return monster;
  });
  try {
    await withRandom([0.5], () => battle._playerAttack());
    assert.equal(player.mp, 45);
    assert.deepEqual(battle.monsters.map(monster => monster.hp), [65, 65, 100]);
  } finally {
    battle.destroy();
  }
});

test('武功攻击力使用已强化武器的攻击上限', () => {
  const config = loadJson('config.json');
  const attrSystem = new AttributeSystem({ attributeConstants: config.attribute_constants });
  const player = makeBattlePlayer({
    str: 8, dex: 9, sta: 15, int: 8,
    baseHp: 100, baseMp: 100, hpGrowth: 60, mpGrowth: 20, _hooks: {},
    _equipTemplates: [{ key: 'blade_test', slot: 'weapon', base_stats: { atkMin: 8, atkMax: 12 } }],
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
});

test('医师治疗与增益使用真实武功配置、消耗内功并进入冷却', () => {
  const martialArts = loadJson('martial_arts.json').martial_arts;
  const buffs = loadJson('buffs.json').buffs;
  AutoPlaySystem.setMartialArtsData(martialArts);
  BuffSystem.setTemplates(buffs);
  const player = makeBattlePlayer({
    career: 'healer', career_family: 'staff', hp: 10, maxHp: 200, mp: 100, maxMp: 100,
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

test('热血石绑定具体气功并提升有效等级', () => {
  const qigongs = loadJson('qigong.json').qigongs;
  QigongSystem.setTemplates(qigongs);
  const player = makeBattlePlayer({
    career_family: 'blade',
    qigong: { available_points: 0, invested: { blade_qigong_hit: 1 } },
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

test('新角色以派生生命和内功上限满状态创建', () => {
  const careers = loadJson('careers.json').careers;
  const constants = loadJson('config.json').attribute_constants;
  const flow = runCharacterCreationFlow({
    careersData: careers,
    attributeConstants: constants,
    globalSave: { character_slots: { unlocked_count: 3, last_used_slot: null } },
  });
  const initialized = flow.step3_initializeSave('warrior_blade', '初始属性', 1);
  assert.equal(initialized.success, true);
  assert.equal(initialized.save.player.hp, 145);
  assert.equal(initialized.save.player.mp, 116);
});

test('合成与强化的每次结果提示不展示成功概率', async () => {
  const equipment = { key: 'cape_test', slot: 'cape', required_level: 1, base_stats: { def: 1 } };
  const enhancePlayer = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    inventory: {
      capacity: 50,
      slots: [
        { item_key: equipment.key, instance_id: 'cape_1', count: 1 },
        { item_key: 'enhance_stone_01', count: 1 },
      ],
      equipment_instances: {
        cape_1: { instance_id: 'cape_1', item_key: equipment.key, enhance_level: 0, synthesis_slots: [] },
      },
    },
  });
  const enhanced = await withRandom([0], () => EnhanceSystem.enhance(enhancePlayer, 'cape_1'));
  assert.equal(enhanced.success, true);
  assert.doesNotMatch(enhanced.message, /成功率|概率|%/);

  QigongSystem.setTemplates(loadJson('qigong.json').qigongs);
  const synthesisPlayer = makeBattlePlayer({
    resources: { gold: 10000, training: 0, merit: 0 },
    _equipTemplates: [equipment],
    qigong: { available_points: 0, invested: { blade_qigong_hit: 1 } },
    inventory: {
      capacity: 50,
      slots: [
        { item_key: equipment.key, instance_id: 'cape_2', count: 1 },
        { item_key: 'hot_blood_01--skill_level_up--1', count: 1 },
      ],
      equipment_instances: {
        cape_2: { instance_id: 'cape_2', item_key: equipment.key, enhance_level: 0, synthesis_slots: [] },
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

    const loop = new GameLoop({ tickIntervalMs: 5 });
    let healthyTicks = 0;
    loop.addTickListener(() => { throw new Error('expected'); });
    loop.addTickListener((_tick, deltaMs) => {
      assert.ok(deltaMs >= 0);
      healthyTicks += 1;
    });
    loop.start();
    await new Promise(resolve => setTimeout(resolve, 35));
    loop.stop();
    assert.ok(healthyTicks >= 3);
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
