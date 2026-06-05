/**
 * @file ui/CombatLogUI.js
 * @desc 战斗日志格式化与渲染。日志只保留在内存中，最大 200 条。
 */

const MAX_LOG_LINES = 200;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFallback(eventType, data) {
  return `${escapeHtml(eventType)}: ${escapeHtml(JSON.stringify(data || {}))}`;
}

export function formatCombatLog(eventType, data = {}) {
  const target = escapeHtml(data.target);
  const attacker = escapeHtml(data.attacker);
  const item = escapeHtml(data.item_name || data.item);
  const recovered = data.recovered ?? data.recovery ?? 0;
  const skillName = escapeHtml(data.skill_name);
  const monsterName = escapeHtml(data.monster_name);
  const buffName = escapeHtml(data.buff_name || data.name || data.buffKey);
  const buffDuration = data.duration === -1 ? '' : `（${escapeHtml(data.duration || 0)}s）`;

  const templates = {
    player_normal_attack_hit: `你 → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)}${escapeHtml(data.crit_suffix || '')}</span>`,
    player_normal_attack_miss: `你 → <span class="target">${target}</span>: <span class="damage">未命中</span>`,
    player_skill_release: `你 释放 <span class="skill-name">${skillName}</span> → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)}${escapeHtml(data.skill_crit_suffix || '')}</span>`,
    player_skill_aoe_sub: `<span class="sub-target">↳ → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)}</span></span>`,
    monster_attack_hit: `<span class="target">${attacker}</span> → 你: <span class="damage">${escapeHtml(data.damage)}${escapeHtml(data.shield_suffix || '')}</span>`,
    monster_attack_miss: `<span class="target">${attacker}</span> → 你: <span class="damage">未命中</span>`,
    combo_triggered: `你 → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damages_joined || data.damage)} (连击!)</span>`,
    leech_triggered: `你 → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)}</span> (汲取 <span class="heal-num">+${escapeHtml(data.heal)} HP</span>)`,
    counter_triggered: `<span class="target">${attacker}</span> → 你: <span class="damage">${escapeHtml(data.damage)}</span> → 反伤 ${escapeHtml(data.reflected)} (<span class="target">${attacker}</span> -${escapeHtml(data.reflected)})`,
    armor_break_triggered: `你 → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)} (破甲!)</span>`,
    armorBreak_triggered: `你 → <span class="target">${target}</span>: <span class="damage">${escapeHtml(data.damage)} (破甲!)</span>`,
    auto_consume_hp: `自动喝药: ${item} <span class="heal-num">+${escapeHtml(recovered)} HP</span>`,
    auto_consume_mp: `自动喝药: ${item} <span class="heal-num">+${escapeHtml(recovered)} MP</span>`,
    buff_applied: `获得 Buff: ${buffName}${buffDuration}`,
    buff_expired: `Buff 消失: ${buffName}`,
    monster_died: `✗ ${monsterName} 已倒下`,
    player_died: '✗ 你 已倒下',
  };

  return {
    msg: templates[eventType] || formatFallback(eventType, data),
    cls: getCombatLogClass(eventType, data),
  };
}

export function getCombatLogClass(eventType, data = {}) {
  if (eventType === 'player_normal_attack_hit' && data.crit_suffix) return 'log-line crit';
  if (['leech_triggered', 'auto_consume_hp', 'auto_consume_mp'].includes(eventType)) return 'log-line heal';
  if ([
    'player_normal_attack_hit',
    'player_skill_release',
    'combo_triggered',
    'leech_triggered',
    'armor_break_triggered',
    'armorBreak_triggered',
    'player_skill_aoe_sub',
  ].includes(eventType)) return 'log-line';
  if (['monster_attack_hit', 'counter_triggered'].includes(eventType)) return 'log-line player-hit';
  if (['player_died', 'monster_died'].includes(eventType)) return 'log-line died';
  if (['player_normal_attack_miss', 'monster_attack_miss'].includes(eventType)) return 'log-line miss';
  if (eventType === 'buff_applied') return 'log-line buff-on';
  return 'log-line';
}

export function appendCombatLog(buffer, entry) {
  buffer.push(entry);
  while (buffer.length > MAX_LOG_LINES) buffer.shift();
}

export function renderCombatLog(buffer, elId = 'combat-log-area', shouldScroll = true) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = buffer.map(e => `<div class="${e.cls}">${e.msg}</div>`).join('');
  if (shouldScroll) el.scrollTop = el.scrollHeight;
}
