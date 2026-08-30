/**
 * @file ui/ShopUI.js
 * @desc 城镇商店列表渲染：武器、防具、药店。
 */
import { getBagSlotsInOrder } from './InventoryUI.js?v=release-20260830-3';
import { ShopSystem } from '../systems/ShopSystem.js?v=release-20260830-3';

const CAREER_NAME = { blade: '刀客', sword: '剑客', staff: '医师', spear: '枪客' };
const CAREER_ICON = { blade: '🗡️', sword: '⚔️', staff: '🪄', spear: '🔱' };

export function buildShopItems(npcsData, equipmentsData, shopType) {
  const npc = (Array.isArray(npcsData) ? npcsData : []).find(entry => entry?.shop_type === shopType);
  const multiplier = Number(npc?.price_multiplier ?? 1);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const equipments = Array.isArray(equipmentsData) ? equipmentsData : [];
  return (Array.isArray(npc?.items) ? npc.items : []).flatMap(item => {
    const basePrice = Number(item?.buy_price);
    if (!item?.item_key || !Number.isFinite(basePrice) || basePrice <= 0) return [];
    const buyPrice = Math.floor(basePrice * safeMultiplier);
    if (!Number.isSafeInteger(buyPrice) || buyPrice <= 0) return [];
    const template = equipments.find(equipment => equipment.key === item.item_key);
    const careers = Array.isArray(template?.required_career)
      ? template.required_career
      : [template?.required_career].filter(Boolean);
    const icon = item.item_key.startsWith('hp_') ? '🍶'
      : item.item_key.startsWith('mp_') ? '🌿'
        : CAREER_ICON[careers[0]] || '📦';
    return [{
      ...item,
      buy_price: buyPrice,
      icon,
      slot: template?.slot || null,
      careers,
    }];
  });
}

