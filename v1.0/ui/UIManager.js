/**
 * @file ui/UIManager.js
 * @desc UI 总控 + modal 层级管理 + toast
 */
import { eventBus } from '../core/EventBus.js';
import { storage } from '../utils/storage.js';

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

    eventBus.on('player.level_up', () => this._refreshAll());
    eventBus.on('player.death', () => this._refreshAll());
    eventBus.on('player.career_transfer', () => this._refreshAll());
    eventBus.on('quest.accepted', () => this._refreshAll());
    eventBus.on('quest.completed', () => this._refreshAll());
    eventBus.on('quest.stage_advance', () => this._refreshAll());
    eventBus.on('monster.death', () => this._refreshAll());
    eventBus.on('buff.applied', () => this._refreshAll());
    eventBus.on('buff.expired', () => this._refreshAll());
    eventBus.on('autoplay.start', () => this._refreshAll());
    eventBus.on('autoplay.stop', () => this._refreshAll());
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
    if (classEl) classEl.textContent = p.career || '—';
    if (factionEl) {
      factionEl.textContent = (p.faction === 'negative' ? '邪派' : '正派');
      factionEl.className = `faction ${p.faction === 'negative' ? 'negative' : 'positive'}`;
    }
    const hpFill = document.getElementById('home-hp-fill');
    const mpFill = document.getElementById('home-mp-fill');
    const expFill = document.getElementById('home-exp-fill');
    const hpPct = document.getElementById('home-hp-pct');
    const mpPct = document.getElementById('home-mp-pct');
    const expPct = document.getElementById('home-exp-pct');
    const hpText = document.getElementById('home-hp-text');
    const mpText = document.getElementById('home-mp-text');
    const expText = document.getElementById('home-exp-text');
    if (hpFill && hpPct) {
      const pct = Math.round(p.hp / p.maxHp * 100);
      hpFill.style.width = pct + '%';
      hpPct.textContent = pct + '%';
    }
    if (mpFill && mpPct) {
      const pct = Math.round(p.mp / p.maxMp * 100);
      mpFill.style.width = pct + '%';
      mpPct.textContent = pct + '%';
    }
    if (hpText) hpText.textContent = `${p.hp}/${p.maxHp}`;
    if (mpText) mpText.textContent = `${p.mp}/${p.maxMp}`;
    if (expText && expFill && expPct) {
      const expToNext = window.expToNext?.[p.level] || 0;
      if (p.level >= window.currentLevelCap) {
        expText.textContent = '满级 MAX';
        expFill.style.width = '100%';
        expPct.textContent = 'MAX';
      } else {
        const pct = expToNext > 0 ? Math.round(p.exp / expToNext * 100) : 0;
        expText.textContent = `${p.exp.toLocaleString()}/${expToNext.toLocaleString()}`;
        expFill.style.width = pct + '%';
        expPct.textContent = pct + '%';
      }
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
    if (classEl) classEl.textContent = p.career || '—';
    // Combat page refs
    const combatName = document.getElementById('combat-name');
    const combatLevel = document.getElementById('combat-level');
    const combatClass = document.getElementById('combat-class');
    const combatFaction = document.getElementById('combat-faction');
    if (combatName) combatName.textContent = p.name || '—';
    if (combatLevel) combatLevel.textContent = `Lv.${p.level}`;
    if (combatClass) combatClass.textContent = p.career || '—';
    if (combatFaction) {
      combatFaction.textContent = (p.faction === 'negative' ? '邪派' : '正派');
      combatFaction.className = `faction ${p.faction === 'negative' ? 'negative' : 'positive'}`;
    }
    const goldEl = document.getElementById('top-gold');
    const qigongEl = document.getElementById('top-qigong');
    if (goldEl) goldEl.textContent = (p.resources?.gold || 0).toLocaleString();
    if (qigongEl) qigongEl.textContent = p.qigong?.available_points || 0;

    // 更新战斗页面的区域名称
    const zoneNameEl = document.getElementById('zone-name');
    if (zoneNameEl) {
      const battle = window.game?.battle;
      const subZone = battle?._currentSubZone || window.game?.currentSubZoneKey;
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

    const hpFill = document.getElementById('role-hp-fill');
    const mpFill = document.getElementById('role-mp-fill');
    const expFill = document.getElementById('role-exp-fill');
    const hpPct = document.getElementById('role-hp-pct');
    const mpPct = document.getElementById('role-mp-pct');
    const expPct = document.getElementById('role-exp-pct');
    const hpText = document.getElementById('role-hp-text');
    const mpText = document.getElementById('role-mp-text');
    const expText = document.getElementById('role-exp-text');

    if (hpFill && hpPct) {
      const pct = Math.round(p.hp / p.maxHp * 100);
      hpFill.style.width = pct + '%';
      hpFill.className = 'gba-bar-fill fill-hp' + (pct <= 18 ? ' danger' : pct <= 36 ? ' warn' : '');
      hpPct.textContent = pct + '%';
    }
    if (mpFill && mpPct) {
      const pct = Math.round(p.mp / p.maxMp * 100);
      mpFill.style.width = pct + '%';
      mpPct.textContent = pct + '%';
    }
    if (hpText) hpText.textContent = `${p.hp}/${p.maxHp}`;
    if (mpText) mpText.textContent = `${p.mp}/${p.maxMp}`;
    if (expText && expFill && expPct) {
      const expToNext = window.expToNext?.[p.level] || 0;
      if (p.level >= window.currentLevelCap) {
        expText.textContent = '满级 MAX';
        expFill.style.width = '100%';
        expPct.textContent = 'MAX';
      } else {
        const pct = expToNext > 0 ? Math.round(p.exp / expToNext * 100) : 0;
        expText.textContent = `${p.exp.toLocaleString()}/${expToNext.toLocaleString()}`;
        expFill.style.width = pct + '%';
        expPct.textContent = pct + '%';
      }
    }
  }

  _refreshMonsterList() {
    const battle = window.game?.battle;
    if (!battle) return;
    const el = document.getElementById('monster-grid');
    if (!el) return;
    const monsters = battle.monsters || [];
    document.getElementById('monster-count').textContent = `${monsters.length}/${battle.maxMonsters || 8}`;

    el.innerHTML = monsters.slice(0, 8).map(m => {
      const pct = m.maxHp > 0 ? Math.round(m.hp / m.maxHp * 100) : 0;
      const hpClass = pct <= 18 ? ' fill-hp danger' : pct <= 36 ? ' fill-hp warn' : ' fill-hp';
      return `<div class="monster-cell${!m.isAlive() ? ' dead' : ''}">
        <span class="icon-big">👹</span>
        <div class="body">
          <div class="name-row">
            <span class="name">${m.name}</span>
            <span class="num">${m.hp}/${m.maxHp}</span>
          </div>
          <div class="gba-bar"><div class="gba-bar-fill${hpClass}" style="width:${pct}%"></div></div>
        </div>
      </div>`;
    }).join('');
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
  // 战斗日志（14种事件）
  // ========================
  _addCombatLog(eventType, data) {
    const templates = {
      player_normal_attack_hit: `你 → <span class="target">${data.target}</span>: <span class="damage">${data.damage}${data.crit_suffix || ''}</span>`,
      player_normal_attack_miss: `你 → <span class="target">${data.target}</span>: <span class="damage">未命中</span>`,
      player_skill_release: `你 释放 <span class="skill-name">${data.skill_name}</span> → <span class="target">${data.target}</span>: <span class="damage">${data.damage}${data.skill_crit_suffix || ''}</span>`,
      player_skill_aoe_sub: `<span class="sub-target">↳ → <span class="target">${data.target}</span>: <span class="damage">${data.damage}</span></span>`,
      monster_attack_hit: `<span class="target">${data.attacker}</span> → 你: <span class="damage">${data.damage}${data.shield_suffix || ''}</span>`,
      monster_attack_miss: `<span class="target">${data.attacker}</span> → 你: <span class="damage">未命中</span>`,
      combo_triggered: `你 → <span class="target">${data.target}</span>: <span class="damage">${data.damages_joined} (连击!)</span>`,
      leech_triggered: `你 → <span class="target">${data.target}</span>: <span class="damage">${data.damage}</span> (汲取 <span class="heal-num">+${data.heal} HP</span>)`,
      counter_triggered: `<span class="target">${data.attacker}</span> → 你: <span class="damage">${data.damage}</span> → 反伤 ${data.reflected} (<span class="target">${data.attacker}</span> -${data.reflected})`,
      armor_break_triggered: `你 → <span class="target">${data.target}</span>: <span class="damage">${data.damage} (破甲!)</span>`,
      auto_consume_hp: `⚗ 自动喝药: ${data.item} <span class="heal-num">+${data.recovered} HP</span>`,
      auto_consume_mp: `⚗ 自动喝药: ${data.item} <span class="heal-num">+${data.recovered} MP</span>`,
      buff_applied: `★ Buff: ${data.name} (${data.duration}s)`,
      buff_expired: `✗ Buff 消失: ${data.buffKey}`,
      monster_died: `✗ ${data.monster_name} 已倒下`,
      player_died: `✗ 你 已倒下`,
    };
    const msg = templates[eventType] || `${eventType}: ${JSON.stringify(data)}`;
    const rowClass = this._getCombatLogClass(eventType, data);
    this._pushLog(this._combatLog, 'combat-log-area', msg, rowClass);
  }

  _getCombatLogClass(eventType, data) {
    if (eventType === 'player_normal_attack_hit' && data.crit_suffix) return 'log-line crit';
    if (eventType === 'leech_triggered') return 'log-line heal';
    if (eventType === 'player_normal_attack_hit' || eventType === 'player_skill_release' ||
        eventType === 'combo_triggered' || eventType === 'leech_triggered' ||
        eventType === 'armor_break_triggered' || eventType === 'player_skill_aoe_sub') return 'log-line';
    if (['auto_consume_hp','auto_consume_mp'].includes(eventType)) return 'log-line';
    if (['monster_attack_hit','counter_triggered'].includes(eventType)) return 'log-line player-hit';
    if (eventType === 'player_died') return 'log-line died';
    if (eventType === 'monster_died') return 'log-line died';
    if (eventType === 'player_normal_attack_miss' || eventType === 'monster_attack_miss') return 'log-line miss';
    if (eventType === 'buff_applied') return 'log-line buff-on';
    return 'log-line';
  }

  // ========================
  // 掉落日志（7种事件）
  // ========================
  addRewardLog(eventType, data) {
    const templates = {
      monster_kill_reward: `击杀 <span class="target">${data.monster_name}</span> → <span class="exp-amt">+${data.exp} EXP</span> / <span class="gold-amt">+${data.gold} 金币</span>`,
      equipment_dropped: `获得装备: ${data.equipment_name}`,
      stone_dropped: `获得石头: ${data.stone_base_name}`,
      box_dropped: `获得盒子: ${data.box_name}`,
      potion_dropped: `获得药剂: ${data.item_name} ×${data.count}`,
      level_up: `升级！Lv.${data.from_level} → Lv.${data.to_level}`,
      exp_loss_on_death: `死亡损失经验: -${data.loss}`,
    };
    const msg = templates[eventType] || `${eventType}: ${JSON.stringify(data)}`;
    let rowClass = 'reward-line';
    if (eventType === 'monster_kill_reward') rowClass = 'reward-line';
    else if (eventType === 'level_up') rowClass = 'reward-line level-up';
    else if (eventType === 'equipment_dropped') rowClass = 'reward-line equip';
    else if (eventType === 'stone_dropped') rowClass = 'reward-line stone';
    else if (eventType === 'box_dropped') rowClass = 'reward-line box';
    else if (eventType === 'exp_loss_on_death') rowClass = 'reward-line died';
    this._pushLog(this._rewardLog, 'combat-result-area', msg, rowClass);
  }

  _pushLog(buf, elId, msg, rowClass) {
    buf.push({ msg, cls: rowClass });
    if (buf.length > 200) buf.shift();
    const el = document.getElementById(elId);
    if (!el) return;
    // 保留最新 200 条，重新渲染
    const start = Math.max(0, buf.length - 100);
    el.innerHTML = buf.slice(start).map(e =>
      `<div class="${e.cls}">${e.msg}</div>`
    ).join('');
    // auto scroll
    const isCombat = elId === 'combat-log-area';
    const shouldScroll = isCombat ? this._combatAutoScroll : this._rewardAutoScroll;
    if (shouldScroll) {
      el.scrollTop = el.scrollHeight;
    }
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
