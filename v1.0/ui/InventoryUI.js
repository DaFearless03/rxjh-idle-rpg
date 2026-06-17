/**
 * @file ui/InventoryUI.js
 * @desc 背包页渲染：装备摘要 + demo 风格背包格子。
 */

import { BoxSystem } from '../systems/BoxSystem.js?v=release-20260615-1';
import { buildEquipmentDetailView, renderEquipmentSummary, getEquipmentTemplate } from './EquipUI.js?v=release-20260615-1';

const ITEM_META = {
  hp_potion_grade1: { icon: '🍶', name: '金创药(小)', desc: '恢复70点生命值' },
  hp_potion_grade2: { icon: '🍶', name: '金创药(中)', desc: '恢复160点生命值' },
  hp_potion_grade3: { icon: '🍶', name: '金创药(大)', desc: '恢复300点生命值' },
  mp_potion_grade1: { icon: '🌿', name: '人参', desc: '恢复70点内功值' },
  mp_potion_grade2: { icon: '🌿', name: '野山参', desc: '恢复160点内功值' },
  mp_potion_grade3: { icon: '🌿', name: '雪原参', desc: '恢复320点内功值' },
  enhance_stone_01: { icon: '🪨', name: '强化石' },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function classifyItem(slot, player) {
  if (slot.instance_id) return 'equipment';
  const key = slot.item_key || slot.key || '';
  if (getEquipmentTemplate(player, { item_key: key })) return 'equipment';
  if (key.startsWith('box_')) return 'boxes';
  if (key.startsWith('cold_jade') || key.startsWith('vajra') || key.startsWith('enhance_stone') || key.startsWith('hot_blood')) return 'stones';
  if (key.includes('_potion_')) return 'consumables';
  if (player?.quests?.accepted?.some(q => JSON.stringify(q).includes(key))) return 'quest_items';
  return 'unknown';
}

function parseStoneAttr(key) {
  if (!key || !key.includes('--')) return '';
  const parts = String(key).split('--');
  if (parts.length < 3) return '';
  const attr = parts[1];
  const value = parts[2];
  if (!attr || !Number.isFinite(Number(value))) return '';
  const labels = {
    defAdd: '防御',
    maxHpAdd: '生命',
    missingAdd: '闪避',
    atkSelfAdd: '攻击',
    weaponSkillBonusAdd: '武功攻击',
    weaponExtraDamageAdd: '追加伤害',
    hitAdd: '命中',
    skill_level_up: '技能等级',
    enhanceSuccessRateAdd: '合成成功率',
    goldDropBonusAdd: '金币爆率',
    defSelfAdd: '防御',
    maxHpSelfAdd: '生命',
    atkAdd: '攻击',
    hitSelfAdd: '命中',
  };
  if (!labels[attr]) return '';
  return labels[attr] + '+' + value;
}

function getStoneBaseKey(key) {
  if (key && key.includes('--')) return key.split('--')[0];
  return key;
}

function getSlotDisplay(slot, player) {
  const key = slot.item_key || slot.key || '';
  if (slot.instance_id) {
    const inst = player?.inventory?.equipment_instances?.[slot.instance_id];
    const tpl = getEquipmentTemplate(player, inst);
    const enhance = inst?.enhance_level || 0;
    return {
      key,
      name: tpl?.name || key,
      icon: getEquipmentIcon(tpl?.slot),
      sub: getEquipmentSlotLabel(tpl?.slot),
      enhance,
      itemClass: 'equipment',
    };
  }

  const itemClass = classifyItem(slot, player);
  const baseKey = getStoneBaseKey(key);
  const meta = window._itemMetaByKey?.[baseKey] || ITEM_META[baseKey] || {};
  return {
    key,
    name: slot.name || meta.name || baseKey || '未知物品',
    icon: slot.icon || meta.icon || getItemIcon(key, itemClass),
    sub: slot.attr || parseStoneAttr(key),
    desc: slot.desc || meta.description || meta.desc || '',
    enhance: 0,
    itemClass,
  };
}

function getEquipmentIcon(slot) {
  const map = {
    weapon: '⚔',
    chest: '👕',
    gloves: '🧤',
    boots: '👟',
    inner_armor: '🛡',
    cape: '🧣',
    ring: '💍',
    amulet: '📿',
    earring: '📿',
  };
  return map[slot] || '⚔';
}

function getEquipmentSlotLabel(slot) {
  const map = {
    weapon: '武器',
    chest: '胸甲',
    gloves: '护手',
    boots: '鞋子',
    inner_armor: '内甲',
    cape: '披风',
    ring: '戒指',
    amulet: '项链',
    earring: '耳环',
  };
  return map[slot] || '';
}

export function isInstanceEquipped(player, instanceId) {
  if (!instanceId) return false;
  const equipped = player?.equipped || {};
  return Object.values(equipped).some(value => {
    const values = Array.isArray(value) ? value : [value];
    return values.some(item => {
      const id = typeof item === 'string' ? item : item?.instance_id;
      return id === instanceId;
    });
  });
}

export function getBagSlotsInOrder(player) {
  return (player?.inventory?.slots || []).filter(slot =>
    slot?.item_key
    && (slot.count || 0) > 0
    && !isInstanceEquipped(player, slot.instance_id)
  );
}

function getItemIcon(key, itemClass) {
  if (itemClass === 'boxes') return '🎁';
  if (itemClass === 'stones') return key.startsWith('vajra') ? '💠' : '🔷';
  if (itemClass === 'consumables') return key.startsWith('mp_') ? '🌿' : '🍶';
  if (itemClass === 'quest_items') return '📜';
  return '📦';
}

export function renderBagTile(slot, player, options = {}) {
  if (!slot || (slot.count || 0) <= 0 || !(slot.item_key || slot.key)) {
    return '<div class="bag-tile empty"></div>';
  }

  const display = getSlotDisplay(slot, player);
  const count = slot.count || 1;
  const isQuest = display.itemClass === 'quest_items' || slot.quest;
  const equipped = slot.instance_id ? isInstanceEquipped(player, slot.instance_id) : false;
  const equipFail = !options.craftType && slot.instance_id ? getEquipFailReason(player, slot.instance_id) : '';
  const craftKey = options.craftType && slot.instance_id ? slot.instance_id : display.key;
  const craftKind = slot.instance_id ? 'equip' : /^(enhance_stone|vajra|cold_jade|hot_blood)_/.test(display.key) ? 'stone' : 'item';
  const craftAttrs = options.craftType
    ? `data-kind="${craftKind}" data-craft-type="${escapeHtml(options.craftType)}" ${options.extraData || ''}`
    : '';
  const classes = [
    'bag-tile',
    display.itemClass === 'equipment' ? 'equip' : 'stack',
    isQuest ? 'cross' : '',
    options.locked ? 'locked' : '',
    equipped ? 'used' : '',
    equipFail && !equipped ? 'locked' : '',
  ].filter(Boolean).join(' ');

  return `<div class="${classes}" data-key="${escapeHtml(craftKey)}" data-icon="${escapeHtml(display.icon)}" data-name="${escapeHtml(display.name)}" data-class="${display.itemClass}" data-count="${count}" ${Number.isInteger(options.bagIndex) ? `data-bag-index="${options.bagIndex}"` : ''} ${isQuest ? 'data-quest="1"' : ''} ${slot.instance_id ? `data-instance-id="${escapeHtml(slot.instance_id)}"` : ''} ${craftAttrs}>
    <div class="bt-icon">${display.icon}</div>
    <div class="bt-name">${escapeHtml(display.name)}</div>
    <div class="bt-sub">${escapeHtml(equipped ? '已穿戴' : equipFail || display.sub || '')}</div>
    ${display.enhance > 0 ? `<div class="bt-enh">+${display.enhance}</div>` : ''}
    ${equipped ? '<div class="bt-badge">装</div>' : `${isQuest ? '<div class="bt-badge cross quest">任务</div>' : ''}${count > 1 ? `<div class="bt-badge">×${count}</div>` : ''}`}
  </div>`;
}

export function renderCraftBagPanel(player, craftType, getExtraData = () => '') {
  const bagSlots = getBagSlotsInOrder(player);
  const tiles = bagSlots.map(slot => renderBagTile(slot, player, {
    craftType,
    extraData: getExtraData(slot),
  }));
  while (tiles.length < (player?.inventory?.capacity || 50)) tiles.push('<div class="bag-tile empty"></div>');
  return `<div class="shop-sell-pane craft-inventory-pane">
    <div class="wh-pane-head"><span class="wh-title">背包</span><span class="wh-count">${bagSlots.length} / ${player?.inventory?.capacity || 50}</span><span class="wh-gold push">🪙 ${(player?.resources?.gold || 0).toLocaleString()}</span><button class="wh-sort" onclick="window._sortShopInventory()">整理</button></div>
    <div class="shop-sell-scroll"><div class="bag-grid">${tiles.join('')}</div></div>
  </div>`;
}

function renderBagGrid(player) {
  const slots = player?.inventory?.slots || [];
  const capacity = player?.inventory?.capacity || 50;
  const gold = Number(player?.resources?.gold || 0);
  const bagSlots = getBagSlotsInOrder(player);
  const used = bagSlots.length;
  const tiles = bagSlots.map((slot) => renderBagTile(slot, player, { bagIndex: slots.indexOf(slot) }));
  while (tiles.length < Math.min(capacity, 50)) tiles.push('<div class="bag-tile empty"></div>');

  return `<div class="bag-wrap inventory-bag-panel">
    <div class="bag-head">
      <span class="bh-title">背包</span>
      <span class="bh-count">已用 <b>${used}</b>/${capacity}</span>
      <span class="bh-gold" title="当前角色金币">💰 ${gold.toLocaleString()}</span>
      <button class="wh-sort" onclick="window._sortInventory()">整理</button>
    </div>
    <div class="bag-scroll" id="inventoryBagScroll">
      <div class="bag-grid inventory-bag-grid" id="inventoryBagGrid">${tiles.join('')}</div>
    </div>
  </div>`;
}

function renderInventoryModals() {
  return `<div class="item-backdrop inventory-item-modal" data-modal="item">
    <div class="item-box">
      <div class="ed-hdr">
        <div class="ed-ico-frame"><span data-field="icon">📦</span></div>
        <div class="ed-title-wrap">
          <div class="ed-title-name" data-field="name">物品</div>
          <div class="ed-title-tags" data-field="tags"></div>
        </div>
      </div>
      <div class="ed-main-bar" data-field="main-bar"></div>
      <div class="ed-content" data-field="content">
        <div class="ed-panel" data-field="qty-wrap">
          <div class="ed-panel-hdr">操作数量</div>
          <div class="qty-stepper">
            <button class="qty-step" data-step="-1">−</button>
            <input class="qty-input" data-field="qty" type="text" inputmode="numeric" value="1">
            <button class="qty-step" data-step="1">＋</button>
          </div>
          <div class="qty-quick">
            <button data-quick="1">1</button>
            <button data-quick="10">10</button>
            <button data-quick="half">半数</button>
            <button data-quick="all">全部</button>
          </div>
        </div>
        <div class="im-warn" data-field="warn">⚠️ 丢弃后不可恢复</div>
      </div>
      <div class="ed-footer">
        <button class="ed-btn ed-btn-close" data-action="close">关闭</button>
        <button class="ed-btn ed-btn-equip" data-action="open-box">开盒</button>
        <button class="ed-btn ed-btn-discard" data-action="discard-item">丢弃</button>
      </div>
    </div>
  </div>
  <div class="item-backdrop inventory-equip-modal" data-modal="equip">
    <div class="item-box">
      <div class="ed-hdr">
        <div class="ed-ico-frame" data-field="icon-frame"><span data-field="icon">⚔</span></div>
        <div class="ed-title-wrap">
          <div class="ed-title-name" data-field="name">装备</div>
          <div class="ed-title-tags" data-field="tags"></div>
        </div>
      </div>
      <div class="ed-main-bar" data-field="main-bar"></div>
      <div data-field="detail"></div>
      <div class="ed-footer">
        <button class="ed-btn ed-btn-close" data-action="close">关闭</button>
        <button class="ed-btn ed-btn-equip" data-action="equip-action">装备</button>
        <button class="ed-btn ed-btn-discard" data-action="discard-equip">丢弃</button>
      </div>
    </div>
  </div>`;
}

export function renderInventoryPanel(player) {
  if (!player) return '<div class="inventory-empty">暂无角色数据</div>';
  return `<div class="inventory-page">
    ${renderEquipmentSummary(player)}
    ${renderBagGrid(player)}
    ${renderInventoryModals()}
  </div>`;
}

export function mountInventoryPanel(container, player) {
  if (!container) return;
  const normalized = normalizeLegacyEquipmentSlots(player);
  const migrated = migrateEquippedItemsOutOfBag(player);
  if (normalized || migrated) window.game?.saveNow?.();
  const modalState = captureOpenInventoryModal(container);
  container.innerHTML = renderInventoryPanel(player);
  bindInventoryInteractions(container, player, modalState);
}

export function normalizeLegacyEquipmentSlots(player) {
  const slots = player?.inventory?.slots || [];
  if (!player?.inventory) return false;
  if (!player.inventory.equipment_instances) player.inventory.equipment_instances = {};
  let changed = false;

  slots.forEach((slot, index) => {
    const itemKey = slot?.item_key || slot?.key;
    if (!itemKey || slot.instance_id || !getEquipmentTemplate(player, { item_key: itemKey })) return;
    const instanceId = `legacy_${Date.now().toString(36)}_${index}`;
    player.inventory.equipment_instances[instanceId] = {
      instance_id: instanceId,
      item_key: itemKey,
      enhance_level: 0,
      synthesis_slots: [],
    };
    slot.instance_id = instanceId;
    slot.count = 1;
    changed = true;
  });
  return changed;
}

function migrateEquippedItemsOutOfBag(player) {
  let changed = false;
  if (player?.equipped && !Array.isArray(player.equipped.gloves)) {
    player.equipped.gloves = [player.equipped.gloves || null, null];
    changed = true;
  }
  const slots = player?.inventory?.slots || [];
  slots.forEach((slot) => {
    if (slot?.instance_id && isInstanceEquipped(player, slot.instance_id)) {
      clearBagSlot(slot);
      changed = true;
    }
  });
  return changed;
}

function bindInventoryInteractions(container, player, initialModalState = null) {
  const signal = createAbortSignal(container);
  let pending = null;
  let popupTarget = null;
  const threshold = 8;

  container.addEventListener('pointerdown', (event) => {
    const bagTile = event.target.closest('#inventoryBagGrid .bag-tile.equip[data-instance-id]');
    const equippedSlot = event.target.closest('.eq-slot.filled[data-instance-id]');
    const stackTile = event.target.closest('#inventoryBagGrid .bag-tile.stack[data-bag-index]');
    const tap = bagTile
      ? { type: 'equip', info: { source: 'bag', instanceId: bagTile.dataset.instanceId, bagIndex: Number(bagTile.dataset.bagIndex) } }
      : equippedSlot
        ? { type: 'equip', info: { source: 'equip', instanceId: equippedSlot.dataset.instanceId, slot: equippedSlot.dataset.slot, index: Number(equippedSlot.dataset.index || 0) } }
        : stackTile
          ? { type: 'stack', bagIndex: Number(stackTile.dataset.bagIndex) }
          : null;
    if (tap) pending = { tap, startX: event.clientX, startY: event.clientY, scrolled: false };
  }, { signal });

  container.addEventListener('pointermove', (event) => {
    if (pending && Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) >= threshold) pending.scrolled = true;
  }, { signal });

  container.addEventListener('pointerup', () => {
    const tap = pending?.scrolled ? null : pending?.tap;
    pending = null;
    if (tap?.type === 'equip') openEquipmentPopup(container, player, tap.info);
    if (tap?.type === 'stack') openItemPopup(container, player, tap.bagIndex, popup => { popupTarget = popup; });
  }, { signal });

  container.addEventListener('pointercancel', () => { pending = null; }, { signal });

  container.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    const modalBackdrop = event.target.closest('.item-backdrop');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      handleModalAction(container, player, action.dataset.action, popupTarget, next => { popupTarget = next; });
      return;
    }
    if (modalBackdrop && event.target === modalBackdrop) {
      event.preventDefault();
      event.stopPropagation();
      closeInventoryModals(container);
      popupTarget = null;
      return;
    }
    if (event.target.closest('#inventoryBagGrid .bag-tile, .eq-slot')) event.stopPropagation();
  }, { signal });

  const qtyWrap = container.querySelector('.inventory-item-modal [data-field="qty-wrap"]');
  qtyWrap?.addEventListener('click', (event) => {
    if (!popupTarget) return;
    const input = container.querySelector('.inventory-item-modal [data-field="qty"]');
    const step = event.target.closest('[data-step]');
    const quick = event.target.closest('[data-quick]');
    if (step) setPopupQty(input, popupTarget.max, Number(input.value) + Number(step.dataset.step));
    if (quick) {
      const value = quick.dataset.quick === 'all'
        ? popupTarget.max
        : quick.dataset.quick === 'half'
          ? Math.max(1, Math.floor(popupTarget.max / 2))
          : Number(quick.dataset.quick);
      setPopupQty(input, popupTarget.max, value);
    }
  }, { signal });

  restoreOpenInventoryModal(container, player, initialModalState, popup => { popupTarget = popup; });
}