function getConfiguredShopItems(shopType) {
  const npcs = window.game?.npcsData || window.GameConfig?.npcs || [];
  const equipments = window._equipTemplates || window.GameConfig?.equipments || [];
  return buildShopItems(npcs, equipments, shopType);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeInlineJsString(value) {
  const escaped = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return escapeHtml(escaped);
}

function getCareerFamily(player) {
  if (player?.career_family) return player.career_family;
  const career = player?.career || '';
  return ['blade', 'sword', 'staff', 'spear'].find(key => career.includes(key)) || 'blade';
}

function sectionLabel(label) {
  return `<div class="shop-section-label">${escapeHtml(label)}</div>`;
}

function getStoneBaseKey(itemKey) {
  const key = String(itemKey || '');
  if (key.includes('--')) return key.split('--')[0];
  const legacy = key.match(/^((?:cold_jade|vajra|hot_blood)_\d+)_/);
  return legacy?.[1] || key;
}

function getStoneAttributeLabel(itemKey) {
  const key = String(itemKey || '');
  let hook;
  let value;
  if (key.includes('--')) {
    [, hook, value] = key.split('--');
  } else {
    const legacy = key.match(/^(?:cold_jade|vajra|hot_blood)_\d+_(.+)_(-?\d+(?:\.\d+)?)$/);
    if (legacy) [, hook, value] = legacy;
  }
  const labels = {
    atkSelfAdd: '攻击力', atkAdd: '攻击力', weaponSkillBonusAdd: '武功攻击',
    weaponExtraDamageAdd: '追加伤害', hitAdd: '命中', hitSelfAdd: '命中',
    defAdd: '防御', defSelfAdd: '防御', maxHpAdd: '生命', maxHpSelfAdd: '生命',
    missingAdd: '闪避', enhanceSuccessRateAdd: '合成成功率', goldDropBonusAdd: '金币爆率',
  };
  return labels[hook] && value != null ? `${labels[hook]}+${value}` : '';
}

function renderGold(player) {
  return `💰 金币: <b>${(player?.resources?.gold || 0).toLocaleString()}</b>`;
}

function renderItems(items, options = {}) {
  const iconMap = { chest: '👕', gloves: '🧤', boots: '👟' };
  return items.map(item => {
    const locked = options.locked ? ' locked' : '';
    const icon = item.icon || iconMap[item.slot] || '📦';
    return `<div class="shop-item">
      <div class="shop-item-info">
        <div class="shop-item-icon">${escapeHtml(icon)}</div>
        <div>
          <div class="shop-item-name">${escapeHtml(item.name)}</div>
          <div class="shop-item-price">💰 ${Number(item.buy_price || 0).toLocaleString()}</div>
        </div>
      </div>
      <button class="btn-buy${locked}"${locked ? ' disabled' : ''} onclick="window._openShopQuantity('buy','${escapeInlineJsString(item.item_key)}',${Number(item.buy_price || 0)},'${escapeInlineJsString(item.name)}','${escapeInlineJsString(icon)}')">购买</button>
    </div>`;
  }).join('');
}

export function getShopSellPrice(itemKey, player) {
  const itemClass = window.InventorySystem?._getItemClass?.(itemKey, player) || null;
  if (itemClass === 'boxes' || itemClass === 'quest_items') return 0;
  return itemClass === 'equipment'
    ? ShopSystem.getEquipmentSellPrice(player, itemKey)
    : ShopSystem.getSellPrice(itemKey);
}

function renderSellInventory(player) {
  const slots = getBagSlotsInOrder(player);
  const cells = slots.map(slot => {
    const itemKey = slot.item_key;
    const itemClass = window.InventorySystem?._getItemClass?.(itemKey, player) || 'unknown';
    const baseKey = itemClass === 'stones' ? getStoneBaseKey(itemKey) : itemKey;
    const meta = window._itemMetaByKey?.[baseKey] || {};
    const price = getShopSellPrice(itemKey, player);
    const noSell = price <= 0 || itemClass === 'boxes' || itemClass === 'quest_items';
    const instance = slot.instance_id ? player?.inventory?.equipment_instances?.[slot.instance_id] : null;
    const enhance = Number(instance?.enhance_level || 0);
    const name = meta.name || itemKey;
    const icon = meta.icon || (slot.instance_id ? '⚔️' : '📦');
    const sub = itemClass === 'stones' ? getStoneAttributeLabel(itemKey) : '';
    const badge = itemClass === 'quest_items'
      ? `<div class="bt-badge cross quest">任务</div>${slot.count > 1 ? `<div class="bt-badge">×${slot.count}</div>` : ''}`
      : noSell ? '<div class="bt-badge cross">盒子</div>'
        : (slot.count > 1 ? `<div class="bt-badge">×${slot.count}</div>` : '');
    const action = noSell ? `window._showToast('该物品不可出售')`
      : `window._openShopQuantity('sell','${escapeInlineJsString(itemKey)}',${price},'${escapeInlineJsString(name)}','${escapeInlineJsString(icon)}',${slot.count || 1},'${escapeInlineJsString(slot.instance_id || '')}')`;
    return `<button class="bag-tile${slot.instance_id ? ' equip' : ''}${noSell ? ' nosell' : ''}${itemClass === 'quest_items' ? ' cross' : ''}" onclick="${action}" title="${escapeHtml(name)} · ${noSell ? '不可出售' : `出售 ${price} 金币`}">
      <div class="bt-icon">${escapeHtml(icon)}</div><div class="bt-name">${escapeHtml(name)}</div>${sub ? `<div class="bt-sub">${escapeHtml(sub)}</div>` : ''}${enhance > 0 ? `<div class="bt-enh">+${enhance}</div>` : ''}${badge}
    </button>`;
  });
  while (cells.length < 50) cells.push('<div class="bag-tile empty"></div>');
  return `<div class="shop-sell-pane">
    <div class="wh-pane-head"><span class="wh-title">背包</span><span class="wh-count">${slots.length} / ${player?.inventory?.capacity || 50}</span><span class="wh-gold push">🪙 ${(player?.resources?.gold || 0).toLocaleString()}</span><button class="wh-sort" onclick="window._sortShopInventory()">整理</button></div>
    <div class="shop-sell-scroll"><div class="bag-grid">${cells.join('')}</div></div>
  </div>`;
}

function renderShopLayout(player, buyHtml, note = '') {
  return `<div class="shop-sell-layout">
    <div class="shop-buy-pane">${buyHtml}${note ? `<div class="craft-note">${escapeHtml(note)}</div>` : ''}</div>
    ${renderSellInventory(player)}
  </div>`;
}

export function renderWeaponShop(player) {
  const careerFamily = getCareerFamily(player);
  const items = getConfiguredShopItems('weapon');
  const sameCareer = items.filter(item => item.careers.includes(careerFamily));
  const otherCareer = items.filter(item => !item.careers.includes(careerFamily));
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return renderShopLayout(player, `
    ${sectionLabel(`${CAREER_ICON[careerFamily] || '⚔️'} ${careerName} · 可穿戴`)}
    ${renderItems(sameCareer)}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer) : ''}
  `, '商店仅售 base 段武器；t1+ 武器需打怪 / 任务获得');
}

export function renderArmorShop(player) {
  const careerFamily = getCareerFamily(player);
  const items = getConfiguredShopItems('chest');
  const sameCareer = items.filter(item => item.careers.includes(careerFamily));
  const universal = items.filter(item => item.careers.length === 0);
  const otherCareer = items.filter(item => item.careers.length > 0 && !item.careers.includes(careerFamily));
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return renderShopLayout(player, `
    ${renderGold(player)}
    ${sameCareer.length ? sectionLabel(`${CAREER_ICON[careerFamily] || '📦'} ${careerName}可穿戴`) + renderItems(sameCareer) : ''}
    ${universal.length ? sectionLabel('🧤 护手 · 靴子 · 通用可穿戴') + renderItems(universal) : ''}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer, { locked: true }) : ''}
  `, 'v1.0 商店仅售 base 段防具；t2+ 防具需打怪 / 任务获得');
}

export function renderPotionShop(player) {
  const items = getConfiguredShopItems('potion');
  return renderShopLayout(player, `
    ${renderGold(player)}
    ${sectionLabel('❤ 生命药剂')}
    ${renderItems(items.filter(item => item.item_key.startsWith('hp_')))}
    ${sectionLabel('💧 内功药剂')}
    ${renderItems(items.filter(item => item.item_key.startsWith('mp_')))}
  `);
}
