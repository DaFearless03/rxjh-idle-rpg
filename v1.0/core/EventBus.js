/**
 * @file core/EventBus.js
 * @desc 事件总线，所有 snake_case 事件名
 * @ref INDEX.v1.0实现关键约束 / 02_attributes.on_level_up
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
  }

  /**
   * 订阅事件
   * @param {string} event snake_case 事件名
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  /**
   * 取消订阅
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const arr = this._listeners.get(event) || [];
    const idx = arr.indexOf(callback);
    if (idx !== -1) arr.splice(idx, 1);
  }

  /**
   * 触发事件
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    const arr = this._listeners.get(event) || [];
    for (const cb of arr) {
      cb(payload);
    }
  }

  /** 清除所有监听 */
  clear() {
    this._listeners.clear();
  }
}

/** 全局单例 */
export const eventBus = new EventBus();