/**
 * @file ui/CharacterUI.js
 * @desc 角色页：严格复用 ui_demo_role 的信息 / 气功 / 武功结构。
 */

import { renderQigongPanel } from './QigongUI.js?v=release-20260930-martial-prototype-1';
import { meetsMartialArtRequirements } from '../utils/martial_arts.js?v=release-20260926-save-compat-1';
import { pixelIcon } from './PixelIconUI.js?v=release-20260926-save-compat-1';

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

function getTransferCount(player) {
  return [player?.career, ...(Array.isArray(player?.career_history) ? player.career_history : [])]
    .reduce((maxTransfer, career) => {
      const match = String(career || '').match(/_transfer_(\d+)/);
      return Math.max(maxTransfer, match ? Number(match[1]) : 0);
    }, 0);
}

function renderTabBar(activeTab) {
  const tabs = [
    ['info', '信息'],
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
  const atkMin = player.atkMin || player.atk_min || 0;
  const atkMax = player.atkMax || player.atk_max || 0;
  const stats = [
    ['生命上限', formatNumber(player.maxHp)],
    ['内力上限', formatNumber(player.maxMp)],
    ['攻击力', `${formatNumber(atkMin)}–${formatNumber(atkMax)}`],
    ['防御力', player.def || 0],
    ['命中率', player.hit || 0],
    ['闪避率', player.missing || 0],
    ['暴击率', `${Math.round(Number(player.critR || 0) * 100)}%`],
    ['武功攻击力', player.matk || 0],
    ['武功防御力', player.mdef || 0],
  ];
  if (player.weaponSkillBonus) stats.push(['武功攻击加成', player.weaponSkillBonus]);
  if (player.weaponExtraDamage) stats.push(['追加伤害', player.weaponExtraDamage]);
  const faction = player.faction === 'positive' ? '正派' : player.faction === 'negative' ? '邪派' : '中立';
  const transferCount = getTransferCount(player);

  return `<div class="role-info">
    <div class="sec-panel role-basic-panel">
      <div class="panel-title">基础信息</div>
      <div class="role-info-facts">
        <div class="stat-line"><span class="sl-k">职业</span><span class="sl-v">${escapeHtml(getCareerName(player))}</span></div>
        <div class="stat-line"><span class="sl-k">派别</span><span class="sl-v">${faction}</span></div>
        <div class="stat-line"><span class="sl-k">转职次数</span><span class="sl-v">${transferCount} 转</span></div>
        <div class="stat-line"><span class="sl-k">历练点</span><span class="sl-v">${formatNumber(player.resources?.training)}</span></div>
      </div>
      <div class="role-exp-block">
        <div class="role-exp-head"><span>等级 · 经验</span><b>Lv.${player.level || 1} · ${formatNumber(player.exp)} / ${formatNumber(expToNext)}</b></div>
        <div class="gba-bar"><div class="gba-bar-fill fill-exp" style="width:${expPct}%"></div></div>
      </div>
      <div class="role-base-attrs">
        <div class="role-base-head">基础属性</div>
        <div class="role-base-grid">
          ${attrs.map(([label, value]) => `<div class="role-base-cell"><span>${label}</span><b>${formatNumber(value)}</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="sec-panel">
      <div class="panel-title">战斗属性</div>
      <div class="role-combat-grid">
        ${stats.map(([label, value]) => `<div class="role-combat-cell"><span>${label}</span><b>${typeof value === 'string' ? escapeHtml(value) : formatNumber(value)}</b></div>`).join('')}
      </div>
    </div>
    <div class="role-quote">江湖路远，少年仍在成长。</div>
  </div>`;
}

function renderMartialPanel(player) {
  const learned = new Set(player?.learned_martial_arts || []);
  const transferCount = getTransferCount(player);
  const martialArts = (window._martialArtsData || []).filter(ma => {
    const family = ma.requirement?.career_family;
    const faction = ma.requirement?.faction;
    return (!family || family === player.career_family)
      && (!faction || faction === player.faction);
  });
  const summary = `<div class="martial-summary"><span>当前历练 <b>${formatNumber(player.resources?.training)}</b></span><span>转职 <b>${transferCount}转</b></span></div>`;
  if (!martialArts.length) return `<div class="martial-page">${summary}<div class="q-empty"><div class="qe-ico">📜</div><div class="qe-title">暂无职业武功</div></div></div>`;

  return `<div class="martial-page">${summary}<div class="skill-grid martial-grid">${martialArts.map(ma => {
    const req = ma.requirement || {};
    const isLearned = learned.has(ma.key);
    const meetsLevel = (player.level || 1) >= (req.level || 1);
    const meetsTransfer = transferCount >= (req.min_transfer || 0);
    const meetsRequirements = meetsMartialArtRequirements(player, ma);
    const cost = ma.learning_cost?.training || 0;
    const affordable = (player.resources?.training || 0) >= cost;
    const canLearn = !isLearned && meetsRequirements && affordable;
    const state = isLearned && meetsRequirements ? 'learned' : canLearn ? 'learnable' : meetsRequirements ? 'poor' : 'locked';
    const badge = isLearned
      ? (meetsRequirements ? '已学习' : '条件不足')
      : canLearn ? '可学习' : meetsRequirements ? '历练不足' : '未解锁';
    const missingConditions = [];
    if (!meetsLevel) missingConditions.push(`Lv.${req.level}`);
    if (!meetsTransfer) missingConditions.push(`${req.min_transfer}转`);
    const lockText = missingConditions.length ? `需要 ${missingConditions.join(' · ')}` : '';
    const canCast = isLearned && meetsRequirements && (ma.type === 'heal' || ma.type === 'buff');
    const hint = isLearned && meetsRequirements && !canCast ? '✓ 已掌握' : lockText || (state === 'poor' ? '历练不足' : '');
    return `<div class="skill-card ${state}">
      <div class="skill-card-head">
        <span class="skill-art">${pixelIcon('skills/martial/' + ma.key, 'martial-icon')}</span>
        <div class="skill-card-copy"><div class="skill-name">${escapeHtml(ma.name)}</div><div class="skill-desc">${ma.type === 'heal' ? '治疗武功' : ma.type === 'buff' ? '辅助武功' : ma.target === 'aoe' ? '群体伤害武功' : '单体伤害武功'}</div></div>
        <span class="badge ${state}">${badge}</span>
      </div>
      <div class="ma-meta">
        <span class="mm">威力 <b>${ma.effect?.value ?? 0}</b></span>
        <span class="mm">内功 <b>${ma.cost?.mp ?? 0}</b></span>
        <span class="mm">历练 <b>${formatNumber(cost)}</b></span>
        <span class="mm">冷却 <b>${(ma.coolDown || 0) / 1000}s</b></span>
      </div>
      <div class="ma-foot"><div class="ma-status-note ${state}">${escapeHtml(hint)}</div><div class="ma-action">${isLearned
        ? (canCast
          ? `<button class="btn-3d green ma-learn" onclick="window._castMartialArt('${ma.key}')">施放武功</button>`
          : (meetsRequirements ? '' : '<div class="ma-learned-note">当前不可使用</div>'))
        : `<button class="btn-3d green ma-learn" onclick="window._requestLearnMartial('${ma.key}')" ${canLearn ? '' : 'disabled'}>学习武功</button>`}</div></div>
    </div>`;
  }).join('')}</div></div>`;
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
