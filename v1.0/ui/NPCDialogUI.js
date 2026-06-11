/**
 * @file ui/NPCDialogUI.js
 * @desc NPC 对话窗口
 */
import { UIManager } from './UIManager.js?v=release-20260611-3';
import { TaskSystem } from '../systems/TaskSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js?v=release-20260611-3';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260611-3';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260611-3';
import { WarehouseSystem } from '../systems/WarehouseSystem.js?v=release-20260611-3';
import { NPCSystem, UIState } from '../systems/NPCSystem.js';

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
  djx: { name: '刀剑笑', tag: '武器商 / 强化', avatar: '👤', line: '客官，来看看我的神兵利器！', funcs: ['武器商店', '强化', '合成'] },
  yjl: { name: '银娇龙', tag: '防具商', avatar: '👤', line: '本店的护具品质一流，童叟无欺！', funcs: ['防具商店'] },
  psz: { name: '平十指', tag: '药剂商', avatar: '👤', line: '平价药剂，童叟无欺！', funcs: ['药水商店'] },
  wdb: { name: '韦大宝', tag: '仓库', avatar: '👤', line: '存什么东西都行，找我就对了！', funcs: ['打开仓库'] },
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
  const npc = TOWN_NPC_DATA[npcKey];
  const backdrop = document.getElementById('npcDialogBackdrop');
  if (!npc || !backdrop) return;

  document.getElementById('npcDialogAvatar').textContent = npc.avatar;
  document.getElementById('npcDialogName').textContent = npc.name;
  document.getElementById('npcDialogTag').textContent = npc.tag;
  document.getElementById('npcDialogLine').textContent = npc.line;
  NPCSystem.openDialog(npc);
  window._currentNpc = npc;
  if (npcKey === 'leader') {
    document.getElementById("npcDialogHead").style.display = "flex";
    renderTownLeaderQuestDialog('accept');
  } else {
    document.getElementById("npcDialogHead").style.display = "flex";
    document.getElementById('npcFuncRow').innerHTML = npc.funcs.map(func =>
      `<button class="npc-func-btn" data-npc="${npcKey}" data-func="${func}">${func}</button>`
    ).join('');
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
        <div class="mq-sub">${escapeHtml(questObjectiveSummary(quest))}</div>
      </div>
      <button class="mq-btn${kind === 'accept' ? ' accept' : ''}" onclick="${kind === 'accept'
        ? `window._leaderConfirmAccept('${escapeHtml(quest.key)}')`
        : `window._leaderSubmit('${escapeHtml(quest.key)}')`}">${kind === 'accept' ? '接取' : '提交'}</button>
    </div>`).join('') : `<div class="mz-empty-note">暂无可${kind === 'accept' ? '接任务' : '提交任务'}</div>`;

  const fr = document.getElementById('npcFuncRow');
  fr.style.display = 'block';
  const rows = tab === "submit" ? ready : available;
  fr.innerHTML = `
    <div class="mz-tabs">
      <button class="mz-tab${tab === 'accept' ? ' active' : ''}" onclick="window._leaderSwitchTab('accept')">接取</button>
      <button class="mz-tab${tab === 'submit' ? ' active' : ''}" onclick="window._leaderSwitchTab('submit')">提交</button>
    </div>
    <div class="npc-dialog-line" style="margin-bottom:0.6rem">${tab === 'submit' ? '带回来了？让我看看你这趟的成色。' : npc.line}</div>
    <div class="mz-group-label">可${tab === 'submit' ? '提交' : '接取'}</div>
    ${renderRows(rows, tab === 'submit' ? 'submit' : 'accept')}
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


window._leaderSwitchTab = (tab) => renderTownLeaderQuestDialog(tab);
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
  renderTownLeaderQuestDialog('submit');
};

