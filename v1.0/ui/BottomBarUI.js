/**
 * @file ui/BottomBarUI.js
 * @desc 底部导航 + 主面板切换桥接函数
 */
import { UIManager } from './UIManager.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { ConsumableSystem } from '../systems/ConsumableSystem.js';
import { BoxSystem } from '../systems/BoxSystem.js';
import { SynthesisSystem } from '../systems/SynthesisSystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js';
import { QigongSystem } from '../systems/QigongSystem.js';
import { mountCharacterPanel } from './CharacterUI.js';
import { mountInventoryPanel } from './InventoryUI.js?v=phase6-items-1';
import { mountQuestPanel } from './TaskUI.js';
import { mountWarehouseGrids, syncWarehouseTilesToPlayer } from './WarehouseUI.js';
import { openTownNPCDialog } from './NPCDialogUI.js?v=phase5-offline-1';
import { renderArmorShop, renderPotionShop, renderWeaponShop } from './ShopUI.js';
import { renderEnhanceWorkbench } from './EnhanceUI.js';
import { renderSynthesisWorkbench } from './SynthesisUI.js';

window._openPanel = (panelId) => {
  UIManager.openPanel(panelId);
  // 主面板的 panel 内容需要按需渲染
  if (panelId !== 'main' && panelId !== 'combat') {
    renderPanelContent(panelId);
  }
};

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
  setActiveDjxTabContent(_djxCurrentTab);
  backdrop.classList.add('open');
  window._renderDjxShop();
};

window._switchDjxTab = (tab) => {
  _djxCurrentTab = tab;
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  setActiveDjxTabContent(tab);
  window._renderDjxShop();
};

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

window._djxDragItem = (e, itemKey, type) => {
  e.dataTransfer.setData('text/plain', itemKey + '|' + type);
};

window._djxDropItem = (e, slotType, type) => {
  e.preventDefault();
  e.target.closest('.craft-dropzone')?.classList.remove('dragover');
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;
  const [itemKey, dragType] = data.split('|');
  const stoneKey = itemKey.includes('stone') || itemKey.includes('gem');
  const expectedType = slotType === 'stone' ? 'synth' : 'equip';
  // 石头只能放stone槽，装备只能放equip槽
  if (slotType === 'stone' && !stoneKey) {
    const zone = e.target.closest('.craft-dropzone');
    if (zone) { zone.classList.add('reject'); setTimeout(() => zone.classList.remove('reject'), 300); }
    return;
  }
  if (slotType === 'equip' && stoneKey) {
    const zone = e.target.closest('.craft-dropzone');
    if (zone) { zone.classList.add('reject'); setTimeout(() => zone.classList.remove('reject'), 300); }
    return;
  }
  window._djxSelectItem(itemKey, type);
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

window._djxSelectItem = (key, type) => {
  const stoneKey = isCraftStoneKey(key);
  const dataKey = stoneKey ? 'stone' : 'equip';
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
      ? (type === 'synth' ? '拖入<br>合成石' : '强化石<br>自动消耗')
      : '选择已穿戴装备';
    targetZone.innerHTML = `<div class="dz-plus">＋</div><div class="dz-hint">${hint}</div>`;
  }
  updateDjxCraftButton(type);
};

