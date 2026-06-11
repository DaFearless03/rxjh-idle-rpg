/**
 * @file ui/CharacterUI.js
 * @desc 角色页：严格复用 ui_demo_role 的信息 / 气功 / 武功结构。
 */

import { renderQigongPanel } from './QigongUI.js?v=release-20260611-2';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getCareerName(player) {
  return window._careersData?.find(career => career.key === player?.career)?.name || player?.career || '—';
}

function renderTabBar(activeTab) {
  const tabs = [
    ['info', '角色信息'],
    ['qigong', '气功'],
    ['martial', '武功'],
  ];
  return `<div class="tab-bar role-tab-bar">
    ${tabs.map(([key, label]) => `<button class="tab-btn${activeTab === key ? ' active' : ''}" onclick="window._switchCharTab('${key}')">${label}</button>`).join('')}
  </div>`;
}

function renderInfoPanel(player) {
  const expToNext = window.expToNext?.[player.level] || 0;
  const expPct = expToNext > 0 ? Math.min(100, Math.round((player.exp || 0) / expToNext * 100)) : 0;
  const attrs = [
    ['力', player.str || 0, '决定攻击力高低'],
    ['心', player.int || 0, '决定内功（MP）高低'],
    ['体', player.sta || 0, '决定生命值和防御力'],
    ['身', player.dex || 0, '决定命中率和闪避率'],
  ];
  const stats = [
    ['生命', player.maxHp || 0],
    ['内功', player.maxMp || 0],
    ['最小攻击力', player.atkMin || player.atk_min || 0],
    ['最大攻击力', player.atkMax || player.atk_max || 0],
    ['防御力', player.def || 0],
    ['武功攻击力', player.matk || 0],
    ['武功防御力', player.mdef || 0],
    ['命中', player.hit || 0],
    ['闪避', player.missing || 0],
  ];
  const faction = player.faction === 'positive' ? '正派' : player.faction === 'negative' ? '邪派' : '中立';
  const transferCount = Math.max(0, (player.career_history?.length || 1) - 1);

  return `<div class="role-info">
    <div class="sec-panel">
      <div class="panel-title"><span>📊 等级 · 经验</span><span class="count">Lv${player.level || 1}</span></div>
      <div class="exp-line">
        <div class="gba-bar"><div class="gba-bar-fill fill-exp" style="width:${expPct}%"></div><span class="gba-bar-pct">${expPct}%</span></div>
        <div class="exp-num">经验 ${formatNumber(player.exp)} / ${formatNumber(expToNext)}</div>
      </div>
      <div class="stat-line"><span class="sl-k">🎓 历练点</span><span class="sl-v train">${formatNumber(player.resources?.training)}</span></div>
    </div>
    <div class="attr-grid">
      ${attrs.map(([label, value, desc]) => `<div class="attr-cell"><div class="ac-name">${label}</div><div class="ac-val">${value}</div><div class="ac-desc">${desc}</div></div>`).join('')}
    </div>
    <div class="sec-panel">
      <div class="panel-title"><span>⚔ 面板属性</span></div>
      ${stats.map(([label, value]) => `<div class="stat-line"><span class="sl-k">${label}</span><span class="sl-v">${formatNumber(value)}</span></div>`).join('')}
    </div>
    <div class="sec-panel">
      <div class="panel-title"><span>📜 基础信息</span></div>
      <div class="stat-line"><span class="sl-k">职业</span><span class="sl-v">${escapeHtml(getCareerName(player))}</span></div>
      <div class="stat-line"><span class="sl-k">派别</span><span class="sl-v">${faction}</span></div>
      <div class="stat-line"><span class="sl-k">转职次数</span><span class="sl-v">${transferCount} 转</span></div>
    </div>
  </div>`;
}

function renderMartialPanel(player) {
  const learned = new Set(player?.learned_martial_arts || []);
  const transferCount = Math.max(0, (player.career_history?.length || 1) - 1);
  const martialArts = (window._martialArtsData || []).filter(ma => {
    const family = ma.requirement?.career_family;
    const faction = ma.requirement?.faction;
    return (!family || family === player.career_family)
      && (!faction || faction === player.faction);
  });
  if (!martialArts.length) return '<div class="q-empty"><div class="qe-ico">📜</div><div class="qe-title">暂无职业武功</div></div>';

  return `<div class="skill-grid martial-grid">${martialArts.map(ma => {
    const req = ma.requirement || {};
    const isLearned = learned.has(ma.key);
    const meetsLevel = (player.level || 1) >= (req.level || 1);
    const meetsTransfer = transferCount >= (req.min_transfer || 0);
    const cost = ma.learning_cost?.training || 0;
    const affordable = (player.resources?.training || 0) >= cost;
    const canLearn = !isLearned && meetsLevel && meetsTransfer && affordable;
    const state = isLearned ? 'learned' : canLearn ? 'learnable' : meetsLevel && meetsTransfer ? 'poor' : 'locked';
    const badge = isLearned ? '已学习' : canLearn ? '可学习' : meetsLevel && meetsTransfer ? '历练不足' : '未解锁';
    const lockText = !meetsLevel ? `需要 Lv.${req.level}` : !meetsTransfer ? `需要 ${req.min_transfer} 转` : '';
    return `<div class="skill-card ${state}">
      <div class="skill-card-head">
        <div><div class="skill-name">${escapeHtml(ma.name)}</div><div class="skill-desc">${ma.type === 'heal' ? '治疗武功' : ma.type === 'buff' ? '辅助武功' : ma.target === 'aoe' ? '群体伤害武功' : '单体伤害武功'}</div></div>
        <span class="badge ${state}">${badge}</span>
      </div>
      <div class="ma-meta">
        <span class="mm">威力 <b>${ma.effect?.value ?? 0}</b></span>
        <span class="mm">内功 <b>${ma.cost?.mp ?? 0}</b></span>
        <span class="mm">历练 <b>${formatNumber(cost)}</b></span>
        <span class="mm">冷却 <b>${(ma.coolDown || 0) / 1000}s</b></span>
      </div>
      ${lockText ? `<div class="ma-lock-cond">${lockText}</div>` : ''}
      <div class="ma-foot">${isLearned
        ? '<div class="ma-learned-note">✓ 已掌握</div>'
        : `<button class="btn-3d green ma-learn" onclick="window._requestLearnMartial('${ma.key}')" ${canLearn ? '' : 'disabled'}>学习武功</button>`}</div>
    </div>`;
  }).join('')}</div>`;
}

export function renderCharacterPanel(player, activeTab = 'info') {
  if (!player) return '<div class="q-empty">暂无角色数据</div>';
  const body = activeTab === 'qigong'
    ? renderQigongPanel(player)
    : activeTab === 'martial'
      ? renderMartialPanel(player)
      : renderInfoPanel(player);
  return `<div class="role-page">
    ${renderTabBar(activeTab)}
    <div class="tab-body role-tab-body">${body}</div>
  </div>`;
}

export function mountCharacterPanel(container, player, activeTab = 'info') {
  if (!container) return;
  container.innerHTML = renderCharacterPanel(player, activeTab);
}
