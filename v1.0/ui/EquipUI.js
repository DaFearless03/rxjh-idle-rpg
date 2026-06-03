/**
 * @file ui/EquipUI.js
 * @desc 装备穿戴展示区：demo 风格人形槽位 + 战斗属性摘要。
 */

const SLOT_META = {
  weapon: { label: '武器', icon: '⚔', pos: 'slot-weapon' },
  chest: { label: '衣服', icon: '👕', pos: 'slot-chest' },
  gloves: { label: '护手', icon: '🧤', pos: 'slot-gloves' },
  boots: { label: '鞋子', icon: '👟', pos: 'slot-boots' },
  inner_armor: { label: '内甲', icon: '🛡', pos: 'slot-inner' },
  cape: { label: '披风', icon: '🧣', pos: 'slot-cape' },
  amulet: { label: '项链', icon: '📿', pos: 'slot-amulet' },
  ring: { label: '戒指', icon: '💍', pos: 'slot-ring' },
  earring: { label: '耳环', icon: '📿', pos: 'slot-earring' },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTemplates(player) {
  return player?._equipTemplates || window._equipTemplates || [];
}

function getEquipmentInstance(player, slotKey, index = 0) {
  const equipped = player?.equipped?.[slotKey];
  const slotVal = Array.isArray(equipped) ? equipped[index] : equipped;
  if (!slotVal?.instance_id) return null;
  return player.inventory?.equipment_instances?.[slotVal.instance_id] || null;
}

export function getEquipmentTemplate(player, inst) {
  if (!inst) return null;
  return getTemplates(player).find(t => t.key === inst.item_key) || null;
}

function formatStats(stats = {}) {
  const labels = {
    atkMin: '攻下',
    atkMax: '攻上',
    def: '防御',
    maxHp: '生命',
    maxMp: '内力',
    hit: '命中',
    missing: '回避',
    matk: '武功攻',
    mdef: '武功防',
  };
  return Object.entries(stats)
    .map(([key, value]) => `${labels[key] || key}+${value}`)
    .join(' · ');
}

function renderSlot(player, slotKey, options = {}) {
  const { index = 0, className = '' } = options;
  const meta = SLOT_META[slotKey] || { label: slotKey, icon: '□', pos: '' };
  const inst = getEquipmentInstance(player, slotKey, index);
  const tpl = getEquipmentTemplate(player, inst);
  const enhance = inst?.enhance_level || 0;
  const filled = !!inst;

  if (!filled) {
    return `<div class="eq-slot empty ${meta.pos} ${className}" data-slot="${slotKey}" data-index="${index}">
      <div class="es-ph-ico">${meta.icon}</div>
      <div class="es-ph-name">${meta.label}</div>
    </div>`;
  }

  return `<div class="eq-slot filled ${meta.pos} ${className}" data-slot="${slotKey}" data-index="${index}" data-instance-id="${escapeHtml(inst.instance_id)}">
    <div class="es-ico">${meta.icon}</div>
    <div class="es-name">${escapeHtml(tpl?.name || inst.item_key)}</div>
    ${enhance > 0 ? `<div class="es-enh">+${enhance}</div>` : ''}
  </div>`;
}

export function renderEquipmentDoll(player) {
  return `<div class="equipment-panel demo-equip-panel">
    <div class="eq-panel-head">
      <span class="eq-title">装备</span>
      <span class="eq-subtitle">点击查看 · 后续接拖拽穿戴</span>
    </div>
    <div class="doll-figure">
      <div class="silhouette"></div>
      ${renderSlot(player, 'weapon')}
      ${renderSlot(player, 'inner_armor')}
      ${renderSlot(player, 'cape')}
      ${renderSlot(player, 'earring', { index: 0, className: 'slot-earring-left' })}
      ${renderSlot(player, 'amulet')}
      ${renderSlot(player, 'earring', { index: 1, className: 'slot-earring-right' })}
      ${renderSlot(player, 'ring', { index: 0, className: 'slot-ring-left' })}
      ${renderSlot(player, 'chest')}
      ${renderSlot(player, 'ring', { index: 1, className: 'slot-ring-right' })}
      ${renderSlot(player, 'gloves')}
      ${renderSlot(player, 'boots')}
    </div>
  </div>`;
}

export function renderStatPanel(player) {
  const rows = [
    ['生命', player?.maxHp || 0],
    ['内力', player?.maxMp || 0],
    ['攻击', `${player?.atkMin || 0}-${player?.atkMax || 0}`],
    ['防御', player?.def || 0],
    ['命中', player?.hit || 0],
    ['回避', player?.missing || 0],
    ['武攻', player?.matk || 0],
    ['武防', player?.mdef || 0],
  ];
  return `<div class="stat-panel demo-stat-panel">
    <div class="stat-panel-title">战斗属性</div>
    <div class="stat-list">
      ${rows.map(([label, value]) => `<div class="stat-line"><span>${label}</span><b>${value}</b></div>`).join('')}
    </div>
  </div>`;
}

export function renderEquipmentSummary(player) {
  return `<div class="inventory-equip-top">
    ${renderEquipmentDoll(player)}
    ${renderStatPanel(player)}
  </div>`;
}

export function renderEquipmentDetail(player, instanceId) {
  const inst = player?.inventory?.equipment_instances?.[instanceId];
  const tpl = getEquipmentTemplate(player, inst);
  if (!inst || !tpl) return '<div class="ed-body">装备不存在</div>';
  const stats = formatStats(tpl.base_stats);
  const stones = inst.synthesis_slots || [];
  return `<div class="ed-body">
    <div class="ed-sec">
      <div class="ed-sec-title">${escapeHtml(tpl.name || inst.item_key)}</div>
      <div class="ed-stat-row"><span>部位</span><b>${escapeHtml(SLOT_META[tpl.slot]?.label || tpl.slot)}</b></div>
      <div class="ed-stat-row"><span>强化</span><b>+${inst.enhance_level || 0}</b></div>
      <div class="ed-stat-row"><span>基础</span><b>${escapeHtml(stats || '无')}</b></div>
    </div>
    <div class="ed-sec">
      <div class="ed-sec-title">合成孔</div>
      <div class="ed-sockets">
        ${[0, 1, 2, 3].map(i => stones[i]
          ? `<span class="ed-socket filled">${escapeHtml(stones[i])}</span>`
          : '<span class="ed-socket empty">空</span>').join('')}
      </div>
    </div>
  </div>`;
}
