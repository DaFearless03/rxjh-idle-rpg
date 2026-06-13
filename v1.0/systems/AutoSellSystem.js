/**
 * @file systems/AutoSellSystem.js
 * @desc 回城时按玩家配置自动出售低属性金刚石与寒玉石。
 */
import { ShopSystem } from './ShopSystem.js';
import { eventBus } from '../core/EventBus.js';

function parseStoneKey(itemKey) {
  const match = String(itemKey || '').match(/^(.+?)--(.+?)--(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const baseKey = match[1];
  const category = baseKey.startsWith('vajra_')
    ? 'vajra'
    : baseKey.startsWith('cold_jade_') ? 'cold_jade' : null;
  if (!category) return null;
  return { baseKey, category, attributeKey: match[2], value: Number(match[3]) };
}

export const AutoSellSystem = {
  parseStoneKey,

  sellConfiguredStones(player, { silent = false } = {}) {
    const config = player?.auto_play?.auto_sell;
    if (!config?.enabled) return { sold: 0, gold_earned: 0, items: {} };

    const summary = { sold: 0, gold_earned: 0, items: {} };
    const slots = [...(player.inventory?.slots || [])];
    for (const slot of slots) {
      if (!slot?.item_key || (slot.count || 0) <= 0) continue;
      const stone = parseStoneKey(slot.item_key);
      if (!stone) continue;
      const rule = config.categories?.[stone.category]?.rules?.[stone.attributeKey];
      if (!rule?.enabled || stone.value > Number(rule.max_value ?? 0)) continue;

      const itemKey = slot.item_key;
      const count = slot.count;
      const before = player.resources?.gold || 0;
      const result = ShopSystem.sell(player, { type: 'shop', shop_type: 'potion', items: [] }, itemKey, count);
      if (!result.success) continue;
      const earned = (player.resources?.gold || 0) - before;
      summary.sold += count;
      summary.gold_earned += earned;
      summary.items[itemKey] = (summary.items[itemKey] || 0) + count;
    }

    if (summary.sold > 0 && !silent) eventBus.emit('autoplay.auto_sell', summary);
    return summary;
  },
};
