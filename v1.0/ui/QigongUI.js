/**
 * @file ui/QigongUI.js
 * @desc 气功页渲染。
 */

import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260926-save-compat-1';
import { pixelIcon } from './PixelIconUI.js?v=release-20260926-save-compat-1';

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
  const effective = Math.max(invested, q.effectiveLevel || 0);
  const max = q.max_level || 20;
  const isMax = invested >= max;
  const levelLabel = effective > invested ? `${invested}(+${effective - invested})/${max}` : `${invested}/${max}`;

  // 锁定态
  if (!q.unlocked) {
    return '<div class="skill-card qg-card locked">' +
      '<span class="skill-art qg-skill-art">' + pixelIcon('skills/qigong/' + q.key, 'qg-book-icon') + '</span>' +
      '<div class="qg-left"><div class="sc-head"><span class="sc-name">' + escapeHtml(q.name) + '</span>' +
      '<span class="qg-lock-cond">' + escapeHtml(q.lockText || '') + '</span></div>' +
      '<div class="sc-desc">' + escapeHtml(q.description || '') + '</div></div>' +
      '<button class="qg-add qg-locked-btn" disabled>未解锁</button>' +
      '</div>';
  }

  const canAdd = available > 0 && !isMax;
  return '<div class="skill-card qg-card' + (isMax ? ' learned' : '') + '">' +
    '<span class="skill-art qg-skill-art">' + pixelIcon('skills/qigong/' + q.key, 'qg-book-icon') + '</span>' +
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
      list.map(q => renderQigongCard(q, available)).join('') +
      '</div>';
  } else {
    html += '<div class="q-empty">暂无已解锁气功</div>';
  }

  html += '</div>';

  return html;
}
