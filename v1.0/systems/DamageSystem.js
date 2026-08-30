/**
 * @file systems/DamageSystem.js
 * @desc 命中判定 + 普通攻击伤害 + 攻击结算 pipeline
 * @ref 06_battle.damage_formulas (hit_check / normal_attack_damage / attack_resolution_pipeline)
 */
import { random, randInt } from '../utils/random.js?v=release-20260830-3';

export class DamageSystem {
  /**
   * @param {Object} opts
   * @param {Object} opts.combatConstants combat_constants
   */
  constructor(opts) {
    this._cc = opts.combatConstants;
  }

  /**
   * 命中判定
   * @param {Object} attacker
   * @param {Object} target
   * @returns {boolean} true = 命中
   * @ref 06_battle.damage_formulas.hit_check
   */
  hit_check(attacker, target) {
    const denom = (attacker.hit || 0) + (target.missing || 0);
    if (denom <= 0) return true;
    const actualHitRate = Math.min(0.95, Math.max(0.05, attacker.hit / denom));
    return random() <= actualHitRate;
  }

  /**
   * 普通攻击伤害计算
   * @param {Object} attacker
   * @param {Object} target
   * @returns {{ finalDmg: number, isMiss: boolean, isCrit: boolean, isCombo: boolean, isArmorBroken: boolean }}
   * @ref 06_battle.damage_formulas.normal_attack_damage
   */
  normal_attack_damage(attacker, target) {
    // 攻击力：玩家区间随机，怪物固定
    const atk = attacker._isPlayer
      ? randInt(attacker.atkMin, attacker.atkMax)
      : attacker.atk;

    // 破甲
    const rawDef = Number(target.def);
    const rawMdef = Number(target.mdef);
    let effectiveDef = Number.isFinite(rawDef) && rawDef >= 0 ? rawDef : 0;
    let effectiveMdef = Number.isFinite(rawMdef) && rawMdef >= 0 ? rawMdef : 0;
    let isArmorBroken = false;
    if (random() < (attacker.armorBreak ?? 0)) {
      effectiveDef *= (1 - this._cc.armorBreakDefReduce);
      effectiveMdef *= (1 - this._cc.armorBreakDefReduce);
      isArmorBroken = true;
    }

    let baseDmg = Math.max(1, atk - effectiveDef);

    // 连击（仅玩家，触发后跳过暴击）
    if (attacker._isPlayer && random() < (attacker.combo ?? 0)) {
      const hits = this._cc.comboHits;
      return {
        finalDmg: Math.max(1, Math.floor(baseDmg * hits)),
        isMiss: false,
        isCrit: false,
        isCombo: true,
        isArmorBroken,
      };
    }

    // 暴击（与连击互斥）
    const critRate = attacker.critR ?? 0.25;
    const critBonus = attacker.critB ?? 1.5;
    let isCrit = false;
    if (random() < critRate) {
      baseDmg *= critBonus;
      isCrit = true;
    }

    const finalDmg = Math.max(1, Math.floor(baseDmg));
    return { finalDmg, isMiss: false, isCrit, isCombo: false, isArmorBroken };
  }

  /**
   * 攻击结算 pipeline（普攻/单体武功共用）
   * @param {Object} attacker
   * @param {Object} target
   * @param {string} attackType "normal" | "skill"
   * @param {Object|null} skill 武功对象（Phase 1 恒为 null，走 normal 分支）
   * @returns {Object} 结算结果
   * @ref 06_battle.damage_formulas.attack_resolution_pipeline
   */
  attack_resolution_pipeline(attacker, target, attackType = 'normal', skill = null) {
    // 0. hit_check
    if (!this.hit_check(attacker, target)) {
      return {
        isMiss: true,
        finalDmg: 0,
        actualDmg: 0,
        isCrit: false,
        isCombo: false,
        isShielded: false,
        isLeech: false,
        leechHeal: 0,
        isCountered: false,
        reflectedDmg: 0,
        isArmorBroken: false,
      };
    }

    // 1. 计算 finalDmg
    let result;
    if (attackType === 'normal' || skill === null) {
      result = this.normal_attack_damage(attacker, target);
    } else {
      result = {
        ...this._skill_damage(attacker, target, skill),
        isMiss: false,
        isCombo: false,
      };
    }
    const { finalDmg, isCrit, isCombo, isArmorBroken } = result;

    // 2. shieldRate 减伤（守方）
    let actualDmg = finalDmg;
    let isShielded = false;
    if (random() < (target.shieldRate ?? 0)) {
      actualDmg = Math.floor(finalDmg * (1 - this._cc.shieldDamageReduceRate));
      isShielded = true;
    }
    const targetHp = Number(target.hp);
    if (Number.isFinite(targetHp)) {
      actualDmg = Math.min(actualDmg, Math.max(0, targetHp));
    }

    // 3. leech（攻方）
    let isLeech = false;
    let leechHeal = 0;
    const leechChance = attacker.leech ?? 0;
    if (leechChance > 0 && random() < leechChance) {
      leechHeal = Math.min(
        Math.floor(actualDmg * this._cc.leechRate),
        Math.max(0, attacker.maxHp - attacker.hp),
      );
      attacker.hp += leechHeal;
      isLeech = true;
    }

    // 4. counterDamage（守方反击给攻方）
    let isCountered = false;
    let reflectedDmg = 0;
    if (random() < (target.counterDamage ?? 0)) {
      reflectedDmg = Math.min(
        Math.floor(actualDmg * this._cc.counterDamageRate),
        Math.max(0, attacker.hp),
      );
      attacker.hp = Math.max(0, attacker.hp - reflectedDmg);
      isCountered = true;
    }

    return {
      isMiss: false,
      finalDmg,
      actualDmg,
      isCrit,
      isCombo,
      isShielded,
      isLeech,
      leechHeal,
      isCountered,
      reflectedDmg,
      isArmorBroken,
    };
  }

  /**
   * 技能伤害（Phase 1 预留）
   * @ref 06_battle.damage_formulas.skill_damage
   */
  _skill_damage(attacker, target, skill) {
    const atk = attacker._isPlayer
      ? randInt(attacker.atkMin, attacker.atkMax)
      : attacker.atk;

    const rawDef = Number(target.def);
    const rawMdef = Number(target.mdef);
    let effectiveDef = Number.isFinite(rawDef) && rawDef >= 0 ? rawDef : 0;
    let effectiveMdef = Number.isFinite(rawMdef) && rawMdef >= 0 ? rawMdef : 0;
    let isArmorBroken = false;
    if (random() < (attacker.armorBreak ?? 0)) {
      effectiveDef *= (1 - this._cc.armorBreakDefReduce);
      effectiveMdef *= (1 - this._cc.armorBreakDefReduce);
      isArmorBroken = true;
    }

    const basePart = Math.max(1, atk - effectiveDef) * 1.5;
    const matkPart = (attacker.matk || 0) * (1 + (attacker.weaponSkillBonus || 0) / 100);
    const weaponBonus = (skill?.effect?.value || 0) + (attacker.weaponExtraDamage || 0);
    let skillDmg = basePart + matkPart + weaponBonus;
    skillDmg *= (100 / (100 + effectiveMdef));

    let isCrit = false;
    if (random() < (attacker.skillCritRate ?? 0)) {
      skillDmg *= (1 + this._cc.skillCritDamageBonus);
      isCrit = true;
    }

    return {
      finalDmg: Math.max(1, Math.floor(skillDmg)),
      isCrit,
      isArmorBroken,
    };
  }
}