function openItemPopup(container, player, bagIndex, setTarget) {
  const slot = player?.inventory?.slots?.[bagIndex];
  if (!slot || (slot.count || 0) <= 0) return;
  const display = getSlotDisplay(slot, player);
  const modal = container.querySelector('.inventory-item-modal');
  const max = Math.max(1, Number(slot.count || 1));
  const isBox = display.itemClass === 'boxes';
  const isQuest = display.itemClass === 'quest_items';
  modal.dataset.bagIndex = String(bagIndex);
  modal.dataset.itemKey = slot.item_key || slot.key || '';
  modal.dataset.itemClass = display.itemClass || '';
  setTarget({ type: 'item', bagIndex, max, itemClass: display.itemClass });
  modal.querySelector('[data-field="icon"]').textContent = display.icon;
  modal.querySelector('[data-field="name"]').textContent = display.name;
  modal.querySelector('[data-field="tags"]').innerHTML = `<span class="ed-tag ${getItemClassTag(display.itemClass)}">${getItemClassLabel(display.itemClass)}</span>`;
  const mainBar = modal.querySelector('[data-field="main-bar"]');
  if (display.itemClass === 'stones' && display.sub) mainBar.innerHTML = renderItemMainBar(display.sub);
  else if (display.itemClass === 'consumables') mainBar.innerHTML = `<span class="ed-ml">效果</span><span class="ed-mv item-effect">${escapeHtml(display.desc || '使用后恢复角色状态')}</span>`;
  else if (isQuest) mainBar.innerHTML = `<span class="ed-ml">持有数量</span><span class="ed-mv">×${max}</span>`;
  else mainBar.innerHTML = '';
  mainBar.style.display = isBox ? 'none' : '';
  modal.querySelector('[data-field="content"]').style.display = isQuest ? 'none' : '';
  modal.querySelector('[data-field="qty-wrap"]').style.display = !isQuest && max > 1 ? '' : 'none';
  const warn = modal.querySelector('[data-field="warn"]');
  warn.textContent = isBox ? '📦 开盒后物品直接进背包' : '⚠️ 丢弃后不可恢复';
  warn.classList.toggle('neutral', isBox);
  modal.querySelector('[data-action="open-box"]').style.display = isBox ? '' : 'none';
  const discard = modal.querySelector('[data-action="discard-item"]');
  discard.disabled = isQuest;
  discard.className = `ed-btn ${isQuest ? 'ed-btn-disabled' : 'ed-btn-discard'}`;
  discard.textContent = isQuest ? '不可丢弃' : '丢弃';
  setPopupQty(modal.querySelector('[data-field="qty"]'), max, max);
  modal.classList.add('open');
}

