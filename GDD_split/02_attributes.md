2. 核心数值系统
2.1 基础属性定义

========== [可配置] 基础属性 ==========
===== 派生属性聚合默认规则（v1.0）=====
任何派生属性（如 critR / combo / shieldRate / leech / hpRecovery / mpCostReduce / healBonus / mpRecoveryBonus / mf / gf / buffDuration / weaponSkillBonus / weaponExtraDamage / enhanceSuccessRate / goldDropBonus / skillCritRate / armorBreak / counterDamage / critB ...）：
- 如显式声明了 formula：按 formula 计算
- 如未声明 formula：默认按下式聚合
final = base_value + sum(对应 xxxAdd 钩子)
例：critR.final = critR.base_value + sum(critRLAdd)（用 attribute_hooks.attribute=="critR" 的钩子聚合）
例：combo.final = combo.base_value + sum(comboAdd)
- 同时存在 xxxPct 钩子的属性，按 (base + sum(xxxAdd)) * (1 + sum(xxxPct)) 计算（与 maxHp/atkMin/def 一致）
- 钩子聚合时全程不取整；只在战斗最终伤害公式（normal_attack_damage / skill_damage）末尾 max(1, floor(...)) 取整
base_attributes:
==============================
四维属性
==============================
  str:  # 力（力量）
    name: "力"
    description: "决定攻击力高低"
    weight: 1.0

  int:  # 心（心智）
    name: "心"
    description: "决定内功（MP）高低"
    weight: 1.0

  sta:  # 体（体质）
    name: "体"
    description: "决定生命值和防御力"
    weight: 1.0

  dex:  # 身（身法）
    name: "身"
    description: "决定命中率和闪避率"
    weight: 1.0

==============================
面板展示属性
==============================

--- 生命与内功 ---
派生属性统一计算范式：final = base_formula + sum(hooks)
- base_formula 部分由各职业 base_stats 与全局常量驱动
- sum(hooks) 是装备/石头/Buff 通过 2.2 属性钩子系统挂上的所有加成之和
  maxHp:
    name: "生命值"
    description: "角色存活上限，被攻击到0则倒下"
    # baseHp 来自当前职业 base_stats.baseHp（已职业化，见各 career.base_stats.baseHp）
    # hpGrowth 来自当前职业 attrGrow.hpGrowth
    # 钩子聚合：sum(maxHpAdd) + 百分比 sum(maxHpPct)（医师气功"体血倍增"等）
    formula: "(baseHp + (level - 1) * hpGrowth + sta * staToHp + sum(maxHpAdd)) * (1 + sum(maxHpPct))"

  maxMp:
    name: "内功"
    description: "支撑使用武功的元素"
    # baseMp 来自当前职业 base_stats.baseMp（已职业化，见各 career.base_stats.baseMp）
    # mpGrowth 来自当前职业 attrGrow.mpGrowth
    # 钩子聚合：sum(maxMpAdd) + 百分比 sum(maxMpPct)（医师气功"洗髓易筋"等）
    formula: "(baseMp + (level - 1) * mpGrowth + int * intToMp + sum(maxMpAdd)) * (1 + sum(maxMpPct))"

