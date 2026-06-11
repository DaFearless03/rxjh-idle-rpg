/**
 * @file ui/MultiSaveUI.js
 * @desc 多存档列表 UI
 * @ref 13_save.multi_save
 */
import { storage } from '../utils/storage.js';
import { getDeletionConfirmInfo } from '../flows/character_deletion_flow.js?v=release-20260611-4';
import { runCharacterCreationFlow, getBaseCareers } from '../flows/character_creation_flow.js?v=release-20260611-4';
import { UIManager } from './UIManager.js?v=release-20260611-4';

const CAREER_EMOJI = {
  warrior_blade: '⚔️',
  warrior_sword: '🗡️',
  warrior_spear: '🔱',
  healer: '💊',
};

const CAREER_INFO = {
  warrior_blade: { name: '刀客', emoji: '⚔️', desc: '高血高防，适合稳扎稳打。' },
  warrior_sword: { name: '剑客', emoji: '🗡️', desc: '均衡输出，命中与爆发兼顾。' },
  warrior_spear: { name: '枪客', emoji: '🔱', desc: '长兵远距，攻击上限更亮眼。' },
  healer: { name: '医师', emoji: '💊', desc: '治疗辅助，续航能力优秀。' },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCareerMeta(careerKey, careersData) {
  const fromData = careersData?.find(c => c.key === careerKey);
  const local = CAREER_INFO[careerKey] || {};
  return {
    name: fromData?.name || local.name || careerKey,
    emoji: local.emoji || CAREER_EMOJI[careerKey] || '⚔️',
    desc: local.desc || '',
  };
}

export function showMultiSaveUI(globalSave, characters, careersData) {
  const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
  const lastUsed = globalSave?.character_slots?.last_used_slot;
  const maxPreviewSlots = Math.min(10, Math.max(unlocked + 1, 5));
  const allSlots = [];
  const used = characters.length;

  for (let i = 1; i <= unlocked; i++) {
    const char = characters.find(c => c.slotIndex === i);
    if (char) {
      const career = char.player?.career || 'warrior_blade';
      const meta = getCareerMeta(career, careersData);
      const inTown = !char.location?.current_sub_zone_key;
      const subZoneKey = char.location?.current_sub_zone_key || char.player?.location?.current_sub_zone_key;
      const subZoneName = window._subZonesData?.find(zone => zone.key === subZoneKey)?.name;
      const zone = inTown ? '泫渤派城镇' : (subZoneName || subZoneKey || '未知');
      allSlots.push({
        type: 'character',
        slotIndex: i,
        name: char.player?.name || '未知',
        career: meta.name,
        level: char.player?.level || 1,
        zone,
        emoji: meta.emoji,
        isLastUsed: lastUsed === i,
      });
    } else {
      allSlots.push({ type: 'empty', slotIndex: i });
    }
  }
  for (let i = unlocked + 1; i <= maxPreviewSlots; i++) {
    allSlots.push({ type: 'locked', slotIndex: i, cost: 100 });
  }

  const html = `
    <div class="save-list-shell">
      <div class="slot-usage">
        <span>已用 <b>${used}</b> / 已解锁 <b>${unlocked}</b></span>
        <span class="usage-pill">上限 10</span>
      </div>
      <div class="save-list">
      ${allSlots.map(slot => {
        if (slot.type === 'character') {
          return `
          <div class="save-card${slot.isLastUsed ? ' last-used' : ''}"
               onclick="window._ui_switchCharacter(${slot.slotIndex})">
            <div class="save-career-icon">${slot.emoji}</div>
            <div class="save-info">
              <div class="save-name">${escapeHtml(slot.name)}</div>
              <div class="save-meta">Lv${slot.level} · ${escapeHtml(slot.career)}</div>
              <div class="save-zone">📍 ${escapeHtml(slot.zone)}</div>
              ${slot.isLastUsed ? '<span class="last-tag">上次游玩</span>' : ''}
            </div>
            <span class="save-slot-num">${slot.slotIndex}号位</span>
            <button class="del-btn" onclick="event.stopPropagation();window._ui_deleteCharacter(${slot.slotIndex})"
              title="删除角色">删除</button>
          </div>`;
        }
        if (slot.type === 'empty') {
          return `
          <div class="slot-empty" onclick="window._ui_createCharacter(${slot.slotIndex})">
            <div class="slot-plus">＋</div>
            <div>
              <div class="slot-title">新建角色</div>
              <div class="slot-sub">第 ${slot.slotIndex} 号位</div>
            </div>
          </div>`;
        }
        return `
          <div class="slot-locked" onclick="window._ui_lockedSlot(${slot.slotIndex})">
            <div class="slot-lock">🔒</div>
            <div>
              <div class="slot-title">未解锁槽位</div>
              <div class="slot-sub">第 ${slot.slotIndex} 号位 · 需在角色内解锁</div>
            </div>
            <span class="sl-cost">💰 ${slot.cost}</span>
          </div>`;
      }).join('')}
      </div>
      <div class="save-list-foot">选择角色进入游戏。删除角色需要二次确认，当前角色被删除时会自动切换到下一名角色。</div>
    </div>
  `;

  const el = document.getElementById('multi-save-content');
  if (el) el.innerHTML = html;

  const modal = document.getElementById('modal-multi-save');
  if (modal) UIManager.pushModal(modal);

  // 绑定全局操作
  window._ui_switchCharacter = (slotIndex) => {
    UIManager.popModal();
    setTimeout(() => window.game?.switchCharacter(slotIndex), 100);
  };

  window._ui_deleteCharacter = (slotIndex) => {
    const raw = storage.get(`player-${slotIndex}`);
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    const info = getDeletionConfirmInfo(slotIndex, parsed.data || parsed, careersData);
    document.getElementById('delete-confirm-msg').textContent = info.confirmBody;
    const modal = document.getElementById('modal-delete-confirm');
    document.getElementById('confirm-delete-btn').onclick = async () => {
      UIManager.closeAllModals();
      await window.game?.confirmDeleteCharacter(slotIndex, { refreshList: true });
    };
    UIManager.pushModal(modal);
  };

  window._ui_createCharacter = (slotIndex) => {
    UIManager.popModal();
    setTimeout(() => showCharacterCreationUI(window._currentGlobalSave, slotIndex), 100);
  };

  window._ui_lockedSlot = async (slotIndex) => {
    const result = await window.game?.unlockSlot(slotIndex);
    UIManager.toast(result?.message || '无法解锁该槽位', result?.success ? 'success' : 'info');
    if (result?.success) {
      showMultiSaveUI(window._currentGlobalSave, characters, careersData);
    }
  };
}

export function showCharacterCreationUI(globalSave, targetSlotIndex) {
  const careers = getBaseCareers();

  const html = `
    <div class="create-role-shell">
      <div class="step-pill-row">
        <span class="step-pill active" id="create-pill-career">1 选职业</span>
        <span class="step-pill" id="create-pill-name">2 起名字</span>
      </div>
      <div class="create-slot-hint">目标槽位：${targetSlotIndex ? `第 ${targetSlotIndex} 号位` : '第一个空槽'}</div>
    <div id="create-step-1">
      <div class="career-cards">
        ${careers.map(k => {
          const meta = getCareerMeta(k, window._careersData || []);
          return `
          <div class="career-card" id="career-${k}" onclick="window._selectCareer('${k}')">
            <span class="cc-check">✓</span>
            <div class="emoji">${meta.emoji}</div>
            <div class="cname">${escapeHtml(meta.name)}</div>
            <div class="cdesc">${escapeHtml(meta.desc)}</div>
          </div>
        `; }).join('')}
      </div>
      <button class="btn primary create-next" id="create-next-btn" disabled onclick="window._goCreateName()">下一步 · 起名</button>
    </div>
    <div id="create-step-2" class="create-name-backdrop">
      <div class="create-name-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header"><span class="sheet-title">为角色起名</span><button class="sheet-close" onclick="window._backToStep1()">×</button></div>
        <div class="name-sheet-card">
          <div class="name-preview" id="create-career-preview">请选择职业</div>
          <input class="input mb-4" id="create-name-input" placeholder="输入角色名" maxlength="10" />
          <div class="name-counter"><span id="create-name-count">0</span> / 10</div>
          <div id="create-name-error" class="name-hint">支持中文 / 英文 / 数字 / 下划线</div>
        </div>
        <div class="flex gap-4 create-actions">
          <button class="btn" onclick="window._backToStep1()">取消</button>
          <button class="btn primary flex-1" id="confirm-create-btn" onclick="window._doCreate()">确认创建</button>
        </div>
      </div>
    </div>
    </div>
  `;

  const el = document.getElementById('create-content');
  if (el) el.innerHTML = html;
  const modal = document.getElementById('modal-create');
  if (modal) UIManager.pushModal(modal);

  window._selectedCareer = null;
  window._targetSlotIndex = targetSlotIndex;

  window._selectCareer = (careerKey) => {
    document.querySelectorAll('.career-card').forEach(c => c.classList.remove('selected'));
    const el = document.getElementById(`career-${careerKey}`);
    if (el) el.classList.add('selected');
    window._selectedCareer = careerKey;
    const nextBtn = document.getElementById('create-next-btn');
    if (nextBtn) nextBtn.disabled = false;
  };

  window._goCreateName = () => {
    if (!window._selectedCareer) return;
    const meta = getCareerMeta(window._selectedCareer, window._careersData || []);
    document.getElementById('create-pill-career')?.classList.remove('active');
    document.getElementById('create-pill-name')?.classList.add('active');
    document.getElementById('create-step-2').classList.add('open');
    const preview = document.getElementById('create-career-preview');
    if (preview) preview.textContent = `${meta.emoji} ${meta.name}`;
    const input = document.getElementById('create-name-input');
    if (input) {
      input.value = '';
      input.focus();
      input.addEventListener('input', updateNameHint);
      updateNameHint();
    }
  };

  window._backToStep1 = () => {
    document.getElementById('create-pill-career')?.classList.add('active');
    document.getElementById('create-pill-name')?.classList.remove('active');
    document.getElementById('create-step-2').classList.remove('open');
  };

  function updateNameHint() {
    const input = document.getElementById('create-name-input');
    const errEl = document.getElementById('create-name-error');
    const countEl = document.getElementById('create-name-count');
    const name = (input?.value || '').trim();
    const len = Array.from(name).length;
    if (countEl) countEl.textContent = len;
    if (!errEl) return;
    errEl.classList.remove('ok', 'err');
    if (!name) {
      errEl.textContent = '支持中文 / 英文 / 数字 / 下划线';
    } else if (len > 10) {
      errEl.textContent = '角色名不超过 10 个字符';
      errEl.classList.add('err');
    } else if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) {
      errEl.textContent = '仅支持中文 / 英文 / 数字 / 下划线';
      errEl.classList.add('err');
    } else {
      errEl.textContent = '名字可用';
      errEl.classList.add('ok');
    }
  }

  window._doCreate = async () => {
    const name = (document.getElementById('create-name-input')?.value || '').trim();
    const errEl = document.getElementById('create-name-error');
    if (!name) { errEl.textContent = '角色名不能为空'; return; }
    if (Array.from(name).length > 10) { errEl.textContent = '角色名不超过10字符'; return; }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) { errEl.textContent = '仅支持中文/英文/数字/下划线'; return; }
    if (!window._selectedCareer) { errEl.textContent = '请先选择职业'; return; }
    const flow = runCharacterCreationFlow({
      careersData: window._careersData || [],
      globalSave: window._currentGlobalSave || {},
    });
    const r3 = flow.step3_initializeSave(window._selectedCareer, name, window._targetSlotIndex);
    if (!r3.success) { errEl.textContent = r3.message; return; }

    // 新角色初始武器（各职业系攻击力最低的武器）
    const _startWeapons = { blade: "blade_base_001", sword: "sword_base_001", spear: "spear_base_001", staff: "staff_base_001" };
    const _cd = (window._careersData || []).find(c => c.key === window._selectedCareer);
    const _family = _cd?.career_family || "blade";
    const _weaponKey = _startWeapons[_family];
    if (_weaponKey) {
      const _tpl = (window._equipTemplates || []).find(e => e.key === _weaponKey);
      if (_tpl) {
        r3.save.inventory = r3.save.inventory || { capacity: 50, slots: [], equipment_instances: {} };
        const _instId = 'init_' + _tpl.key;
        r3.save.inventory.equipment_instances[_instId] = {
          instance_id: _instId,
          item_key: _tpl.key,
          enhance_level: 0,
          synthesis_slots: []
        };
        r3.save.inventory.slots = Array.isArray(r3.save.inventory.slots) ? r3.save.inventory.slots : [];
        r3.save.inventory.slots.push({ item_key: _tpl.key, count: 1, instance_id: _instId });

      }
    }    await flow.step4_persist(r3.save, r3.slotIndex, window._currentGlobalSave);
    UIManager.popModal();
    UIManager.toast(`角色「${name}」创建成功！`, 'success');
    setTimeout(() => window.game?.switchCharacter(r3.slotIndex), 300);
  };
}

