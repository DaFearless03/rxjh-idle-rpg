/**
 * @file ui/MonsterListUI.js
 * @desc 战斗区怪物列表渲染：最多 8 只，保留生成顺序，展示精英/预热/死亡状态。
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isMonsterAlive(monster) {
  if (typeof monster?.isAlive === 'function') return monster.isAlive();
  return (monster?.hp || 0) > 0;
}

function getMonsterIcon(monster) {
  if ((monster?.preheatRemaining || 0) > 0) return '…';
  const key = String(monster?.key || '');
  const name = String(monster?.name || '');
  if (monster?.monster_type === 'boss') return '♛';
  if (monster?.monster_type === 'elite') return '⚔';
  if (/cat|猫/.test(key + name)) return '🐱';
  if (/toad|蛤蟆/.test(key + name)) return '🐸';
  if (/fox|狐狸/.test(key + name)) return '🦊';
  if (/bull|牛/.test(key + name)) return '🐂';
  if (/boar|猪/.test(key + name)) return '🐗';
  if (/wolf|狼/.test(key + name)) return '🐺';
  if (/bear|熊/.test(key + name)) return '🐻';
  if (/tiger|虎/.test(key + name)) return '🐯';
  if (/snake|蛇/.test(key + name)) return '🐍';
  if (/spirit|ghost|魂|灵|怨/.test(key + name)) return '👻';
  if (/bandit|thief|pirate|raider|deserter|hunter|贼|盗|匪|寇|兵|猎人/.test(key + name)) return '🗡';
  if (/guard|disciple|swordsman|master|elder|护卫|弟子|剑士|掌门|长老/.test(key + name)) return '⚔';
  return '👹';
}

function renderMonsterCell(monster) {
  const maxHp = monster.maxHp || 0;
  const hp = Math.max(0, monster.hp || 0);
  const pct = maxHp > 0 ? clampPercent((hp / maxHp) * 100) : 0;
  const hpClass = pct <= 18 ? ' fill-hp danger' : pct <= 36 ? ' fill-hp warn' : ' fill-hp';
  const isElite = monster.monster_type === 'elite';
  const preheatRemaining = Math.max(0, monster.preheatRemaining || 0);
  const isPreheating = preheatRemaining > 0;
  const alive = isMonsterAlive(monster);
  const classes = [
    'monster-cell',
    isElite ? 'elite' : '',
    isPreheating ? 'preheating' : '',
    alive ? '' : 'dead',
  ].filter(Boolean).join(' ');

  const preheatTag = isPreheating
    ? `<span class="preheat-tag">预热 ${(preheatRemaining / 1000).toFixed(1)}s</span>`
    : '';
  const eliteStar = isElite ? '<span class="elite-star">★</span>' : '';

  return `<div class="${classes}">
    <span class="icon-big">${getMonsterIcon(monster)}</span>
    <div class="body">
      <div class="name-row">
        <span class="name">${eliteStar}${escapeHtml(monster.name || '未知怪物')}${preheatTag}</span>
        <span class="num">${hp}/${maxHp}</span>
      </div>
      <div class="gba-bar"><div class="gba-bar-fill${hpClass}" style="width:${pct}%"></div></div>
    </div>
  </div>`;
}

export function refreshMonsterList(battle, options = {}) {
  const {
    containerId = 'monster-grid',
    countId = 'monster-count',
  } = options;
  const el = document.getElementById(containerId);
  if (!el) return;

  const monsters = (battle?.monsters || []).slice(0, 8);
  const countEl = document.getElementById(countId);
  if (countEl) countEl.textContent = `${monsters.length}/${battle?.maxMonsters || 8}`;

  if (monsters.length === 0) {
    el.innerHTML = '<div class="monster-empty">当前区域暂无敌人</div>';
    return;
  }

  el.innerHTML = monsters.map(renderMonsterCell).join('');
}
