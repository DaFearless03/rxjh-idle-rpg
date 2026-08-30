/**
 * @file ui/BottomBarUI.js
 * @desc 底部导航 + 主面板切换桥接函数
 */
import { UIManager } from './UIManager.js?v=release-20260830-1';
import { ShopSystem } from '../systems/ShopSystem.js?v=release-20260830-1';
import { InventorySystem } from '../systems/InventorySystem.js?v=release-20260830-1';
import { WarehouseSystem } from '../systems/WarehouseSystem.js?v=release-20260830-1';
import { SynthesisSystem } from '../systems/SynthesisSystem.js?v=release-20260830-1';
import { EnhanceSystem } from '../systems/EnhanceSystem.js?v=release-20260830-1';
import { QigongSystem } from '../systems/QigongSystem.js?v=release-20260830-1';
import { AutoPlaySystem } from '../systems/AutoPlaySystem.js?v=release-20260830-1';
import { mountCharacterPanel } from './CharacterUI.js?v=release-20260830-1';
import { mountInventoryPanel } from './InventoryUI.js?v=release-20260830-1';
import { getEquipmentTemplate, renderEquipmentDetail } from './EquipUI.js?v=release-20260830-1';
import { mountQuestPanel } from './TaskUI.js?v=release-20260830-1';
import { mountWarehouseGrids } from './WarehouseUI.js?v=release-20260830-1';
import { openTownNPCDialog } from './NPCDialogUI.js?v=release-20260830-1';
import { renderArmorShop, renderPotionShop, renderWeaponShop } from './ShopUI.js?v=release-20260830-1';
import { renderEnhanceWorkbench } from './EnhanceUI.js?v=release-20260830-1';
import { renderSynthesisWorkbench } from './SynthesisUI.js?v=release-20260830-1';
import { refreshPlayerAvatar, refreshPlayerIdentity, refreshPlayerStatusBar } from './PlayerStatusBarUI.js?v=release-20260830-1';
import { showMultiSaveUI } from './MultiSaveUI.js?v=release-20260830-1';

window._openPanel = (panelId) => {
  UIManager.openPanel(panelId);
  // 主面板的 panel 内容需要按需渲染
  if (panelId !== 'main' && panelId !== 'combat') {
    renderPanelContent(panelId);
  }
};

function getCurrentSubZoneKey() {
  const battleSubZone = window.game?.battle?._currentSubZone;
  if (typeof battleSubZone === 'string') return battleSubZone;
  if (battleSubZone?.key) return battleSubZone.key;
  return window.game?.player?.location?.current_sub_zone_key
    || window.game?.currentSubZoneKey
    || null;
}

window._closePanel = () => {
  UIManager.closePanel();
};

window._returnToTown = () => {
  window.game?.town();
  UIManager.closePanel();
  UIManager.openPanel('home');
};

window._exitCombat = () => {
  window.game?.town();
  UIManager.closePanel();
  UIManager.openPanel('home');
};

window._switchCharTab = (tab) => {
  renderCharacterTabContent(tab);
};

window._openNPC = openTownNPCDialog;

window._openShop = (shopType) => {
  const backdrop = document.getElementById('shopBackdrop');
  if (!backdrop) return;
  const titles = { weapon: '⚔️ 武器商店', armor: '🛡️ 防具商店', potion: '🧪 药水商店' };
  document.getElementById('shopTitle').textContent = titles[shopType] || '🏪 商店';
  document.getElementById('shopGold').textContent = (window.game?.player?.resources?.gold || 0).toLocaleString();
  backdrop.classList.add('open');
};

let _djxCurrentTab = 'weapon';
window._openDjxShop = (tab) => {
  _djxCurrentTab = tab || 'weapon';
  const backdrop = document.getElementById('djxShopBackdrop');
  if (!backdrop) return;
  document.getElementById('djxShopGold').textContent = (window.game?.player?.resources?.gold || 0).toLocaleString();
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + _djxCurrentTab)?.classList.add('active');
  updateDjxShell(_djxCurrentTab);
  setActiveDjxTabContent(_djxCurrentTab);
  backdrop.classList.add('open');
  window._renderDjxShop();
};

window._switchDjxTab = (tab) => {
  _djxCurrentTab = tab;
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  updateDjxShell(tab);
  setActiveDjxTabContent(tab);
  window._renderDjxShop();
};

function updateDjxShell(tab) {
  const synthesisOnly = tab === 'synth';
  const title = document.getElementById('djxShopTitle');
  const tabs = document.querySelector('#djxShopBackdrop .shop-tabs');
  const outerGold = document.querySelector('#djxShopBackdrop .djx-shop-gold');
  if (title) title.textContent = synthesisOnly ? '💎 合成 · 镶嵌' : tab === 'enhance' ? '⚒ 强化' : '🛒 武器商店';
  if (tabs) tabs.style.display = '';
  if (outerGold) outerGold.style.display = synthesisOnly ? 'none' : '';
}

function setActiveDjxTabContent(tab) {
  document.querySelectorAll('.djx-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  const active = document.getElementById('djx-' + tab + '-content');
  if (active) {
    active.classList.add('active');
    active.style.display = 'flex';
  }
}

window._renderDjxShop = () => {
  const p = window.game?.player;
  const tab = _djxCurrentTab;
  if (tab === 'weapon') {
    const el = document.getElementById('djx-weapon-content');
    if (!el) return;
    el.innerHTML = renderWeaponShop(p);
  } else if (tab === 'synth') {
    window._renderDjxSynth('synth');
  } else if (tab === 'enhance') {
    window._renderDjxSynth('enhance');
  }
};

window._renderDjxSynth = (type) => {
  const el = document.getElementById('djx-' + type + '-content');
  if (!el) return;
  const p = window.game?.player;
  el.innerHTML = type === 'synth'
    ? renderSynthesisWorkbench(p)
    : renderEnhanceWorkbench(p);

  el.querySelectorAll('.bag-tile[data-key]').forEach(tile => {
    tile.addEventListener('click', () => {
      const key = tile.dataset.key;
      window._djxSelectItem(key, type);
    });
  });
};

let _inventorySurfaceRefreshFrame = null;

const INVENTORY_SCROLL_SELECTORS = [
  '#inventoryBagScroll',
  '#warehouseBackdrop .wh-scroll',
  '#yjlShopBackdrop .shop-sell-scroll',
  '#pszShopBackdrop .shop-sell-scroll',
  '#djxShopBackdrop .shop-sell-scroll',
  '#djxShopBackdrop .craft-bag',
];

function captureInventoryScrollPositions() {
  return INVENTORY_SCROLL_SELECTORS.flatMap(selector =>
    Array.from(document.querySelectorAll(selector)).map((element, index) => ({
      selector,
      index,
      scrollTop: element.scrollTop,
    }))
  );
}

function restoreInventoryScrollPositions(positions) {
  positions.forEach(({ selector, index, scrollTop }) => {
    const element = document.querySelectorAll(selector)[index];
    if (element) element.scrollTop = scrollTop;
  });
}

function refreshOpenInventorySurfacesNow() {
  const player = window.game?.player;
  if (!player) return;
  const scrollPositions = captureInventoryScrollPositions();
  const sheetPopupOpen = !!document.querySelector('#qtyBackdrop.open, #whPopup.open, #whEquipPopup.open');
  if (document.getElementById('page-inventory')?.classList.contains('active')) renderInventoryPanel(player);
  if (!sheetPopupOpen) {
    if (document.getElementById('warehouseBackdrop')?.classList.contains('open')) _renderWarehouse();
    if (document.getElementById('yjlShopBackdrop')?.classList.contains('open')) window._renderYjlShop();
    if (document.getElementById('pszShopBackdrop')?.classList.contains('open')) window._renderPszShop();
    if (document.getElementById('djxShopBackdrop')?.classList.contains('open')) {
      const savedSlots = { ...(window._djxSlots[_djxCurrentTab] || {}) };
      window._renderDjxShop();
      if (_djxCurrentTab === 'synth' || _djxCurrentTab === 'enhance') {
        window._djxSlots[_djxCurrentTab] = {};
        if (savedSlots.equip) window._djxSelectItem(savedSlots.equip, _djxCurrentTab);
        if (savedSlots.stone) window._djxSelectItem(savedSlots.stone, _djxCurrentTab);
      }
    }
  }
  restoreInventoryScrollPositions(scrollPositions);
}

function flushOpenInventorySurfaceRefresh() {
  if (_inventorySurfaceRefreshFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(_inventorySurfaceRefreshFrame);
  }
  _inventorySurfaceRefreshFrame = null;
  refreshOpenInventorySurfacesNow();
}

window._refreshOpenInventorySurfaces = () => {
  if (_inventorySurfaceRefreshFrame) return;
  _inventorySurfaceRefreshFrame = requestAnimationFrame(() => {
    _inventorySurfaceRefreshFrame = null;
    refreshOpenInventorySurfacesNow();
  });
};

window._djxSlots = { synth: {}, enhance: {} };

function isCraftStoneKey(key) {
  return /^(enhance_stone|vajra|cold_jade|hot_blood)_/.test(key || '') || key?.includes('gem');
}

function getCraftTileMeta(key, type) {
  const safeKey = String(key || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const tile = document.querySelector(`#djx-${type}-content .bag-tile[data-key="${safeKey}"]`);
  return {
    icon: tile?.dataset.icon || (isCraftStoneKey(key) ? '💎' : '⚔️'),
    name: tile?.dataset.name || key,
  };
}

function updateDjxCraftButton(type) {
  const slots = window._djxSlots[type] || {};
  const confirmBtn = document.querySelector(`#djx-${type}-content .craft-confirm`);
  if (!confirmBtn) return;
  confirmBtn.disabled = type === 'synth' ? !(slots.equip && slots.stone) : !slots.equip;
}

function getSynthesisStoneAttribute(key) {
  const [, attr = '', value = ''] = String(key || '').split('--');
  const labels = {
    atkSelfAdd: '攻击', atkAdd: '攻击', hitAdd: '命中', hitSelfAdd: '命中',
    defAdd: '防御', defSelfAdd: '防御', maxHpAdd: '生命', maxHpSelfAdd: '生命',
    missingAdd: '闪避', weaponSkillBonusAdd: '武功攻击', weaponExtraDamageAdd: '追加伤害',
    skill_level_up: '技能等级', enhanceSuccessRateAdd: '合成成功率', goldDropBonusAdd: '金币爆率',
  };
  return labels[attr] && value ? `${labels[attr]}+${value}` : key;
}

function updateSynthesisWorkbench() {
  const slots = window._djxSlots.synth || {};
  const content = document.getElementById('djx-synth-content');
  const equipTile = slots.equip
    ? content?.querySelector(`.bag-tile[data-key="${CSS.escape(slots.equip)}"]`)
    : null;
  const grid = document.getElementById('djx-synth-slot-grid');
  const result = document.getElementById('djx-synth-result');
  const confirm = content?.querySelector('.craft-confirm');
  const reset = content?.querySelector('.craft-reset');
  if (!grid) return;

  content.querySelectorAll('.bag-tile.used').forEach(tile => tile.classList.remove('used'));
  if (!equipTile) {
    grid.innerHTML = Array(4).fill('<div class="synth-slot empty inactive">＋</div>').join('');
    const costValue = result?.querySelector('.v.cost');
    if (costValue) costValue.textContent = '--';
    reset?.classList.add('hidden');
    return;
  }

  equipTile.classList.add('used');
  const capacity = Number(equipTile.dataset.cap || 0);
  const filled = String(equipTile.dataset.filled || '').split('|').filter(Boolean);
  grid.innerHTML = Array.from({ length: 4 }, (_, index) => {
    if (index >= capacity) return '<div class="synth-slot empty inactive">＋</div>';
    const stone = filled[index];
    if (stone) return `<div class="synth-slot filled">💠<span class="slot-val">${getSynthesisStoneAttribute(stone)}</span></div>`;
    const staged = index === filled.length && slots.stone;
    return `<div class="synth-slot ${staged ? 'filled staged' : 'empty'}" data-idx="${index}">${staged ? `💎<span class="slot-val">${getSynthesisStoneAttribute(slots.stone)}</span>` : '＋'}</div>`;
  }).join('');
  if (result) {
    const costValue = result.querySelector('.v.cost');
    if (costValue) costValue.textContent = `💰 ${Number(equipTile.dataset.cost || 0).toLocaleString()}`;
  }
  if (confirm && filled.length >= capacity) {
    confirm.disabled = true;
    confirm.textContent = '已满';
  } else if (confirm) {
    confirm.textContent = '镶嵌';
  }
  reset?.classList.remove('hidden');
}

function updateEnhanceWorkbench() {
  const slots = window._djxSlots.enhance || {};
  const content = document.getElementById('djx-enhance-content');
  const equipTile = slots.equip
    ? content?.querySelector(`.bag-tile[data-key="${CSS.escape(slots.equip)}"]`)
    : null;
  const equipInstance = slots.equip
    ? window.game?.player?.inventory?.equipment_instances?.[slots.equip]
    : null;
  const synthesisCount = equipInstance?.synthesis_slots?.length || 0;
  const stonesNeeded = synthesisCount >= 4 ? 3 : synthesisCount >= 1 ? 2 : 1;
  const stoneZone = content?.querySelector('.craft-dropzone[data-zone="enhance-stone"]');
  if (stoneZone?.classList.contains('filled')) {
    let countLabel = stoneZone.querySelector('.dz-count-label');
    if (!countLabel) {
      countLabel = document.createElement('div');
      countLabel.className = 'dz-count-label';
      stoneZone.querySelector('.dz-name')?.insertAdjacentElement('afterend', countLabel);
    }
    countLabel.textContent = `使用数量 ×${stonesNeeded}`;
  }
  const costValue = document.querySelector('#djx-enhance-cost .v.cost');
  if (costValue) {
    costValue.textContent = equipTile
      ? `💰 ${Number(equipTile.dataset.cost || 0).toLocaleString()}`
      : '--';
  }
}

window._djxSelectItem = (key, type) => {
  const tile = document.querySelector(`#djx-${type}-content .bag-tile[data-key="${CSS.escape(key)}"]`);
  if (tile?.dataset.craftValid !== '1') {
    window._showToast(type === 'synth' ? '该物品不可用于合成' : '该物品不可用于强化');
    return;
  }
  const stoneKey = isCraftStoneKey(key);
  const dataKey = stoneKey ? 'stone' : 'equip';
  if (type === 'synth' && stoneKey && window._djxSlots.synth.equip) {
    const equipTile = document.querySelector(`#djx-synth-content .bag-tile[data-key="${CSS.escape(window._djxSlots.synth.equip)}"]`);
    const stoneTile = document.querySelector(`#djx-synth-content .bag-tile[data-key="${CSS.escape(key)}"]`);
    if (equipTile?.dataset.stoneCategory && equipTile.dataset.stoneCategory !== stoneTile?.dataset.stoneCategory) {
      window._showToast(`石头类型不符，需要${equipTile.dataset.stoneCategory === 'vajra' ? '金刚石' : equipTile.dataset.stoneCategory === 'hot_blood' ? '热血石' : '寒玉石'}`);
      return;
    }
  }
  if (type === 'synth' && !stoneKey) window._djxSlots.synth.stone = null;
  window._djxSlots[type][dataKey] = key;
  const meta = getCraftTileMeta(key, type);

  // 更新 demo 风格的 craft-dropzone
  const zoneEquip = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="equip"]`);
  const zoneStone = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="${type}-stone"]`);
  const targetZone = stoneKey ? zoneStone : zoneEquip;
  if (targetZone) {
    targetZone.classList.add('filled');
    const icon = stoneKey ? '💎' : '⚔️';
    targetZone.innerHTML = `
      <div class="dz-icon" style="font-size:1.8rem">${meta.icon || icon}</div>
      <div class="dz-name" style="font-size:0.75rem;font-weight:bold;margin-top:0.2rem">${meta.name}</div>
      <div class="dz-clear" style="position:absolute;top:0.2rem;right:0.3rem;font-size:1rem;opacity:0.5;cursor:pointer">×</div>
    `;
    // 点击 × 清空该槽
    targetZone.querySelector('.dz-clear').addEventListener('click', e => {
      e.stopPropagation();
      window._djxClearSlot(dataKey, type);
    });
  }
  if (type === 'synth') updateSynthesisWorkbench();
  if (type === 'enhance') updateEnhanceWorkbench();
  updateDjxCraftButton(type);
};

