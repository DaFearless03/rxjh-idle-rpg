/**
 * @file main.js
 * @desc Phase 4 启动序列：存档 + 离线模拟 + 角色管理 + 自动挂机
 * @ref 13_save.startup_sequence / character_creation_flow / OfflineSimulator
 */
import { Game } from './core/Game.js';
import { GameLoop } from './core/GameLoop.js';
import { eventBus } from './core/EventBus.js';
import { AttributeSystem } from './systems/AttributeSystem.js';
import { BattleSystem } from './systems/BattleSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { WarehouseSystem } from './systems/WarehouseSystem.js';
import { EnhanceSystem } from './systems/EnhanceSystem.js';
import { SynthesisSystem } from './systems/SynthesisSystem.js';
import { DropSystem } from './systems/DropSystem.js';
import { NPCSystem, UIState } from './systems/NPCSystem.js';
import { ShopSystem } from './systems/ShopSystem.js';
import { TaskSystem } from './systems/TaskSystem.js';
import { QigongSystem } from './systems/QigongSystem.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { Player } from './entities/Player.js';
import { createEquipmentInstance } from './entities/EquipmentInstance.js';
import { SaveManager } from './core/SaveManager.js';
import { runStartupSequence, loadAllCharacters } from './core/StartupSequence.js';
import { runCharacterCreationFlow, getBaseCareers } from './flows/character_creation_flow.js';
import { getDeletionConfirmInfo, executeDeletion, hasAnyCharacter } from './flows/character_deletion_flow.js';
import { exportSave as doExportSave, importSave } from './flows/save_transfer.js';
import { AutoPlaySystem } from './systems/AutoPlaySystem.js';
import { TeleportSystem } from './systems/TeleportSystem.js';
import { OfflineSimulator } from './systems/OfflineSimulator.js';
import { storage } from './utils/storage.js';
import { restoreRuntimePlayerFromSave } from './utils/player_restore.js';
import { UIManager } from './ui/UIManager.js';
import { buildMainScreenUI } from './ui/MainScreenUI.js';
import { buildMapList, switchToZoneView, switchToTownView } from './ui/MapListPanelUI.js';
import { showNPCDialog } from './ui/NPCDialogUI.js';
import { showMultiSaveUI, showCharacterCreationUI, showOfflineRewardUI } from './ui/MultiSaveUI.js';
import './ui/BottomBarUI.js';

// ========================
// 数据加载
// ========================
const [configRes, careersRes, monstersRes, equipmentsRes, stonesRes, subZonesRes,
       npcsRes, questsRes, qigongsRes, buffsRes, martialArtsRes,
       globalSaveInitRes] = await Promise.all([
  fetch('./data/config.json'),
  fetch('./data/careers.json'),
  fetch('./data/monsters.json'),
  fetch('./data/equipments.json'),
  fetch('./data/stones.json'),
  fetch('./data/sub_zones.json'),
  fetch('./data/npcs.json'),
  fetch('./data/quests.json'),
  fetch('./data/qigong.json'),
  fetch('./data/buffs.json'),
  fetch('./data/martial_arts.json'),
  fetch('./data/global_save_init.json')
]);
const config = await configRes.json();
const careersData = (await careersRes.json()).careers;
const monstersData = (await monstersRes.json()).monsters;
const equipmentsData = (await equipmentsRes.json()).equipments;
const stonesData = await stonesRes.json();
const subZonesPayload = await subZonesRes.json();
const subZonesData = subZonesPayload.sub_zones;
const subZoneDropsData = subZonesPayload.sub_zone_drops || [];
const monsterDropBoxData = subZonesPayload.monster_drop_box || null;
const npcsData = (await npcsRes.json()).npcs;
const questsData = await questsRes.json();
const qigongsData = (await qigongsRes.json()).qigongs;
const buffsData = (await buffsRes.json()).buffs;
const martialArtsData = (await martialArtsRes.json()).martial_arts;
const globalSaveInit = await globalSaveInitRes.json();

const stoneKeys = Object.values(stonesData)
  .flatMap(group => Array.isArray(group) ? group : [])
  .map(stone => stone.key);
const potionKeys = npcsData
  .filter(npc => npc.shop_type === 'potion')
  .flatMap(npc => npc.items || [])
  .map(item => item.item_key);
const boxKeys = [...new Set(Object.values(monsterDropBoxData?.box_type_by_map || {}))];

// 初始化系统模板
TaskSystem.setTemplates(questsData.quest_templates);
BuffSystem.setTemplates(buffsData);
QigongSystem.setTemplates(qigongsData);
InventorySystem.setItemClassMap({
  equipmentKeys: equipmentsData.map(item => item.key),
  stoneKeys,
  consumableKeys: potionKeys,
  boxKeys,
  questItemKeys: Object.keys(questsData.quest_items || {}),
});
AutoPlaySystem.setPotionShopItems(
  npcsData.find(npc => npc.shop_type === 'potion')?.items || []
);

// 暴露全局配置供 UI/GMM 使用
window.expToNext = config.exp_to_next_level;
window.currentLevelCap = config.current_level_cap;

