/**
 * @file entities/Buff.js
 * @desc Buff 实例：DOT/HOT 计时 + 永久 buff 标识
 */

/**
 * 创建 Buff 实例
 * @param {Object} buffTemplate
 * @param {Object} opts
 * @param {number} opts.durationOverride 覆盖 duration（用于气功 buffDuration 延长）
 * @returns {Object} buff 实例
 */
export function createBuffInstance(buffTemplate, opts = {}) {
  const duration = opts.durationOverride !== undefined ? opts.durationOverride : buffTemplate.duration;
  return {
    key: buffTemplate.key,
    name: buffTemplate.name,
    description: buffTemplate.description,
    duration,               // 毫秒，-1 表示永久
    stackable: buffTemplate.stackable ?? false,
    max_stacks: buffTemplate.max_stacks ?? 1,
    is_debuff: buffTemplate.is_debuff ?? false,
    dispellable: buffTemplate.dispellable ?? true,
    effect_type: buffTemplate.effect_type || 'attribute',
    attribute_mods: buffTemplate.attribute_mods || {},
    // 运行时
    start_time: Date.now(),
    remaining: duration,   // 剩余时间（毫秒），-1 永久
    // DOT/HOT
    tick_interval: buffTemplate.tick_interval || 0,
    tick_remaining: buffTemplate.tick_interval || 0,
    tick_value: buffTemplate.tick_value || 0,
    // 叠加计数
    stacks: 1
  };
}

/**
 * 判断 buff 是否已过期
 * @param {Object} buff
 * @returns {boolean}
 */
export function isBuffExpired(buff) {
  if (buff.duration === -1) return false;
  return buff.remaining <= 0;
}