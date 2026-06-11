/**
 * @file ui/InventoryUI.js / EquipUI.js / QigongUI.js / TaskUI.js / ShopEnhanceUI.js
 * @desc 背包/装备/气功/任务/商店强化 等UI
 */
import { UIManager } from './UIManager.js?v=release-20260611-4';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260611-4';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260611-4';
import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260611-4';

export function showInventoryUI(player) {
  const slots = player.inventory?.slots || [];
  const equipped = player.equipped || {};
  const html = `
    <div style="display:flex;gap:16px">
      <div style="flex:2">
        <div class="flex mb-4" style="justify-content:space-between">
          <span>🎒 背包（${slots.filter(s=>s.count>0).length}/${player.inventory?.capacity||50}）</span>
          <button class="btn btn-sm" onclick="window._sortInventory()">整理</button>
        </div>
        <div class="item-grid">
          ${slots.map((s, i) => s.count > 0 ? `
          <div class="item-cell" title="${s.item_key}">
            <div style="font-size:16px">${getItemEmoji(s.item_key)}</div>
            <span class="count">${s.count}</span>
          </div>` : `<div class="item-cell" style="opacity:0.3"></div>`).join('')}
        </div>
        ${(player.inventory?.equipment_instances ? Object.values(player.inventory.equipment_instances).length : 0) > 0 ? `
        <div class="mt-8">
          <div class="text-dim mb-4">装备实例</div>
          <div class="item-grid">
            ${Object.entries(player.inventory.equipment_instances).map(([id, inst]) => `
              <div class="item-cell" title="${inst.item_key} (${id})">
                <div style="font-size:16px">⚔️</div>
                <div style="font-size:9px">+${inst.enhance_level||0}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>
      <div style="flex:1">
        <div class="text-dim mb-4">快捷操作</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn" onclick="window._openEquip()">⚔️ 装备</button>
          <button class="btn" onclick="window._openWarehouse()">🏪 仓库</button>
          <button class="btn" onclick="window._openQigong()">🌟 气功</button>
          <button class="btn" onclick="window._openTask()">📜 任务</button>
          <button class="btn" onclick="window._openAutoPlay()">⚙️ 挂机</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('inventory-content').innerHTML = html;
  document.getElementById('modal-inventory-content') || null;
  const modal = document.getElementById('modal-inventory');
  if (modal) UIManager.pushModal(modal);
}

export function showEquipUI(player) {
  const equipped = player.equipped || {};
  const ei = player.inventory?.equipment_instances || {};
  const tpls = window._equipTemplates || [];
  const html = `
    <div>
      <div class="text-dim mb-4">当前装备</div>
      <div class="equip-grid" style="grid-template-columns:repeat(3,1fr);gap:8px">
        ${Object.entries(equipped).map(([slot, val]) => {
          let name = '—', instId = null, enhance = 0;
          if (val?.instance_id) {
            const inst = ei[val.instance_id];
            const tpl = tpls.find(t => t.key === inst?.item_key);
            name = tpl?.name || inst?.item_key || '?';
            instId = val.instance_id;
            enhance = inst?.enhance_level || 0;
          }
          return `
          <div class="equip-cell" onclick="${instId ? `window._unequip('${slot}','${instId}')` : ''}">
            <div class="slot">${slot}</div>
            <div class="name" style="${!instId ? 'color:#444' : ''}">${name}</div>
            ${instId ? `<div style="font-size:10px;color:${enhance > 0 ? '#e07020' : '#666'}">+${enhance}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  document.getElementById('equip-content').innerHTML = html;
  UIManager.pushModal(document.getElementById('modal-equip'));
}

export function showQigongUI(player) {
  const list = QigongSystem.listAvailableQigongs(player);
  const avail = QigongSystem.getAvailablePoints(player);
  const html = `
    <div>
      <div class="flex mb-4" style="justify-content:space-between">
        <span>🌟 可用气功点: <strong style="color:#e07020">${avail}</strong></span>
        <button class="btn btn-sm" onclick="window._resetQigong()">重置气功</button>
      </div>
      <div style="max-height:400px;overflow-y:auto">
        ${list.map(q => `
          <div class="quest-item">
            <div class="flex" style="justify-content:space-between">
              <div>
                <span class="qname">${q.name}</span>
                <span class="text-dim"> ${q.description || ''}</span>
              </div>
              <span style="color:#e07020">${q.currentValue.toFixed(2)} → ${q.nextValue.toFixed(2)}</span>
            </div>
            <div class="flex gap-4 mt-4">
              <span class="text-dim">已投: ${q.invested}/${q.max_level}</span>
              <button class="btn btn-sm primary" onclick="window._investQigong('${q.key}', 1)"
                ${avail <= 0 ? 'disabled' : ''}>+1点</button>
              <button class="btn btn-sm" onclick="window._investQigong('${q.key}', 10)"
                ${avail < 10 ? 'disabled' : ''}>+10点</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('qigong-content').innerHTML = html;
  UIManager.pushModal(document.getElementById('modal-qigong'));
}

export function showTaskUI(player) {
  const accepted = player.quests?.accepted || [];
  const html = `
    <div>
      <div class="text-dim mb-4">已接任务（${accepted.length}个）</div>
      ${accepted.length === 0 ? '<div class="text-dim">无</div>' : accepted.map(q => {
        const stageBlock = q.objectives?.find(s => s.stage === q.current_stage);
        const items = stageBlock?.items || [];
        const progress = items.map(i => {
          const have = InventorySystem.count(player, i.item_key);
          return `${i.item_key}(${have}/${i.count})`;
        }).join(', ');
        return `
        <div class="quest-item">
          <div class="qname">【${q.name}】 第${q.current_stage}阶段</div>
          <div class="qprog">${progress}</div>
        </div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('task-content').innerHTML = html;
  UIManager.pushModal(document.getElementById('modal-task'));
}

// Shop/Enhance/Synthesis (from NPC dialog, simplified standalone versions)
export function showShopUI(npcData, player) {
  const items = npcData?.items || [];
  const html = `
    <div>
      <div class="grid-2 gap-4">
        ${items.map(item => {
          const price = Math.floor((item.buy_price || 0) * (npcData.price_multiplier || 1.0));
          const canBuy = (player.resources?.gold || 0) >= price;
          return `
          <div class="item-cell" style="height:auto;padding:6px;cursor:pointer"
               onclick="${canBuy ? `ShopSystem.buy(window.game.player, window._currentNpc, '${item.key}', 1);UIManager.toast('购买成功','success');` : `UIManager.toast('金币不足','error')`}">
            <div style="font-size:20px">${getItemEmoji(item.key)}</div>
            <div style="font-size:10px">${item.name || item.key}</div>
            <div style="font-size:10px;color:${canBuy?'#e07020':'#666'}">💰${price}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  document.getElementById('shop-content').innerHTML = html;
  UIManager.pushModal(document.getElementById('modal-shop'));
}

// Helper
const ITEM_EMOJI = {
  hp_potion_grade1:'💊', hp_potion_grade2:'💊', hp_potion_grade3:'💊',
  mp_potion_grade1:'🌿', mp_potion_grade2:'🌿', mp_potion_grade3:'🌿',
  cold_jade_01:'💎', vajra_01:'💠', enhance_stone_01:'🔮', hot_blood_01:'❤️',
  box_xuanbo_01:'📦',
};
function getItemEmoji(key) { return ITEM_EMOJI[key] || '📦'; }

// Expose to window for inline onclick
window._openEquip = () => { UIManager.popModal(); showEquipUI(window.game?.player); };
window._openWarehouse = () => { UIManager.popModal(); UIManager.pushModal(document.getElementById('modal-warehouse')); };
window._openQigong = () => { UIManager.popModal(); showQigongUI(window.game?.player); };
window._openTask = () => { UIManager.popModal(); showTaskUI(window.game?.player); };
window._openAutoPlay = () => { UIManager.popModal(); import('../ui/AutoPlayPanelUI.js?v=release-20260611-4').then(m => m.showAutoPlayPanel(window.game?.player)); };
window._sortInventory = () => { UIManager.toast('整理背包', 'info'); };
window._unequip = (slot, instanceId) => {
  if (window.game?.player) window.game.player.equipped[slot] = null;
  UIManager.toast('已卸下', 'info');
  showEquipUI(window.game?.player);
};
window._investQigong = (key, pts) => {
  const r = QigongSystem.investQigong(window.game?.player, key, pts);
  if (r.success) { window._attrSys?.recompute(window.game?.player); showQigongUI(window.game?.player); }
  else UIManager.toast(r.message, 'error');
};
window._resetQigong = () => {
  const r = QigongSystem.resetQigong(window.game?.player);
  if (r.success) { window._attrSys?.recompute(window.game?.player); showQigongUI(window.game?.player); }
};
window._attrSys = null;