function openEquipmentPopup(container, player, target) {
  const instanceId = target.instanceId;
  const inst = player?.inventory?.equipment_instances?.[instanceId];
  const tpl = getEquipmentTemplate(player, inst);
  if (!inst || !tpl) return;
  const modal = container.querySelector('.inventory-equip-modal');
  modal.dataset.instanceId = instanceId;
  modal.dataset.source = target.source;
  modal.dataset.bagIndex = target.bagIndex ?? '';
  modal.dataset.slot = target.slot ?? '';
  modal.dataset.index = target.index ?? 0;
  modal.querySelector('[data-field="icon"]').textContent = getEquipmentIcon(tpl.slot);
  modal.querySelector('[data-field="name"]').textContent = tpl.name || inst.item_key;
  const iconFrame = modal.querySelector('[data-field="icon-frame"]');
  iconFrame.querySelector('.ed-badge')?.remove();
  if (inst.enhance_level > 0) iconFrame.insertAdjacentHTML('beforeend', `<span class="ed-badge">+${inst.enhance_level}</span>`);
  modal.querySelector('[data-field="tags"]').innerHTML = renderEquipmentTags(player, tpl);
  const detail = buildEquipmentDetailView(player, instanceId);
  const mainBar = modal.querySelector('[data-field="main-bar"]');
  mainBar.innerHTML = detail.mainBar || '';
  mainBar.className = `ed-main-bar ${detail.mainClass || ''}`;
  mainBar.style.display = detail.mainBar ? '' : 'none';
  modal.querySelector('[data-field="detail"]').innerHTML = detail.body;
  const action = modal.querySelector('[data-action="equip-action"]');
  const fail = getEquipFailReason(player, instanceId);
  action.disabled = target.source === 'bag' && !!fail;
  action.className = `ed-btn ${target.source === 'equip' ? 'ed-btn-unequip' : fail ? 'ed-btn-disabled' : 'ed-btn-equip'}`;
  action.textContent = target.source === 'equip' ? '卸下' : fail ? '不可装备' : '装备';
  modal.classList.add('open');
}