--- 攻防属性 ---
  atkMin:
    name: "最小攻击力"
    description: "攻击力下限，面板展示并与最大攻击力组成区间"
    # 公式组成：
    #   baseAtk:                       基础攻击力常量（见 attribute_constants.baseAtk）
    #   floor(str * 0.8 * strToAtk):   力量对最小攻击力的贡献（0.8 系数）
    #   sum(atkMinAdd):                仅作用于最小攻击力的钩子之和
    #   sum(atkSelfAdd):             同时加到 atkMin 与 atkMax 的钩子之和（武器词条、金刚石攻击词条等）
    #   (1 + sum(atkMinPct) + sum(atkSelfPct)):
    #                                  百分比加成（atkMinPct 仅作用 atkMin；atkSelfPct 同时作用两者，如 Buff "狂风万破"）
    formula: "(baseAtk + floor(str * 0.8 * strToAtk) + sum(atkMinAdd) + sum(atkSelfAdd)) * (1 + sum(atkMinPct) + sum(atkSelfPct))"

  atkMax:
    name: "最大攻击力"
    description: "攻击力上限，面板展示并与最小攻击力组成区间"
    # 公式组成：
    #   baseAtk:                       基础攻击力常量
    #   floor(str * 1.0 * strToAtk):   力量对最大攻击力的贡献（1.0 系数）
    #   sum(atkMaxAdd):                仅作用于最大攻击力的钩子之和
    #   sum(atkSelfAdd):             同时加到 atkMin 与 atkMax 的钩子之和
    #   (1 + sum(atkMaxPct) + sum(atkSelfPct)):
    #                                  百分比加成（atkMaxPct 仅作用 atkMax；atkSelfPct 同时作用两者）
    formula: "(baseAtk + floor(str * 1.0 * strToAtk) + sum(atkMaxAdd) + sum(atkSelfAdd)) * (1 + sum(atkMaxPct) + sum(atkSelfPct))"

  atk:
    name: "攻击力"
    description: "实战使用的攻击力，从 [atkMin, atkMax] 区间内随机取值"
    formula: "random(atkMin, atkMax)"
    # 战斗中每次攻击时随机取值（仅玩家适用；怪物使用固定 atk，不走该公式）

  def:
    name: "防御力"
    description: "减免普通攻击伤害"
    # 钩子聚合：sum(defAdd) + 百分比 sum(defPct)（Buff "防御提升" / "狂风万破" 等）
    formula: "(baseDef + sta * staToDef + sum(defAdd)) * (1 + sum(defPct))"

  matk:
    name: "武功攻击力"
    description: "武功伤害的独立加成通道，与四维属性无关。当前唯一来源是【已装备武器自带 matk】——按公式 matk = 武器.atkMax × matk_weapon_ratio 计算"
    # matk_weapon_ratio 默认 1.0（即 matk = 武器 atkMax 全额映射），见 attribute_constants.matk_weapon_ratio
    # 强化提升武器 atkMax 时，matk 同步随之提升（强化对 atk 与 matk 双通道生效）
    # 未装备武器时 matk = 0；未来若新增"matk 词缀/Buff/石头"，再用 sum(matkAdd) 叠加
    formula: "weapon.atkMax * matk_weapon_ratio"

  mdef:
    name: "武功防御力"
    description: "减免技能伤害，与四维属性无关，由装备/Buff/石头提供"
    # v1.0 预留：v1.0 所有怪物 skills:[]、不释放武功 → 玩家堆 mdef 无生效场景；
    #            所有怪物未配置 mdef → 玩家武功打怪 effective_mdef=0，减免系数恒等 1.0；
    #            公式、钩子、唯一来源（枪客气功"灵甲护身"）全部保留为 v2.0 怪物武功上线后启用。
    # 钩子聚合：sum(mdefAdd)
    formula: "0 + sum(mdefAdd)"

--- 命中与闪避 ---
  hit:
    name: "命中"
    description: "命中属性值（数值，非百分比）。实际命中概率由 hit_check 公式决定，见 6.2"
    # 公式组成：
    #   baseHit + dex × dexToHit:     四维身法贡献的命中
    #   level × levelToHit:           等级线性贡献，让玩家命中跟得上同级怪 hit（怪 hit = 3×等级）
    #   sum(hitAdd):                  装备/词缀/Buff/气功通过 hitAdd 钩子提供的加成
    #   (1 + sum(hitPct)):            百分比加成（来源：刀客气功"摄魂一击"等）
    # max(0, ...) 防止 Buff/debuff 累计成负数（包裹整个含百分比的表达式）
    formula: "max(0, (baseHit + dex * dexToHit + level * levelToHit + sum(hitAdd)) * (1 + sum(hitPct)))"

  missing:
    name: "闪避"
    description: "闪避属性值（数值，非百分比）。实际闪避概率 = 1 - 命中概率，见 hit_check"
    # 公式组成：
    #   baseMissing + dex × dexToMissing: 四维身法贡献的闪避
    #   level × levelToMissing:           等级线性贡献，与玩家被同级怪命中率挂钩
    #   sum(missingAdd):                  装备/词缀/Buff/气功/寒玉石通过 missingAdd 钩子提供的加成
    #   (1 + sum(missingPct)):            百分比加成（来源：剑客气功"百变神行"等）
    # max(0, ...) 防止 debuff 累计成负数（包裹整个含百分比的表达式）
    formula: "max(0, (baseMissing + dex * dexToMissing + level * levelToMissing + sum(missingAdd)) * (1 + sum(missingPct)))"

