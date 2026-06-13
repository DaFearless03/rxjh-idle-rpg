/**
 * @file systems/AutoSellSystem.js
 * @desc 回城时按玩家配置自动出售低属性石头与过滤清单中的装备。
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

function matchesConfiguredRule(player, itemKey) {
  const config = player?.auto_play?.auto_sell;
  if (!config?.enabled) return false;
  const stone = parseStoneKey(itemKey);
  if (!stone) return false;
  const rule = config.categories?.[stone.category]?.rules?.[stone.attributeKey];
  return !!rule?.enabled && stone.value <= Number(rule.max_value ?? 0);
}

function matchesEquipmentFilter(player, slot) {
  const autoSell = player?.auto_play?.auto_sell;
  const equipment = autoSell?.equipment;
  return !!autoSell?.enabled
    && !!equipment?.enabled
    && !!slot?.instance_id
    && (equipment.item_keys || []).includes(slot.item_key);
}

function getEquipmentSellPrice(player, itemKey) {
  const template = player?._equipTemplates?.find(item => item.key === itemKey);
  if (!template) return 1;
  const level = Number(template.required_level || 1);
  if (template.slot === 'weapon') return level < 35 ? level * 100 : level * 1000;
  if (template.slot === 'gloves') return level * 20;
  if (['chest', 'boots', 'inner_armor', 'cape'].includes(template.slot)) return level * 500;
  return 1;
}

export const AutoSellSystem = {
  parseStoneKey,

  hasSellableConfiguredItems(player) {
    return (player?.inventory?.slots || []).some(slot =>
      slot?.item_key
      && (slot.count || 0) > 0
      && (matchesConfiguredRule(player, slot.item_key) || matchesEquipmentFilter(player, slot))
    );
  },

  hasSellableConfiguredStones(player) {
    return this.hasSellableConfiguredItems(player);
  },

  sellConfiguredStones(player, { silent = false } = {}) {
    const config = player?.auto_play?.auto_sell;
    if (!config?.enabled) return { sold: 0, gold_earned: 0, items: {} };

    const summary = { sold: 0, gold_earned: 0, items: {} };
    const slots = [...(player.inventory?.slots || [])];
    for (const slot of slots) {
      if (!slot?.item_key || (slot.count || 0) <= 0) continue;
      if (matchesEquipmentFilter(player, slot)) {
        const itemKey = slot.item_key;
        const before = player.resources?.gold || 0;
        const result = ShopSystem.sellEquipmentInstance(
          player,
          slot.instance_id,
          getEquipmentSellPrice(player, itemKey)
        );
        if (!result.success) continue;
        const earned = (player.resources?.gold || 0) - before;
        summary.sold += 1;
        summary.gold_earned += earned;
        summary.items[itemKey] = (summary.items[itemKey] || 0) + 1;
        continue;
      }
      if (!matchesConfiguredRule(player, slot.item_key)) continue;

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