function handleModalAction(container, player, action, popupTarget, setTarget) {
  if (action === 'close') {
    closeInventoryModals(container);
    setTarget(null);
    return;
  }
  if (action === 'discard-item' && popupTarget?.type === 'item') {
    if (popupTarget.itemClass === 'quest_items') return;
    const slot = player.inventory?.slots?.[popupTarget.bagIndex];
    if (!slot) return;
    const qty = getPopupQty(container, popupTarget.max);
    const name = getSlotDisplay(slot, player).name;
    slot.count = Math.max(0, Number(slot.count || 0) - qty);
    if (slot.count <= 0) clearBagSlot(slot);
    closeInventoryModals(container);
    setTarget(null);
    finishEquipmentAction(container, player, { success: true, message: `已丢弃「${name}」×${qty}` });
    return;
  }
  if (action === 'open-box' && popupTarget?.type === 'item') {
    const slot = player.inventory?.slots?.[popupTarget.bagIndex];
    if (!slot?.item_key) return;
    const result = BoxSystem.openBox(player, slot.item_key, getPopupQty(container, popupTarget.max));
    closeInventoryModals(container);
    setTarget(null);
    finishEquipmentAction(container, player, {
      success: result?.success,
      message: result?.success ? formatBoxResult(result) : result?.message,
    });
    return;
  }
  if (action === 'discard-equip') {
    const modal = container.querySelector('.inventory-equip-modal');
    const instanceId = modal.dataset.instanceId;
    const inst = player.inventory?.equipment_instances?.[instanceId];
    const tpl = getEquipmentTemplate(player, inst);
    if (modal.dataset.source === 'bag') clearBagSlot(player.inventory.slots[Number(modal.dataset.bagIndex)]);
    else setEquippedSlot(player, modal.dataset.slot, Number(modal.dataset.index || 0), null);
    delete player.inventory.equipment_instances[instanceId];
    closeInventoryModals(container);
    finishEquipmentAction(container, player, { success: true, message: `已丢弃「${tpl?.name || inst?.item_key || '装备'}」` });
    return;
  }
  if (action === 'equip-action') {
    const modal = container.querySelector('.inventory-equip-modal');
    if (modal.querySelector('[data-action="equip-action"]')?.disabled) return;
    const target = {
      source: modal.dataset.source,
      instanceId: modal.dataset.instanceId,
      bagIndex: Number(modal.dataset.bagIndex),
      slot: modal.dataset.slot,
      index: Number(modal.dataset.index || 0),
    };
    const inst = player.inventory?.equipment_instances?.[target.instanceId];
    const tpl = getEquipmentTemplate(player, inst);
    let result;
    if (target.source === 'equip') {
      result = moveEquipmentToBag(player, target);
    } else {
      const equipped = player?.equipped?.[tpl?.slot];
      const targetIndex = Array.isArray(equipped) ? Math.max(0, equipped.findIndex(value => !getInstanceId(value))) : 0;
      result = moveEquipmentToSlot(player, target, tpl?.slot, targetIndex);
    }
    closeInventoryModals(container);
    finishEquipmentAction(container, player, result);
  }
}