window._djxClearAll = (type) => {
  window._djxSlots[type] = {};
  ['equip', 'stone'].forEach(s => window._djxClearSlot(s, type));
  const resultEl = document.getElementById('djx-' + type + '-result');
  const warnEl = document.getElementById('djx-' + type + '-warn');
  if (resultEl) { resultEl.innerHTML = ''; resultEl.classList.add('hidden'); }
  if (warnEl) { warnEl.innerHTML = ''; warnEl.classList.add('hidden'); }
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

window._djxDoCraft = (type) => {
  const slots = window._djxSlots[type];
  const resultEl = document.getElementById('djx-' + type + '-result');
  const warnEl = document.getElementById('djx-' + type + '-warn');
  const confirmBtn = document.querySelector(`#djx-${type}-content .craft-confirm`);
  if (!slots.equip) { if (resultEl) resultEl.innerHTML = '请放入装备'; return; }
  if (type === 'synth' && !slots.stone) { if (resultEl) resultEl.innerHTML = '请放入合成石'; return; }
  if (resultEl) resultEl.innerHTML = (type === 'synth' ? '合成中...' : '强化中...');
  if (resultEl) resultEl.classList.remove('hidden');
  if (warnEl) warnEl.classList.add('hidden');
  const p = window.game?.player;
  setTimeout(() => {
    let r;
    if (type === 'synth') r = SynthesisSystem.synthesize(p, slots.equip, slots.stone);
    else r = EnhanceSystem.enhance(p, slots.equip);
    window._djxClearAll(type);
    if (r?.success !== false) {
      if (resultEl) resultEl.innerHTML = type === 'synth' ? '✅ 合成完成！' : '✅ 强化成功！';
      window._showToast(type === 'synth' ? '合成完成！' : '强化完成！');
    } else {
      if (type === 'enhance' && warnEl) { warnEl.innerHTML = '⚠️ 强化失败 → 装备碎裂'; warnEl.classList.remove('hidden'); }
      if (resultEl) resultEl.innerHTML = r?.message || (type === 'synth' ? '合成失败' : '强化失败');
      window._showToast(r?.message || (type === 'synth' ? '合成失败' : '强化失败'));
    }
    window._renderDjxShop();
  }, 500);
};

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
  if (t.dataset.quest) h += '<div class="bt-badge cross">任务</div>';
  else if (c > 1) h += '<div class="bt-badge">×' + c + '</div>';
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
  if (d.quest) h += '<div class="bt-badge cross">任务</div>';
  else if (c > 1) h += '<div class="bt-badge">×' + c + '</div>';
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
let _warehousePopupEventsBound = false;

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

  _whMaxQ = parseInt(tile.dataset.count, 10);

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
  const dstGrid = _whDstGrid;

  // Find existing tile in destination
  const destTile = [...dstGrid.querySelectorAll('.bag-tile:not(.empty)')].find(t => t.dataset.key === key);
  const dstUsed = [...dstGrid.querySelectorAll('.bag-tile:not(.empty)')].length;

  if (!destTile && dstUsed >= WH_CAPACITY) {
    window._showToast(_whMode === 'deposit' ? '仓库已满，无法存入' : '背包已满，无法取出');
    return;
  }

  if (destTile) {
    destTile.dataset.count = parseInt(destTile.dataset.count, 10) + q;
    _whRenderTile(destTile);
  } else {
    const t = document.createElement('div');
    t.className = 'bag-tile' + (_whTile.dataset.quest ? ' cross' : '');
    t.dataset.key = key;
    t.dataset.icon = _whTile.dataset.icon;
    t.dataset.name = _whName;
    t.dataset.count = q;
    if (_whTile.dataset.quest) t.dataset.quest = '1';
    _whRenderTile(t);
    const empty = dstGrid.querySelector('.bag-tile.empty');
    if (empty) empty.replaceWith(t);
    else dstGrid.appendChild(t);
  }

  const left = parseInt(_whTile.dataset.count, 10) - q;
  if (left <= 0) {
    const srcGrid = _whSrcGrid;
    _whTile.remove();
    const empty = document.createElement('div');
    empty.className = 'bag-tile empty';
    srcGrid.appendChild(empty);
  } else {
    _whTile.dataset.count = left;
    _whRenderTile(_whTile);
  }

  // Update counts
  const whSlots = [...document.getElementById('whWarehouseGrid').querySelectorAll('.bag-tile:not(.empty)')].length;
  const bagSlots = [...document.getElementById('whBagGrid').querySelectorAll('.bag-tile:not(.empty)')].length;
  document.getElementById('whWarehouseCount').textContent = whSlots + ' / ' + WH_CAPACITY;
  document.getElementById('whBagCount').textContent = bagSlots + ' / ' + WH_CAPACITY;

  // Sync to player data
  _syncWarehouseToPlayer();
  _syncBagToPlayer(key, q, _whMode);

  window._showToast((_whMode === 'deposit' ? '已存入 ' : '已取出 ') + _whName + ' ×' + q);
  popup.classList.remove('open');
}