命中率实际判定公式 → 见 6.2 damage_formulas.hit_check
简要：actualHitRate = clamp(attacker.hit / (attacker.hit + target.missing), 0.05, 0.95)

--- 暴击 ---
  critR:
    name: "暴击率"
    description: "暴击概率，仅对普通攻击生效，技能不暴击"
    base_value: 0.30  # 30%
    max_value: 1.0     # 100%

  critB:
    name: "暴击伤害"
    description: "暴击时的伤害倍率，仅对普通攻击生效"
    base_value: 1.5   # 150%

  skillCritRate:
    name: "真武绝击几率"
    description: "武功攻击时触发致命打击的概率，触发时当次武功伤害提高50%，每级+1%"
    base_value: 0
    max_value: 1.0

--- 其他战斗属性 ---
  combo:
    name: "连击几率"
    description: "普通攻击触发连击的概率，触发连击时一次攻击变为3次伤害，仅对普通攻击生效"
    base_value: 0
    max_value: 1.0

  shieldRate:
    name: "护身几率"
    description: "受到攻击时减免50%伤害的概率，仅对普通攻击生效"
    base_value: 0
    max_value: 1.0

  counterDamage:
    name: "反伤几率"
    description: "受到攻击时按一定几率返还伤害给攻击者，仅对普通攻击生效（反伤比例见 combat_constants.counterDamageRate）"
    base_value: 0
    max_value: 1.0

  armorBreak:
    name: "破甲几率"
    description: "攻击时一定几率减少目标20%防御力，仅对当次攻击生效"
    base_value: 0
    max_value: 1.0

==============================
隐藏计算属性（面板不展示）
==============================
  hpRecovery:
    name: "生命恢复"
    description: "每秒恢复生命值"
    base_value: 1

  mpRecovery:
    name: "内功恢复"
    description: "每秒恢复内功值"
    base_value: 1

  mpRecoveryBonus:
    name: "内功恢复加成"
    description: "增加内功药剂的恢复量，每级+1%，实际内功药剂恢复量=内功药剂基础恢复量*(1+内功恢复加成)"
    base_value: 0

  leech:
    name: "生命汲取"
    description: "造成伤害时回复生命"
    base_value: 0

  healBonus:
    name: "治疗效果"
    description: "提高生命药剂治疗效果，每级+1%"
    base_value: 0

  mpCostReduce:
    name: "内力消耗减少"
    description: "减少使用武功时消耗的内功值，每级+1%，仅通过医师气功太极心法提高"
    base_value: 0

  buffDuration:
    name: "辅助武功延长"
    description: "延长辅助武功的生效时间（单位：毫秒；与 Buff duration 字段单位一致）。每级 +15000 ms（=15s），仅通过医师气功吸星大法提高"
    base_value: 0

  mf:
    name: "魔法掉落率"
    description: "提高稀有装备掉落概率"
    base_value: 0

  gf:
    name: "金币掉落率"
    description: "提高金币掉落数量"
    base_value: 0

  weaponSkillBonus:
    name: "武功攻击力加成"
    description: "金刚石提供的武功攻击力百分比加成，面板不展示，仅参与武功伤害计算"
    base_value: 0
    # 武功伤害公式中: matkPart = matk * (1 + weaponSkillBonus / 100)

  weaponExtraDamage:
    name: "武器追加伤害"
    description: "武器固定追加伤害值，面板不展示，仅参与武功伤害计算"
    base_value: 0
    # 武功伤害公式中: weaponBonus = weaponExtraDamage

  enhanceSuccessRate:
    name: "合成强化成功率"
    description: "热血石提供的合成/强化成功率百分比加成，面板不展示，仅参与强化和合成成功率计算。数值即小数百分比（0.01 = +1%），直接相加，无需 /100"
    base_value: 0

  goldDropBonus:
    name: "金币爆率"
    description: "热血石提供的金币掉落金额百分比加成，面板不展示，仅参与金币掉落计算。数值即小数百分比（0.05 = +5%），直接相加，无需 /100"
    base_value: 0
    # 最终金币 = 基础金币 × (1 + goldDropBonus)

