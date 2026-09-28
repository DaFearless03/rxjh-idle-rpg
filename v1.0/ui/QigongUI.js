/**
 * @file ui/QigongUI.js
 * @desc 气功页渲染：严格复用 ui_demo_role 的气功卡结构。
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
    name: 'locked', cover: '#77777a', shadow: '#4c4c51', accent: '#e4e0d3',
  };
  const lock = q.unlocked ? '' : '<path d="M27 25v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#e4e0d3" stroke-width="3"/><rect x="25" y="25" width="14" height="11" fill="#e4e0d3"/><rect x="31" y="28" width="2" height="4" fill="#4c4c51"/>';

  return `<svg class="qg-book-icon" data-qg-icon="book-${palette.name}" viewBox="0 0 64 64" width="20" height="20" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
    <path d="M11 14 18 9l35 11v28l-7 6-35-11z" fill="${palette.shadow}"/>
    <path d="M14 12 20 9l31 10v27l-6 5-31-10z" fill="#e9e4d6"/>
    <path d="M11 10 18 7l31 10v28l-7 4-31-10z" fill="${palette.cover}"/>
    <path d="M11 10 18 7v28l-7 4z" fill="${palette.shadow}"/>
    <path d="M21 16 42 23v16l-21-7z" fill="${palette.shadow}"/>
    <path d="M23 17 40 23v13l-17-6z" fill="${palette.cover}"/>
    ${q.unlocked ? `<path d="M29 21 33 22l4 5-4 2-4-5z" fill="${palette.accent}"/><path d="M32 22v4" stroke="${palette.accent}" stroke-width="2"/>` : lock}
    <path d="M13 39 43 49v-4L13 35z" fill="#f4efdf"/>
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
  const pct = max > 0 ? Math.min(100, Math.round((effective / max) * 100)) : 0;
  const isMax = invested >= max;
  const levelLabel = effective > invested ? `${invested}(+${effective - invested})/${max}` : `${invested}/${max}`;

  // 锁定态
  if (!q.unlocked) {
    return '<div class="skill-card locked">' +
      '<div class="sc-head"><span class="skill-art">' + renderQigongBookIcon(q, index) + '</span><span class="sc-name">' + escapeHtml(q.name) + '</span>' +
      '<span class="badge locked">未解锁</span></div>' +
      '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div>' +
      '<div class="qg-lock-cond">🔒 ' + escapeHtml(q.lockText || '') + '</div>' +
      '</div>';
  }

  const canAdd = available > 0 && !isMax;
  return '<div class="skill-card qg-card' + (isMax ? ' learned' : '') + '">' +
    '<span class="skill-art">' + renderQigongBookIcon(q, index) + '</span>' +
    '<div class="qg-left">' +
    '<div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span></div>' +
    '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div>' +
    '<div class="qg-pts-row">' +
    '<div class="qg-mini-bar"><div class="qg-mini-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="qg-lv">' + levelLabel + '</span>' +
    '</div>' +
    '</div>' +
    '<button class="btn-3d green qg-add" onclick="window._investQigong(\'' + q.key + '\', 1)"' +
    (canAdd ? '' : ' disabled') + '>＋投点</button>' +
    '</div>';
}

export function renderQigongPanel(player) {
  if (!player) return '<div class="q-empty">暂无角色数据</div>';
  const available = QigongSystem.getAvailablePoints(player);
  const list = QigongSystem.listAllCareerQigongs(player);
  const resetCost = getResetCost(player);

  let html = '<div class="qigong-page">' +
    '<div class="qg-bar-top"><span>可用气功点</span><b>' + available + '</b></div>';

  if (list.length > 0) {
    html += '<div class="skill-grid">' +
      list.map((q, index) => renderQigongCard(q, available, index)).join('') +
      '</div>';
  } else {
    html += '<div class="q-empty">暂无已解锁气功</div>';
  }

  html += '<button class="btn-3d red qg-reset-btn" onclick="window._requestResetQigong()">' +
    '重置气功（' + resetCost.toLocaleString() + ' 金币）</button>' +
    '</div>';

  return html;
}
