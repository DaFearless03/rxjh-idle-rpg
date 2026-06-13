/**
 * @file ui/ShopUI.js
 * @desc 城镇商店列表渲染：武器、防具、药店。
 */

const CAREER_NAME = { blade: '刀客', sword: '剑客', staff: '医师', spear: '枪客' };
const CAREER_ICON = { blade: '🗡️', sword: '⚔️', staff: '🪄', spear: '🔱' };

const WEAPON_ITEMS = [
  { item_key: 'blade_base_001', name: '直刀', buy_price: 100, icon: '🗡️' },
  { item_key: 'blade_base_002', name: '铁刀', buy_price: 200, icon: '🗡️' },
  { item_key: 'sword_base_001', name: '木剑', buy_price: 100, icon: '⚔️' },
  { item_key: 'sword_base_002', name: '重剑', buy_price: 200, icon: '⚔️' },
  { item_key: 'staff_base_001', name: '木杖', buy_price: 100, icon: '🪄' },
  { item_key: 'staff_base_002', name: '桃木杖', buy_price: 200, icon: '🪄' },
  { item_key: 'spear_base_001', name: '木枪', buy_price: 100, icon: '🔱' },
  { item_key: 'spear_base_002', name: '长枪', buy_price: 200, icon: '🔱' },
];

const ARMOR_ITEMS = [
  { item_key: 'blade_chest_base_001', name: '无名战袍', buy_price: 100, slot: 'chest', career: 'blade' },
  { item_key: 'blade_chest_base_002', name: '金丝战袍', buy_price: 150, slot: 'chest', career: 'blade' },
  { item_key: 'blade_chest_base_003', name: '乌蚕战袍', buy_price: 200, slot: 'chest', career: 'blade' },
  { item_key: 'sword_chest_base_001', name: '无名侠衣', buy_price: 100, slot: 'chest', career: 'sword' },
  { item_key: 'sword_chest_base_002', name: '金丝侠衣', buy_price: 150, slot: 'chest', career: 'sword' },
  { item_key: 'sword_chest_base_003', name: '乌蚕侠衣', buy_price: 200, slot: 'chest', career: 'sword' },
  { item_key: 'staff_chest_base_001', name: '无名法袍', buy_price: 100, slot: 'chest', career: 'staff' },
  { item_key: 'staff_chest_base_002', name: '金丝法袍', buy_price: 150, slot: 'chest', career: 'staff' },
  { item_key: 'staff_chest_base_003', name: '乌蚕法袍', buy_price: 200, slot: 'chest', career: 'staff' },
  { item_key: 'spear_chest_base_001', name: '无名枪衣', buy_price: 100, slot: 'chest', career: 'spear' },
  { item_key: 'spear_chest_base_002', name: '金丝枪衣', buy_price: 150, slot: 'chest', career: 'spear' },
  { item_key: 'spear_chest_base_003', name: '乌蚕枪衣', buy_price: 200, slot: 'chest', career: 'spear' },
  { item_key: 'gloves_base_001', name: '皮护手', buy_price: 50, slot: 'gloves', career: null },
  { item_key: 'gloves_base_002', name: '青铜护手', buy_price: 75, slot: 'gloves', career: null },
  { item_key: 'gloves_base_003', name: '精炼护手', buy_price: 100, slot: 'gloves', career: null },
  { item_key: 'gloves_base_004', name: '罗汉护手', buy_price: 150, slot: 'gloves', career: null },
  { item_key: 'boots_base_001', name: '无名短靴', buy_price: 50, slot: 'boots', career: null },
  { item_key: 'boots_base_002', name: '青衣短靴', buy_price: 60, slot: 'boots', career: null },
  { item_key: 'boots_base_003', name: '皮短靴', buy_price: 75, slot: 'boots', career: null },
  { item_key: 'boots_base_004', name: '无名长靴', buy_price: 100, slot: 'boots', career: null },
  { item_key: 'boots_base_005', name: '皮长靴', buy_price: 150, slot: 'boots', career: null },
];

