/**
 * @file utils/random.js
 * @desc 随机工具
 */

/**
 * 区间随机整数 [min, max]（含端点）
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * [0, 1) 随机
 * @returns {number}
 */
export function random() {
  return Math.random();
}