function closeInventoryModals(container) {
  container.querySelectorAll('.item-backdrop.open').forEach(modal => modal.classList.remove('open'));
}

function captureOpenInventoryModal(container) {
  const itemModal = container?.querySelector?.('.inventory-item-modal.open');
  if (itemModal) {
    return {
      type: 'item',
      bagIndex: Number(itemModal.dataset.bagIndex),
      itemKey: itemModal.dataset.itemKey || '',
      qty: Number(itemModal.querySelector('[data-field="qty"]')?.value || 1),
    };
  }
  const equipModal = container?.querySelector?.('.inventory-equip-modal.open');
  if (equipModal) {
    return {
      type: 'equip',
      source: equipModal.dataset.source || 'bag',
      instanceId: equipModal.dataset.instanceId || '',
      bagIndex: Number(equipModal.dataset.bagIndex),
      slot: equipModal.dataset.slot || '',
      index: Number(equipModal.dataset.index || 0),
    };
  }
  return null;
}

function restoreOpenInventoryModal(container, player, state, setTarget) {
  if (!state || !player) return;
  if (state.type === 'item') {
    const slots = player.inventory?.slots || [];
    let bagIndex = Number.isInteger(state.bagIndex) ? state.bagIndex : -1;
    if (!slots[bagIndex] || (slots[bagIndex].item_key || slots[bagIndex].key) !== state.itemKey || (slots[bagIndex].count || 0) <= 0) {
      bagIndex = slots.findIndex(slot =>
        (slot?.count || 0) > 0
        && (slot.item_key || slot.key) === state.itemKey
      );
    }
    if (bagIndex < 0) return;
    openItemPopup(container, player, bagIndex, setTarget);
    setPopupQty(container.querySelector('.inventory-item-modal [data-field="qty"]'), player.inventory.slots[bagIndex]?.count || 1, state.qty);
    return;
  }
  if (state.type === 'equip' && state.instanceId) {
    const exists = player.inventory?.equipment_instances?.[state.instanceId];
    if (!exists) return;
    openEquipmentPopup(container, player, {
      source: state.source,
      instanceId: state.instanceId,
      bagIndex: state.bagIndex,
      slot: state.slot,
      index: state.index,
    });
  }
}

