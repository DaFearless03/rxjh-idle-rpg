/**
 * @file systems/DamageSystem.js
 * @desc 命中判定 + 普通攻击伤害 + 攻击结算 pipeline
 * @ref 06_battle.damage_formulas (hit_check / normal_attack_damage / attack_resolution_pipeline)
 */
import { random, randInt } from '../utils/random.js';

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
    let effectiveDef = target.def || 0;
    let effectiveMdef = target.mdef || 0;
    let isArmorBroken = false;
    if (random() < (attacker.armorBreak ?? 0)) {
      effectiveDef = target.def * (1 - this._cc.armorBreakDefReduce);
      effectiveMdef = target.mdef * (1 - this._cc.armorBreakDefReduce);
      isArmorBroken = true;
    }

    let baseDmg = Math.max(1, atk - effectiveDef);

    // 连击（仅玩家，触发后跳过暴击）
    if (attacker._isPlayer && random() < (attacker.combo ?? 0)) {
      const hits = this._cc.comboHits;
      return { finalDmg: baseDmg * hits, isMiss: false, isCrit: false, isCombo: true, isArmorBroken };
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
      return { isMiss: true, finalDmg: 0, actualDmg: 0, isCrit: false, isShielded: false, isLeech: false, isCountered: false };
    }

    // 1. 计算 finalDmg
    let result;
    if (attackType === 'normal' || skill === null) {
      result = this.normal_attack_damage(attacker, target);
    } else {
      // skill_damage（Phase 1 不走这里，保留接口）
      result = { finalDmg: this._skill_damage(attacker, target, skill), isMiss: false, isCrit: false, isArmorBroken: false };
    }
    const { finalDmg, isCrit, isArmorBroken } = result;

    // 2. shieldRate 减伤（守方）
    let actualDmg = finalDmg;
    let isShielded = false;
    if (random() < (target.shieldRate ?? 0)) {
      actualDmg = Math.floor(finalDmg * (1 - this._cc.shieldDamageReduceRate));
      isShielded = true;
    }

    // 3. leech（攻方）
    let isLeech = false;
    const leechChance = attacker.leech ?? 0;
    if (leechChance > 0 && random() < leechChance) {
      const healAmt = Math.floor(actualDmg * this._cc.leechRate);
      attacker.hp = Math.min(attacker.hp + healAmt, attacker.maxHp);
      isLeech = true;
    }

    // 4. counterDamage（守方反击给攻方）
    let isCountered = false;
    if (random() < (target.counterDamage ?? 0)) {
      const reflected = Math.floor(actualDmg * this._cc.counterDamageRate);
      attacker.hp = Math.max(0, attacker.hp - reflected);
      isCountered = true;
    }

    return { isMiss: false, finalDmg, actualDmg, isCrit, isShielded, isLeech, isCountered, isArmorBroken };
  }

  /**
   * 技能伤害（Phase 1 预留）
   * @ref 06_battle.damage_formulas.skill_damage
   */
  _skill_damage(attacker, target, skill) {
    const atk = attacker._isPlayer
      ? randInt(attacker.atkMin, attacker.atkMax)
      : attacker.atk;

    let effectiveDef = target.def || 0;
    let effectiveMdef = target.mdef || 0;
    if (random() < (attacker.armorBreak ?? 0)) {
      effectiveDef = target.def * (1 - this._cc.armorBreakDefReduce);
      effectiveMdef = target.mdef * (1 - this._cc.armorBreakDefReduce);
    }

    const basePart = Math.max(1, atk - effectiveDef) * 1.5;
    const matkPart = (attacker.matk || 0) * (1 + (attacker.weaponSkillBonus || 0) / 100);
    const weaponBonus = (skill?.effect?.value || 0) + (attacker.weaponExtraDamage || 0);
    let skillDmg = basePart + matkPart + weaponBonus;
    skillDmg *= (100 / (100 + effectiveMdef));

    if (random() < (attacker.skillCritRate ?? 0)) {
      skillDmg *= (1 + this._cc.skillCritDamageBonus);
    }

    return Math.max(1, Math.floor(skillDmg));
  }
}