==============================
资源属性
==============================
  exp:
    name: "经验值"
    description: "击杀怪物获得，升级所需"

  training:
    name: "历练"
    description: "击杀怪物获得，学习技能的消耗资源"

  merit:
    name: "武勋"
    description: "门派战/PK获得，用于兑换奖励（v2.0 内容；v1.0 不产出、面板不展示、底层字段保留为 0）"
    base_value: 0

==============================
属性面板展示配置
==============================
panel_display:
  four_stats:                 # 四维属性
    - str
    - int
    - sta
    - dex
  combat_stats:               # 战斗属性
    - maxHp
    - maxMp
    - atkMin
    - atkMax
    - def
    - matk
    - mdef
    - hit
    - missing
    - critR
  resource_stats:             # 资源属性
    - exp
    - training
    # merit（武勋）→ v2.0 门派战内容，v1.0 面板不展示（移至 hidden_stats）
  hidden_stats:               # 隐藏属性（面板不展示）
    - critB
    - hpRecovery
    - mpRecovery
    - leech
    - merit                    # 武勋（v2.0 预留；v1.0 无产出，存档保留为 0）
    - mf
    - gf
    - combo                  # 连击几率
    - shieldRate            # 护身几率
    - counterDamage         # 反伤几率


==============================
属性公式常量
==============================
用于 base_attributes 中各 formula 字符串引用的数值常量
注：baseHp / baseMp / hpGrowth / mpGrowth 均已职业化，见各 career 的 base_stats / attrGrow
attribute_constants:
  baseHit: 0                 # 命中率基础值
  dexToHit: 0.5              # dex 对命中率的转化系数
  levelToHit: 2.0            # 等级对命中的线性贡献（每级 +2 hit，让玩家命中曲线对齐怪 hit=3×等级）
  baseMissing: 0             # 闪避率基础值
  dexToMissing: 0.2          # dex 对闪避率的转化系数
  levelToMissing: 0.1        # 等级对闪避的线性贡献（每级 +0.1 missing，与玩家 dex 成长共同抗衡怪 hit）
  baseAtk: 0                 # 攻击力基础值
  strToAtk: 1.0              # str 对攻击力的转化系数
  baseDef: 0                 # 防御力基础值
  staToDef: 1.0              # sta 对防御力的转化系数
  staToHp: 3                 # sta 对生命值的转化系数
  intToMp: 2                 # int 对内功的转化系数
  matk_weapon_ratio: 1.0     # matk = 武器.atkMax × 该系数（推荐 1.0，可调）
                             # 系数微调指引：
                             #   0.5 → 武功威力 effect.value 占比最大，节奏偏慢但层次丰富，金刚石加成 ~24%
                             #   1.0 → 三层伤害最均衡（atk 物理 / matk 武功 / effect.value），同级怪 7-13 刀，推荐默认
                             #   1.5 → matk 主导，节奏好但 effect.value 差异被冲淡，金刚石加成 ~48%
                             #   2.0 → matk 几乎独占（>100% 总伤），其他装备价值被压缩，金刚石加成 ~56%
baseHp:  已职业化，见各 career.base_stats.baseHp（刀客 100 / 剑客 100 / 枪客 100 / 医师 100，初始一致，后续可按职业差异化）
baseMp:  已职业化，见各 career.base_stats.baseMp（刀客 100 / 剑客 100 / 枪客 100 / 医师 100，初始一致，后续可按职业差异化）
hpGrowth: 已职业化，见各 career 的 attrGrow.hpGrowth（刀客 60 / 剑客 40 / 枪客 50 / 医师 30）
mpGrowth: 已职业化，见各 career 的 attrGrow.mpGrowth（刀客 20 / 剑客 25 / 枪客 25 / 医师 30）

2.2 属性钩子系统

