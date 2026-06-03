/**
 * @file ui/BottomBarUI.js
 * @desc 底部导航 + 主面板切换桥接函数
 */
import { UIManager } from './UIManager.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { SynthesisSystem } from '../systems/SynthesisSystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js';
import { mountInventoryPanel } from './InventoryUI.js';
import { mountWarehouseGrids, syncWarehouseTilesToPlayer } from './WarehouseUI.js';

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
  document.getElementById('tab-char-info')?.classList.toggle('active', tab === 'info');
  document.getElementById('tab-char-skill')?.classList.toggle('active', tab === 'skill');
  renderCharacterTabContent(tab);
};

window._openNPC = (npcKey) => {
  const NPC_DATA = {
    leader: { name: '泫渤派门主', tag: '任务', avatar: '👤', line: '欢迎来到泫渤派！', funcs: ['任务'] },
    djx: { name: '刀剑笑', tag: '武器商 / 强化', avatar: '👤', line: '客官，来看看我的神兵利器！', funcs: ['武器商店','强化','合成'] },
    yjl: { name: '银娇龙', tag: '防具商', avatar: '👤', line: '本店的护具品质一流，童叟无欺！', funcs: ['防具商店'] },
    psz: { name: '平十指', tag: '药剂商', avatar: '👤', line: '平价药剂，童叟无欺！', funcs: ['药水商店'] },
    wdb: { name: '韦大宝', tag: '仓库', avatar: '👤', line: '存什么东西都行，找我就对了！', funcs: ['打开仓库'] },
  };
  const d = NPC_DATA[npcKey];
  if (!d) return;
  const backdrop = document.getElementById('npcDialogBackdrop');
  if (!backdrop) return;
  document.getElementById('npcDialogAvatar').textContent = d.avatar;
  document.getElementById('npcDialogName').textContent = d.name;
  document.getElementById('npcDialogTag').textContent = d.tag;
  document.getElementById('npcDialogLine').textContent = d.line;
  document.getElementById('npcFuncRow').innerHTML = d.funcs.map((f, i) =>
    `<button class="npc-func-btn" data-npc="${npcKey}" data-func="${f}">${f}</button>`
  ).join('');
  backdrop.classList.add('open');
};

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
  document.querySelectorAll('.djx-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('djx-' + _djxCurrentTab + '-content').classList.add('active');
  backdrop.classList.add('open');
  window._renderDjxShop();
};

