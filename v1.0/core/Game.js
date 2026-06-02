/**
 * @file core/Game.js
 * @desc 游戏状态聚合器，持有多系统引用
 */
export class Game {
  constructor() {
    /** @type {import('../entities/Player.js').Player | null} */
    this.player = null;
    /** @type {import('../systems/BattleSystem.js').BattleSystem | null} */
    this.battle = null;
    /** @type {import('./GameLoop.js').GameLoop} */
    this.loop = null;
    /** @type {import('./EventBus.js').EventBus} */
    this.events = null;
    /** @type {Object} 配置数据 */
    this.config = null;
    /** @type {Object[]} 所有怪物列表 */
    this.monstersData = [];
    /** @type {Object[]} 所有职业列表 */
    this.careersData = [];
  }
}