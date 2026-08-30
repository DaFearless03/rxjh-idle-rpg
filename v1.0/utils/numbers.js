/**
 * 将非负计数限制在 JavaScript 可精确表示的整数范围内。
 */
export function creditSafeInteger(currentValue, requestedAmount) {
  const current = Number(currentValue);
  const amount = Number(requestedAmount);
  const base = Number.isSafeInteger(current) && current >= 0 ? current : 0;
  const requested = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  const added = Math.min(requested, Number.MAX_SAFE_INTEGER - base);
  return { value: base + added, added };
}

export function canCreditSafeInteger(currentValue, requestedAmount) {
  if (typeof currentValue !== 'number' || typeof requestedAmount !== 'number') return false;
  const current = Number(currentValue);
  const amount = Number(requestedAmount);
  return Number.isSafeInteger(current)
    && current >= 0
    && Number.isSafeInteger(amount)
    && amount >= 0
    && amount <= Number.MAX_SAFE_INTEGER - current;
}

/**
 * 游戏时长允许保留亚毫秒精度，但仍需避免增长为不可安全序列化的巨量数值。
 */
export function addCappedNonNegative(currentValue, increment) {
  const current = Number(currentValue);
  const amount = Number(increment);
  const base = Number.isFinite(current) && current >= 0
    ? Math.min(current, Number.MAX_SAFE_INTEGER)
    : 0;
  const added = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, base + added);
}
