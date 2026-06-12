/**
 * @file ui/QigongUI.js
 * @desc 气功页渲染：严格复用 ui_demo_role 的气功卡结构。
 */

import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260612-2';

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

function renderQigongCard(q, available) {
  const invested = q.invested || 0;
  const max = q.max_level || 20;
  const pct = max > 0 ? Math.min(100, Math.round((invested / max) * 100)) : 0;
  const isMax = invested >= max;

  // 锁定态
  if (!q.unlocked) {
    return '<div class="skill-card locked">' +
      '<div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span>' +
      '<span class="badge locked">未解锁</span></div>' +
      '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div>' +
      '<div class="qg-lock-cond">🔒 ' + escapeHtml(q.lockText || '') + '</div>' +
      '</div>';
  }

  const canAdd = available > 0 && !isMax;
  return '<div class="skill-card qg-card' + (isMax ? ' learned' : '') + '">' +
    '<div class="qg-left">' +
    '<div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span></div>' +
    '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div>' +
    '<div class="qg-pts-row">' +
    '<div class="qg-mini-bar"><div class="qg-mini-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="qg-lv">' + invested + '/' + max + '</span>' +
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
      list.map(q => renderQigongCard(q, available)).join('') +
      '</div>';
  } else {
    html += '<div class="q-empty">暂无已解锁气功</div>';
  }

  html += '<button class="btn-3d red qg-reset-btn" onclick="window._requestResetQigong()">' +
    '重置气功（' + resetCost.toLocaleString() + ' 金币）</button>' +
    '</div>';

  return html;
}