export function showOfflineRewardUI(summary) {
  if (!summary) return;
  hideOfflineRewardLoading();
  const elapsedSeconds = Math.min(Number(summary.elapsed_s) || 0, 86400);
  const elapsedHours = Math.floor(elapsedSeconds / 3600);
  const elapsedMinutes = Math.floor((elapsedSeconds % 3600) / 60);
  const truncated = (Number(summary.elapsed_s) || 0) >= 86400;
  const row = (icon, label, value, kind = '') => `
    <div class="reward-row">
      <span class="rr-label"><span class="rr-ico">${icon}</span>${label}</span>
      <b class="rr-val ${kind}">${value}</b>
    </div>`;

  let html = `
    <div class="offline-reward-shell">
    <div class="rh-time${truncated ? ' truncated' : ''}">
      离线时长 <b>${elapsedHours} 小时 ${elapsedMinutes} 分</b>${truncated ? '（已截断至 24 小时）' : ''}
    </div>
  `;

  if (summary.stopped_reason) {
    const reasons = {
      death: `离线第 ${summary.died_at_s?.toFixed(0) || 0} 秒死亡`,
      inventory_full_quest_item: '背包满，任务物品无法保存',
      player_stopped: '手动停止',
      auto_resupply_gold_insufficient: '金币不足停止',
    };
    html += `<div class="alert-box">
      <div class="ab-title">⚠️ ${reasons[summary.stopped_reason] || summary.stopped_reason}</div>
    </div>`;
    if (summary.quest_item_lost) {
      const lost = summary.quest_item_lost;
      html += `<div class="alert-box detail">
        <div class="ab-text">任务物品「<b>${escapeHtml(lost.item_name || lost.item_key || '未知物品')}</b>」无法保存，
        当前进度 <b>${escapeHtml(lost.current_count || 0)}/${escapeHtml(lost.required_count || '?')}</b>。</div>
      </div>`;
    }
  }

  html += row('⚔', '击杀', `${summary.kills || 0} 只`);
  html += row('✨', '经验', `+${summary.exp_gained || 0}`, 'exp');

  if (summary.level_ups?.length > 0) {
    const first = summary.level_ups[0];
    const last = summary.level_ups[summary.level_ups.length - 1];
    const totalPoints = summary.level_ups.reduce((s, l) => s + (l.gained_points || 1), 0);
    html += row('⬆', '升级', `${summary.level_ups.length} 次<span class="rr-detail">Lv${first.from_level} → Lv${last.to_level}（+${totalPoints} 气功点）</span>`, 'up');
  }
  html += row('🪙', '金币', `+${summary.gold_gained || 0}`, 'gold');

  if (summary.potions_consumed && Object.keys(summary.potions_consumed).length > 0) {
    const potions = Object.entries(summary.potions_consumed).map(([k, v]) => `${k}×${v}`).join('、');
    html += row('🍶', '消耗药剂', escapeHtml(potions));
  }
  if (summary.gold_spent_on_potions > 0) {
    html += row('💸', '买药花费', `-${summary.gold_spent_on_potions}`, 'minus');
  }
  if (summary.items_obtained?.length > 0) {
    html += row('🎁', '获得物品', `${summary.items_obtained.length} 件`);
  }
  if (summary.boxes_obtained > 0) {
    html += row('📦', '获得盒子', `${summary.boxes_obtained} 个`);
  }
  if (summary.resupply_trips > 0) {
    html += row('🚶', '自动补给', `${summary.resupply_trips} 次`);
  }
  if (summary.items_discarded > 0) {
    html += row('🗑', '丢弃', `${summary.items_discarded} 件<span class="rr-detail">背包已满</span>`, 'discard');
  }
  if (summary.deaths > 0) {
    html += row('💀', '死亡次数', `${summary.deaths} 次`, 'minus');
    if (summary.died_at_s != null) {
      html += row('⏱', '死亡时间', `离线第 ${summary.died_at_s.toFixed(0)} 秒`, 'minus');
    }
  }
  html += '</div>';

  const el = document.getElementById('offline-summary');
  if (el) el.innerHTML = html;
  const modal = document.getElementById('modal-offline');
  if (modal) UIManager.pushModal(modal);
}

export function showOfflineRewardLoading(progress = 0) {
  const overlay = document.getElementById('offline-loading-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  updateOfflineRewardProgress(progress);
}

export function updateOfflineRewardProgress(progress = 0) {
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  const fill = document.getElementById('offline-progress-fill');
  const text = document.getElementById('offline-progress-text');
  if (fill) fill.style.width = `${value}%`;
  if (text) text.textContent = `${value}%`;
}

export function hideOfflineRewardLoading() {
  document.getElementById('offline-loading-overlay')?.classList.remove('open');
}