window._djxClearSlot = (slotType, type) => {
  const slotKey = slotType === 'stone' ? window._djxSlots[type].stone : slotType === 'equip' ? window._djxSlots[type].equip : window._djxSlots[type].charm;
  if (slotType === 'stone') window._djxSlots[type].stone = null;
  else if (slotType === 'equip') window._djxSlots[type].equip = null;
  else window._djxSlots[type].charm = null;
  const zoneEquip = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="equip"]`);
  const zoneStone = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="${type}-stone"]`);
  const targetZone = slotType === 'stone' ? zoneStone : slotType === 'equip' ? zoneEquip : null;
  if (targetZone) {
    targetZone.classList.remove('filled');
    const hint = slotType === 'stone'
      ? (type === 'synth' ? '选择<br>合成石' : '选择<br>强化石')
      : '选择背包装备';
    targetZone.innerHTML = `<div class="dz-plus">＋</div><div class="dz-hint">${hint}</div>`;
  }
  if (type === 'synth') updateSynthesisWorkbench();
  if (type === 'enhance') updateEnhanceWorkbench();
  updateDjxCraftButton(type);
};

window._djxClearAll = (type) => {
  window._djxSlots[type] = {};
  ['equip', 'stone'].forEach(s => window._djxClearSlot(s, type));
  const resultEl = document.getElementById('djx-' + type + '-result');
  const warnEl = document.getElementById('djx-' + type + '-warn');
  if (resultEl && type !== 'synth') { resultEl.innerHTML = ''; resultEl.classList.add('hidden'); }
  if (warnEl) { warnEl.innerHTML = ''; warnEl.classList.add('hidden'); }
  if (type === 'synth') updateSynthesisWorkbench();
  if (type === 'enhance') updateEnhanceWorkbench();
};

window._djxBuy = (itemKey, price) => {
  const p = window.game?.player;
  if (!p) return;
  const hasConfiguredItem =
    window._itemMetaByKey?.[itemKey] ||
    window._equipTemplates?.some(item => item.key === itemKey);
  if (!hasConfiguredItem) { window._showToast('物品配置不存在'); return; }
  if ((p.resources?.gold || 0) < price) { window._showToast('金币不足'); return; }
  const npcData = { type: 'shop', items: [{ item_key: itemKey, buy_price: price }] };
  const r = ShopSystem.buy(p, npcData, itemKey, 1);
  if (r && r.success) {
    window._showToast('购买成功');
    const goldText = (p.resources?.gold || 0).toLocaleString();
    const djxGold = document.getElementById('djxShopGold');
    if (djxGold) djxGold.textContent = goldText;
    window._renderDjxShop?.();
    window._renderYjlShop?.();
    window._renderPszShop?.();
  } else { window._showToast(r.message); }
};

let _shopQuantityState = null;
let _shopQuantityBound = false;

window._openShopQuantity = (mode, itemKey, price, name, icon, maxCount = 999, instanceId = '') => {
  const player = window.game?.player;
  if (!player) return;
  const isEquipment = !!instanceId;
  const affordable = mode === 'buy' ? Math.floor((player.resources?.gold || 0) / Math.max(1, price)) : maxCount;
  _shopQuantityState = {
    mode,
    itemKey,
    price: Number(price) || 0,
    name,
    icon,
    instanceId,
    max: Math.max(1, Math.min(isEquipment ? 1 : Number(maxCount) || 1, mode === 'buy' ? affordable : Number(maxCount) || 1)),
  };
  if (mode === 'buy' && affordable < 1) {
    window._showToast('金币不足');
    return;
  }
  _setupShopQuantityPopup();
  document.getElementById('qtyIcon').textContent = icon || '📦';
  document.getElementById('qtyName').textContent = name || itemKey;
  document.getElementById('qtyUnitPrice').textContent = Number(price || 0).toLocaleString();
  document.getElementById('qtyInput').value = '1';
  document.getElementById('qtyInput').max = String(_shopQuantityState.max);
  document.getElementById('qtyConfirm').textContent = mode === 'sell' ? '确认出售' : '确认购买';
  _updateShopQuantityTotal();
  document.getElementById('qtyBackdrop')?.classList.add('open');
};

function _updateShopQuantityTotal() {
  if (!_shopQuantityState) return;
  const input = document.getElementById('qtyInput');
  const value = Math.max(1, Math.min(_shopQuantityState.max, Number.parseInt(input?.value || '1', 10) || 1));
  if (input) input.value = String(value);
  const total = document.getElementById('qtyTotalPrice');
  if (total) total.textContent = (value * _shopQuantityState.price).toLocaleString();
}

function _setupShopQuantityPopup() {
  if (_shopQuantityBound) return;
  const popup = document.getElementById('qtyBackdrop');
  const input = document.getElementById('qtyInput');
  if (!popup || !input) return;
  _shopQuantityBound = true;
  document.getElementById('qtyMinus')?.addEventListener('click', () => { input.value = String((Number(input.value) || 1) - 1); _updateShopQuantityTotal(); });
  document.getElementById('qtyPlus')?.addEventListener('click', () => { input.value = String((Number(input.value) || 1) + 1); _updateShopQuantityTotal(); });
  popup.querySelectorAll('.qty-quick button').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.qty === 'max' ? String(_shopQuantityState?.max || 1) : String(button.dataset.qty || 1);
    _updateShopQuantityTotal();
  }));
  input.addEventListener('input', _updateShopQuantityTotal);
  document.getElementById('qtyConfirm')?.addEventListener('click', _confirmShopQuantity);
}

function _confirmShopQuantity() {
  const state = _shopQuantityState;
  const player = window.game?.player;
  if (!state || !player) return;
  const count = Math.max(1, Math.min(state.max, Number.parseInt(document.getElementById('qtyInput')?.value || '1', 10) || 1));
  let result;
  if (state.mode === 'buy') {
    result = ShopSystem.buy(player, { type: 'shop', items: [{ item_key: state.itemKey, name: state.name, buy_price: state.price }] }, state.itemKey, count);
  } else if (state.instanceId) {
    result = ShopSystem.sellEquipmentInstance(player, state.instanceId, state.price);
  } else {
    result = ShopSystem.sell(player, { type: 'shop', items: [] }, state.itemKey, count);
  }
  window._showToast(result?.message || '操作失败');
  document.getElementById('qtyBackdrop')?.classList.remove('open');
  _shopQuantityState = null;
  window._renderDjxShop?.();
  window._renderYjlShop?.();
  window._renderPszShop?.();
}

window._djxDoCraft = (type) => {
  const slots = window._djxSlots[type];
  if (!slots.equip) { showCraftResultToast(type, '请放入装备', false); return; }
  if (type === 'synth' && !slots.stone) { showCraftResultToast(type, '请放入合成石', false); return; }
  const p = window.game?.player;
  const result = type === 'synth'
    ? SynthesisSystem.synthesize(p, slots.equip, slots.stone)
    : EnhanceSystem.enhance(p, slots.equip);
  window._djxClearAll(type);
  if (result?.success !== false) {
    window._attrSys?.recompute?.(p);
    window.UIManager?._refreshAll?.();
  }
  window._renderDjxShop();
  showCraftResultToast(
    type,
    result?.message || (type === 'synth' ? '合成完成！' : '强化完成！'),
    result?.success !== false
  );
};

