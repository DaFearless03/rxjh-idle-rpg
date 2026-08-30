/**
 * @file main.js
 * @desc Phase 4 启动序列：存档 + 离线模拟 + 角色管理 + 自动挂机
 * @ref 13_save.startup_sequence / character_creation_flow / OfflineSimulator
 */
import { Game } from './core/Game.js?v=release-20260830-3';
import { GameLoop } from './core/GameLoop.js?v=release-20260830-3';
import { eventBus } from './core/EventBus.js?v=release-20260830-3';
import { AttributeSystem } from './systems/AttributeSystem.js?v=release-20260830-3';
import { BattleSystem } from './systems/BattleSystem.js?v=release-20260830-3';
import { InventorySystem } from './systems/InventorySystem.js?v=release-20260830-3';
import { WarehouseSystem } from './systems/WarehouseSystem.js?v=release-20260830-3';
import { EnhanceSystem } from './systems/EnhanceSystem.js?v=release-20260830-3';
import { SynthesisSystem } from './systems/SynthesisSystem.js?v=release-20260830-3';
import { DropSystem } from './systems/DropSystem.js?v=release-20260830-3';
import { BoxSystem } from './systems/BoxSystem.js?v=release-20260830-3';
import { NPCSystem } from './systems/NPCSystem.js?v=release-20260830-3';
import { ShopSystem } from './systems/ShopSystem.js?v=release-20260830-3';
import { TaskSystem } from './systems/TaskSystem.js?v=release-20260830-3';
import { QigongSystem } from './systems/QigongSystem.js?v=release-20260830-3';
import { BuffSystem } from './systems/BuffSystem.js?v=release-20260830-3';
import { Player } from './entities/Player.js?v=release-20260830-3';
import { SaveManager } from './core/SaveManager.js?v=release-20260830-3';
import { runStartupSequence, loadAllCharacters } from './core/StartupSequence.js?v=release-20260830-3';
import { assertValidGameConfig } from './core/ConfigValidator.js?v=release-20260830-3';
import { runCharacterCreationFlow } from './flows/character_creation_flow.js?v=release-20260830-3';
import { getDeletionConfirmInfo, executeDeletion } from './flows/character_deletion_flow.js?v=release-20260830-3';
import { executeSlotUnlock } from './flows/slot_unlock_flow.js?v=release-20260830-3';
import { exportSave as doExportSave, importSave as doImportSave } from './flows/save_transfer.js?v=release-20260830-3';
import { AutoPlaySystem } from './systems/AutoPlaySystem.js?v=release-20260830-3';
import { TeleportSystem } from './systems/TeleportSystem.js?v=release-20260830-3';
import { OfflineSimulator } from './systems/OfflineSimulator.js?v=release-20260830-3';
import { storage } from './utils/storage.js?v=release-20260830-3';
import { restoreRuntimePlayerFromSave, applyCareerRuntimeFields } from './utils/player_restore.js?v=release-20260830-3';
import { addCappedNonNegative } from './utils/numbers.js?v=release-20260830-3';
import { UIManager } from './ui/UIManager.js?v=release-20260830-3';
import { buildMainScreenUI } from './ui/MainScreenUI.js?v=release-20260830-3';
import { showNPCDialog } from './ui/NPCDialogUI.js?v=release-20260830-3';
import {
  hideOfflineRewardLoading,
  showMultiSaveUI,
  showCharacterCreationUI,
  showOfflineRewardLoading,
  showOfflineRewardUI,
  updateOfflineRewardProgress,
} from './ui/MultiSaveUI.js?v=release-20260830-3';
import './ui/BottomBarUI.js?v=release-20260830-3';

