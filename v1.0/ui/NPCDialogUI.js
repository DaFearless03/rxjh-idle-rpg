/**
 * @file ui/NPCDialogUI.js
 * @desc NPC 对话窗口
 */
import { UIManager } from './UIManager.js?v=release-20260830-3';
import { TaskSystem } from '../systems/TaskSystem.js?v=release-20260830-3';
import { NPCSystem } from '../systems/NPCSystem.js?v=release-20260830-3';

const TOWN_NPC_DATA = {
  leader: {
    key: 'quest_npc',
    name: '泫渤派门主',
    type: 'quest',
    tag: '任务',
    avatar: '📜',
    line: '初出茅庐的后生，想在江湖立足，先去证明你的实力吧。',
    quests: [
      { key: 'quest_transfer_1' },
      { key: 'quest_transfer_2_positive' },
      { key: 'quest_transfer_2_negative' },
      { key: 'quest_transfer_3_positive' },
      { key: 'quest_transfer_3_negative' },
    ],
    funcs: [],
  },
  djx: {
    key: 'shop_weapon_and_enhance',
    type: 'shop_and_enhance',
    name: '刀剑笑',
    tag: '武器 · 强化 · 合成',
    avatar: '⚔',
    line: '「少侠，要趁手的新兵器，还是把旧兵刃磨得更利？想镶石头，我这儿也成。」',
    funcs: [
      { key: '武器商店', label: '购买', icon: '🛒' },
      { key: '强化', label: '强化', icon: '⚒' },
      { key: '合成', label: '合成', icon: '💎' },
    ],
  },
  yjl: { key: 'shop_armor', type: 'shop', name: '银娇龙', tag: '防具商', avatar: '👤', line: '本店的护具品质一流，童叟无欺！', funcs: ['防具商店'] },
  psz: { key: 'shop_potion', type: 'shop', name: '平十指', tag: '药剂商', avatar: '👤', line: '平价药剂，童叟无欺！', funcs: ['药水商店'] },
  wdb: { key: 'warehouse_npc', type: 'warehouse', name: '韦大宝', tag: '仓库', avatar: '👤', line: '存什么东西都行，找我就对了！', funcs: ['打开仓库'] },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export function openTownNPCDialog(npcKey) {
  const townKey = TOWN_NPC_DATA[npcKey]
    ? npcKey
    : Object.keys(TOWN_NPC_DATA).find(key => TOWN_NPC_DATA[key].key === npcKey);
  const npc = TOWN_NPC_DATA[townKey];
  const backdrop = document.getElementById('npcDialogBackdrop');
  if (!npc || !backdrop) return;

  document.getElementById('npcDialogAvatar').textContent = npc.avatar;
  document.getElementById('npcDialogName').textContent = npc.name;
  document.getElementById('npcDialogTag').textContent = npc.tag;
  document.getElementById('npcDialogLine').textContent = npc.line;
  NPCSystem.openDialog(npc);
  window._currentNpc = npc;
  if (townKey === 'leader') {
    document.getElementById("npcDialogHead").style.display = "flex";
    document.getElementById('npcDialogLine').style.display = 'none';
    document.getElementById('npcDialogClose').textContent = '离开';
    renderTownLeaderQuestDialog('accept');
  } else {
    const funcRow = document.getElementById('npcFuncRow');
    funcRow.style.removeProperty('display');
    document.getElementById("npcDialogHead").style.display = "flex";
    document.getElementById('npcDialogLine').style.display = 'block';
    document.getElementById('npcDialogClose').textContent = townKey === 'djx' ? '离开' : '关 闭';
    funcRow.innerHTML = npc.funcs.map(func => {
      const item = typeof func === 'string' ? { key: func, label: func, icon: '' } : func;
      return `<button class="npc-func-btn" data-npc="${townKey}" data-func="${item.key}">${item.icon ? `<span class="f-icon">${item.icon}</span>` : ''}${item.label}</button>`;
    }).join('');
  }
  backdrop.classList.add('open');
}

function isQuestReady(player, quest) {
  TaskSystem.stageAdvanceCheck(player);
  return (quest.objectives || []).every(stage => quest.completed_stages?.includes(stage.stage));
}

function questObjectiveSummary(quest) {
  const items = (quest.objectives || []).flatMap(stage => stage.items || []);
  return items.map(item => `${item.item_name || item.item_key}×${item.count}`).join(' / ') || quest.description || '江湖历练';
}

function questTransferSummary(quest, ready = false) {
  const template = window._questTemplates?.find(item => item.key === quest.key);
  const transfer = Number(quest.target_transfer ?? template?.target_transfer);
  const prefix = Number.isFinite(transfer) && transfer > 0 ? `${transfer} 转 · ` : '';
  return `${prefix}${ready ? '物料已齐' : questObjectiveSummary(quest)}`;
}

function renderTownLeaderQuestDialog(tab = 'accept') {
  const player = window.game?.player;
  const npc = TOWN_NPC_DATA.leader;
  const available = TaskSystem.listVisibleQuests(player, npc);
  const accepted = player?.quests?.accepted || [];
  const ready = accepted.filter(quest => isQuestReady(player, quest));

  const renderRows = (quests, kind) => quests.length ? quests.map(quest => `
    <div class="mz-quest-row">
      <span class="mq-icon">📜</span>
      <div class="mq-info">
        <div class="mq-name">${escapeHtml(quest.name || quest.key)}</div>
        <div class="mq-sub">${escapeHtml(questTransferSummary(quest, kind === 'submit'))}</div>
      </div>
      <button class="mq-btn${kind === 'accept' ? ' accept' : ''}" onclick="${kind === 'accept'
        ? `window._leaderConfirmAccept('${escapeHtml(quest.key)}')`
        : `window._leaderSubmit('${escapeHtml(quest.key)}')`}">${kind === 'accept' ? '接取' : '提交'}</button>
    </div>`).join('') : `<div class="mz-empty-note">暂无可${kind === 'accept' ? '接任务' : '提交任务'}</div>`;

  const fr = document.getElementById('npcFuncRow');
  fr.style.display = 'block';
  fr.innerHTML = `
    <div class="mz-tabs">
      <button class="mz-tab${tab === 'accept' ? ' active' : ''}" onclick="window._leaderSwitchTab('accept')">接取</button>
      <button class="mz-tab${tab === 'submit' ? ' active' : ''}" onclick="window._leaderSwitchTab('submit')">提交</button>
    </div>
    <div class="mz-pane" data-pane="accept"${tab === 'accept' ? '' : ' style="display:none;"'}>
      <div class="npc-dialog-line">「${npc.line}」</div>
      <div class="mz-group-label">可接取</div>
      ${renderRows(available, 'accept')}
    </div>
    <div class="mz-pane" data-pane="submit"${tab === 'submit' ? '' : ' style="display:none;"'}>
      <div class="npc-dialog-line">「带回来了？让我看看你这趟的成色。」</div>
      <div class="mz-group-label">可提交</div>
      ${renderRows(ready, 'submit')}
    </div>
    <div class="mz-confirm-backdrop" id="leaderQuestConfirm">
      <div class="mz-confirm" onclick="event.stopPropagation()">
        <div class="mz-confirm-text" id="leaderQuestConfirmText">确定接取任务？</div>
        <div class="mz-confirm-row">
          <button class="mz-confirm-cancel" onclick="window._leaderCancelAccept()">取消</button>
          <button class="mz-confirm-ok" onclick="window._leaderDoAccept()">确定</button>
        </div>
      </div>
    </div>`;
}


window._leaderSwitchTab = (tab) => {
  document.querySelectorAll('#npcFuncRow .mz-tab').forEach((button, index) => {
    button.classList.toggle('active', index === (tab === 'submit' ? 1 : 0));
  });
  document.querySelectorAll('#npcFuncRow .mz-pane').forEach(pane => {
    pane.style.display = pane.dataset.pane === tab ? '' : 'none';
  });
};
window._leaderConfirmAccept = (questKey) => {
  const template = window._questTemplates?.find(quest => quest.key === questKey);
  if (!template) return;
  window._leaderPendingQuestKey = questKey;
  document.getElementById('leaderQuestConfirmText').textContent = `确定接取『${template.name}』？`;
  document.getElementById('leaderQuestConfirm')?.classList.add('open');
};
window._leaderCancelAccept = () => {
  window._leaderPendingQuestKey = null;
  document.getElementById('leaderQuestConfirm')?.classList.remove('open');
};
window._leaderDoAccept = () => {
  const template = window._questTemplates?.find(quest => quest.key === window._leaderPendingQuestKey);
  if (!template) return;
  const result = TaskSystem.acceptQuest(window.game?.player, template);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
  window._leaderPendingQuestKey = null;
  renderTownLeaderQuestDialog('accept');
};
window._leaderSubmit = (questKey) => {
  const player = window.game?.player;
  const instance = player?.quests?.accepted?.find(quest => quest.key === questKey);
  if (!instance) return;
  const result = TaskSystem.submitQuest(player, instance, window._questTemplates || [], window._careersData || []);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
  if (result.success) window._closeNPCDialog?.();
  else renderTownLeaderQuestDialog('submit');
};

export function showNPCDialog(npcData) {
  const backdrop = document.getElementById('npcDialogBackdrop');
  if (!backdrop) {
    console.warn('[NPCDialogUI] 找不到 NPC 弹窗容器', npcData);
    return false;
  }

  const npcKey = Object.entries(TOWN_NPC_DATA).find(([key, npc]) =>
    key === npcData?.key || npc.key === npcData?.key || npc.name === npcData?.name
  )?.[0] || (npcData?.type === 'quest' ? 'leader' : null);
  if (!npcKey) {
    console.warn('[NPCDialogUI] 当前版本不支持该 NPC', npcData);
    return false;
  }

  openTownNPCDialog(npcKey);
  return true;
}
