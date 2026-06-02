/**
 * @file core/GameLoop.js
 * @desc 100ms tick 游戏循环
 * @ref 06_battle.battle_loop.interval
 */
import { eventBus } from './EventBus.js';

export class GameLoop {
  /**
   * @param {Object} opts
   * @param {number} [opts.tickIntervalMs=100] 战斗 tick 间隔（毫秒）
   */
  constructor(opts = {}) {
    this._tickMs = opts.tickIntervalMs ?? 100;
    this._timerId = null;
    this._running = false;
    this._tickCount = 0;
    /** @type {Function[]} */
    this._callbacks = [];
  }

  /** 注册每 tick 回调（战场逻辑注册进来） */
  addTickListener(cb) {
    this._callbacks.push(cb);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTickTime = Date.now();
    this._schedule();
  }

  stop() {
    this._running = false;
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  _schedule() {
    if (!this._running) return;
    const now = Date.now();
    const elapsed = now - this._lastTickTime;
    const delay = Math.max(0, this._tickMs - elapsed);
    this._timerId = setTimeout(() => {
      if (!this._running) return;
      this._tickCount++;
      for (const cb of this._callbacks) {
        cb(this._tickCount);
      }
      this._lastTickTime = Date.now();
      this._schedule();
    }, delay);
  }

  get tickCount() { return this._tickCount; }
  get isRunning() { return this._running; }
}