// ========================
// 全局状态
// ========================
let attrSys = null;
let dropSys = null;
let game = null;
let loop = null;
let currentSlotIndex = null;
let currentGlobalSave = null;
let creationFlow = null;
let runtimeEventUnsubscribers = [];
let lastLifecycleSaveAt = 0;
let lifecycleSaveInFlight = null;
let mainScreenUIBuilt = false;
let mainScreenEventListenersBound = false;

// 暴露全局接口供 gm.js 使用
window.Game = { get currentPlayer() { return game?.player ?? null; } };
window.GameConfig = config;
window._careersData = careersData;
window._attrSys = attrSys;
window._qigongSys = QigongSystem;
window.SaveManager = SaveManager;

function onRuntimeEvent(event, handler) {
  eventBus.on(event, handler);
  runtimeEventUnsubscribers.push(() => eventBus.off(event, handler));
}

function clearRuntimeEventHandlers() {
  for (const unsubscribe of runtimeEventUnsubscribers.splice(0)) {
    try {
      unsubscribe();
    } catch (err) {
      console.warn('[运行时] 清理事件监听失败:', err);
    }
  }
}

function saveCurrentPlayerNow(reason = 'manual', { force = false } = {}) {
  if (!game?.player || !currentSlotIndex) return Promise.resolve(false);

  const now = Date.now();
  if (!force && now - lastLifecycleSaveAt < 2000) {
    return lifecycleSaveInFlight || Promise.resolve(false);
  }

  lastLifecycleSaveAt = now;
  const playerToSave = game.player;
  const slotToSave = currentSlotIndex;
  const promise = SaveManager.savePlayerState(playerToSave, slotToSave)
    .then(() => true)
    .catch((err) => {
      console.warn(`[存档] ${reason} 触发保存失败:`, err);
      return false;
    })
    .finally(() => {
      if (lifecycleSaveInFlight === promise) {
        lifecycleSaveInFlight = null;
      }
    });

  lifecycleSaveInFlight = promise;
  return promise;
}

function setupPageLifecycleAutoSave() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveCurrentPlayerNow('visibility_hidden', { force: true });
    }
  });

  window.addEventListener('blur', () => {
    saveCurrentPlayerNow('window_blur');
  });

  window.addEventListener('pagehide', () => {
    saveCurrentPlayerNow('pagehide', { force: true });
  });

  window.addEventListener('beforeunload', () => {
    saveCurrentPlayerNow('beforeunload', { force: true });
  });
}

async function cleanupCurrentRuntime({ save = true } = {}) {
  const playerToSave = game?.player || null;
  const slotToSave = currentSlotIndex;

  if (loop) {
    loop.stop();
    loop = null;
  }
  game?.battle?.destroy?.();
  clearRuntimeEventHandlers();
  AutoPlaySystem.resetRuntimeState();
  NPCSystem.closeDialog();
  window._currentNpc = null;

  if (save && playerToSave && slotToSave) {
    await SaveManager.savePlayerState(playerToSave, slotToSave);
  }

  game = null;
  attrSys = null;
  dropSys = null;
  currentSlotIndex = null;
  window._attrSys = attrSys;
}

setupPageLifecycleAutoSave();

// ========================
// 启动序列
// ========================
runStartupSequence({
  onFirstLaunch: async () => {
    const gs = { ...globalSaveInit };
    await SaveManager.saveGlobalState(gs);
    currentGlobalSave = gs;
    window._currentGlobalSave = gs;
    window._careersData = careersData;
    buildMainScreen();
    showCharacterCreationUI(gs, null);
  },

  onNoCharacter: async () => {
    currentGlobalSave = SaveManager.restoreGlobalState() || { ...globalSaveInit };
    window._currentGlobalSave = currentGlobalSave;
    window._careersData = careersData;
    buildMainScreen();
    showCharacterCreationUI(currentGlobalSave, null);
  },

  onShowMultiSaveList: async ({ globalSave, characters }) => {
    currentGlobalSave = globalSave;
    window._currentGlobalSave = globalSave;
    window._careersData = careersData;
    buildMainScreen();

    // 自动恢复上次角色
    const lastSlot = globalSave.character_slots?.last_used_slot;
    if (lastSlot && characters.find(c => c.slotIndex === lastSlot)) {
      await enterCharacter(lastSlot);
    } else if (characters.length > 0) {
      await enterCharacter(characters[0].slotIndex);
    } else {
      showMultiSaveUI(globalSave, characters, careersData);
    }
  }
});

function buildMainScreen() {
  const root = document.getElementById('ui-root');
  if (!mainScreenUIBuilt) {
    buildMainScreenUI(root);
    mainScreenUIBuilt = true;
  }
  window.UIManager = UIManager;
  window._uiManager = UIManager;

  bindMainScreenEventListenersOnce();

  // 城镇 NPC
  const npcContainer = document.getElementById('npc-list-container');
  if (npcContainer) refreshTownNPCs();

  // 地图列表
  const mapContainer = document.getElementById('map-list-container');
  if (mapContainer) buildMapList(mapContainer, game?.player?.location?.current_sub_zone_key);

  // 刷新 top bar
  UIManager._refreshTopBar();
  UIManager._refreshHomePage();
}