// ========================
// 数据加载
// ========================
const DATA_VERSION = 'release-20260830-3';
const fetchData = async (path) => {
  const response = await fetch(`${path}?v=${DATA_VERSION}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`数据加载失败：${path}（HTTP ${response.status} ${response.statusText}）`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get('content-type') || '未知类型';
    const preview = text.trim().slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(`数据解析失败：${path} 返回的不是有效 JSON（${contentType}）\n响应开头：${preview || '(空响应)'}`);
  }
};

const [config, careersPayload, monstersPayload, equipmentsPayload, stonesData, subZonesPayload,
       npcsPayload, questsData, qigongsPayload, buffsPayload, martialArtsPayload,
       dropsPayload, boxesPayload, globalSaveInit] = await Promise.all([
  fetchData('./data/config.json'),
  fetchData('./data/careers.json'),
  fetchData('./data/monsters.json'),
  fetchData('./data/equipments.json'),
  fetchData('./data/stones.json'),
  fetchData('./data/sub_zones.json'),
  fetchData('./data/npcs.json'),
  fetchData('./data/quests.json'),
  fetchData('./data/qigong.json'),
  fetchData('./data/buffs.json'),
  fetchData('./data/martial_arts.json'),
  fetchData('./data/drops.json'),
  fetchData('./data/boxes.json'),
  fetchData('./data/global_save_init.json')
]);
const careersData = careersPayload.careers;
const monstersData = monstersPayload.monsters;
const equipmentsData = equipmentsPayload.equipments;
const subZonesData = subZonesPayload.sub_zones;
const boxesData = boxesPayload.boxes || subZonesPayload.boxes || [];
const monsterDropBoxData = boxesPayload.monster_drop_box || subZonesPayload.monster_drop_box || null;
const subZoneDropsData = dropsPayload.sub_zone_drops || subZonesPayload.sub_zone_drops || [];
const npcsData = npcsPayload.npcs;
const qigongsData = qigongsPayload.qigongs;
const buffsData = buffsPayload.buffs;
const martialArtsData = martialArtsPayload.martial_arts;

const stoneKeys = Object.values(stonesData)
  .flatMap(group => Array.isArray(group) ? group : [])
  .map(stone => stone.key);
const potionKeys = npcsData
  .filter(npc => npc.shop_type === 'potion')
  .flatMap(npc => npc.items || [])
  .map(item => item.item_key);
const boxKeys = [...new Set(Object.values(monsterDropBoxData?.box_type_by_map || {}))];

assertValidGameConfig({
  config,
  careersData,
  monstersData,
  equipmentsData,
  stonesData,
  subZonesData,
  subZoneDropsData,
  monsterDropBoxData,
  boxesData,
  npcsData,
  questsData,
  qigongsData,
  buffsData,
  martialArtsData,
});

// 初始化系统模板
TaskSystem.setTemplates(questsData.quest_templates);
window._questTemplates = questsData.quest_templates;
window._careersData = careersData;
window._equipTemplates = equipmentsData;
window._subZonesData = subZonesData;
window._stonesData = stonesData;
window._attributeConstants = config.attribute_constants;
BuffSystem.setTemplates(buffsData);
QigongSystem.setTemplates(qigongsData);
BoxSystem.setTemplates({ boxes: boxesData, equipmentTemplates: equipmentsData });
InventorySystem.setItemClassMap({
  equipmentKeys: equipmentsData.map(item => item.key),
  stoneKeys,
  consumableKeys: potionKeys,
  boxKeys,
  questItemKeys: Object.keys(questsData.quest_items || {}),
});
const potionShop = npcsData.find(npc => npc.shop_type === 'potion');
AutoPlaySystem.setPotionShopItems(potionShop?.items || [], potionShop?.price_multiplier ?? 1);
AutoPlaySystem.setMartialArtsData(martialArtsData);

// 暴露全局配置供 UI/GM 使用
window.expToNext = config.exp_to_next_level;
window.currentLevelCap = config.current_level_cap;
window._itemMetaByKey = {
  ...Object.fromEntries(
    equipmentsData.map(item => [item.key, { name: item.name, icon: '⚔️' }])
  ),
  ...Object.fromEntries(
    npcsData
      .filter(npc => npc.shop_type === 'potion')
      .flatMap(npc => npc.items || [])
      .map(item => [item.item_key, { name: item.name, icon: item.item_key?.startsWith('mp_') ? '🌿' : '🍶' }])
  ),
  ...Object.fromEntries(boxesData.map(box => [box.key, { name: box.name, icon: '🎁' }])),
  ...Object.fromEntries(
    Object.entries(questsData.quest_items || {})
      .map(([key, item]) => [key, { name: item.name || key, icon: '📜' }])
  ),
  ...Object.fromEntries(
    Object.values(stonesData)
      .flatMap(group => Array.isArray(group) ? group : [])
      .map(stone => [stone.key, { name: stone.name || stone.key, icon: '💎' }])
  ),
};
window.InventorySystem = InventorySystem;

// ========================
// 全局状态
// ========================
let attrSys = null;
let dropSys = null;
let game = null;
let loop = null;
let currentSlotIndex = null;
let currentGlobalSave = null;
let runtimeEventUnsubscribers = [];
let lastLifecycleSaveAt = 0;
let lastSyncLifecycleSaveAt = 0;
let lifecycleSaveInFlight = null;
let mainScreenUIBuilt = false;
let mainScreenEventListenersBound = false;
let enterCharacterVersion = 0;
let returningToSaveList = false;
let slotUnlockInFlight = false;

const gmGameConfig = {
  ...config,
  careers: careersData,
  equipments: equipmentsData,
  stones: stonesData,
  sub_zones: subZonesData,
  zones: subZonesData,
  boxes: boxesData,
  npcs: npcsData,
  quests: questsData,
  qigongs: qigongsData,
  buffs: buffsData,
  martial_arts: martialArtsData,
};
window._martialArtsData = martialArtsData;

function refreshActivePanelAfterGM() {
  UIManager._refreshAll?.();
  window._refreshOpenInventorySurfaces?.();

  const activePanel = document.querySelector('.page-panel.active');
  const activePanelId = activePanel?.id?.replace(/^page-/, '');
  if (!activePanelId || activePanelId === 'home' || activePanelId === 'combat') return;
  window._openPanel?.(activePanelId);
}

function syncGMGlobals() {
  if (typeof SaveManager.save !== 'function') {
    SaveManager.save = async (player = game?.player, slotIndex = currentSlotIndex) => {
      if (!player || !slotIndex) {
        console.warn('[GM] SaveManager.save() 失败：无当前角色或槽位');
        return false;
      }
      return SaveManager.savePlayerState(player, slotIndex);
    };
  }

  window.Game = {
    get currentPlayer() { return game?.player ?? null; },
    get currentSlotIndex() { return currentSlotIndex; },
    rebuildCareerFields(player = game?.player) {
      if (!player || !careersData.some(career => career.key === player.career)) return false;
      applyCareerRuntimeFields(player, careersData);
      return true;
    },
  };
  window.GameConfig = gmGameConfig;
  window.SaveManager = SaveManager;
  window.EventBus = {
    emit: (eventName, payload) => eventBus.emit(eventName, payload),
    on: (eventName, handler) => eventBus.on(eventName, handler),
    off: (eventName, handler) => eventBus.off(eventName, handler),
  };
  window.InventorySystem = InventorySystem;
  window.teleport_system = {
    teleport: (subZoneKey, source = 'gm') => {
      if (!game?.player) {
        console.warn('[GM] teleport_system.teleport() 失败：无当前角色');
        return false;
      }
      return TeleportSystem.teleport(subZoneKey, source, game.player, game);
    },
  };
  window.AttributeSystem = {
    recompute: (player = game?.player) => {
      if (!attrSys || !player) {
        console.warn('[GM] AttributeSystem.recompute() 失败：无当前角色或属性系统未初始化');
        return false;
      }
      attrSys.recompute(player);
      return true;
    },
  };

  window._careersData = careersData;
  window._attrSys = attrSys;
  window._qigongSys = QigongSystem;

  document.documentElement.dataset.gmGlobalsReady = 'true';
  document.documentElement.dataset.gmRequiredGlobals = [
    'Game.currentPlayer',
    'Game.rebuildCareerFields',
    'GameConfig',
    'SaveManager.save',
    'EventBus.emit',
    'InventorySystem.add',
    'teleport_system.teleport',
    'AttributeSystem.recompute',
  ].join(',');
}

// 暴露全局接口供 gm.js 使用。具体运行时引用会在切角色/清理时同步刷新。
syncGMGlobals();

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
    .then(saved => saved === true)
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

  const saveBeforeExit = () => {
    if (!game?.player || !currentSlotIndex) return;
    const now = Date.now();
    if (now - lastSyncLifecycleSaveAt < 250) return;
    lastSyncLifecycleSaveAt = now;
    SaveManager.savePlayerStateSync(game.player, currentSlotIndex);
  };
  window.addEventListener('pagehide', saveBeforeExit);
  window.addEventListener('beforeunload', saveBeforeExit);
}

async function cleanupCurrentRuntime({ save = true, saveMode = 'async' } = {}) {
  const playerToSave = game?.player || null;
  const slotToSave = currentSlotIndex;
  const activeLoop = loop;
  const shouldResumeOnFailure = !!activeLoop?.isRunning;

  activeLoop?.stop();

  if (save && playerToSave && slotToSave) {
    let saved;
    if (saveMode === 'sync') {
      saved = SaveManager.savePlayerStateSync(playerToSave, slotToSave);
    } else {
      saved = await SaveManager.savePlayerState(playerToSave, slotToSave);
    }
    if (!saved) {
      console.warn(saveMode === 'sync' ? '[存档] 同步快照保存失败' : '[存档] 运行时清理保存失败');
      if (shouldResumeOnFailure) activeLoop.start();
      return false;
    }
  }

  if (loop === activeLoop) loop = null;
  game?.battle?.destroy?.();
  clearRuntimeEventHandlers();
  AutoPlaySystem.resetRuntimeState();
  NPCSystem.closeDialog();
  window._currentNpc = null;
  game = null;
  attrSys = null;
  dropSys = null;
  currentSlotIndex = null;
  syncGMGlobals();
  return true;
}

setupPageLifecycleAutoSave();
window._switchCharacterFromSaveList = async (slotIndex) => enterCharacter(slotIndex);

// ========================
// 启动序列
// ========================
await runStartupSequence({
  onFirstLaunch: async () => {
    const gs = { ...globalSaveInit };
    if (!await SaveManager.saveGlobalState(gs)) {
      throw new Error('初始化全局存档写入失败');
    }
    currentGlobalSave = gs;
    window._currentGlobalSave = gs;
    window._careersData = careersData;
    buildMainScreen();
    showMultiSaveUI(gs, [], careersData);
  },

  onNoCharacter: () => {
    currentGlobalSave = SaveManager.restoreGlobalState() || { ...globalSaveInit };
    window._currentGlobalSave = currentGlobalSave;
    window._careersData = careersData;
    buildMainScreen();
    showMultiSaveUI(currentGlobalSave, [], careersData);
  },

  onShowMultiSaveList: ({ globalSave, characters }) => {
    currentGlobalSave = globalSave;
    window._currentGlobalSave = globalSave;
    window._careersData = careersData;
    buildMainScreen();
    showMultiSaveUI(globalSave, characters, careersData);
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

  // 刷新 top bar
  UIManager._refreshTopBar();
  UIManager._refreshHomePage();
}

function isOfflineSimulationActive() {
  return globalThis.__rxjhOfflineSimulation === true;
}

function isOfflineDebugEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('debug-offline') || params.has('offline-debug');
  } catch {
    return false;
  }
}

function logOfflineDebug(...args) {
  if (isOfflineDebugEnabled()) console.log(...args);
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function waitForNextPaint() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}

function bindMainScreenEventListenersOnce() {
  if (mainScreenEventListenersBound) return;
  mainScreenEventListenersBound = true;

  // 这些监听跟页面骨架生命周期一致，避免切角色/重进流程时重复订阅。
  eventBus.on('player.level_up', () => {
    if (isOfflineSimulationActive()) return;
    UIManager._refreshTopBar();
  });
  eventBus.on('player.death', () => {
    if (isOfflineSimulationActive()) return;
    UIManager._refreshTopBar();
  });
  eventBus.on('gm.refresh', () => refreshActivePanelAfterGM());

  eventBus.on('battle.player_hit', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('player_normal_attack_hit', d);
  });
  eventBus.on('battle.player_miss', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('player_normal_attack_miss', d);
  });
  eventBus.on('battle.player_skill', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('player_skill_release', d);
  });
  eventBus.on('battle.monster_hit', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('monster_attack_hit', d);
  });
  eventBus.on('battle.monster_miss', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('monster_attack_miss', d);
  });
  eventBus.on('battle.crit', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('player_normal_attack_hit', { ...d, crit_suffix: ' (暴击!)' });
  });
  eventBus.on('battle.leech', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('leech_triggered', d);
  });
  eventBus.on('battle.counter', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('counter_triggered', d);
  });
  eventBus.on('battle.armor_break', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('armor_break_triggered', d);
  });
  eventBus.on('monster.death', (d) => {
    if (isOfflineSimulationActive()) return;
    const monsterName = d.monsterName || monstersData.find(monster => monster.key === d.monsterKey)?.name || d.monsterKey;
    UIManager._addCombatLog('monster_died', { monster_name: monsterName });
    UIManager.addRewardLog('monster_kill_reward', {
      monster_name: monsterName,
      exp: d.exp || 0,
      gold: d.gold || 0,
      training: d.training || 0,
    });
  });
  eventBus.on('player.death', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager._addCombatLog('player_died', {});
    UIManager.addRewardLog('exp_loss_on_death', { loss: d?.exp_loss || 0 });
  });
  eventBus.on('player.level_up', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager.addRewardLog('level_up', { from_level: d.from_level, to_level: d.to_level });
  });
  eventBus.on('drop.equipment', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager.addRewardLog('equipment_dropped', d);
  });
  eventBus.on('drop.stone', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager.addRewardLog('stone_dropped', d);
  });
  eventBus.on('drop.box', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager.addRewardLog('box_dropped', d);
  });
  eventBus.on('drop.potion', (d) => {
    if (isOfflineSimulationActive()) return;
    UIManager.addRewardLog('potion_dropped', d);
  });

  eventBus.on('teleport.done', ({ to, source }) => {
    const isBackgroundTeleport = source === 'auto_resupply' || source === 'auto_store' || source === 'auto_sell';
    if (!isBackgroundTeleport) {
      UIManager.openPanel(to == null ? 'home' : 'combat');
    }
    if (to != null) game?.battle?.ensureInitialSpawn?.();
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

// ========================
// 进入角色（加载存档 + 初始化游戏）
// ========================
async function enterCharacter(slotIndex) {
  if (returningToSaveList) return;
  const enterVersion = ++enterCharacterVersion;
  const enterStartedAt = nowMs();
  if (game || loop || runtimeEventUnsubscribers.length > 0) {
    if (!await cleanupCurrentRuntime({ save: true })) {
      UIManager.toast?.('当前角色保存失败，已取消切换', 'error');
      return false;
    }
  }
  if (enterVersion !== enterCharacterVersion || returningToSaveList) return;

  const save = await SaveManager.restorePlayerFromSave(slotIndex);
  if (enterVersion !== enterCharacterVersion || returningToSaveList) return;
  if (!save) {
    console.log(`[错误] 槽位 ${slotIndex} 无有效存档`);
    return;
  }
  if (!careersData.some(career => career.key === save.player?.career)) {
    console.error(`[存档] 槽位 ${slotIndex} 的职业已失效: ${save.player?.career}`);
    UIManager.toast?.('角色职业数据已失效，无法进入', 'error');
    return false;
  }

  UIManager.closeAllModals();
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
  let offlineSummary = null;
  let offlineStartedAt = 0;
  let offlineFinishedAt = 0;

  // 离线模拟（若上次在挂机且离线超过1分钟）
  if (wasAutoPlaying && offlineHours > (1 / 60)) {
    logOfflineDebug(`[离线] 检测到 ${offlineHours.toFixed(1)} 小时离线收益，开始结算...`);
    showOfflineRewardLoading(0);
    await waitForNextPaint();
    offlineStartedAt = nowMs();
    try {
      offlineSummary = await OfflineSimulator.settle_offline_rewards({
        ...save,
        _slotIndex: slotIndex,
        _attrSys: attrSys,
        _dropSys: dropSys,
        _config: config,
        _monstersData: monstersData,
        _martialArtsData: martialArtsData,
        _subZonesData: subZonesData,
        _subZoneDropsData: subZoneDropsData,
        _buffSys: BuffSystem,
        _careersData: careersData,
        _equipmentsData: equipmentsData,
        _expToNextLevel: config.exp_to_next_level,
        _attributeConstants: config.attribute_constants,
      }, {
        onProgress: (p) => {
          if (p % 20 === 0) logOfflineDebug(`[离线结算] ${p}%`);
          updateOfflineRewardProgress(p);
        }
      });
    } catch (error) {
      console.error('[离线] 收益结算失败，已保留上次存档:', error);
      hideOfflineRewardLoading();
      UIManager.toast?.('离线收益结算失败，已使用上次存档', 'error');
    }
    if (enterVersion !== enterCharacterVersion || returningToSaveList) {
      hideOfflineRewardLoading();
      return;
    }
    offlineFinishedAt = nowMs();
    if (offlineSummary) {
      Object.assign(player, offlineSummary._player || {});
    } else {
      hideOfflineRewardLoading();
    }
  }

  const initStartedAt = nowMs();
  await initGameForPlayer(player, slotIndex);
  if (enterVersion !== enterCharacterVersion || returningToSaveList) {
    await cleanupCurrentRuntime({ save: true, saveMode: 'sync' });
    return;
  }
  const initFinishedAt = nowMs();
  UIManager.closeAllModals();
  if (offlineSummary) {
    showOfflineRewardUI(offlineSummary);
  } else {
    UIManager.openPanel('home');
  }
  const totalMs = nowMs() - enterStartedAt;
  if (isOfflineDebugEnabled() && (offlineSummary || totalMs > 1000)) {
    const offlineMs = offlineStartedAt && offlineFinishedAt ? Math.round(offlineFinishedAt - offlineStartedAt) : 0;
    console.log(`[进入角色耗时] 离线结算=${offlineMs}ms 初始化=${Math.round(initFinishedAt - initStartedAt)}ms 总计=${Math.round(totalMs)}ms`);
  }
}

async function returnToSaveListRuntime() {
  if (returningToSaveList) return loadAllCharacters();
  returningToSaveList = true;
  enterCharacterVersion++;
  const wasAutoPlaying = !!game?.player?.auto_play?.is_auto_play;
  try {
    if (wasAutoPlaying) {
      AutoPlaySystem.stop(game.player, 'return_to_save_list');
    }
    if (!await cleanupCurrentRuntime({ save: true, saveMode: 'sync' })) {
      if (wasAutoPlaying && game?.player) AutoPlaySystem.start(game.player);
      throw new Error('当前角色保存失败，已取消返回角色列表');
    }
    currentGlobalSave = SaveManager.restoreGlobalState() || currentGlobalSave || { ...globalSaveInit };
    window._currentGlobalSave = currentGlobalSave;
    window._careersData = careersData;
    return loadAllCharacters();
  } finally {
    returningToSaveList = false;
  }
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
  game?.battle?.destroy?.();
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
  if (player.location?.current_sub_zone_key && !currentSubZone) {
    player.location.current_sub_zone_key = null;
    player.location.current_map_key = 'town_xuanbo';
    if (player.auto_play) player.auto_play.is_auto_play = false;
    UIManager.toast?.('存档中的地图已失效，角色已安全返回城镇', 'warning');
  }
  game.battle = new BattleSystem({
    config,
    player,
    monstersData,
    martialArtsData,
    attrSystemRef: attrSys,
    dropSystemRef: dropSys,
    subZonesData,
    subZoneDropsData,
    currentSubZone,
    buffSystemRef: BuffSystem
  });

  loop = new GameLoop({ tickIntervalMs: 100, maxDeltaMs: 1000 });
  game.loop = loop;
  AutoPlaySystem.syncFromPlayer(player);
  syncGMGlobals();

  // 自动存档：每秒检查一次
  let _saveTimer = 0;
  loop.addTickListener((tickCount, elapsedMs) => {
    let remainingMs = elapsedMs;
    while (remainingMs > 0) {
      const delta = Math.min(100, remainingMs);
      player.statistics = player.statistics || {};
      player.statistics.total_playtime_ms = addCappedNonNegative(player.statistics.total_playtime_ms, delta);
      game.battle.tick(delta);
      AutoPlaySystem.tick(player, delta, (source, zone) => TeleportSystem.teleport(zone, source, player, game));

      // 城镇恢复：每 100ms 恢复 1%，保持 10%/s 的既有节奏。
      if (!player.location.current_sub_zone_key) {
        let recovered = false;
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.01));
          recovered = true;
        }
        if (player.mp < player.maxMp) {
          player.mp = Math.min(player.maxMp, player.mp + Math.ceil(player.maxMp * 0.01));
          recovered = true;
        }
        if (recovered) UIManager._refreshAllThrottled?.();
      }
      _saveTimer += delta;
      remainingMs -= delta;
    }
    if (_saveTimer >= 60000) {
      _saveTimer %= 60000;
      saveCurrentPlayerNow('auto_interval', { force: true });
    }
  });

  // 更新全局存档 last_used_slot
  if (currentGlobalSave) {
    const previousLastUsedSlot = currentGlobalSave.character_slots.last_used_slot;
    currentGlobalSave.character_slots.last_used_slot = slotIndex;
    if (!await SaveManager.saveGlobalState(currentGlobalSave)) {
      currentGlobalSave.character_slots.last_used_slot = previousLastUsedSlot;
      console.warn('[存档] 最近角色槽位写入失败');
    }
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
    if (globalThis.__rxjhOfflineSimulation) return;
    console.log(`[事件] monster.death: ${data.monsterKey} exp+${data.exp}`);
  });
  onRuntimeEvent('quest.accepted', (data) => console.log(`[事件] quest.accepted: ${data.name}`));
  onRuntimeEvent('quest.completed', (data) => console.log(`[事件] quest.completed: ${data.questKey}`));
  onRuntimeEvent('quest.stage_advance', (data) => console.log(`[事件] quest.stage_advance: ${data.questKey} 进入第 ${data.stage} 阶段`));
  onRuntimeEvent('player.career_transfer', (data) => {
    applyCareerRuntimeFields(player, careersData);
    attrSys.recompute(player);
    eventBus.emit('battle.player_status_changed', { player, reason: 'career_transfer' });
    console.log(`[事件] player.career_transfer: ${data.from_career}→${data.to_career}`);
    saveCurrentPlayerNow('career_transfer', { force: true });
  });
  onRuntimeEvent('buff.applied', (data) => {
    attrSys.recompute(data.player || player);
    eventBus.emit('battle.player_status_changed', { player: data.player || player, reason: 'buff_applied' });
    console.log(`[事件] buff.applied: ${data.name}`);
  });
  onRuntimeEvent('buff.expired', (data) => {
    attrSys.recompute(data.player || player);
    eventBus.emit('battle.player_status_changed', { player: data.player || player, reason: 'buff_expired' });
    console.log(`[事件] buff.expired: ${data.buffKey}`);
  });
  onRuntimeEvent('autoplay.start', () => console.log('[系统] 开始挂机'));
  onRuntimeEvent('autoplay.stop', (d) => console.log(`[系统] 停止挂机: ${d.reason}`));

  loop.start();
  console.log(`=== 进入游戏: ${player.name} (${player.career}) Lv${player.level} ===`);
  showGameCommands();
  game.battle.ensureInitialSpawn?.();
  UIManager._refreshAll();
}

function showGameCommands() {
  console.log('可用命令: game.listCharacters(), game.switchCharacter(slot), game.createCharacter(career, name), game.deleteCharacter(slot)');
  console.log('挂机: 仅可通过战斗页按钮开始；game.stopAutoPlay() 可停止挂机');
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

  get battle() {
    return game?.battle ?? null;
  },

  // ---------- 角色管理 ----------
  async listCharacters() {
    const characters = await loadAllCharacters();
    console.log('=== 角色列表 ===');
    if (characters.length === 0) console.log('  （无）');
    for (const c of characters) {
      const loc = c.location?.current_sub_zone_key || '城镇';
      console.log(`  [${c.slotIndex}] ${c.player?.name}(${c.player?.career}) Lv${c.player?.level} | ${loc}`);
    }
    return characters;
  },

  async createCharacter(careerKey, name, targetSlotIndex) {
    const flow = runCharacterCreationFlow({
      careersData,
      equipmentsData,
      globalSave: currentGlobalSave,
      attributeConstants: config.attribute_constants,
    });
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

  async returnToSaveList() {
    return returnToSaveListRuntime();
  },

  async startOfflineAutoplay() {
    if (!game?.player?.auto_play?.is_auto_play || !game.player.location?.current_sub_zone_key) {
      return { success: false, message: '当前角色没有进行中的野外挂机' };
    }
    if (!await cleanupCurrentRuntime({ save: true, saveMode: 'sync' })) {
      return { success: false, message: '当前角色保存失败，已取消离线挂机' };
    }
    return { success: true, characters: await loadAllCharacters() };
  },

  deleteCharacter(slotIndex) {
    const raw = storage.get(`player-${slotIndex}`);
    if (!raw) return console.log(`[错误] 槽位 ${slotIndex} 无存档`);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return console.log('[错误] 存档损坏'); }
    const info = getDeletionConfirmInfo(slotIndex, parsed.data || parsed, careersData);
    console.log(info.confirmBody);
    console.log('确认删除？调用 game.confirmDeleteCharacter(' + slotIndex + ')');
  },

  async confirmDeleteCharacter(slotIndex, opts = {}) {
    const deletingCurrentCharacter = slotIndex === currentSlotIndex;
    if (deletingCurrentCharacter) {
      if (!await cleanupCurrentRuntime({ save: true, saveMode: 'sync' })) {
        const message = '当前角色保存失败，已取消删除';
        UIManager.toast?.(message, 'error');
        return { success: false, globalSave: currentGlobalSave, message };
      }
    }

    const r = await executeDeletion(slotIndex, currentGlobalSave);
    if (!r.success) {
      console.warn(`[删除] ${r.message || '角色删除失败'}`);
      UIManager.toast?.(r.message || '角色删除失败', 'error');
      if (deletingCurrentCharacter) await enterCharacter(slotIndex);
      return r;
    }

    currentGlobalSave = r.globalSave;
    window._currentGlobalSave = currentGlobalSave;
    console.log(`[删除] 槽位 ${slotIndex} 已删除`);

    const characters = await loadAllCharacters();
    if (characters.length === 0) {
      console.log('[删除] 所有角色已删除，请创建新角色');
      UIManager.closeAllModals?.();
      showCharacterCreationUI(currentGlobalSave, null);
      return;
    }

    if (deletingCurrentCharacter) {
      const nextSlot = characters[0]?.slotIndex;
      if (nextSlot) {
        console.log(`[删除] 已自动切换到槽位 ${nextSlot}`);
        UIManager.closeAllModals?.();
        await enterCharacter(nextSlot);
      }
      return;
    }

    await this.listCharacters();
    if (opts.refreshList) {
      showMultiSaveUI(currentGlobalSave, characters, careersData);
    }
  },

  async unlockSlot(slotIndex) {
    if (slotUnlockInFlight) return { success: false, message: '正在解锁栏位，请稍候' };
    slotUnlockInFlight = true;
    try {
      const activePlayer = game?.player || null;
      const payerSlot = currentSlotIndex
        || currentGlobalSave?.character_slots?.last_used_slot
        || null;
      const result = await executeSlotUnlock(slotIndex, currentGlobalSave, {
        activePlayer,
        payerSlot,
      });
      if (result.success) {
        currentGlobalSave = result.globalSave;
        window._currentGlobalSave = currentGlobalSave;
        console.log(`[解锁] 第 ${slotIndex} 槽位已解锁，支付槽位 ${result.payerSlot}，剩余金币 ${result.remainingGold}`);
      }
      return result;
    } finally {
      slotUnlockInFlight = false;
    }
  },

  // ---------- 挂机 ----------
  startAutoPlay(source) {
    if (!currentSlotIndex) return console.log('[错误] 无当前角色（请先创建或切换角色）');
    if (!game?.player) return console.log('[错误] 无当前角色');
    if (source !== 'combat_button') {
      console.warn('[挂机] 仅可通过战斗页面的开始挂机按钮开启');
      return false;
    }
    if (!game.player.location?.current_sub_zone_key) {
      console.warn('[挂机] 当前不在战斗区域，无法开启挂机');
      return false;
    }
    AutoPlaySystem.start(game.player);
    console.log('[挂机] 已开始');
    return true;
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
    if (!game?.player) return false;
    const teleported = TeleportSystem.teleport(subZoneKey, 'player_click', game.player, game);
    if (teleported) console.log(`[传送] 到达 ${subZoneKey}`);
    else console.warn(`[传送] 目标区域无效：${subZoneKey}`);
    return teleported;
  },

  town() {
    if (!game?.player) return false;
    const teleported = TeleportSystem.teleport(null, 'player_click', game.player, game);
    if (teleported) console.log('[传送] 回城');
    return teleported;
  },

  // ---------- 存档 ----------
  async exportSave(opts = {}) {
    if (game?.player && currentSlotIndex) {
      const saved = await saveCurrentPlayerNow('export_save', { force: true });
      if (!saved) {
        console.warn('[导出] 当前角色保存失败，已取消导出');
        return null;
      }
    }
    const pack = await doExportSave(opts);
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

  async importSave(base64Str) {
    const pausedLoop = loop;
    pausedLoop?.stop();
    let result;
    try {
      result = await doImportSave(base64Str);
    } catch (error) {
      console.error('[导入] 未预期的导入错误:', error);
      result = { success: false, message: '导入失败：存档处理异常' };
    }

    console.log(`[导入] ${result.message}`);
    if (!result.success) {
      pausedLoop?.start();
      UIManager.toast?.(result.message, 'error');
      return result;
    }

    // 导入成功后立即销毁旧角色运行时，避免刷新前的自动存档覆盖刚导入的数据。
    await cleanupCurrentRuntime({ save: false });
    UIManager.toast?.('导入成功，正在重新载入', 'success');
    setTimeout(() => location.reload(), 300);
    return result;
  },

  // ---------- 测试 ----------
  async fastForwardOffline(hours) {
    const summary = await OfflineSimulator.fastForwardOffline(hours);
    showOfflineRewardUI(summary);
    return summary;
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
    game.player.level = lv;
    applyCareerRuntimeFields(game.player, careersData);
    attrSys.recompute(game.player);
    game.player.hp = game.player.maxHp;
    game.player.mp = game.player.maxMp;
    console.log(`[调试] 等级设为 ${lv}，四维: str=${game.player.str} dex=${game.player.dex} sta=${game.player.sta} int=${game.player.int}`);
    SaveManager.savePlayerState(game.player, currentSlotIndex);
  },
  addGold: (amount) => {
    game.player.resources.gold = (game.player.resources.gold || 0) + amount;
    eventBus.emit('resources.changed', { player: game.player, resource: 'gold', amount, action: 'add' });
    console.log(`[金币] 当前: ${game.player.resources.gold}`);
  },
  setBattleLog: (enabled) => {
    if (game?.battle) {
      game.battle._quiet = !enabled;
      console.log(`[战斗日志] ${enabled ? '开启' : '关闭'}`);
    }
  },
};
