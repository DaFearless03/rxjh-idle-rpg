/**
 * @file ui/QigongUI.js
 * @desc 气功页渲染。
 */

import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260926-save-compat-1';

const QIGONG_BOOK_PALETTES = [
  { name: 'blue', cover: '#4779b7', shadow: '#294b7c', accent: '#d7bd72' },
  { name: 'green', cover: '#54834d', shadow: '#315633', accent: '#d7bd72' },
  { name: 'red', cover: '#ad5549', shadow: '#713832', accent: '#e0c27b' },
  { name: 'violet', cover: '#765eaa', shadow: '#4d3b73', accent: '#e0c27b' },
];

function renderQigongBookIcon(q, index) {
  const palette = q.unlocked ? QIGONG_BOOK_PALETTES[index % QIGONG_BOOK_PALETTES.length] : {
    name: 'locked', cover: '#77777a', shadow: '#4c4c51', accent: '#d5d2ca',
  };
  const sigils = [
    '<path d="M30 22h4v3h3v4h-3v3h-4v-3h-3v-4h3z"/><path d="M31 19h2v2h-2zM31 33h2v2h-2z"/>',
    '<path d="M29 24h7v2h-3v3h3v2h-7v-2h3v-3h-3z"/><path d="M26 22h2v10h-2z"/>',
    '<path d="M29 20h5v3h-5zM27 24h9v6h-9zM29 31h5v3h-5z"/>',
    '<path d="M30 21h4v3h2v7h-2v3h-4v-3h-2v-7h2z"/>',
  ];
  const emblem = q.unlocked
    ? `<g fill="${palette.accent}">${sigils[index % sigils.length]}</g>`
    : '<path d="M27 27v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#eeeae0" stroke-width="3"/><rect x="25" y="27" width="14" height="11" fill="#eeeae0"/><rect x="31" y="30" width="2" height="5" fill="#4c4c51"/>';

  return `<svg class="qg-book-icon" data-qg-icon="book-${palette.name}" viewBox="0 0 64 64" width="46" height="46" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
    <path d="M16 10 22 5 52 10 48 51 42 58 12 53z" fill="${palette.shadow}"/>
    <path d="M19 11 50 15 46 50 17 46z" fill="#f1ead9"/>
    <path d="M18 12 48 15 44 48 15 45z" fill="#c9c2b0"/>
    <path d="M15 8 23 5 51 10 46 48 14 44z" fill="${palette.cover}"/>
    <path d="M15 8 23 5 19 43 14 44z" fill="${palette.shadow}"/>
    <path d="M23 9 47 13 43 43 19 40z" fill="none" stroke="${palette.accent}" stroke-width="2"/>
    <path d="M24 15 42 18 40 37 22 35z" fill="${palette.shadow}"/>
    <path d="M26 17 40 19 38 35 24 33z" fill="${palette.cover}"/>
    <path d="M25 18 39 20M24 33 38 36" fill="none" stroke="${palette.accent}" stroke-width="2"/>
    ${emblem}
    <path d="M15 45 44 49l4-3-4 8-31-5z" fill="#eee9dc"/>
    <path d="M13 49 44 54l4-4-5 8-31-5z" fill="${palette.shadow}"/>
    <path d="M17 47 43 51M16 50 42 55" fill="none" stroke="#b8b2a5" stroke-width="1"/>
  </svg>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getResetCost(player) {
  const count = player?.qigong?.attribute_reset_count || 0;
  return Math.floor(10000 * Math.pow(10, count));
}

function renderQigongCard(q, available, index) {
  const invested = q.invested || 0;
  const effective = Math.max(invested, q.effectiveLevel || 0);
  const max = q.max_level || 20;
  const isMax = invested >= max;
  const levelLabel = effective > invested ? `${invested}(+${effective - invested})/${max}` : `${invested}/${max}`;

  // 锁定态
  if (!q.unlocked) {
    return '<div class="skill-card qg-card locked">' +
      '<span class="skill-art qg-skill-art">' + renderQigongBookIcon(q, index) + '</span>' +
      '<div class="qg-left"><div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span>' +
      '<span class="qg-lock-cond">' + escapeHtml(q.lockText || '') + '</span></div>' +
      '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div></div>' +
      '<button class="qg-add qg-locked-btn" disabled>未解锁</button>' +
      '</div>';
  }

  const canAdd = available > 0 && !isMax;
  return '<div class="skill-card qg-card' + (isMax ? ' learned' : '') + '">' +
    '<span class="skill-art qg-skill-art">' + renderQigongBookIcon(q, index) + '</span>' +
    '<div class="qg-left">' +
    '<div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span>' +
    '<span class="qg-lv">Lv.' + levelLabel + '</span></div>' +
    '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div>' +
    '</div>' +
    '<button class="btn-3d green qg-add" onclick="window._investQigong(\'' + q.key + '\', 1)"' +
    (canAdd ? '' : ' disabled') + '>＋加点</button>' +
    '</div>';
}

export function renderQigongPanel(player) {
  if (!player) return '<div class="q-empty">暂无角色数据</div>';
  const available = QigongSystem.getAvailablePoints(player);
  const list = QigongSystem.listAllCareerQigongs(player);
  const resetCost = getResetCost(player);

  let html = '<div class="qigong-page">' +
    '<div class="qg-bar-top"><span class="qg-points-label">剩余气功点 <b>' + available + '</b></span>' +
    '<button class="btn-3d qg-reset-btn" onclick="window._requestResetQigong()" aria-label="重置气功，消耗 ' + resetCost.toLocaleString() + ' 金币">重置气功</button></div>';

  if (list.length > 0) {
    html += '<div class="skill-grid">' +
      list.map((q, index) => renderQigongCard(q, available, index)).join('') +
      '</div>';
  } else {
    html += '<div class="q-empty">暂无已解锁气功</div>';
  }

  html += '</div>';

  return html;
}
