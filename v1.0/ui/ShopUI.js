/**
 * @file ui/ShopUI.js
 * @desc 城镇商店列表渲染：武器、防具、药店。
 */

const CAREER_NAME = { blade: '刀客', sword: '剑客', staff: '医师', spear: '枪客' };
const CAREER_ICON = { blade: '🗡️', sword: '⚔️', staff: '🪄', spear: '🔱' };

const WEAPON_ITEMS = [
  { item_key: 'blade_base_001', name: '直刀', buy_price: 5000, icon: '🗡️' },
  { item_key: 'blade_base_002', name: '铁刀', buy_price: 5000, icon: '🗡️' },
  { item_key: 'sword_base_001', name: '木剑', buy_price: 5000, icon: '⚔️' },
  { item_key: 'sword_base_002', name: '重剑', buy_price: 5000, icon: '⚔️' },
  { item_key: 'staff_base_001', name: '木杖', buy_price: 5000, icon: '🪄' },
  { item_key: 'staff_base_002', name: '桃木杖', buy_price: 5000, icon: '🪄' },
  { item_key: 'spear_base_001', name: '木枪', buy_price: 5000, icon: '🔱' },
  { item_key: 'spear_base_002', name: '长枪', buy_price: 5000, icon: '🔱' },
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
    { item_key: 'hp_potion_grade1', name: '金创药（小）', buy_price: 50, icon: '🍶' },
    { item_key: 'hp_potion_grade2', name: '金创药（中）', buy_price: 100, icon: '🍶' },
    { item_key: 'hp_potion_grade3', name: '金创药（大）', buy_price: 200, icon: '🍶' },
  ],
  mp: [
    { item_key: 'mp_potion_grade1', name: '人参', buy_price: 50, icon: '🌿' },
    { item_key: 'mp_potion_grade2', name: '野山参', buy_price: 100, icon: '🌿' },
    { item_key: 'mp_potion_grade3', name: '雪原参', buy_price: 200, icon: '🌿' },
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
      <button class="btn-buy${locked}" onclick="window._djxBuy('${escapeHtml(item.item_key)}', ${Number(item.buy_price || 0)})">购买</button>
    </div>`;
  }).join('');
}

export function renderWeaponShop(player) {
  const careerFamily = getCareerFamily(player);
  const sameCareer = WEAPON_ITEMS.filter(item => item.item_key.startsWith(`${careerFamily}_`));
  const otherCareer = WEAPON_ITEMS.filter(item => !item.item_key.startsWith(`${careerFamily}_`));
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return `
    ${sectionLabel(`${CAREER_ICON[careerFamily] || '⚔️'} ${careerName} · 可穿戴`)}
    ${renderItems(sameCareer)}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer) : ''}
  `;
}

export function renderArmorShop(player) {
  const careerFamily = getCareerFamily(player);
  const sameCareer = ARMOR_ITEMS.filter(item => item.career === careerFamily);
  const universal = ARMOR_ITEMS.filter(item => !item.career);
  const otherCareer = ARMOR_ITEMS.filter(item => item.career && item.career !== careerFamily);
  const careerName = CAREER_NAME[careerFamily] || '本职业';

  return `
    ${renderGold(player)}
    ${sameCareer.length ? sectionLabel(`${CAREER_ICON[careerFamily] || '📦'} ${careerName}可穿戴`) + renderItems(sameCareer) : ''}
    ${universal.length ? sectionLabel('🧤 护手 · 靴子 · 通用可穿戴') + renderItems(universal) : ''}
    ${otherCareer.length ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer, { locked: true }) : ''}
  `;
}

export function renderPotionShop(player) {
  return `
    ${renderGold(player)}
    ${sectionLabel('❤ 生命药剂')}
    ${renderItems(POTION_ITEMS.hp)}
    ${sectionLabel('💧 内功药剂')}
    ${renderItems(POTION_ITEMS.mp)}
  `;
}

export function getShopItemByKey(itemKey) {
  return [...WEAPON_ITEMS, ...ARMOR_ITEMS, ...POTION_ITEMS.hp, ...POTION_ITEMS.mp]
    .find(item => item.item_key === itemKey) || null;
}
