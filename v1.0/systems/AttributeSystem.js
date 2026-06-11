/**
 * @file systems/AttributeSystem.js
 * @desc 派生属性重算（base + hooks 聚合）
 * @ref 02_attributes.base_attributes / attribute_hooks / 02_attributes.派生属性聚合默认规则
 */
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
    const c = this._constants;
    const level = player.level || 1;

    // 四维直接来自 base_stats + attrGrow（已在 Player 构造时累积）
    const str = player.str || 0;
    const dex = player.dex || 0;
    const sta = player.sta || 0;
    const int = player.int || 0;

    // 钩子收集（来自已装备物品）
    const h = player._hooks || {};

    // 重置钩子（避免残留）
    for (const key of Object.keys(h)) delete h[key];

    // equip_total_formula: 聚合所有已装备物品的钩子
    this._collectEquipmentHooks(player, h);

    // 气功加成
    if (this._qigongSys) {
      this._qigongSys.collectQigongHooks(player, h);
      this._qigongSys.collectEarringBonus(player, h);
    }

    // Buff 加成
    if (this._buffSys) {
      this._buffSys.collectBuffHooks(player, h);
    }

    // maxHp: (baseHp + (level-1)*hpGrowth + sta*staToHp + sum(maxHpAdd)) * (1 + sum(maxHpPct))
    const maxHpBase = (player.baseHp || 100) + (level - 1) * (player.hpGrowth || 60) + sta * c.staToHp;
    const maxHpAdd = (h.maxHpAdd || 0);
    const maxHpPct = (h.maxHpPct || 0);
    player.maxHp = Math.floor(maxHpBase + maxHpAdd) * (1 + maxHpPct);

    // maxMp: (baseMp + (level-1)*mpGrowth + int*intToMp + sum(maxMpAdd)) * (1 + sum(maxMpPct))
    const maxMpBase = (player.baseMp || 100) + (level - 1) * (player.mpGrowth || 20) + int * c.intToMp;
    const maxMpAdd = (h.maxMpAdd || 0);
    const maxMpPct = (h.maxMpPct || 0);
    player.maxMp = Math.floor(maxMpBase + maxMpAdd) * (1 + maxMpPct);

    // atkMin: (baseAtk + floor(str*0.8*strToAtk) + sum(atkMinAdd) + sum(atkSelfAdd)) * (1 + sum(atkMinPct) + sum(atkSelfPct))
    const atkSelfAdd = (h.atkSelfAdd || 0);
    const atkSelfPct = (h.atkSelfPct || 0);
    player.atkMin = Math.floor(
      (c.baseAtk + Math.floor(str * 0.8 * c.strToAtk) + (h.atkMinAdd || 0) + atkSelfAdd) *
      (1 + (h.atkMinPct || 0) + atkSelfPct)
    );

    // atkMax
    player.atkMax = Math.floor(
      (c.baseAtk + Math.floor(str * 1.0 * c.strToAtk) + (h.atkMaxAdd || 0) + atkSelfAdd) *
      (1 + (h.atkMaxPct || 0) + atkSelfPct)
    );

    // def: (baseDef + sta*staToDef + sum(defAdd)) * (1 + sum(defPct))
    player.def = Math.floor(
      (c.baseDef + sta * c.staToDef + (h.defAdd || 0)) * (1 + (h.defPct || 0))
    );

    // matk: weapon.atkMax * matk_weapon_ratio（Phase 1 无武器 = 0）
    player.matk = (player._weaponAtkMax || 0) * c.matk_weapon_ratio;

    // mdef: 0 + sum(mdefAdd)
    player.mdef = (h.mdefAdd || 0);

    // hit: max(0, (baseHit + dex*dexToHit + level*levelToHit + sum(hitAdd)) * (1 + sum(hitPct)))
    player.hit = Math.max(0, Math.floor(
      (c.baseHit + dex * c.dexToHit + level * c.levelToHit + (h.hitAdd || 0)) *
      (1 + (h.hitPct || 0))
    ));

    // missing: max(0, (baseMissing + dex*dexToMissing + level*levelToMissing + sum(missingAdd)) * (1 + sum(missingPct)))
    player.missing = Math.max(0, Math.floor(
      (c.baseMissing + dex * c.dexToMissing + level * c.levelToMissing + (h.missingAdd || 0)) *
      (1 + (h.missingPct || 0))
    ));

    // 战斗属性（base_value 声明式写法，这里直接用常量）
    player.critR = (player._baseCritR ?? 0.30) + (h.critRLAdd || 0);
    player.critB = (player._baseCritB ?? 1.5) + (h.critBLAdd || 0);
    player.skillCritRate = (player._baseSkillCritRate ?? 0) + (h.skillCritRateAdd || 0);
    player.combo = (player._baseCombo ?? 0) + (h.comboAdd || 0);
    player.shieldRate = (player._baseShieldRate ?? 0) + (h.shieldRateAdd || 0);
    player.counterDamage = (player._baseCounterDamage ?? 0) + (h.counterDamageAdd || 0);
    player.armorBreak = (player._baseArmorBreak ?? 0) + (h.armorBreakAdd || 0);
    player.leech = (player._baseLeech ?? 0) + (h.leechAdd || 0);

    // 隐藏战斗属性
    player.hpRecovery = (player._baseHpRecovery ?? 1) + (h.hpRecoveryAdd || 0);
    player.mpRecovery = (player._baseMpRecovery ?? 1) + (h.mpRecoveryAdd || 0);
    player.healBonus = (player._baseHealBonus ?? 0) + (h.healBonusAdd || 0);
    player.mpCostReduce = (player._baseMpCostReduce ?? 0) + (h.mpCostReduceAdd || 0);
    player.buffDuration = (player._baseBuffDuration ?? 0) + (h.buffDurationAdd || 0);
    player.mpRecoveryBonus = (player._baseMpRecoveryBonus ?? 0) + (h.mpRecoveryBonusAdd || 0);
    player.mf = (player._baseMf ?? 0) + (h.mfAdd || 0);
    player.gf = (player._baseGf ?? 0) + (h.gfAdd || 0);
    player.weaponSkillBonus = (player._baseWeaponSkillBonus ?? 0) + (h.weaponSkillBonusAdd || 0);
    player.weaponExtraDamage = (player._baseWeaponExtraDamage ?? 0) + (h.weaponExtraDamageAdd || 0);
    player.enhanceSuccessRate = (player._baseEnhanceSuccessRate ?? 0) + (h.enhanceSuccessRateAdd || 0);
    player.goldDropBonus = (player._baseGoldDropBonus ?? 0) + (h.goldDropBonusAdd || 0);
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

    for (const [slot, val] of Object.entries(equipped)) {
      if (!val) continue;

      // ring/earring 是双槽数组
      const slotItems = Array.isArray(val) ? val : [val];

      for (const item of slotItems) {
        if (!item?.instance_id) continue;
        const inst = ei[item.instance_id];
        if (!inst) continue;

        const template = templates.find(t => t.key === inst.item_key);
        if (!template?.base_stats) continue;

        const stats = template.base_stats;
        const enhanceLevel = inst.enhance_level || 0;
        const synthesisSlots = inst.synthesis_slots || [];

        // base_stats → xxxAdd 钩子
        if (stats.atkMin !== undefined) {
          h.atkMinAdd = (h.atkMinAdd || 0) + stats.atkMin + (slot === 'weapon' ? enhanceLevel * 6 : 0);
        }
        if (stats.atkMax !== undefined) {
          h.atkMaxAdd = (h.atkMaxAdd || 0) + stats.atkMax + (slot === 'weapon' ? enhanceLevel * 8 : 0);
        }
        if (stats.def !== undefined) {
          h.defAdd = (h.defAdd || 0) + stats.def + (slot !== 'weapon' ? enhanceLevel * 3 : 0);
        }
        if (stats.maxHp !== undefined) {
          h.maxHpAdd = (h.maxHpAdd || 0) + stats.maxHp;
        }
        if (stats.maxMp !== undefined) {
          h.maxMpAdd = (h.maxMpAdd || 0) + stats.maxMp;
        }
        if (stats.hit !== undefined) {
          h.hitAdd = (h.hitAdd || 0) + stats.hit;
        }
        if (stats.missing !== undefined) {
          h.missingAdd = (h.missingAdd || 0) + stats.missing;
        }
        if (stats.matk !== undefined) {
          h.matkAdd = (h.matkAdd || 0) + stats.matk;
        }
        if (stats.mdef !== undefined) {
          h.mdefAdd = (h.mdefAdd || 0) + stats.mdef;
        }

        // 合成石头加成（按 category 映射）
        for (const stoneKey of synthesisSlots) {
          const stoneAttribute = this._parseStoneAttribute(stoneKey);
          if (stoneAttribute) {
            h[stoneAttribute.hook] = (h[stoneAttribute.hook] || 0) + stoneAttribute.value;
          } else if (stoneKey.startsWith('vajra')) {
            h.atkMinAdd = (h.atkMinAdd || 0) + 5;
            h.atkMaxAdd = (h.atkMaxAdd || 0) + 8;
          } else if (stoneKey.startsWith('cold_jade')) {
            h.defAdd = (h.defAdd || 0) + 3;
            h.maxHpAdd = (h.maxHpAdd || 0) + 20;
          } else if (stoneKey.startsWith('hot_blood')) {
            h.critRLAdd = (h.critRLAdd || 0) + 0.01;
            h.atkMinAdd = (h.atkMinAdd || 0) + 2;
          } else if (stoneKey.startsWith('enhance_stone')) {
            h.enhanceSuccessRateAdd = (h.enhanceSuccessRateAdd || 0) + 0.01;
          }
        }
      }
    }
  }

  _parseStoneAttribute(stoneKey) {
    const [, hook, rawValue] = String(stoneKey || '').split('--');
    const value = Number(rawValue);
    if (!hook || !Number.isFinite(value) || hook === 'skill_level_up') return null;
    return { hook, value };
  }
}
