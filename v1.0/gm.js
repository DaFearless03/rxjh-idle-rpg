/**
 * @file gm.js
 * @desc GM 调试面板，视觉结构参照 demo/ui_demo_gm.html。
 */
(function () {
  const PANEL_ID = 'gm-panel';
  let visible = false;
  let pendingDanger = null;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const player = () => window.Game?.currentPlayer || null;
  const config = () => window.GameConfig || {};
  const value = (id, fallback = 0) => {
    const parsed = Number(document.getElementById(id)?.value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const selected = id => document.getElementById(id)?.dataset?.value || document.getElementById(id)?.value || '';
  const slotLabels = { weapon:'⚔ 武器', chest:'🧥 胸甲', gloves:'🧤 手套', boots:'👢 鞋子', inner_armor:'🛡 内甲', ring:'💍 戒指', earring:'✨ 耳环', amulet:'📿 项链', cape:'🦸 披风' };
  const familyLabels = { blade:'🔪 刀', sword:'⚔ 剑', spear:'🔱 枪', staff:'🌿 医' };
  const factionLabels = { positive:'☀正', negative:'🌙邪', neutral:'⚪中' };

  function toast(message, type = 'info') {
    const shell = document.querySelector('#gm-panel .gm-shell');
    if (shell) {
      let stack = shell.querySelector('.gm-toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'gm-toast-stack';
        shell.appendChild(stack);
      }
      const item = document.createElement('div');
      item.className = `gm-toast ${type}`;
      item.textContent = message;
      stack.appendChild(item);
      setTimeout(() => item.remove(), 2200);
    } else {
      window._uiManager?.toast?.(`(GM) ${message}`, type);
    }
    console.log('[GM]', message);
  }

  function requirePlayer() {
    const current = player();
    if (!current) toast('请先进入一个角色', 'error');
    return current;
  }

  async function finish(message, { recompute = true, save = true, refill = false } = {}) {
    const current = player();
    if (current && recompute) {
      window.AttributeSystem?.recompute?.(current);
      current.hp = refill ? current.maxHp : Math.min(current.hp ?? current.maxHp, current.maxHp);
      current.mp = refill ? current.maxMp : Math.min(current.mp ?? current.maxMp, current.maxMp);
    }
    window.EventBus?.emit?.('gm.refresh', { source: 'gm.js' });
    const saved = !save || await window.SaveManager?.save?.();
    if (!saved) {
      toast(`${message}，但存档失败`, 'error');
      syncPanel();
      return false;
    }
    toast(message, 'success');
    syncPanel();
    return true;
  }

  function positiveSafeInteger(input, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(input);
    return Number.isSafeInteger(number) && number > 0 && number <= max ? number : 0;
  }

  function itemMeta(key) {
    return window._itemMetaByKey?.[key] || { name: key };
  }

  function giveItem(key, count) {
    const current = requirePlayer();
    if (!current || !key) return null;
    return window.InventorySystem?.add?.(current, key, count);
  }

  function equipmentStats(item) {
    const stats = item.base_stats || {};
    if (stats.atkMin != null || stats.atkMax != null) return `攻 ${stats.atkMin || 0}~${stats.atkMax || 0}`;
    return Object.entries(stats).map(([key, val]) => `${key} ${val}`).join(' · ') || '无基础属性';
  }

  function optionTag(item) {
    const faction = item.faction || 'neutral';
    return `<span class="eq-tag lv">Lv.${item.required_level || 1}</span><span class="eq-tag ${faction === 'positive' ? 'pos' : faction === 'negative' ? 'neg' : 'neu'}">${factionLabels[faction] || faction}</span>`;
  }

  function dropdown(id, items, selectedValue, rich = false) {
    const active = items.find(item => item.value === selectedValue) || items[0];
    return `<div class="gm-dropdown" id="${id}" data-value="${esc(active?.value || '')}">
      <button class="dd-trigger" type="button">${esc(active?.label || '(无)')}</button>
      <div class="dd-list">${items.map((item, index) => `<button type="button" class="dd-item${index === 0 ? ' selected' : ''}" data-value="${esc(item.value)}" data-label="${esc(item.label)}">${rich ? item.html : esc(item.label)}</button>`).join('')}</div>
    </div>`;
  }

  function equipmentDropdown() {
    const slots = Object.entries(slotLabels).map(([value, label]) => ({ value, label }));
    const families = Object.entries(familyLabels).map(([value, label]) => ({ value, label }));
    return `<div class="stone-gen">
      <div class="stone-gen-row"><span class="sg-label">部位</span>${dropdown('gm-equip-slot', slots, 'weapon')}</div>
      <div class="stone-gen-row" id="gm-equip-family-row"><span class="sg-label">职业</span>${dropdown('gm-equip-family', families, 'blade')}</div>
      <div class="stone-gen-row"><span class="sg-label">装备</span><div id="gm-equip-name-wrap"></div></div>
      <div class="stone-gen-row"><span class="sg-label">数量</span><input class="gm-input compact" id="gm-equip-count" type="number" value="1" min="1" max="99"><button class="gm-btn" data-action="give-equipment">给予</button></div>
      <div class="sg-result" id="gm-equip-result"></div>
    </div>`;
  }

  function careerDropdown() {
    const items = (config().careers || []).map(item => ({
      value: item.key,
      label: `${item.name || item.key} (${item.key})`,
      html: `<div class="eq-info"><div class="eq-name-line">${esc(item.name || item.key)} <span class="eq-tag ${item.faction === 'positive' ? 'pos' : item.faction === 'negative' ? 'neg' : 'neu'}">${esc(item.stage || 'base')}</span></div><div class="eq-stats">${familyLabels[item.career_family] || item.career_family} · ${factionLabels[item.faction] || item.faction} · ${esc(item.key)}</div></div>`,
    }));
    return dropdown('gm-career', items, player()?.career || items[0]?.value, true);
  }

  function stoneGenerator() {
    const stones = Object.values(config().stones || {}).flatMap(group => Array.isArray(group) ? group : []);
    const items = stones.map(stone => ({ value: stone.key, label: stone.name || stone.key }));
    return `<div class="stone-gen">
      <div class="stone-gen-row"><span class="sg-label">石头</span>${dropdown('gm-stone', items, 'cold_jade_01')}</div>
      <div class="stone-gen-row" id="gm-stone-attr-row"><span class="sg-label">属性</span><div id="gm-stone-attr-wrap"></div></div>
      <div class="stone-gen-row" id="gm-stone-value-row"><span class="sg-label">数值</span><input class="gm-input compact" id="gm-stone-value" type="number"></div>
      <div class="stone-gen-row"><span class="sg-label">数量</span><input class="gm-input compact" id="gm-stone-count" type="number" value="10" min="1" max="99"><button class="gm-btn" data-action="give-stone">生成</button></div>
      <div class="sg-result" id="gm-stone-result"></div>
    </div>`;
  }

  function zoneGroups() {
    const zones = config().sub_zones || config().zones || [];
    const groups = new Map();
    for (const zone of zones) {
      const prefix = zone.key?.split('_')[0] || '江湖';
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix).push(zone);
    }
    const labels = {
      xuanbo: ['🌾', '泫渤派郊外'], liuzheng: ['⛩', '柳正关'], sanxie: ['🏴', '三邪关'],
      shenwu: ['⚔', '神武门'], liushan: ['🐍', '柳善提督府'], nanminghu: ['🌊', '南明湖'],
    };
    const town = `<div class="map-group"><div class="map-group-header"><span class="group-icon">🏯</span>泫渤派城镇</div><div class="map-sub-list"><button class="tp-btn" data-zone="">城镇</button></div></div>`;
    return town + [...groups.entries()].map(([prefix, entries]) => {
      const [icon, label] = labels[prefix] || ['🗺', prefix];
      return `<div class="map-group"><div class="map-group-header"><span class="group-icon">${icon}</span>${esc(label)}</div><div class="map-sub-list">${
        entries.map(zone => `<button class="tp-btn" data-zone="${esc(zone.key)}">${esc(zone.name || zone.key)}</button>`).join('')
      }</div></div>`;
    }).join('');
  }

  function card(icon, title, body, danger = false) {
    return `<section class="gm-card${danger ? ' danger-card' : ''}"><h3>${icon} ${title}</h3>${body}</section>`;
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="gm-shell">
        <header class="gm-header">
          <button class="gm-close" data-gm-close>×</button>
          <h1>🛠 GM 调试面板</h1>
          <p>Ctrl+Shift+G · 调试专用</p>
        </header>
        <nav class="gm-tab-bar">
          <button class="gm-tab active" data-tab="resource">💰 资源</button>
          <button class="gm-tab" data-tab="equip">⚔ 装备</button>
          <button class="gm-tab" data-tab="item">💎 道具</button>
          <button class="gm-tab" data-tab="status">🧬 状态</button>
          <button class="gm-tab" data-tab="teleport">🗺 传送</button>
          <button class="gm-tab danger-tab" data-tab="danger">⚠ 危险</button>
        </nav>
        <main class="gm-body">
          <div class="gm-pane active" data-pane="resource">
            ${card('💰', '金币', `<div class="gm-btn-row"><button class="gm-btn" data-action="gold" data-value="1000">+1,000</button><button class="gm-btn" data-action="gold" data-value="10000">+10,000</button></div><div class="gm-input-row"><input class="gm-input" id="gm-gold" type="number" placeholder="自定义数量"><button class="gm-btn" data-action="gold-custom">发放</button></div>`)}
            ${card('✨', '经验（自动连升级）', `<div class="gm-btn-row"><button class="gm-btn" data-action="exp" data-value="1000">+1,000</button><button class="gm-btn" data-action="exp" data-value="10000">+10,000</button></div><div class="gm-input-row"><input class="gm-input" id="gm-exp" type="number" placeholder="自定义数量"><button class="gm-btn" data-action="exp-custom">发放</button></div>`)}
            ${card('🔮', '气功点', `<div class="gm-btn-row"><button class="gm-btn" data-action="qigong" data-value="5">+5 点</button></div><div class="gm-input-row"><input class="gm-input" id="gm-qigong" type="number" placeholder="自定义点数"><button class="gm-btn" data-action="qigong-custom">发放</button></div>`)}
            ${card('❤️', '生命 / 内功', `<div class="gm-btn-row"><button class="gm-btn" data-action="heal">满 HP/MP</button></div>`)}
            ${card('📊', '设置等级', `<div class="gm-input-row"><input class="gm-input" id="gm-level" type="number" min="1" max="60" value="30"><button class="gm-btn" data-action="level">确认</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="equip">
            ${card('🎯', '给予装备', equipmentDropdown())}
            ${card('📦', '一键套装', `<div class="gm-btn-row"><button class="gm-btn" data-action="set" data-value="0">全套 Base</button><button class="gm-btn" data-action="set" data-value="1">全套 T1</button></div>`)}
            ${card('🔨', '强化', `<div class="gm-btn-row"><button class="gm-btn" data-action="enhance" data-value="10">当前武器 → +10</button></div><div class="gm-input-row"><input class="gm-input" id="gm-enhance" type="number" value="5" min="0" max="10"><button class="gm-btn" data-action="enhance-custom">强化到 +N</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="item">
            ${card('💎', '石头生成器', stoneGenerator())}
            ${card('🌿', '药剂快捷（+99）', `<div class="gm-btn-row">${['hp_potion_grade1','hp_potion_grade2','hp_potion_grade3','mp_potion_grade1','mp_potion_grade2','mp_potion_grade3'].map(key => `<button class="gm-btn" data-action="quick-item" data-value="${key}">${esc(itemMeta(key).name)}</button>`).join('')}</div>`)}
            ${card('📦', '盒子快捷（+10）', `<div class="gm-btn-row">${(config().boxes || []).map(box => `<button class="gm-btn" data-action="quick-box" data-value="${esc(box.key)}">${esc(box.name || box.key)}</button>`).join('')}</div>`)}
          </div>
          <div class="gm-pane" data-pane="status">
            ${card('⚖', '派系', `<div class="gm-btn-row"><button class="gm-btn" data-action="faction" data-value="positive">☀ 正派</button><button class="gm-btn" data-action="faction" data-value="negative">🌙 邪派</button><button class="gm-btn" data-action="faction" data-value="neutral">⚪ 中立</button></div>`)}
            ${card('🎭', '职业切换', `${careerDropdown()}<div class="gm-btn-row spaced"><button class="gm-btn" data-action="career">应用职业</button></div>`)}
            ${card('🔮', '气功操作', `<div class="gm-btn-row"><button class="gm-btn" data-action="qigong-full">一键满气功</button><button class="gm-btn" data-action="qigong-reset">气功重置</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="teleport">${zoneGroups()}</div>
          <div class="gm-pane" data-pane="danger">
            ${card('⚠', '危险操作（二次确认）', `<div class="gm-btn-row"><button class="gm-btn danger" data-danger="clear-bag">清空背包</button><button class="gm-btn danger" data-danger="clear-warehouse">清空仓库</button></div><div class="gm-btn-row spaced"><button class="gm-btn danger" data-danger="export-save">导出存档</button><button class="gm-btn danger" data-danger="import-save">导入存档</button></div><div class="gm-btn-row spaced"><button class="gm-btn danger" data-danger="nuke">清空 localStorage + 刷新</button></div>`, true)}
          </div>
        </main>
        <div class="gm-confirm" id="gm-confirm">
          <div class="gm-modal"><h2 id="gm-confirm-title">⚠ 确认操作</h2><p id="gm-confirm-text">此操作不可撤销</p><div><button data-gm-cancel>取消</button><button class="danger" data-gm-confirm>确认执行</button></div></div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    bindPanel(panel);
    updateEquipmentList();
    updateStoneAttributes();
    syncPanel();
  }

  function syncPanel() {
    const current = player();
    const level = document.getElementById('gm-level');
    const career = document.getElementById('gm-career');
    if (level && current) level.value = current.level || 1;
    if (career && current) selectDropdownValue(career, current.career);
  }

  function selectDropdownValue(dropdownEl, nextValue) {
    if (!dropdownEl) return;
    const item = [...dropdownEl.querySelectorAll('.dd-item')].find(entry => entry.dataset.value === nextValue);
    if (!item) return;
    dropdownEl.dataset.value = nextValue;
    dropdownEl.querySelectorAll('.dd-item').forEach(entry => entry.classList.toggle('selected', entry === item));
    dropdownEl.querySelector('.dd-trigger').textContent = item.dataset.label || item.textContent.trim();
  }

  function updateEquipmentList() {
    const slot = selected('gm-equip-slot') || 'weapon';
    const family = selected('gm-equip-family') || 'blade';
    const familyRow = document.getElementById('gm-equip-family-row');
    const careerSlot = slot === 'weapon' || slot === 'chest';
    if (familyRow) familyRow.hidden = !careerSlot;
    const equipments = (config().equipments || []).filter(item => {
      if (item.slot !== slot) return false;
      if (!careerSlot) return true;
      return !item.required_career?.length || item.required_career.includes(family);
    });
    const items = equipments.map(item => ({
      value: item.key,
      label: item.name || item.key,
      html: `<div class="eq-info"><div class="eq-name-line">${esc(item.name || item.key)} ${optionTag(item)}</div><div class="eq-stats">${esc(equipmentStats(item))} · ${esc(item.key)}</div></div>`,
    }));
    const wrap = document.getElementById('gm-equip-name-wrap');
    if (wrap) wrap.innerHTML = dropdown('gm-equipment', items, items[0]?.value, true);
    updateEquipmentResult();
  }

  function updateEquipmentResult() {
    const key = selected('gm-equipment');
    const item = (config().equipments || []).find(entry => entry.key === key);
    const qty = Math.max(1, value('gm-equip-count', 1));
    const result = document.getElementById('gm-equip-result');
    if (result) result.textContent = item ? `${item.key} (${item.name}) ×${qty}` : '(未选择)';
  }

  function findStone(key) {
    return Object.values(config().stones || {}).flatMap(group => Array.isArray(group) ? group : []).find(stone => stone.key === key);
  }

  function updateStoneAttributes() {
    const stone = findStone(selected('gm-stone'));
    const pool = stone?.attribute?.pool || [];
    const attrRow = document.getElementById('gm-stone-attr-row');
    const valueRow = document.getElementById('gm-stone-value-row');
    if (attrRow) attrRow.hidden = pool.length === 0;
    if (valueRow) valueRow.hidden = pool.length === 0;
    const items = pool.map(attr => ({ value: attr.key, label: attr.name, range: attr.value_range || [1, 1] }));
    const wrap = document.getElementById('gm-stone-attr-wrap');
    if (wrap) {
      wrap.innerHTML = pool.length ? dropdown('gm-stone-attr', items, items[0]?.value) : '';
      const options = wrap.querySelectorAll('.dd-item');
      options.forEach((option, index) => { option.dataset.range = items[index].range.join(','); });
    }
    updateStoneValueRange();
  }

  function updateStoneValueRange() {
    const attr = document.querySelector('#gm-stone-attr .dd-item.selected');
    const range = (attr?.dataset.range || '1,1').split(',').map(Number);
    const input = document.getElementById('gm-stone-value');
    if (input) {
      input.min = range[0];
      input.max = range[1];
      input.step = Number.isInteger(range[0]) && Number.isInteger(range[1]) ? 1 : 0.01;
      input.value = range[0];
    }
    updateStoneResult();
  }

  function generatedStoneKey() {
    const baseKey = selected('gm-stone');
    const attr = selected('gm-stone-attr');
    return attr ? `${baseKey}--${attr}--${value('gm-stone-value', 1)}` : baseKey;
  }

  function updateStoneResult() {
    const result = document.getElementById('gm-stone-result');
    if (result) result.textContent = `key: ${generatedStoneKey()} ×${Math.max(1, value('gm-stone-count', 1))}`;
  }

  function setLevel(current, nextLevel) {
    const cap = positiveSafeInteger(window.currentLevelCap || config().current_level_cap, 1000) || 60;
    current.level = Math.min(cap, Math.max(1, Math.floor(Number(nextLevel) || 1)));
    current.exp = 0;
    return window.Game?.rebuildCareerFields?.(current) === true;
  }

  function addExp(current, amount) {
    const gain = positiveSafeInteger(amount);
    const currentExp = Number(current.exp);
    if (!gain || !Number.isSafeInteger(currentExp) || currentExp < 0 || gain > Number.MAX_SAFE_INTEGER - currentExp) return -1;
    const cap = positiveSafeInteger(window.currentLevelCap || config().current_level_cap, 1000) || 60;
    if (!Number.isSafeInteger(current.level) || current.level < 1 || current.level >= cap) return -1;
    current.exp = currentExp + gain;
    let levelsGained = 0;
    while (current.level < cap) {
      const needed = positiveSafeInteger(window.expToNext?.[current.level]);
      if (!needed || current.exp < needed) break;
      current.exp -= needed;
      current.level += 1;
      levelsGained += 1;
      const points = Number(config().attribute_points?.gain_per_level?.[current.level]);
      if (Number.isSafeInteger(points) && points > 0) {
        current.qigong = current.qigong || { available_points: 0, invested: {} };
        const available = Number(current.qigong.available_points);
        if (Number.isSafeInteger(available) && available >= 0 && points <= Number.MAX_SAFE_INTEGER - available) {
          current.qigong.available_points = available + points;
        }
      }
    }
    if (current.level >= cap) current.exp = 0;
    window.Game?.rebuildCareerFields?.(current);
    return levelsGained;
  }

  function giveEquipment(current, key, count = 1) {
    const template = (config().equipments || []).find(item => item.key === key);
    if (!template) return 0;
    let added = 0;
    for (let i = 0; i < count; i++) {
      const instance = {
        instance_id: `gm_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        item_key: key,
        enhance_level: 0,
        synthesis_slots: [],
        desc: template.description || '',
        extra: { ...(template.extra_affixes || {}) },
      };
      const result = window.InventorySystem?.addEquipmentInstance?.(current, instance);
      if (result?.success) added++;
    }
    return added;
  }

  async function runAction(action, dataValue) {
    const current = requirePlayer();
    if (!current) return;
    if (action === 'gold' || action === 'gold-custom') {
      const amount = positiveSafeInteger(action === 'gold' ? dataValue : value('gm-gold'));
      const gold = Number(current.resources?.gold);
      if (!amount || !Number.isSafeInteger(gold) || gold < 0 || amount > Number.MAX_SAFE_INTEGER - gold) {
        return toast('金币数量无效或已达上限', 'error');
      }
      current.resources.gold = gold + amount;
      return finish(`金币 +${amount}`, { recompute: false });
    }
    if (action === 'exp' || action === 'exp-custom') {
      const amount = positiveSafeInteger(action === 'exp' ? dataValue : value('gm-exp'));
      const levelsGained = addExp(current, amount);
      if (!amount || levelsGained < 0) return toast('经验数量无效或已达上限', 'error');
      return finish(`经验 +${amount}`, { refill: levelsGained > 0 });
    }
    if (action === 'qigong' || action === 'qigong-custom') {
      const amount = positiveSafeInteger(action === 'qigong' ? dataValue : value('gm-qigong'));
      current.qigong = current.qigong || { available_points: 0, invested: {} };
      const available = Number(current.qigong.available_points);
      if (!amount || !Number.isSafeInteger(available) || available < 0 || amount > Number.MAX_SAFE_INTEGER - available) {
        return toast('气功点数量无效或已达上限', 'error');
      }
      current.qigong.available_points = available + amount;
      return finish(`气功点 +${amount}`);
    }
    if (action === 'heal') {
      current.hp = current.maxHp; current.mp = current.maxMp;
      return finish('HP/MP 已回满', { recompute: false });
    }
    if (action === 'level') {
      const requestedLevel = Math.floor(value('gm-level', current.level));
      if (!Number.isSafeInteger(requestedLevel) || requestedLevel < 1) return toast('等级无效', 'error');
      if (!setLevel(current, requestedLevel)) return toast('职业数据无效，无法设置等级', 'error');
      return finish(`等级已设置为 Lv.${current.level}`, { refill: true });
    }
    if (action === 'give-equipment') {
      const key = selected('gm-equipment');
      const count = positiveSafeInteger(value('gm-equip-count', 1), 99);
      if (!count) return toast('装备数量无效', 'error');
      const added = giveEquipment(current, key, count);
      return finish(`已给予 ${itemMeta(key).name} ×${added}`);
    }
    if (action === 'set') {
      const transfer = Number(dataValue);
      const family = current.career_family;
      const picks = (config().equipments || []).filter(item =>
        (item.required_transfer || 0) === transfer &&
        (!item.required_career?.length || item.required_career.includes(family))
      );
      let added = 0;
      for (const slot of new Set(picks.map(item => item.slot))) {
        const item = picks.find(entry => entry.slot === slot);
        if (item) added += giveEquipment(current, item.key, 1);
      }
      return finish(`已发放 ${transfer ? 'T1' : 'Base'} 套装，共 ${added} 件`);
    }
    if (action === 'enhance' || action === 'enhance-custom') {
      const target = Math.floor(action === 'enhance' ? Number(dataValue) : value('gm-enhance', 0));
      if (!Number.isSafeInteger(target) || target < 0 || target > 10) return toast('强化等级必须是 0～10 的整数', 'error');
      const instanceId = current.equipped?.weapon?.instance_id;
      const instance = current.inventory?.equipment_instances?.[instanceId];
      if (!instance) return toast('请先装备武器', 'error');
      instance.enhance_level = Math.max(0, Math.min(10, target));
      return finish(`当前武器已强化到 +${instance.enhance_level}`);
    }
    if (action === 'give-stone' || action === 'quick-item' || action === 'quick-box') {
      const key = action === 'give-stone' ? generatedStoneKey() : dataValue;
      const count = action === 'give-stone' ? positiveSafeInteger(value('gm-stone-count', 1), 99) : action === 'quick-box' ? 10 : 99;
      if (!count) return toast('物品数量无效', 'error');
      const result = giveItem(key, count);
      return finish(`${itemMeta(key).name} +${result?.added || 0}`, { recompute: false });
    }
    if (action === 'faction') {
      if (!['positive', 'negative', 'neutral'].includes(dataValue)) return toast('派系无效', 'error');
      current.faction = dataValue;
      return finish(`派系已切换为 ${dataValue}`);
    }
    if (action === 'career') {
      const key = selected('gm-career');
      const career = (config().careers || []).find(item => item.key === key);
      if (!career) return toast('职业不存在', 'error');
      current.career = key;
      current.career_family = career.career_family;
      current.faction = career.faction || current.faction;
      current.career_history = [...new Set([...(current.career_history || []), key])];
      if (window.Game?.rebuildCareerFields?.(current) !== true) return toast('职业属性重建失败', 'error');
      return finish(`职业已切换为 ${career.name || key}`);
    }
    if (action === 'qigong-full') {
      current.qigong = current.qigong || { available_points: 0, invested: {} };
      const list = window._qigongSys?.listAllCareerQigongs?.(current) || [];
      current.qigong.invested = Object.fromEntries(list.map(q => [q.key, q.max_level]));
      current.qigong.available_points = 0;
      return finish('当前职业气功已满投点');
    }
    if (action === 'qigong-reset') {
      const refunded = Object.values(current.qigong?.invested || {}).reduce((sum, points) => sum + points, 0);
      current.qigong = current.qigong || {};
      current.qigong.invested = {};
      current.qigong.available_points = (current.qigong.available_points || 0) + refunded;
      return finish(`气功已重置，返还 ${refunded} 点`);
    }
    if (action === 'refresh') return finish('已刷新 UI', { save: false });
    if (action === 'save') return finish('已存档', { recompute: false });
  }

  async function runDanger(action) {
    const current = requirePlayer();
    if (!current && action !== 'nuke') return;
    if (action === 'clear-bag') {
      current.inventory.slots = []; current.inventory.equipment_instances = {};
      current.equipped = { weapon:null, chest:null, gloves:[null,null], boots:null, inner_armor:null, ring:[null,null], amulet:null, earring:[null,null], cape:null };
      return finish('背包已清空');
    }
    if (action === 'clear-warehouse') {
      current.warehouse.slots = []; current.warehouse.equipment_instances = {};
      return finish('仓库已清空', { recompute: false });
    }
    if (action === 'export-save') {
      const text = await window.game?.exportSave?.({ include_all_characters: true });
      return toast(text ? '存档已生成' : '存档导出失败', text ? 'success' : 'error');
    }
    if (action === 'import-save') {
      const text = prompt('粘贴此前导出的存档 Base64');
      if (!text) return;
      try {
        if (!window.game?.importSave) return toast('存档接口尚未就绪', 'error');
        return await window.game.importSave(text);
      } catch { toast('导入内容不是有效存档', 'error'); }
    }
    if (action === 'nuke') {
      localStorage.clear();
      location.reload();
    }
  }

  function bindPanel(panel) {
    panel.addEventListener('input', event => {
      if (event.target.id === 'gm-equip-count') updateEquipmentResult();
      if (event.target.id === 'gm-stone-count' || event.target.id === 'gm-stone-value') updateStoneResult();
    });
    panel.addEventListener('click', event => {
      if (event.target.id === 'gm-confirm') {
        pendingDanger = null;
        panel.querySelector('#gm-confirm').classList.remove('open');
        return;
      }
      const tab = event.target.closest('.gm-tab');
      if (tab) {
        panel.querySelectorAll('.gm-tab').forEach(item => item.classList.toggle('active', item === tab));
        panel.querySelectorAll('.gm-pane').forEach(item => item.classList.toggle('active', item.dataset.pane === tab.dataset.tab));
        panel.querySelector('.gm-body').scrollTop = 0;
        return;
      }
      if (event.target.closest('[data-gm-close]')) return toggle(false);
      const trigger = event.target.closest('.dd-trigger');
      if (trigger) {
        const dropdownEl = trigger.closest('.gm-dropdown');
        panel.querySelectorAll('.gm-dropdown.open').forEach(entry => { if (entry !== dropdownEl) entry.classList.remove('open'); });
        dropdownEl.classList.toggle('open');
        return;
      }
      const dropdownItem = event.target.closest('.dd-item');
      if (dropdownItem) {
        const dropdownEl = dropdownItem.closest('.gm-dropdown');
        selectDropdownValue(dropdownEl, dropdownItem.dataset.value);
        dropdownEl.classList.remove('open');
        if (dropdownEl.id === 'gm-equip-slot' || dropdownEl.id === 'gm-equip-family') updateEquipmentList();
        else if (dropdownEl.id === 'gm-equipment') updateEquipmentResult();
        else if (dropdownEl.id === 'gm-stone') updateStoneAttributes();
        else if (dropdownEl.id === 'gm-stone-attr') updateStoneValueRange();
        return;
      }
      const action = event.target.closest('[data-action]');
      if (action) return runAction(action.dataset.action, action.dataset.value);
      const teleport = event.target.closest('[data-zone]');
      if (teleport) {
        const ok = window.teleport_system?.teleport?.(teleport.dataset.zone || null, 'gm');
        return finish(ok ? `已传送到 ${teleport.textContent}` : '传送失败', { recompute: false });
      }
      const danger = event.target.closest('[data-danger]');
      if (danger) {
        pendingDanger = danger.dataset.danger;
        const titles = { 'clear-bag':'清空背包', 'clear-warehouse':'清空仓库', 'export-save':'导出存档', 'import-save':'导入存档', nuke:'清空所有存档' };
        panel.querySelector('#gm-confirm-title').textContent = `⚠ ${titles[pendingDanger]}`;
        panel.querySelector('#gm-confirm-text').textContent = pendingDanger === 'export-save' ? '将当前存档复制到剪贴板。' : '此操作可能覆盖或永久删除数据，请确认。';
        panel.querySelector('#gm-confirm').classList.add('open');
        return;
      }
      if (event.target.closest('[data-gm-cancel]')) {
        pendingDanger = null;
        panel.querySelector('#gm-confirm').classList.remove('open');
      }
      if (event.target.closest('[data-gm-confirm]')) {
        const actionName = pendingDanger;
        pendingDanger = null;
        panel.querySelector('#gm-confirm').classList.remove('open');
        runDanger(actionName);
      }
    });
  }

  function toggle(force) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) { createPanel(); panel = document.getElementById(PANEL_ID); }
    visible = typeof force === 'boolean' ? force : !visible;
    panel.classList.toggle('visible', visible);
    if (visible) syncPanel();
  }

  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      toggle();
    }
  });
  window._toggleGMPanel = toggle;
  document.documentElement.dataset.gmPanelReady = 'true';
}());