export function showNPCDialog(npcData, player, careersData, questTemplates) {
  document.getElementById('npc-dialog-title').textContent = npcData.name || 'NPC';

  let content = '';
  if (npcData.type === 'quest') {
    content = buildQuestDialog(npcData, player, questTemplates);
  } else if (npcData.type === 'shop' || npcData.type === 'shop_and_enhance') {
    content = buildShopDialog(npcData, player);
  } else if (npcData.type === 'enhance') {
    content = buildEnhanceDialog(npcData, player);
  } else if (npcData.type === 'warehouse') {
    content = buildWarehouseDialog(npcData, player);
  } else if (npcData.type === 'synthesis') {
    content = buildSynthesisDialog(npcData, player);
  } else if (npcData.type === 'shop_and_enhance') {
    content = buildShopDialog(npcData, player) + buildEnhanceDialog(npcData, player);
  }

  document.getElementById('npc-dialog-content').innerHTML = content;
  const modal = document.getElementById('modal-npc');
  if (modal) UIManager.pushModal(modal);

  window.closeNPCDialog = () => {
    UIManager.popModal();
    window._closeNPCDialogFn?.();
  };
}

function buildQuestDialog(npcData, player, questTemplates) {
  const visible = TaskSystem.listVisibleQuests(player, npcData);
  const accepted = player.quests?.accepted || [];
  const canSubmit = accepted.filter(q => {
    const stageBlock = q.objectives?.find(s => s.stage === q.current_stage);
    return stageBlock?.items?.every(i => InventorySystem.count(player, i.item_key) >= i.count);
  });

  return `
    <div class="mb-4">
      <div class="text-dim mb-4" style="margin-bottom:8px">可接任务：</div>
      ${visible.length === 0 ? '<div class="text-dim">（无可接任务）</div>' : visible.map(q => `
        <div class="quest-item" onclick="window._acceptQuest('${q.key}')">
          <div class="qname">【${q.name}】</div>
          <div class="qdesc">${q.description || ''}</div>
          <div class="qprog text-dim">需 Lv${q.prerequisite?.level || 1}，转职${q.required_transfer || 0}次</div>
        </div>
      `).join('')}
    </div>
    ${canSubmit.length > 0 ? `
    <div class="mb-4">
      <div class="text-dim mb-4" style="margin-bottom:8px">可提交任务：</div>
      ${canSubmit.map(q => `
        <div class="quest-item" onclick="window._submitQuest('${q.key}')" style="border-color:#d0a000">
          <div class="qname" style="color:#d0a000">【可提交】${q.name}</div>
          <div class="qprog text-success">点击提交</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

function buildShopDialog(npcData, player) {
  const items = npcData.items || [];
  return `
    <div class="mb-4">
      <p class="text-dim mb-4">商品列表（点击购买）</p>
      <div class="grid-2 gap-4">
        ${items.map(item => {
          const itemKey = item.item_key || item.key;
          const price = Math.floor((item.buy_price || 0) * (npcData.price_multiplier || 1.0));
          const canBuy = (player.resources?.gold || 0) >= price;
          return `
          <div class="item-cell" style="height:auto;padding:6px;cursor:pointer"
               onclick="${canBuy ? `window._buyItem('${itemKey}', 1)` : ''}"
               title="${item.description || item.name}">
            <div style="font-size:16px">${getItemEmoji(itemKey)}</div>
            <div style="font-size:10px">${item.name}</div>
            <div style="font-size:10px;color:${canBuy ? '#e07020' : '#666'}">💰 ${price}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div>
      <p class="text-dim mb-4">背包物品（点击出售）</p>
      <div class="item-grid">
        ${(player.inventory?.slots || []).filter(s => s.count > 0 && s.item_key).map(s => {
          const isQuestItem = InventorySystem._getItemClass(s.item_key, player) === 'quest_items';
          const basePrice = getSellPrice(s.item_key);
          const sellPrice = Math.floor(basePrice * 0.5);
          if (isQuestItem || sellPrice <= 0) return '';
          return `
          <div class="item-cell" onclick="window._sellItem('${s.item_key}', 1)"
               title="${s.item_key}">
            <div style="font-size:16px">${getItemEmoji(s.item_key)}</div>
            <span class="count">${s.count}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function buildEnhanceDialog(npcData, player) {
  return `
    <p class="text-dim mb-4">强化装备（选择装备后选强化石）</p>
    <div class="mb-4">
      <div class="text-dim mb-4" style="font-size:11px">已穿装备</div>
      <div class="equip-grid">
        ${Object.entries(player.equipped || {}).map(([slot, val]) => {
          if (!val || (Array.isArray(val) && val.every(v => !v))) return `<div class="equip-cell"><div class="slot">${slot}</div><div>—</div></div>`;
          const inst = val.instance_id ? player.inventory?.equipment_instances?.[val.instance_id] : null;
          const tpl = window._equipTemplates?.find(t => t.key === inst?.item_key);
          return `
          <div class="equip-cell" onclick="window._selectEnhanceEquip('${slot}', '${val.instance_id}')">
            <div class="slot">${slot}</div>
            <div class="name">${tpl?.name || inst?.item_key || '?'}</div>
            ${inst ? `<div style="font-size:9px">+${inst.enhance_level || 0}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="enhance-stone-area" class="mb-4" style="display:none">
      <div class="text-dim mb-4">强化石（选一个）</div>
      <div class="item-grid">
        ${['vajra_01','enhance_stone_01'].map(k => `
          <div class="item-cell" onclick="window._selectEnhanceStone('${k}')">
            <div style="font-size:16px">${getItemEmoji(k)}</div>
            <div style="font-size:10px">${k}</div>
          </div>`).join('')}
      </div>
      <button class="btn primary mt-4" style="width:100%" id="do-enhance-btn" onclick="window._doEnhance()">强化 +1</button>
    </div>
  `;
}

function buildSynthesisDialog(npcData, player) {
  return `
    <p class="text-dim mb-4">合成石头（选择装备+石头）</p>
    <div class="mb-4">
      <div class="text-dim mb-4">已穿装备</div>
      <div class="equip-grid">
        ${Object.entries(player.equipped || {}).filter(([,v]) => v?.instance_id).map(([slot, val]) => {
          const inst = player.inventory?.equipment_instances?.[val.instance_id];
          const tpl = window._equipTemplates?.find(t => t.key === inst?.item_key);
          const hasEmptySlot = inst?.synthesis_slots?.some(s => s == null);
          return `
          <div class="equip-cell" onclick="window._selectSynthesisEquip('${slot}', '${val.instance_id}')"
               style="${hasEmptySlot ? 'border-color:#d0a000' : ''}">
            <div class="slot">${slot}</div>
            <div class="name">${tpl?.name || inst?.item_key || '?'}</div>
            ${hasEmptySlot ? '<div style="font-size:9px;color:#d0a000">有空格</div>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="synthesis-stone-area" style="display:none">
      <div class="text-dim mb-4">合成石（选一个）</div>
      <div class="item-grid">
        ${['vajra_01','cold_jade_01','hot_blood_01'].map(k => `
          <div class="item-cell" onclick="window._selectSynthesisStone('${k}')">
            <div style="font-size:16px">${getItemEmoji(k)}</div>
            <div style="font-size:10px">${k}</div>
          </div>`).join('')}
      </div>
      <button class="btn primary mt-4" style="width:100%" onclick="window._doSynthesis()">合 成</button>
    </div>
  `;
}

function buildWarehouseDialog(npcData, player) {
  const inv = player.inventory?.slots || [];
  const wh = player.warehouse?.slots || [];
  return `
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div class="text-dim mb-4">背包</div>
        <div class="item-grid" style="grid-template-columns:repeat(4,42px)">
          ${inv.filter(s=>s.count>0).map(s => `
            <div class="item-cell" onclick="window._depositItem('${s.item_key}', 1)">
              <div style="font-size:14px">${getItemEmoji(s.item_key)}</div>
              <span class="count">${s.count}</span>
            </div>`).join('')}
        </div>
      </div>
      <div style="flex:1">
        <div class="text-dim mb-4">仓库</div>
        <div class="item-grid" style="grid-template-columns:repeat(4,42px)">
          ${wh.filter(s=>s.count>0).map(s => `
            <div class="item-cell" onclick="window._withdrawItem('${s.item_key}', 1)">
              <div style="font-size:14px">${getItemEmoji(s.item_key)}</div>
              <span class="count">${s.count}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// 辅助
const ITEM_EMOJI = {
  hp_potion_grade1: '💊', hp_potion_grade2: '💊', hp_potion_grade3: '💊',
  mp_potion_grade1: '🌿', mp_potion_grade2: '🌿', mp_potion_grade3: '🌿',
  cold_jade_01: '💎', vajra_01: '💠', enhance_stone_01: '🔮', hot_blood_01: '❤️',
  box_xuanbo_01: '📦',
};
function getItemEmoji(key) { return ITEM_EMOJI[key] || '📦'; }
function getSellPrice(key) {
  const prices = { hp_potion_grade1:10, mp_potion_grade1:10, hp_potion_grade2:50, mp_potion_grade2:50,
    hp_potion_grade3:120, mp_potion_grade3:120, cold_jade_01:20, vajra_01:20, enhance_stone_01:15, hot_blood_01:25 };
  return prices[key] || 5;
}

window._buyItem = (itemKey, count) => {
  const result = ShopSystem.buy(window.game?.player, UIState.active_npc?.data, itemKey, count);
  if (result.success) UIManager.toast('购买成功', 'success');
  else UIManager.toast(result.message, 'error');
  refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._sellItem = (itemKey, count) => {
  const result = ShopSystem.sell(window.game?.player, UIState.active_npc?.data, itemKey, count);
  if (result.success) UIManager.toast('出售成功', 'info');
  refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._acceptQuest = (questKey) => {
  const tpl = window._questTemplates?.find(q => q.key === questKey);
  if (!tpl) return;
  const result = TaskSystem.acceptQuest(window.game?.player, tpl);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
  refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._submitQuest = (questKey) => {
  const inst = window.game?.player?.quests?.accepted?.find(q => q.key === questKey);
  if (!inst) return;
  const result = TaskSystem.submitQuest(window.game?.player, inst, window._questTemplates, window._careersData);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
  if (result.success) { window.closeNPCDialog(); window.game?.showStatus?.(); }
  else refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._selectEnhanceEquip = (slot, instanceId) => {
  window._enhanceSlot = slot; window._enhanceInstId = instanceId;
  document.getElementById('enhance-stone-area').style.display = '';
};
window._selectEnhanceStone = (key) => { window._enhanceStone = key; };
window._doEnhance = () => {
  if (!window._enhanceSlot) return;
  const result = EnhanceSystem.enhance(window.game?.player, window._enhanceSlot);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
  if (result.success) window.game?.showStatus?.();
};
window._selectSynthesisEquip = (slot, instanceId) => {
  window._synSlot = slot; window._synInstId = instanceId;
  document.getElementById('synthesis-stone-area').style.display = '';
};
window._selectSynthesisStone = (key) => { window._synStone = key; };
window._doSynthesis = () => {
  if (!window._synSlot) return;
  const result = SynthesisSystem.synthesize(window.game?.player, window._synSlot, window._synStone);
  UIManager.toast(result.message, result.success ? 'success' : 'error');
};
window._depositItem = (key, count) => {
  const r = WarehouseSystem.deposit(window.game?.player, key, count);
  UIManager.toast(r.success ? `存入 ${key}×${r.deposited}` : '存入失败', r.success ? 'info' : 'error');
  refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._withdrawItem = (key, count) => {
  const r = WarehouseSystem.withdraw(window.game?.player, key, count);
  UIManager.toast(r.success ? `取出 ${key}×${r.withdrawn}` : '取出失败', r.success ? 'info' : 'error');
  refreshNPCDialog(window._currentNpc, window.game?.player, window._questTemplates);
};
window._questTemplates = null;
window._careersData = null;
window._currentNpc = null;

function refreshNPCDialog(npcData, player, questTemplates) {
  if (!npcData) return;
  showNPCDialog(npcData, player, window._careersData, window._questTemplates);
}