window._switchDjxTab = (tab) => {
  _djxCurrentTab = tab;
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelectorAll('.djx-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('djx-' + tab + '-content').classList.add('active');
  window._renderDjxShop();
};

window._renderDjxShop = () => {
  const p = window.game?.player;
  const tab = _djxCurrentTab;
  if (tab === 'weapon') {
    const el = document.getElementById('djx-weapon-content');
    if (!el) return;
    // 从 npcs.json 的 shop_weapon_and_enhance 读取，只取 base 武器
    const npcItems = [
      { item_key: 'blade_base_001', name: '直刀', buy_price: 5000, icon: '🗡️' },
      { item_key: 'blade_base_002', name: '铁刀', buy_price: 5000, icon: '🗡️' },
      { item_key: 'sword_base_001', name: '木剑', buy_price: 5000, icon: '⚔️' },
      { item_key: 'sword_base_002', name: '重剑', buy_price: 5000, icon: '⚔️' },
      { item_key: 'staff_base_001', name: '木杖', buy_price: 5000, icon: '🪄' },
      { item_key: 'staff_base_002', name: '桃木杖', buy_price: 5000, icon: '🪄' },
      { item_key: 'spear_base_001', name: '木枪', buy_price: 5000, icon: '🔱' },
      { item_key: 'spear_base_002', name: '长枪', buy_price: 5000, icon: '🔱' },
      { item_key: 'bow_base_001', name: '竹弓', buy_price: 5000, icon: '🏹' },
      { item_key: 'bow_base_002', name: '硬弓', buy_price: 5000, icon: '🏹' },
    ];
    const playerCareerFamily = p?.career_family || (p?.career?.includes('blade') ? 'blade' : p?.career?.includes('sword') ? 'sword' : p?.career?.includes('staff') ? 'staff' : p?.career?.includes('spear') ? 'spear' : p?.career?.includes('bow') ? 'bow' : 'blade');
    const sameCareer = [], otherCareer = [];
    const CAREER_FAMILY_MAP = { blade: ['blade'], sword: ['sword'], staff: ['staff'], spear: ['spear'], bow: ['bow'] };
    npcItems.forEach(i => {
      const prefix = i.item_key.split('_')[0];
      const families = CAREER_FAMILY_MAP[prefix] || [prefix];
      if (families.includes(playerCareerFamily)) {
        sameCareer.push(i);
      } else {
        otherCareer.push(i);
      }
    });

    const renderItems = (items) => items.map(i => `
      <div class="shop-item">
        <div class="shop-item-info">
          <div class="shop-item-icon">${i.icon}</div>
          <div>
            <div class="shop-item-name">${i.name}</div>
            <div class="shop-item-price">💰 ${i.buy_price.toLocaleString()}</div>
          </div>
        </div>
        <button class="btn-buy" onclick="window._djxBuy('${i.item_key}', ${i.buy_price})">购买</button>
      </div>
    `).join('');

    const sectionLabel = (label) => `<div class="shop-section-label">${label}</div>`;
    const careerName = { blade: '刀客', sword: '剑客', staff: '医师', spear: '枪客', bow: '弓手' }[playerCareerFamily] || '本职业';

    el.innerHTML = `
      ${sectionLabel('⚔️ ' + careerName + ' · 可穿戴')}
      ${renderItems(sameCareer)}
      ${otherCareer.length > 0 ? sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + otherCareer.map(i => `
        <div class="shop-item">
          <div class="shop-item-info">
            <div class="shop-item-icon">${i.icon}</div>
            <div>
              <div class="shop-item-name">${i.name}</div>
              <div class="shop-item-price">💰 ${i.buy_price.toLocaleString()}</div>
            </div>
          </div>
          <button class="btn-buy" onclick="window._djxBuy('${i.item_key}', ${i.buy_price})">购买</button>
        </div>
      `).join('') : ''}
    `;
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
  const slots = p?.inventory?.slots || [];
  // 区分装备和石头/道具
  const equipItems = slots.filter(it => !it.item_key?.includes('stone') && !it.item_key?.includes('gem') && !it.item_key?.includes('charm'));
  const stoneItems = slots.filter(it => it.item_key?.includes('stone') || it.item_key?.includes('gem'));
  const makeItemGrid = (items) => {
    if (!items.length) return '';
    return items.map(it => `
      <div class="bag-tile" data-kind="equip" data-key="${it.item_key}" data-icon="${it.item_key?.includes('stone')||it.item_key?.includes('gem')?'💎':'📦'}" data-name="${it.name || it.item_key}">
        <div class="bt-icon">${it.item_key?.includes('stone')||it.item_key?.includes('gem')?'💎':'📦'}</div>
        <div class="bt-name">${it.name || it.item_key}</div>
      </div>
    `).join('');
  };
  const makeEmptySlots = (n) => Array(n).fill('<div class="bag-tile empty-slot"></div>').join('');
  const bagEquipGrid = makeItemGrid(equipItems) + makeEmptySlots(Math.max(0, 12 - equipItems.length));
  const bagStoneGrid = makeItemGrid(stoneItems) + makeEmptySlots(Math.max(0, 12 - stoneItems.length));

  const isSynth = type === 'synth';
  const craftTitle = isSynth ? '💎 合成 · 镶嵌' : '⚒ 强化';
  const craftBtn = isSynth ? '合成' : '强化';
  const workLabel = isSynth ? '拖入装备（武器→金刚石 / 防具→寒玉石）' : '拖入装备';
  const stoneLabel = isSynth ? '合成石' : '强化石';
  const slotHintEquip = isSynth ? '拖入装备' : '拖入装备';
  const slotHintStone = isSynth ? '拖入<br>合成石' : '拖入<br>强化石';

  el.innerHTML = `
    <div class="craft-body">
      <div class="craft-work">
        <div class="craft-slots">
          <div class="craft-dropzone equip-slot" data-zone="equip"
               ondragover="event.preventDefault(); this.classList.add('dragover')"
               ondragleave="this.classList.remove('dragover')"
               ondrop="window._djxDropItem(event, 'equip', '${type}')">
            <div class="dz-plus">＋</div><div class="dz-hint">拖入装备</div>
          </div>
          <div class="craft-arrow">＋</div>
          <div class="craft-dropzone stone-slot" data-zone="${type}-stone"
               ondragover="event.preventDefault(); this.classList.add('dragover')"
               ondragleave="this.classList.remove('dragover')"
               ondrop="window._djxDropItem(event, 'stone', '${type}')">
            <div class="dz-plus">＋</div><div class="dz-hint">${slotHintStone}</div>
          </div>
        </div>
        <div class="craft-result hidden" id="djx-${type}-result"></div>
        <div class="craft-warn hidden" id="djx-${type}-warn"></div>
        <div class="craft-actions">
          <button class="craft-confirm" disabled onclick="window._djxDoCraft('${type}')">${craftBtn}</button>
          <button class="craft-reset" data-reset onclick="window._djxClearAll('${type}')">清空</button>
        </div>
      </div>
      <div class="craft-bag">
        <div class="bag-label">🎒 ${isSynth ? '可合成装备' : '可强化装备（武器/防具）'}</div>
        <div class="bag-grid" id="djx-${type}-equip-grid">${bagEquipGrid}</div>
        <div class="bag-label">💎 ${stoneLabel}</div>
        <div class="bag-grid" id="djx-${type}-stone-grid">${bagStoneGrid}</div>
      </div>
    </div>
  `;

  // 给 bag-tile 绑定点击选物品到槽
  el.querySelectorAll('.bag-tile[data-key]').forEach(tile => {
    tile.addEventListener('click', () => {
      const key = tile.dataset.key;
      const isStone = key.includes('stone') || key.includes('gem');
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

window._djxSelectItem = (key, type) => {
  const stoneKey = key.includes('stone') || key.includes('gem') || key.includes('synth') || key.includes('enhance');
  const dataKey = stoneKey ? 'stone' : 'equip';
  window._djxSlots[type][dataKey] = key;

  // 更新 demo 风格的 craft-dropzone
  const zoneEquip = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="equip"]`);
  const zoneStone = document.querySelector(`#djx-${type}-content .craft-dropzone[data-zone="${type}-stone"]`);
  const targetZone = stoneKey ? zoneStone : zoneEquip;
  if (targetZone) {
    targetZone.classList.add('filled');
    const icon = stoneKey ? '💎' : '⚔️';
    targetZone.innerHTML = `
      <div class="dz-icon" style="font-size:1.8rem">${icon}</div>
      <div class="dz-name" style="font-size:0.75rem;font-weight:bold;margin-top:0.2rem">${key}</div>
      <div class="dz-clear" style="position:absolute;top:0.2rem;right:0.3rem;font-size:1rem;opacity:0.5;cursor:pointer">×</div>
    `;
    // 点击 × 清空该槽
    targetZone.querySelector('.dz-clear').addEventListener('click', e => {
      e.stopPropagation();
      window._djxClearSlot(dataKey, type);
    });
  }
  // 显示清空按钮
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
    const isStone = slotKey && (slotKey.includes('stone') || slotKey.includes('gem'));
    targetZone.innerHTML = `<div class="dz-plus">＋</div><div class="dz-hint">${isStone ? (type === 'synth' ? '拖入<br>合成石' : '拖入<br>强化石') : '拖入装备'}</div>`;
  }
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
  if ((p.resources?.gold || 0) < price) { window._showToast('金币不足'); return; }
  const npcData = { type: 'shop', items: [{ item_key: itemKey, buy_price: price }] };
  const r = ShopSystem.buy(p, npcData, itemKey, 1);
  if (r && r.success) {
    window._showToast('购买成功');
    document.getElementById('djxShopGold').textContent = (p.resources?.gold || 0).toLocaleString();
    window._renderDjxShop();
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
  const p = window.game?.player;
  const gold = p?.resources?.gold || 0;
  const careerFamily = p?.career_family || (p?.career?.includes('blade') ? 'blade' : p?.career?.includes('sword') ? 'sword' : p?.career?.includes('staff') ? 'staff' : p?.career?.includes('spear') ? 'spear' : 'blade');
  const ICON_MAP = { chest: '👕', gloves: '🧤', boots: '👟' };
  const CAREER_ICON = { blade: '🗡️', sword: '⚔️', staff: '🪄', spear: '🔱', bow: '🏹' };
  const CAREER_NAME = { blade: '刀客', sword: '剑客', staff: '医师', spear: '枪客', bow: '弓手' };

  // 从 npcs.json shop_armor 读取完整数据
  const armorRaw = [
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

  const sameCareer = armorRaw.filter(a => a.career === careerFamily);
  const otherCareer = armorRaw.filter(a => a.career && a.career !== careerFamily);
  const universal = armorRaw.filter(a => !a.career);

  const renderItems = (items) => items.map(i => `
    <div class="shop-item">
      <div class="shop-item-info">
        <div class="shop-item-icon">${ICON_MAP[i.slot] || '📦'}</div>
        <div>
          <div class="shop-item-name">${i.name}</div>
          <div class="shop-item-price">💰 ${i.buy_price.toLocaleString()}</div>
        </div>
      </div>
      <button class="btn-buy" onclick="window._djxBuy('${i.item_key}', ${i.buy_price})">购买</button>
    </div>
  `).join('');

  const sectionLabel = (label) => `<div class="shop-section-label">${label}</div>`;
  const cName = CAREER_NAME[careerFamily] || '本职业';
  let html = `💰 金币: <b>${gold.toLocaleString()}</b>`;
  if (sameCareer.length) html += sectionLabel(`${CAREER_ICON[careerFamily] || '📦'} ${cName}可穿戴`) + renderItems(sameCareer);
  if (universal.length) html += sectionLabel('🧤 护手 · 靴子 · 通用可穿戴') + renderItems(universal);
  if (otherCareer.length) html += sectionLabel('📦 其他职业 · 可购买（不可穿戴）') + renderItems(otherCareer).replace(/btn-buy/g, 'btn-buy locked');

  el.innerHTML = html;
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
  const p = window.game?.player;
  const gold = p?.resources?.gold || 0;
  const hpItems = [
    { name: '金创药（小）', buy_price: 50, icon: '🍶' },
    { name: '金创药（中）', buy_price: 100, icon: '🍶' },
    { name: '金创药（大）', buy_price: 200, icon: '🍶' },
  ];
  const mpItems = [
    { name: '人参', buy_price: 50, icon: '🌿' },
    { name: '野山参', buy_price: 100, icon: '🌿' },
    { name: '雪原参', buy_price: 200, icon: '🌿' },
  ];
  const renderItems = (items) => items.map(i => `
    <div class="shop-item">
      <div class="shop-item-info">
        <div class="shop-item-icon">${i.icon}</div>
        <div>
          <div class="shop-item-name">${i.name}</div>
          <div class="shop-item-price">💰 ${i.buy_price.toLocaleString()}</div>
        </div>
      </div>
      <button class="btn-buy" onclick="window._djxBuy('${i.name}', ${i.buy_price})">购买</button>
    </div>
  `).join('');
  const sectionLabel = (label) => `<div class="shop-section-label">${label}</div>`;
  el.innerHTML = `
    💰 金币: <b>${gold.toLocaleString()}</b>
    ${sectionLabel('❤ 生命药剂')}
    ${renderItems(hpItems)}
    ${sectionLabel('💧 内功药剂')}
    ${renderItems(mpItems)}
  `;
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

window._toggleSound = () => {
  // 占位
};
window._toggleMusic = () => {
  // 占位
};
window._toggleAutoSave = () => {
  // 占位
};
window._exitGame = () => {
  if (confirm('确定退出游戏？')) {
    localStorage.removeItem('last_slot');
    location.reload();
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
  }
}

function renderCharacterPanel(player) {
  const el = document.getElementById('character-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  const expToNext = window.expToNext?.[p.level] || 0;
  el.innerHTML = `
    <div class="char-basic">
      <span class="char-class">${p.career || '—'}</span>
      <span class="char-name">${p.name || '—'}</span>
      <span class="char-level">Lv.${p.level}</span>
    </div>
    <div class="char-exp">经验: ${p.exp?.toLocaleString() || 0} / ${expToNext.toLocaleString()}</div>
    <div class="char-attrs">
      <div class="attr-item">力:${p.str || 0}</div>
      <div class="attr-item">心:${p.int || 0}</div>
      <div class="attr-item">体:${p.sta || 0}</div>
      <div class="attr-item">身:${p.dex || 0}</div>
    </div>
    <div class="char-stats">
      <div class="stat-row"><span class="stat-label">生命</span><span class="stat-value">${p.maxHp || 0}</span></div>
      <div class="stat-row"><span class="stat-label">内功</span><span class="stat-value">${p.maxMp || 0}</span></div>
      <div class="stat-row"><span class="stat-label">攻击</span><span class="stat-value">${p.atk_min || 0}-${p.atk_max || 0}</span></div>
      <div class="stat-row"><span class="stat-label">防御</span><span class="stat-value">${p.def || 0}</span></div>
    </div>
    <div class="qigong-section">
      <div class="qigong-title">
        <div class="qigong-title-left">🌀 气功</div>
        <button class="btn-reset-qigong" onclick="window._resetQigong()">重置气功</button>
        <div class="qigong-title-right">
          <span class="qigong-points">气功点数: ${p.qigong?.available_points || 0}</span>
        </div>
      </div>
      <div class="qigong-grid" id="qigong-grid"></div>
    </div>
  `;
  renderQigongGrid(p);
}

function renderQigongGrid(player) {
  const grid = document.getElementById('qigong-grid');
  if (!grid || !player) return;
  // 显示玩家已学习的气功
  const invested = player.qigong?.invested || {};
  const qigongs = Object.entries(invested).map(([key, level]) => ({ key, level })).slice(0, 12);
  if (qigongs.length === 0) {
    grid.innerHTML = '<div style="font-size:12px;color:#888;text-align:center;padding:16px">暂无气功</div>';
    return;
  }
  grid.innerHTML = qigongs.map(q => `
    <div class="qigong-item" onclick="window._investQigong('${q.key}', 1)">
      <div class="qigong-level">${q.level}</div>
      <div style="font-size:10px;color:#aaa">${q.key}</div>
      <div class="qigong-add">+</div>
    </div>
  `).join('');
}

function renderCharacterTabContent(tab) {
  if (tab === 'info') renderCharacterPanel(window.game?.player);
}

function renderInventoryPanel(player) {
  const el = document.getElementById('inventory-panel-content');
  if (!el) return;
  const p = player || window.game?.player;
  if (!p) return;
  mountInventoryPanel(el, p);
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
  const accepted = p.quests?.accepted || [];
  if (accepted.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:#888;text-align:center;padding:20px">暂无进行中的任务</div>';
    return;
  }
  el.innerHTML = `
    <div class="quest-section">
      <p class="quest-section-title">进行中的任务</p>
      ${accepted.map(q => `
        <div class="attr-row">
          <span class="attr-label" style="color:#e94560">${q.name}</span>
          <span class="attr-value" style="color:#888">进行中</span>
        </div>
      `).join('')}
    </div>
  `;
}

window._resetQigong = () => {
  const p = window.game?.player;
  if (!p) return;
  import('./QigongSystem.js').then(m => {
    const r = m.QigongSystem.resetQigong(p);
    if (r && r.success) {
      window._attrSys?.recompute(p);
      UIManager.toast('气功已重置', 'success');
      renderCharacterPanel(p);
    } else {
      UIManager.toast(r?.message || '重置失败', 'error');
    }
  });
};

window._investQigong = (key, pts) => {
  const p = window.game?.player;
  if (!p) return;
  import('./QigongSystem.js').then(m => {
    const r = m.QigongSystem.investQigong(p, key, pts);
    if (r && r.success) {
      window._attrSys?.recompute(p);
      renderCharacterPanel(p);
    } else {
      UIManager.toast(r?.message || '分配失败', 'error');
    }
  });
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