function bindMainScreenEventListenersOnce() {
  if (mainScreenEventListenersBound) return;
  mainScreenEventListenersBound = true;

  // 这些监听跟页面骨架生命周期一致，避免切角色/重进流程时重复订阅。
  eventBus.on('player.level_up', () => UIManager._refreshTopBar());
  eventBus.on('player.death', () => UIManager._refreshTopBar());

  eventBus.on('battle.player_hit', (d) => UIManager._addCombatLog('player_normal_attack_hit', d));
  eventBus.on('battle.player_miss', (d) => UIManager._addCombatLog('player_normal_attack_miss', d));
  eventBus.on('battle.monster_hit', (d) => UIManager._addCombatLog('monster_attack_hit', d));
  eventBus.on('battle.monster_miss', (d) => UIManager._addCombatLog('monster_attack_miss', d));
  eventBus.on('battle.crit', (d) => UIManager._addCombatLog('player_normal_attack_hit', { ...d, crit_suffix: ' (暴击!)' }));
  eventBus.on('battle.leech', (d) => UIManager._addCombatLog('leech_triggered', d));
  eventBus.on('battle.counter', (d) => UIManager._addCombatLog('counter_triggered', d));
  eventBus.on('battle.armor_break', (d) => UIManager._addCombatLog('armor_break_triggered', d));
  eventBus.on('monster.death', (d) => {
    UIManager._addCombatLog('monster_died', { monster_name: d.monsterKey });
    UIManager.addRewardLog('monster_kill_reward', { monster_name: d.monsterKey, exp: d.exp || 0, gold: d.gold || 0 });
  });
  eventBus.on('player.death', () => UIManager._addCombatLog('player_died', {}));
  eventBus.on('player.level_up', (d) => UIManager.addRewardLog('level_up', { from_level: d.from_level, to_level: d.to_level }));

  eventBus.on('teleport.done', ({ to }) => {
    if (to == null) {
      UIManager.openPanel('home');
    } else {
      UIManager.openPanel('combat');
    }
    UIManager._refreshAll();
  });

  eventBus.on('npc.opened', (npcData) => {
    window._currentNpc = npcData;
    window._questTemplates = questsData.quest_templates;
    window._careersData = careersData;
    window._equipTemplates = equipmentsData;
    showNPCDialog(npcData, game?.player, careersData, questsData.quest_templates);
  });
}

function refreshMapList(currentSubZoneKey) {
  const mapContainer = document.getElementById('map-list-container');
  if (mapContainer) buildMapList(mapContainer, currentSubZoneKey);
}

function refreshTownNPCs() {
  const npcContainer = document.getElementById('npc-list-container');
  if (!npcContainer || !npcsData) return;
  npcContainer.innerHTML = npcsData.map(npc => `
    <div class="npc-item" onclick="window._openNPC('${npc.key}')">
      <div class="npc-icon">🏪</div>
      <div class="npc-name">${npc.name || npc.key}</div>
    </div>
  `).join('');

  window._openNPC = (npcKey) => {
    const npc = npcsData.find(n => n.key === npcKey);
    if (!npc) return;
    eventBus.emit('npc.opened', npc);
  };
}

function getNPCTypeLabel(type) {
  const labels = { quest:'任务', shop:'商店', enhance:'强化', warehouse:'仓库', synthesis:'合成', shop_and_enhance:'商店+强化' };
  return labels[type] || type;
}

// ========================
// 角色创建流程
// ========================
async function runCreateCharacterFlow(targetSlotIndex) {
  creationFlow = runCharacterCreationFlow({
    careersData,
    globalSave: currentGlobalSave,
    onComplete: async (player, slotIndex) => {
      await initGameForPlayer(player, slotIndex);
    }
  });
  console.log('[创建] 可用职业:', getBaseCareers());
  console.log('调用 game.createCharacter("warrior_blade", "角色名", slotIndex?) 开始创建');
}

