/**
 * @file ui/MultiSaveUI.js
 * @desc 多存档列表 UI
 * @ref 13_save.multi_save
 */
import { storage } from '../utils/storage.js';
import { getDeletionConfirmInfo } from '../flows/character_deletion_flow.js';
import { runCharacterCreationFlow, getBaseCareers } from '../flows/character_creation_flow.js';
import { UIManager } from './UIManager.js';

const CAREER_EMOJI = {
  warrior_blade: '⚔️',
  warrior_sword: '🗡️',
  warrior_spear: '🔱',
  healer: '💊',
};

export function showMultiSaveUI(globalSave, characters, careersData) {
  const unlocked = globalSave?.character_slots?.unlocked_count ?? 3;
  const lastUsed = globalSave?.character_slots?.last_used_slot;
  const allSlots = [];

  for (let i = 1; i <= unlocked; i++) {
    const char = characters.find(c => c.slotIndex === i);
    if (char) {
      const career = char.player?.career || 'warrior_blade';
      const emoji = CAREER_EMOJI[career] || '⚔️';
      const careerName = careersData?.find(c => c.key === career)?.name || career;
      const inTown = !char.location?.current_sub_zone_key;
      const zone = inTown ? '🏠 城镇' : (char.location?.current_sub_zone_key || '未知');
      allSlots.push({
        type: 'character',
        slotIndex: i,
        name: char.player?.name || '未知',
        career: careerName,
        level: char.player?.level || 1,
        zone,
        emoji,
        isLastUsed: lastUsed === i,
      });
    } else {
      allSlots.push({ type: 'empty', slotIndex: i });
    }
  }

  const html = `
    <div class="save-list">
      ${allSlots.map(slot => {
        if (slot.type === 'character') {
          return `
          <div class="save-card${slot.isLastUsed ? ' active' : ''}"
               onclick="window._ui_switchCharacter(${slot.slotIndex})">
            <span class="save-slot-num">${slot.slotIndex}号位</span>
            <div class="info">
              <div class="name">${slot.emoji} ${slot.name}</div>
              <div class="meta">Lv${slot.level} ${slot.career} | ${slot.zone}</div>
            </div>
            <button class="del-btn" onclick="event.stopPropagation();window._ui_deleteCharacter(${slot.slotIndex})"
              title="删除角色">×</button>
          </div>`;
        } else {
          return `
          <div class="empty-slot" onclick="window._ui_createCharacter(${slot.slotIndex})">
            ✚ 新建角色（第${slot.slotIndex}号位）
          </div>`;
        }
      }).join('')}
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
    const info = getDeletionConfirmInfo(slotIndex, parsed.data || parsed);
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
}

export function showCharacterCreationUI(globalSave, targetSlotIndex) {
  const careers = getBaseCareers();
  const CAREER_INFO = {
    warrior_blade: { name: '刀客', emoji: '⚔️', desc: '高血高防' },
    warrior_sword: { name: '剑客', emoji: '🗡️', desc: '均衡输出' },
    warrior_spear: { name: '枪客', emoji: '🔱', desc: '长兵远距' },
    healer: { name: '医师', emoji: '💊', desc: '治疗辅助' },
  };

  const html = `
    <div id="create-step-1">
      <p class="text-dim mb-4" style="margin-bottom:10px">选择职业</p>
      <div class="career-cards">
        ${careers.map(k => `
          <div class="career-card" id="career-${k}" onclick="window._selectCareer('${k}')">
            <div class="emoji">${CAREER_INFO[k]?.emoji}</div>
            <div class="cname">${CAREER_INFO[k]?.name || k}</div>
            <div class="cdesc">${CAREER_INFO[k]?.desc || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div id="create-step-2" style="display:none;margin-top:12px">
      <p class="mb-4">输入角色名（1-10字符，中英数下划线）</p>
      <input class="input mb-4" id="create-name-input" placeholder="角色名" maxlength="10" />
      <div id="create-name-error" style="color:#e03030;font-size:11px;margin-bottom:6px"></div>
      <div class="flex gap-4">
        <button class="btn" onclick="window._backToStep1()">上一步</button>
        <button class="btn primary flex-1" id="confirm-create-btn" onclick="window._doCreate()">确认创建</button>
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
    document.getElementById('create-step-1').style.display = 'none';
    document.getElementById('create-step-2').style.display = '';
    const input = document.getElementById('create-name-input');
    if (input) { input.value = ''; input.focus(); }
  };

  window._backToStep1 = () => {
    document.getElementById('create-step-1').style.display = '';
    document.getElementById('create-step-2').style.display = 'none';
  };

  window._doCreate = async () => {
    const name = (document.getElementById('create-name-input')?.value || '').trim();
    const errEl = document.getElementById('create-name-error');
    if (!name) { errEl.textContent = '角色名不能为空'; return; }
    if (name.length > 10) { errEl.textContent = '角色名不超过10字符'; return; }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) { errEl.textContent = '仅支持中文/英文/数字/下划线'; return; }
    if (!window._selectedCareer) { errEl.textContent = '请先选择职业'; return; }
    const flow = runCharacterCreationFlow({
      careersData: window._careersData || [],
      globalSave: window._currentGlobalSave || {},
    });
    const r3 = flow.step3_initializeSave(window._selectedCareer, name, window._targetSlotIndex);
    if (!r3.success) { errEl.textContent = r3.message; return; }
    await flow.step4_persist(r3.save, r3.slotIndex, window._currentGlobalSave);
    UIManager.popModal();
    UIManager.toast(`角色「${name}」创建成功！`, 'success');
    setTimeout(() => window.game?.switchCharacter(r3.slotIndex), 300);
  };
}

export function showOfflineRewardUI(summary) {
  if (!summary) return;
  const elapsedH = (summary.elapsed_s / 3600).toFixed(1);
  const hours = parseFloat(elapsedH);
  const truncated = hours >= 24 ? '（已截断至24小时）' : '';

  let html = `
    <div class="summary-field"><span class="field-label">离线时长</span><span class="field-value">${elapsedH} 小时 ${truncated}</span></div>
  `;

  if (summary.stopped_reason) {
    const reasons = {
      death: `离线第 ${summary.died_at_s?.toFixed(0) || 0} 秒死亡`,
      inventory_full_quest_item: '背包满，任务物品无法保存',
      player_stopped: '手动停止',
      auto_resupply_gold_insufficient: '金币不足停止',
    };
    html += `<div class="summary-field" style="color:#e03030">
      <span class="field-label">停止原因</span>
      <span class="field-value">⚠️ ${reasons[summary.stopped_reason] || summary.stopped_reason}</span>
    </div>`;
  }

  html += `
    <div class="summary-field"><span class="field-label">击杀怪物</span><span class="field-value">${summary.kills} 只</span></div>
    <div class="summary-field"><span class="field-label">获得经验</span><span class="field-value" style="color:#d0a000">+${summary.exp_gained}</span></div>
    <div class="summary-field"><span class="field-label">获得金币</span><span class="field-value" style="color:#e07020">+${summary.gold_gained}</span></div>
  `;

  if (summary.level_ups?.length > 0) {
    const first = summary.level_ups[0];
    const last = summary.level_ups[summary.level_ups.length - 1];
    const totalPoints = summary.level_ups.reduce((s, l) => s + (l.gained_points || 1), 0);
    html += `<div class="levelups">升级 ${summary.level_ups.length} 次：Lv${first.from_level}→Lv${last.to_level}（+${totalPoints}气功点）</div>`;
  }

  if (summary.potions_consumed && Object.keys(summary.potions_consumed).length > 0) {
    const potions = Object.entries(summary.potions_consumed).map(([k, v]) => `${k}×${v}`).join('、');
    html += `<div class="summary-field"><span class="field-label">消耗药剂</span><span class="field-value">${potions}</span></div>`;
  }
  if (summary.gold_spent_on_potions > 0) {
    html += `<div class="summary-field"><span class="field-label">买药花费</span><span class="field-value">-${summary.gold_spent_on_potions} 金币</span></div>`;
  }
  if (summary.items_obtained?.length > 0) {
    html += `<div class="summary-field"><span class="field-label">获得物品</span><span class="field-value">${summary.items_obtained.slice(0, 5).join('、')}${summary.items_obtained.length > 5 ? '...' : ''}</span></div>`;
  }
  if (summary.boxes_obtained > 0) {
    html += `<div class="summary-field"><span class="field-label">获得盒子</span><span class="field-value">${summary.boxes_obtained} 个</span></div>`;
  }
  if (summary.resupply_trips > 0) {
    html += `<div class="summary-field"><span class="field-label">自动补给</span><span class="field-value">${summary.resupply_trips} 次</span></div>`;
  }
  if (summary.items_discarded > 0) {
    html += `<div class="summary-field" style="color:#e07020"><span class="field-label">丢弃物品</span><span class="field-value">${summary.items_discarded} 件（背包满）</span></div>`;
  }
  if (summary.deaths > 0) {
    html += `<div class="summary-field" style="color:#8b0000"><span class="field-label">死亡次数</span><span class="field-value">${summary.deaths} 次</span></div>`;
  }

  const el = document.getElementById('offline-summary');
  if (el) el.innerHTML = html;
  const modal = document.getElementById('modal-offline');
  if (modal) UIManager.pushModal(modal);
}
