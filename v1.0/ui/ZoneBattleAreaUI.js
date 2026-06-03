/**
 * @file ui/ZoneBattleAreaUI.js
 * @desc 14.5 战斗区主体结构：怪物列表、战斗日志、掉落日志。
 */

export function renderZoneBattleArea() {
  return `
    <div class="monster-panel battle-section-monsters">
      <div class="panel-title">
        <span>👹 战场敌人</span>
        <span class="count" id="monster-count">0/0</span>
      </div>
      <div class="monster-grid" id="monster-grid"></div>
    </div>
    <div class="log-panel combat-log battle-section-combat-log">
      <div class="panel-title">⚔ 战斗细节</div>
      <div class="log-scroll" id="combat-log-area"></div>
    </div>
    <div class="log-panel reward-log battle-section-reward-log">
      <div class="panel-title">✦ 掉落细节</div>
      <div class="log-scroll" id="combat-result-area"></div>
    </div>
  `;
}
