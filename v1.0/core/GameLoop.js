/**
 * @file core/GameLoop.js
 * @desc 100ms tick 游戏循环
 * @ref 06_battle.battle_loop.interval
 */
import { eventBus } from './EventBus.js?v=release-20260830-1';

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
      const tickStartedAt = Date.now();
      const deltaMs = Math.max(0, tickStartedAt - this._lastTickTime);
      this._lastTickTime = tickStartedAt;
      this._tickCount++;
      for (const cb of this._callbacks) {
        try {
          cb(this._tickCount, deltaMs);
        } catch (error) {
          console.error('[GameLoop] tick listener failed:', error);
          eventBus.emit('game.loop_error', { error, tickCount: this._tickCount });
        }
      }
      this._schedule();
    }, delay);
  }

  get tickCount() { return this._tickCount; }
  get isRunning() { return this._running; }
}
