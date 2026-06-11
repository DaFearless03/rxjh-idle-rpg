/**
 * @file ui/InventoryUI.js
 * @desc 背包页渲染：装备摘要 + demo 风格背包格子。
 */

import { BoxSystem } from '../systems/BoxSystem.js';
import { ConsumableSystem } from '../systems/ConsumableSystem.js';
import { renderEquipmentDetail, renderEquipmentSummary, getEquipmentTemplate } from './EquipUI.js?v=release-20260611-2';

const ITEM_META = {
  hp_potion_grade1: { icon: '🍶', name: '金创药(小)' },
  hp_potion_grade2: { icon: '🍶', name: '金创药(中)' },
  hp_potion_grade3: { icon: '🍶', name: '金创药(大)' },
  mp_potion_grade1: { icon: '🌿', name: '人参' },
  mp_potion_grade2: { icon: '🌿', name: '野山参' },
  mp_potion_grade3: { icon: '🌿', name: '雪原参' },
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

function isInstanceEquipped(player, instanceId) {
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
  const equipFail = slot.instance_id ? getEquipFailReason(player, slot.instance_id) : '';
  const classes = [
    'bag-tile',
    display.itemClass === 'equipment' ? 'equip' : 'stack',
    isQuest ? 'cross' : '',
    options.locked ? 'locked' : '',
    equipped ? 'used' : '',
    equipFail && !equipped ? 'locked' : '',
  ].filter(Boolean).join(' ');

  return `<div class="${classes}" data-key="${escapeHtml(display.key)}" data-icon="${escapeHtml(display.icon)}" data-name="${escapeHtml(display.name)}" data-class="${display.itemClass}" data-count="${count}" ${Number.isInteger(options.bagIndex) ? `data-bag-index="${options.bagIndex}"` : ''} ${isQuest ? 'data-quest="1"' : ''} ${slot.instance_id ? `data-instance-id="${escapeHtml(slot.instance_id)}"` : ''}>
    <div class="bt-icon">${display.icon}</div>
    <div class="bt-name">${escapeHtml(display.name)}</div>
    <div class="bt-sub">${escapeHtml(equipped ? '已穿戴' : equipFail || display.sub || '')}</div>
    ${display.enhance > 0 ? `<div class="bt-enh">+${display.enhance}</div>` : ''}
    ${equipped ? '<div class="bt-badge">装</div>' : isQuest ? '<div class="bt-badge cross">任务</div>' : count > 1 ? `<div class="bt-badge">×${count}</div>` : ''}
  </div>`;
}

function renderBagGrid(player) {
  const slots = player?.inventory?.slots || [];
  const capacity = player?.inventory?.capacity || 50;
  const bagSlots = slots.filter(slot => (slot?.count || 0) > 0 && !isInstanceEquipped(player, slot.instance_id));
  const used = bagSlots.length;
  const tiles = bagSlots.map((slot) => renderBagTile(slot, player, { bagIndex: slots.indexOf(slot) }));
  while (tiles.length < Math.min(capacity, 50)) tiles.push('<div class="bag-tile empty"></div>');

  return `<div class="bag-wrap inventory-bag-panel">
    <div class="bag-head">
      <span class="bh-title">背包</span>
      <span class="bh-count">已用 <b>${used}</b>/${capacity}</span>
      <span class="bh-hint">拖装备穿戴 · 点物品丢弃</span>
    </div>
    <div class="bag-scroll" id="inventoryBagScroll">
      <div class="bag-grid inventory-bag-grid" id="inventoryBagGrid">${tiles.join('')}</div>
    </div>
  </div>`;
}

function renderInventoryModals() {
  return `<div class="item-backdrop inventory-item-modal" data-modal="item">
    <div class="item-box">
      <div class="im-head">
        <span class="im-ico" data-field="icon">📦</span>
        <div class="im-meta">
          <div class="im-name" data-field="name">物品</div>
          <div class="im-sub" data-field="sub">—</div>
        </div>
      </div>
      <div class="im-qty" data-field="qty-wrap">
        <div class="im-qty-label" data-field="qty-label">丢弃数量</div>
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
      <div class="qty-actions">
        <button class="qty-cancel" data-action="close">取消</button>
        <button class="qty-confirm im-use" data-action="use-item">使用 1 个</button>
        <button class="qty-confirm im-open" data-action="open-box">开盒</button>
        <button class="qty-confirm im-discard" data-action="discard-item">丢弃</button>
      </div>
    </div>
  </div>
  <div class="item-backdrop inventory-equip-modal" data-modal="equip">
    <div class="item-box">
      <div class="im-head">
        <span class="im-ico" data-field="icon">⚔</span>
        <div class="im-meta">
          <div class="im-name" data-field="name">装备</div>
          <div class="im-sub" data-field="sub">—</div>
        </div>
      </div>
      <div data-field="detail"></div>
      <div class="qty-actions">
        <button class="qty-cancel" data-action="close">关闭</button>
        <button class="qty-confirm im-discard" data-action="discard-equip">丢弃</button>
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
  normalizeLegacyEquipmentSlots(player);
  if (migrateEquippedItemsOutOfBag(player)) window.game?.saveNow?.();
  container.innerHTML = renderInventoryPanel(player);
  bindInventoryInteractions(container, player);
}

function normalizeLegacyEquipmentSlots(player) {
  const slots = player?.inventory?.slots || [];
  if (!player?.inventory) return;
  if (!player.inventory.equipment_instances) player.inventory.equipment_instances = {};

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
  });
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

function bindInventoryInteractions(container, player) {
  const signal = createAbortSignal(container);
  let pending = null;
  let drag = null;
  let highlighted = null;
  let popupTarget = null;
  const threshold = 6;

  const clearHighlight = () => {
    highlighted?.classList.remove('drop-ok', 'drop-no');
    highlighted = null;
    container.querySelector('#inventoryBagScroll')?.classList.remove('drop-ok');
  };

  const cleanup = () => {
    clearHighlight();
    drag?.ghost?.remove();
    drag = null;
    pending = null;
  };

  const hitTest = (event) => {
    if (drag?.ghost) drag.ghost.style.display = 'none';
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (drag?.ghost) drag.ghost.style.display = '';
    return target;
  };

  const startDrag = (event, info) => {
    const inst = player.inventory?.equipment_instances?.[info.instanceId];
    const tpl = getEquipmentTemplate(player, inst);
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost inventory-drag-ghost';
    ghost.innerHTML = `<span class="bt-icon">${getEquipmentIcon(tpl?.slot)}</span><span class="bt-name">${escapeHtml(tpl?.name || inst?.item_key || '装备')}</span>`;
    document.body.appendChild(ghost);
    drag = { ...info, ghost };
    moveGhost(event);
  };

  const moveGhost = (event) => {
    if (!drag) return;
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
  };

  container.addEventListener('pointerdown', (event) => {
    const bagTile = event.target.closest('#inventoryBagGrid .bag-tile.equip[data-instance-id]');
    const equippedSlot = event.target.closest('.eq-slot.filled[data-instance-id]');
    if (!bagTile && !equippedSlot) return;
    const info = bagTile
      ? { source: 'bag', instanceId: bagTile.dataset.instanceId, bagIndex: Number(bagTile.dataset.bagIndex) }
      : { source: 'equip', instanceId: equippedSlot.dataset.instanceId, slot: equippedSlot.dataset.slot, index: Number(equippedSlot.dataset.index || 0) };
    pending = { info, startX: event.clientX, startY: event.clientY };
    event.preventDefault();
    try { container.setPointerCapture(event.pointerId); } catch (_) {}
  }, { signal });

  container.addEventListener('pointermove', (event) => {
    if (!drag && pending) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance >= threshold) {
        startDrag(event, pending.info);
        pending = null;
      }
    }
    if (!drag) return;
    event.preventDefault();
    moveGhost(event);
    const target = hitTest(event);
    clearHighlight();
    const slotEl = target?.closest('.eq-slot');
    if (slotEl) {
      const inst = player.inventory?.equipment_instances?.[drag.instanceId];
      const tpl = getEquipmentTemplate(player, inst);
      const ok = tpl?.slot === slotEl.dataset.slot && !getEquipFailReason(player, drag.instanceId);
      slotEl.classList.add(ok ? 'drop-ok' : 'drop-no');
      highlighted = slotEl;
      return;
    }
    if (drag.source === 'equip' && target?.closest('#inventoryBagScroll')) {
      container.querySelector('#inventoryBagScroll')?.classList.add('drop-ok');
    }
  }, { signal });

  container.addEventListener('pointerup', (event) => {
    if (!drag) {
      if (pending?.info) openEquipmentPopup(container, player, pending.info);
      pending = null;
      return;
    }
    const target = hitTest(event);
    const slotEl = target?.closest('.eq-slot');
    let result = null;
    if (slotEl) {
      result = moveEquipmentToSlot(
        player,
        drag,
        slotEl.dataset.slot,
        Number(slotEl.dataset.index || 0),
      );
    } else if (drag.source === 'equip' && target?.closest('#inventoryBagScroll')) {
      result = moveEquipmentToBag(player, drag);
    }
    cleanup();
    if (result) finishEquipmentAction(container, player, result);
  }, { signal });

  container.addEventListener('pointercancel', cleanup, { signal });

  container.addEventListener('click', (event) => {
    const tile = event.target.closest('#inventoryBagGrid .bag-tile.stack[data-bag-index]');
    const action = event.target.closest('[data-action]');
    const modalBackdrop = event.target.closest('.item-backdrop');
    if (tile) {
      event.preventDefault();
      event.stopPropagation();
      openItemPopup(container, player, Number(tile.dataset.bagIndex), popup => { popupTarget = popup; });
      return;
    }
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
}

function openItemPopup(container, player, bagIndex, setTarget) {
  const slot = player?.inventory?.slots?.[bagIndex];
  if (!slot || (slot.count || 0) <= 0) return;
  const display = getSlotDisplay(slot, player);
  const modal = container.querySelector('.inventory-item-modal');
  const max = Math.max(1, Number(slot.count || 1));
  const isBox = display.itemClass === 'boxes';
  setTarget({ type: 'item', bagIndex, max, itemClass: display.itemClass });
  modal.querySelector('[data-field="icon"]').textContent = display.icon;
  modal.querySelector('[data-field="name"]').textContent = display.name;
  modal.querySelector('[data-field="sub"]').textContent = `${getItemClassLabel(display.itemClass)} · 持有 ${max}`;
  modal.querySelector('[data-field="qty-wrap"]').style.display = max > 1 ? '' : 'none';
  modal.querySelector('[data-field="qty-label"]').textContent = isBox ? '开盒数量' : '丢弃数量';
  const warn = modal.querySelector('[data-field="warn"]');
  warn.textContent = isBox ? '📦 开盒后物品直接进背包' : '⚠️ 丢弃后不可恢复';
  warn.classList.toggle('neutral', isBox);
  modal.querySelector('[data-action="open-box"]').style.display = isBox ? '' : 'none';
  modal.querySelector('[data-action="use-item"]').style.display = display.itemClass === 'consumables' ? '' : 'none';
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
  modal.querySelector('[data-field="name"]').textContent = `${tpl.name || inst.item_key}${inst.enhance_level > 0 ? ` +${inst.enhance_level}` : ''}`;
  const fail = getEquipFailReason(player, instanceId);
  modal.querySelector('[data-field="sub"]').textContent = `装备 · ${getEquipmentSlotLabel(tpl.slot)}${fail ? ` · ${fail}` : ''}`;
  modal.querySelector('[data-field="detail"]').innerHTML = renderEquipmentDetail(player, instanceId);
  modal.classList.add('open');
}

function handleModalAction(container, player, action, popupTarget, setTarget) {
  if (action === 'close') {
    closeInventoryModals(container);
    setTarget(null);
    return;
  }
  if (action === 'discard-item' && popupTarget?.type === 'item') {
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
  if (action === 'use-item' && popupTarget?.type === 'item') {
    const slot = player.inventory?.slots?.[popupTarget.bagIndex];
    const result = ConsumableSystem.use(player, slot?.item_key, 1, { source: 'manual' });
    if (!result?.success) {
      showToast(container, result?.message || '使用失败');
      return;
    }
    closeInventoryModals(container);
    setTarget(null);
    window.UIManager?._refreshTopBar?.();
    finishEquipmentAction(container, player, result);
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
  }
}

function closeInventoryModals(container) {
  container.querySelectorAll('.item-backdrop.open').forEach(modal => modal.classList.remove('open'));
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