========== [可配置] 属性钩子 ==========
钩子允许装备/石头/技能/Buff动态修改属性
#
设计取舍：四维属性（str/int/sta/dex）只由职业初始值 + 等级成长 + attrGrow 决定，
不接受任何装备/石头/词缀/Buff/气功的外部加成，因此不提供四维加法钩子（strAdd / intAdd / staAdd / dexAdd 均不存在）。
所有外部加成只能作用于派生属性（maxHp/maxMp/atk/def/hit/missing/critR/... 等）。
#
operation 类型（v1.0 支持 2 种）：
- "add"      : 数值加法，公式形式 sum(xxxAdd)，直接加到属性数值上
- "multiply" : 百分比加成，公式形式 (1 + sum(xxxPct))，乘到属性最终数值上
约定：value 为小数表示百分比（0.01 = +1%），多个来源叠加为 加法叠加（不是连乘）
示例：投满 20 级体血倍增（每级+1%）+ 满 20 级洗髓易筋的 maxHpPct 各贡献 0.20
→ maxHp_final = maxHp_base × (1 + 0.20) = +20%
#
命名约定：xxxAdd（加法钩子）/ xxxPct（百分比钩子）
attribute_hooks:
--- 生命与内功 ---
- hook: "maxHpAdd"            # 生命值加法
attribute: "maxHp"
operation: "add"
- hook: "maxHpPct"            # 生命值百分比加成（来源：医师气功"体血倍增"等）
attribute: "maxHp"
operation: "multiply"
- hook: "maxMpAdd"            # 内功加法
attribute: "maxMp"
operation: "add"
- hook: "maxMpPct"            # 内功百分比加成（来源：医师气功"洗髓易筋"等）
attribute: "maxMp"
operation: "multiply"
  # --- 攻防属性 ---
  # 说明：attribute 支持字符串或字符串数组。数组形式表示该钩子触发时，
  # 同一数值同时加到列表中的所有属性上（多目标钩子）。
- hook: "atkSelfAdd"        # 攻击力加法（同时加到最小和最大攻击力）
attribute: ["atkMin", "atkMax"]
operation: "add"
- hook: "atkSelfPct"        # 攻击力百分比加成（同时作用于 atkMin / atkMax；来源 Buff "狂风万破" 等）
attribute: ["atkMin", "atkMax"]
operation: "multiply"
- hook: "atkMinAdd"           # 最小攻击力单独加法（仅加到最小攻击力）
attribute: "atkMin"
operation: "add"
- hook: "atkMinPct"           # 最小攻击力百分比加成（来源：刀客气功"力劈华山"等）
attribute: "atkMin"
operation: "multiply"
- hook: "atkMaxAdd"           # 最大攻击力单独加法（仅加到最大攻击力）
attribute: "atkMax"
operation: "add"
- hook: "atkMaxPct"           # 最大攻击力百分比加成（来源：剑客气功"长虹贯日"等）
attribute: "atkMax"
operation: "multiply"
- hook: "defAdd"          # 防御力加法
attribute: "def"
operation: "add"
- hook: "defPct"              # 防御力百分比加成（来源 Buff "防御提升"/"狂风万破" 等）
attribute: "def"
operation: "multiply"
- hook: "mdefAdd"             # 武功防御力加法（v1.0 预留：怪物不释放武功，唯一来源是枪客气功"灵甲护身"；公式与钩子保留为 v2.0 启用）
attribute: "mdef"
operation: "add"
- hook: "weaponSkillBonusAdd"   # 武功攻击力百分比加成（金刚石词条）
attribute: "weaponSkillBonus"
operation: "add"
- hook: "weaponExtraDamageAdd"  # 武器追加伤害加法
attribute: "weaponExtraDamage"
operation: "add"
  # --- 命中与闪避 ---
- hook: "hitAdd"              # 命中率加法
attribute: "hit"
operation: "add"
- hook: "hitPct"              # 命中率百分比加成（来源：刀客气功"摄魂一击"等）
attribute: "hit"
operation: "multiply"
- hook: "missingAdd"          # 闪避率加法
attribute: "missing"
operation: "add"
- hook: "missingPct"          # 闪避率百分比加成（来源：剑客气功"百变神行"等）
attribute: "missing"
operation: "multiply"
  # --- 暴击 ---
- hook: "critRLAdd"           # 暴击率加法
attribute: "critR"
operation: "add"
- hook: "critBLAdd"           # 暴击伤害加法
attribute: "critB"
operation: "add"
- hook: "skillCritRateAdd"    # 真武绝击几率加法
attribute: "skillCritRate"
operation: "add"
  # --- 恢复 ---
