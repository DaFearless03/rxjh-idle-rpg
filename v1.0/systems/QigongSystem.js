/**
 * @file systems/QigongSystem.js
 * @desc 气功系统：投点 / 重置 / 装备热血石加成
 * @ref 04_skills_qigong_buff 4.2 气功系统
 */
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

export const QigongSystem = {
  _qigongTemplates: [],

  /**
   * effect type → 人类可读标签
   */
  EFFECT_LABELS: {
    atkMin: '最小攻击力', atkMax: '最大攻击力', def: '防御力',
    maxHp: '生命值', maxMp: '内功值', mdef: '武功防御力',
    missing: '闪避', hit: '命中',
    weaponSkillBonus: '武功攻击力', critR: '暴击率', critB: '暴击伤害',
    hpRecovery: '生命恢复', mpRecovery: '内功恢复',
    leech: '吸取生命', combo: '连击几率', shieldRate: '护身几率',
    counterDamage: '反伤几率', armorBreak: '破甲几率',
    skillCritRate: '真武绝击几率', healBonus: '治疗加成',
    mpCostReduce: '内功消耗减少', mpRecoveryBonus: '内功恢复加成',
    buffDuration: 'Buff 持续时间', mf: '制造几率', gf: '制造加成',
    atkMinPct: '最小攻击力', atkMaxPct: '最大攻击力',
    hitPct: '命中率', missingPct: '闪避率',
    maxHpPct: '生命值', maxMpPct: '内功值',
  },

  /**
   * effect type → 描述前缀
   */
  EFFECT_DESC: {
    atkMin: '增加最小攻击力', atkMax: '增加最大攻击力', def: '增加防御力',
    maxHp: '增加生命值', maxMp: '增加内功值', mdef: '增加武功防御力',
    missing: '增加闪避', hit: '增加命中',
    weaponSkillBonus: '增加武功攻击力', critR: '增加暴击率', critB: '增加暴击伤害',
    hpRecovery: '增加生命恢复', mpRecovery: '增加内功恢复',
    leech: '攻击时吸取生命', combo: '增加连击几率', shieldRate: '增加护身几率',
    counterDamage: '受到攻击时反伤', armorBreak: '增加破甲几率',
    skillCritRate: '增加真武绝击几率', healBonus: '增加治疗加成',
    mpCostReduce: '减少内功消耗', mpRecoveryBonus: '增加内功恢复加成',
    buffDuration: '增加 Buff 持续时间', mf: '增加制造几率', gf: '增加制造加成',
    atkMinPct: '增加最小攻击力', atkMaxPct: '增加最大攻击力',
    hitPct: '增加命中率', missingPct: '增加闪避率',
    maxHpPct: '增加生命值', maxMpPct: '增加内功值',
  },

  /**
   * 注册气功模板（main.js 加载后调用）
   */
  setTemplates(qigongsData) {
    this._qigongTemplates = qigongsData;
  },

  /**
   * 计算玩家 transfer_count
   */
  _getTransferCount(player) {
    return [player?.career, ...(Array.isArray(player?.career_history) ? player.career_history : [])]
      .reduce((maxTransfer, career) => {
        const match = String(career || '').match(/_transfer_(\d+)/);
        return Math.max(maxTransfer, match ? Number(match[1]) : 0);
      }, 0);
  },

  _getCareerFamily(player) {
    const family = player?.career_family;
    if (['blade', 'sword', 'spear', 'staff'].includes(family)) return family;

    const career = player?.career || '';
    if (career.startsWith('warrior_blade')) return 'blade';
    if (career.startsWith('warrior_sword')) return 'sword';
    if (career.startsWith('warrior_spear')) return 'spear';
    if (career.startsWith('healer')) return 'staff';
    return family || '';
  },

  /**
   * 计算玩家气功点上限（历史累计）
   */
  calcMaxPoints(player) {
    const initial = 1;
    let gained = 0;
    for (let lv = 2; lv <= player.level; lv++) {
      gained += lv < 35 ? 1 : 2;
    }
    return initial + gained;
  },

  /**
   * 获取玩家可用气功点（累计 - 已投）
   */
  getAvailablePoints(player) {
    this._ensureQigongState(player);
    return player.qigong.available_points;
  },

  /**
   * 获取玩家当前可学气功列表（过滤转职/等级）
   */
  listAvailableQigongs(player) {
    const transferCount = this._getTransferCount(player);
    const careerFamily = this._getCareerFamily(player);

    return this._qigongTemplates.filter(q => {
      // 职业系过滤
      const cf = Array.isArray(q.career_family) ? q.career_family : [q.career_family];
      if (!cf.includes(careerFamily)) return false;
      // 解锁条件
      if (transferCount < q.unlock.min_transfer) return false;
      if (player.level < q.unlock.min_level) return false;
      return true;
    }).map(q => {
      const invested = player.qigong?.invested?.[q.key] || 0;
      const effectiveLevel = this._calcEffectiveLevel(player, q);
      const effectType = q.effect.type;
      const current = this._calcEffectValue(q, effectiveLevel);
      const next = this._calcEffectValue(q, Math.min(q.max_level, effectiveLevel + 1));
      const isPct = effectType.endsWith('Pct') || ['critR','critB','combo','shieldRate','counterDamage',
        'armorBreak','skillCritRate','healBonus','mpCostReduce','mpRecoveryBonus','leech',
        'mf','gf'].includes(effectType);
      const fmtFn = (v) => isPct ? Math.round(v * 100) + '%' : Math.round(v).toString();
      return {
        key: q.key,
        name: q.name,
        description: this.EFFECT_DESC[effectType] || (q.description || effectType),
        invested,
        effectiveLevel,
        max_level: q.max_level,
        effect_type: effectType,
        currentValue: fmtFn(current),
        nextValue: fmtFn(next),
      };
    });
  },

  /**
   * 获取玩家职业系的所有气功（含未解锁的）
   * 用于展示锁定态气功卡
   */
  listAllCareerQigongs(player) {
    const transferCount = this._getTransferCount(player);
    const careerFamily = this._getCareerFamily(player);

    return this._qigongTemplates.filter(q => {
      const cf = Array.isArray(q.career_family) ? q.career_family : [q.career_family];
      return cf.includes(careerFamily);
    }).sort((a, b) => {
      // unlocked first, then by level requirement
      const aLocked = transferCount < a.unlock.min_transfer || player.level < a.unlock.min_level;
      const bLocked = transferCount < b.unlock.min_transfer || player.level < b.unlock.min_level;
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a.unlock.min_level - b.unlock.min_level;
    }).map(q => {
      const invested = player.qigong?.invested?.[q.key] || 0;
      const effectiveLevel = this._calcEffectiveLevel(player, q);
      const unlocked = transferCount >= q.unlock.min_transfer && player.level >= q.unlock.min_level;
      const lockParts = [];
      if (player.level < q.unlock.min_level) lockParts.push('Lv.' + q.unlock.min_level);
      if (transferCount < q.unlock.min_transfer) lockParts.push(q.unlock.min_transfer + ' 转');
      const lockText = lockParts.length ? '需 ' + lockParts.join(' · ') + ' 解锁' : '';
      const effectType = q.effect.type;
      const current = this._calcEffectValue(q, effectiveLevel);
      const isPct = effectType.endsWith('Pct') || ['critR','critB','combo','shieldRate','counterDamage',
        'armorBreak','skillCritRate','healBonus','mpCostReduce','mpRecoveryBonus','leech',
        'mf','gf'].includes(effectType);
      const fmtFn = (v) => isPct ? Math.round(v * 100) + '%' : Math.round(v).toString();
      return {
        key: q.key,
        name: q.name,
        description: this.EFFECT_DESC[effectType] || (q.description || effectType),
        invested,
        effectiveLevel,
        unlocked,
        lockText,
        max_level: q.max_level,
        effect_type: effectType,
        currentValue: fmtFn(current),
      };
    });
  },

  /**
   * 投点
   * @param {Object} player
   * @param {string} qigongKey
   * @param {number} points
   * @returns {{ success: boolean, message: string }}
   */
  investQigong(player, qigongKey, points) {
    this._ensureQigongState(player);

    const qigong = this._qigongTemplates.find(q => q.key === qigongKey);
    if (!qigong) return { success: false, message: `气功 ${qigongKey} 不存在` };

    const requestedPoints = Number(points);
    if (!Number.isSafeInteger(requestedPoints) || requestedPoints <= 0) {
      return { success: false, message: '投入点数必须是正整数' };
    }

    const families = Array.isArray(qigong.career_family) ? qigong.career_family : [qigong.career_family];
    if (!families.includes(this._getCareerFamily(player))) {
      return { success: false, message: '该气功不属于当前职业' };
    }
    if (this._getTransferCount(player) < (qigong.unlock?.min_transfer || 0)
      || (player.level || 1) < (qigong.unlock?.min_level || 1)) {
      return { success: false, message: '该气功尚未解锁' };
    }

    const current = player.qigong.invested[qigongKey] || 0;
    const available = this.getAvailablePoints(player);
    const canAdd = Math.min(requestedPoints, available, qigong.max_level - current);
    if (canAdd <= 0) {
      return { success: false, message: `气功点不足或已达上限` };
    }

    player.qigong.invested[qigongKey] = current + canAdd;
    player.qigong.available_points -= canAdd;
    console.log(`[气功] 投入 ${canAdd} 点到 ${qigong.name}（共 ${player.qigong.invested[qigongKey]} 点）`);

    eventBus.emit('qigong.invested', { qigongKey, points: canAdd });
    return { success: true, message: `投入 ${canAdd} 点` };
  },

  /**
   * 重置气功
   * @param {Object} player
   * @returns {{ success: boolean, message: string }}
   */
  resetQigong(player) {
    this._ensureQigongState(player);
    const count = player.qigong.attribute_reset_count;
    const cost = Math.floor(10000 * Math.pow(10, count));
    if (!Number.isSafeInteger(cost) || cost <= 0) {
      return { success: false, message: '已达到气功重置次数上限' };
    }

    const gold = Number(player.resources?.gold);
    if (!Number.isSafeInteger(gold) || gold < 0) {
      return { success: false, message: '玩家金币数据异常' };
    }
    if (gold < cost) {
      return { success: false, message: `重置需要 ${cost} 金币` };
    }

    const refunded = Object.values(player.qigong?.invested || {}).reduce((s, v) => s + v, 0);
    if (!Number.isSafeInteger(refunded)
      || refunded < 0
      || refunded > Number.MAX_SAFE_INTEGER - player.qigong.available_points) {
      return { success: false, message: '气功点数据异常' };
    }
    player.resources.gold -= cost;
    eventBus.emit('resources.changed', { player, resource: 'gold', amount: cost, action: 'remove' });
    player.qigong.invested = {};
    player.qigong.available_points += refunded;
    player.qigong.attribute_reset_count = (player.qigong.attribute_reset_count || 0) + 1;

    console.log(`[气功] 重置完成，返还 ${refunded} 点，花费 ${cost} 金币`);
    return { success: true, message: `重置成功，返还 ${refunded} 点` };
  },

  /**
   * 聚合气功加成到 player._hooks
   * 由 AttributeSystem.recompute 调用
   * @param {Object} player
   * @param {Object} h 钩子对象（会被修改）
   */
  collectQigongHooks(player, h) {
    const invested = player.qigong?.invested || {};
    const transferCount = this._getTransferCount(player);
    const careerFamily = this._getCareerFamily(player);

    for (const [key, points] of Object.entries(invested)) {
      if (points <= 0) continue;
      const qigong = this._qigongTemplates.find(q => q.key === key);
      if (!qigong) continue;
      const families = Array.isArray(qigong.career_family) ? qigong.career_family : [qigong.career_family];
      if (!families.includes(careerFamily)
        || transferCount < (qigong.unlock?.min_transfer || 0)
        || (player.level || 1) < (qigong.unlock?.min_level || 1)) continue;

      const effectType = qigong.effect.type;
      const totalValue = this._calcEffectValue(qigong, this._calcEffectiveLevel(player, qigong));

      // 百分比类 → xxxPct 钩子；数值类 → xxxAdd 钩子
      if (effectType.endsWith('Pct')) {
        h[effectType] = (h[effectType] || 0) + totalValue;
      } else {
        h[effectType + 'Add'] = (h[effectType + 'Add'] || 0) + totalValue;
      }
    }
  },

  bindSkillLevelStone(player, stoneKey, random = Math.random) {
    const parsed = this._parseSkillLevelStone(stoneKey);
    if (!parsed || parsed.targetKey) return stoneKey;
    const targetKey = this._selectSkillLevelTarget(player, random);
    return targetKey ? `${stoneKey}--${targetKey}` : stoneKey;
  },

  _calcEffectValue(qigong, points) {
    if (points <= 0) return 0;
    return qigong.effect.base_value + points * qigong.effect.value_per_level;
  },

  _calcEffectiveLevel(player, qigong) {
    let level = player.qigong?.invested?.[qigong.key] || 0;
    if (level <= 0) return 0;

    const instances = player.inventory?.equipment_instances || {};
    const templates = player._equipTemplates || [];
    const seenInstances = new Set();
    for (const [slot, equippedValue] of Object.entries(player.equipped || {})) {
      const entries = Array.isArray(equippedValue) ? equippedValue : [equippedValue];
      for (const entry of entries) {
        const instanceId = typeof entry === 'string' ? entry : entry?.instance_id;
        if (!instanceId || seenInstances.has(instanceId)) continue;
        seenInstances.add(instanceId);
        const instance = instances[instanceId];
        if (!instance) continue;
        const template = templates.find(item => item.key === instance.item_key);
        if (!template || template.slot !== slot) continue;
        const equipmentBonus = Number(template?.base_stats?.qigong);
        if (Number.isFinite(equipmentBonus) && equipmentBonus > 0) {
          level += Math.floor(equipmentBonus);
        }
        for (const stoneKey of Array.isArray(instance.synthesis_slots) ? instance.synthesis_slots : []) {
          if (typeof stoneKey !== 'string' || !stoneKey) continue;
          const parsed = this._parseSkillLevelStone(stoneKey);
          if (!parsed) continue;
          const targetKey = parsed.targetKey || this._selectSkillLevelTarget(player, () => 0);
          if (targetKey === qigong.key) level += parsed.value;
        }
      }
    }
    return Math.min(level, qigong.max_level);
  },

  _parseSkillLevelStone(stoneKey) {
    const [baseKey, hook, rawValue, targetKey = null] = String(stoneKey || '').split('--');
    const value = Math.max(0, Math.floor(Number(rawValue) || 0));
    if (!baseKey.startsWith('hot_blood') || hook !== 'skill_level_up' || value <= 0) return null;
    return { value, targetKey };
  },

  _selectSkillLevelTarget(player, random = Math.random) {
    const family = this._getCareerFamily(player);
    const careerQigongs = this._qigongTemplates.filter(qigong => {
      const families = Array.isArray(qigong.career_family) ? qigong.career_family : [qigong.career_family];
      return families.includes(family);
    });
    const invested = careerQigongs.filter(qigong => (player.qigong?.invested?.[qigong.key] || 0) > 0);
    const candidates = invested.length > 0 ? invested : careerQigongs;
    if (candidates.length === 0) return null;
    const sampled = Number(random());
    const roll = Number.isFinite(sampled) ? Math.max(0, Math.min(1 - Number.EPSILON, sampled)) : 0;
    const index = Math.floor(roll * candidates.length);
    return candidates[index].key;
  },

  _ensureQigongState(player) {
    player.qigong = player.qigong || {};
    player.qigong.invested = player.qigong.invested && typeof player.qigong.invested === 'object'
      && !Array.isArray(player.qigong.invested) ? player.qigong.invested : {};
    for (const [key, value] of Object.entries(player.qigong.invested)) {
      const points = Number(value);
      if (!Number.isSafeInteger(points) || points <= 0) delete player.qigong.invested[key];
      else player.qigong.invested[key] = points;
    }
    const resetCount = Number(player.qigong.attribute_reset_count);
    player.qigong.attribute_reset_count = Number.isSafeInteger(resetCount) && resetCount >= 0 ? resetCount : 0;

    if (!Number.isSafeInteger(player.qigong.available_points) || player.qigong.available_points < 0) {
      const invested = Object.values(player.qigong.invested)
        .reduce((sum, value) => Math.min(Number.MAX_SAFE_INTEGER, sum + value), 0);
      player.qigong.available_points = Math.max(0, this.calcMaxPoints(player) - invested);
    }
  }
};