function getPopupQty(container, max) {
  return Math.max(1, Math.min(max, Math.floor(Number(container.querySelector('.inventory-item-modal [data-field="qty"]')?.value) || 1)));
}

function setPopupQty(input, max, value) {
  if (input) input.value = String(Math.max(1, Math.min(max, Math.floor(Number(value) || 1))));
}

function getItemClassLabel(itemClass) {
  return {
    equipment: '装备',
    stones: '石头',
    consumables: '消耗品',
    quest_items: '任务物品',
    boxes: '盒子',
  }[itemClass] || '物品';
}

function getItemClassTag(itemClass) {
  return {
    stones: 'ed-tag-career',
    consumables: 'ed-tag-slot',
    quest_items: 'ed-tag-fail',
    boxes: 'ed-tag-lv',
  }[itemClass] || 'ed-tag-slot';
}

function renderItemMainBar(attr) {
  const match = String(attr || '').match(/^(.+?)([+-]\d+(?:\.\d+)?)$/);
  return match
    ? `<span class="ed-ml">${escapeHtml(match[1])}</span><span class="ed-mv">${escapeHtml(match[2])}</span>`
    : `<span class="ed-ml">${escapeHtml(attr)}</span>`;
}

function renderEquipmentTags(player, tpl) {
  const requiredLevel = Number(tpl.required_level || tpl.level_required || 1);
  const requiredTransfer = Number(tpl.required_transfer || tpl.transfer_required || 0);
  const careers = Array.isArray(tpl.required_career) ? tpl.required_career : (tpl.required_career ? [tpl.required_career] : []);
  const careerNames = { blade: '刀系', sword: '剑系', spear: '枪系', staff: '医系', all: '通用' };
  const factionNames = { positive: '正派', negative: '邪派', neutral: '中立' };
  const careerOk = !careers.length || careers.includes('all') || careers.includes(player?.career_family);
  const factionOk = !tpl.faction || tpl.faction === 'neutral' || tpl.faction === player?.faction;
  const tags = [
    `<span class="ed-tag ed-tag-slot">${getEquipmentSlotLabel(tpl.slot)}</span>`,
    `<span class="ed-tag ${(player?.level || 1) >= requiredLevel ? 'ed-tag-lv' : 'ed-tag-fail'}">Lv.${requiredLevel}</span>`,
    `<span class="ed-tag ${careerOk ? 'ed-tag-career' : 'ed-tag-fail'}">${careers.length ? careers.map(key => careerNames[key] || key).join('/') : '通用'}</span>`,
  ];
  if (requiredTransfer > 0) tags.push(`<span class="ed-tag ${getTransferCount(player) >= requiredTransfer ? 'ed-tag-lv' : 'ed-tag-fail'}">${requiredTransfer}转</span>`);
  if (tpl.faction && tpl.faction !== 'neutral') tags.push(`<span class="ed-tag ed-tag-faction ${tpl.faction} ${factionOk ? '' : 'ed-tag-fail'}">${factionNames[tpl.faction] || tpl.faction}</span>`);
  return tags.join('');
}