- hook: "hpRecoveryAdd"       # 生命恢复加法
attribute: "hpRecovery"
operation: "add"
- hook: "mpRecoveryAdd"       # 内功恢复加法
attribute: "mpRecovery"
operation: "add"
- hook: "healBonusAdd"        # 治疗效果加法
attribute: "healBonus"
operation: "add"
- hook: "mpCostReduceAdd"    # 内力消耗减少加法
attribute: "mpCostReduce"
operation: "add"
- hook: "buffDurationAdd"   # 辅助武功延长加法
attribute: "buffDuration"
operation: "add"
- hook: "mpRecoveryBonusAdd" # 内功恢复加成加法
attribute: "mpRecoveryBonus"
operation: "add"
  # --- 汲取 ---
- hook: "leechAdd"            # 生命汲取加法
attribute: "leech"
operation: "add"
  # --- 连击 ---
- hook: "comboAdd"            # 连击几率加法
attribute: "combo"
operation: "add"
- hook: "shieldRateAdd"      # 护身几率加法
attribute: "shieldRate"
operation: "add"
- hook: "counterDamageAdd"   # 反伤几率加法
attribute: "counterDamage"
operation: "add"
- hook: "armorBreakAdd"      # 破甲几率加法
attribute: "armorBreak"
operation: "add"
  # --- 掉落率 ---
- hook: "mfAdd"               # 魔法掉落率加法
attribute: "mf"
operation: "add"
- hook: "gfAdd"               # 金币掉落率加法
attribute: "gf"
operation: "add"
  # --- 资源 ---
  # 注：training（历练）和 merit（武勋）均无任何加成路径 —— v1.0 / v2.0 都不引入 trainingAdd / meritAdd 钩子；
  #     击杀 / 完成任务时直接 grant_training / grant_merit 写入，固定数值无任何乘数

  # --- 热血石特殊属性 ---
- hook: "enhanceSuccessRateAdd"  # 合成强化成功率加法
attribute: "enhanceSuccessRate"
operation: "add"
- hook: "goldDropBonusAdd"        # 金币爆率加法
attribute: "goldDropBonus"
operation: "add"
使用示例：寒玉石合成属性
hooks: { defAdd: 10, maxHpAdd: 50, missingAdd: 3 }
使用示例：金刚石合成属性
hooks: { atkSelfAdd: 12, weaponSkillBonusAdd: 5 }
使用示例：装备附加属性
hooks: { weaponSkillBonusAdd: 5, mdefAdd: 10 }

2.3 等级与经验

========== [可配置] 升级经验表 ==========
格式：level: 升级所需经验（从本级升到下一级）
v1.0 仅启用 1~60 级；61~100 级数据已铺好，由 current_level_cap 截断升级
exp_to_next_level:
  1: 100
  2: 229
  3: 396
  4: 613
  5: 895
  6: 1261
  7: 1736
  8: 2353
  9: 3155
  10: 4197
  11: 5551
  12: 7311
  13: 9598
  14: 12571
  15: 16435
  16: 21458
  17: 27987
  18: 36474
  19: 47507
  20: 61850
  21: 79062
  22: 99716
  23: 124501
  24: 154243
  25: 189933
  26: 232761
  27: 284155
  28: 345828
  29: 419836
  30: 508646
  31: 615218
  32: 743304
  33: 896706
  34: 1079894
  35: 1299425
  36: 1562842
  37: 1878524
  38: 2266567
  39: 2724713
  40: 3274488
  41: 3917724
  42: 4670310
  43: 5550835
  44: 6581049
  45: 7786399
  46: 9196658
  47: 10846660
  48: 12777162
  49: 15035849
  50: 17678512
  51: 20585441
  52: 23783062
  53: 27300445
  54: 31169566
  55: 35425599
  56: 40107235
  57: 45257034
  58: 50921813
  59: 57153070
  60: 64007452
  61: 71547272
  62: 79841074
  63: 88964256
  64: 98999756
  65: 110038806
  66: 122181761
  67: 137036719
  68: 154862669
  69: 176253809
  70: 201923177
  71: 230159482
  72: 261219417
  73: 295385346
  74: 332967868
  75: 374308642
  76: 419783494
  77: 469805831
  78: 524830401
  79: 585357428
  80: 651937158
  81: 725174861
  82: 805736334
  83: 894353955
  84: 991833338
  85: 1099060659
  86: 1217010712
  87: 1346755770
  88: 1489475334
  89: 1646466855
  90: 1819157528
  91: 2009117268
  92: 2218072982
  93: 2447924267
  94: 2700007606
  95: 2978880736
  96: 3284812797
  97: 3621338064
  98: 3991515858
  99: 4398711432
  100: 4846626563

