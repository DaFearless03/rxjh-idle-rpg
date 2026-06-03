/**
 * @file systems/BattleSystem.js
 * @desc 1vN 战斗系统：刷怪 / target_lock / 普攻结算 / 死亡判定
 * @ref 06_battle.battle_flow / 06_battle.battle_loop
 */
import { eventBus } from '../core/EventBus.js';
import { Monster } from '../entities/Monster.js';
import { DamageSystem } from './DamageSystem.js';
import { grantExp, onLevelUp, applyDeathExpLoss } from '../utils/formulas.js';

export class BattleSystem {
  /**
   * @param {Object} opts
   * @param {Object} opts.config 全局配置（含 battle_flow / combat_constants / exp_to_next_level / attribute_points / current_level_cap）
   * @param {Object} opts.player Player 实体
   * @param {Object[]} opts.monstersData 怪物配置列表
   * @param {Function} opts.attrSystemRef AttributeSystem 实例引用（用于 on_level_up recompute）
   */
  constructor(opts) {
    this._config = opts.config;
    this._player = opts.player;
    this._monstersData = opts.monstersData;
    this._attrSys = opts.attrSystemRef;
    this._dropSys = opts.dropSystemRef || null;
    this._subZonesData = opts.subZonesData || [];
    this._subZoneDropsData = opts.subZoneDropsData || [];
    this._currentSubZone = opts.currentSubZone || null;
    this._buffSys = opts.buffSystemRef || null;

    this._quiet = true;  // 战斗日志开关

    this._damageSys = new DamageSystem({ combatConstants: opts.config.combat_constants });

    /** @type {Monster[]} 当前场上怪物 */
    this.monsters = [];

    /** 主目标 key */
    this._mainTargetKey = null;

    /** 刷怪计时（毫秒） */
    this._spawnTimerMs = 0;
    this._spawnIntervalMs = (opts.config.battle_flow.battle_model.monster_spawn.spawn_interval_seconds || 1) * 1000;

    /** 初始刷怪已完成 */
    this._initialSpawned = false;

    /** 每秒输出缓冲 */
    this._eventLog = [];
    this._statusLog = '';

    this._onPlayerDeathLog = () => {
      if (!this._quiet) console.log('[系统] 玩家死亡惩罚已结算，等待复活...');
    };
    eventBus.on('player.death', this._onPlayerDeathLog);
  }

  destroy() {
    if (this._onPlayerDeathLog) {
      eventBus.off('player.death', this._onPlayerDeathLog);
      this._onPlayerDeathLog = null;
    }
  }

  // ========================
  // 怪物管理
  // ========================

  /** 按权重抽一只怪物 */
  _pickRandomMonster() {
    if (!this._currentSubZone) return null;
    const zoneMonsterKeys = this._currentSubZone?.monsters || [];
    if (zoneMonsterKeys.length === 0) return null;
    const candidates = this._monstersData.filter(m => zoneMonsterKeys.includes(m.key));
    const normalMonsters = candidates.filter(m => m.monster_type === 'normal');
    if (normalMonsters.length === 0) return null;
    const idx = Math.floor(Math.random() * normalMonsters.length);
    return normalMonsters[idx];
  }

  /** 尝试生成一只怪物 */
  _trySpawn() {
    const cap = this._config.battle_flow.battle_model.monster_spawn.same_zone_monster_cap ?? 8;
    if (this.monsters.length >= cap) return;

    const template = this._pickRandomMonster();
    if (!template) return;

    const monster = new Monster(template);
    // 注入 map_key（用于掉落判定）
    monster.map_key = this._currentSubZone?.parent_map_key || this._currentSubZone?.key || null;
    this.monsters.push(monster);
    this._pushEvent(`[刷怪] ${monster.name} 出现（预热2秒）`);
  }

  /** 初始刷怪 */
  _doInitialSpawn() {
    const count = this._config.battle_flow.battle_model.monster_spawn.initial_spawn_count ?? 1;
    for (let i = 0; i < count; i++) {
      const template = this._pickRandomMonster();
      if (template) {
        const monster = new Monster(template);
        monster.map_key = this._currentSubZone?.parent_map_key || this._currentSubZone?.key || null;
        this.monsters.push(monster);
      }
    }
    this._initialSpawned = true;
    this._pushEvent(`[战场] Lv${this._player.level} ${this._player.career} 进入测试zone，${this.monsters.length} 只怪物等待中`);
  }

  // ========================
  // 目标锁定（lowest_hp_enemy, sticky_until_dead）
  // ========================