function showCraftResultToast(type, message, success) {
  const content = document.getElementById(`djx-${type}-content`);
  const sheet = content?.closest('.djx-shop');
  if (!content || !sheet) return;
  sheet.querySelector('.craft-result-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `craft-toast craft-result-toast ${success ? 'success' : 'error'}`;
  toast.textContent = message;
  toast.style.top = `${content.offsetTop + content.clientHeight / 2}px`;
  sheet.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

window._showToast = (msg) => {
  if (window.UIManager?.toast) window.UIManager.toast(msg, 'info');
  else alert(msg);
};

window._openYjlShop = () => {
  const backdrop = document.getElementById('yjlShopBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  window._renderYjlShop();
};

window._renderYjlShop = () => {
  const el = document.getElementById('yjl-weapon-content');
  if (!el) return;
  el.innerHTML = renderArmorShop(window.game?.player);
};

window._openPszShop = () => {
  const backdrop = document.getElementById('pszShopBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  window._renderPszShop();
};

window._renderPszShop = () => {
  const el = document.getElementById('psz-weapon-content');
  if (!el) return;
  el.innerHTML = renderPotionShop(window.game?.player);
};

window._sortShopInventory = () => {
  const player = window.game?.player;
  const slots = player?.inventory?.slots;
  if (!Array.isArray(slots)) return;
  player.inventory.slots = sortInventorySlots(slots, player);
  window.game?.saveNow?.();
  flushOpenInventorySurfaceRefresh();
  window._showToast('背包已整理');
};

window._sortInventory = window._sortShopInventory;

const SORT_CATEGORY_ORDER = { stones: 0, equipment: 1, consumables: 2, quest_items: 3, boxes: 4, unknown: 5 };
const SORT_STONE_ORDER = { enhance: 0, vajra: 1, cold_jade: 2, hot_blood: 3, other: 4 };
const SORT_EQUIP_SLOT_ORDER = {
  weapon: 0, chest: 1, gloves: 2, boots: 3, inner_armor: 4,
  cape: 5, amulet: 6, earring: 7, ring: 8,
};
const SORT_CAREER_ORDER = { blade: 0, sword: 1, spear: 2, staff: 3, common: 4 };
const SORT_FACTION_ORDER = { neutral: 0, positive: 1, negative: 2 };
const SORT_STONE_ATTR_LABELS = {
  atkSelfAdd: '攻击力', atkAdd: '攻击力', weaponSkillBonusAdd: '武功攻击力',
  weaponExtraDamageAdd: '追加伤害', hitAdd: '命中率', hitSelfAdd: '命中率',
  defAdd: '防御力', defSelfAdd: '防御力', maxHpAdd: '生命值', maxHpSelfAdd: '生命值',
  missingAdd: '闪避率', skill_level_up: '技能等级',
  enhanceSuccessRateAdd: '合成强化成功率', goldDropBonusAdd: '金币爆率',
};

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-CN');
}

function parseStoneSortInfo(itemKey) {
  const key = String(itemKey || '');
  const baseKey = key.includes('--') ? key.split('--')[0] : (key.match(/^((?:cold_jade|vajra|hot_blood)_\d+)_/)?.[1] || key);
  let hook = '';
  let value = 0;
  if (key.includes('--')) {
    [, hook, value] = key.split('--');
  } else {
    const legacy = key.match(/^(?:cold_jade|vajra|hot_blood)_\d+_(.+)_(-?\d+(?:\.\d+)?)$/);
    if (legacy) [, hook, value] = legacy;
  }
  const subtype = baseKey.startsWith('enhance_stone') ? 'enhance'
    : baseKey.startsWith('vajra') ? 'vajra'
      : baseKey.startsWith('cold_jade') ? 'cold_jade'
        : baseKey.startsWith('hot_blood') ? 'hot_blood'
          : 'other';
  const meta = window._itemMetaByKey?.[baseKey] || {};
  return {
    subtype,
    subtypeOrder: SORT_STONE_ORDER[subtype],
    attrLabel: SORT_STONE_ATTR_LABELS[hook] || hook,
    value: Number(value) || 0,
    name: meta.name || baseKey,
  };
}

function getEquipmentSortInfo(slot, player, equipmentInstances) {
  const instance = slot.instance_id ? equipmentInstances?.[slot.instance_id] : null;
  const itemKey = instance?.item_key || slot.item_key;
  const template = (player?._equipTemplates || window._equipTemplates || []).find(item => item.key === itemKey) || {};
  const careers = Array.isArray(template.required_career) ? template.required_career : [template.required_career].filter(Boolean);
  const career = careers[0] || 'common';
  const currentCareer = player?.career_family || '';
  const faction = template.faction || 'neutral';
  const currentFaction = player?.faction || '';
  return {
    slotOrder: SORT_EQUIP_SLOT_ORDER[template.slot] ?? 99,
    careerOrder: career === currentCareer ? -1 : (SORT_CAREER_ORDER[career] ?? 99),
    factionOrder: faction === currentFaction ? -1 : (SORT_FACTION_ORDER[faction] ?? 99),
    level: Number(template.required_level || 0),
    enhance: Number(instance?.enhance_level || 0),
    name: template.name || itemKey,
    instanceId: slot.instance_id || '',
  };
}

function getInventorySortInfo(slot, player, equipmentInstances, index) {
  const itemKey = slot.item_key || '';
  const itemClass = slot.instance_id
    ? 'equipment'
    : (InventorySystem._getItemClass?.(itemKey, player) || 'unknown');
  const info = { itemKey, itemClass, categoryOrder: SORT_CATEGORY_ORDER[itemClass] ?? SORT_CATEGORY_ORDER.unknown, index };
  if (itemClass === 'stones') info.stone = parseStoneSortInfo(itemKey);
  if (itemClass === 'equipment') info.equipment = getEquipmentSortInfo(slot, player, equipmentInstances);
  if (itemClass === 'consumables') {
    info.consumable = {
      typeOrder: itemKey.startsWith('hp_') ? 0 : itemKey.startsWith('mp_') ? 1 : 2,
      grade: Number(itemKey.match(/grade(\d+)/)?.[1] || 0),
    };
  }
  info.name = window._itemMetaByKey?.[itemKey]?.name || itemKey;
  return info;
}

function getStackClassifyPlayer(player, equipmentInstances) {
  return {
    ...(player || {}),
    inventory: {
      ...(player?.inventory || {}),
      equipment_instances: equipmentInstances || player?.inventory?.equipment_instances || {},
    },
  };
}

function isStackMergeableSlot(slot, player, equipmentInstances) {
  if (!slot?.item_key || (slot.count || 0) <= 0 || slot.instance_id) return false;
  const classifyPlayer = getStackClassifyPlayer(player, equipmentInstances);
  const itemClass = InventorySystem._getItemClass?.(slot.item_key, classifyPlayer) || 'unknown';
  if (itemClass === 'equipment') return false;
  return (InventorySystem._getMaxStack?.(slot.item_key, classifyPlayer) || 1) > 1;
}

function compactStackableSlots(slots, player, equipmentInstances) {
  const passthrough = [];
  const empty = [];
  const groups = new Map();

  for (const slot of slots || []) {
    if (!slot?.item_key || (slot.count || 0) <= 0) {
      empty.push(slot);
      continue;
    }
    if (!isStackMergeableSlot(slot, player, equipmentInstances)) {
      passthrough.push(slot);
      continue;
    }

    const itemKey = slot.item_key;
    if (!groups.has(itemKey)) {
      const template = { ...slot };
      delete template.count;
      groups.set(itemKey, {
        itemKey,
        template,
        count: 0,
        maxStack: Math.max(1, InventorySystem._getMaxStack?.(itemKey, getStackClassifyPlayer(player, equipmentInstances)) || 99),
      });
    }
    groups.get(itemKey).count += Number(slot.count || 0);
  }

  const stacked = [];
  for (const group of groups.values()) {
    let remaining = group.count;
    while (remaining > 0) {
      const take = Math.min(remaining, group.maxStack);
      stacked.push({ ...group.template, item_key: group.itemKey, count: take });
      remaining -= take;
    }
  }

  const filled = [...passthrough, ...stacked];
  const emptyCount = Math.max(0, (slots || []).length - filled.length);
  const normalizedEmpty = empty.slice(0, emptyCount);
  while (normalizedEmpty.length < emptyCount) normalizedEmpty.push({ item_key: null, count: 0 });
  return { filled, empty: normalizedEmpty };
}

function sortInventorySlots(slots, player, equipmentInstances = player?.inventory?.equipment_instances) {
  const compacted = compactStackableSlots(slots, player, equipmentInstances);
  const filled = compacted.filled
    .map((slot, index) => ({ slot, info: getInventorySortInfo(slot, player, equipmentInstances, index) }))
    .filter(entry => entry.slot?.item_key && (entry.slot.count || 0) > 0);
  const empty = compacted.empty;

  filled.sort((a, b) => {
    const ai = a.info;
    const bi = b.info;
    if (ai.itemKey === bi.itemKey) {
      const countCompare = Number(b.slot.count || 0) - Number(a.slot.count || 0);
      if (countCompare) return countCompare;
    }
    if (ai.categoryOrder !== bi.categoryOrder) return ai.categoryOrder - bi.categoryOrder;
    if (ai.stone && bi.stone) {
      if (ai.stone.subtypeOrder !== bi.stone.subtypeOrder) return ai.stone.subtypeOrder - bi.stone.subtypeOrder;
      const attrCompare = compareText(ai.stone.attrLabel, bi.stone.attrLabel);
      if (attrCompare) return attrCompare;
      if (ai.stone.value !== bi.stone.value) return bi.stone.value - ai.stone.value;
      const stoneNameCompare = compareText(ai.stone.name, bi.stone.name);
      if (stoneNameCompare) return stoneNameCompare;
    }
    if (ai.equipment && bi.equipment) {
      for (const key of ['slotOrder', 'careerOrder', 'factionOrder']) {
        if (ai.equipment[key] !== bi.equipment[key]) return ai.equipment[key] - bi.equipment[key];
      }
      if (ai.equipment.level !== bi.equipment.level) return bi.equipment.level - ai.equipment.level;
      if (ai.equipment.enhance !== bi.equipment.enhance) return bi.equipment.enhance - ai.equipment.enhance;
      const equipNameCompare = compareText(ai.equipment.name, bi.equipment.name);
      if (equipNameCompare) return equipNameCompare;
      const instanceCompare = compareText(ai.equipment.instanceId, bi.equipment.instanceId);
      if (instanceCompare) return instanceCompare;
    }
    if (ai.consumable && bi.consumable) {
      if (ai.consumable.typeOrder !== bi.consumable.typeOrder) return ai.consumable.typeOrder - bi.consumable.typeOrder;
      if (ai.consumable.grade !== bi.consumable.grade) return bi.consumable.grade - ai.consumable.grade;
    }
    const nameCompare = compareText(ai.name, bi.name);
    if (nameCompare) return nameCompare;
    const keyCompare = compareText(ai.itemKey, bi.itemKey);
    return keyCompare || ai.index - bi.index;
  });
  return [...filled.map(entry => entry.slot), ...empty];
}

window._openWarehouse = () => {
  _setupWarehousePopup();
  _renderWarehouse();
  const backdrop = document.getElementById('warehouseBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
};

const WH_CAPACITY = 50;

// Helper: render tile from dataset (module scope)
function _whRenderTile(t) {
  const c = parseInt(t.dataset.count, 10);
  let h = '<div class="bt-icon">' + t.dataset.icon + '</div><div class="bt-name">' + t.dataset.name + '</div>';
  if (t.dataset.quest) h += '<div class="bt-badge cross quest">任务</div>';
  if (c > 1) h += '<div class="bt-badge">×' + c + '</div>';
  t.innerHTML = h;
}

// Helper: make a bag-tile element from data object
function _whMakeTile(d) {
  const t = document.createElement('div');
  t.className = 'bag-tile' + (d.quest ? ' cross' : '');
  t.dataset.key = d.key;
  t.dataset.icon = d.icon || '📦';
  t.dataset.name = d.name || d.key;
  t.dataset.count = d.count;
  if (d.quest) t.dataset.quest = '1';
  const c = parseInt(d.count, 10);
  let h = '<div class="bt-icon">' + (d.icon || '📦') + '</div><div class="bt-name">' + (d.name || d.key) + '</div>';
  if (d.quest) h += '<div class="bt-badge cross quest">任务</div>';
  if (c > 1) h += '<div class="bt-badge">×' + c + '</div>';
  t.innerHTML = h;
  return t;
}

function _renderWarehouse() {
  const p = window.game?.player;
  if (!p) return;
  mountWarehouseGrids(p);
}

// Warehouse popup state
let _whMode = 'deposit';
let _whSrcGrid, _whDstGrid, _whTile, _whName, _whMaxQ = 1;
let _whEquipMode = 'deposit';
let _whEquipTile = null;
let _warehousePopupEventsBound = false;

function _whDetailPlayer(player, mode) {
  if (mode !== 'withdraw') return player;
  return {
    ...player,
    _equipTemplates: player._equipTemplates || window._equipTemplates || [],
    inventory: {
      ...player.inventory,
      equipment_instances: {
        ...(player.inventory?.equipment_instances || {}),
        ...(player.warehouse?.equipment_instances || {}),
      },
    },
  };
}

function _whOpenEquipmentDetail(tile, mode) {
  const popup = document.getElementById('whEquipPopup');
  const player = window.game?.player;
  const instanceId = tile.dataset.instanceId;
  if (!popup || !player || !instanceId) return;
  const detailPlayer = _whDetailPlayer(player, mode);
  const instance = detailPlayer.inventory?.equipment_instances?.[instanceId];
  const template = getEquipmentTemplate(detailPlayer, instance);
  if (!instance || !template) {
    window._showToast('装备数据异常，无法操作');
    return;
  }
  _whEquipMode = mode;
  _whEquipTile = tile;
  document.getElementById('whEquipIcon').textContent = tile.dataset.icon || '⚔';
  document.getElementById('whEquipName').textContent = `${template.name}${instance.enhance_level > 0 ? ` +${instance.enhance_level}` : ''}`;
  document.getElementById('whEquipSub').textContent = `装备 · ${template.slot}`;
  document.getElementById('whEquipBody').innerHTML = renderEquipmentDetail(detailPlayer, instanceId);
  document.getElementById('whEquipAction').textContent = mode === 'deposit' ? '存入' : '取出';
  popup.classList.add('open');
}

function _whDoEquipmentTransfer() {
  const player = window.game?.player;
  const popup = document.getElementById('whEquipPopup');
  const instanceId = _whEquipTile?.dataset.instanceId;
  const key = _whEquipTile?.dataset.key;
  if (!player || !instanceId || !key) return;
  const result = _whEquipMode === 'deposit'
    ? WarehouseSystem.deposit(player, key, 1, { instanceId })
    : WarehouseSystem.withdraw(player, key, 1, { instanceId });
  if (!result.success) {
    window._showToast(_whEquipMode === 'deposit' ? '该装备无法存入仓库' : '背包空间不足，无法取出');
    return;
  }
  popup?.classList.remove('open');
  _renderWarehouse();
  window.game?.saveNow?.();
  window._showToast(_whEquipMode === 'deposit' ? '装备已存入仓库' : '装备已取回背包');
}

function _whOpenPopup(tile, mode) {
  const popup = document.getElementById('whPopup');
  if (!popup) return;

  if (mode === 'deposit' && tile.dataset.quest) {
    window._showToast('该物品不可存入仓库');
    return;
  }

  _whMode = mode;
  _whTile = tile;
  _whName = tile.dataset.name;

  _whSrcGrid = mode === 'deposit'
    ? document.getElementById('whBagGrid')
    : document.getElementById('whWarehouseGrid');
  _whDstGrid = mode === 'deposit'
    ? document.getElementById('whWarehouseGrid')
    : document.getElementById('whBagGrid');

  _whMaxQ = tile.dataset.instanceId ? 1 : parseInt(tile.dataset.count, 10);

  const dstUsed = [..._whDstGrid.querySelectorAll('.bag-tile:not(.empty)')].length;

  document.getElementById('whIcon').textContent = tile.dataset.icon;
  document.getElementById('whName').textContent = _whName;
  document.getElementById('whMeta').textContent =
    (mode === 'deposit' ? '背包 ×' : '仓库 ×') + _whMaxQ +
    ' · ' + (mode === 'deposit' ? '仓库 ' : '背包 ') + dstUsed + '/' + WH_CAPACITY;
  document.getElementById('whConfirm').textContent = mode === 'deposit' ? '存入' : '取出';
  document.getElementById('whInput').value = 1;
  document.getElementById('whInput').max = _whMaxQ;
  popup.classList.add('open');
}

function _whDoTransfer() {
  const popup = document.getElementById('whPopup');
  const input = document.getElementById('whInput');
  const q = Math.max(1, Math.min(_whMaxQ, parseInt(input.value, 10) || 1));
  const key = _whTile.dataset.key;
  const instanceId = _whTile.dataset.instanceId || null;
  const player = window.game?.player;
  if (!player) return;
  const result = _whMode === 'deposit'
    ? WarehouseSystem.deposit(player, key, q, { instanceId })
    : WarehouseSystem.withdraw(player, key, q, { instanceId });
  if (!result.success) {
    window._showToast(_whMode === 'deposit' ? '仓库空间不足，无法存入' : '背包空间不足，无法取出');
    return;
  }
  _renderWarehouse();
  window.game?.saveNow?.();
  window._showToast((_whMode === 'deposit' ? '已存入 ' : '已取出 ') + _whName + ' ×' + q);
  popup.classList.remove('open');
}

// Setup warehouse popup events (called once)
function _setupWarehousePopup() {
  if (_warehousePopupEventsBound) return;

  const popup = document.getElementById('whPopup');
  if (!popup) return;
  const whWarehouseGrid = document.getElementById('whWarehouseGrid');
  const whBagGrid = document.getElementById('whBagGrid');
  const whCancel = document.getElementById('whCancel');
  const whConfirm = document.getElementById('whConfirm');
  const whEquipPopup = document.getElementById('whEquipPopup');
  const whEquipCancel = document.getElementById('whEquipCancel');
  const whEquipAction = document.getElementById('whEquipAction');
  if (!whWarehouseGrid || !whBagGrid || !whCancel || !whConfirm || !whEquipPopup || !whEquipCancel || !whEquipAction) return;

  _warehousePopupEventsBound = true;

  popup.querySelectorAll('.qty-step').forEach(b => {
    b.addEventListener('click', () => {
      const input = document.getElementById('whInput');
      input.value = Math.max(1, Math.min(_whMaxQ, parseInt(input.value, 10) + parseInt(b.dataset.step, 10)));
    });
  });

  popup.querySelectorAll('.qty-quick button').forEach(b => {
    b.addEventListener('click', () => {
      const input = document.getElementById('whInput');
      input.value = b.dataset.set === 'max' ? _whMaxQ : parseInt(b.dataset.set, 10);
    });
  });

  whCancel.addEventListener('click', () => popup.classList.remove('open'));
  popup.addEventListener('click', e => { if (e.target === popup) popup.classList.remove('open'); });
  whConfirm.addEventListener('click', _whDoTransfer);
  whEquipCancel.addEventListener('click', () => whEquipPopup.classList.remove('open'));
  whEquipPopup.addEventListener('click', e => { if (e.target === whEquipPopup) whEquipPopup.classList.remove('open'); });
  whEquipAction.addEventListener('click', _whDoEquipmentTransfer);

  // Delegate clicks on warehouse/bag grids
  whWarehouseGrid.addEventListener('click', e => {
    const t = e.target.closest('.bag-tile:not(.empty)');
    if (t?.dataset.instanceId) _whOpenEquipmentDetail(t, 'withdraw');
    else if (t) _whOpenPopup(t, 'withdraw');
  });

  whBagGrid.addEventListener('click', e => {
    const t = e.target.closest('.bag-tile:not(.empty)');
    if (t?.dataset.instanceId) _whOpenEquipmentDetail(t, 'deposit');
    else if (t) _whOpenPopup(t, 'deposit');
  });

  // Sort buttons
  document.querySelectorAll('#warehouseBackdrop .wh-sort').forEach(b => {
    b.addEventListener('click', () => {
      const player = window.game?.player;
      if (!player) return;
      if (b.dataset.sort === 'warehouse') {
        player.warehouse.slots = sortInventorySlots(
          player.warehouse?.slots || [],
          player,
          player.warehouse?.equipment_instances || {}
        );
        window.game?.saveNow?.();
        _renderWarehouse();
        window._showToast('仓库已整理');
      } else {
        window._sortShopInventory();
      }
    });
  });
}

window._closeNPCDialog = () => {
  document.getElementById('npcDialogBackdrop')?.classList.remove('open');
  window.game?.closeDialog?.();
};

window._closeModal = () => {
  UIManager.popModal();
};

window._confirmOfflineReward = () => {
  UIManager.closeModal(document.getElementById('modal-offline'));
  const player = window.game?.player;
  const shouldResumeCombat = !!player?.auto_play?.is_auto_play
    && !!player?.location?.current_sub_zone_key;
  UIManager.openPanel(shouldResumeCombat ? 'combat' : 'home');
  if (shouldResumeCombat) {
    window.game?.battle?.ensureInitialSpawn?.();
  }
  UIManager._refreshAll?.();
};

let _settingsExportScope = 'all';
let _settingsActiveTab = 'system';

window._switchSettingsTab = (tab) => {
  _settingsActiveTab = tab === 'autoplay' ? 'autoplay' : 'system';
  document.getElementById('settingsTabSystem')?.classList.toggle('active', _settingsActiveTab === 'system');
  document.getElementById('settingsTabAutoplay')?.classList.toggle('active', _settingsActiveTab === 'autoplay');
  document.getElementById('settingsPaneSystem')?.classList.toggle('active', _settingsActiveTab === 'system');
  document.getElementById('settingsPaneAutoplay')?.classList.toggle('active', _settingsActiveTab === 'autoplay');
  if (_settingsActiveTab === 'autoplay') renderAutoplayPanel(window.game?.player);
};

window._settingsSetExportScope = (scope) => {
  _settingsExportScope = scope === 'current' ? 'current' : 'all';
  document.getElementById('exportScopeAll')?.classList.toggle('on', _settingsExportScope === 'all');
  document.getElementById('exportScopeCurrent')?.classList.toggle('on', _settingsExportScope === 'current');
};

window._settingsExportSave = async () => {
  const text = await window.game?.exportSave?.({ include_all_characters: _settingsExportScope === 'all' });
  const output = document.getElementById('settingsExportText');
  if (output && text) output.value = text;
  if (text) window._settingsCopyExport();
  else UIManager.toast('导出失败：当前存档未能保存或没有可导出的角色', 'error');
};

window._settingsCopyExport = () => {
  const text = document.getElementById('settingsExportText')?.value || '';
  if (!text) {
    UIManager.toast('请先导出存档', 'info');
    return;
  }
  navigator.clipboard?.writeText(text)
    .then(() => UIManager.toast('存档文本已复制', 'success'))
    .catch(() => UIManager.toast('浏览器未允许复制，请手动复制文本', 'warn'));
};

window._settingsImportSave = () => {
  const raw = (document.getElementById('settingsImportText')?.value || '').trim();
  if (!raw) {
    UIManager.toast('请先粘贴存档文本', 'info');
    return;
  }
  window.game?.importSave?.(raw);
  UIManager.toast('正在导入存档...', 'info');
};

let _returningToSaveList = false;
window._returnToSaveList = async () => {
  if (_returningToSaveList) return;
  _returningToSaveList = true;
  try {
    const characters = await window.game?.returnToSaveList?.();
    UIManager.closeAllModals();
    UIManager.closePanel();
    showMultiSaveUI(window._currentGlobalSave, characters || [], window._careersData || []);
  } catch (err) {
    console.warn('[角色列表] 返回失败:', err);
    UIManager.toast('返回角色列表失败，请稍后重试', 'error');
  } finally {
    _returningToSaveList = false;
  }
};

window._startOfflineAutoplay = async () => {
  if (_returningToSaveList) return;
  const player = window.game?.player;
  if (!player?.auto_play?.is_auto_play || !player?.location?.current_sub_zone_key) {
    UIManager.toast('当前角色没有进行中的野外挂机', 'info');
    return;
  }
  UIManager.pushModal(document.getElementById('modal-offline-autoplay-confirm'));
};

window._confirmStartOfflineAutoplay = async () => {
  if (_returningToSaveList) return;
  UIManager.closeModal(document.getElementById('modal-offline-autoplay-confirm'));
  _returningToSaveList = true;
  try {
    const result = await window.game?.startOfflineAutoplay?.();
    if (!result?.success) {
      UIManager.toast(result?.message || '开始离线挂机失败', 'error');
      return;
    }
    UIManager.closeAllModals();
    UIManager.closePanel();
    showMultiSaveUI(window._currentGlobalSave, result.characters || [], window._careersData || []);
  } catch (err) {
    console.warn('[离线挂机] 返回角色列表失败:', err);
    UIManager.toast('开始离线挂机失败，请稍后重试', 'error');
  } finally {
    _returningToSaveList = false;
  }
};

function renderPanelContent(panelId) {
  const p = window.game?.player;
  switch (panelId) {
    case 'character':
      renderCharacterPanel(p);
      break;
    case 'inventory':
      renderInventoryPanel(p);
      break;
    case 'autoplay':
      renderAutoplayPanel(p);
      break;
    case 'quest':
      renderQuestPanel(p);
      break;
    case 'settings':
      window._switchSettingsTab(_settingsActiveTab);
      break;
  }
}

function renderCharacterPanel(player, options = {}) {
  const el = document.getElementById('character-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  const preserveScroll = options.preserveScroll === true;
  const scrollSelector = '#page-character .role-tab-body';
  const scrollEl = preserveScroll ? document.querySelector(scrollSelector) : null;
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
  syncCharacterHeader(p);
  mountCharacterPanel(el, p, window._characterActiveTab || 'info');
  if (scrollEl) {
    const restoreScroll = () => {
      const nextScrollEl = document.querySelector(scrollSelector);
      if (!nextScrollEl) return;
      nextScrollEl.scrollTop = Math.min(
        scrollTop,
        Math.max(0, nextScrollEl.scrollHeight - nextScrollEl.clientHeight),
      );
    };
    restoreScroll();
    requestAnimationFrame(() => {
      restoreScroll();
    });
  }
}

function syncCharacterHeader(player) {
  refreshPlayerIdentity(player, { prefix: 'char' });
  refreshPlayerAvatar(player, { prefix: 'char' });
  refreshPlayerStatusBar(player, { prefix: 'char' });
}

function renderQigongGrid(player) {
  renderCharacterPanel(player);
}

function renderCharacterTabContent(tab) {
  window._characterActiveTab = tab;
  renderCharacterPanel(window.game?.player);
}

function renderInventoryPanel(player) {
  const el = document.getElementById('inventory-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  mountInventoryPanel(el, p);
}

function renderAutoplayPanel(player) {
  const settingsPane = document.getElementById('settingsPaneAutoplay');
  const el = settingsPane?.classList.contains('active')
    ? document.getElementById('settings-autoplay-content')
    : document.getElementById('autoplay-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  const ap = p.auto_play || {};
  const attackCfg = ap.auto_attack || {};
  const healCfg = ap.auto_heal_skill || {};
  const buffCfg = ap.auto_buff_skill || {};
  const hpCfg = ap.auto_consume?.hp_potion || {};
  const mpCfg = ap.auto_consume?.mp_potion || {};
  const hpResupply = ap.auto_resupply?.trigger_rules?.hp || {};
  const mpResupply = ap.auto_resupply?.trigger_rules?.mp || {};
  const hpBuy = ap.auto_resupply?.purchase_rules?.hp || {};
  const mpBuy = ap.auto_resupply?.purchase_rules?.mp || {};
  const autoSell = ap.auto_sell || {};
  const equipmentFilter = autoSell.equipment || {};
  const autoStore = ap.auto_store || {};
  const autoStoreStoneRules = autoStore.stones?.rules || [];
  const autoStoreEquipmentKeys = autoStore.equipment?.item_keys || [];
  const escapeSettingText = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const potionName = {
    hp_potion_grade1: '金创药（小）', hp_potion_grade2: '金创药（中）', hp_potion_grade3: '金创药（大）',
    mp_potion_grade1: '人参', mp_potion_grade2: '野山参', mp_potion_grade3: '雪原参',
  };

  const toggleBtn = (kind, enabled, action, disabled = false) =>
    '<button class="autoplay-toggle ' + (enabled ? 'on' : 'off') + '" onclick="' + action + '"' + (disabled ? ' disabled' : '') + '>' + (enabled ? 'ON' : 'OFF') + '</button>';

  const learnedSkills = (window._martialArtsData || []).filter(skill =>
    skill.type === 'damage' && p.learned_martial_arts?.includes(skill.key)
  );
  const learnedHealSkills = (window._martialArtsData || []).filter(skill =>
    skill.type === 'heal' && p.learned_martial_arts?.includes(skill.key)
  );
  const learnedBuffSkills = (window._martialArtsData || []).filter(skill =>
    skill.type === 'buff' && p.learned_martial_arts?.includes(skill.key)
  );
  const selectedAttackSkill = learnedSkills.some(skill => skill.key === attackCfg.selected_skill_key)
    ? attackCfg.selected_skill_key
    : learnedSkills[0]?.key || '';
  const useSkillAttack = attackCfg.attack_type === 'skill';
  const customDropdown = (options, selected, handler, { kind = '', enabled = true, compact = false } = {}) => {
    const active = options.find(option => option.value === selected) || options[0] || { value: '', label: '暂无选项' };
    return `<div class="autoplay-dropdown${compact ? ' compact' : ''}${enabled ? '' : ' disabled'}" data-handler="${handler}" data-kind="${kind}">
      <button class="autoplay-dropdown-trigger" type="button" onclick="window._toggleAutoplayDropdown(event)"${enabled ? '' : ' disabled'}>${escapeSettingText(active.label)}</button>
      <div class="autoplay-dropdown-list">${options.map(option =>
        `<button class="autoplay-dropdown-item${option.value === active.value ? ' selected' : ''}" type="button" data-value="${escapeSettingText(option.value)}" onclick="window._selectAutoplayDropdown(event)">${escapeSettingText(option.label)}</button>`
      ).join('')}</div>
    </div>`;
  };
  const skillOptions = learnedSkills.length
    ? learnedSkills.map(skill => ({
      value: skill.key,
      label: `${skill.name}（内功 ${skill.cost?.mp ?? 0} / 伤害 ${skill.effect?.value ?? 0}）`,
    }))
    : [{ value: '', label: '暂无已学习的伤害武功' }];
  const healSkillOptions = learnedHealSkills.length
    ? learnedHealSkills.map(skill => ({
      value: skill.key,
      label: `${skill.name}（内功 ${skill.cost?.mp ?? 0} / 治疗 ${skill.effect?.value ?? 0}）`,
    }))
    : [{ value: '', label: '暂无已学习的治疗武功' }];
  const buffSkillOptions = learnedBuffSkills.length
    ? learnedBuffSkills.map(skill => ({
      value: skill.key,
      label: `${skill.name}（内功 ${skill.cost?.mp ?? 0}）`,
    }))
    : [{ value: '', label: '暂无已学习的增益武功' }];
  const selectedHealSkill = learnedHealSkills.some(skill => skill.key === healCfg.selected_skill_key)
    ? healCfg.selected_skill_key
    : learnedHealSkills[0]?.key || '';
  const selectedBuffSkill = learnedBuffSkills.some(skill => skill.key === buffCfg.selected_skill_key)
    ? buffCfg.selected_skill_key
    : learnedBuffSkills[0]?.key || '';

  const potionSelect = (kind, selected, enabled, handler = '_setAutoPotionItem') => {
    const keys = kind === 'hp' ? ['hp_potion_grade1','hp_potion_grade2','hp_potion_grade3'] : ['mp_potion_grade1','mp_potion_grade2','mp_potion_grade3'];
    return customDropdown([
      { value: '', label: '不使用' },
      ...keys.map(key => ({ value: key, label: `${potionName[key]}（${InventorySystem.count(p, key)}）` })),
    ], selected || '', handler, { kind, enabled });
  };

  const sliderRow = (label, value, min, max, step, action, id, suffix = '') =>
    '<div class="stat-line autoplay-range-row"><span class="sl-k">' + label + '</span>' +
    '<div class="autoplay-range-wrap">' +
    '<input class="autoplay-range" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" oninput="' + action + '"></div>' +
    '<span class="sl-v autoplay-range-value" id="' + id + '">' + value + suffix + '</span></div>';

  const autoSellGroup = (category, title, icon) => {
    const groupKey = category === 'vajra' ? 'vajra_stones' : 'cold_jade_stones';
    const definitions = window._stonesData?.[groupKey] || [];
    const attributes = new Map();
    definitions.forEach(stone => (stone.attribute?.pool || []).forEach(attribute => {
      const current = attributes.get(attribute.key);
      const max = Math.max(...(attribute.value_range || [0]));
      if (!current || max > current.max) attributes.set(attribute.key, { key: attribute.key, name: attribute.name, max });
    }));
    const rules = autoSell.categories?.[category]?.rules || {};
    const rows = [...attributes.values()].map(attribute => {
      const rule = rules[attribute.key] || {};
      return `<label class="auto-sell-rule">
        <input type="checkbox"${rule.enabled ? ' checked' : ''} onchange="window._setAutoSellRule('${category}','${attribute.key}','enabled',this.checked)">
        <span class="auto-sell-rule-name">${attribute.name}</span>
        <span class="auto-sell-rule-op">≤</span>
        <input class="auto-sell-value" type="number" min="0" max="${attribute.max}" step="1" value="${Number(rule.max_value ?? 0)}" onchange="window._setAutoSellRule('${category}','${attribute.key}','max_value',this.value)">
      </label>`;
    }).join('');
    return `<div class="auto-sell-group"><div class="auto-sell-group-title"><span>${icon} ${title}</span><span>出售属性值 ≤ X</span></div>${rows}</div>`;
  };

  const equipmentFilterGroup = () => {
    const slotLabels = {
      weapon: '武器', chest: '胸甲', gloves: '手套', boots: '鞋子', inner_armor: '内甲',
      ring: '戒指', earring: '耳环', amulet: '项链', cape: '披风',
    };
    const careerLabels = { blade: '刀客', sword: '剑客', spear: '枪客', staff: '医师' };
    const templates = window._equipTemplates || [];
    const selection = window._autoSellEquipmentSelection || {};
    const slot = slotLabels[selection.slot] ? selection.slot : 'weapon';
    const career = careerLabels[selection.career] ? selection.career : 'blade';
    const careerSlot = slot === 'weapon' || slot === 'chest';
    const candidates = templates.filter(item =>
      item.slot === slot
      && (!careerSlot || !item.required_career?.length || item.required_career.includes(career))
    );
    const selectedKey = candidates.some(item => item.key === selection.itemKey)
      ? selection.itemKey
      : candidates[0]?.key || '';
    window._autoSellEquipmentSelection = { slot, career, itemKey: selectedKey };
    const dropdownOptions = (items, labelOf) => items.map(item => ({ value: item, label: labelOf(item) }));
    const configuredKeys = equipmentFilter.item_keys || [];
    const configuredNames = configuredKeys.map(key => templates.find(item => item.key === key)?.name || key).join('；');
    const controlsDisabled = !autoSell.enabled;
    return `<div class="auto-sell-group auto-sell-equipment">
      <div class="auto-sell-group-title">
        <span>⚔ 装备出售过滤清单</span>
        ${toggleBtn('auto-sell-equipment', autoSell.enabled && equipmentFilter.enabled, 'window._toggleAutoSellEquipment()', controlsDisabled)}
      </div>
      <div class="auto-sell-equipment-controls${controlsDisabled || !equipmentFilter.enabled ? ' disabled' : ''}">
        <p class="hang-settings-note">开启后自动出售背包装备；过滤清单中的装备将被保留。</p>
        <label><span>装备类型</span>${customDropdown(dropdownOptions(Object.keys(slotLabels), key => slotLabels[key]), slot, '_setAutoSellEquipmentSelection', { kind: 'slot', enabled: !controlsDisabled && equipmentFilter.enabled, compact: true })}</label>
        <label><span>职业</span>${customDropdown(dropdownOptions(Object.keys(careerLabels), key => careerLabels[key]), career, '_setAutoSellEquipmentSelection', { kind: 'career', enabled: !controlsDisabled && equipmentFilter.enabled, compact: true })}</label>
        <label><span>装备名字</span>${customDropdown(dropdownOptions(candidates.map(item => item.key), key => templates.find(item => item.key === key)?.name || key), selectedKey, '_setAutoSellEquipmentSelection', { kind: 'itemKey', enabled: !controlsDisabled && equipmentFilter.enabled, compact: true })}</label>
        <div class="auto-sell-equipment-actions">
          <button class="btn-3d green" onclick="window._addAutoSellEquipmentFilter()"${!selectedKey || controlsDisabled || !equipmentFilter.enabled ? ' disabled' : ''}>添加保护装备</button>
          <button class="btn-3d red" onclick="window._clearAutoSellEquipmentFilter()"${!configuredKeys.length || controlsDisabled || !equipmentFilter.enabled ? ' disabled' : ''}>清空过滤清单</button>
        </div>
        <label class="auto-sell-equipment-list"><span>当前保护清单（不会自动出售）</span><textarea readonly placeholder="暂未添加保护装备">${escapeSettingText(configuredNames)}</textarea></label>
      </div>
    </div>`;
  };

  const autoStoreStoneGroup = () => {
    const categoryLabels = { enhance: '强化石', vajra: '金刚石', cold_jade: '寒玉石', hot_blood: '热血石' };
    const categoryGroups = {
      enhance: 'enhance_stones', vajra: 'vajra_stones', cold_jade: 'cold_jade_stones', hot_blood: 'hot_blood_stones',
    };
    const selection = window._autoStoreStoneSelection || {};
    const category = categoryLabels[selection.category] ? selection.category : 'enhance';
    const definitions = window._stonesData?.[categoryGroups[category]] || [];
    const attributes = new Map();
    definitions.forEach(stone => (stone.attribute?.pool || []).forEach(attribute => {
      const entry = attributes.get(attribute.key) || { key: attribute.key, name: attribute.name, values: new Set() };
      const [min, max] = attribute.value_range || [0, 0];
      if (Number.isInteger(min) && Number.isInteger(max)) {
        for (let value = min; value <= max; value++) entry.values.add(value);
      } else {
        entry.values.add(Number(min));
        entry.values.add(Number(max));
      }
      attributes.set(attribute.key, entry);
    }));
    const attributeOptions = [...attributes.values()];
    const attributeKey = attributeOptions.some(item => item.key === selection.attributeKey)
      ? selection.attributeKey
      : attributeOptions[0]?.key || '';
    const selectedAttribute = attributes.get(attributeKey);
    const values = [...(selectedAttribute?.values || [])].sort((a, b) => a - b);
    const selectedValue = values.some(value => String(value) === String(selection.value))
      ? String(selection.value)
      : values.length ? String(values[0]) : '';
    window._autoStoreStoneSelection = { category, attributeKey, value: selectedValue };

    const enabled = !!autoStore.enabled;
    const hasAttributes = category !== 'enhance' && attributeOptions.length > 0;
    const configuredNames = autoStoreStoneRules.map(rule => {
      if (rule.category === 'enhance') return categoryLabels.enhance;
      const group = window._stonesData?.[categoryGroups[rule.category]] || [];
      const attribute = group.flatMap(stone => stone.attribute?.pool || []).find(item => item.key === rule.attribute_key);
      return `${categoryLabels[rule.category] || rule.category}·${attribute?.name || rule.attribute_key}${rule.value}`;
    }).join('；');
    return `<div class="auto-sell-group auto-store-group">
      <div class="auto-sell-group-title"><span>💎 石头存仓库清单</span><span>精确匹配属性与数值</span></div>
      <div class="auto-sell-equipment-controls${enabled ? '' : ' disabled'}">
        <label><span>石头类型</span>${customDropdown(Object.keys(categoryLabels).map(key => ({ value: key, label: categoryLabels[key] })), category, '_setAutoStoreStoneSelection', { kind: 'category', enabled, compact: true })}</label>
        <label><span>属性类型</span>${customDropdown(attributeOptions.length ? attributeOptions.map(item => ({ value: item.key, label: item.name })) : [{ value: '', label: '无属性' }], attributeKey, '_setAutoStoreStoneSelection', { kind: 'attributeKey', enabled: enabled && hasAttributes, compact: true })}</label>
        <label><span>属性值</span>${customDropdown(values.length ? values.map(value => ({ value: String(value), label: String(value) })) : [{ value: '', label: '无属性值' }], selectedValue, '_setAutoStoreStoneSelection', { kind: 'value', enabled: enabled && hasAttributes, compact: true })}</label>
        <div class="auto-sell-equipment-actions">
          <button class="btn-3d green" onclick="window._addAutoStoreStoneRule()"${enabled && (category === 'enhance' || (attributeKey && selectedValue !== '')) ? '' : ' disabled'}>添加石头</button>
          <button class="btn-3d red" onclick="window._clearAutoStoreStoneRules()"${enabled && autoStoreStoneRules.length ? '' : ' disabled'}>清空石头清单</button>
        </div>
        <label class="auto-sell-equipment-list"><span>当前石头清单</span><textarea readonly placeholder="暂未添加石头">${escapeSettingText(configuredNames)}</textarea></label>
      </div>
    </div>`;
  };

  const autoStoreEquipmentGroup = () => {
    const slotLabels = {
      weapon: '武器', chest: '胸甲', gloves: '手套', boots: '鞋子', inner_armor: '内甲',
      ring: '戒指', earring: '耳环', amulet: '项链', cape: '披风',
    };
    const careerLabels = { blade: '刀客', sword: '剑客', spear: '枪客', staff: '医师' };
    const templates = window._equipTemplates || [];
    const selection = window._autoStoreEquipmentSelection || {};
    const slot = slotLabels[selection.slot] ? selection.slot : 'weapon';
    const career = careerLabels[selection.career] ? selection.career : 'blade';
    const careerSlot = slot === 'weapon' || slot === 'chest';
    const candidates = templates.filter(item =>
      item.slot === slot
      && (!careerSlot || !item.required_career?.length || item.required_career.includes(career))
    );
    const itemKey = candidates.some(item => item.key === selection.itemKey) ? selection.itemKey : candidates[0]?.key || '';
    window._autoStoreEquipmentSelection = { slot, career, itemKey };
    const enabled = !!autoStore.enabled;
    const configuredNames = autoStoreEquipmentKeys.map(key => templates.find(item => item.key === key)?.name || key).join('；');
    return `<div class="auto-sell-group auto-sell-equipment auto-store-group">
      <div class="auto-sell-group-title"><span>⚔ 装备存仓库清单</span><span>匹配装备名称</span></div>
      <div class="auto-sell-equipment-controls${enabled ? '' : ' disabled'}">
        <label><span>装备类型</span>${customDropdown(Object.keys(slotLabels).map(key => ({ value: key, label: slotLabels[key] })), slot, '_setAutoStoreEquipmentSelection', { kind: 'slot', enabled, compact: true })}</label>
        <label><span>职业</span>${customDropdown(Object.keys(careerLabels).map(key => ({ value: key, label: careerLabels[key] })), career, '_setAutoStoreEquipmentSelection', { kind: 'career', enabled, compact: true })}</label>
        <label><span>装备名字</span>${customDropdown(candidates.map(item => ({ value: item.key, label: item.name })), itemKey, '_setAutoStoreEquipmentSelection', { kind: 'itemKey', enabled, compact: true })}</label>
        <div class="auto-sell-equipment-actions">
          <button class="btn-3d green" onclick="window._addAutoStoreEquipment()"${enabled && itemKey ? '' : ' disabled'}>添加装备</button>
          <button class="btn-3d red" onclick="window._clearAutoStoreEquipment()"${enabled && autoStoreEquipmentKeys.length ? '' : ' disabled'}>清空装备清单</button>
        </div>
        <label class="auto-sell-equipment-list"><span>当前装备清单</span><textarea readonly placeholder="暂未添加装备">${escapeSettingText(configuredNames)}</textarea></label>
      </div>
    </div>`;
  };

  el.innerHTML = `
    <div class="sec-panel">
      <div class="panel-title"><span>⚔ 自动打怪</span></div>
      <div class="stat-line"><span class="sl-k">攻击方式</span>
        <div class="auto-attack-methods">
          <button class="btn-3d ${useSkillAttack ? '' : 'green'}" onclick="window._setAutoAttackType('normal')">普通攻击</button>
          <button class="btn-3d ${useSkillAttack ? 'green' : ''}" onclick="window._setAutoAttackType('skill')"${learnedSkills.length ? '' : ' disabled'}>技能攻击</button>
        </div>
      </div>
      <label class="auto-attack-skill-row">
        <span>使用武功</span>
        ${customDropdown(skillOptions, selectedAttackSkill, '_setAutoAttackSkill', { enabled: useSkillAttack && learnedSkills.length })}
      </label>
    </div>

    <div class="sec-panel">
      <div class="panel-title"><span>✨ 自动辅助武功</span></div>
      <div class="stat-line"><span class="sl-k">自动治疗</span>
        ${toggleBtn('heal-skill', healCfg.enabled, "window._toggleAutoSupportSkill('heal')", !learnedHealSkills.length)}
      </div>
      ${customDropdown(healSkillOptions, selectedHealSkill, '_setAutoSupportSkill', { kind: 'heal', enabled: healCfg.enabled && learnedHealSkills.length })}
      ${sliderRow('HP 阈值', Math.round((healCfg.threshold ?? 0.5) * 100), 5, 95, 5, "window._setAutoHealThreshold(this.value)", 'heal-skill-threshold-label', '%')}

      <div class="stat-line" style="margin-top:0.9rem"><span class="sl-k">自动增益</span>
        ${toggleBtn('buff-skill', buffCfg.enabled, "window._toggleAutoSupportSkill('buff')", !learnedBuffSkills.length)}
      </div>
      ${customDropdown(buffSkillOptions, selectedBuffSkill, '_setAutoSupportSkill', { kind: 'buff', enabled: buffCfg.enabled && learnedBuffSkills.length })}
    </div>

    <div class="sec-panel">
      <div class="panel-title"><span>💊 自动喝药</span></div>
      <!-- HP -->
      <div class="stat-line"><span class="sl-k">生命药剂</span>
        ${toggleBtn('hp', hpCfg.enabled, "window._toggleAutoPotion('hp')")}
      </div>
      ${potionSelect('hp', hpCfg.selected_item_key, hpCfg.enabled)}
      ${sliderRow('HP 阈值', Math.round((hpCfg.threshold ?? 0.3) * 100), 5, 95, 5, "window._setAutoPotionThreshold('hp', this.value)", 'hp-threshold-label', '%')}

      <!-- MP -->
      <div class="stat-line" style="margin-top:0.9rem"><span class="sl-k">内功药剂</span>
        ${toggleBtn('mp', mpCfg.enabled, "window._toggleAutoPotion('mp')")}
      </div>
      ${potionSelect('mp', mpCfg.selected_item_key, mpCfg.enabled)}
      ${sliderRow('MP 阈值', Math.round((mpCfg.threshold ?? 0.3) * 100), 5, 95, 5, "window._setAutoPotionThreshold('mp', this.value)", 'mp-threshold-label', '%')}
    </div>

    <div class="sec-panel">
      <div class="panel-title"><span>📦 自动补给</span></div>
      <p class="hang-settings-note" style="margin:0 0 0.6rem;font-size:0.7rem">🔁 药剂低于触发数量 → 自动回城购买 → 返回挂机</p>
      <!-- HP Resupply -->
      <div class="stat-line"><span class="sl-k">生命补给</span>
        ${toggleBtn('hp', hpResupply.enabled, "window._toggleAutoResupply('hp')")}
      </div>
      ${potionSelect('hp', hpBuy.selected_potion, hpResupply.enabled, '_setAutoResupplyItem')}
      ${sliderRow('触发', hpResupply.trigger_threshold ?? 10, 2, 50, 1, "window._setAutoResupplyTrigger('hp', this.value)", 'rs-hp-trigger-label')}
      ${sliderRow('买至', hpBuy.target_quantity ?? 50, 5, 999, 1, "window._setAutoResupplyTarget('hp', this.value)", 'rs-hp-target-label')}

      <!-- MP Resupply -->
      <div class="stat-line" style="margin-top:0.9rem"><span class="sl-k">内功补给</span>
        ${toggleBtn('mp', mpResupply.enabled, "window._toggleAutoResupply('mp')")}
      </div>
      ${potionSelect('mp', mpBuy.selected_potion, mpResupply.enabled, '_setAutoResupplyItem')}
      ${sliderRow('触发', mpResupply.trigger_threshold ?? 10, 2, 50, 1, "window._setAutoResupplyTrigger('mp', this.value)", 'rs-mp-trigger-label')}
      ${sliderRow('买至', mpBuy.target_quantity ?? 50, 5, 999, 1, "window._setAutoResupplyTarget('mp', this.value)", 'rs-mp-target-label')}
    </div>

    <div class="sec-panel auto-store-panel">
      <div class="panel-title"><span>📦 自动存仓库</span>${toggleBtn('auto-store', autoStore.enabled, 'window._toggleAutoStore()')}</div>
      <p class="hang-settings-note">包满自动回城，自动存仓库后再自动出售、自动补给</p>
      <div class="${autoStore.enabled ? '' : 'auto-sell-disabled'}">
        ${autoStoreStoneGroup()}
        ${autoStoreEquipmentGroup()}
      </div>
    </div>

    <div class="sec-panel auto-sell-panel">
      <div class="panel-title"><span>💰 自动出售</span>${toggleBtn('auto-sell', autoSell.enabled, 'window._toggleAutoSell()')}</div>
      <p class="hang-settings-note">包满自动回城，自动出售后再自动补给</p>
      <div class="${autoSell.enabled ? '' : 'auto-sell-disabled'}">
        ${autoSellGroup('vajra', '金刚石', '💠')}
        ${autoSellGroup('cold_jade', '寒玉石', '🔷')}
        ${equipmentFilterGroup()}
      </div>
    </div>

    <div style="margin-top:0.9rem">
      <button class="btn-3d green" style="width:100%;padding:0.9rem;font-size:0.95rem" onclick="window._saveAutoplaySettings()">保存设置</button>
    </div>
  `;
}

function updateAutoAttack(update) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  player.auto_play.auto_attack = {
    attack_type: 'normal',
    selected_skill_key: null,
    ...(player.auto_play.auto_attack || {}),
  };
  update(player.auto_play.auto_attack);
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._setAutoAttackType = (attackType) => {
  updateAutoAttack(config => {
    config.attack_type = attackType === 'skill' ? 'skill' : 'normal';
    if (config.attack_type === 'skill' && !config.selected_skill_key) {
      config.selected_skill_key = (window._martialArtsData || []).find(skill =>
        skill.type === 'damage' && window.game?.player?.learned_martial_arts?.includes(skill.key)
      )?.key || null;
    }
  });
};

window._setAutoAttackSkill = (skillKey) => {
  updateAutoAttack(config => { config.selected_skill_key = skillKey || null; });
};

function updateAutoSupportSkill(kind, update) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  const configKey = kind === 'buff' ? 'auto_buff_skill' : 'auto_heal_skill';
  player.auto_play[configKey] = {
    enabled: false,
    selected_skill_key: null,
    ...(kind === 'heal' ? { threshold: 0.5 } : {}),
    ...(player.auto_play[configKey] || {}),
  };
  update(player.auto_play[configKey]);
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._toggleAutoSupportSkill = (kind) => {
  updateAutoSupportSkill(kind, config => {
    config.enabled = !config.enabled;
    if (config.enabled && !config.selected_skill_key) {
      const type = kind === 'buff' ? 'buff' : 'heal';
      config.selected_skill_key = (window._martialArtsData || []).find(skill =>
        skill.type === type && window.game?.player?.learned_martial_arts?.includes(skill.key)
      )?.key || null;
    }
  });
};

window._setAutoSupportSkill = (kind, skillKey) => {
  updateAutoSupportSkill(kind, config => { config.selected_skill_key = skillKey || null; });
};

window._setAutoHealThreshold = value => {
  updateAutoSupportSkill('heal', config => {
    config.threshold = Math.max(0.05, Math.min(0.95, Number(value) / 100));
  });
};

function updateAutoPotion(kind, update) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  player.auto_play.auto_consume = player.auto_play.auto_consume || {};
  const key = kind === 'mp' ? 'mp_potion' : 'hp_potion';
  player.auto_play.auto_consume[key] = {
    enabled: true,
    selected_item_key: null,
    threshold: 0.3,
    ...(player.auto_play.auto_consume[key] || {}),
  };
  update(player.auto_play.auto_consume[key]);
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._toggleAutoPotion = (kind) => {
  const player = window.game?.player;
  const cfg = player?.auto_play?.auto_consume?.[kind === 'mp' ? 'mp_potion' : 'hp_potion'];
  const enabled = !(cfg?.enabled);
  updateAutoPotion(kind, config => {
    config.enabled = enabled;
    if (enabled && !config.selected_item_key) {
      config.selected_item_key = kind === 'mp' ? 'mp_potion_grade1' : 'hp_potion_grade1';
    }
    if (!enabled) config.selected_item_key = null;
  });
};

window._setAutoPotionItem = (kind, itemKey) => {
  updateAutoPotion(kind, config => { config.selected_item_key = itemKey || null; });
};

window._setAutoPotionThreshold = (kind, value) => {
  const threshold = Math.max(5, Math.min(95, Number(value) || 30));
  updateAutoPotion(kind, config => { config.threshold = threshold / 100; });
};

function updateAutoSell(update) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  player.auto_play.auto_sell = player.auto_play.auto_sell || { enabled: false, categories: {}, equipment: { enabled: false, item_keys: [] } };
  player.auto_play.auto_sell.categories = player.auto_play.auto_sell.categories || {};
  player.auto_play.auto_sell.equipment = player.auto_play.auto_sell.equipment || { enabled: false, item_keys: [] };
  player.auto_play.auto_sell.equipment.item_keys = player.auto_play.auto_sell.equipment.item_keys || [];
  update(player.auto_play.auto_sell);
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._toggleAutoSell = () => {
  updateAutoSell(config => {
    config.enabled = !config.enabled;
    if (!config.enabled) config.equipment.enabled = false;
  });
};

window._setAutoSellRule = (category, attributeKey, field, value) => {
  updateAutoSell(config => {
    config.categories[category] = config.categories[category] || { rules: {} };
    const rules = config.categories[category].rules = config.categories[category].rules || {};
    const rule = rules[attributeKey] = rules[attributeKey] || { enabled: false, max_value: 0 };
    if (field === 'enabled') rule.enabled = !!value;
    if (field === 'max_value') rule.max_value = Math.max(0, Number(value) || 0);
  });
};

window._toggleAutoSellEquipment = () => {
  updateAutoSell(config => {
    config.equipment.enabled = config.enabled ? !config.equipment.enabled : false;
  });
};

window._setAutoSellEquipmentSelection = (field, value) => {
  window._autoSellEquipmentSelection = {
    ...(window._autoSellEquipmentSelection || {}),
    [field]: value,
  };
  if (field !== 'itemKey') window._autoSellEquipmentSelection.itemKey = '';
  renderAutoplayPanel(window.game?.player);
};

window._addAutoSellEquipmentFilter = () => {
  const itemKey = window._autoSellEquipmentSelection?.itemKey;
  if (!itemKey || !window._equipTemplates?.some(item => item.key === itemKey)) return;
  updateAutoSell(config => {
    if (!config.enabled || !config.equipment.enabled) return;
    if (!config.equipment.item_keys.includes(itemKey)) config.equipment.item_keys.push(itemKey);
  });
};

window._clearAutoSellEquipmentFilter = () => {
  updateAutoSell(config => {
    if (!config.enabled || !config.equipment.enabled) return;
    config.equipment.item_keys = [];
  });
};

function updateAutoStore(update) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  player.auto_play.auto_store = player.auto_play.auto_store || {
    enabled: false,
    stones: { rules: [] },
    equipment: { item_keys: [] },
  };
  player.auto_play.auto_store.stones = player.auto_play.auto_store.stones || { rules: [] };
  player.auto_play.auto_store.stones.rules = player.auto_play.auto_store.stones.rules || [];
  player.auto_play.auto_store.equipment = player.auto_play.auto_store.equipment || { item_keys: [] };
  player.auto_play.auto_store.equipment.item_keys = player.auto_play.auto_store.equipment.item_keys || [];
  update(player.auto_play.auto_store);
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._toggleAutoStore = () => {
  updateAutoStore(config => { config.enabled = !config.enabled; });
};

window._setAutoStoreStoneSelection = (field, value) => {
  const selection = {
    ...(window._autoStoreStoneSelection || {}),
    [field]: value,
  };
  if (field === 'category') {
    selection.attributeKey = '';
    selection.value = '';
  } else if (field === 'attributeKey') {
    selection.value = '';
  }
  window._autoStoreStoneSelection = selection;
  renderAutoplayPanel(window.game?.player);
};

window._addAutoStoreStoneRule = () => {
  const selection = window._autoStoreStoneSelection || {};
  if (!selection.category) return;
  const rule = selection.category === 'enhance'
    ? { category: 'enhance', attribute_key: null, value: null }
    : { category: selection.category, attribute_key: selection.attributeKey, value: Number(selection.value) };
  if (rule.category !== 'enhance' && (!rule.attribute_key || !Number.isFinite(rule.value))) return;
  updateAutoStore(config => {
    if (!config.enabled) return;
    const duplicate = config.stones.rules.some(item =>
      item.category === rule.category
      && item.attribute_key === rule.attribute_key
      && Number(item.value) === Number(rule.value)
    );
    if (!duplicate) config.stones.rules.push(rule);
  });
};

window._clearAutoStoreStoneRules = () => {
  updateAutoStore(config => {
    if (config.enabled) config.stones.rules = [];
  });
};

window._setAutoStoreEquipmentSelection = (field, value) => {
  window._autoStoreEquipmentSelection = {
    ...(window._autoStoreEquipmentSelection || {}),
    [field]: value,
  };
  if (field !== 'itemKey') window._autoStoreEquipmentSelection.itemKey = '';
  renderAutoplayPanel(window.game?.player);
};

window._addAutoStoreEquipment = () => {
  const itemKey = window._autoStoreEquipmentSelection?.itemKey;
  if (!itemKey || !window._equipTemplates?.some(item => item.key === itemKey)) return;
  updateAutoStore(config => {
    if (!config.enabled) return;
    if (!config.equipment.item_keys.includes(itemKey)) config.equipment.item_keys.push(itemKey);
  });
};

window._clearAutoStoreEquipment = () => {
  updateAutoStore(config => {
    if (config.enabled) config.equipment.item_keys = [];
  });
};

window._saveAutoplaySettings = () => {
  window.game?.saveNow?.();
  UIManager.toast('挂机设置已保存', 'success');
};

window._toggleAutoplayDropdown = (event) => {
  event.stopPropagation();
  const dropdown = event.currentTarget?.closest('.autoplay-dropdown');
  if (!dropdown || dropdown.classList.contains('disabled')) return;
  document.querySelectorAll('.autoplay-dropdown.open').forEach(entry => {
    if (entry !== dropdown) entry.classList.remove('open');
  });
  dropdown.classList.toggle('open');
};

window._selectAutoplayDropdown = (event) => {
  event.stopPropagation();
  const item = event.currentTarget;
  const dropdown = item?.closest('.autoplay-dropdown');
  if (!dropdown || dropdown.classList.contains('disabled')) return;
  dropdown.classList.remove('open');
  const handler = window[dropdown.dataset.handler];
  if (typeof handler !== 'function') return;
  if (dropdown.dataset.kind) handler(dropdown.dataset.kind, item.dataset.value);
  else handler(item.dataset.value);
};

function renderQuestPanel(player) {
  const el = document.getElementById('quest-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  mountQuestPanel(el, p, window._questActiveSeg || 'accepted');
}

window._refreshActiveQuestPanel = () => {
  if (document.getElementById('page-quest')?.classList.contains('active')) {
    renderQuestPanel(window.game?.player);
  }
};

let _pendingRoleAction = null;

function openRoleConfirm({ icon = '⚠', title, body, confirmText = '确认', danger = false, action }) {
  const popup = document.getElementById('roleConfirmPopup');
  if (!popup) return;
  document.getElementById('roleConfirmIcon').textContent = icon;
  document.getElementById('roleConfirmTitle').textContent = title;
  document.getElementById('roleConfirmBody').textContent = body;
  const button = document.getElementById('roleConfirmAction');
  button.textContent = confirmText;
  button.classList.toggle('danger', danger);
  _pendingRoleAction = action;
  popup.classList.add('open');
}

window._closeRoleConfirm = () => {
  document.getElementById('roleConfirmPopup')?.classList.remove('open');
  _pendingRoleAction = null;
};

window._confirmRoleAction = () => {
  const action = _pendingRoleAction;
  window._closeRoleConfirm();
  action?.();
};

window._requestResetQigong = () => {
  const player = window.game?.player;
  if (!player) return;
  const cost = Math.floor(10000 * Math.pow(10, player.qigong?.attribute_reset_count || 0));
  openRoleConfirm({
    icon: '⚠',
    title: '重置气功',
    body: `将返还全部已投入气功点，并消耗 ${cost.toLocaleString()} 金币。`,
    confirmText: '确认重置',
    danger: true,
    action: () => window._resetQigong(),
  });
};

window._resetQigong = () => {
  const p = window.game?.player;
  if (!p) return;
  const r = QigongSystem.resetQigong(p);
  if (r && r.success) {
    window._attrSys?.recompute(p);
    UIManager.toast('气功已重置', 'success');
    renderCharacterPanel(p, { preserveScroll: true });
  } else {
    UIManager.toast(r?.message || '重置失败', 'error');
  }
};

window._investQigong = (key, pts) => {
  const p = window.game?.player;
  if (!p) return;
  const r = QigongSystem.investQigong(p, key, pts);
  if (r && r.success) {
    window._attrSys?.recompute(p);
    renderCharacterPanel(p, { preserveScroll: true });
  } else {
    UIManager.toast(r?.message || '分配失败', 'error');
  }
};

window._requestLearnMartial = (key) => {
  const martial = (window._martialArtsData || []).find(item => item.key === key);
  if (!martial) return;
  openRoleConfirm({
    icon: '📜',
    title: '学习武功',
    body: `确认学习「${martial.name}」？将消耗 ${(martial.learning_cost?.training || 0).toLocaleString()} 历练点。`,
    confirmText: '确认学习',
    action: () => window._learnMartial(key),
  });
};

window._learnMartial = (key) => {
  const player = window.game?.player;
  const martial = (window._martialArtsData || []).find(item => item.key === key);
  if (!player || !martial) return;
  player.learned_martial_arts = player.learned_martial_arts || [];
  if (player.learned_martial_arts.includes(key)) {
    UIManager.toast('该武功已经掌握', 'info');
    return;
  }
  const req = martial.requirement || {};
  const transferCount = Math.max(0, (player.career_history?.length || 1) - 1);
  if ((player.level || 1) < (req.level || 1) || transferCount < (req.min_transfer || 0)) {
    UIManager.toast('尚未满足武功学习条件', 'error');
    return;
  }
  const trainingCost = martial.learning_cost?.training || 0;
  player.resources = player.resources || { gold: 0, training: 0, merit: 0 };
  if ((player.resources.training || 0) < trainingCost) {
    UIManager.toast('历练点不足', 'error');
    return;
  }
  player.resources.training -= trainingCost;
  player.learned_martial_arts.push(key);
  window.game?.saveNow?.();
  UIManager.toast(`学会武功：${martial.name}`, 'success');
  renderCharacterPanel(player);
};

window._castMartialArt = key => {
  const player = window.game?.player;
  if (!player) return;
  const result = AutoPlaySystem.castSupportSkill(player, key, { source: 'manual' });
  if (!result.success) {
    UIManager.toast(result.message || '施放失败', 'error');
    return;
  }
  window._attrSys?.recompute(player);
  window.game?.saveNow?.();
  UIManager.toast(result.message, 'success');
  renderCharacterPanel(player, { preserveScroll: true });
};

window._switchQuestSeg = (seg) => {
  window._questActiveSeg = seg;
  renderQuestPanel(window.game?.player);
};

window._questSubmitHint = (ready) => {
  UIManager.toast(ready ? '请到泫渤派门主处提交任务' : '继续挂机收集任务物品', ready ? 'success' : 'info');
};

window._questAcceptHint = () => {
  UIManager.toast('请到泫渤派门主处接取任务', 'info');
};

window._stopAutoplay = () => { window.game?.stopAutoPlay(); UIManager.closePanel(); };
window._toggleZoneAutoplay = () => {
  if (window.game?.player?.auto_play?.is_auto_play) {
    window.game?.stopAutoPlay();
  } else {
    window.game?.startAutoPlay('combat_button');
  }
  UIManager._refreshAll?.();
};
window._returnToActiveCombat = () => {
  const player = window.game?.player;
  const battle = window.game?.battle;
  const battleZoneKey = typeof battle?._currentSubZone === 'string'
    ? battle._currentSubZone
    : battle?._currentSubZone?.key;
  if (!player?.auto_play?.is_auto_play || !battleZoneKey) {
    UIManager.toast('当前没有进行中的挂机战斗', 'info');
    return;
  }
  UIManager.openPanel('combat');
};

// 地图选择 sheet
// 地图数据（与 demo 同步）
const MAP_SHEET_DATA = [
  {
    name: '泫渤派城镇',
    icon: '🏠',
    meta: '补给点',
    zones: [
      { key: 'town_xuanbo', name: '泫渤派', level: '城镇', badge: '进入', isTown: true },
    ]
  },
  {
    name: '泫渤派郊外',
    icon: '🌾',
    meta: 'L3-35 · 6 区',
    zones: [
      { key: 'xuanbo_village', name: '村庄周围', level: 'L3-5', badge: '前往' },
      { key: 'xuanbo_field', name: '村庄野田', level: 'L8-12', badge: '前往' },
      { key: 'xuanbo_den', name: '狼熊聚居地', level: 'L12-15', badge: '前往' },
      { key: 'xuanbo_lumber', name: '伐木场', level: 'L18-22', badge: '前往' },
      { key: 'xuanbo_cemetery', name: '墓地', level: 'L22-30', badge: '前往' },
      { key: 'xuanbo_robber', name: '山寨', level: 'L30-35', badge: '前往' },
    ]
  },
  {
    name: '柳正关',
    icon: '⛩',
    meta: 'L35-59 · 7 区',
    zones: [
      { key: 'liuzheng_forest', name: '关外山林', level: 'L35-37', badge: '前往' },
      { key: 'liuzheng_fishing_village', name: '渔村', level: 'L38-42', badge: '前往' },
      { key: 'liuzheng_monster_camp', name: '怪兽营地', level: 'L43-45', badge: '前往' },
      { key: 'liuzheng_fire_thief_den', name: '火贼山寨', level: 'L47-50', badge: '前往' },
      { key: 'liuzheng_wanshou_pavilion', name: '万寿阁下层', level: 'L51-54', badge: '前往' },
      { key: 'liuzheng_wanshou_pavilion_upper', name: '万寿阁上层', level: 'L54-57', badge: '前往' },
      { key: 'liuzheng_deep_bamboo', name: '渊竹林', level: 'L57-59', badge: '前往' },
    ]
  },
  {
    name: '神武门',
    icon: '🏯',
    meta: 'L60-67 · 3 区',
    zones: [
      { key: 'shenwu_tiger_valley', name: '虎峡谷', level: 'L60-61', badge: '前往' },
      { key: 'shenwu_miser_cave', name: '吝啬鬼洞穴', level: 'L61-63', badge: '前往' },
      { key: 'shenwu_degenerate_land', name: '变质的荒地', level: 'L64-67', badge: '前往' },
    ]
  },
  {
    name: '三邪关',
    icon: '🗡',
    meta: 'L35-59 · 7 区',
    zones: [
      { key: 'sanxie_forest', name: '关外山林', level: 'L35-37', badge: '前往' },
      { key: 'sanxie_deserter_camp', name: '逃兵营地', level: 'L38-42', badge: '前往' },
      { key: 'sanxie_hunter_camp', name: '猎人寨', level: 'L43-45', badge: '前往' },
      { key: 'sanxie_green_forest_camp', name: '绿林寨', level: 'L47-50', badge: '前往' },
      { key: 'sanxie_wutian_lower', name: '无天阁下层', level: 'L51-54', badge: '前往' },
      { key: 'sanxie_wutian_upper', name: '无天阁上层', level: 'L54-57', badge: '前往' },
      { key: 'sanxie_bamboo_fire_forest', name: '竹火林', level: 'L57-59', badge: '前往' },
    ]
  },
  {
    name: '柳善提督府',
    icon: '🏛',
    meta: 'L60-67 · 3 区',
    zones: [
      { key: 'liushan_snake_valley', name: '蛇谷', level: 'L60-61', badge: '前往' },
      { key: 'liushan_black_pine_base', name: '黑松贼根据地', level: 'L61-63', badge: '前往' },
      { key: 'liushan_thief_nest', name: '盗贼巢穴', level: 'L64-67', badge: '前往' },
    ]
  },
  {
    name: '南明湖',
    icon: '🌊',
    meta: 'L68+ · 2 区（高危）',
    zones: [
      { key: 'nanminghu_lake', name: '南明湖', level: 'L68-71', badge: '前往' },
      { key: 'nanminghu_cave', name: '南明洞', level: 'L71-75', badge: '空区域', isEmpty: true },
    ]
  },
];

function renderMapSheetList(currentSubZoneKey) {
  const listEl = document.getElementById('map-sheet-list');
  if (!listEl) return;
  listEl.innerHTML = MAP_SHEET_DATA.map(group => `
    <div class="map-group">
      <div class="map-group-header">
        <span class="group-icon">${group.icon}</span>
        <span>${group.name}</span>
        ${group.meta ? `<span class="group-meta">${group.meta}</span>` : ''}
      </div>
      <div class="map-sub-list">
        ${group.zones.map(sz => {
          const isCurrent = currentSubZoneKey ? sz.key === currentSubZoneKey : !!sz.isTown;
          const isTown = sz.isTown;
          const isEmpty = sz.isEmpty;
          const badge = isCurrent ? '当前' : sz.badge;
          const originalBadge = isTown ? '进入' : isEmpty ? '空区域' : sz.badge;
          return `
            <div class="map-sub-item${isCurrent ? ' current' : ''}${isTown ? ' town' : ''}${isEmpty ? ' empty' : ''}"
              data-key="${sz.key}"
              data-label="${sz.name} ${sz.level}"
              data-original-badge="${originalBadge}"
              onclick="window._mapSheetSelect('${sz.key}', '${sz.name} ${sz.level}')">
              <span class="sub-name">${sz.name}</span>
              <span class="sub-level">${sz.level}</span>
              <span class="sub-badge">${badge}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

window._mapSheetTeleport = (subZoneKey) => {
  window.game?.teleport(subZoneKey);
  window._closeMapSheet();
};

window._mapSheetSelect = (key, name) => {
  const zoneNameEl = document.getElementById('zone-name');
  if (zoneNameEl) zoneNameEl.textContent = name;
  // 重置所有项的 badge
  document.querySelectorAll('#map-sheet-list .map-sub-item').forEach(i => {
    i.classList.remove('current');
    const b = i.querySelector('.sub-badge');
    if (i.classList.contains('town')) b.textContent = '进入';
    else if (i.classList.contains('empty')) b.textContent = '空区域';
    else b.textContent = '前往';
  });
  // 选中当前项
  const item = document.querySelector(`#map-sheet-list .map-sub-item[data-key="${key}"]`);
  if (item) {
    item.classList.add('current');
    item.querySelector('.sub-badge').textContent = '当前';
  }
  // 城镇直接返回，empty 不响应，其他触发传送
  if (item?.classList.contains('town')) {
    window.game?.town();
  } else if (!item?.classList.contains('empty')) {
    window.game?.teleport(key);
  }
  window._closeMapSheet();
};

window._mapSheetTown = () => {
  window.game?.town();
  window._closeMapSheet();
};

window._openMapSheet = () => {
  const backdrop = document.getElementById('mapSheet');
  if (backdrop) {
    backdrop.classList.add('open');
    renderMapSheetList(getCurrentSubZoneKey());
  }
};

window._closeMapSheet = () => {
  const backdrop = document.getElementById('mapSheet');
  if (!backdrop) return;
  const sheet = backdrop.querySelector('.bottom-sheet');
  if (sheet) {
    sheet.classList.add('closing');
    setTimeout(() => {
      backdrop.classList.remove('open');
      sheet.classList.remove('closing');
    }, 350);
  } else {
    backdrop.classList.remove('open');
  }
};
document.addEventListener('click', (e) => {
  const inventoryTile = e.target.closest('#inventoryBagGrid .bag-tile[data-key]');
  if (inventoryTile) {
    return;
  }

  // mapSheet close button
  if (e.target.id === 'mapSheetClose') window._closeMapSheet();
  // mapSheet backdrop click to close
  const mapSheet = document.getElementById('mapSheet');
  if (mapSheet && e.target === mapSheet) window._closeMapSheet();
  // NPC dialog func buttons
  const btn = e.target.closest('.npc-func-btn');
  if (btn) {
    const npc = btn.dataset.npc;
    const func = btn.dataset.func;
    window._closeNPCDialog();
    if (npc === 'djx' && func === '武器商店') window._openDjxShop('weapon');
    else if (npc === 'djx' && func === '强化') window._openDjxShop('enhance');
    else if (npc === 'djx' && func === '合成') window._openDjxShop('synth');
    else if (npc === 'yjl') window._openYjlShop();
    else if (npc === 'psz') window._openPszShop();
    else if (npc === 'wdb' || func === '打开仓库') window._openWarehouse();
  }
  // NPC dialog close
  if (e.target.id === 'npcDialogClose') window._closeNPCDialog();
  if (e.target.id === 'npcDialogBackdrop') window._closeNPCDialog();
  // Shop sheet close
  if (e.target.id === 'djxShopBack') {
    document.getElementById('djxShopBackdrop')?.classList.remove('open');
    if (_djxCurrentTab === 'synth') openTownNPCDialog('djx');
  }
  if (e.target.id === 'djxShopBackdrop') document.getElementById('djxShopBackdrop')?.classList.remove('open');
  // 银娇龙/平十指 shop 关闭
  if (e.target.id === 'yjlShopBack' || e.target.id === 'yjlShopBackdrop') document.getElementById('yjlShopBackdrop')?.classList.remove('open');
  if (e.target.id === 'pszShopBack' || e.target.id === 'pszShopBackdrop') document.getElementById('pszShopBackdrop')?.classList.remove('open');
  // Shop sheet close (通用)
  if (e.target.id === 'shopBack') document.getElementById('shopBackdrop')?.classList.remove('open');
  if (e.target.id === 'shopBackdrop') document.getElementById('shopBackdrop')?.classList.remove('open');
  // Warehouse sheet close
  if (e.target.id === 'warehouseBack') document.getElementById('warehouseBackdrop')?.classList.remove('open');
  if (e.target.id === 'warehouseBackdrop') document.getElementById('warehouseBackdrop')?.classList.remove('open');
  // Craft sheet close
  if (e.target.id === 'craftBack') document.getElementById('craftBackdrop')?.classList.remove('open');
  if (e.target.id === 'craftBackdrop') document.getElementById('craftBackdrop')?.classList.remove('open');
  // Qty popup close
  if (e.target.id === 'qtyCancel') document.getElementById('qtyBackdrop')?.classList.remove('open');
  if (e.target.id === 'qtyBackdrop') document.getElementById('qtyBackdrop')?.classList.remove('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.autoplay-dropdown')) {
    document.querySelectorAll('.autoplay-dropdown.open').forEach(entry => entry.classList.remove('open'));
  }
  const btn = e.target.closest('.menu-btn[data-panel]');
  if (btn) {
    if (btn.getAttribute('onclick')) return;
    const panel = btn.dataset.panel;
    if (panel !== 'home') window._openPanel(panel);
  }
});

// Setup warehouse popup events (once)
_setupWarehousePopup();

function updateAutoResupply(kind, updateFn) {
  const player = window.game?.player;
  if (!player) return;
  player.auto_play = player.auto_play || {};
  player.auto_play.auto_resupply = player.auto_play.auto_resupply || { trigger_rules: {}, purchase_rules: {} };
  const resupply = player.auto_play.auto_resupply;
  resupply.trigger_rules[kind] = { enabled: true, selected_potion: null, trigger_threshold: 10, ...(resupply.trigger_rules[kind] || {}) };
  resupply.purchase_rules[kind] = { enabled: true, selected_potion: null, target_quantity: 50, ...(resupply.purchase_rules[kind] || {}) };
  updateFn(resupply.trigger_rules[kind], resupply.purchase_rules[kind]);
  if (kind === 'hp') { resupply.purchase_rules.hp = resupply.purchase_rules[kind]; resupply.trigger_rules.hp = resupply.trigger_rules[kind]; }
  if (kind === 'mp') { resupply.purchase_rules.mp = resupply.purchase_rules[kind]; resupply.trigger_rules.mp = resupply.trigger_rules[kind]; }
  window.game?.saveNow?.();
  renderAutoplayPanel(player);
}

window._toggleAutoResupply = (kind) => {
  updateAutoResupply(kind, (trigger, buy) => { trigger.enabled = !trigger.enabled; buy.enabled = !buy.enabled; });
};

window._setAutoResupplyItem = (kind, itemKey) => {
  updateAutoResupply(kind, (trigger, buy) => { trigger.selected_potion = itemKey || null; buy.selected_potion = itemKey || null; });
};

window._setAutoResupplyTrigger = (kind, value) => {
  const v = Math.max(2, Math.min(50, Number(value) || 10));
  updateAutoResupply(kind, (trigger) => { trigger.trigger_threshold = v; });
};

window._setAutoResupplyTarget = (kind, value) => {
  const v = Math.max(5, Math.min(999, Number(value) || 50));
  updateAutoResupply(kind, (trigger, buy) => { buy.target_quantity = v; });
};