==============================
等级上限配置
==============================
设计取舍：
开发侧实现 1~100 全等级的公式与数据结构（升级经验、怪物属性公式等），
运行时通过 current_level_cap 截断玩家实际可达的等级。
未来版本（v2.0+）通过调整 current_level_cap 即可开放更高等级，
无需改动升级/属性/战斗代码。
#
注意：current_level_cap 只控制"玩家能升到第几级"，
不自动开放高等级的转职 / 装备 / 武功 / 怪物实例 ——
这些是"内容"，需要单独在 careers / equipments / martial_arts / monsters 里补配置。
level_cap_max: 100       # 系统硬上限，公式/数据结构兼容到此（不要写死数字）
current_level_cap: 60    # 当前版本玩家实际可达等级；升级时 player.level 永远 ≤ 此值
#第一阶段10级一转；第二阶段35级二转；第三阶段60级三转

属性成长系数————每个职业不同，详见每个职业系base职业中成长属性配置

========== [可配置] 经验获取与升级公式（v1.0）==========
设计取舍：满级后停止累加 exp（不再增长 player.exp 字段），玩家心理预期与"毕业"概念一致
- exp 字段累加无上限会让 UI 出现"经验 99999999/64007452"的尴尬展示
- clamp 到 max-1 会让玩家死亡扣 1% 后又能"重新满"，悬念虚假
- 满级后什么都不做最简洁：UI 显示 "MAX"，summary.exp_gained 报 0
grant_exp: |
  def grant_exp(player, amount):
      # 满级后停止累加；amount 直接丢弃（summary.exp_gained 在满级期间为 0）
      if player.level >= current_level_cap:
          return
      player.exp += amount
      # 连续升级（一次大量经验可能跨多级）
      while player.level < current_level_cap and player.exp >= exp_to_next_level[player.level]:
          player.exp -= exp_to_next_level[player.level]
          from_level = player.level
          player.level += 1
          on_level_up(player, from_level, player.level)    # 触发完整升级副作用（详见 on_level_up）
      # 升级到 current_level_cap 后，残余 exp 直接清零（避免下次开 level cap 时累计跳级）
      if player.level >= current_level_cap:
          player.exp = 0

升级时副作用：气功点 + HP/MP 回满 + 事件/日志
on_level_up: |
  def on_level_up(player, from_level, to_level):
      # 1. 气功点累加（按等级阶梯：L<35 +1, L>=35 +2，详见 4.x attribute_points.gain_per_level）
      gained_points = attribute_points.gain_per_level(to_level)
      player.qigong.available_points += gained_points

      # 2. HP/MP 回满（v1.0 设计取舍）：
      #    - 升级瞬间给玩家正反馈
      #    - 防止"升级后 maxHp 提高但 hp 没补"导致升级反而被秒杀的尴尬
      #    - AttributeSystem.recompute 已会算出新 maxHp/maxMp；直接 hp=maxHp / mp=maxMp 即可
      AttributeSystem.recompute(player)
      player.hp = player.maxHp
      player.mp = player.maxMp

      # 3. 在线 / 离线分支
      if not is_in_offline_simulation:
          # 在线：触发 EventBus + 战斗日志 reward_log（见 14.5 section_4_reward_log.event_templates.level_up）
          EventBus.emit("player.level_up", { from_level, to_level, gained_points })
          push_reward_log_event("level_up", { from_level, to_level })
      else:
          # 离线模拟：静默累计到 summary，由上线弹窗汇总展示
          summary.level_ups.append({ from_level, to_level, gained_points })

apply_death_exp_loss: |
  def apply_death_exp_loss(player):
      # 满级和未满级统一公式；max(0, ...) 兜底防负数
      loss = floor(exp_to_next_level[player.level] * 0.01)
      player.exp = max(0, player.exp - loss)
      # 满级时 player.exp 永远 == 0（grant_exp 已清零），扣完仍为 0；不会出现"满级死亡掉级"



---

