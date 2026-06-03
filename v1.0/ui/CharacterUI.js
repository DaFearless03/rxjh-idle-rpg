/**
 * @file ui/CharacterUI.js
 * @desc 角色页 demo 风格 Tab：角色信息 / 气功 / 武功占位。
 */

import { renderQigongPanel } from './QigongUI.js';

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
    ['力', player.str || 0],
    ['心', player.int || 0],
    ['体', player.sta || 0],
    ['身', player.dex || 0],
  ];
  const stats = [
    ['生命', player.maxHp || 0],
    ['内功', player.maxMp || 0],
    ['攻击', `${player.atkMin || player.atk_min || 0}-${player.atkMax || player.atk_max || 0}`],
    ['防御', player.def || 0],
    ['命中', player.hit || 0],
    ['回避', player.missing || 0],
    ['暴击', `${Math.round((player.critR || 0) * 100)}%`],
    ['吸血', `${Math.round((player.leech || 0) * 100)}%`],
  ];

  return `<div class="role-info">
    <div class="sec-panel role-hero-card">
      <div>
        <div class="role-name">${escapeHtml(player.name || '—')}</div>
        <div class="role-meta">${escapeHtml(player.career || '—')} · Lv.${player.level || 1} · ${player.faction === 'negative' ? '邪派' : player.faction === 'positive' ? '正派' : '中立'}</div>
      </div>
      <div class="role-exp-box">
        <span>经验</span>
        <div class="qg-mini-bar"><div class="qg-mini-fill" style="width:${expPct}%"></div></div>
        <b>${formatNumber(player.exp)}/${formatNumber(expToNext)}</b>
      </div>
    </div>
    <div class="sec-panel">
      <div class="sec-title">四维</div>
      <div class="attr-grid">
        ${attrs.map(([label, value]) => `<div class="attr-cell"><span>${label}</span><b>${value}</b></div>`).join('')}
      </div>
    </div>
    <div class="sec-panel">
      <div class="sec-title">战斗属性</div>
      <div class="role-stat-list">
        ${stats.map(([label, value]) => `<div class="stat-line"><span>${label}</span><b>${value}</b></div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderMartialPanel(player) {
  const learned = player?.learned_martial_arts || [];
  return `<div class="sec-panel">
    <div class="sec-title">武功</div>
    ${learned.length > 0 ? learned.map(key => `<div class="skill-card learned"><div class="skill-name">${escapeHtml(key)}</div><div class="skill-desc">已学习</div></div>`).join('') : '<div class="q-empty">武功学习 UI 将在后续批次接入</div>'}
  </div>`;
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