const POTION_ITEMS = {
  hp: [
    { item_key: 'hp_potion_grade1', name: '金创药（小）', buy_price: 10, icon: '🍶' },
    { item_key: 'hp_potion_grade2', name: '金创药（中）', buy_price: 50, icon: '🍶' },
    { item_key: 'hp_potion_grade3', name: '金创药（大）', buy_price: 120, icon: '🍶' },
  ],
  mp: [
    { item_key: 'mp_potion_grade1', name: '人参', buy_price: 10, icon: '🌿' },
    { item_key: 'mp_potion_grade2', name: '野山参', buy_price: 50, icon: '🌿' },
    { item_key: 'mp_potion_grade3', name: '雪原参', buy_price: 120, icon: '🌿' },
  ],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
        <div class="shop-item-icon">${icon}</div>
        <div>
          <div class="shop-item-name">${escapeHtml(item.name)}</div>
          <div class="shop-item-price">💰 ${Number(item.buy_price || 0).toLocaleString()}</div>
        </div>
      </div>
      <button class="btn-buy${locked}"${locked ? ' disabled' : ''} onclick="window._openShopQuantity('buy','${escapeHtml(item.item_key)}',${Number(item.buy_price || 0)},'${escapeHtml(item.name)}','${icon}')">购买</button>
    </div>`;
  }).join('');
}

export function getShopSellPrice(itemKey, player) {
  const itemClass = window.InventorySystem?._getItemClass?.(itemKey, player) || null;
  if (itemClass === 'boxes' || itemClass === 'quest_items') return 0;
  const fixed = {
    hp_potion_grade1: 1, mp_potion_grade1: 1,
    hp_potion_grade2: 5, mp_potion_grade2: 5,
    hp_potion_grade3: 12, mp_potion_grade3: 12,
    enhance_stone_01: 15, cold_jade_01: 20, vajra_01: 20, hot_blood_01: 25,
  };
  if (fixed[itemKey] != null) return fixed[itemKey];
  const template = window._equipTemplates?.find(item => item.key === itemKey);
  if (!template) return itemClass === 'stones' ? 20 : 1;
  const level = Number(template.required_level || 1);
  if (template.slot === 'weapon') return level < 35 ? level * 100 : level * 1000;
  if (template.slot === 'gloves') return level * 20;
  if (['chest', 'boots', 'inner_armor', 'cape'].includes(template.slot)) return level * 500;
  return 1;
}

function renderSellInventory(player) {
  const slots = (player?.inventory?.slots || []).filter(slot => slot?.item_key && (slot.count || 0) > 0);
  const cells = slots.map(slot => {
    const itemKey = slot.item_key;
    const itemClass = window.InventorySystem?._getItemClass?.(itemKey, player) || 'unknown';
    const baseKey = itemClass === 'stones' ? getStoneBaseKey(itemKey) : itemKey;
    const meta = window._itemMetaByKey?.[baseKey] || {};
    const price = getShopSellPrice(itemKey, player);
    const noSell = price <= 0 || itemClass === 'boxes' || itemClass === 'quest_items';
    const name = meta.name || itemKey;
    const icon = meta.icon || (slot.instance_id ? '⚔️' : '📦');
    const sub = itemClass === 'stones' ? getStoneAttributeLabel(itemKey) : '';
    const badge = noSell ? `<div class="bt-badge cross">${itemClass === 'boxes' ? '盒子' : '任务'}</div>`
      : (slot.count > 1 ? `<div class="bt-badge">×${slot.count}</div>` : '');
    const action = noSell ? `window._showToast('该物品不可出售')`
      : `window._openShopQuantity('sell','${escapeHtml(itemKey)}',${price},'${escapeHtml(name)}','${icon}',${slot.count || 1},'${escapeHtml(slot.instance_id || '')}')`;
    return `<button class="bag-tile${noSell ? ' nosell' : ''}${itemClass === 'quest_items' ? ' cross' : ''}" onclick="${action}" title="${escapeHtml(name)} · ${noSell ? '不可出售' : `出售 ${price} 金币`}">
      <div class="bt-icon">${icon}</div><div class="bt-name">${escapeHtml(name)}</div>${sub ? `<div class="bt-sub">${escapeHtml(sub)}</div>` : ''}${badge}
    </button>`;
  });
  while (cells.length < 50) cells.push('<div class="bag-tile empty"></div>');
  return `<div class="shop-sell-pane">
    <div class="wh-pane-head"><span class="wh-title">背包</span><span class="wh-count">${slots.length} / ${player?.inventory?.capacity || 50}</span><span class="wh-gold push">🪙 ${(player?.resources?.gold || 0).toLocaleString()}</span></div>
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
  const sameCareer = WEAPON_ITEMS.filter(item => item.item_key.startsWith(`${careerFamily}_`));
  const otherCareer = WEAPON_ITEMS.filter(item => !item.item_key.startsWith(`${careerFamily}_`));
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return renderShopLayout(player, `
    ${sectionLabel(`${CAREER_ICON[careerFamily] || '⚔️'} ${careerName} · 可穿戴`)}
    ${renderItems(sameCareer)}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer) : ''}
  `, '商店仅售 base 段武器；t1+ 武器需打怪 / 任务获得');
}

export function renderArmorShop(player) {
  const careerFamily = getCareerFamily(player);
  const sameCareer = ARMOR_ITEMS.filter(item => item.career === careerFamily);
  const universal = ARMOR_ITEMS.filter(item => !item.career);
  const otherCareer = ARMOR_ITEMS.filter(item => item.career && item.career !== careerFamily);
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return renderShopLayout(player, `
    ${renderGold(player)}
    ${sameCareer.length ? sectionLabel(`${CAREER_ICON[careerFamily] || '📦'} ${careerName}可穿戴`) + renderItems(sameCareer) : ''}
    ${universal.length ? sectionLabel('🧤 护手 · 靴子 · 通用可穿戴') + renderItems(universal) : ''}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer, { locked: true }) : ''}
  `, 'v1.0 商店仅售 base 段防具；t2+ 防具需打怪 / 任务获得');
}

export function renderPotionShop(player) {
  return renderShopLayout(player, `
    ${renderGold(player)}
    ${sectionLabel('❤ 生命药剂')}
    ${renderItems(POTION_ITEMS.hp)}
    ${sectionLabel('💧 内功药剂')}
    ${renderItems(POTION_ITEMS.mp)}
  `);
}

export function getShopItemByKey(itemKey) {
  return [...WEAPON_ITEMS, ...ARMOR_ITEMS, ...POTION_ITEMS.hp, ...POTION_ITEMS.mp]
    .find(item => item.item_key === itemKey) || null;
}
