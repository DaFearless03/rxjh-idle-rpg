/**
 * @file ui/MapListPanelUI.js
 * @desc 地图列表（demo 风格）
 */
import { UIManager } from './UIManager.js?v=release-20260612-2';

// 按 demo 的地图结构
const MAPS = [
  {
    name: '泫渤派郊外',
    zones: [
      { key: 'xuanbo_village', name: '村庄周围', level: 'Lv.3-5' },
      { key: 'xuanbo_field', name: '村庄野田', level: 'Lv.8-12' },
      { key: 'xuanbo_den', name: '狼熊聚居地', level: 'Lv.12-15' },
      { key: 'xuanbo_lumber', name: '伐木场', level: 'Lv.18-22' },
      { key: 'xuanbo_cemetery', name: '墓地', level: 'Lv.22-30' },
      { key: 'xuanbo_robber', name: '山寨', level: 'Lv.30-35' },
    ]
  },
  {
    name: '柳正关',
    zones: [
      { key: 'liuzheng_forest', name: '关外山林', level: 'Lv.35-37' },
      { key: 'liuzheng_fishing_village', name: '渔村', level: 'Lv.38-42' },
      { key: 'liuzheng_monster_camp', name: '怪兽营地', level: 'Lv.43-45' },
      { key: 'liuzheng_fire_thief_den', name: '火贼山寨', level: 'Lv.47-50' },
      { key: 'liuzheng_wanshou_pavilion', name: '万寿阁下层', level: 'Lv.51-54' },
      { key: 'liuzheng_wanshou_pavilion_upper', name: '万寿阁上层', level: 'Lv.54-57' },
      { key: 'liuzheng_deep_bamboo', name: '渊竹林', level: 'Lv.57-59' },
    ]
  }
];

export function buildMapList(container, currentSubZoneKey) {
  container.innerHTML = MAPS.map(group => `
    <div class="map-group">
      <div class="map-group-title">${group.name}</div>
      <div class="map-zones">
        ${group.zones.map(sz => `
          <button class="zone-btn"
            onclick="window._ui_teleport('${sz.key}')"
            style="${sz.key === currentSubZoneKey ? 'background:#e94560' : ''}">
            ${sz.name} ${sz.level}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  window._ui_teleport = (subZoneKey) => {
    if (subZoneKey === null) {
      window.game?.town();
    } else {
      window.game?.teleport(subZoneKey);
    }
  };
}

export function switchToZoneView() {
  UIManager.openPanel('combat');
  UIManager.setupLogScroll('combat-log-area');
  UIManager.setupLogScroll('combat-result-area');
}

export function switchToTownView() {
  const combatPanel = document.getElementById('panel-combat');
  if (combatPanel) combatPanel.classList.remove('active');
  UIManager._refreshTopBar();
}

export function refreshMapList(currentSubZoneKey) {
  // 地图列表高亮由 buildMapList 每次重新渲染处理
}
