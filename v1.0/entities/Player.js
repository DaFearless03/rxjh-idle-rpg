/**
 * @file entities/Player.js
 * @desc 玩家实体（L1 刀客 warrior_blade）
 * @ref 02_attributes.base_attributes / 03_careers.warrior_blade
 */
import { AttributeSystem } from '../systems/AttributeSystem.js?v=release-20260611-2';

export class Player {
  /**
   * @param {Object} opts
   * @param {Object} opts.careerData warrior_blade 职业配置
   * @param {Object} opts.attributeConstants attribute_constants
   * @param {number} [opts.level=1]
   */
  constructor(opts) {
    const cd = opts.careerData;
    const level = opts.level ?? 1;

    // 四维初始值（来自 base_stats）
    this.str = cd.base_stats.str;
    this.dex = cd.base_stats.dex;
    this.int = cd.base_stats.int;
    this.sta = cd.base_stats.sta;

    // 职业化基础值（用于派生公式）
    this.baseHp = cd.base_stats.baseHp;
    this.baseMp = cd.base_stats.baseMp;

    // 成长值（每级加成）
    this.hpGrowth = cd.attrGrow.hpGrowth;
    this.mpGrowth = cd.attrGrow.mpGrowth;

    // 等级
    this.level = level;
    this.exp = 0;

    // 生命 / 内功
    this.maxHp = 0;
    this.maxMp = 0;
    this.hp = 0;
    this.mp = 0;

    // 职业标识
    this.career = cd.key;
    this.career_family = cd.career_family;

    // 派系（neutral / positive / negative）
    this.faction = 'neutral';

    // 职业历史（转职记录）
    this.career_history = [cd.key];

    // 装备槽位（13.1 schema：ring/earring 支持双槽）
    this.equipped = {
      weapon: null,
      chest: null,
      gloves: [null, null],
      boots: null,
      inner_armor: null,
      ring: [null, null],
      amulet: null,
      earring: [null, null],
      cape: null
    };

    // 背包（Phase 1 空 placeholder）
    this.inventory = {
      capacity: 50,
      slots: [],
      equipment_instances: {}
    };

    // 仓库
    this.warehouse = {
      capacity: 50,
      slots: [],
      equipment_instances: {}
    };

    // 资源（13.1 save_data_structure）
    // 新角色契约：起始 100 金币，v1.0 不赠送初始装备。
    this.resources = { gold: 100, training: 0, merit: 0 };

    // 任务（已接取 / 已完成）
    this.quests = { accepted: [], completed: [] };

    // Buff 列表
    this.buffs = [];

    // 已学武功列表
    this.learned_martial_arts = [];

    // 气功（Phase 3：invested 加点 / attribute_reset_count）
    this.qigong = { invested: {}, attribute_reset_count: 0 };

    // 隐藏战斗属性 base_value
    this._baseCritR = 0.30;
    this._baseCritB = 1.5;
    this._baseSkillCritRate = 0;
    this._baseCombo = 0;
    this._baseShieldRate = 0;
    this._baseCounterDamage = 0;
    this._baseArmorBreak = 0;
    this._baseLeech = 0;
    this._baseHpRecovery = 1;
    this._baseMpRecovery = 1;
    this._baseHealBonus = 0;
    this._baseMpCostReduce = 0;
    this._baseBuffDuration = 0;
    this._baseMpRecoveryBonus = 0;
    this._baseMf = 0;
    this._baseGf = 0;
    this._baseWeaponSkillBonus = 0;
    this._baseWeaponExtraDamage = 0;
    this._baseEnhanceSuccessRate = 0;
    this._baseGoldDropBonus = 0;

    // 钩子累加器
    this._hooks = {};

    // 战斗属性占位（recompute 后填充）
    this.atkMin = 0;
    this.atkMax = 0;
    this.def = 0;
    this.matk = 0;
    this.mdef = 0;
    this.hit = 0;
    this.missing = 0;
    this.critR = 0.30;
    this.critB = 1.5;
    this.skillCritRate = 0;
    this.combo = 0;
    this.shieldRate = 0;
    this.counterDamage = 0;
    this.armorBreak = 0;
    this.leech = 0;
    this.hpRecovery = 1;
    this.mpRecovery = 1;
    this.healBonus = 0;
    this.mpCostReduce = 0;
    this.buffDuration = 0;
    this.mpRecoveryBonus = 0;
    this.mf = 0;
    this.gf = 0;
    this.weaponSkillBonus = 0;
    this.weaponExtraDamage = 0;
    this.enhanceSuccessRate = 0;
    this.goldDropBonus = 0;

    // 是否玩家标记（DamageSystem 分支用）
    this._isPlayer = true;

    // 初始重算
    const attrSys = new AttributeSystem({ attributeConstants: opts.attributeConstants });
    attrSys.recompute(this);
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }
}
