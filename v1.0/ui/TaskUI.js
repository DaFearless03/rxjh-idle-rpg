/**
 * @file ui/TaskUI.js
 * @desc 任务查看器：进行中 / 可接取 / 已完成三段。
 */

import { InventorySystem } from '../systems/InventorySystem.js';
import { TaskSystem } from '../systems/TaskSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAccepted(player) {
  return player?.quests?.accepted || [];
}

function getCompleted(player) {
  return player?.quests?.completed || [];
}

function getAvailable(player) {
  const acceptedKeys = new Set(getAccepted(player).map(q => q.key));
  const completedKeys = new Set(getCompleted(player));
  const templates = TaskSystem._questTemplates || [];
  return templates.filter(t => {
    if (!t?.key || acceptedKeys.has(t.key) || completedKeys.has(t.key)) return false;
    if (typeof TaskSystem._canAcceptQuest !== 'function') return true;
    return TaskSystem._canAcceptQuest(player, t).success;
  });
}

function renderTags(quest) {
  const tags = [];
  if (quest.required_transfer != null) tags.push(['transfer', `${quest.required_transfer}转`]);
  if (quest.prerequisite?.level != null) tags.push(['level', `Lv.${quest.prerequisite.level}`]);
  if (quest.faction) tags.push([quest.faction, quest.faction === 'negative' ? '邪派' : '正派']);
  if (quest.type) tags.push(['type', quest.type]);
  return `<div class="qc-tags">${tags.map(([cls, label]) => `<span class="${cls}">${escapeHtml(label)}</span>`).join('')}</div>`;
}

function getStageState(quest, stage) {
  if ((quest.completed_stages || []).includes(stage.stage)) return 'ok';
  if (stage.stage === quest.current_stage) return 'cur';
  return 'lock';
}

function renderObjectives(player, stageBlock) {
  const items = stageBlock?.items || [];
  if (items.length === 0) return '<div class="qc-obj">无收集目标</div>';
  return items.map(item => {
    const have = InventorySystem.count(player, item.item_key);
    const need = item.count || 1;
    const pct = Math.min(100, Math.round((have / need) * 100));
    const full = have >= need;
    return `<div class="qc-obj">
      <div class="qc-obj-line"><span>${escapeHtml(item.item_key)}</span><b>${have}/${need}</b></div>
      <div class="qc-bar${full ? ' full' : ''}"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function isQuestReady(player, quest) {
  const objectives = quest.objectives || [];
  if (objectives.length === 0) return false;
  return objectives.every(stage => (stage.items || []).every(item => InventorySystem.count(player, item.item_key) >= item.count));
}

function renderAcceptedQuest(player, quest) {
  const stageBlock = (quest.objectives || []).find(s => s.stage === quest.current_stage) || quest.objectives?.[0];
  const ready = isQuestReady(player, quest);
  return `<div class="quest-card">
    <div class="qc-head">
      <div>
        <div class="qc-name">${escapeHtml(quest.name || quest.key)}</div>
        <div class="qc-desc">${escapeHtml(quest.description || '')}</div>
      </div>
      <button class="qc-submit ${ready ? 'ready' : 'collecting'}" onclick="window._questSubmitHint(${ready ? 'true' : 'false'})">${ready ? '去提交' : '收集中'}</button>
    </div>
    <div class="qc-stages">
      ${(quest.objectives || []).map(stage => `<span class="${getStageState(quest, stage)}">阶段${stage.stage}</span>`).join('')}
    </div>
    ${renderObjectives(player, stageBlock)}
  </div>`;
}

function renderAvailableQuest(quest) {
  return `<div class="quest-card">
    <div class="qc-head">
      <div>
        <div class="qc-name">${escapeHtml(quest.name || quest.key)}</div>
        <div class="qc-desc">${escapeHtml(quest.description || '')}</div>
      </div>
      <button class="qc-submit collecting" onclick="window._questAcceptHint()">找门主</button>
    </div>
    ${renderTags(quest)}
    <div class="qc-reward">${(quest.rewards || []).map(r => escapeHtml(r.type || r)).join(' · ') || '无奖励预览'}</div>
  </div>`;
}

function renderCompletedQuest(key) {
  return `<div class="quest-card done">
    <div class="qc-head">
      <div>
        <div class="qc-name">${escapeHtml(key)}</div>
        <div class="qc-desc">已完成</div>
      </div>
      <span class="qc-done-badge">完成</span>
    </div>
  </div>`;
}

function renderSection(player, activeSeg) {
  const accepted = getAccepted(player);
  const available = getAvailable(player);
  const completed = getCompleted(player);
  if (activeSeg === 'available') {
    return available.length ? available.map(renderAvailableQuest).join('') : '<div class="q-empty">暂无可接取任务</div>';
  }
  if (activeSeg === 'completed') {
    return completed.length ? completed.map(renderCompletedQuest).join('') : '<div class="q-empty">暂无已完成任务</div>';
  }
  return accepted.length ? accepted.map(q => renderAcceptedQuest(player, q)).join('') : '<div class="q-empty">暂无进行中的任务</div>';
}

export function renderQuestPanel(player, activeSeg = 'accepted') {
  if (!player) return '<div class="q-empty">暂无角色数据</div>';
  const counts = {
    accepted: getAccepted(player).length,
    available: getAvailable(player).length,
    completed: getCompleted(player).length,
  };
  const segs = [
    ['accepted', '进行中'],
    ['available', '可接取'],
    ['completed', '已完成'],
  ];
  return `<div class="quest-page">
    <div class="seg">
      ${segs.map(([key, label]) => `<button class="seg-btn${activeSeg === key ? ' active' : ''}" onclick="window._switchQuestSeg('${key}')">${label}<span class="seg-ct">${counts[key]}</span></button>`).join('')}
    </div>
    <div class="quest-list">${renderSection(player, activeSeg)}</div>
  </div>`;
}

export function mountQuestPanel(container, player, activeSeg = 'accepted') {
  if (!container) return;
  container.innerHTML = renderQuestPanel(player, activeSeg);
}