// ========================
// 进入角色（加载存档 + 初始化游戏）
// ========================
async function enterCharacter(slotIndex) {
  if (game || loop || runtimeEventUnsubscribers.length > 0) {
    await cleanupCurrentRuntime({ save: true });
  }

  const save = await SaveManager.restorePlayerFromSave(slotIndex);
  if (!save) {
    console.log(`[错误] 槽位 ${slotIndex} 无有效存档`);
    return;
  }

  currentSlotIndex = slotIndex;
  save.offline = save.offline || {};
  const lastSaveTimestamp = save.offline.last_save_timestamp || Date.now();

  // AttributeSystem
  attrSys = new AttributeSystem({ attributeConstants: config.attribute_constants });
  attrSys._buffSys = BuffSystem;
  attrSys._qigongSys = QigongSystem;
  window._attrSys = attrSys;

  // DropSystem
  dropSys = new DropSystem({
    config: { ...config, monster_drop_box: monsterDropBoxData },
    equipmentsData,
    stonesData,
    taskSystemRef: TaskSystem,
    questItems: questsData.quest_items
  });

  // 恢复玩家对象
  const player = restorePlayerFromSave(save);

  // 检查离线收益
  const elapsed = Date.now() - lastSaveTimestamp;
  const simSeconds = elapsed / 1000;
  const wasAutoPlaying = save.auto_play?.is_auto_play && save.location?.current_sub_zone_key;
  const offlineHours = simSeconds / 3600;

  // 离线模拟（若上次在挂机且离线超过1分钟）
  if (wasAutoPlaying && offlineHours > (1 / 60)) {
    console.log(`[离线] 检测到 ${offlineHours.toFixed(1)} 小时离线收益，开始结算...`);
    const summary = await OfflineSimulator.settle_offline_rewards({
      ...save,
      _slotIndex: slotIndex,
      _attrSys: attrSys,
      _dropSys: dropSys,
      _config: config,
      _monstersData: monstersData,
      _subZonesData: subZonesData,
      _subZoneDropsData: subZoneDropsData,
      _buffSys: BuffSystem,
      _careersData: careersData,
      _equipmentsData: equipmentsData,
      _expToNextLevel: config.exp_to_next_level,
      _attributeConstants: config.attribute_constants,
    }, {
      onProgress: (p) => {
        if (p % 20 === 0) console.log(`[离线结算] ${p}%`);
      },
      onSummary: (summary) => {
        showOfflineRewardUI(summary);
      }
    });
    if (summary) {
      Object.assign(player, summary._player || {});
    }
  }

  await initGameForPlayer(player, slotIndex);
}

/**
 * restore_player_from_save 契约（5步，不可调换）
 */
function restorePlayerFromSave(save) {
  return restoreRuntimePlayerFromSave(save, {
    careersData,
    equipmentsData,
    attrSystem: attrSys,
  });
}

/**
 * 初始化 Game + BattleSystem + GameLoop
 */
async function initGameForPlayer(player, slotIndex) {
  game = new Game();
  game.config = config;
  game.player = player;
  game.careersData = careersData;
  game.monstersData = monstersData;
  game.equipmentsData = equipmentsData;
  game.stonesData = stonesData;
  game.subZonesData = subZonesData;
  game.subZoneDropsData = subZoneDropsData;
  game.npcsData = npcsData;
  game.events = eventBus;
  currentSlotIndex = slotIndex;

  const currentSubZone = subZonesData.find(sz => sz.key === player.location?.current_sub_zone_key) || null;
  game.battle = new BattleSystem({
    config,
    player,
    monstersData,
    attrSystemRef: attrSys,
    dropSystemRef: dropSys,
    subZonesData,
    subZoneDropsData,
    currentSubZone,
    buffSystemRef: BuffSystem
  });

  loop = new GameLoop({ tickIntervalMs: 100 });
  game.loop = loop;
  AutoPlaySystem.syncFromPlayer(player);

  // 自动存档：每秒检查一次
  let _saveTimer = 0;
  loop.addTickListener((tickCount) => {
    const delta = 100;
    game.battle.tick(delta);
    AutoPlaySystem.tick(player, delta, (source, zone) => TeleportSystem.teleport(zone, source, player, game));

    _saveTimer += delta;
    if (_saveTimer >= 60000) {
      _saveTimer = 0;
      saveCurrentPlayerNow('auto_interval', { force: true });
    }
  });

  // 更新全局存档 last_used_slot
  if (currentGlobalSave) {
    currentGlobalSave.character_slots.last_used_slot = slotIndex;
    SaveManager.saveGlobalState(currentGlobalSave);
  }

  // 事件监听
  onRuntimeEvent('player.level_up', (data) => {
    console.log(`[事件] player.level_up: Lv${data.from_level}→Lv${data.to_level} 气功点+${data.gained_points}`);
    saveCurrentPlayerNow('player_level_up', { force: true });
  });
  onRuntimeEvent('player.death', () => {
    console.log('[系统] 玩家死亡惩罚已结算，等待复活...');
    AutoPlaySystem.syncFromPlayer(player);
    saveCurrentPlayerNow('player_death', { force: true });
  });
  onRuntimeEvent('monster.death', (data) => {
    console.log(`[事件] monster.death: ${data.monsterKey} exp+${data.exp}`);
  });
  onRuntimeEvent('quest.accepted', (data) => console.log(`[事件] quest.accepted: ${data.name}`));
  onRuntimeEvent('quest.completed', (data) => console.log(`[事件] quest.completed: ${data.questKey}`));
  onRuntimeEvent('quest.stage_advance', (data) => console.log(`[事件] quest.stage_advance: ${data.questKey} 进入第 ${data.stage} 阶段`));
  onRuntimeEvent('player.career_transfer', (data) => console.log(`[事件] player.career_transfer: ${data.from_career}→${data.to_career}`));
  onRuntimeEvent('buff.applied', (data) => {
    attrSys.recompute(player);
    console.log(`[事件] buff.applied: ${data.name}`);
  });
  onRuntimeEvent('buff.expired', (data) => {
    attrSys.recompute(player);
    console.log(`[事件] buff.expired: ${data.buffKey}`);
  });
  onRuntimeEvent('autoplay.start', () => console.log('[系统] 开始挂机'));
  onRuntimeEvent('autoplay.stop', (d) => console.log(`[系统] 停止挂机: ${d.reason}`));

  loop.start();
  console.log(`=== 进入游戏: ${player.name} (${player.career}) Lv${player.level} ===`);
  showGameCommands();
  UIManager._refreshAll();
}