function _syncWarehouseToPlayer() {
  const p = window.game?.player;
  if (!p) return;
  syncWarehouseTilesToPlayer(p);
}

function _syncBagToPlayer(key, count, mode) {
  const p = window.game?.player;
  if (!p) return;
  p.inventory = p.inventory || { slots: [] };
  const existing = p.inventory.slots.find(s => (s.item_key || s.key) === key);
  if (mode === 'withdraw') {
    if (existing) {
      existing.count += count;
    } else {
      p.inventory.slots.push({ item_key: key, key, count });
    }
  } else {
    if (existing) {
      existing.count -= count;
      if (existing.count <= 0) {
        p.inventory.slots = p.inventory.slots.filter(s => (s.item_key || s.key) !== key);
      }
    }
  }
}

function _whSortGrid(grid) {
  const tiles = [...grid.querySelectorAll('.bag-tile:not(.empty)')];
  tiles.sort((a, b) => a.dataset.key.localeCompare(b.dataset.key));
  grid.innerHTML = '';
  tiles.forEach(t => grid.appendChild(t));
  while (grid.querySelectorAll('.bag-tile').length < WH_CAPACITY) {
    const empty = document.createElement('div');
    empty.className = 'bag-tile empty';
    grid.appendChild(empty);
  }
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
  if (!whWarehouseGrid || !whBagGrid || !whCancel || !whConfirm) return;

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

  // Delegate clicks on warehouse/bag grids
  whWarehouseGrid.addEventListener('click', e => {
    const t = e.target.closest('.bag-tile:not(.empty)');
    if (t) _whOpenPopup(t, 'withdraw');
  });

  whBagGrid.addEventListener('click', e => {
    const t = e.target.closest('.bag-tile:not(.empty)');
    if (t) _whOpenPopup(t, 'deposit');
  });

  // Sort buttons
  document.querySelectorAll('.wh-sort').forEach(b => {
    b.addEventListener('click', () => {
      _whSortGrid(b.dataset.sort === 'warehouse'
        ? document.getElementById('whWarehouseGrid')
        : document.getElementById('whBagGrid'));
    });
  });
}

window._closeNPCDialog = () => {
  document.getElementById('npcDialogBackdrop')?.classList.remove('open');
};

window._closeModal = () => {
  UIManager.popModal();
};

let _settingsExportScope = 'all';

window._settingsSetExportScope = (scope) => {
  _settingsExportScope = scope === 'current' ? 'current' : 'all';
  document.getElementById('exportScopeAll')?.classList.toggle('active', _settingsExportScope === 'all');
  document.getElementById('exportScopeCurrent')?.classList.toggle('active', _settingsExportScope === 'current');
};

window._settingsExportSave = () => {
  const text = window.game?.exportSave?.({ include_all_characters: _settingsExportScope === 'all' });
  const output = document.getElementById('settingsExportText');
  if (output && text) output.value = text;
  if (text) window._settingsCopyExport();
  else UIManager.toast('导出失败：没有可导出的角色', 'error');
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

window._returnToSaveList = async () => {
  window.game?.saveNow?.();
  const { showMultiSaveUI } = await import('./MultiSaveUI.js?v=phase5-offline-1');
  const characters = window.game?.listCharacters?.() || [];
  UIManager.closePanel();
  showMultiSaveUI(window._currentGlobalSave, characters, window._careersData || []);
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
  }
}

