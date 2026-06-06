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
  if (quest.target_transfer != null) tags.push(['transfer', `转职 · ${quest.target_transfer}转`]);
  if (quest.prerequisite?.level != null) tags.push(['level', `需 Lv${quest.prerequisite.level}`]);
  if (quest.faction) tags.push([quest.faction, quest.faction === 'negative' ? '邪派' : '正派']);
  return `<div class="qc-tags">${tags.map(([cls, label]) => `<span class="qc-tag ${cls}">${escapeHtml(label)}</span>`).join('')}</div>`;
}

function getStageState(quest, stage) {
  if ((quest.completed_stages || []).includes(stage.stage)) return 'ok';
  if (stage.stage === quest.current_stage) return 'cur';
  return 'lock';
}

function renderObjectives(player, stageBlock) {
  const items = stageBlock?.items || [];
  if (items.length === 0) return '<div class="qc-objs"><div class="qc-obj-title">当前阶段无收集目标</div></div>';
  return `<div class="qc-objs"><div class="qc-obj-title">收集目标（当前阶段）</div>${items.map(item => {
    const have = InventorySystem.count(player, item.item_key);
    const need = item.count || 1;
    const pct = Math.min(100, Math.round((have / need) * 100));
    const full = have >= need;
    return `<div class="qc-obj">
      <div class="qc-obj-row"><span class="qc-obj-name">${escapeHtml(item.item_name || item.item_key)} <span class="qc-obj-from">· ${escapeHtml(item.drop_monster || '任务目标')}</span></span><span class="qc-obj-ct${full ? ' full' : ''}"><b>${have}</b> / ${need}${full ? ' ✓' : ''}</span></div>
      <div class="qc-bar${full ? ' full' : ''}"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('')}</div>`;
}

function isQuestReady(player, quest) {
  const stageBlock = (quest.objectives || []).find(stage => stage.stage === quest.current_stage) || quest.objectives?.[0];
  return !!stageBlock && (stageBlock.items || []).every(item => InventorySystem.count(player, item.item_key) >= item.count);
}

function renderRewards(quest, prefix = '奖励') {
  const rewardText = (quest.rewards || []).map(reward => {
    if (reward.type === 'unlock_career') return `解锁 ${quest.target_transfer || ''} 转职业`;
    if (reward.type === 'set_faction') return reward.faction === 'negative' ? '加入邪派' : '加入正派';
    if (reward.type === 'gold') return `${reward.amount || 0} 金币`;
    if (reward.type === 'training') return `${reward.amount || 0} 历练`;
    return reward.type || String(reward);
  }).join(' · ') || '推进江湖历程';
  return `<div class="qc-reward"><span class="qr-k">${prefix}</span><span>${escapeHtml(rewardText)}</span></div>`;
}

function renderAcceptedQuest(player, quest) {
  const stageBlock = (quest.objectives || []).find(s => s.stage === quest.current_stage) || quest.objectives?.[0];
  const ready = isQuestReady(player, quest);
  const missingCount = (stageBlock?.items || []).filter(item => InventorySystem.count(player, item.item_key) < item.count).length;
  return `<div class="quest-card">
    <div class="qc-head">
      <span class="qc-name">${escapeHtml(quest.name || quest.key)}</span>
    </div>
    ${renderTags(quest)}
    <div class="qc-desc">${escapeHtml(quest.description || '')}</div>
    <div class="qc-stages">
      ${(quest.objectives || []).map(stage => `<span class="qc-stage ${getStageState(quest, stage)}">阶段 ${stage.stage} · ${escapeHtml(stage.name || '')}</span>`).join('')}
    </div>
    ${renderObjectives(player, stageBlock)}
    ${renderRewards(quest)}
    <div class="qc-foot">
      <button class="qc-submit ${ready ? 'ready' : 'collecting'}" data-ready="${ready ? '1' : '0'}" onclick="window._questSubmitHint(${ready ? 'true' : 'false'})">${ready ? '前往门主提交' : `收集中（还差 ${missingCount} 项）`}</button>
      <div class="qc-foot-note">集齐全部物品后需返回泫渤派门主处提交 · 转职任务不可放弃</div>
    </div>
  </div>`;
}

function renderAvailableQuest(quest) {
  return `<div class="quest-card">
    <div class="qc-head">
      <div>
        <div class="qc-name">${escapeHtml(quest.name || quest.key)}</div>
      </div>
    </div>
    ${renderTags(quest)}
    <div class="qc-desc">${escapeHtml(quest.description || '')}</div>
    ${renderRewards(quest)}
    <div class="qc-foot"><button class="qc-submit ready" onclick="window._questAcceptHint()">前往门主接取</button></div>
  </div>`;
}

function renderCompletedQuest(key) {
  const quest = (TaskSystem._questTemplates || []).find(item => item.key === key);
  return `<div class="quest-card done">
    <div class="qc-head">
      <span class="qc-name">${escapeHtml(quest?.name || key)}</span>
      <span class="qc-done-mark">✓ 已完成</span>
    </div>
    ${quest ? renderTags(quest) : ''}
    <div class="qc-desc">${escapeHtml(quest?.description || '任务已经完成。')}</div>
    ${quest ? renderRewards(quest, '奖励已发放') : ''}
  </div>`;
}

function renderSection(player, activeSeg) {
  const accepted = getAccepted(player);
  const available = getAvailable(player);
  const completed = getCompleted(player);
  if (activeSeg === 'available') {
    return available.length ? available.map(renderAvailableQuest).join('') : '<div class="q-empty"><div class="qe-ico">📭</div><div class="qe-title">暂无可接取的任务</div><div class="qe-hint">继续提升等级或完成当前试炼。</div></div>';
  }
  if (activeSeg === 'completed') {
    return completed.length ? completed.map(renderCompletedQuest).join('') : '<div class="q-empty"><div class="qe-ico">📜</div><div class="qe-title">暂无已完成任务</div></div>';
  }
  return accepted.length ? accepted.map(q => renderAcceptedQuest(player, q)).join('') : '<div class="q-empty"><div class="qe-ico">🧭</div><div class="qe-title">暂无进行中的任务</div><div class="qe-hint">前往泫渤派门主处查看可接任务。</div></div>';
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
