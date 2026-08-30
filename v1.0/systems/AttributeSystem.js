/**
 * @file systems/AttributeSystem.js
 * @desc 派生属性重算（base + hooks 聚合）
 * @ref 02_attributes.base_attributes / attribute_hooks / 02_attributes.派生属性聚合默认规则
 */
const SUPPORTED_STONE_HOOKS = new Set([
  'atkSelfAdd', 'defAdd', 'enhanceSuccessRateAdd', 'goldDropBonusAdd',
  'hitAdd', 'maxHpAdd', 'missingAdd', 'weaponExtraDamageAdd', 'weaponSkillBonusAdd',
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function addHook(hooks, key, value) {
  const amount = finiteNumber(value, Number.NaN);
  if (!Number.isFinite(amount)) return;
  hooks[key] = finiteNumber(hooks[key]) + amount;
}

function clamp(value, min, max, fallback = min) {
  const number = finiteNumber(value, fallback);
  return Math.min(max, Math.max(min, number));
}

export class AttributeSystem {
  /**
   * @param {Object} opts
   * @param {Object} opts.attributeConstants attribute_constants 常量
   * @param {Object} opts.attributeHooksData attribute_hooks 配置（用于 sum 各类钩子）
   */
  constructor(opts) {
    this._constants = opts.attributeConstants;
    this._hooksData = opts.attributeHooksData || {};
    this._qigongSys = opts.qigongSystemRef || null;
    this._buffSys = opts.buffSystemRef || null;
  }

  /**
   * 重算玩家所有派生属性
   * @param {Object} player 玩家对象（含 career / level / str/int/sta/dex + hooks）
   * @ref 02_attributes.派生属性聚合默认规则
   */
  recompute(player) {
    const c = this._constants || {};
    const level = Math.max(1, Math.floor(finiteNumber(player.level, 1)));

    // 四维直接来自 base_stats + attrGrow（已在 Player 构造时累积）
    const str = finiteNumber(player.str);
    const dex = finiteNumber(player.dex);
    const sta = finiteNumber(player.sta);
    const int = finiteNumber(player.int);

    // 钩子收集（来自已装备物品）
    const h = player._hooks || {};
    player._hooks = h;

    // 重置钩子（避免残留）
    for (const key of Object.keys(h)) delete h[key];

    // equip_total_formula: 聚合所有已装备物品的钩子
    this._collectEquipmentHooks(player, h);

    // 气功加成
    if (this._qigongSys) {
      this._qigongSys.collectQigongHooks(player, h);
    }

    // Buff 加成
    if (this._buffSys) {
      this._buffSys.collectBuffHooks(player, h);
    }

    // maxHp: (baseHp + (level-1)*hpGrowth + sta*staToHp + sum(maxHpAdd)) * (1 + sum(maxHpPct))
    const maxHpBase = finiteNumber(player.baseHp, 100)
      + (level - 1) * finiteNumber(player.hpGrowth, 60)
      + sta * finiteNumber(c.staToHp);
    const maxHpAdd = (h.maxHpAdd || 0);
    const maxHpPct = (h.maxHpPct || 0);
    player.maxHp = Math.max(1, Math.floor(finiteNumber((maxHpBase + maxHpAdd) * (1 + maxHpPct), 1)));

    // maxMp: (baseMp + (level-1)*mpGrowth + int*intToMp + sum(maxMpAdd)) * (1 + sum(maxMpPct))
    const maxMpBase = finiteNumber(player.baseMp, 100)
      + (level - 1) * finiteNumber(player.mpGrowth, 20)
      + int * finiteNumber(c.intToMp);
    const maxMpAdd = (h.maxMpAdd || 0);
    const maxMpPct = (h.maxMpPct || 0);
    player.maxMp = Math.max(1, Math.floor(finiteNumber((maxMpBase + maxMpAdd) * (1 + maxMpPct), 1)));

    // atkMin: (baseAtk + floor(str*0.8*strToAtk) + sum(atkMinAdd) + sum(atkSelfAdd)) * (1 + sum(atkMinPct) + sum(atkSelfPct))
    const atkSelfAdd = (h.atkSelfAdd || 0);
    const atkSelfPct = (h.atkSelfPct || 0);
    player.atkMin = Math.max(0, Math.floor(finiteNumber(
      (finiteNumber(c.baseAtk) + Math.floor(str * 0.8 * finiteNumber(c.strToAtk)) + (h.atkMinAdd || 0) + atkSelfAdd) *
      (1 + (h.atkMinPct || 0) + atkSelfPct)
    )));

    // atkMax
    player.atkMax = Math.max(player.atkMin, Math.floor(finiteNumber(
      (finiteNumber(c.baseAtk) + Math.floor(str * finiteNumber(c.strToAtk)) + (h.atkMaxAdd || 0) + atkSelfAdd) *
      (1 + (h.atkMaxPct || 0) + atkSelfPct)
    )));

    // def: (baseDef + sta*staToDef + sum(defAdd)) * (1 + sum(defPct))
    player.def = Math.max(0, Math.floor(finiteNumber(
      (finiteNumber(c.baseDef) + sta * finiteNumber(c.staToDef) + (h.defAdd || 0)) * (1 + (h.defPct || 0))
    )));

    // matk: 当前武器攻击上限 * 系数 + 装备直接提供的武功攻击力
    player.matk = Math.max(0, Math.floor(finiteNumber(
      (h.weaponAtkMax || 0) * finiteNumber(c.matk_weapon_ratio) + (h.matkAdd || 0)
    )));

    // mdef: 0 + sum(mdefAdd)
    player.mdef = Math.max(0, finiteNumber(h.mdefAdd));

    // hit: max(0, (baseHit + dex*dexToHit + level*levelToHit + sum(hitAdd)) * (1 + sum(hitPct)))
    player.hit = Math.max(0, Math.floor(finiteNumber(
      (finiteNumber(c.baseHit) + dex * finiteNumber(c.dexToHit) + level * finiteNumber(c.levelToHit) + (h.hitAdd || 0)) *
      (1 + (h.hitPct || 0))
    )));

    // missing: max(0, (baseMissing + dex*dexToMissing + level*levelToMissing + sum(missingAdd)) * (1 + sum(missingPct)))
    player.missing = Math.max(0, Math.floor(finiteNumber(
      (finiteNumber(c.baseMissing) + dex * finiteNumber(c.dexToMissing) + level * finiteNumber(c.levelToMissing) + (h.missingAdd || 0)) *
      (1 + (h.missingPct || 0))
    )));

    // 战斗属性（base_value 声明式写法，这里直接用常量）
    player.critR = clamp(finiteNumber(player._baseCritR, 0.30) + finiteNumber(h.critRAdd) + finiteNumber(h.critRLAdd), 0, 1, 0.30);
    player.critB = Math.max(1, finiteNumber(player._baseCritB, 1.5) + finiteNumber(h.critBAdd) + finiteNumber(h.critBLAdd));
    player.skillCritRate = clamp(finiteNumber(player._baseSkillCritRate) + finiteNumber(h.skillCritRateAdd), 0, 1);
    player.combo = clamp(finiteNumber(player._baseCombo) + finiteNumber(h.comboAdd), 0, 1);
    player.shieldRate = clamp(finiteNumber(player._baseShieldRate) + finiteNumber(h.shieldRateAdd), 0, 1);
    player.counterDamage = clamp(finiteNumber(player._baseCounterDamage) + finiteNumber(h.counterDamageAdd), 0, 1);
    player.armorBreak = clamp(finiteNumber(player._baseArmorBreak) + finiteNumber(h.armorBreakAdd), 0, 1);
    player.leech = clamp(finiteNumber(player._baseLeech) + finiteNumber(h.leechAdd), 0, 1);

    // 隐藏战斗属性
    player.hpRecovery = Math.max(0, finiteNumber(player._baseHpRecovery, 1) + finiteNumber(h.hpRecoveryAdd));
    player.mpRecovery = Math.max(0, finiteNumber(player._baseMpRecovery, 1) + finiteNumber(h.mpRecoveryAdd));
    player.healBonus = Math.max(-1, finiteNumber(player._baseHealBonus) + finiteNumber(h.healBonusAdd));
    player.mpCostReduce = clamp(finiteNumber(player._baseMpCostReduce) + finiteNumber(h.mpCostReduceAdd), 0, 1);
    player.buffDuration = Math.max(0, finiteNumber(player._baseBuffDuration) + finiteNumber(h.buffDurationAdd));
    player.mpRecoveryBonus = Math.max(-1, finiteNumber(player._baseMpRecoveryBonus) + finiteNumber(h.mpRecoveryBonusAdd));
    player.mf = clamp(finiteNumber(player._baseMf) + finiteNumber(h.mfAdd), 0, 1);
    player.gf = Math.max(0, finiteNumber(player._baseGf) + finiteNumber(h.gfAdd));
    player.weaponSkillBonus = Math.max(0, finiteNumber(player._baseWeaponSkillBonus) + finiteNumber(h.weaponSkillBonusAdd));
    player.weaponExtraDamage = Math.max(0, finiteNumber(player._baseWeaponExtraDamage) + finiteNumber(h.weaponExtraDamageAdd));
    player.enhanceSuccessRate = clamp(finiteNumber(player._baseEnhanceSuccessRate) + finiteNumber(h.enhanceSuccessRateAdd), 0, 1);
    player.goldDropBonus = Math.max(0, finiteNumber(player._baseGoldDropBonus) + finiteNumber(h.goldDropBonusAdd));

    // 最大值降低（卸装、重置气功、Buff 结束）后，当前值必须立即回到合法范围。
    if (Number.isFinite(player.hp)) player.hp = Math.max(0, Math.min(player.hp, player.maxHp));
    if (Number.isFinite(player.mp)) player.mp = Math.max(0, Math.min(player.mp, player.maxMp));
  }

  /**
   * 聚合已装备物品的钩子到 player._hooks
   * @param {Object} player
   * @param {Object} h 钩子对象（会被修改）
   */
  _collectEquipmentHooks(player, h) {
    const templates = player._equipTemplates || [];
    const ei = player.inventory?.equipment_instances || {};
    const equipped = player.equipped || {};
    const seenInstances = new Set();

    for (const [slot, val] of Object.entries(equipped)) {
      if (!val) continue;

      // ring/earring 是双槽数组
      const slotItems = Array.isArray(val) ? val : [val];

      for (const item of slotItems) {
        const instanceId = typeof item === 'string' ? item : item?.instance_id;
        if (!instanceId || seenInstances.has(instanceId)) continue;
        seenInstances.add(instanceId);
        const inst = ei[instanceId];
        if (!inst) continue;

        const template = templates.find(t => t.key === inst.item_key);
        if (!template?.base_stats || template.slot !== slot) continue;

        const stats = template.base_stats;
        const extraStats = inst.extra && typeof inst.extra === 'object' && !Array.isArray(inst.extra)
          ? inst.extra
          : (template.extra_affixes || {});
        const enhanceLevel = clamp(Math.floor(finiteNumber(inst.enhance_level)), 0, 10);
        const synthesisSlots = Array.isArray(inst.synthesis_slots) ? inst.synthesis_slots : [];

        // base_stats → xxxAdd 钩子
        if (stats.atkMin !== undefined) {
          addHook(h, 'atkMinAdd', finiteNumber(stats.atkMin) + (slot === 'weapon' ? enhanceLevel * 6 : 0));
        }
        if (stats.atkMax !== undefined) {
          const enhancedAtkMax = finiteNumber(stats.atkMax) + (slot === 'weapon' ? enhanceLevel * 8 : 0);
          addHook(h, 'atkMaxAdd', enhancedAtkMax);
          if (slot === 'weapon') {
            addHook(h, 'weaponAtkMax', enhancedAtkMax);
          }
        }
        if (stats.def !== undefined) {
          addHook(h, 'defAdd', finiteNumber(stats.def) + (slot !== 'weapon' ? enhanceLevel * 3 : 0));
        }
        if (stats.maxHp !== undefined) {
          addHook(h, 'maxHpAdd', stats.maxHp);
        }
        if (stats.maxMp !== undefined) {
          addHook(h, 'maxMpAdd', stats.maxMp);
        }
        if (stats.hit !== undefined) {
          addHook(h, 'hitAdd', stats.hit);
        }
        if (stats.missing !== undefined) {
          addHook(h, 'missingAdd', stats.missing);
        }
        if (stats.matk !== undefined) {
          addHook(h, 'matkAdd', stats.matk);
        }
        if (stats.mdef !== undefined) {
          addHook(h, 'mdefAdd', stats.mdef);
        }
        for (const [key, value] of Object.entries(extraStats)) {
          addHook(h, `${key}Add`, value);
        }

        // 合成石头加成（按 category 映射）
        for (const stoneKey of synthesisSlots) {
          if (typeof stoneKey !== 'string' || !stoneKey) continue;
          const stoneAttribute = this._parseStoneAttribute(stoneKey);
          if (stoneAttribute) {
            addHook(h, stoneAttribute.hook, stoneAttribute.value);
          } else if (stoneKey.includes('--skill_level_up--')) {
            // 技能等级由 QigongSystem 按绑定目标计算，不能再套用热血石 fallback。
            continue;
          } else if (stoneKey.startsWith('vajra')) {
            addHook(h, 'atkMinAdd', 5);
            addHook(h, 'atkMaxAdd', 8);
          } else if (stoneKey.startsWith('cold_jade')) {
            addHook(h, 'defAdd', 3);
            addHook(h, 'maxHpAdd', 20);
          } else if (stoneKey.startsWith('hot_blood')) {
            addHook(h, 'critRLAdd', 0.01);
            addHook(h, 'atkMinAdd', 2);
          } else if (stoneKey.startsWith('enhance_stone')) {
            addHook(h, 'enhanceSuccessRateAdd', 0.01);
          }
        }
      }
    }
  }

  _parseStoneAttribute(stoneKey) {
    const key = String(stoneKey || '');
    let hook;
    let rawValue;
    if (key.includes('--')) {
      [, hook, rawValue] = key.split('--');
    } else {
      const legacy = key.match(/^[^_]+_\d+_(.+)_(-?\d+(?:\.\d+)?)$/);
      if (legacy) [, hook, rawValue] = legacy;
    }
    const value = Number(rawValue);
    if (!hook || !Number.isFinite(value) || hook === 'skill_level_up') return null;
    const aliases = {
      atkAdd: 'atkSelfAdd',
      defSelfAdd: 'defAdd',
      maxHpSelfAdd: 'maxHpAdd',
      hitSelfAdd: 'hitAdd',
    };
    const normalizedHook = aliases[hook] || hook;
    if (!SUPPORTED_STONE_HOOKS.has(normalizedHook)) return null;
    return { hook: normalizedHook, value };
  }
}