function renderCharacterPanel(player) {
  const el = document.getElementById('character-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  mountCharacterPanel(el, p, window._characterActiveTab || 'info');
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

function openInventoryItemAction(tile) {
  const p = window.game?.player;
  if (!p || !tile?.dataset?.key) return;
  const itemKey = tile.dataset.key;
  const itemClass = tile.dataset.class;
  const count = Math.max(1, Number(tile.dataset.count || InventorySystem.count(p, itemKey) || 1));
  if (itemClass === 'consumables') {
    openQuantityAction({
      mode: 'consume',
      itemKey,
      icon: tile.dataset.icon || '🍶',
      name: tile.dataset.name || itemKey,
      max: count,
      defaultQty: 1,
    });
    return;
  }
  if (itemClass === 'boxes') {
    openQuantityAction({
      mode: 'box',
      itemKey,
      icon: tile.dataset.icon || '🎁',
      name: tile.dataset.name || itemKey,
      max: count,
      defaultQty: count,
    });
    return;
  }
  if (itemClass === 'quest_items') {
    UIManager.toast('任务物品不可使用或出售', 'info');
    return;
  }
  UIManager.toast('该物品暂不支持直接使用', 'info');
}

function openQuantityAction({ mode, itemKey, icon, name, max, defaultQty }) {
  const backdrop = document.getElementById('qtyBackdrop');
  const input = document.getElementById('qtyInput');
  const confirm = document.getElementById('qtyConfirm');
  if (!backdrop || !input || !confirm) return;

  const safeMax = Math.max(1, Math.floor(max || 1));
  const setQty = (value) => {
    input.value = String(Math.min(safeMax, Math.max(1, Math.floor(Number(value) || 1))));
    updateQuantityActionMeta(mode, itemKey);
  };

  document.getElementById('qtyIcon').textContent = icon;
  document.getElementById('qtyName').textContent = name;
  document.querySelector('#qtyBackdrop .qty-unit').innerHTML = `拥有: <b>${safeMax}</b> 个`;
  input.min = '1';
  input.max = String(safeMax);
  setQty(defaultQty || 1);
  confirm.textContent = mode === 'consume' ? '使用' : '开盒';
  confirm.onclick = () => confirmQuantityAction(mode, itemKey);

  document.getElementById('qtyMinus').onclick = () => setQty(Number(input.value) - 1);
  document.getElementById('qtyPlus').onclick = () => setQty(Number(input.value) + 1);
  input.oninput = () => setQty(input.value);
  document.querySelectorAll('#qtyBackdrop .qty-quick button').forEach(btn => {
    btn.onclick = () => setQty(Number(input.value) + Number(btn.dataset.qty || 0));
  });

  backdrop.classList.add('open');
}

function updateQuantityActionMeta(mode, itemKey) {
  const p = window.game?.player;
  const input = document.getElementById('qtyInput');
  const total = document.querySelector('#qtyBackdrop .qty-total');
  const qty = Math.max(1, Number(input?.value || 1));
  if (!total) return;
  if (mode === 'consume') {
    const tpl = ConsumableSystem.getTemplate(itemKey);
    const bonus = tpl?.type === 'mp' ? (p?.mpRecoveryBonus || 0) : (p?.healBonus || 0);
    const perUse = Math.floor((tpl?.recovery || 0) * (1 + bonus));
    total.innerHTML = `预计恢复: <span class="qt-val" id="qtyTotalPrice">${perUse * qty}</span> ${tpl?.type?.toUpperCase() || ''}`;
    return;
  }
  total.innerHTML = `将开启: <span class="qt-val" id="qtyTotalPrice">${qty}</span> 个`;
}

function confirmQuantityAction(mode, itemKey) {
  const p = window.game?.player;
  const input = document.getElementById('qtyInput');
  const qty = Math.max(1, Math.floor(Number(input?.value || 1)));
  if (!p) return;

  const result = mode === 'consume'
    ? ConsumableSystem.use(p, itemKey, qty, { source: 'manual' })
    : BoxSystem.openBox(p, itemKey, qty);

  document.getElementById('qtyBackdrop')?.classList.remove('open');
  if (result?.success) {
    UIManager.toast(mode === 'consume' ? result.message : formatBoxOpenToast(result), 'success');
    window.game?.saveNow?.();
    UIManager._refreshAll?.();
    renderInventoryPanel(p);
  } else {
    UIManager.toast(result?.message || '操作失败', 'error');
  }
}

function formatBoxOpenToast(result) {
  const items = (result.obtained || []).map(item => `${item.name || item.item_key}×${item.count}`);
  const base = items.length > 0 ? `获得 ${items.slice(0, 4).join('、')}${items.length > 4 ? '...' : ''}` : '没有获得物品';
  const discarded = (result.discarded || []).reduce((sum, item) => sum + item.count, 0);
  return discarded > 0 ? `${base}；背包满丢弃 ${discarded} 件` : base;
}

function renderAutoplayPanel(player) {
  const el = document.getElementById('autoplay-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  const ap = p.auto_play || {};
  const hpCfg = ap.auto_consume?.hp_potion || {};
  const mpCfg = ap.auto_consume?.mp_potion || {};
  el.innerHTML = `
    <div class="hang-settings-section">
      <p class="hang-settings-title">💊 自动喝药设置</p>
      <div class="med-row">
        <div class="med-label">
          生命药剂：生命值 ≤
          <input type="text" class="med-input" id="hp-threshold" value="${Math.round((1-(hpCfg.threshold || 0.3))*100)}">
          % 时自动使用
        </div>
      </div>
      <div class="med-row">
        <div class="med-label">
          内功药剂：内功值 ≤
          <input type="text" class="med-input" id="mp-threshold" value="${Math.round((1-(mpCfg.threshold || 0.2))*100)}">
          % 时自动使用
        </div>
      </div>
    </div>
    <div style="margin-top:20px">
      ${ap.is_auto_play ? `
        <button class="btn danger" style="width:100%" onclick="window._stopAutoplay()">⏹ 停止挂机</button>
      ` : `
        <button class="btn primary" style="width:100%" onclick="window._startAutoplay()">▶ 开始挂机</button>
      `}
    </div>
  `;
}

function renderQuestPanel(player) {
  const el = document.getElementById('quest-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  mountQuestPanel(el, p, window._questActiveSeg || 'accepted');
}

window._resetQigong = () => {
  const p = window.game?.player;
  if (!p) return;
  const r = QigongSystem.resetQigong(p);
  if (r && r.success) {
    window._attrSys?.recompute(p);
    UIManager.toast('气功已重置', 'success');
    renderCharacterPanel(p);
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
    renderCharacterPanel(p);
  } else {
    UIManager.toast(r?.message || '分配失败', 'error');
  }
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

window._startAutoplay = () => { window.game?.startAutoPlay(); UIManager.closePanel(); };
window._stopAutoplay = () => { window.game?.stopAutoPlay(); UIManager.closePanel(); };

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
      { key: 'xuanbo_lumber', name: '伐木场', level: 'L18-22', badge: '当前', isCurrent: true },
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
          const isCurrent = sz.key === currentSubZoneKey || sz.isCurrent;
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
    const subZone = window.game?.battle?._currentSubZone || window.game?.currentSubZoneKey;
    renderMapSheetList(subZone);
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
    openInventoryItemAction(inventoryTile);
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
    else if (npc === 'leader' || func === '任务') { window._closeNPCDialog(); window._openPanel('quest'); }
  }
  // NPC dialog close
  if (e.target.id === 'npcDialogClose') window._closeNPCDialog();
  if (e.target.id === 'npcDialogBackdrop') window._closeNPCDialog();
  // Shop sheet close
  if (e.target.id === 'djxShopBack') document.getElementById('djxShopBackdrop')?.classList.remove('open');
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
  const btn = e.target.closest('.menu-btn[data-panel]');
  if (btn) {
    const panel = btn.dataset.panel;
    if (panel !== 'home') window._openPanel(panel);
  }
});

document.querySelectorAll('#page-combat .menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const onclick = btn.getAttribute('onclick');
    if (onclick) eval(onclick);
  });
});

// Setup warehouse popup events (once)
_setupWarehousePopup();
