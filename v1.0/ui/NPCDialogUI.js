/**
 * @file ui/NPCDialogUI.js
 * @desc NPC 对话窗口
 */
import { UIManager } from './UIManager.js';
import { TaskSystem } from '../systems/TaskSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js';
import { SynthesisSystem } from '../systems/SynthesisSystem.js';
import { WarehouseSystem } from '../systems/WarehouseSystem.js';
import { UIState } from '../systems/NPCSystem.js';

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
          const price = Math.floor((item.buy_price || 0) * (npcData.price_multiplier || 1.0));
          const canBuy = (player.resources?.gold || 0) >= price;
          return `
          <div class="item-cell" style="height:auto;padding:6px;cursor:pointer"
               onclick="${canBuy ? `window._buyItem('${item.key}', 1)` : ''}"
               title="${item.description || item.name}">
            <div style="font-size:16px">${getItemEmoji(item.key)}</div>
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
          const isQuestItem = false; // 任务物品禁止出售
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