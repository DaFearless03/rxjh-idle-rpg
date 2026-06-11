/**
 * @file ui/AutoPlayPanelUI.js
 * @desc 挂机面板（阈值滑块 / 药剂选择 / 自动补给规则）
 * @ref 10_consumables.auto_consume / auto_resupply
 */
import { UIManager } from './UIManager.js?v=release-20260611-7';

function getCurrentSubZoneKey() {
  const battleSubZone = window.game?.battle?._currentSubZone;
  if (typeof battleSubZone === 'string') return battleSubZone;
  if (battleSubZone?.key) return battleSubZone.key;
  return window.game?.player?.location?.current_sub_zone_key
    || window.game?.currentSubZoneKey
    || null;
}

export function showAutoPlayPanel(player) {
  const ap = player.auto_play || {};
  const hpCfg = ap.auto_consume?.hp_potion || {};
  const mpCfg = ap.auto_consume?.mp_potion || {};
  const healCfg = ap.auto_heal_skill || {};
  const resupply = ap.auto_resupply || {};

  const potionOptions = [
    { key: 'hp_potion_grade1', name: '金创药（小）' },
    { key: 'hp_potion_grade2', name: '金创药（中）' },
    { key: 'hp_potion_grade3', name: '金创药（大）' },
  ];
  const mpPotionOptions = [
    { key: 'mp_potion_grade1', name: '人参' },
    { key: 'mp_potion_grade2', name: '野山参' },
    { key: 'mp_potion_grade3', name: '雪原参' },
  ];

  const html = `
    <div class="autoplay-panel">
      <h4 style="color:#e07020;margin-bottom:12px">⚙️ 挂机设置</h4>

      <!-- 自动喝药 -->
      <div class="mb-4">
        <div class="flex" style="justify-content:space-between;margin-bottom:6px">
          <span>自动喝 HP 药</span>
          <div class="toggle-btn${hpCfg.enabled ? ' on' : ''}" id="toggle-hp"
               onclick="window._toggleHP()"></div>
        </div>
        ${hpCfg.enabled ? `
        <div class="autoplay-row">
          <label>药剂</label>
          <select class="select flex-1" id="hp-potion-select" onchange="window._setHPPotion(this.value)">
            <option value="">不喝HP药</option>
            ${potionOptions.map(o => `<option value="${o.key}"${hpCfg.selected_item_key===o.key?' selected':''}>${o.name}</option>`).join('')}
          </select>
        </div>
        <div class="autoplay-row mt-4">
          <label>阈值</label>
          <input type="range" min="5" max="95" step="5" value="${Math.round((hpCfg.threshold ?? 0.30)*100)}"
                 style="flex:1" oninput="window._setHPThreshold(this.value)" />
          <span style="min-width:36px;text-align:right">${Math.round((hpCfg.threshold ?? 0.30)*100)}%</span>
        </div>` : ''}
      </div>

      <div class="mb-4" style="border-top:1px solid #222;padding-top:10px">
        <div class="flex" style="justify-content:space-between;margin-bottom:6px">
          <span>自动喝 MP 药</span>
          <div class="toggle-btn${mpCfg.enabled ? ' on' : ''}" id="toggle-mp"
               onclick="window._toggleMP()"></div>
        </div>
        ${mpCfg.enabled ? `
        <div class="autoplay-row">
          <label>药剂</label>
          <select class="select flex-1" id="mp-potion-select" onchange="window._setMPPotion(this.value)">
            <option value="">不喝MP药</option>
            ${mpPotionOptions.map(o => `<option value="${o.key}"${mpCfg.selected_item_key===o.key?' selected':''}>${o.name}</option>`).join('')}
          </select>
        </div>
        <div class="autoplay-row mt-4">
          <label>阈值</label>
          <input type="range" min="5" max="95" step="5" value="${Math.round((mpCfg.threshold ?? 0.30)*100)}"
                 style="flex:1" oninput="window._setMPThreshold(this.value)" />
          <span style="min-width:36px;text-align:right">${Math.round((mpCfg.threshold ?? 0.30)*100)}%</span>
        </div>` : ''}
      </div>

      <!-- 开始/停止挂机按钮 -->
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #222">
        ${player.auto_play?.is_auto_play ? `
          <button class="btn danger" style="width:100%" onclick="window._stopAutoplay()">⏹ 停止挂机</button>
        ` : `
          <button class="btn primary" style="width:100%" onclick="window._startAutoplay()">▶ 开始挂机</button>
        `}
      </div>
    </div>
  `;

  document.getElementById('autoplay-content').innerHTML = html;
  const modal = document.getElementById('modal-autoplay');
  if (modal) UIManager.pushModal(modal);
}

window._toggleHP = () => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.hp_potion = p.auto_play.auto_consume.hp_potion || {};
  const cur = p.auto_play.auto_consume.hp_potion.enabled;
  p.auto_play.auto_consume.hp_potion.enabled = !cur;
  showAutoPlayPanel(p);
};
window._toggleMP = () => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.mp_potion = p.auto_play.auto_consume.mp_potion || {};
  const cur = p.auto_play.auto_consume.mp_potion.enabled;
  p.auto_play.auto_consume.mp_potion.enabled = !cur;
  showAutoPlayPanel(p);
};
window._setHPPotion = (key) => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.hp_potion = p.auto_play.auto_consume.hp_potion || {};
  p.auto_play.auto_consume.hp_potion.selected_item_key = key || null;
};
window._setHPThreshold = (pct) => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.hp_potion = p.auto_play.auto_consume.hp_potion || {};
  p.auto_play.auto_consume.hp_potion.threshold = parseInt(pct, 10) / 100;
  showAutoPlayPanel(p);
};
window._setMPPotion = (key) => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.mp_potion = p.auto_play.auto_consume.mp_potion || {};
  p.auto_play.auto_consume.mp_potion.selected_item_key = key || null;
};
window._setMPThreshold = (pct) => {
  const p = window.game?.player;
  if (!p) return;
  p.auto_play = p.auto_play || {};
  p.auto_play.auto_consume = p.auto_play.auto_consume || {};
  p.auto_play.auto_consume.mp_potion = p.auto_play.auto_consume.mp_potion || {};
  p.auto_play.auto_consume.mp_potion.threshold = parseInt(pct, 10) / 100;
  showAutoPlayPanel(p);
};
window._startAutoplay = () => {
  const subZoneKey = getCurrentSubZoneKey();
  if (!subZoneKey) {
    UIManager.toast('请先选择一个野外区域', 'info');
    UIManager.popModal();
    window._startAutoplayAfterMap = true;
    window._openMapSheet?.();
    return;
  }
  window._startAutoplayAfterMap = false;
  window.game?.startAutoPlay();
  UIManager.popModal();
  UIManager.openPanel('combat');
  UIManager._refreshAll?.();
};
window._stopAutoplay = () => {
  window.game?.stopAutoPlay();
  UIManager.popModal();
};