  _lockMainTarget() {
    const alive = this.monsters.filter(m => m.isAlive());
    if (alive.length === 0) {
      this._mainTargetKey = null;
      return null;
    }
    // sticky：活着不切
    if (this._mainTargetKey) {
      const current = alive.find(m => m.key === this._mainTargetKey);
      if (current) return current;
    }
    // 选血最少的
    const lowest = alive.reduce((a, b) => a.hp <= b.hp ? a : b);
    this._mainTargetKey = lowest.key;
    return lowest;
  }

  // ========================
  // 玩家攻击（普攻，不释放武功）
  // ========================

  _playerAttack() {
    const target = this._lockMainTarget();
    if (!target || !target.isAlive()) return;

    const result = this._damageSys.attack_resolution_pipeline(this._player, target, 'normal', null);

    if (result.isMiss) {
      this._pushEvent(`[普攻] 玩家 → ${target.name} MISS`);
      eventBus.emit('battle.player_miss', { target: target.name });
    } else {
      let parts = [`[普攻] 玩家 → ${target.name} 伤害 ${result.actualDmg}`];
      if (result.isCrit) parts.push('暴击');
      if (result.isArmorBroken) parts.push('破甲');
      if (result.isShielded) parts.push('护身');
      if (result.isCountered) parts.push(`反伤(${result.actualDmg})`);
      if (result.isLeech) parts.push('汲取');
      this._pushEvent(parts.join(' '));
      eventBus.emit('battle.player_hit', { target: target.name, damage: result.actualDmg, crit_suffix: result.isCrit ? ' (暴击!)' : '' });

      if (result.isLeech) eventBus.emit('battle.leech', { target: target.name, damage: result.actualDmg, heal: Math.floor(result.actualDmg * 0.3) });
      if (result.isArmorBroken) eventBus.emit('battle.armor_break', { target: target.name, damage: result.actualDmg });

      const dead = target.takeDamage(result.actualDmg);
      if (dead) {
        this._onMonsterDead(target);
      }
    }
  }

  // ========================
  // 怪物攻击
  // ========================

  _monsterAttacks(deltaMs) {
    for (const monster of this.monsters) {
      if (!monster.isAlive()) continue;
      monster.tickUpdate(deltaMs);

      if (!monster.isReadyToAttack()) continue;
      if (monster._atkCdRemaining > 0) continue;

      // 攻击玩家
      monster.triggerAttack();
      const result = this._damageSys.attack_resolution_pipeline(monster, this._player, 'normal', null);

      if (result.isMiss) {
        this._pushEvent(`[普攻] ${monster.name} → 玩家 MISS`);
        eventBus.emit('battle.monster_miss', { attacker: monster.name });
      } else {
        let parts = [`[普攻] ${monster.name} → 玩家 伤害 ${result.actualDmg}`];
        if (result.isCrit) parts.push('暴击');
        if (result.isShielded) parts.push('护身');
        if (result.isCountered) parts.push(`反伤(${result.actualDmg})`);
        if (result.isLeech) parts.push('汲取');
        this._pushEvent(parts.join(' '));
        eventBus.emit('battle.monster_hit', { attacker: monster.name, damage: result.actualDmg, shield_suffix: result.isShielded ? ' (护身)' : '' });
        if (result.isCountered) eventBus.emit('battle.counter', { attacker: monster.name, damage: result.actualDmg, reflected: result.actualDmg });

        this._player.hp = Math.max(0, this._player.hp - result.actualDmg);
        if (this._player.hp <= 0) {
          this._onPlayerDeath();
          return;
        }
      }
    }
  }

  // ========================
  // 死亡处理
  // ========================

  _onMonsterDead(monster) {
    this._pushEvent(`[击杀] ${monster.name} 倒下，经验 +${monster.exp}`);
    // 移除
    this.monsters = this.monsters.filter(m => m.key !== monster.key);
    // 重置目标锁
    if (this._mainTargetKey === monster.key) {
      this._mainTargetKey = null;
    }
    // grant_exp（含跨级判断）
    grantExp(
      this._player,
      monster.exp,
      {
        exp_to_next_level: this._config.exp_to_next_level,
        current_level_cap: this._config.current_level_cap,
        attribute_points: this._config.attribute_points
      },
      (player, fromLevel, toLevel) => {
        onLevelUp(
          player,
          fromLevel,
          toLevel,
          {
            attribute_points: this._config.attribute_points
          },
          (p) => this._attrSys.recompute(p)
        );
        const gainedPoints = this._config.attribute_points.gain_per_level[toLevel] ?? 1;
        eventBus.emit('player.level_up', { from_level: fromLevel, to_level: toLevel, gained_points: gainedPoints });
        this._pushEvent(`[升级] Lv${fromLevel} → Lv${toLevel}，HP/MP 回满，气功点 +${gainedPoints}`);
      }
    );

    // 触发掉落（Phase 2）
    if (this._dropSys) {
      // 找到当前 sub_zone 的掉落配置
      const subZoneDrop = this._subZoneDropsData.find(drop => drop.sub_zone_key === this._currentSubZone?.key);
      this._dropSys.evaluate(this._player, monster, subZoneDrop || null);
    } else {
      // 无 DropSystem 时直接给少量金币（Phase 1 兼容）
      this._player.resources = this._player.resources || { gold: 0, training: 0, merit: 0 };
      this._player.resources.gold += 5;
    }

    eventBus.emit('monster.death', { monsterKey: monster.key, exp: monster.exp });
  }

