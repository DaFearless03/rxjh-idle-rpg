/**
 * @file ui/UIManager.js
 * @desc UI 总控 + modal 层级管理 + toast
 */
import { eventBus } from '../core/EventBus.js';
import { storage } from '../utils/storage.js';
import { refreshMonsterList } from './MonsterListUI.js?v=release-20260611-6';
import { refreshPlayerIdentity, refreshPlayerStatusBar } from './PlayerStatusBarUI.js?v=release-20260611-6';
import { appendCombatLog, formatCombatLog, renderCombatLog } from './CombatLogUI.js';
import { appendRewardLog, formatRewardLog, renderRewardLog } from './RewardLogUI.js';
import { TaskSystem } from '../systems/TaskSystem.js';

function getCareerDisplayName(player) {
  return window._careersData?.find(career => career.key === player?.career)?.name || player?.career || '—';
}

class UIManagerClass {
  constructor() {
    this._modals = [];        // modal 栈
    this._toasts = [];
    this._elements = {};      // 缓存 DOM 引用
    this._combatLog = [];    // 环形缓冲 200 条
    this._rewardLog = [];    // 环形缓冲 200 条
    this._combatAutoScroll = true;
    this._rewardAutoScroll = true;
    this._logScrollBoundElements = new WeakSet();
    this._homeSession = { startedAt: null, kills: 0, exp: 0, gold: 0, drops: 0 };

    eventBus.on('player.level_up', () => this._refreshAll());
    eventBus.on('player.death', () => this._refreshAll());
    eventBus.on('player.career_transfer', () => this._refreshAll());
    eventBus.on('quest.accepted', () => this._refreshAll());
    eventBus.on('quest.completed', () => this._refreshAll());
    eventBus.on('quest.stage_advance', () => this._refreshAll());
    eventBus.on('battle.monsters_changed', () => this._refreshMonsterList());
    eventBus.on('battle.player_status_changed', () => this._refreshAll());
    eventBus.on('monster.death', (data) => {
      if (this._homeSession.startedAt) {
        this._homeSession.kills += 1;
        this._homeSession.exp += Number(data?.exp || 0);
        this._homeSession.gold += Number(data?.gold || 0);
      }
      this._refreshAll();
    });
    eventBus.on('buff.applied', () => this._refreshAll());
    eventBus.on('buff.expired', () => this._refreshAll());
    eventBus.on('autoplay.start', () => {
      this._homeSession = { startedAt: Date.now(), kills: 0, exp: 0, gold: 0, drops: 0 };
      this._refreshAll();
    });
    eventBus.on('autoplay.stop', () => this._refreshAll());
    ['drop.equipment', 'drop.stone', 'drop.box', 'drop.potion'].forEach(eventName => {
      eventBus.on(eventName, () => {
        if (this._homeSession.startedAt) this._homeSession.drops += 1;
        this._refreshHomePage();
      });
    });
    eventBus.on('autoplay.consume_hp', (d) => this._addCombatLog('auto_consume_hp', d));
    eventBus.on('autoplay.consume_mp', (d) => this._addCombatLog('auto_consume_mp', d));
    eventBus.on('teleport.done', () => this._refreshAll());

    // idle-indicator 显示/隐藏
    this._refreshIdleIndicator();
    eventBus.on('autoplay.start', () => this._refreshIdleIndicator());
    eventBus.on('autoplay.stop', () => this._refreshIdleIndicator());

    // ESC 关闭 modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeTopModal();
    });
  }

  // ========================
  // DOM 引用缓存
  // ========================
  getEl(id) {
    if (!this._elements[id]) {
      this._elements[id] = document.getElementById(id);
    }
    return this._elements[id];
  }

  // ========================
  // Toast 通知
  // ========================
  toast(msg, type = 'info') {
    const container = this.getEl('toast-container') || this._createToastContainer();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  _createToastContainer() {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    this._elements['toast-container'] = c;
    return c;
  }

  // ========================
  // Modal 管理
  // ========================
  pushModal(modalEl) {
    if (this._modals.length > 0) {
      this._modals[this._modals.length - 1].classList.remove('active');
    }
    modalEl.classList.add('active');
    this._modals.push(modalEl);
  }

  popModal() {
    const top = this._modals.pop();
    if (top) {
      top.classList.remove('active');
    }
    if (this._modals.length > 0) {
      this._modals[this._modals.length - 1].classList.add('active');
    }
  }

  _closeTopModal() {
    if (this._modals.length > 0) {
      this.popModal();
    }
  }

  closeAllModals() {
    while (this._modals.length > 0) this.popModal();
  }

  // ========================
  // Panel 管理（主面板切换）
  // ========================
  openPanel(panelId) {
    // 关闭所有 panel
    document.querySelectorAll('.panel, .page-panel').forEach(p => p.classList.remove('active'));
    // 支持 home/main 互转
    const id = panelId === 'main' ? 'home' : panelId;
    const panel = document.getElementById('page-' + id);
    if (panel) {
      panel.classList.add('active');
    }
    // 同步 bottom-bar active 状态
    document.querySelectorAll('.bottom-btn, .menu-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-' + id) || document.querySelector(`.menu-btn[data-panel="${id}"]`);
    if (btn) btn.classList.add('active');
    if (panelId === 'home' || panelId === 'main') {
      const homeBtn = document.querySelector('.menu-btn[data-panel="home"]') || document.getElementById('btn-home');
      if (homeBtn) homeBtn.classList.add('active');
    }
  }

  closePanel() {
    document.querySelectorAll('.panel, .page-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bottom-btn, .menu-btn').forEach(b => b.classList.remove('active'));
    const homeBtn = document.querySelector('.menu-btn[data-panel="home"]') || document.getElementById('btn-home');
    if (homeBtn) homeBtn.classList.add('active');
    const homePanel = document.getElementById('page-home');
    if (homePanel) homePanel.classList.add('active');
  }

  // ========================
  // 刷新
  // ========================
  _refreshAll() {
    this._refreshTopBar();
    this._refreshHomePage();
    this._refreshStatusBar();
    this._refreshMonsterList();
    this._refreshIdleIndicator();
  }

  _refreshHomePage() {
    const p = window.game?.player;
    if (!p) return;
    const nameEl = document.getElementById('top-name');
    const levelEl = document.getElementById('top-level');
    const classEl = document.getElementById('top-class');
    const factionEl = document.getElementById('top-faction');
    if (nameEl) nameEl.textContent = p.name || '—';
    if (levelEl) levelEl.textContent = `Lv.${p.level}`;
    if (classEl) classEl.textContent = getCareerDisplayName(p);
    if (factionEl) {
      factionEl.textContent = p.faction === 'negative' ? '邪派' : p.faction === 'positive' ? '正派' : '中立';
      factionEl.className = `faction ${p.faction || 'neutral'}`;
    }
    refreshPlayerStatusBar(p, { prefix: 'home' });
    this._refreshHomeLocationState(p);
    this._refreshQuestNotice(p);
  }

  _refreshQuestNotice(player) {
    const questNpc = {
      type: 'quest',
      quests: (window._questTemplates || []).map(quest => ({ key: quest.key })),
    };
    const canAccept = TaskSystem.listVisibleQuests(player, questNpc).length;
    TaskSystem.stageAdvanceCheck(player);
    const canSubmit = (player.quests?.accepted || []).filter(quest =>
      (quest.objectives || []).every(stage => quest.completed_stages?.includes(stage.stage))
    ).length;
    const leader = document.getElementById('home-leader-card');
    const leaderMeta = document.getElementById('home-leader-meta');
    if (leader) leader.classList.toggle('has-notice', canAccept + canSubmit > 0);
    if (leaderMeta) leaderMeta.textContent = `任务 · 可接 ${canAccept} 个 / 可交 ${canSubmit} 个`;
    document.querySelectorAll('.menu-btn').forEach(button => {
      if (button.textContent.includes('任务')) button.classList.toggle('has-notice', canAccept + canSubmit > 0);
    });
  }

  _refreshHomeLocationState(player) {
    const subZoneKey = player.location?.current_sub_zone_key || null;
    const townContent = document.getElementById('home-town-content');
    const wildContent = document.getElementById('home-wild-content');
    if (townContent) townContent.hidden = !!subZoneKey;
    if (wildContent) wildContent.hidden = !subZoneKey;
    const restoreBadgeEl = document.getElementById("restore-badge");
    if (restoreBadgeEl) {
      const townFull = !subZoneKey && player.hp >= player.maxHp && player.mp >= player.maxMp;
      restoreBadgeEl.style.display = townFull ? "none" : "";
    }    if (!subZoneKey) return;

    const battleZone = window.game?.battle?._currentSubZone;
    const zone = typeof battleZone === 'object' && battleZone?.key === subZoneKey ? battleZone : null;
    const name = zone?.name || subZoneKey;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText('home-wild-name', name);
    setText('home-wild-desc', `江湖野外 · ${zone?.monsters?.length || 0} 种怪物`);
    const isAutoPlaying = !!player.auto_play?.is_auto_play;
    setText('home-wild-idle', isAutoPlaying ? '挂机中' : '已暂停');
    setText('home-wild-autoplay-icon', isAutoPlaying ? '⏸' : '▶');
    setText('home-wild-autoplay-label', isAutoPlaying ? '停止挂机' : '开始挂机');
    setText('home-wild-autoplay-sub', isAutoPlaying ? '保留当前位置' : '当前区域');
    const autoplayAction = document.getElementById('home-wild-autoplay-action');
    if (autoplayAction) {
      autoplayAction.classList.toggle('danger', isAutoPlaying);
      autoplayAction.classList.toggle('success', !isAutoPlaying);
    }
    if (isAutoPlaying && !this._homeSession.startedAt) {
      this._homeSession.startedAt = Date.now();
    }
    const session = this._homeSession;
    setText('home-wild-kills', session.kills.toLocaleString());
    setText('home-wild-exp', session.exp.toLocaleString());
    setText('home-wild-gold', session.gold.toLocaleString());
    setText('home-wild-drops', session.drops.toLocaleString());
    const elapsedSeconds = session.startedAt ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)) : 0;
    setText('home-session-note', `已 ${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒`);

    const buffsEl = document.getElementById('home-wild-buffs');
    if (buffsEl) {
      const buffs = player.buffs || [];
      buffsEl.innerHTML = buffs.map(buff => `<span class="buff-chip">${buff.name || buff.key || '增益'}${buff.remaining != null ? `<span class="timer">${Math.ceil(buff.remaining / 1000)}s</span>` : ''}</span>`).join('');
    }
  }

  _refreshTopBar() {
    const p = window.game?.player;
    if (!p) return;
    const nameEl = document.getElementById('top-name');
    const levelEl = document.getElementById('top-level');
    const classEl = document.getElementById('top-class');
    if (nameEl) nameEl.textContent = p.name || '—';
    if (levelEl) levelEl.textContent = `Lv.${p.level}`;
    if (classEl) classEl.textContent = getCareerDisplayName(p);
    // Combat page refs
    const combatName = document.getElementById('combat-name');
    const combatLevel = document.getElementById('combat-level');
    const combatClass = document.getElementById('combat-class');
    const combatFaction = document.getElementById('combat-faction');
    if (combatName) combatName.textContent = p.name || '—';
    if (combatLevel) combatLevel.textContent = `Lv.${p.level}`;
    if (combatClass) combatClass.textContent = getCareerDisplayName(p);
    if (combatFaction) {
      const faction = p.faction === 'negative' ? '邪派' : p.faction === 'positive' ? '正派' : '中立';
      combatFaction.textContent = faction;
      combatFaction.className = `faction ${p.faction || 'neutral'}`;
    }
    const goldEl = document.getElementById('top-gold');
    const qigongEl = document.getElementById('top-qigong');
    if (goldEl) goldEl.textContent = (p.resources?.gold || 0).toLocaleString();
    if (qigongEl) qigongEl.textContent = p.qigong?.available_points || 0;

    // 更新战斗页面的区域名称
    const zoneNameEl = document.getElementById('zone-name');
    if (zoneNameEl) {
      const battle = window.game?.battle;
      const battleSubZone = battle?._currentSubZone;
      const subZone = (typeof battleSubZone === 'string' ? battleSubZone : battleSubZone?.key)
        || window.game?.player?.location?.current_sub_zone_key
        || window.game?.currentSubZoneKey;
      const ZONE_NAMES = {
        town_xuanbo: '泫渤派 城镇',
        xuanbo_village: '村庄周围 L3-5',
        xuanbo_field: '村庄野田 L8-12',
        xuanbo_den: '狼熊聚居地 L12-15',
        xuanbo_lumber: '伐木场 L18-22',
        xuanbo_cemetery: '墓地 L22-30',
        xuanbo_robber: '山寨 L30-35',
        liuzheng_forest: '关外山林 L35-37',
        liuzheng_fishing_village: '渔村 L38-42',
        liuzheng_monster_camp: '怪兽营地 L43-45',
        liuzheng_fire_thief_den: '火贼山寨 L47-50',
        liuzheng_wanshou_pavilion: '万寿阁下层 L51-54',
        liuzheng_wanshou_pavilion_upper: '万寿阁上层 L54-57',
        liuzheng_deep_bamboo: '渊竹林 L57-59',
        shenwu_tiger_valley: '虎峡谷 L60-61',
        shenwu_miser_cave: '吝啬鬼洞穴 L61-63',
        shenwu_degenerate_land: '变质的荒地 L64-67',
        sanxie_forest: '关外山林 L35-37',
        sanxie_deserter_camp: '逃兵营地 L38-42',
        sanxie_hunter_camp: '猎人寨 L43-45',
        sanxie_green_forest_camp: '绿林寨 L47-50',
        sanxie_wutian_lower: '无天阁下层 L51-54',
        sanxie_wutian_upper: '无天阁上层 L54-57',
        sanxie_bamboo_fire_forest: '竹火林 L57-59',
        liushan_snake_valley: '蛇谷 L60-61',
        liushan_black_pine_base: '黑松贼根据地 L61-63',
        liushan_thief_nest: '盗贼巢穴 L64-67',
        nanminghu_lake: '南明湖 L68-71',
        nanminghu_cave: '南明洞 L71-75',
      };
      if (subZone) {
        zoneNameEl.textContent = ZONE_NAMES[subZone] || subZone;
      } else {
        zoneNameEl.textContent = '城镇';
      }
    }
  }

  _refreshStatusBar() {
    const p = window.game?.player;
    if (!p) return;
    refreshPlayerIdentity(p, { prefix: 'combat' });
    refreshPlayerStatusBar(p, { prefix: 'role' });
  }

  _refreshMonsterList() {
    const battle = window.game?.battle;
    refreshMonsterList(battle);
  }

  _refreshMapList() {
    // 地图列表高亮由 MapListPanelUI 自己管理
  }

  _refreshIdleIndicator() {
    const el = document.getElementById('idle-indicator');
    if (!el) return;
    const isAutoplay = window.game?.player?.auto_play?.is_auto_play;
    el.style.display = isAutoplay ? 'flex' : 'none';
  }

  // ========================
  // 战斗日志（16种事件）
  // ========================
  _addCombatLog(eventType, data) {
    appendCombatLog(this._combatLog, formatCombatLog(eventType, data));
    renderCombatLog(this._combatLog, 'combat-log-area', this._combatAutoScroll);
  }

  // ========================
  // 掉落日志（7种事件）
  // ========================
  addRewardLog(eventType, data) {
    appendRewardLog(this._rewardLog, formatRewardLog(eventType, data));
    renderRewardLog(this._rewardLog, 'combat-result-area', this._rewardAutoScroll);
  }

  // 监听滚动暂停 auto_scroll
  setupLogScroll(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (this._logScrollBoundElements.has(el)) return;
    this._logScrollBoundElements.add(el);

    const isCombat = elId === 'combat-log-area';
    el.addEventListener('scroll', () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      if (isCombat) this._combatAutoScroll = atBottom;
      else this._rewardAutoScroll = atBottom;
    });
  }
}

export const UIManager = new UIManagerClass();
