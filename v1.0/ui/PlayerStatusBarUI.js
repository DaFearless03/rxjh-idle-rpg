/**
 * @file ui/PlayerStatusBarUI.js
 * @desc 玩家 HP/MP/EXP 状态条渲染。用于主页与战斗页的 demo 风格状态栏。
 */

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPercent(current, max) {
  return max > 0 ? clampPercent((current / max) * 100) : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setBar(prefix, stat, pct, text, extraClass = '') {
  const fill = document.getElementById(`${prefix}-${stat}-fill`);
  const pctEl = document.getElementById(`${prefix}-${stat}-pct`);
  const textEl = document.getElementById(`${prefix}-${stat}-text`);
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.className = `gba-bar-fill fill-${stat}${extraClass}`;
  }
  if (pctEl) pctEl.textContent = pct === 100 && text === '满级 MAX' ? 'MAX' : `${pct}%`;
  if (textEl) textEl.textContent = text;
}

export function refreshPlayerStatusBar(player, options = {}) {
  if (!player) return;

  const {
    prefix = 'role',
    expToNextTable = window.expToNext,
    currentLevelCap = window.currentLevelCap,
  } = options;

  const hpPct = getPercent(player.hp, player.maxHp);
  const hpState = hpPct <= 18 ? ' danger' : hpPct <= 36 ? ' warn' : '';
  setBar(prefix, 'hp', hpPct, `${formatNumber(player.hp)}/${formatNumber(player.maxHp)}`, hpState);

  const mpPct = getPercent(player.mp, player.maxMp);
  setBar(prefix, 'mp', mpPct, `${formatNumber(player.mp)}/${formatNumber(player.maxMp)}`);

  const expToNext = expToNextTable?.[player.level] || 0;
  if (currentLevelCap && player.level >= currentLevelCap) {
    setBar(prefix, 'exp', 100, '满级 MAX');
  } else {
    const expPct = expToNext > 0 ? getPercent(player.exp, expToNext) : 0;
    setBar(prefix, 'exp', expPct, `${formatNumber(player.exp)}/${formatNumber(expToNext)}`);
  }
}

export function refreshPlayerIdentity(player, options = {}) {
  if (!player) return;
  const { prefix = 'combat' } = options;
  setText(`${prefix}-name`, player.name || '—');
  setText(`${prefix}-level`, `Lv.${player.level || 1}`);
  const careerName = window._careersData?.find(career => career.key === player.career)?.name || player.career || '—';
  setText(`${prefix}-class`, careerName);

  const factionEl = document.getElementById(`${prefix}-faction`);
  if (factionEl) {
    const faction = player.faction === 'negative' ? '邪派' : player.faction === 'positive' ? '正派' : '中立';
    factionEl.textContent = faction;
    factionEl.className = `faction ${player.faction || 'neutral'}`;
  }
}