function formatBoxResult(result) {
  const rewards = (result?.obtained || []).map(item => `${item.name || item.item_key}×${item.count}`).join('、');
  return rewards ? `开启「${result.box_name}」×${result.opened} → ${rewards}` : result?.message || '开盒完成';
}

function createAbortSignal(container) {
  if (container._inventoryAbortController) {
    container._inventoryAbortController.abort();
  }
  container._inventoryAbortController = new AbortController();
  return container._inventoryAbortController.signal;
}

function moveEquipmentToSlot(player, drag, targetSlot, targetIndex) {
  const instanceId = drag?.instanceId;
  const inst = player?.inventory?.equipment_instances?.[instanceId];
  const tpl = getEquipmentTemplate(player, inst);
  if (!inst || !tpl?.slot) return { success: false, message: '装备数据不存在' };
  if (tpl.slot !== targetSlot) return { success: false, message: '该装备不能放入这个槽位' };

  const fail = getEquipFailReason(player, instanceId);
  if (fail) return { success: false, message: fail };

  const occupant = getInstanceId(getEquippedSlot(player, targetSlot, targetIndex));
  if (drag.source === 'bag') {
    const sourceSlot = player.inventory?.slots?.[drag.bagIndex];
    if (!sourceSlot || sourceSlot.instance_id !== instanceId) return { success: false, message: '背包装备位置已变化，请重试' };
    if (occupant) writeEquipmentToBagSlot(sourceSlot, player, occupant);
    else clearBagSlot(sourceSlot);
  } else {
    setEquippedSlot(player, drag.slot, drag.index, occupant ? { instance_id: occupant } : null);
  }
  setEquippedSlot(player, targetSlot, targetIndex, { instance_id: instanceId });
  return { success: true, message: occupant ? `已换上「${tpl.name || inst.item_key}」` : `已穿戴「${tpl.name || inst.item_key}」` };
}

function moveEquipmentToBag(player, drag) {
  const instanceId = drag?.instanceId;
  const inst = player?.inventory?.equipment_instances?.[instanceId];
  const tpl = getEquipmentTemplate(player, inst);
  if (!inst) return { success: false, message: '装备数据不存在' };
  const slot = getAvailableBagSlot(player);
  if (!slot) return { success: false, message: '背包已满，无法卸下' };
  writeEquipmentToBagSlot(slot, player, instanceId);
  setEquippedSlot(player, drag.slot, drag.index, null);
  return { success: true, message: `已卸下「${tpl?.name || inst.item_key}」` };
}

