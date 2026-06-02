/**
 * @file entities/Monster.js
 * @desc 怪物实体
 * @ref 07_monsters.monster_template
 */
export class Monster {
  /**
   * @param {Object} template 怪物配置对象
   * @param {number} template.hp 最大生命（也是当前 hp 初始值）
   */
  constructor(template) {
    this.key = template.key;
    this.name = template.name;
    this.level = template.level ?? 1;
    this.exp = template.exp ?? 0;
    this.hp = template.hp ?? 0;
    this.maxHp = template.hp ?? 0;
    this.atk = template.atk ?? 0;
    this.def = template.def ?? 0;
    this.mdef = 0; // v1.0 怪物无武功，mdef=0

    // 命中/闪避
    this.hit = template.hit ?? (3 * this.level);
    this.missing = template.missing ?? Math.round(0.3 * this.level * 10) / 10;

    // 暴击 fallback：critR=0.25, critB=1.5
    this.critR = template.critR ?? 0.25;
    this.critB = template.critB ?? 1.5;

    // 战斗扩展属性 fallback 全 0
    this.armorBreak = template.armorBreak ?? 0;
    this.shieldRate = template.shieldRate ?? 0;
    this.counterDamage = template.counterDamage ?? 0;
    this.leech = template.leech ?? 0;

    this.monster_type = template.monster_type ?? 'normal';
    this.skills = template.skills || [];
    this.drop_items = template.drop_items || [];

    // map_key（战斗系统在 spawn 时注入）
    this.map_key = null;

    // 预热计时（毫秒）
    this.preheatMs = 2000; // preheat_seconds = 2
    this.preheatRemaining = this.preheatMs;
    this._isAlive = true;

    // 独立攻击 cd（毫秒）
    this._atkCdRemaining = 0;
    this._atkIntervalMs = 1000; // atk_interval_ms = 1000
  }

  /** 是否还活着 */
  isAlive() {
    return this._isAlive && this.hp > 0;
  }

  /**
   * 每 tick 更新预热计时 / 攻击 cd
   * @param {number} deltaMs 流逝的毫秒数
   */
  tickUpdate(deltaMs) {
    if (!this.isAlive()) return;
    if (this.preheatRemaining > 0) {
      this.preheatRemaining -= deltaMs;
      if (this.preheatRemaining < 0) this.preheatRemaining = 0;
    }
    if (this._atkCdRemaining > 0) {
      this._atkCdRemaining -= deltaMs;
      if (this._atkCdRemaining < 0) this._atkCdRemaining = 0;
    }
  }

  /** 是否预热完毕（可攻击） */
  isReadyToAttack() {
    return this.isAlive() && this.preheatRemaining <= 0;
  }

  /** 是否攻击 cd 到了 */
  isAtkCdReady() {
    return this.isAlive() && this._atkCdRemaining <= 0 && this.isReadyToAttack();
  }

  /** 触发攻击，重置 cd */
  triggerAttack() {
    this._atkCdRemaining = this._atkIntervalMs;
  }

  /** 扣血（返回是否死亡） */
  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) {
      this._isAlive = false;
      return true;
    }
    return false;
  }
}