function showOfflineSummary(summary) {
  console.log('========== 离线收益总结 ==========');
  const h = (summary.elapsed_s / 3600).toFixed(1);
  console.log(`离线时长: ${h} 小时`);
  if (summary.stopped_reason) {
    console.log(`停止原因: ${summary.stopped_reason}`);
  }
  console.log(`击杀: ${summary.kills} 只`);
  console.log(`经验: +${summary.exp_gained}`);
  console.log(`金币: +${summary.gold_gained}`);
  if (summary.level_ups.length > 0) {
    const first = summary.level_ups[0];
    const last = summary.level_ups[summary.level_ups.length - 1];
    const totalPoints = summary.level_ups.reduce((s, l) => s + (l.gained_points || 1), 0);
    console.log(`升级: ${summary.level_ups.length} 次 Lv${first.from_level}→Lv${last.to_level}（+${totalPoints}气功点）`);
  }
  console.log('=================================');
}

function showGameCommands() {
  console.log('可用命令: game.listCharacters(), game.switchCharacter(slot), game.createCharacter(career, name), game.deleteCharacter(slot)');
  console.log('挂机: game.startAutoPlay(), game.stopAutoPlay(), game.setAutoConsumeHP(item, threshold), game.setAutoConsumeMP(item, threshold)');
  console.log('传送: game.teleport(subZoneKey), game.town()');
  console.log('存档: game.exportSave({include_all_characters:true/false}), game.importSave(base64)');
  console.log('状态: game.showStatus(), game.showPlayer()');
}

