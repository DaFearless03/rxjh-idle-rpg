/**
 * @file core/GameLoop.js
 * @desc 100ms tick 游戏循环
 * @ref 06_battle.battle_loop.interval
 */
import { eventBus } from './EventBus.js?v=release-20260830-3';

export class GameLoop {
  /**
   * @param {Object} opts
   * @param {number} [opts.tickIntervalMs=100] 战斗 tick 间隔（毫秒）
   */
  constructor(opts = {}) {
    const rawTickMs = Number(opts.tickIntervalMs ?? 100);
    this._tickMs = Number.isFinite(rawTickMs) && rawTickMs > 0 ? rawTickMs : 100;
    const rawMaxDeltaMs = Number(opts.maxDeltaMs ?? 1000);
    this._maxDeltaMs = Number.isFinite(rawMaxDeltaMs) && rawMaxDeltaMs >= this._tickMs
      ? rawMaxDeltaMs
      : Math.max(1000, this._tickMs);
    this._now = typeof opts.now === 'function'
      ? opts.now
      : () => globalThis.performance?.now?.() ?? Date.now();
    this._timerId = null;
    this._running = false;
    this._tickCount = 0;
    /** @type {Function[]} */
    this._callbacks = [];
  }

  /** 注册每 tick 回调（战场逻辑注册进来） */
  addTickListener(cb) {
    if (typeof cb !== 'function') throw new TypeError('tick listener must be a function');
    this._callbacks.push(cb);
    return () => {
      const index = this._callbacks.indexOf(cb);
      if (index >= 0) this._callbacks.splice(index, 1);
    };
  }

  start() {
    if (this._running) return;
    this._running = true;
    const now = Number(this._now());
    this._lastTickTime = Number.isFinite(now) ? now : 0;
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
    const sampledNow = Number(this._now());
    const now = Number.isFinite(sampledNow) ? sampledNow : this._lastTickTime;
    const elapsed = Math.max(0, now - this._lastTickTime);
    const delay = Math.max(0, this._tickMs - elapsed);
    this._timerId = setTimeout(() => {
      if (!this._running) return;
      const sampledTickTime = Number(this._now());
      const tickStartedAt = Number.isFinite(sampledTickTime)
        ? sampledTickTime
        : this._lastTickTime + this._tickMs;
      const elapsedMs = Math.max(0, tickStartedAt - this._lastTickTime);
      const deltaMs = Math.min(elapsedMs, this._maxDeltaMs);
      this._lastTickTime = tickStartedAt;
      this._tickCount++;
      if (elapsedMs > this._maxDeltaMs) {
        eventBus.emit('game.loop_gap', {
          elapsedMs,
          processedMs: deltaMs,
          droppedMs: elapsedMs - deltaMs,
          tickCount: this._tickCount,
        });
      }
      for (const cb of [...this._callbacks]) {
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
