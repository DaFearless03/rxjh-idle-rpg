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
  const value = (id, fallback = 0) => Number(document.getElementById(id)?.value) || fallback;
  const selected = id => document.getElementById(id)?.value || '';

  function toast(message, type = 'info') {
    window._uiManager?.toast?.(`(GM) ${message}`, type);
    console.log('[GM]', message);
  }

  function requirePlayer() {
    const current = player();
    if (!current) toast('请先进入一个角色', 'error');
    return current;
  }

  async function finish(message, { recompute = true, save = true } = {}) {
    const current = player();
    if (current && recompute) {
      window.AttributeSystem?.recompute?.(current);
      current.hp = Math.min(current.hp ?? current.maxHp, current.maxHp);
      current.mp = Math.min(current.mp ?? current.maxMp, current.maxMp);
    }
    window.EventBus?.emit?.('gm.refresh', { source: 'gm.js' });
    if (save) await window.SaveManager?.save?.();
    toast(message, 'success');
    syncPanel();
  }

  function itemMeta(key) {
    return window._itemMetaByKey?.[key] || { name: key };
  }

  function giveItem(key, count) {
    const current = requirePlayer();
    if (!current || !key) return null;
    return window.InventorySystem?.add?.(current, key, count);
  }

  function equipmentOptions() {
    return (config().equipments || []).map(item =>
      `<option value="${esc(item.key)}">${esc(item.name || item.key)} · ${esc(item.slot)} · Lv${item.required_level || 1}</option>`
    ).join('');
  }

  function careerOptions() {
    return (config().careers || []).map(item =>
      `<option value="${esc(item.key)}">${esc(item.name || item.key)} · ${esc(item.career_family || '')}</option>`
    ).join('');
  }

  function stoneOptions() {
    return Object.values(config().stones || {}).flatMap(group => Array.isArray(group) ? group : []).map(item =>
      `<option value="${esc(item.key)}">${esc(item.name || item.key)}</option>`
    ).join('');
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
    const town = `<div class="gm-map-group"><div class="gm-map-head">🏯 泫渤派城镇</div><div class="gm-map-list"><button class="gm-tp" data-zone="">城镇</button></div></div>`;
    return town + [...groups.entries()].map(([prefix, entries]) => {
      const [icon, label] = labels[prefix] || ['🗺', prefix];
      return `<div class="gm-map-group"><div class="gm-map-head">${icon} ${esc(label)}</div><div class="gm-map-list">${
        entries.map(zone => `<button class="gm-tp" data-zone="${esc(zone.key)}">${esc(zone.name || zone.key)}</button>`).join('')
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
        <nav class="gm-tabs">
          <button class="gm-tab active" data-tab="resource">💰 资源</button>
          <button class="gm-tab" data-tab="equip">⚔ 装备</button>
          <button class="gm-tab" data-tab="item">💎 道具</button>
          <button class="gm-tab" data-tab="status">🧬 状态</button>
          <button class="gm-tab" data-tab="teleport">🗺 传送</button>
          <button class="gm-tab danger-tab" data-tab="danger">⚠ 危险</button>
        </nav>
        <main class="gm-body">
          <div class="gm-pane active" data-pane="resource">
            ${card('💰', '金币', `<div class="gm-buttons"><button data-action="gold" data-value="1000">+1,000</button><button data-action="gold" data-value="10000">+10,000</button></div><div class="gm-input-row"><input id="gm-gold" type="number" placeholder="自定义数量"><button data-action="gold-custom">发放</button></div>`)}
            ${card('✨', '经验（自动连升级）', `<div class="gm-buttons"><button data-action="exp" data-value="1000">+1,000</button><button data-action="exp" data-value="10000">+10,000</button></div><div class="gm-input-row"><input id="gm-exp" type="number" placeholder="自定义数量"><button data-action="exp-custom">发放</button></div>`)}
            ${card('🔮', '气功点', `<div class="gm-buttons"><button data-action="qigong" data-value="5">+5 点</button></div><div class="gm-input-row"><input id="gm-qigong" type="number" placeholder="自定义点数"><button data-action="qigong-custom">发放</button></div>`)}
            ${card('❤️', '生命 / 内功', `<div class="gm-buttons"><button data-action="heal">满 HP/MP</button></div>`)}
            ${card('📊', '设置等级', `<div class="gm-input-row"><input id="gm-level" type="number" min="1" max="200"><button data-action="level">确认</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="equip">
            ${card('🎯', '给予装备', `<div class="gm-stack"><label>装备<select id="gm-equipment">${equipmentOptions()}</select></label><label>数量<input id="gm-equip-count" type="number" value="1" min="1" max="99"></label><button data-action="give-equipment">给予</button></div>`)}
            ${card('📦', '一键套装', `<div class="gm-buttons"><button data-action="set" data-value="0">全套 Base</button><button data-action="set" data-value="1">全套 T1</button></div>`)}
            ${card('🔨', '强化当前武器', `<div class="gm-buttons"><button data-action="enhance" data-value="10">当前武器 → +10</button></div><div class="gm-input-row"><input id="gm-enhance" type="number" value="5" min="0" max="10"><button data-action="enhance-custom">强化到 +N</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="item">
            ${card('💎', '石头生成器', `<div class="gm-stack"><label>石头<select id="gm-stone">${stoneOptions()}</select></label><label>数量<input id="gm-stone-count" type="number" value="10" min="1" max="99"></label><button data-action="give-stone">生成</button></div>`)}
            ${card('🌿', '药剂快捷（+99）', `<div class="gm-buttons">${['hp_potion_grade1','hp_potion_grade2','hp_potion_grade3','mp_potion_grade1','mp_potion_grade2','mp_potion_grade3'].map(key => `<button data-action="quick-item" data-value="${key}">${esc(itemMeta(key).name)}</button>`).join('')}</div>`)}
            ${card('📦', '盒子快捷（+10）', `<div class="gm-buttons">${(config().boxes || []).map(box => `<button data-action="quick-box" data-value="${esc(box.key)}">${esc(box.name || box.key)}</button>`).join('')}</div>`)}
          </div>
          <div class="gm-pane" data-pane="status">
            ${card('⚖', '派系', `<div class="gm-buttons"><button data-action="faction" data-value="positive">☀ 正派</button><button data-action="faction" data-value="negative">🌙 邪派</button><button data-action="faction" data-value="neutral">⚪ 中立</button></div>`)}
            ${card('🎭', '职业切换', `<div class="gm-stack"><select id="gm-career">${careerOptions()}</select><button data-action="career">应用职业</button></div>`)}
            ${card('🔮', '气功操作', `<div class="gm-buttons"><button data-action="qigong-full">一键满气功</button><button data-action="qigong-reset">气功重置</button></div>`)}
            ${card('💾', '维护', `<div class="gm-buttons"><button data-action="refresh">刷新 UI</button><button data-action="save">立即存档</button></div>`)}
          </div>
          <div class="gm-pane" data-pane="teleport">${zoneGroups()}</div>
          <div class="gm-pane" data-pane="danger">
            ${card('⚠', '危险操作（二次确认）', `<div class="gm-buttons"><button class="danger" data-danger="clear-bag">清空背包</button><button class="danger" data-danger="clear-warehouse">清空仓库</button><button class="danger" data-danger="export-save">导出存档</button><button class="danger" data-danger="import-save">导入存档</button><button class="danger" data-danger="nuke">清空 localStorage + 刷新</button></div>`, true)}
          </div>
        </main>
        <div class="gm-confirm" id="gm-confirm">
          <div class="gm-modal"><h2 id="gm-confirm-title">⚠ 确认操作</h2><p id="gm-confirm-text">此操作不可撤销</p><div><button data-gm-cancel>取消</button><button class="danger" data-gm-confirm>确认执行</button></div></div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    bindPanel(panel);
    syncPanel();
  }

  function syncPanel() {
    const current = player();
    const level = document.getElementById('gm-level');
    const career = document.getElementById('gm-career');
    if (level && current) level.value = current.level || 1;
    if (career && current) career.value = current.career || '';
  }

  function setLevel(current, nextLevel) {
    const career = (config().careers || []).find(c => c.key === current.career);
    const grow = career?.attrGrow || {};
    const diff = nextLevel - (current.level || 1);
    for (const stat of ['str', 'dex', 'sta', 'int']) current[stat] = (current[stat] || 0) + (grow[stat] || 0) * diff;
    current.level = nextLevel;
    current.exp = 0;
  }

  function addExp(current, amount) {
    current.exp = (current.exp || 0) + amount;
    const cap = window.currentLevelCap || 200;
    while (current.level < cap) {
      const needed = window.expToNext?.[current.level] || 0;
      if (!needed || current.exp < needed) break;
      current.exp -= needed;
      setLevel(current, current.level + 1);
    }
  }

  function giveEquipment(current, key, count = 1) {
    let added = 0;
    for (let i = 0; i < count; i++) {
      const instance = { instance_id: `gm_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`, item_key: key, enhance_level: 0, synthesis_slots: [] };
      const result = window.InventorySystem?.addEquipmentInstance?.(current, instance);
      if (result?.success) added++;
    }
    return added;
  }

  async function runAction(action, dataValue) {
    const current = requirePlayer();
    if (!current) return;
    if (action === 'gold' || action === 'gold-custom') {
      const amount = action === 'gold' ? Number(dataValue) : value('gm-gold');
      current.resources.gold = (current.resources.gold || 0) + amount;
      return finish(`金币 +${amount}`, { recompute: false });
    }
    if (action === 'exp' || action === 'exp-custom') {
      const amount = action === 'exp' ? Number(dataValue) : value('gm-exp');
      addExp(current, amount);
      return finish(`经验 +${amount}`);
    }
    if (action === 'qigong' || action === 'qigong-custom') {
      const amount = action === 'qigong' ? Number(dataValue) : value('gm-qigong');
      current.qigong = current.qigong || { available_points: 0, invested: {} };
      current.qigong.available_points = (current.qigong.available_points || 0) + amount;
      return finish(`气功点 +${amount}`);
    }
    if (action === 'heal') {
      current.hp = current.maxHp; current.mp = current.maxMp;
      return finish('HP/MP 已回满', { recompute: false });
    }
    if (action === 'level') {
      const level = Math.max(1, value('gm-level', current.level));
      setLevel(current, level);
      return finish(`等级已设置为 Lv.${level}`);
    }
    if (action === 'give-equipment') {
      const key = selected('gm-equipment');
      const added = giveEquipment(current, key, Math.max(1, value('gm-equip-count', 1)));
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
      const target = action === 'enhance' ? Number(dataValue) : value('gm-enhance', 0);
      const instanceId = current.equipped?.weapon?.instance_id;
      const instance = current.inventory?.equipment_instances?.[instanceId];
      if (!instance) return toast('请先装备武器', 'error');
      instance.enhance_level = Math.max(0, Math.min(10, target));
      return finish(`当前武器已强化到 +${instance.enhance_level}`);
    }
    if (action === 'give-stone' || action === 'quick-item' || action === 'quick-box') {
      const key = action === 'give-stone' ? selected('gm-stone') : dataValue;
      const count = action === 'give-stone' ? Math.max(1, value('gm-stone-count', 1)) : action === 'quick-box' ? 10 : 99;
      const result = giveItem(key, count);
      return finish(`${itemMeta(key).name} +${result?.added || 0}`, { recompute: false });
    }
    if (action === 'faction') {
      current.faction = dataValue;
      return finish(`派系已切换为 ${dataValue}`);
    }
    if (action === 'career') {
      const key = selected('gm-career');
      const career = (config().careers || []).find(item => item.key === key);
      if (!career) return toast('职业不存在', 'error');
      current.career = key;
      current.career_family = career.career_family;
      current.career_history = [...new Set([...(current.career_history || []), key])];
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
      const text = JSON.stringify({ player: current, localStorage: { ...localStorage } });
      await navigator.clipboard?.writeText?.(text);
      return toast('存档已复制到剪贴板', 'success');
    }
    if (action === 'import-save') {
      const text = prompt('粘贴此前导出的 GM 存档 JSON');
      if (!text) return;
      try {
        const parsed = JSON.parse(text);
        for (const [key, val] of Object.entries(parsed.localStorage || {})) localStorage.setItem(key, val);
        location.reload();
      } catch { toast('导入内容不是有效 JSON', 'error'); }
    }
    if (action === 'nuke') {
      localStorage.clear();
      location.reload();
    }
  }

  function bindPanel(panel) {
    panel.addEventListener('click', event => {
      const tab = event.target.closest('.gm-tab');
      if (tab) {
        panel.querySelectorAll('.gm-tab').forEach(item => item.classList.toggle('active', item === tab));
        panel.querySelectorAll('.gm-pane').forEach(item => item.classList.toggle('active', item.dataset.pane === tab.dataset.tab));
        panel.querySelector('.gm-body').scrollTop = 0;
        return;
      }
      if (event.target.closest('[data-gm-close]')) return toggle(false);
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
