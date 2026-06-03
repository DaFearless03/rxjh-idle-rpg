/**
 * @file ui/QigongUI.js
 * @desc 气功页渲染：可用点数、气功卡、投点按钮。
 */

import { QigongSystem } from '../systems/QigongSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValue(value) {
  if (!Number.isFinite(Number(value))) return '0';
  const n = Number(value);
  return Math.abs(n) < 1 && n !== 0 ? n.toFixed(3) : n.toFixed(2).replace(/\.00$/, '');
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
  const canAdd = available > 0 && !isMax;
  return `<div class="skill-card qigong-card${isMax ? ' learned' : ''}">
    <div class="skill-card-head">
      <div>
        <div class="skill-name">${escapeHtml(q.name || q.key)}</div>
        <div class="skill-desc">${escapeHtml(q.description || q.effect_type || '')}</div>
      </div>
      <span class="skill-badge">${invested}/${max}</span>
    </div>
    <div class="qg-pts-row">
      <div class="qg-mini-bar"><div class="qg-mini-fill" style="width:${pct}%"></div></div>
      <span class="qg-value">${formatValue(q.currentValue)} → ${formatValue(q.nextValue)}</span>
    </div>
    <div class="skill-actions">
      <button class="btn-3d green" onclick="window._investQigong('${q.key}', 1)" ${canAdd ? '' : 'disabled'}>+1</button>
      <button class="btn-3d green" onclick="window._investQigong('${q.key}', 10)" ${available >= 10 && !isMax ? '' : 'disabled'}>+10</button>
    </div>
  </div>`;
}

export function renderQigongPanel(player) {
  if (!player) return '<div class="q-empty">暂无角色数据</div>';
  const available = QigongSystem.getAvailablePoints(player);
  const list = QigongSystem.listAvailableQigongs(player);
  const resetCost = getResetCost(player);

  return `<div class="qigong-page">
    <div class="sec-panel qg-summary">
      <div>
        <div class="sec-title">气功点数</div>
        <div class="qg-available">${available}</div>
      </div>
      <button class="btn-3d red" onclick="window._resetQigong()">重置 · ${resetCost.toLocaleString()} 金币</button>
    </div>
    <div class="skill-grid">
      ${list.length > 0 ? list.map(q => renderQigongCard(q, available)).join('') : '<div class="q-empty">暂无已解锁气功</div>'}
    </div>
  </div>`;
}
