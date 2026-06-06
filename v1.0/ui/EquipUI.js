/**
 * @file ui/EquipUI.js
 * @desc 装备穿戴展示区：demo 风格人形槽位 + 战斗属性摘要。
 */

const SLOT_META = {
  weapon: { label: '武器', icon: '⚔', pos: 'slot-weapon' },
  chest: { label: '胸甲', icon: '👕', pos: 'slot-chest' },
  gloves: { label: '护手', icon: '🧤', pos: 'slot-gloves' },
  boots: { label: '鞋子', icon: '👟', pos: 'slot-boots' },
  inner_armor: { label: '内甲', icon: '🛡', pos: 'slot-inner' },
  cape: { label: '披风', icon: '🧣', pos: 'slot-cape' },
  amulet: { label: '项链', icon: '📿', pos: 'slot-amulet' },
  ring: { label: '戒指', icon: '💍', pos: 'slot-ring' },
  earring: { label: '耳环', icon: '💎', pos: 'slot-earring' },
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
  const instanceId = typeof slotVal === 'string' ? slotVal : slotVal?.instance_id;
  if (!instanceId) return null;
  return player.inventory?.equipment_instances?.[instanceId] || null;
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
  return `<div class="doll-panel demo-equip-panel">
    <div class="doll-figure" id="inventoryDollFigure">
      <div class="silhouette">
        <span class="sil-head"></span>
        <span class="sil-torso"></span>
        <span class="sil-arm left"></span>
        <span class="sil-arm right"></span>
        <span class="sil-leg left"></span>
        <span class="sil-leg right"></span>
      </div>
      ${renderSlot(player, 'weapon')}
      ${renderSlot(player, 'inner_armor')}
      ${renderSlot(player, 'cape')}
      ${renderSlot(player, 'earring', { index: 0, className: 'slot-earring-left' })}
      ${renderSlot(player, 'amulet')}
      ${renderSlot(player, 'earring', { index: 1, className: 'slot-earring-right' })}
      ${renderSlot(player, 'ring', { index: 0, className: 'slot-ring-left' })}
      ${renderSlot(player, 'chest')}
      ${renderSlot(player, 'ring', { index: 1, className: 'slot-ring-right' })}
      ${renderSlot(player, 'gloves', { index: 0, className: 'slot-gloves-left' })}
      ${renderSlot(player, 'gloves', { index: 1, className: 'slot-gloves-right' })}
      ${renderSlot(player, 'boots')}
    </div>
  </div>`;
}

export function renderStatPanel(player) {
  const rows = [
    ['生命值', player?.maxHp || 0],
    ['内功值', player?.maxMp || 0],
    ['最小攻击力', player?.atkMin || 0],
    ['最大攻击力', player?.atkMax || 0],
    ['防御力', player?.def || 0],
    ['武功攻击力', player?.matk || 0],
    ['武功防御力', player?.mdef || 0],
    ['命中', player?.hit || 0],
    ['闪避', player?.missing || 0],
  ];
  return `<div class="stat-panel demo-stat-panel">
    <div class="stat-sec">战斗属性</div>
    <div class="stat-list">
      ${rows.map(([label, value]) => `<div class="stat-row"><span class="sr-k">${label}</span><span class="sr-v">${value}</span></div>`).join('')}
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
  const stats = tpl.base_stats || {};
  const stones = inst.synthesis_slots || [];
  const capacities = { weapon: 4, chest: 4, gloves: 4, boots: 4, inner_armor: 2, cape: 4 };
  const capacity = capacities[tpl.slot] || 0;
  const statLabels = {
    atkMin: '最小攻击力',
    atkMax: '最大攻击力',
    def: '防御力',
    maxHp: '生命值',
    maxMp: '内力值',
    hit: '命中',
    missing: '闪避',
    matk: '武功攻击力',
    mdef: '武功防御力',
  };
  const baseRows = Object.entries(stats).map(([key, value]) =>
    `<div class="ed-stat-row"><span>${escapeHtml(statLabels[key] || key)}</span><b>${value}</b></div>`).join('');
  const enhance = Number(inst.enhance_level || 0);
  const enhanceValue = tpl.slot === 'weapon' ? enhance * 6 : enhance * 3;
  const totalRows = Object.entries(stats).map(([key, value]) => {
    const extra = tpl.slot === 'weapon' && (key === 'atkMin' || key === 'atkMax')
      ? enhanceValue
      : key === 'def' && tpl.slot !== 'weapon'
        ? enhanceValue
        : 0;
    return `<div class="ed-stat-row"><span>${escapeHtml(statLabels[key] || key)}</span><b>+${Number(value) + extra}</b></div>`;
  }).join('');
  return `<div class="ed-body">
    <div class="ed-sec">
      <div class="ed-sec-title">自身属性</div>
      ${baseRows || '<div class="ed-empty-note">无基础属性</div>'}
    </div>
    ${enhance > 0 ? `<div class="ed-sec">
      <div class="ed-sec-title">强化加成</div>
      <div class="ed-stat-row"><span>强化 +${enhance}</span><b>${tpl.slot === 'weapon' ? '攻击' : '防御'} +${enhanceValue}</b></div>
    </div>` : ''}
    ${capacity > 0 ? `<div class="ed-sec">
      <div class="ed-sec-title">合成孔 <span>${stones.filter(Boolean).length} / ${capacity}</span></div>
      <div class="ed-sockets">
        ${Array.from({ length: capacity }, (_, i) => stones[i]
          ? `<span class="ed-socket filled">${escapeHtml(stones[i])}</span>`
          : '<span class="ed-socket empty">＋</span>').join('')}
      </div>
    </div>` : ''}
    <div class="ed-sec ed-total">
      <div class="ed-sec-title">合计加成（计入战斗面板）</div>
      ${totalRows || '<div class="ed-empty-note">无属性加成</div>'}
    </div>
  </div>`;
}
