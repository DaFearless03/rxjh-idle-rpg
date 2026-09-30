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
  const number = Math.max(0, Number(value) || 0);
  if (number < 1000) return String(Math.floor(number));
  if (number < 10000) return `${(number / 1000).toFixed(1)}K`;
  if (number < 1000000) return `${Math.round(number / 1000)}K`;
  if (number < 1000000000) return `${(number / 1000000).toFixed(1)}M`;
  return `${(number / 1000000000).toFixed(1)}B`;
}

export function formatCharacterStatus(current, max) {
  const safe = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  current = safe(current);
  max = safe(max);
  const largest = Math.max(current, max);
  const unit = largest >= 100000000 ? 100000000 : largest >= 10000 ? 10000 : 1;
  const suffix = unit === 100000000 ? '亿' : unit === 10000 ? '万' : '';
  const format = (value, upper) => {
    // Opposite rounding bounds keep an almost-full value visibly below its limit.
    const scaled = value / unit * 100;
    const rounded = (upper ? Math.ceil(scaled) : Math.floor(scaled)) / 100;
    return unit === 1 ? rounded.toLocaleString('en-US', { maximumFractionDigits: 2 }) : `${rounded}${suffix}`;
  };
  return `${format(current, current === max)} / ${format(max, true)}`;
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

  const percent = (current, max) => prefix === 'char' && max > 0 && Number.isFinite(current / max)
    ? Math.max(0, Math.min(current < max ? 99.99 : 100, current / max * 100))
    : getPercent(current, max);
  const pair = (current, max) => prefix === 'char' ? formatCharacterStatus(current, max) : `${formatNumber(current)}/${formatNumber(max)}`;
  const detail = (stat, label, current, max) => {
    if (prefix !== 'char') return;
    const track = document.getElementById(`char-${stat}-track`);
    if (!track) return;
    const exact = stat === 'exp' && currentLevelCap && player.level >= currentLevelCap
      ? `经验值：已达等级上限（Lv.${player.level}）`
      : `${label}：${Math.max(0, Number(current) || 0).toLocaleString('en-US')} / ${Math.max(0, Number(max) || 0).toLocaleString('en-US')}`;
    track.title = exact;
    track.dataset.exactValue = exact;
    track.setAttribute('aria-label', `${exact}，点击查看精确数值`);
  };
  const hpPct = percent(player.hp, player.maxHp);
  const hpState = hpPct <= 18 ? ' danger' : hpPct <= 36 ? ' warn' : '';
  setBar(prefix, 'hp', hpPct, pair(player.hp, player.maxHp), hpState);
  detail('hp', '生命值', player.hp, player.maxHp);

  const mpPct = percent(player.mp, player.maxMp);
  setBar(prefix, 'mp', mpPct, pair(player.mp, player.maxMp));
  detail('mp', '内功值', player.mp, player.maxMp);

  const expToNext = expToNextTable?.[player.level] || 0;
  if (currentLevelCap && player.level >= currentLevelCap) {
    setBar(prefix, 'exp', 100, '满级 MAX');
  } else {
    const expPct = expToNext > 0 ? percent(player.exp, expToNext) : 0;
    setBar(prefix, 'exp', expPct, pair(player.exp, expToNext));
  }
  detail('exp', '经验值', player.exp, expToNext);
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

export function refreshPlayerAvatar(player, options = {}) {
  if (!player) return;
  const { prefix = 'home' } = options;
  const avatar = document.getElementById(`${prefix}-avatar`);
  if (!avatar) return;
  const career = window._careersData?.find(item => item.key === player.career);
  const family = career?.career_family
    || ['blade', 'sword', 'spear', 'staff'].find(key => String(player.career || '').includes(key));
  const avatarByFamily = {
    blade: 'icons/avatar_blade.png',
    sword: 'icons/avatar_sword.png',
    spear: 'icons/avatar_spear.png?v=release-20260621-2',
    staff: 'icons/avatar_staff.png?v=release-20260621-1',
  };
  const avatarPath = avatarByFamily[family];
  avatar.style.backgroundImage = avatarPath ? `url("${avatarPath}")` : '';
  avatar.classList.toggle('empty', !avatarPath);
}