  _onPlayerDeath() {
    applyDeathExpLoss(this._player, { exp_to_next_level: this._config.exp_to_next_level });
    this._pushEvent(`[死亡] 玩家倒下，损失经验 ${Math.floor(this._config.exp_to_next_level[this._player.level] * 0.01)}`);

    this._player.location = this._player.location || {};
    if (this._player.location.current_sub_zone_key) {
      this._player.location.last_wilderness_sub_zone = this._player.location.current_sub_zone_key;
    }
    this._player.location.current_map_key = 'town_xuanbo';
    this._player.location.current_sub_zone_key = null;
    this._player.hp = this._player.maxHp;
    this._player.mp = this._player.maxMp;
    if (this._player.auto_play) {
      this._player.auto_play.is_auto_play = false;
    }
    this._player.statistics = this._player.statistics || {};
    this._player.statistics.total_deaths = (this._player.statistics.total_deaths || 0) + 1;
    this._clearCombatField();
    this._currentSubZone = null;

    eventBus.emit('player.death', { reason: 'death' });
  }

  // ========================
  // 每 tick 更新
  // ========================

  /**
   * 主 tick（100ms）
   * @param {number} tickCount
   * @param {number} deltaMs 实际上一次调用到现在经过的毫秒（近似 tickMs）
   */
  tick(deltaMs) {
    if (!this._currentSubZone) {
      this._clearCombatField();
      if (this._buffSys) {
        this._buffSys.tick(this._player, deltaMs);
      }
      return;
    }

    // 初始刷怪
    if (!this._initialSpawned) {
      this._doInitialSpawn();
    }

    // 刷怪计时
    this._spawnTimerMs += deltaMs;
    if (this._spawnTimerMs >= this._spawnIntervalMs) {
      this._spawnTimerMs -= this._spawnIntervalMs;
      this._trySpawn();
    }

    // 玩家攻击（每 tick 都尝试普攻；实际上应该有个独立计时器，Phase 1 简化每 1s 一次）
    // Phase 1: 每 1000ms 玩家普攻一次
    this._playerAtkCd = (this._playerAtkCd || 0) + deltaMs;
    if (this._playerAtkCd >= 1000) {
      this._playerAtkCd = 0;
      this._playerAttack();
    }

    // 怪物攻击（独立 cd）
    this._monsterAttacks(deltaMs);

    // Buff tick（DOT/HOT/过期）
    if (this._buffSys) {
      this._buffSys.tick(this._player, deltaMs);
    }

    // 每秒 console.log 状态
    this._statusTimer = (this._statusTimer || 0) + deltaMs;
    if (this._statusTimer >= 1000) {
      this._statusTimer = 0;
      this._printStatus();
    }
  }

  _clearCombatField() {
    if (this.monsters.length > 0) {
      this.monsters = [];
    }
    this._mainTargetKey = null;
    this._spawnTimerMs = 0;
    this._playerAtkCd = 0;
    this._initialSpawned = false;
  }

  _printStatus() {
    if (this._quiet) return;
    const p = this._player;
    const recent = this._eventLog.slice(-5);
    console.log(`--- Lv${p.level} ${p.career} | HP ${p.hp}/${p.maxHp} | MP ${p.mp}/${p.maxMp} | EXP ${p.exp}/${(this._config.exp_to_next_level[p.level] || 'MAX')} | 气功点 ${p.qigong.available_points} | 场上怪物 ${this.monsters.length} ---`);
    if (recent.length > 0) {
      for (const e of recent) console.log('  ' + e);
    }
  }

  _pushEvent(msg) {
    this._eventLog.push(msg);
    if (this._eventLog.length > 100) this._eventLog.shift();
    if (!this._quiet) console.log(msg);
  }

  /** 获取当前状态摘要（main.js 用） */
  getStatus() {
    const p = this._player;
    return {
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
      mp: p.mp,
      maxMp: p.maxMp,
      exp: p.exp,
      expToNext: this._config.exp_to_next_level[p.level] ?? 0,
      qigongPoints: p.qigong.available_points,
      monsterCount: this.monsters.length,
      recentEvents: this._eventLog.slice(-5)
    };
  }
}