// ========================
// console 命令接口
// ========================
window.game = {
  get player() {
    return game?.player ?? null;
  },

  // ---------- 角色管理 ----------
  listCharacters() {
    const characters = [];
    const unlocked = currentGlobalSave?.character_slots?.unlocked_count ?? 3;
    for (let i = 1; i <= unlocked; i++) {
      const raw = storage.get(`player-${i}`);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          characters.push({ slotIndex: i, ...(p.data || p) });
        } catch {}
      }
    }
    console.log('=== 角色列表 ===');
    if (characters.length === 0) console.log('  （无）');
    for (const c of characters) {
      const loc = c.location?.current_sub_zone_key || '城镇';
      console.log(`  [${c.slotIndex}] ${c.player?.name}(${c.player?.career}) Lv${c.player?.level} | ${loc}`);
    }
    return characters;
  },

  async createCharacter(careerKey, name, targetSlotIndex) {
    const flow = runCharacterCreationFlow({ careersData, globalSave: currentGlobalSave });
    const r1 = flow.step1_selectCareer(careerKey);
    if (!r1.success) return console.log('[错误]', r1.message);
    const r2 = flow.step2_inputName(name);
    if (!r2.success) return console.log('[错误]', r2.message);
    const r3 = flow.step3_initializeSave(careerKey, name, targetSlotIndex);
    if (!r3.success) return console.log('[错误]', r3.message);
    const r4 = await flow.step4_persist(r3.save, r3.slotIndex, currentGlobalSave);
    if (!r4.success) return console.log('[错误]', r4.message);
    window._currentGlobalSave = currentGlobalSave;
    console.log(`[创建] 角色「${name}」创建成功，槽位 ${r4.slotIndex}`);
    await enterCharacter(r4.slotIndex);
  },

  async switchCharacter(slotIndex) {
    await enterCharacter(slotIndex);
  },

  deleteCharacter(slotIndex) {
    const raw = storage.get(`player-${slotIndex}`);
    if (!raw) return console.log(`[错误] 槽位 ${slotIndex} 无存档`);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return console.log('[错误] 存档损坏'); }
    const info = getDeletionConfirmInfo(slotIndex, parsed.data || parsed);
    console.log(info.confirmBody);
    console.log('确认删除？调用 game.confirmDeleteCharacter(' + slotIndex + ')');
    window._pendingDeleteSlot = slotIndex;
    window._pendingDeleteData = parsed.data || parsed;
  },

  async confirmDeleteCharacter(slotIndex, opts = {}) {
    const deletingCurrentCharacter = slotIndex === currentSlotIndex;
    if (deletingCurrentCharacter) {
      await cleanupCurrentRuntime({ save: false });
    }

    const r = await executeDeletion(slotIndex, currentGlobalSave);
    if (!r.success) return;

    currentGlobalSave = r.globalSave;
    window._currentGlobalSave = currentGlobalSave;
    console.log(`[删除] 槽位 ${slotIndex} 已删除`);

    if (!hasAnyCharacter()) {
      console.log('[删除] 所有角色已删除，请创建新角色');
      UIManager.closeAllModals?.();
      showCharacterCreationUI(currentGlobalSave, null);
      return;
    }

    const characters = loadAllCharacters();
    if (deletingCurrentCharacter) {
      const nextSlot = characters[0]?.slotIndex;
      if (nextSlot) {
        console.log(`[删除] 已自动切换到槽位 ${nextSlot}`);
        UIManager.closeAllModals?.();
        await enterCharacter(nextSlot);
      }
      return;
    }

    this.listCharacters();
    if (opts.refreshList) {
      showMultiSaveUI(currentGlobalSave, characters, careersData);
    }
  },

  unlockSlot(slotIndex) {
    if (!game?.player) return console.log('[错误] 请先进入任意角色');
    const unlocked = currentGlobalSave?.character_slots?.unlocked_count ?? 3;
    if (slotIndex <= unlocked) return console.log('[错误] 该槽位已解锁');
    const cost = 100;
    if (game.player.resources?.gold < cost) return console.log(`[错误] 金币不足（需要 ${cost}）`);
    game.player.resources.gold -= cost;
    currentGlobalSave.character_slots.unlocked_count = slotIndex;
    SaveManager.saveGlobalState(currentGlobalSave);
    SaveManager.savePlayerState(game.player, currentSlotIndex);
    console.log(`[解锁] 第 ${slotIndex} 槽位已解锁，剩余金币 ${game.player.resources.gold}`);
  },

  // ---------- 挂机 ----------
  startAutoPlay() {
    if (!currentSlotIndex) return console.log('[错误] 无当前角色（请先创建或切换角色）');
    if (!game?.player) return console.log('[错误] 无当前角色');
    AutoPlaySystem.start(game.player);
    console.log('[挂机] 已开始');
  },

  stopAutoPlay() {
    if (!game?.player) return;
    AutoPlaySystem.stop(game.player, 'manual');
    console.log('[挂机] 已停止');
  },

  setAutoConsumeHP(itemKey, threshold = 0.30) {
    if (!game?.player) return;
    game.player.auto_play = game.player.auto_play || {};
    game.player.auto_play.auto_consume = game.player.auto_play.auto_consume || {};
    game.player.auto_play.auto_consume.hp_potion = {
      enabled: true,
      selected_item_key: itemKey,
      threshold,
    };
    console.log(`[自动喝药] HP药剂=${itemKey} 阈值=${threshold}`);
  },

  setAutoConsumeMP(itemKey, threshold = 0.30) {
    if (!game?.player) return;
    game.player.auto_play = game.player.auto_play || {};
    game.player.auto_play.auto_consume = game.player.auto_play.auto_consume || {};
    game.player.auto_play.auto_consume.mp_potion = {
      enabled: true,
      selected_item_key: itemKey,
      threshold,
    };
    console.log(`[自动喝药] MP药剂=${itemKey} 阈值=${threshold}`);
  },

  setAutoHealSkill(skillKey) {
    if (!game?.player) return;
    game.player.auto_play = game.player.auto_play || {};
    game.player.auto_play.auto_heal_skill = { enabled: true, selected_skill_key: skillKey };
    console.log(`[自动治疗] 武功=${skillKey}`);
  },

  // ---------- 传送 ----------
  teleport(subZoneKey) {
    if (!game?.player) return;
    TeleportSystem.teleport(subZoneKey, 'player_click', game.player, game);
    console.log(`[传送] 到达 ${subZoneKey}`);
  },

  town() {
    if (!game?.player) return;
    TeleportSystem.teleport(null, 'player_click', game.player, game);
    console.log('[传送] 回城');
  },

  // ---------- 存档 ----------
  exportSave(opts = {}) {
    const pack = doExportSave(opts);
    if (pack) {
      console.log('[导出] 存档已生成（base64），长度:', pack.length);
      // 复制到剪贴板
      navigator.clipboard?.writeText(pack).then(() => {
        console.log('[导出] 已复制到剪贴板');
      }).catch(() => {
        console.log('[导出] base64字符串（手动复制）:', pack.substring(0, 50) + '...');
      });
    } else {
      console.log('[导出] 失败');
    }
    return pack;
  },

  importSave(base64Str) {
    importSave(base64Str).then(r => {
      console.log(`[导入] ${r.message}`);
      if (r.success) {
        console.log('[导入] 3秒后刷新页面...');
        setTimeout(() => location.reload(), 3000);
      }
    });
  },

  // ---------- 测试 ----------
  fastForwardOffline(hours) {
    OfflineSimulator.fastForwardOffline(hours);
  },

  saveNow() {
    if (game?.player && currentSlotIndex) {
      saveCurrentPlayerNow('manual_save', { force: true }).then((success) => {
        console.log(success ? '[存档] 已保存' : '[存档] 保存失败');
      });
    }
  },

  restart() {
    location.reload();
  },

  // ---------- 状态（Phase 1-3 兼容） ----------
  showStatus() {
    if (!game?.player) return console.log('[错误] 无当前角色');
    const p = game.player;
    const b = game.battle.getStatus ? game.battle.getStatus() : {};
    const qigongAvail = QigongSystem.getAvailablePoints(p);
    console.log(`--- 状态 ---`);
    console.log(`Lv${p.level} ${p.career} (${p.faction}) | HP ${p.hp}/${p.maxHp} | 金币 ${p.resources?.gold || 0} | 气功点 ${qigongAvail}`);
    console.log(`战斗属性: atkMin=${p.atkMin} atkMax=${p.atkMax} def=${p.def} hit=${p.hit}`);
    console.log(`场上怪物: ${b.monsterCount || 0}`);
    if (b.recentEvents?.length > 0) {
      for (const e of b.recentEvents) console.log('  ' + e);
    }
  },

  showPlayer() {
    if (!game?.player) return console.log('[错误] 无当前角色');
    const p = game.player;
    console.log(`--- 玩家 ${p.name} ---`);
    console.log(`职业: ${p.career} | 等级: ${p.level} | 转职: ${p.career_history?.length - 1}次`);
    console.log(`HP: ${p.hp}/${p.maxHp} | MP: ${p.mp}/${p.maxMp}`);
    console.log(`EXP: ${p.exp}/${config.exp_to_next_level[p.level] || 'MAX'}`);
    console.log(`金币: ${p.resources?.gold || 0} | 历练: ${p.resources?.training || 0}`);
    console.log(`位置: ${p.location?.current_sub_zone_key || '城镇'}`);
    console.log(`挂机: ${p.auto_play?.is_auto_play ? '是' : '否'}`);
    console.log(`气功点: ${p.qigong?.available_points || 0} (已投: ${Object.keys(p.qigong?.invested || {}).length})`);
    console.log(`quad 已学武功: ${p.learned_martial_arts?.length || 0} 个`);
  },

  // Phase 1-3 兼容命令
  talkToNPC: (npcKey) => {
    const npc = npcsData.find(n => n.key === npcKey);
    if (!npc) return console.log(`[错误] NPC ${npcKey} 不存在`);
    NPCSystem.openDialog(npc);
    if (npc.type === 'quest') {
      const visible = TaskSystem.listVisibleQuests(game.player, npc);
      console.log(`=== ${npc.name} 任务列表 ===`);
      if (visible.length === 0) console.log('  （无可接任务）');
      for (const q of visible) {
        console.log(`  [${q.key}] ${q.name} - ${q.description}`);
      }
    } else if (npc.type === 'shop' || npc.type === 'shop_and_enhance') {
      console.log(`=== ${npc.name} 商品列表 ===`);
      for (const item of (npc.items || [])) {
        const price = Math.floor(item.buy_price * (npc.price_multiplier || 1.0));
        console.log(`  ${item.name} - ${price} 金币`);
      }
    }
  },

  closeDialog: () => NPCSystem.closeDialog(),
  buyFromShop: (npcKey, itemKey, count = 1) => {
    const npc = npcsData.find(n => n.key === npcKey);
    if (!npc) return console.log(`[错误] NPC ${npcKey} 不存在`);
    const result = ShopSystem.buy(game.player, npc, itemKey, count);
    console.log(`[商店] ${result.message}`);
    if (result.success) attrSys.recompute(game.player);
  },
  sellToShop: (npcKey, itemKey, count = 1) => {
    const npc = npcsData.find(n => n.key === npcKey);
    if (!npc) return console.log(`[错误] NPC ${npcKey} 不存在`);
    const result = ShopSystem.sell(game.player, npc, itemKey, count);
    console.log(`[商店] ${result.message}`);
  },
  acceptQuest: (questKey) => {
    const template = questsData.quest_templates.find(q => q.key === questKey);
    if (!template) return console.log(`[错误] 任务 ${questKey} 不存在`);
    const result = TaskSystem.acceptQuest(game.player, template);
    console.log(`[任务] ${result.message}`);
  },
  submitQuest: (questKey) => {
    const instance = game.player.quests?.accepted?.find(q => q.key === questKey);
    if (!instance) return console.log(`[错误] 任务未接取`);
    const result = TaskSystem.submitQuest(game.player, instance, questsData.quest_templates, careersData);
    console.log(`[任务] ${result.message}`);
    if (result.success) attrSys.recompute(game.player);
  },
  listAcceptedQuests: () => {
    const accepted = game.player.quests?.accepted || [];
    console.log('=== 已接任务 ===');
    if (accepted.length === 0) return console.log('  （无）');
    for (const q of accepted) {
      const stageBlock = q.objectives?.find(s => s.stage === q.current_stage);
      const items = stageBlock?.items || [];
      const progress = items.map(i => {
        const have = InventorySystem.count(game.player, i.item_key);
        return `${i.item_key}(${have}/${i.count})`;
      }).join(', ');
      console.log(`  [${q.key}] ${q.name} 第${q.current_stage}阶段 | ${progress}`);
    }
  },
  listQigong: () => {
    const list = QigongSystem.listAvailableQigongs(game.player);
    const avail = QigongSystem.getAvailablePoints(game.player);
    console.log(`=== 可学气功（可用点: ${avail}）==`);
    for (const q of list) {
      console.log(`  [${q.key}] ${q.name} | 已投: ${q.invested}/${q.max_level} | ${q.description}`);
    }
  },
  investQigong: (qigongKey, points = 1) => {
    const result = QigongSystem.investQigong(game.player, qigongKey, points);
    console.log(`[气功] ${result.message}`);
    if (result.success) attrSys.recompute(game.player);
  },
  resetQigong: () => {
    const result = QigongSystem.resetQigong(game.player);
    console.log(`[气功] ${result.message}`);
    if (result.success) attrSys.recompute(game.player);
  },
  applyBuff: (buffKey) => {
    const result = BuffSystem.applyBuff(game.player, buffKey);
    console.log(`[Buff] ${result.message}`);
    if (result.success) attrSys.recompute(game.player);
  },
  listBuffs: () => {
    const buffs = BuffSystem.listBuffs(game.player);
    console.log('=== 当前 Buff ===');
    if (buffs.length === 0) return console.log('  （无）');
    for (const b of buffs) console.log(`  [${b.key}] ${b.name} | ${b.remaining} | x${b.stacks}`);
  },
  learnMartialArt: (key) => {
    if (game.player.learned_martial_arts?.includes(key)) return console.log('[武功] 已学会');
    const ma = martialArtsData.find(m => m.key === key);
    if (!ma) return console.log(`[错误] 武功 ${key} 不存在`);
    game.player.learned_martial_arts = game.player.learned_martial_arts || [];
    game.player.learned_martial_arts.push(key);
    console.log(`[武功] 学会 ${ma.name}`);
  },
  listMartialArts: () => {
    const list = game.player.learned_martial_arts || [];
    console.log('=== 已学武功 ===');
    if (list.length === 0) return console.log('  （无）');
    for (const key of list) {
      const ma = martialArtsData.find(m => m.key === key);
      if (ma) console.log(`  ${ma.name} (${ma.type})`);
    }
  },
  showInventory: () => {
    const slots = game.player.inventory?.slots || [];
    console.log('=== 背包 ===');
    console.log(`容量: ${slots.length}/${game.player.inventory?.capacity || 50}`);
    for (const s of slots) {
      if (s.count === 0) continue;
      if (s.instance_id) {
        console.log(`  [${s.item_key}] x1 (instance: ${s.instance_id})`);
      } else {
        console.log(`  ${s.item_key} x${s.count}`);
      }
    }
  },
  showEquipped: () => {
    console.log('=== 当前装备 ===');
    for (const [slot, val] of Object.entries(game.player.equipped)) {
      if (val === null) continue;
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const v = val[i];
          if (v === null) continue;
          const inst = game.player.inventory?.equipment_instances?.[v.instance_id];
          console.log(`  ${slot}[${i}]: ${inst?.item_key || '?'} (${v.instance_id})`);
        }
      } else if (val.instance_id) {
        const inst = game.player.inventory?.equipment_instances?.[val.instance_id];
        console.log(`  ${slot}: ${inst?.item_key || '?'} (${val.instance_id})`);
      }
    }
    console.log(`金币: ${game.player.resources?.gold || 0}`);
  },
  giveItem: (itemKey, count = 1) => {
    const result = InventorySystem.add(game.player, itemKey, count);
    console.log(`[给予] ${result.success ? `${itemKey} x${count}` : `${itemKey} x${result.added}（丢弃 ${result.discarded}）`}`);
  },
  setLevel: (lv) => {
    const cd = careersData.find(c => c.key === game.player.career);
    const grow = cd?.attrGrow || { str: 0, dex: 0, sta: 0, int: 0 };
    const baseLv = game.player._baseLevel || 1;
    const levelDiff = lv - baseLv;
    if (levelDiff > 0) {
      game.player.str += grow.str * levelDiff;
      game.player.dex += grow.dex * levelDiff;
      game.player.sta += grow.sta * levelDiff;
      game.player.int += grow.int * levelDiff;
    }
    game.player._baseLevel = lv;
    game.player.level = lv;
    attrSys.recompute(game.player);
    game.player.hp = game.player.maxHp;
    game.player.mp = game.player.maxMp;
    console.log(`[调试] 等级设为 ${lv}，四维: str=${game.player.str} dex=${game.player.dex} sta=${game.player.sta} int=${game.player.int}`);
    SaveManager.savePlayerState(game.player, currentSlotIndex);
  },
  addGold: (amount) => {
    game.player.resources.gold = (game.player.resources.gold || 0) + amount;
    console.log(`[金币] 当前: ${game.player.resources.gold}`);
  },
  setBattleLog: (enabled) => {
    if (game?.battle) {
      game.battle._quiet = !enabled;
      console.log(`[战斗日志] ${enabled ? '开启' : '关闭'}`);
    }
  },
};

// 保持运行
setTimeout(() => {}, 60000);
