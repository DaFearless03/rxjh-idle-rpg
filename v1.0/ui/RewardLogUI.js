/**
 * @file ui/RewardLogUI.js
 * @desc 掉落/收益日志格式化与渲染。日志只保留在内存中，最大 200 条。
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

export function formatRewardLog(eventType, data = {}) {
  const templates = {
    monster_kill_reward: `击杀 <span class="target">${escapeHtml(data.monster_name)}</span> → <span class="exp-amt">+${escapeHtml(data.exp)} EXP</span> / <span class="gold-amt">+${escapeHtml(data.gold)} 金币</span>`,
    equipment_dropped: `获得装备: ${escapeHtml(data.equipment_name)}`,
    stone_dropped: `获得石头: ${escapeHtml(data.stone_base_name)}`,
    box_dropped: `获得盒子: ${escapeHtml(data.box_name)}`,
    potion_dropped: `获得药剂: ${escapeHtml(data.item_name)} ×${escapeHtml(data.count)}`,
    level_up: `升级！Lv.${escapeHtml(data.from_level)} → Lv.${escapeHtml(data.to_level)}`,
    exp_loss_on_death: `死亡损失经验: -${escapeHtml(data.loss)}`,
  };

  return {
    msg: templates[eventType] || formatFallback(eventType, data),
    cls: getRewardLogClass(eventType),
  };
}

export function getRewardLogClass(eventType) {
  if (eventType === 'level_up') return 'reward-line level-up';
  if (eventType === 'equipment_dropped') return 'reward-line equip';
  if (eventType === 'stone_dropped') return 'reward-line stone';
  if (eventType === 'box_dropped') return 'reward-line box';
  if (eventType === 'exp_loss_on_death') return 'reward-line died';
  return 'reward-line';
}

export function appendRewardLog(buffer, entry) {
  buffer.push(entry);
  while (buffer.length > MAX_LOG_LINES) buffer.shift();
}

export function renderRewardLog(buffer, elId = 'combat-result-area', shouldScroll = true) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = buffer.map(e => `<div class="${e.cls}">${e.msg}</div>`).join('');
  if (shouldScroll) el.scrollTop = el.scrollHeight;
}