function setEquippedSlot(player, slotKey, index, value) {
  if (!player.equipped) player.equipped = {};
  const current = player.equipped[slotKey];
  if (Array.isArray(current)) {
    current[index] = value;
    return;
  }
  player.equipped[slotKey] = value;
}

function getEquippedSlot(player, slotKey, index = 0) {
  const equipped = player?.equipped?.[slotKey];
  return Array.isArray(equipped) ? equipped[index] : equipped;
}

function getInstanceId(value) {
  return typeof value === 'string' ? value : value?.instance_id || null;
}

function clearBagSlot(slot) {
  slot.item_key = null;
  slot.instance_id = null;
  slot.count = 0;
}

function writeEquipmentToBagSlot(slot, player, instanceId) {
  const inst = player.inventory?.equipment_instances?.[instanceId];
  slot.item_key = inst?.item_key || null;
  slot.instance_id = instanceId;
  slot.count = 1;
}

function getAvailableBagSlot(player) {
  const slots = player?.inventory?.slots || [];
  const empty = slots.find(slot => (slot?.count || 0) <= 0);
  if (empty) return empty;
  if (slots.filter(slot => (slot?.count || 0) > 0).length >= (player?.inventory?.capacity || 50)) return null;
  const slot = { item_key: null, instance_id: null, count: 0 };
  slots.push(slot);
  return slot;
}

function getEquipFailReason(player, instanceId) {
  const inst = player?.inventory?.equipment_instances?.[instanceId];
  const tpl = getEquipmentTemplate(player, inst);
  if (!tpl) return '装备配置缺失';

  const requiredLevel = Number(tpl.required_level || tpl.level_required || 0);
  if ((player?.level || 1) < requiredLevel) return `需要 Lv.${requiredLevel}`;

  const requiredTransfer = Number(tpl.required_transfer || tpl.transfer_required || 0);
  if (getTransferCount(player) < requiredTransfer) return `需要 ${requiredTransfer} 转`;

  const requiredCareer = Array.isArray(tpl.required_career) ? tpl.required_career : (tpl.required_career ? [tpl.required_career] : []);
  if (requiredCareer.length > 0 && !requiredCareer.includes(player?.career_family)) {
    return `职业不符`;
  }

  if (tpl.faction && tpl.faction !== 'neutral' && player?.faction !== tpl.faction) {
    return tpl.faction === 'positive' ? '限正派' : '限邪派';
  }

  return '';
}

function getTransferCount(player) {
  if (Number.isFinite(Number(player?.transfer_count))) return Number(player.transfer_count);
  const historyCount = Array.isArray(player?.career_history) ? Math.max(0, player.career_history.length - 1) : 0;
  if (historyCount > 0) return historyCount;
  const match = String(player?.career || '').match(/transfer_(\d)/);
  return match ? Number(match[1]) : 0;
}

function finishEquipmentAction(container, player, result) {
  if (!result?.success) {
    showToast(container, result?.message || '操作失败');
    return;
  }
  const previousStats = captureCombatStats(player);
  window.AttributeSystem?.recompute?.(player);
  player.hp = Math.min(player.hp, player.maxHp);
  player.mp = Math.min(player.mp, player.maxMp);
  window.game?.saveNow?.();
  window.game?.eventBus?.emit?.('player.equipment_changed', { player });
  container.innerHTML = renderInventoryPanel(player);
  bindInventoryInteractions(container, player);
  animateStatChanges(container, previousStats, player);
  showToast(container, result.message);
}

function captureCombatStats(player) {
  return Object.fromEntries(['maxHp', 'maxMp', 'atkMin', 'atkMax', 'def', 'matk', 'mdef', 'hit', 'missing']
    .map(key => [key, Number(player?.[key] || 0)]));
}

function animateStatChanges(container, previous, player) {
  const keys = ['maxHp', 'maxMp', 'atkMin', 'atkMax', 'def', 'matk', 'mdef', 'hit', 'missing'];
  container.querySelectorAll('.stat-row').forEach((row, index) => {
    const key = keys[index];
    const delta = Number(player?.[key] || 0) - Number(previous?.[key] || 0);
    if (!delta) return;
    row.classList.add(delta > 0 ? 'flash-up' : 'flash-down');
    const value = row.querySelector('.sr-v');
    if (value) value.insertAdjacentHTML('afterbegin', `<span class="sr-arrow ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲+' : '▼-'}${Math.abs(delta)}</span>`);
    setTimeout(() => {
      row.classList.remove('flash-up', 'flash-down');
      row.querySelector('.sr-arrow')?.remove();
    }, 1700);
  });
}

function showToast(container, message) {
  const page = container?.closest('.page-inventory');
  if (!page) return;
  let stack = page.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    page.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'craft-toast';
  el.textContent = message;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 220);
  }, 2000);
}
