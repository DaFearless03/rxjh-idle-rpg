挂机游戏开发文档

本文档为文字类挂机游戏的标准开发文档，可直接用于AI读取并执行编码。
修改配置区块中的数值和规则即可定制新游戏。

v1.0版本说明：
- 等级上限：35级
- 可选职业：刀客系、剑客系、枪客系、医师系（弓手系、刺客系不上线）
- 开放地图：泫渤派、柳正关、三邪关


---

目录

1. [游戏概述](#1-游戏概述)
2. [核心数值系统](#2-核心数值系统)
3. [职业系统](#3-职业系统)
4. [武功与气功系统](#4-武功与气功系统)
5. [装备系统](#5-装备系统)
6. [战斗系统](#6-战斗系统)
7. [怪物系统](#7-怪物系统)
8. [地图系统](#8-地图系统)
9. [经济与掉落系统](#9-经济与掉落系统)
10. [药剂及药剂使用系统](#10-药剂及药剂使用系统)
11. [背包与仓库系统](#11-背包与仓库系统)
12. [盒子系统](#12-盒子系统)
13. [存档系统](#13-存档系统)
14. [技术架构](#14-技术架构)


---

1. 游戏概述

1.1 游戏类型
类型: 文字挂机RPG
视角: 2D文字界面
玩法: 自动战斗 + 装备收集 + 职业养成

1.2 核心玩法循环
1. 选择职业 → 2. 进入关卡 → 3. 自动战斗 → 4. 获取经验/装备
     ↑                                            ↓
     ←←←←←←←←←← 5. 升级/换装/转职 ←←←←←←←←←←←←←←←←

1.3 游戏目标
短期目标: 通过当前关卡、获取更好装备
中期目标: 职业转职、解锁新技能
长期目标: 挑战高难度Boss、收集稀有装备


---

2. 核心数值系统

2.1 基础属性定义

# ========== [可配置] 基础属性 ==========
base_attributes:
  # ==============================
  # 四维属性
  # ==============================
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

  # ==============================
  # 面板展示属性
  # ==============================

  # --- 生命与内功 ---
  maxHp:
    name: "生命值"
    description: "角色存活上限，被攻击到0则倒下"
    formula: "baseHp + level * hpGrowth + sta * staToHp"
    base_value: 100

  maxMp:
    name: "内功"
    description: "支撑使用武功的元素"
    formula: "baseMp + level * mpGrowth + int * intToMp"
    base_value: 50

  # --- 攻防属性 ---
  atkMin:
    name: "最小攻击力"
    description: "攻击力下限，面板展示并与最大攻击力组成区间"
    formula: "baseAtk + floor(str * 0.8 * strToAtk) + equipAtkMin + stoneAtk"
    # baseAtk: 基础攻击力
    # str * 0.8 * strToAtk: 力量对最小攻击力的贡献（0.8系数）
    # equipAtkMin: 装备最小攻击力（武器等装备的攻击力下限）
    # stoneAtk: 石头提供的攻击力（固定值，同时加到最小和最大上）

  atkMax:
    name: "最大攻击力"
    description: "攻击力上限，面板展示并与最小攻击力组成区间"
    formula: "baseAtk + floor(str * 1.0 * strToAtk) + equipAtkMax + stoneAtk"
    # str * 1.0 * strToAtk: 力量对最大攻击力的贡献（1.0系数）
    # equipAtkMax: 装备最大攻击力（武器等装备的攻击力上限）
    # stoneAtk: 石头提供的攻击力（固定值，同时加到最小和最大上）

  atk:
    name: "攻击力"
    description: "实战使用的攻击力，从 [atkMin, atkMax] 区间内随机取值"
    formula: "random(atkMin, atkMax)"
    # 战斗中每次攻击时随机取值

  def:
    name: "防御力"
    description: "减免普通攻击伤害"
    formula: "baseDef + sta * staToDef"

  matk:
    name: "武功攻击力"
    description: "技能伤害加成，与四维属性无关，由装备/Buff/石头提供"
    base_value: 0

  mdef:
    name: "武功防御力"
    description: "减免技能伤害，与四维属性无关，由装备/Buff/石头提供"
    base_value: 0

  # --- 命中与闪避 ---
  hit:
    name: "命中率"
    description: "攻击命中的概率，受身法影响"
    formula: "baseHit + dex * dexToHit"
    base_value: 0

  missing:
    name: "闪避率"
    description: "成功闪避攻击的概率，受身法影响"
    formula: "baseMissing + dex * dexToMissing"
    base_value: 0

  # 命中率实际判定公式（非属性值，实时计算）
  # actualHitRate = attacker.hit / (attacker.hit + target.missing) * 100%

  # --- 暴击 ---
  critR:
    name: "暴击率"
    description: "暴击概率，仅对普通攻击生效，技能不暴击"
    base_value: 0.30  # 30%
    max_value: 1.0     # 100%

  critB:
    name: "暴击伤害"
    description: "暴击时的伤害倍率，仅对普通攻击生效"
    base_value: 1.5   # 150%

  skill_crit_rate:
    name: "真武绝击几率"
    description: "武功攻击时触发致命打击的概率，触发时当次武功伤害提高50%，每级+1%"
    base_value: 0
    max_value: 1.0

  # --- 其他战斗属性 ---
  block:
    name: "格挡率"
    description: "格挡攻击的概率"
    base_value: 0

  combo:
    name: "连击几率"
    description: "普通攻击触发连击的概率，触发连击时一次攻击变为3次伤害，仅对普通攻击生效"
    base_value: 0
    max_value: 1.0

  shield_rate:
    name: "护身几率"
    description: "受到攻击时减免50%伤害的概率，仅对普通攻击生效"
    base_value: 0
    max_value: 1.0

  counter_damage:
    name: "反伤几率"
    description: "受到攻击时按一定几率返还伤害给攻击者，仅对普通攻击生效"
    base_value: 0
    max_value: 1.0
    counter_damage_rate: 1.0  # 反伤比例（默认100%伤害）

  armor_break:
    name: "破甲几率"
    description: "攻击时一定几率减少目标20%防御力，仅对当次攻击生效"
    base_value: 0
    max_value: 1.0

  # ==============================
  # 隐藏计算属性（面板不展示）
  # ==============================
  hpRecovery:
    name: "生命恢复"
    description: "每秒恢复生命值"
    base_value: 1

  mpRecovery:
    name: "内功恢复"
    description: "每秒恢复内功值"
    base_value: 1

  mp_recovery_bonus:
    name: "内功恢复加成"
    description: "增加内功药剂的恢复量，每级+1%，实际内功药剂恢复量=内功药剂基础恢复量*(1+内功恢复加成)"
    base_value: 0

  leech:
    name: "生命汲取"
    description: "造成伤害时回复生命"
    base_value: 0

  heal_bonus:
    name: "治疗效果"
    description: "提高生命药剂治疗效果，每级+1%"
    base_value: 0

  mp_cost_reduce:
    name: "内力消耗减少"
    description: "减少使用武功时消耗的内功值，每级+1%，仅通过医师气功太极心法提高"
    base_value: 0

  buff_duration:
    name: "辅助武功延长"
    description: "延长辅助武功的生效时间，每级+15秒，仅通过医师气功吸星大法提高"
    base_value: 0

  mf:
    name: "魔法掉落率"
    description: "提高稀有装备掉落概率"
    base_value: 0

  gf:
    name: "金币掉落率"
    description: "提高金币掉落数量"
    base_value: 0

  weapon_skill_bonus:
    name: "武功攻击力加成"
    description: "金刚石提供的武功攻击力百分比加成，面板不展示，仅参与武功伤害计算"
    base_value: 0
    # 武功伤害公式中: matkPart = matk * (1 + weapon_skill_bonus / 100)

  weapon_extra_damage:
    name: "武器追加伤害"
    description: "武器固定追加伤害值，面板不展示，仅参与武功伤害计算"
    base_value: 0
    # 武功伤害公式中: weaponBonus = weapon_extra_damage

  enhance_success_rate:
    name: "合成强化成功率"
    description: "热血石提供的合成/强化成功率百分比加成，面板不展示，仅参与强化和合成成功率计算"
    base_value: 0

  gold_drop_bonus:
    name: "金币爆率"
    description: "热血石提供的金币掉落金额百分比加成，面板不展示，仅参与金币掉落计算"
    base_value: 0
    # 最终金币 = 基础金币 × (1 + gold_drop_bonus)

  # ==============================
  # 资源属性
  # ==============================
  exp:
    name: "经验值"
    description: "击杀怪物获得，升级所需"

  training:
    name: "历练"
    description: "击杀怪物获得，学习技能的消耗资源"

  merit:
    name: "武勋"
    description: "门派战/PK获得，用于兑换奖励"
    base_value: 0

# ==============================
# 属性面板展示配置
# ==============================
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
  resource_stats:             # 资源属性
    - exp
    - training
    - merit
  hidden_stats:               # 隐藏属性（面板不展示）
    - critR                # 暴击率
    - critB                # 暴击伤害
    - block                # 格挡率
    - hpRecovery           # 生命恢复
    - mpRecovery           # 内功恢复
    - leech                # 生命汲取
    - mf                   # 魔法掉落率
    - gf                   # 金币掉落率
    - combo                # 连击几率
    - shield_rate          # 护身几率
    - counter_damage        # 反伤几率

2.2 属性钩子系统

# ========== [可配置] 属性钩子 ==========
# 钩子允许装备/石头/技能/Buff动态修改属性
attribute_hooks:
  # --- 四维属性 ---
  - hook: "intAdd"              # 心智加法
    attribute: "int"
    operation: "add"

  - hook: "staAdd"              # 体质加法
    attribute: "sta"
    operation: "add"

  - hook: "dexAdd"              # 身法加法
    attribute: "dex"
    operation: "add"

  # --- 生命与内功 ---
  - hook: "maxHpAdd"            # 生命值加法
    attribute: "maxHp"
    operation: "add"

  - hook: "maxMpAdd"            # 内功加法
    attribute: "maxMp"
    operation: "add"

  # --- 攻防属性 ---
  - hook: "atk_self_Add"        # 攻击力加法（同时加到最小和最大攻击力）
    attribute: "atkMin"
    operation: "add"

  - hook: "atkMinAdd"           # 最小攻击力单独加法（仅加到最小攻击力）
    attribute: "atkMin"
    operation: "add"

  - hook: "atk_self_Add"        # 攻击力加法（同时加到最小和最大攻击力）
    attribute: "atkMax"
    operation: "add"

  - hook: "atkMaxAdd"           # 最大攻击力单独加法（仅加到最大攻击力）
    attribute: "atkMax"
    operation: "add"

  - hook: "defselfAdd"          # 防御力加法
    attribute: "def"
    operation: "add"

  - hook: "mdefAdd"             # 武功防御力加法
    attribute: "mdef"
    operation: "add"

  - hook: "weaponSkillBonusAdd"   # 武功攻击力百分比加成（金刚石词条）
    attribute: "weapon_skill_bonus"
    operation: "add"

  - hook: "weaponExtraDamageAdd"  # 武器追加伤害加法
    attribute: "weapon_extra_damage"
    operation: "add"

  # --- 命中与闪避 ---
  - hook: "hitAdd"              # 命中率加法
    attribute: "hit"
    operation: "add"

  - hook: "missingAdd"          # 闪避率加法
    attribute: "missing"
    operation: "add"

  # --- 暴击 ---
  - hook: "critRLAdd"           # 暴击率加法
    attribute: "critR"
    operation: "add"

  - hook: "critBLAdd"           # 暴击伤害加法
    attribute: "critB"
    operation: "add"

  - hook: "skillCritRateAdd"    # 真武绝击几率加法
    attribute: "skill_crit_rate"
    operation: "add"

  # --- 格挡 ---
  - hook: "blockAdd"            # 格挡率加法
    attribute: "block"
    operation: "add"

  # --- 恢复 ---
  - hook: "hpRecoveryAdd"       # 生命恢复加法
    attribute: "hpRecovery"
    operation: "add"

  - hook: "mpRecoveryAdd"       # 内功恢复加法
    attribute: "mpRecovery"
    operation: "add"

  - hook: "healBonusAdd"        # 治疗效果加法
    attribute: "heal_bonus"
    operation: "add"

  - hook: "mpCostReduceAdd"    # 内力消耗减少加法
    attribute: "mp_cost_reduce"
    operation: "add"

  - hook: "buffDurationAdd"   # 辅助武功延长加法
    attribute: "buff_duration"
    operation: "add"

  - hook: "mpRecoveryBonusAdd" # 内功恢复加成加法
    attribute: "mp_recovery_bonus"
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
    attribute: "shield_rate"
    operation: "add"

  - hook: "counterDamageAdd"   # 反伤几率加法
    attribute: "counter_damage"
    operation: "add"

  - hook: "armorBreakAdd"      # 破甲几率加法
    attribute: "armor_break"
    operation: "add"

  # --- 掉落率 ---
  - hook: "mfAdd"               # 魔法掉落率加法
    attribute: "mf"
    operation: "add"

  - hook: "gfAdd"               # 金币掉落率加法
    attribute: "gf"
    operation: "add"

  # --- 资源 ---
  - hook: "trainingAdd"         # 历练加成（击杀额外历练）
    attribute: "training"
    operation: "add"

  - hook: "meritAdd"            # 武勋加成（击杀额外武勋）
    attribute: "merit"
    operation: "add"

  # --- 热血石特殊属性 ---
  - hook: "enhanceSuccessRateAdd"  # 合成强化成功率加法
    attribute: "enhance_success_rate"
    operation: "add"

  - hook: "goldDropBonusAdd"        # 金币爆率加法
    attribute: "gold_drop_bonus"
    operation: "add"

# 使用示例：寒玉石合成属性
# hooks: { defselfAdd: 10, maxHpAdd: 50, missingAdd: 3 }
# 使用示例：金刚石合成属性
# hooks: { atk_self_Add: 12, weaponSkillBonusAdd: 5 }
# 使用示例：装备附加属性
# hooks: { weaponSkillBonusAdd: 5, mdefAdd: 10 }

2.3 等级与经验

# ========== [可配置] 升级经验表 ==========
# 格式：level: 升级所需经验（从本级升到下一级）
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

# 等级上限（可配置，当前设为35级）
current_level_cap: 35
#第一阶段35级二转；第二阶段60级三转；第三阶段80级四转

# 属性成长系数————每个职业不同，详见每个职业系base职业中成长属性配置


---
3. 职业系统

3.1 职业模板定义

# ========== [可配置] 职业定义模板 ==========
# 复制此模板创建新职业

career_template:
  key: "职业唯一标识"              # 如: "warrior"
  name: "职业名称"                 # 如: "战士"
  description: "职业描述文本"

  # 解锁条件
  requirement:
    role: "角色标识"              # 可选，限定特定角色
    level: 1                      # 需要等级
    career: "前置职业"            # 可选，转职需要
    stories: ["剧情ID"]          # 可选，完成指定剧情

  # 默认装备类型
  equipments:
    weapon: "武器类型"

  # 初始属性（仅base职业需要定义，转职职业继承base职业的初始值）
  base_stats:
    str: 10      # 力量
    dex: 10      # 身法
    int: 10      # 心智
    sta: 10      # 体质

  # 属性成长修正（每级成长倍率）
  attrGrow:
    str: 0.5     # 力量成长
    dex: 0       # 敏捷成长
    int: 0       # 智力成长
    sta: 0.5     # 耐力成长

  # 可用武功（通过career_family限定，见第4章武功与气功系统）
  # 武功按职业划分：刀客系、剑客系、枪客系、医师系
  # 转职职业自动继承base职业的武功学习权限
  martial_arts: []  # 无需重复配置，武功已按职业career_family划分

  # 被动技能
  passives:
    passive_id: unlock_level

  # 增强技能
  enhances:
    enhance_id: max_level

  # 可装备类型
  availableClasses:
    weapon_sword: true
    weapon_dagger: true
    armor_light: true
    armor_heavy: true
    ornament: true

  # 是否隐藏职业
  hidden: false

3.2 职业数据配置


# ========== [可配置] 职业列表 ==========

careers:
  # ===== 刀客 =====
  - key: "warrior_blade"
    name: "刀客"
    description: "高血高防"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "blade"
    # 默认装备类型
    requirement:
      role: "warrior_blade"  #刀客角色
      level: 1
    equipments:
      weapon: "blade"
    # 初始属性
    base_stats:
      int: 8       # 心智
      str: 8       # 力量
      sta: 15      # 体质
      dex: 9       # 身法
      maxMp: 116   # 内功
      maxHp: 145   # 生命值
      atkMin: 8    # 最小攻击力
      atkMax: 8    # 最大攻击力
      def: 15      # 防御力
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_1st"
    name: "刀杰"
    description: "刀客1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_2st_Z"
    name: "弑魔刀"
    description: "刀客正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_2st_X"
    name: "摄魂刀"
    description: "刀客邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_3st_Z"
    name: "至尊刀"
    description: "刀客正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_3st_X"
    name: "幽冥刀"
    description: "刀客邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_4st_Z"
    name: "屠龙刀"
    description: "刀客正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_blade_transfer_4st_X"
    name: "灭世刀"
    description: "刀客邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "blade"
    requirement:
      # 前置职业
      career: "warrior_blade_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      blade: true #刀
      cloth_blade: true #刀衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指            

# ===== 剑客 =====
  - key: "warrior_sword"
    name: "剑士"
    description: "高敏捷高闪避"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "sword"
    # 默认装备类型
    requirement:
      role: "warrior_sword"  #剑客角色
      level: 1
    equipments:
      weapon: "sword"
    # 初始属性
    base_stats:
      int: 9       # 心智
      str: 11      # 力量
      sta: 11      # 体质
      dex: 9       # 身法
      maxMp: 118   # 内功
      maxHp: 133   # 生命值
      atkMin: 11   # 最小攻击力
      atkMax: 11   # 最大攻击力
      def: 11      # 防御力
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_1st"
    name: "剑侠"
    description: "剑客1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_2st_Z"
    name: "至圣剑"
    description: "剑客正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_2st_X"
    name: "夺命剑"
    description: "剑客邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_3st_Z"
    name: "天人剑"
    description: "剑客正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_3st_X"
    name: "邪灵剑"
    description: "剑客邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_4st_Z"
    name: "无双剑"
    description: "剑客正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_sword_transfer_4st_X"
    name: "狂魔剑"
    description: "剑客邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "sword"
    requirement:
      # 前置职业
      career: "warrior_sword_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      sword: true #剑
      cloth_sword: true #剑衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指 
            
# ===== 医师 =====
  - key: "healer"
    name: "医师"
    description: "低血量低防御可治疗可buff"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "staff"
    requirement:
      role: "healer"  #医师角色
      level: 1
    equipments:
      weapon: "staff"
    # 初始属性
    base_stats:
      int: 9       # 心智
      str: 11      # 力量
      sta: 9       # 体质
      dex: 11      # 身法
      maxMp: 118   # 内功
      maxHp: 133   # 生命值
      atkMin: 11   # 最小攻击力
      atkMax: 11   # 最大攻击力
      def: 9       # 防御力
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_1st"
    name: "名医"
    description: "医师1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_2st_Z"
    name: "济世者"
    description: "医师正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_2st_X"
    name: "巫医"
    description: "医师邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_3st_Z"
    name: "活菩萨"
    description: "医师正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_3st_X"
    name: "修罗医"
    description: "医师邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_4st_Z"
    name: "玉达摩"
    description: "医师正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "healer_transfer_4st_X"
    name: "血罗刹"
    description: "医师邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "staff"
    requirement:
      # 前置职业
      career: "healer_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      staff: true #法杖
      cloth_healer: true #医衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
  
   # ===== 枪客 =====
  - key: "warrior_spear"
    name: "枪客"
    description: "高血量高攻击"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "spear"
    requirement:
      role: "warrior_spear"  #剑客角色
      level: 1
    equipments:
      weapon: "spear"
    # 初始属性
    base_stats:
      int: 9       # 心智
      str: 13      # 力量
      sta: 11      # 体质
      dex: 7       # 身法
      maxMp: 118   # 内功
      maxHp: 133   # 生命值
      atkMin: 13   # 最小攻击力
      atkMax: 13   # 最大攻击力
      def: 11      # 防御力
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_1st"
    name: "枪豪"
    description: "枪客1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_2st_Z"
    name: "玄武枪"
    description: "枪客正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_2st_X"
    name: "鬼枪"
    description: "枪客邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_3st_Z"
    name: "英雄枪"
    description: "枪客正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_3st_X"
    name: "衍魔枪"
    description: "枪客邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_4st_Z"
    name: "霸王枪"
    description: "枪客正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "warrior_spear_transfer_4st_X"
    name: "地狱枪"
    description: "枪客邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "spear"
    requirement:
      # 前置职业
      career: "warrior_spear_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      spear: true #枪
      cloth_spear: true #枪衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
     
   # ===== 弓手 =====
  - key: "archer"
    name: "弓手"
    description: "低血高攻"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "archer"
    requirement:
      role: "archer"  #弓手角色
      level: 1
    equipments:
      weapon: "bow"
    # 初始属性
    base_stats:
      int: 9       # 心智
      str: 11      # 力量
      sta: 9       # 体质
      dex: 11      # 身法
      maxMp: 124   # 内功
      maxHp: 126   # 生命值
      atkMin: 11   # 最小攻击力
      atkMax: 11   # 最大攻击力
      def: 9       # 防御力
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_1st"
    name: "神射手"
    description: "弓手1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_2st_Z"
    name: "穿云弓"
    description: "弓手正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_2st_X"
    name: "夺魄弓"
    description: "弓手邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_3st_Z"
    name: "追月弓"
    description: "弓手正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_3st_X"
    name: "饮血弓"
    description: "弓手邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_4st_Z"
    name: "羿神弓"
    description: "弓手正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "archer_transfer_4st_X"
    name: "冥王弓"
    description: "弓手邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "archer"
    requirement:
      # 前置职业
      career: "archer_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "bow"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2.5
      dex: 3
      int: 2
      sta: 1
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      bow: true #弓
      cloth_archer: true #弓衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
    # ===== 刺客 =====         #v1.0版本不上
  - key: "assassin"
    name: "刺客"
    description: "高敏高攻"#待完善
    stage: "base"
    faction: "neutral"
    career_family: "assassin"
    requirement:
      role: "assassin"  #刺客角色
      level: 1
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 0.5
      dex: 0
      int: 0
      sta: 0.5
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # v1.0版本刺客不上线
    # 可装备类型
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_1st"
    name: "隐者"
    description: "刺客1转" #待完善
    stage: "t1"
    faction: "neutral"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin"
      level: 10
      stories: ["quest_transfer_1"] #1转任务
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_2st_Z"
    name: "狼牙"
    description: "刺客正派2转" #待完善
    stage: "t2"
    faction: "positive"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转正派任务
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_2st_X"
    name: "猎鹰"
    description: "刺客邪派2转" #待完善
    stage: "t2"
    faction: "negative"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_1st"
      level: 35
      stories: ["quest_transfer_2"] #2转邪派任务
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_3st_Z"
    name: "疾风"
    description: "刺客正派3转" #待完善
    stage: "t3"
    faction: "positive"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_2st_Z"
      level: 60
      stories: ["quest_transfer_3_positive"] #3转正派任务
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_3st_X"
    name: "魅影"
    description: "刺客邪派3转" #待完善
    stage: "t3"
    faction: "negative"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_2st_X"
      level: 60
      stories: ["quest_transfer_3_negative"] #3转邪派任务
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_4st_Z"
    name: "夜叉"
    description: "刺客正派4转" #待完善
    stage: "t4"
    faction: "positive"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_3st_Z"
      level: 80
      stories: ["剧情ID"] #4转正派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指
      
  - key: "assassin_transfer_4st_X"
    name: "罗刹"
    description: "刺客邪派4转" #待完善
    stage: "t4"
    faction: "negative"
    career_family: "assassin"
    requirement:
      # 前置职业
      career: "assassin_transfer_3st_X"
      level: 80
      stories: ["剧情ID"] #4转邪派任务，v1.0不涉及
    # 默认装备类型
    equipments:
      weapon: "dagger"
    # 属性成长修正（每级成长倍率）
    attrGrow: #待定
      str: 1.5
      dex: 1
      int: 0
      sta: 2
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    availableClasses:
      dagger: true #匕首
      cloth_assassin: true #刺客衣
      handguard: true #护手
      boot: true #靴子
      inner_armor: true #内甲
      cape: true #披风
      necklace: true #项链
      earring: true #耳环
      ring: true #戒指

3.3 职业平衡规则

# ========== [可配置] 职业平衡规则 ==========

career_balance:
  # 定位分配
  roles:
    - name: "输出(近战-物理-反伤)"
      characteristics:
        - 高生命值成长
        - 高防御成长
        - 低输出成长
        - 群攻技能和被动
      example_careers: ["刀客"]

    - name: "输出(近战-物理-普攻)"
      characteristics:
        - 高力量成长
        - 高暴击成长
        - 低生存能力
      example_careers: ["剑客", "刺客"]
    
    - name: "输出(近战-物理-技能)"
      characteristics:
        - 高力量成长
        - 高生命值成长
        - 中等生存能力
      example_careers: ["枪客"]

    - name: "输出(远程-法术)"
      characteristics:
        - 高智力成长
        - 高法力成长
        - 低生存能力
      example_careers: ["医师"]
      
    - name: "输出(远程-物理)"
      characteristics:
        - 高敏捷成长
        - 高力量成长
        - 低生存能力
      example_careers: ["弓手"]


  # 成长系数平衡参考  #待定
  growth_balance:
    # 每1点属性点的等效价值
    str_equivalent:
      atk: 1
      physical_damage_multiplier: 0.01

    int_equivalent:
      matk: 1
      mp: 5
      spell_damage_multiplier: 0.01

    dex_equivalent:
      critR: 0.002
      missing: 0.001

    sta_equivalent:
      maxHp: 10
      def: 0.5

  # 转职设计原则
  job_change_rules:
    - 转职需要等级门槛 (10/35/60/80)
    - 转职需要完成特定剧情
        10级公共的1转任务
        35/60/80级根据职业&正邪派区分专职任务内容
    - 转职后属性成长改变
    - 转职后解锁新技能树
    - 同级转职应保持战力相当


---

4. 武功与气功系统

4.1 武功系统

# ========== [可配置] 武功模板 ==========

martial_art_template:
  key: "武功唯一标识"
  name: "武功名称"
  description: "武功描述"

  # 效果类型
  type: "damage"    # damage(伤害) / buff(增益) / heal(治疗)

  # 目标
  target: "single"  # single(单体) / aoe(群体)

  # 冷却时间（毫秒）
  coolDown: 1000

  # 释放消耗
  cost:
    mp: 20           # 内功消耗

  # 学习消耗
  learning_cost:
    training: 100     # 历练消耗

  # 效果
  effect:
    value: 50        # damage: 伤害值 / heal: 恢复值 / buff: 对应Buff Key
    target_count: 1   # 群体技能可攻击目标数量（仅target为aoe时有效）

  # 学习条件
  requirement:
    level: 10
    career_family: "blade"  # 职业系
    faction: "positive"   # 正派 (可选，不填表示无职业限制)

4.1.1 武功数据配置
# ========== [可配置] 武功列表 ==========
# 武功按职业系、等级和正邪派划分

martial_arts:
  # ===== 刀客武功 =====
  - key: "blade_fury_wind_flame"
    name: "疾风烈火"
    description: "刀客1转技能，以疾风之势催动烈火，造成大额伤害"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 5
    learning_cost:
      training: 150
    requirement:
      level: 10
      career_family: "blade"
      min_transfer: 1
    effect:
      value: 30

  - key: "blade_fury_wind_wood"
    name: "疾风断木"
    description: "刀客1转技能，疾风之力可断木，威力更强"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 10
    learning_cost:
      training: 1600
    requirement:
      level: 20
      career_family: "blade"
      min_transfer: 1
    effect:
      value: 45

  - key: "blade_fury_wind_shadow"
    name: "疾风残影"
    description: "刀客1转技能，疾风如残影般锋利，威力巨大"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 15
    learning_cost:
      training: 8800
    requirement:
      level: 30
      career_family: "blade"
      min_transfer: 1
    effect:
      value: 65

  - key: "blade_fury_desert"
    name: "狂沙遍野"
    description: "刀客2转技能，黄沙万里，威力无穷"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 32000
    requirement:
      level: 35
      career_family: "blade"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 85

  - key: "blade_fury_cloud"
    name: "风卷残云"
    description: "刀客2转技能，风暴席卷，残云难存"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 50000
    requirement:
      level: 45
      career_family: "blade"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 100

  - key: "blade_fury_godghost"
    name: "鬼神绝杀"
    description: "刀客2转技能，群体武功，可同时攻击4个目标，威力惊天"
    type: "damage"
    target: "aoe"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 120000
    requirement:
      level: 55
      career_family: "blade"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 110
      target_count: 4

  # ===== 刀客邪派2转武功 =====
  - key: "blade_fury_dragon"
    name: "灭世屠龙"
    description: "刀客2转技能，邪派武学，威力惊人"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 32000
    requirement:
      level: 35
      career_family: "blade"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 85

  - key: "blade_fury_blade"
    name: "灭世裂刃"
    description: "刀客2转技能，邪派武学，无坚不摧"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 50000
    requirement:
      level: 45
      career_family: "blade"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 100

  - key: "blade_fury_heaven"
    name: "灭世劈天"
    description: "刀客2转技能，邪派群体武功，威力惊天"
    type: "damage"
    target: "aoe"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 120000
    requirement:
      level: 55
      career_family: "blade"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 110
      target_count: 4

  # ===== 刀客正派3转武功 =====
  - key: "blade_fury_cinnabar"
    name: "丹红五炼"
    description: "刀客正派3转技能，修炼至化境的绝学"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "blade"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 150

  - key: "blade_fury_tenpin"
    name: "丹红天忍"
    description: "刀客正派3转技能，天忍之名，威震八方"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "blade"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 180

  - key: "blade_fury_brush"
    name: "丹红拂面"
    description: "刀客正派3转技能，群体武功，可攻击4个目标"
    type: "damage"
    target: "aoe"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "blade"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 150
      target_count: 4

  # ===== 刀客邪派3转武功 =====
  - key: "blade_fury_bloodsand"
    name: "血流黑沙"
    description: "刀客邪派3转技能，邪派绝学，威力惊人"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "blade"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 150

  - key: "blade_fury_bloodfield"
    name: "血流遍野"
    description: "刀客邪派3转技能，血流千里，遍地尸骸"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "blade"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 180

  - key: "blade_fury_bloodearth"
    name: "血流地裂"
    description: "刀客邪派3转技能，群体武功，可攻击4个目标"
    type: "damage"
    target: "aoe"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "blade"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 150
      target_count: 4

  # ===== 剑客正派1转武功 =====
  - key: "sword_fury_wave"
    name: "碧波潮生"
    description: "剑客1转技能，碧波荡漾，潮生不息"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 5
    learning_cost:
      training: 160
    requirement:
      level: 10
      career_family: "sword"
      min_transfer: 1
    effect:
      value: 35

  - key: "sword_fury_dance"
    name: "劲风魅舞"
    description: "剑客1转技能，剑影如魅，劲风随形"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 12
    learning_cost:
      training: 1800
    requirement:
      level: 20
      career_family: "sword"
      min_transfer: 1
    effect:
      value: 50

  - key: "sword_fury_moon"
    name: "皓月当空"
    description: "剑客1转技能，皓月高悬，光照大地"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 18
    learning_cost:
      training: 9000
    requirement:
      level: 30
      career_family: "sword"
      min_transfer: 1
    effect:
      value: 70

  # ===== 剑客正派2转武功 =====
  - key: "sword_fury_thunder"
    name: "雷霆霹雳"
    description: "剑客正派2转技能，雷声轰鸣，霹雳惊天"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 33000
    requirement:
      level: 35
      career_family: "sword"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 90

  - key: "sword_fury_thundershadow"
    name: "雷霆残影"
    description: "剑客正派2转技能，雷霆之势，如影随形"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 52000
    requirement:
      level: 45
      career_family: "sword"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 105

  - key: "sword_fury_thunderworld"
    name: "雷霆四海"
    description: "剑客正派2转技能，雷霆震四海，威遍八方"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 125000
    requirement:
      level: 55
      career_family: "sword"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 125

  # ===== 剑客邪派2转武功 =====
  - key: "sword_fury_ghostsound"
    name: "鬼煞之音"
    description: "剑客邪派2转技能，鬼煞之音，摄人心魄"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 33000
    requirement:
      level: 35
      career_family: "sword"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 90

  - key: "sword_fury_ghoststrike"
    name: "鬼煞一击"
    description: "剑客邪派2转技能，鬼煞之击，一击必杀"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 52000
    requirement:
      level: 45
      career_family: "sword"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 105

  - key: "sword_fury_ghostdestroy"
    name: "鬼煞灭天"
    description: "剑客邪派2转技能，鬼煞灭天，毁天灭地"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 125000
    requirement:
      level: 55
      career_family: "sword"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 125

  # ===== 剑客正派3转武功 =====
  - key: "sword_fury_piercemountain"
    name: "碧波贯山"
    description: "剑客正派3转技能，碧波之力，可贯山岳"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "sword"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 150

  - key: "sword_fury_pierceair"
    name: "碧波贯气"
    description: "剑客正派3转技能，碧波之气，可贯虚空"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "sword"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 180

  - key: "sword_fury_killsquare"
    name: "碧波杀阵"
    description: "剑客正派3转技能，碧波杀阵，威力惊天"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "sword"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 250

  # ===== 剑客邪派3转武功 =====
  - key: "sword_fury_sandstorm"
    name: "裟衣激风"
    description: "剑客邪派3转技能，裟衣之功，激风如刃"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "sword"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 150

  - key: "sword_fury_willow"
    name: "裟衣拂柳"
    description: "剑客邪派3转技能，裟衣之功，拂柳无痕"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "sword"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 180

  - key: "sword_fury_falling"
    name: "裟衣落英"
    description: "剑客邪派3转技能，裟衣之功，落英无情"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "sword"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 250

  # ===== 枪客1转武功 =====
  - key: "spear_fury_cloudpierce"
    name: "震云贯日"
    description: "枪客1转技能，震云贯日，气贯长虹"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 5
    learning_cost:
      training: 170
    requirement:
      level: 10
      career_family: "spear"
      min_transfer: 1
    effect:
      value: 40

  - key: "spear_fury_miststrike"
    name: "腾雾强击"
    description: "枪客1转技能，腾雾出击，威力强绝"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 12
    learning_cost:
      training: 1900
    requirement:
      level: 20
      career_family: "spear"
      min_transfer: 1
    effect:
      value: 55

  - key: "spear_fury_secret"
    name: "密传绝杀"
    description: "枪客1转技能，密传绝杀，一击必杀"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 18
    learning_cost:
      training: 9200
    requirement:
      level: 30
      career_family: "spear"
      min_transfer: 1
    effect:
      value: 75

  # ===== 枪客正派2转武功 =====
  - key: "spear_fury_chainkill"
    name: "连环归灭"
    description: "枪客正派2转技能，连环攻击，归灭一切"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 34000
    requirement:
      level: 35
      career_family: "spear"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 100

  - key: "spear_fury_chaindragon"
    name: "连环屠龙"
    description: "枪客正派2转技能，连环屠龙，威力惊天"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 54000
    requirement:
      level: 45
      career_family: "spear"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 115

  - key: "spear_fury_chaindeath"
    name: "连环绝杀"
    description: "枪客正派2转技能，连环绝杀，威力无极"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 128000
    requirement:
      level: 55
      career_family: "spear"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 135

  # ===== 枪客邪派2转武功 =====
  - key: "spear_fury_ignite"
    name: "火星乍现"
    description: "枪客邪派2转技能，火星乍现，威力惊燃"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 34000
    requirement:
      level: 35
      career_family: "spear"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 100

  - key: "spear_fury_backbone"
    name: "中流砥柱"
    description: "枪客邪派2转技能，中流砥柱，坚不可摧"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 54000
    requirement:
      level: 45
      career_family: "spear"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 115

  - key: "spear_fury_overlord"
    name: "威凌天下"
    description: "枪客邪派2转技能，威凌天下，谁与争锋"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 128000
    requirement:
      level: 55
      career_family: "spear"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 135

  # ===== 枪客正派3转武功 =====
  - key: "spear_fury_whiteTiger"
    name: "白虎吞天"
    description: "枪客正派3转技能，白虎之名，吞天灭地"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "spear"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 150

  - key: "spear_fury_sorrow"
    name: "哀伤魔枪"
    description: "枪客正派3转技能，哀伤之枪，魔威难挡"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "spear"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 180

  - key: "spear_fury_tortoise"
    name: "龟寿裂杀"
    description: "枪客正派3转技能，龟寿之功，一裂天下"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "spear"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 250

  # ===== 枪客邪派3转武功 =====
  - key: "spear_fury_rebelliondragon"
    name: "逆天灭龙"
    description: "枪客邪派3转技能，逆天之功，灭龙无形"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 35
    learning_cost:
      training: 124000
    requirement:
      level: 60
      career_family: "spear"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 150

  - key: "spear_fury_rebellionstar"
    name: "逆天煞星"
    description: "枪客邪派3转技能，逆天之煞，星落尘凡"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 132000
    requirement:
      level: 64
      career_family: "spear"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 180

  - key: "spear_fury_rebelliondemon"
    name: "逆天将魔"
    description: "枪客邪派3转技能，逆天之将，魔颤抖栗"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 143000
    requirement:
      level: 68
      career_family: "spear"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 250

  # ===== 医师1转武功 =====
  - key: "staff_fury_shadowpalm"
    name: "绝影神掌"
    description: "医师1转技能，绝影神掌，妙手回春"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 10
    learning_cost:
      training: 150
    requirement:
      level: 10
      career_family: "staff"
      min_transfer: 1
    effect:
      value: 50

  # ===== 医师正派2转武功 =====
  - key: "staff_fury_sunnycold"
    name: "青阳寒天"
    description: "医师正派2转技能，青阳一出，寒天必灭"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 10000
    requirement:
      level: 35
      career_family: "staff"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 80

  - key: "staff_fury_sunnybreak"
    name: "青阳破天"
    description: "医师正派2转技能，青阳破天，威力无穷"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 20000
    requirement:
      level: 45
      career_family: "staff"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 100

  - key: "staff_fury_sunnychaos"
    name: "青阳乱天"
    description: "医师正派2转技能，青阳乱天，毁天灭地"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 32000
    requirement:
      level: 55
      career_family: "staff"
      min_transfer: 2
      faction: "positive"
    effect:
      value: 150

  # ===== 医师邪派2转武功 =====
  - key: "staff_fury_northblood"
    name: "北冥凝血"
    description: "医师邪派2转技能，北冥神功，凝血无形"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 10000
    requirement:
      level: 35
      career_family: "staff"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 80

  - key: "staff_fury_northsoul"
    name: "北冥夺魄"
    description: "医师邪派2转技能，北冥夺魄，摄人心魂"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 20000
    requirement:
      level: 45
      career_family: "staff"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 100

  - key: "staff_fury_northheart"
    name: "北冥破心"
    description: "医师邪派2转技能，北冥破心，心神俱灭"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 32000
    requirement:
      level: 55
      career_family: "staff"
      min_transfer: 2
      faction: "negative"
    effect:
      value: 150

  # ===== 医师正派3转武功 =====
  - key: "staff_fury_goldpalm"
    name: "金掌敌虎"
    description: "医师正派3转技能，金掌一出，敌虎难逃"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 50
    learning_cost:
      training: 120000
    requirement:
      level: 60
      career_family: "staff"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 180

  - key: "staff_fury_goldphoenix"
    name: "金掌破凰"
    description: "医师正派3转技能，金掌破凰，威震四方"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 60
    learning_cost:
      training: 130000
    requirement:
      level: 64
      career_family: "staff"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 220

  - key: "staff_fury_golddragon"
    name: "金掌绝龙"
    description: "医师正派3转技能，金掌绝龙，毁龙灭敌"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 70
    learning_cost:
      training: 141000
    requirement:
      level: 68
      career_family: "staff"
      min_transfer: 3
      faction: "positive"
    effect:
      value: 250

  # ===== 医师邪派3转武功 =====
  - key: "staff_fury_supreme_mountain"
    name: "独尊移山"
    description: "医师邪派3转技能，独尊之功，移山填海"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 50
    learning_cost:
      training: 120000
    requirement:
      level: 60
      career_family: "staff"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 180

  - key: "staff_fury_supreme_sea"
    name: "独尊填海"
    description: "医师邪派3转技能，独尊填海，威不可挡"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 60
    learning_cost:
      training: 130000
    requirement:
      level: 64
      career_family: "staff"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 220

  - key: "staff_fury_supreme_gold"
    name: "独尊熔金"
    description: "医师邪派3转技能，独尊熔金，无坚不摧"
    type: "damage"
    target: "single"
    coolDown: 1000
    cost:
      mp: 70
    learning_cost:
      training: 141000
    requirement:
      level: 68
      career_family: "staff"
      min_transfer: 3
      faction: "negative"
    effect:
      value: 250

  # ===== 医师治疗武功 =====
  - key: "staff_fury_heal"
    name: "运气疗伤"
    description: "医师1转技能，运气疗伤，回复生命"
    type: "heal"
    target: "single"
    coolDown: 1000
    cost:
      mp: 10
    learning_cost:
      training: 0
    requirement:
      level: 1
      career_family: "staff"
      min_transfer: 0
    effect:
      value: 110

  - key: "staff_fury_restore"
    name: "回气疗伤"
    description: "医师1转技能，回气疗伤，恢复能力更强"
    type: "heal"
    target: "single"
    coolDown: 1000
    cost:
      mp: 15
    learning_cost:
      training: 150
    requirement:
      level: 15
      career_family: "staff"
      min_transfer: 1
    effect:
      value: 160

  - key: "staff_fury_gatherheal"
    name: "聚气疗伤"
    description: "医师2转技能，聚气疗伤，群体治愈，可治疗4个队友"
    type: "heal"
    target: "aoe"
    coolDown: 1000
    cost:
      mp: 50
    learning_cost:
      training: 10000
    requirement:
      level: 35
      career_family: "staff"
      min_transfer: 2
    effect:
      value: 180
      target_count: 4

  - key: "staff_fury_taiji"
    name: "太极五行"
    description: "医师1转技能，太极五行，增加20%攻击力"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 20
    learning_cost:
      training: 1500
    requirement:
      level: 20
      career_family: "staff"
      min_transfer: 1
    effect:
      value: 0.2
      buff_key: "atk_up_20"

  - key: "staff_fury_bagua"
    name: "太极八卦"
    description: "医师1转技能，太极八卦，增加5%防御力"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 25
    learning_cost:
      training: 3500
    requirement:
      level: 30
      career_family: "staff"
      min_transfer: 1
    effect:
      value: 0.05
      buff_key: "def_up_5"

  - key: "staff_fury_gangqi"
    name: "太极罡气"
    description: "医师1转技能，太极罡气，增加10%防御力"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 5000
    requirement:
      level: 30
      career_family: "staff"
      min_transfer: 1
    effect:
      value: 0.1
      buff_key: "def_up_10"

  - key: "staff_fury_strengthen"
    name: "强筋健体"
    description: "医师2转技能，强筋健体，增加10%命中率"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 30
    learning_cost:
      training: 20000
    requirement:
      level: 40
      career_family: "staff"
      min_transfer: 2
    effect:
      value: 0.1
      buff_key: "hit_up_10"

  - key: "staff_fury_agile"
    name: "身轻如燕"
    description: "医师2转技能，身轻如燕，增加10%回避率"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 40
    learning_cost:
      training: 32000
    requirement:
      level: 45
      career_family: "staff"
      min_transfer: 2
    effect:
      value: 0.1
      buff_key: "dodge_up_10"

  - key: "staff_fury_hpboost"
    name: "九转回心"
    description: "医师2转技能，九转回心，增加10%最大生命值"
    type: "buff"
    target: "single"
    coolDown: 1000
    cost:
      mp: 45
    learning_cost:
      training: 43000
    requirement:
      level: 55
      career_family: "staff"
      min_transfer: 2
    effect:
      value: 0.1
      buff_key: "maxhp_up_10"

4.2 气功系统

# ========== [可配置] 气功规则 ==========
# 气功说明：
# - 玩家可直接在气功界面看到已解锁的气功
# - 气功解锁范围根据角色等级和转职情况展示
# - 每个气功可投入1~20点气功点，每点消耗1点气功点
# - 气功效果由 base_value + 投入点数 × value_per_level 计算
# - 气功只支持加点，不支持减点，重置时一次性清零所有气功加点

qigong_template:
  key: "气功唯一标识"
  name: "气功名称"
  description: "气功描述"

  # 职业系限制（支持多职业系）
  career_family: ["blade"]  # 可为单值或数组，如 ["blade", "sword"]

  # 显示条件（转职次数+等级）
  unlock:
    min_transfer: 1       # 最低转职次数
    min_level: 10         # 最低等级

  # 最大等级（气功可投入的最大点数，统一为20）
  max_level: 20

  # 气功效果
  effect:
    type: "atkMin"        # 属性类型（见下方列表）
    base_value: 0         # 基础效果（投入1点时的效果）
    value_per_level: 5    # 每级增加效果值

  # 消耗
  cost:
    attribute_point: 1     # 每级消耗1点气功点

# ========== [可配置] 气功属性类型 ==========
# 气功可加成的属性类型

qigong_effect_types:
  - atkMin           # 最小攻击力
  - atkMax           # 最大攻击力
  - def              # 防御力
  - maxHp            # 生命值
  - maxMp            # 内功
  - missing           # 闪避率
  - hit              # 命中率
  - weapon_skill_bonus  # 武功攻击力
  - critR            # 暴击率
  - critB            # 暴击伤害
  - block            # 格挡率
  - hpRecovery        # 生命恢复
  - mpRecovery        # 内功恢复
  - leech            # 生命汲取
  - mf               # 魔法掉落率
  - gf               # 金币掉落率

# ========== [可配置] 气功属性点规则 ==========

attribute_points:
  # 初始气功点（1级角色自带）
  initial: 1

  # 获取方式：升级获得
  gain_per_level: |
    if player.level < 35:
        return 1    # 35级以前，每级1点
    else:
        return 2    # 35级及以上，每级2点

  # 气功点上限
  max_points: 999

  # 重置机制
  reset:
    enabled: true
    cost: |
      reset_count = player.attribute_reset_count
      return 10000 * (10 ** reset_count)  # 第1次10000，第2次100000，第3次1000000，以此类推
    behavior: |
      # 重置所有气功的加点为0，返还对应气功点数给玩家
      refunded_points = sum(player.qigong_invested_points)  # 累加所有气功已投入的点数
      player.all_qigong_points = 0
      player.available_points += refunded_points
      player.attribute_reset_count += 1

4.2.1 气功数据配置

# ========== [可配置] 气功列表 ==========
# 气功按职业系划分，达到转职次数和等级条件后显示

qigongs:
  # ===== 刀客气功 =====
  - key: "blade_qigong_atk_min"
    name: "力劈华山"
    description: "增加最小攻击力"
    career_family: "blade"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "atkMin"
      base_value: 0
      value_per_level: 0.01  # 每级+1%
    cost:
      attribute_point: 1

  - key: "blade_qigong_hit"
    name: "摄魂一击"
    description: "增加命中率"
    career_family: "blade"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "hit"
      base_value: 0.10  # 投入1点+11%
      value_per_level: 0.01  # 每级+1%
    cost:
      attribute_point: 1

  - key: "blade_qigong_counter"
    name: "四两千金"
    description: "受到攻击时按一定几率返还伤害给对方"
    career_family: "blade"
    unlock:
      min_transfer: 1
      min_level: 10
    effect:
      type: "counter_damage"
      base_value: 0.10  # 投入1点+11%反伤几率
      value_per_level: 0.01  # 每级+1%反伤几率
      counter_rate: 1.0  # 反伤比例（100%伤害）
    cost:
      attribute_point: 1

  - key: "blade_qigong_armor_break"
    name: "霸气破甲"
    description: "攻击时一定几率减少对方20%防御力，仅对当次攻击生效，每级增加1%破甲几率"
    career_family: "blade"
    unlock:
      min_transfer: 2
      min_level: 35
    effect:
      type: "armor_break"
      base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
      value_per_level: 0.01  # 每级+1%破甲几率
      armor_break_def_reduce: 0.20  # 破甲效果：减少目标20%防御力
    cost:
      attribute_point: 1

  # ===== 剑客气功 =====
  - key: "sword_qigong_atk_max"
    name: "长虹贯日"
    description: "增加最大攻击力"
    career_family: "sword"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "atkMax"
      base_value: 0
      value_per_level: 0.01  # 每级+1%最大攻击力
    cost:
      attribute_point: 1

  - key: "sword_qigong_dodge"
    name: "百变神行"
    description: "增加回避率"
    career_family: "sword"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "missing"
      base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
      value_per_level: 0.01  # 每级+1%
    cost:
      attribute_point: 1

  - key: "sword_qigong_combo"
    name: "连环飞舞"
    description: "增加连击几率"
    career_family: ["sword", "blade", "spear"]
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "combo"  # 连击几率（触发连击时一次攻击变为3次）
      base_value: 0.10  # 投入1点时+11%
      value_per_level: 0.01  # 每级+1%
      combo_hits: 3  # 连击触发次数
    cost:
      attribute_point: 1

  - key: "sword_qigong_shield"
    name: "护身罡气"
    description: "受到攻击时有一定几率降低50%伤害"
    career_family: "sword"
    unlock:
      min_transfer: 1
      min_level: 10
    effect:
      type: "damage_reduce"
      base_value: 0.10  # 投入1点+11%
      value_per_level: 0.01  # 每级+1%
      damage_reduce_rate: 0.5  # 触发时伤害减半
    cost:
      attribute_point: 1

  - key: "sword_qigong_leech"
    name: "移花接木"
    description: "攻击时按一定几率吸血，回复造成伤害的20%生命"
    career_family: "sword"
    unlock:
      min_transfer: 2
      min_level: 35
    effect:
      type: "leech"
      base_value: 0
      value_per_level: 0.004  # 每级+0.4%触发几率
      leech_rate: 0.20  # 触发时回复20%伤害的生命
    cost:
      attribute_point: 1

  - key: "sword_qigong_skill_atk"
    name: "回柳身法"
    description: "增加武功攻击力"
    career_family: "sword"
    unlock:
      min_transfer: 3
      min_level: 60
    effect:
      type: "weapon_skill_bonus"
      base_value: 0
      value_per_level: 0.006  # 每级+0.6%
    cost:
      attribute_point: 1

  # ===== 枪客气功 =====
  - key: "spear_qigong_def"
    name: "金钟罡气"
    description: "提高防御力，每级增加1防御"
    career_family: "spear"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "def"
      base_value: 0
      value_per_level: 1  # 每级+1防御
    cost:
      attribute_point: 1

  - key: "spear_qigong_heal"
    name: "运气疗伤"
    description: "提高运气疗伤的能力，每级增加1%生命药剂治疗效果"
    career_family: "spear"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "heal_bonus"
      base_value: 0
      value_per_level: 0.01  # 每级+1%生命药剂治疗效果
    cost:
      attribute_point: 1

  - key: "spear_qigong_hp"
    name: "横练太保"
    description: "提高生命值，每级增加8生命值"
    career_family: "spear"
    unlock:
      min_transfer: 1
      min_level: 10
    effect:
      type: "maxHp"
      base_value: 0
      value_per_level: 8  # 每级+8生命值
    cost:
      attribute_point: 1

  - key: "spear_qigong_skill_atk"
    name: "乾坤挪移"
    description: "提高武功攻击力，每级增加1.5%武功攻击力"
    career_family: "spear"
    unlock:
      min_transfer: 2
      min_level: 35
    effect:
      type: "weapon_skill_bonus"
      base_value: 0
      value_per_level: 0.015  # 每级+1.5%武功攻击力
    cost:
      attribute_point: 1

  - key: "spear_qigong_skill_def"
    name: "灵甲护身"
    description: "提高武功防御力，每级增加3武功防御力"
    career_family: "spear"
    unlock:
      min_transfer: 2
      min_level: 60
    effect:
      type: "mdef"
      base_value: 0
      value_per_level: 3  # 每级+3武功防御力
    cost:
      attribute_point: 1

  # ===== 医师气功 =====
  - key: "staff_qigong_mp_reduce"
    name: "太极心法"
    description: "减少使用武功时消耗的内功值，每级提高1%内力消耗减少"
    career_family: "staff"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "mp_cost_reduce"
      base_value: 0
      value_per_level: 0.01  # 每级+1%内力消耗减少
    cost:
      attribute_point: 1

  - key: "staff_qigong_maxhp"
    name: "体血倍增"
    description: "增加最大生命值，每级提高1%的最大生命值"
    career_family: "staff"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "maxHp"
      base_value: 0
      value_per_level: 0.01  # 每级+1%最大生命值
    cost:
      attribute_point: 1

  - key: "staff_qigong_maxmp"
    name: "洗髓易筋"
    description: "增加最大内功值，每级提高1%的最大内功值"
    career_family: "staff"
    unlock:
      min_transfer: 0
      min_level: 1
    effect:
      type: "maxMp"
      base_value: 0
      value_per_level: 0.01  # 每级+1%最大内功值
    cost:
      attribute_point: 1

  - key: "staff_qigong_skill_atk"
    name: "长攻击力"
    description: "提升武功攻击力，每级提高2%的武功攻击力"
    career_family: "staff"
    unlock:
      min_transfer: 1
      min_level: 10
    effect:
      type: "weapon_skill_bonus"
      base_value: 0
      value_per_level: 0.02  # 每级+2%武功攻击力
    cost:
      attribute_point: 1

  - key: "staff_qigong_buff_duration"
    name: "吸星大法"
    description: "延长辅助武功的生效时间，每级提高15秒"
    career_family: "staff"
    unlock:
      min_transfer: 2
      min_level: 35
    effect:
      type: "buff_duration"
      base_value: 0
      value_per_level: 15  # 每级+15秒
    cost:
      attribute_point: 1

  - key: "staff_qigong_mp_recovery_bonus"
    name: "运气行心"
    description: "增加内功药剂的恢复量，每级提高1%内功恢复加成"
    career_family: "staff"
    unlock:
      min_transfer: 3
      min_level: 60
    effect:
      type: "mp_recovery_bonus"
      base_value: 0
      value_per_level: 0.01  # 每级+1%内功恢复加成
    cost:
      attribute_point: 1

  # ===== 通用气功 =====
  - key: "common_qigong_skill_crit"
    name: "真武绝击"
    description: "提高武功致命打击出现的概率，触发时当次武功伤害提高50%，每级增加1%几率"
    career_family: "blade"
    unlock:
      min_transfer: 3
      min_level: 60
    effect:
      type: "skill_crit_rate"
      base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
      value_per_level: 0.01  # 每级+1%真武绝击几率
      skill_crit_damage_bonus: 0.50  # 触发真武绝击时，当次武功伤害提高50%
    cost:
      attribute_point: 1

4.3 Buff系统


# ========== [可配置] Buff定义模板 ==========

buff_template:
  key: "buff唯一标识"
  name: "Buff名称"
  description: "Buff描述"

  # 持续时间（毫秒），-1表示永久
  duration: 5000

  # 是否可叠加
  stackable: false
  max_stacks: 1

  # 是否可被驱散
  dispellable: true

  # 是否为负面效果
  is_debuff: false

  # 效果类型
  effect_type: "attribute"     # attribute(属性修改) / dot(持续伤害) / hot(持续治疗) / special(特殊)

  # 属性修改
  attribute_mods:
    atk: 0.1                   # +10% 攻击力
    def: 50                    # +50 防御力

  # 特殊效果
  special_effects:
    - type: "immune_damage"    # 免疫伤害
    - type: "reflect_damage"   # 反弹伤害
      value: 0.2               # 反弹20%

# ========== [可配置] Buff列表 ==========

buffs:
  # ===== 增益Buff =====
  - key: "shield_wall_buff"
    name: "盾墙"
    description: "防御力大幅提升"
    duration: 10000
    stackable: false
    is_debuff: false
    effect_type: "attribute"
    attribute_mods:
      def: 200

  - key: "divine_shield_buff"
    name: "圣盾术"
    description: "免疫所有伤害"
    duration: 5000
    stackable: false
    is_debuff: false
    effect_type: "special"
    special_effects:
      - type: "immune_damage"
        value: 1.0

  - key: "rage_buff"
    name: "狂暴"
    description: "攻击力提升，防御力降低"
    duration: 15000
    stackable: false
    is_debuff: false
    effect_type: "attribute"
    attribute_mods:
      atk: 0.5                 # +50% 攻击
      def: -50                 # -50 防御

  # ===== 减益Buff =====
  - key: "slow_debuff"
    name: "减速"
    description: "移动速度和攻击速度降低"
    duration: 3000
    stackable: false
    is_debuff: true
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      speed: -0.3              # -30% 速度

  - key: "poison_debuff"
    name: "中毒"
    description: "持续受到毒素伤害"
    duration: 5000
    stackable: true
    max_stacks: 5
    is_debuff: true
    dispellable: true
    effect_type: "dot"
    dot:
      formula: "int * 0.1"
      interval: 1000           # 每1秒跳一次伤害

  # ===== 医师增益Buff =====
  - key: "atk_up_20"
    name: "攻击提升"
    description: "最小和最大攻击力各提升20%"
    duration: 60000               # 1分钟
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      atkMin: 0.20                # +20% 最小攻击力
      atkMax: 0.20                # +20% 最大攻击力

  - key: "def_up_5"
    name: "防御提升"
    description: "防御力提升5%"
    duration: -1
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      def: 0.05                # +5% 防御力

  - key: "def_up_10"
    name: "防御提升"
    description: "防御力提升10%"
    duration: -1
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      def: 0.10                # +10% 防御力

  - key: "hit_up_10"
    name: "命中提升"
    description: "命中率提升10%"
    duration: -1
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      hit: 0.10                 # +10% 命中率

  - key: "dodge_up_10"
    name: "回避提升"
    description: "回避率提升10%"
    duration: -1
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      missing: 0.10             # +10% 回避率

  - key: "maxhp_up_10"
    name: "生命提升"
    description: "最大生命值提升10%"
    duration: -1
    stackable: false
    is_debuff: false
    dispellable: true
    effect_type: "attribute"
    attribute_mods:
      maxHp: 0.10               # +10% 最大生命值


---

5. 装备系统

5.1 装备槽位定义

# ========== [可配置] 装备槽位 ==========
equipment_slots:
  - key: "weapon"
    name: "武器"
    description: "主手武器"

  - key: "chest"
    name: "胸甲"
    description: "躯干防具"    
    
  - key: "gloves"
    name: "手套"
    description: "手部防具"

  - key: "boots"
    name: "鞋子"
    description: "脚部防具"

  - key: "ring"
    name: "戒指"
    description: "饰品 - 戒指"
    max_count: 2
    
  - key: "earring"
    name: "耳环"
    description: "饰品 - 耳环"
    max_count: 2

  - key: "amulet"
    name: "项链"
    description: "饰品 - 项链"

  - key: "inner_armor"
    name: "内甲"
    description: "内甲防具"

  - key: "cape"
    name: "披风"
    description: "披风"

5.3 装备词缀系统

# ========== [可配置] 词缀池 ==========
# 词缀用于随机生成装备属性

affixes:
  # ===== 基础属性词缀 =====
  - key: "maxHp"
    name: "生命值"
    display_template: "生命值 + {value}"
    weight: 1.5               # 词缀权重
    valid_positions:          # 可出现的装备槽位
      - "ring"
      - "amulet"
      - "earring"
    generate_formula: "level * 2"
    hooks:
      maxHpAdd: "value"

  - key: "maxMp"
    name: "内功"
    display_template: "内功 + {value}"
    weight: 1.5
    valid_positions: ["ring", "amulet", "earring", "weapon"]
    generate_formula: "level * 2"
    hooks:
      maxMpAdd: "value"

  - key: "atk"
    name: "攻击力"
    display_template: "攻击力 + {min_value}~{max_value}"
    weight: 1.0
    valid_positions: ["weapon", "ring", "amulet"]
    generate_formula_min: "level * 0.4"       # 最小攻击力词缀生成公式
    generate_formula_max: "level * 0.6"       # 最大攻击力词缀生成公式
    hooks:
      atk_self_Add: "value"                   # 词缀值同时加到atkMin和atkMax

5.4 装备模板定义

# ========== [可配置] 武器模板 ==========
# 复制此模板创建新武器

weapon_template:
  key: "{weapon_type}_{faction}_{career_stage}"   # 如: blade_positive_t2
  name: "装备名称"
  slot: "weapon"
  type: "weapon"

  faction: "neutral"              # neutral=通用(1转前), positive=正派, negative=邪派
  required_level: 1               # 最小等级下限（≥N）
  required_career: ["blade"]      # 可用职业列表（刀/剑/枪/弓/法杖对应职业key）
  required_transfer: 0             # 需要的转职次数（0=无要求, 1=1转, 2=2转...）

  base_stats:
    atkMin: 10                    # 最小攻击力
    atkMax: 15                   # 最大攻击力

  price: 100                    # 购买价格（金币）
  sell_price: "required_level < 35 ? required_level × 100 : required_level × 1000"  # 出售价格（金币，35级以下×100，35级及以上×1000）

# ========== [可配置] 防具模板 ==========
# 衣服、护手、靴子通用此模板

armor_template:
  key: "{slot}_{faction}_{career_stage}"   # 如: chest_positive_t3
  name: "装备名称"
  slot: "chest"                  # chest/gloves/boots
  type: "armor"

  faction: "neutral"             # neutral=通用, positive=正派, negative=邪派
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 10                      # 防御力

  price: 80                     # 购买价格（金币）
  purchaseable: true            # 是否可购买（true/false）
  sell_price: "required_level × 20"  # 出售价格（金币）

# ========== [可配置] 内甲模板 ==========

inner_armor_template:
  key: "{slot}_{quality}"        # 如: inner_armor_rare
  name: "装备名称"
  slot: "inner_armor"
  type: "armor"

  faction: "neutral"             # 无正邪派限制，所有角色通用
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 5                       # 防御力

  price: 50                     # 购买价格（金币）
  sell_price: "required_level × 500"  # 出售价格（金币）

# ========== [可配置] 项链模板 ==========

amulet_template:
  key: "{slot}_{quality}_{level}"  # 如: amulet_epic_50
  name: "装备名称"
  slot: "amulet"
  type: "accessory"

  faction: "neutral"             # 无阵营限制
  required_level: 1
  required_transfer: 0

  base_stats:
    missing: 5                   # 回避率（基准词条）
    # 可选扩展（部分装备包含）：
    hit: 0                        # 命中率
    maxHp: 0                     # 生命值
    maxMp: 0                     # 内功值

  price: 80                     # 购买价格（金币）
  sell_price: "required_level × 500"  # 出售价格（金币）

# ========== [可配置] 耳环模板 ==========

earring_template:
  key: "{slot}_{quality}_{level}"  # 如: earring_rare_30
  name: "装备名称"
  slot: "earring"
  type: "accessory"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    maxHp: 20                     # 生命值（基准词条）
    # 可选扩展（部分装备包含）：
    qigong: 0                     # 气功+1/+2（升级自由分配点数）
    maxMp: 0                     # 内功值

  price: 80                     # 购买价格（金币）
  sell_price: "required_level × 500"  # 出售价格（金币）

# ========== [可配置] 戒指模板 ==========

ring_template:
  key: "{slot}_{quality}_{level}"  # 如: ring_legendary_70
  name: "装备名称"
  slot: "ring"
  type: "accessory"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    hit: 5                        # 命中率（基准词条）
    # 可选扩展（部分装备包含）：
    atkMin: 0                      # 最小攻击力
    atkMax: 0                     # 最大攻击力

  price: 80                     # 购买价格（金币）
  sell_price: "required_level × 500"  # 出售价格（金币）

# ========== [可配置] 披风模板 ==========

cape_template:
  key: "{slot}_{quality}"         # 如: cape_legendary
  name: "装备名称"
  slot: "cape"
  type: "armor"

  faction: "neutral"
  required_level: 0               # 无等级要求
  required_transfer: 0

  base_stats: {}                  # 无词条属性

  price: 10                     # 购买价格（金币）
  sell_price: 1                # 出售价格（金币）

# ========== [可配置] 装备通用字段说明 ==========
# ==============================
# 通用字段说明
# ==============================
# faction: neutral=通用(无阵营要求), positive=正派, negative=邪派
# required_level: 最小等级下限（≥N）
# required_transfer: 需要的转职次数（0=无要求, 1=1转, 2=2转...）
# ==============================
# 各槽位词条属性
# ==============================
# weapon:   atkMin ~ atkMax（最小攻击力~最大攻击力）
# chest:    def（防御力）
# gloves:   def（防御力）
# boots:    def（防御力）
# inner_armor: def（防御力）
# amulet:   missing（回避率，基准）；可扩展 hit/maxHp/maxMp
# earring:  maxHp（生命值，基准）；可扩展 qigong/maxMp
# ring:     hit（命中率，基准）；可扩展 atkMin~atkMax
# cape:     无词条属性
# ==============================

# cape:     无词条属性
# ==============================

# ========== [可配置] 装备列表 ==========

equipments:
  # ===== 刀客武器（全部派系） =====
  # --- base（1级，neutral）---
  - key: "blade_base_001"
    name: "直刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["blade"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 8
      atkMax: 12

  - key: "blade_base_002"
    name: "铁刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["blade"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 12
      atkMax: 20

  # --- t1（≥10级，neutral）---
  - key: "blade_t1_001"
    name: "钢刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 18
      atkMax: 31

  - key: "blade_t1_002"
    name: "半月刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 24
      atkMax: 37

  - key: "blade_t1_003"
    name: "精钢刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 32
      atkMax: 53

  - key: "blade_t1_004"
    name: "雁月刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 40
      atkMax: 61

  - key: "blade_t1_005"
    name: "赤血刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 50
      atkMax: 75

  - key: "blade_t1_006"
    name: "重曲刀"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 62
      atkMax: 83

  # --- t2（≥35级）---
  # 正派
  - key: "blade_t2_positive_001"
    name: "闪电刀"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 56
      atkMax: 78

  - key: "blade_t2_positive_002"
    name: "百战刀"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 75
      atkMax: 102

  - key: "blade_t2_positive_003"
    name: "青龙刀"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 96
      atkMax: 128

  - key: "blade_t2_positive_004"
    name: "深渊刀"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 113
      atkMax: 152

  # 邪派
  - key: "blade_t2_negative_001"
    name: "寒铁刀"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 56
      atkMax: 78

  - key: "blade_t2_negative_002"
    name: "白月刀"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 75
      atkMax: 102

  - key: "blade_t2_negative_003"
    name: "破仙刀"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 96
      atkMax: 128

  - key: "blade_t2_negative_004"
    name: "城碧刀"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 113
      atkMax: 152

  # --- t3（≥60级）---
  # 正派
  - key: "blade_t3_positive_001"
    name: "飞翔刀"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 133
      atkMax: 168

  - key: "blade_t3_positive_002"
    name: "百魂刀"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 160
      atkMax: 203

  - key: "blade_t3_positive_003"
    name: "渤海刀"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 194
      atkMax: 247

  # 邪派
  - key: "blade_t3_negative_001"
    name: "斩魔刀"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 133
      atkMax: 168

  - key: "blade_t3_negative_002"
    name: "磐龙刀"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 160
      atkMax: 203

  - key: "blade_t3_negative_003"
    name: "血吟刀"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 194
      atkMax: 247

  # ===== 剑客武器（全部派系） =====
  # --- base（1级，neutral）---
  - key: "sword_base_001"
    name: "木剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["sword"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 10
      atkMax: 15

  - key: "sword_base_002"
    name: "重剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["sword"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 15
      atkMax: 25

  # --- t1（≥10级，neutral）---
  - key: "sword_t1_001"
    name: "钢剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 22
      atkMax: 35

  - key: "sword_t1_002"
    name: "水月剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 28
      atkMax: 43

  - key: "sword_t1_003"
    name: "月花剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 36
      atkMax: 50

  - key: "sword_t1_004"
    name: "赤星剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 48
      atkMax: 62

  - key: "sword_t1_005"
    name: "青锋剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 60
      atkMax: 74

  - key: "sword_t1_006"
    name: "金月剑"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 72
      atkMax: 87

  # --- t2（≥35级）---
  # 正派
  - key: "sword_t2_positive_001"
    name: "血锋剑"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 88
      atkMax: 103

  - key: "sword_t2_positive_002"
    name: "天命剑"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 104
      atkMax: 119

  - key: "sword_t2_positive_003"
    name: "寒月剑"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 120
      atkMax: 135

  - key: "sword_t2_positive_004"
    name: "青魄剑"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 136
      atkMax: 151

  # 邪派
  - key: "sword_t2_negative_001"
    name: "赤火剑"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 88
      atkMax: 103

  - key: "sword_t2_negative_002"
    name: "神影剑"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 104
      atkMax: 119

  - key: "sword_t2_negative_003"
    name: "血魔剑"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 120
      atkMax: 135

  - key: "sword_t2_negative_004"
    name: "血河剑"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 136
      atkMax: 151

  # --- t3（≥60级）---
  # 正派
  - key: "sword_t3_positive_001"
    name: "流光剑"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 156
      atkMax: 171

  - key: "sword_t3_positive_002"
    name: "新月剑"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 169
      atkMax: 191

  - key: "sword_t3_positive_003"
    name: "天地剑"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 189
      atkMax: 211

  # 邪派
  - key: "sword_t3_negative_001"
    name: "斩玄剑"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 156
      atkMax: 171

  - key: "sword_t3_negative_002"
    name: "赤朱剑"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 169
      atkMax: 191

  - key: "sword_t3_negative_003"
    name: "逐日追风剑"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 189
      atkMax: 211

  # ===== 法杖武器（全部派系） =====
  # --- base（1级，neutral）---
  - key: "staff_base_001"
    name: "木杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["staff"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 8
      atkMax: 10

  - key: "staff_base_002"
    name: "桃木杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["staff"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 10
      atkMax: 15

  # --- t1（≥10级，neutral）---
  - key: "staff_t1_001"
    name: "越女杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 15
      atkMax: 20

  - key: "staff_t1_002"
    name: "太月杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 20
      atkMax: 26

  - key: "staff_t1_003"
    name: "碧玉杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 32
      atkMax: 38

  - key: "staff_t1_004"
    name: "檀香杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 38
      atkMax: 46

  - key: "staff_t1_005"
    name: "太乙杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 54
      atkMax: 62

  - key: "staff_t1_006"
    name: "百花杖"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 62
      atkMax: 72

  # --- t2（≥35级）---
  # 正派
  - key: "staff_t2_positive_001"
    name: "雁离杖"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 78
      atkMax: 88

  - key: "staff_t2_positive_002"
    name: "九锡杖"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 94
      atkMax: 104

  - key: "staff_t2_positive_003"
    name: "火欲杖"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 112
      atkMax: 122

  - key: "staff_t2_positive_004"
    name: "龙骨杖"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 122
      atkMax: 132

  # 邪派
  - key: "staff_t2_negative_001"
    name: "血仙杖"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 78
      atkMax: 88

  - key: "staff_t2_negative_002"
    name: "九天杖"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 94
      atkMax: 104

  - key: "staff_t2_negative_003"
    name: "鬼泣杖"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 112
      atkMax: 122

  - key: "staff_t2_negative_004"
    name: "赤魔杖"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 122
      atkMax: 132

  # --- t3（≥60级）---
  # 正派
  - key: "staff_t3_positive_001"
    name: "鬼头杖"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 132
      atkMax: 143

  - key: "staff_t3_positive_002"
    name: "寒龙杖"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 153
      atkMax: 168

  - key: "staff_t3_positive_003"
    name: "圣天神杖"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 167
      atkMax: 182

  # 邪派
  - key: "staff_t3_negative_001"
    name: "冥蛇杖"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 132
      atkMax: 143

  - key: "staff_t3_negative_002"
    name: "万绝神杖"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 153
      atkMax: 168

  - key: "staff_t3_negative_003"
    name: "蚀天魔杖"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 167
      atkMax: 182

  # ===== 枪客武器（全部派系） =====
  # --- base（1级，neutral）---
  - key: "spear_base_001"
    name: "木枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["spear"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 12
      atkMax: 18

  - key: "spear_base_002"
    name: "长枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["spear"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 17
      atkMax: 27

  # --- t1（≥10级，neutral）---
  - key: "spear_t1_001"
    name: "流星枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 24
      atkMax: 35

  - key: "spear_t1_002"
    name: "月牙枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 29
      atkMax: 43

  - key: "spear_t1_003"
    name: "狼牙枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 41
      atkMax: 55

  - key: "spear_t1_004"
    name: "赤蛇枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 53
      atkMax: 67

  - key: "spear_t1_005"
    name: "天焰枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 65
      atkMax: 79

  - key: "spear_t1_006"
    name: "飞龙枪"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 77
      atkMax: 92

  # --- t2（≥35级）---
  # 正派
  - key: "spear_t2_positive_001"
    name: "月影枪"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 93
      atkMax: 108

  - key: "spear_t2_positive_002"
    name: "天翎枪"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 109
      atkMax: 124

  - key: "spear_t2_positive_003"
    name: "七星枪"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 125
      atkMax: 140

  - key: "spear_t2_positive_004"
    name: "益宣枪"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 141
      atkMax: 156

  # 邪派
  - key: "spear_t2_negative_001"
    name: "龙泉枪"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 93
      atkMax: 108

  - key: "spear_t2_negative_002"
    name: "魅焰枪"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 109
      atkMax: 124

  - key: "spear_t2_negative_003"
    name: "噬魄枪"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 125
      atkMax: 140

  - key: "spear_t2_negative_004"
    name: "玄冥枪"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 141
      atkMax: 156

  # --- t3（≥60级）---
  # 正派
  - key: "spear_t3_positive_001"
    name: "九龙枪"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 161
      atkMax: 176

  - key: "spear_t3_positive_002"
    name: "神慧枪"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 175
      atkMax: 196

  - key: "spear_t3_positive_003"
    name: "磐龙破魔枪"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 194
      atkMax: 216

  # 邪派
  - key: "spear_t3_negative_001"
    name: "天诛枪"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 161
      atkMax: 176

  - key: "spear_t3_negative_002"
    name: "吟血魔枪"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 175
      atkMax: 196

  - key: "spear_t3_negative_003"
    name: "灭世断魂枪"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 194
      atkMax: 216

  # ===== 弓手武器（全部派系） =====
  # --- base（1级，neutral）---
  - key: "bow_base_001"
    name: "竹弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["archer"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 11
      atkMax: 16

  - key: "bow_base_002"
    name: "硬弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 1
    required_career: ["archer"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      atkMin: 15
      atkMax: 25

  # --- t1（≥10级，neutral）---
  - key: "bow_t1_001"
    name: "青木弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 22
      atkMax: 32

  - key: "bow_t1_002"
    name: "绿蛇弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 26
      atkMax: 40

  - key: "bow_t1_003"
    name: "青蛇弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 38
      atkMax: 51

  - key: "bow_t1_004"
    name: "草流弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 50
      atkMax: 62

  - key: "bow_t1_005"
    name: "六合弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 59
      atkMax: 72

  - key: "bow_t1_006"
    name: "天羽弓"
    slot: "weapon"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 1
    purchaseable: false
        base_stats:
      atkMin: 65
      atkMax: 88

  # --- t2（≥35级）---
  # 正派
  - key: "bow_t2_positive_001"
    name: "神谕弓"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 82
      atkMax: 100

  - key: "bow_t2_positive_002"
    name: "龙神弓"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 94
      atkMax: 112

  - key: "bow_t2_positive_003"
    name: "圣者弓"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 107
      atkMax: 125

  - key: "bow_t2_positive_004"
    name: "神臂弓"
    slot: "weapon"
    faction: "positive"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 131
      atkMax: 151

  # 邪派
  - key: "bow_t2_negative_001"
    name: "铁脊弓"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 82
      atkMax: 100

  - key: "bow_t2_negative_002"
    name: "血魂弓"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 94
      atkMax: 112

  - key: "bow_t2_negative_003"
    name: "天狼弓"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 107
      atkMax: 125

  - key: "bow_t2_negative_004"
    name: "魔音弓"
    slot: "weapon"
    faction: "negative"
    required_level: 35
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 131
      atkMax: 151

  # --- t3（≥60级）---
  # 正派
  - key: "bow_t3_positive_001"
    name: "封魔弓"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 162
      atkMax: 182

  - key: "bow_t3_positive_002"
    name: "紫灵弓"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 181
      atkMax: 201

  - key: "bow_t3_positive_003"
    name: "九天神弓"
    slot: "weapon"
    faction: "positive"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 196
      atkMax: 211

  # 邪派
  - key: "bow_t3_negative_001"
    name: "弑神弓"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 162
      atkMax: 182

  - key: "bow_t3_negative_002"
    name: "破甲弓"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 181
      atkMax: 201

  - key: "bow_t3_negative_003"
    name: "冥魂魔弓"
    slot: "weapon"
    faction: "negative"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 196
      atkMax: 211

  # ===== 刀客防具（衣服） =====
  # --- base（neutral）---
  - key: "blade_chest_base_001"
    name: "无名战袍"
    slot: "chest"
    faction: "neutral"
    required_level: 10
    required_career: ["blade"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 12

  - key: "blade_chest_base_002"
    name: "金丝战袍"
    slot: "chest"
    faction: "neutral"
    required_level: 20
    required_career: ["blade"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 16

  - key: "blade_chest_base_003"
    name: "乌蚕战袍"
    slot: "chest"
    faction: "neutral"
    required_level: 30
    required_career: ["blade"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 20

  # --- t2（≥35级）---
  # 正派
  - key: "blade_chest_t2_positive_001"
    name: "龙虎战袍"
    slot: "chest"
    faction: "positive"
    required_level: 40
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 24

  - key: "blade_chest_t2_positive_002"
    name: "封神战袍"
    slot: "chest"
    faction: "positive"
    required_level: 50
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 28

  # 邪派
  - key: "blade_chest_t2_negative_001"
    name: "破天战袍"
    slot: "chest"
    faction: "negative"
    required_level: 40
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 24

  - key: "blade_chest_t2_negative_002"
    name: "赤龙战袍"
    slot: "chest"
    faction: "negative"
    required_level: 50
    required_career: ["blade"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 28

  # --- t3（≥60级）---
  # 正派
  - key: "blade_chest_t3_positive_001"
    name: "昊天战袍"
    slot: "chest"
    faction: "positive"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 32

  - key: "blade_chest_t3_positive_002"
    name: "广寒战袍"
    slot: "chest"
    faction: "positive"
    required_level: 70
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 38

  # 邪派
  - key: "blade_chest_t3_negative_001"
    name: "雪天战袍"
    slot: "chest"
    faction: "negative"
    required_level: 60
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 32

  - key: "blade_chest_t3_negative_002"
    name: "地藏战袍"
    slot: "chest"
    faction: "negative"
    required_level: 70
    required_career: ["blade"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 38

  # --- t4（≥80级）---
  # 正派
  - key: "blade_chest_t4_positive_001"
    name: "月神战袍"
    slot: "chest"
    faction: "positive"
    required_level: 80
    required_career: ["blade"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 50

  # 邪派
  - key: "blade_chest_t4_negative_001"
    name: "凝血战袍"
    slot: "chest"
    faction: "negative"
    required_level: 80
    required_career: ["blade"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 50

  # ===== 剑客防具（衣服） =====
  # --- base（neutral）---
  - key: "sword_chest_base_001"
    name: "无名侠衣"
    slot: "chest"
    faction: "neutral"
    required_level: 10
    required_career: ["sword"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 10

  - key: "sword_chest_base_002"
    name: "金丝侠衣"
    slot: "chest"
    faction: "neutral"
    required_level: 20
    required_career: ["sword"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 14

  - key: "sword_chest_base_003"
    name: "乌蚕侠衣"
    slot: "chest"
    faction: "neutral"
    required_level: 30
    required_career: ["sword"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 18

  # --- t2（≥35级）---
  # 正派
  - key: "sword_chest_t2_positive_001"
    name: "龙虎侠衣"
    slot: "chest"
    faction: "positive"
    required_level: 40
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  - key: "sword_chest_t2_positive_002"
    name: "封神侠衣"
    slot: "chest"
    faction: "positive"
    required_level: 50
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 24

  # 邪派
  - key: "sword_chest_t2_negative_001"
    name: "破天侠衣"
    slot: "chest"
    faction: "negative"
    required_level: 40
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  - key: "sword_chest_t2_negative_002"
    name: "赤龙侠衣"
    slot: "chest"
    faction: "negative"
    required_level: 50
    required_career: ["sword"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 24

  # --- t3（≥60级）---
  # 正派
  - key: "sword_chest_t3_positive_001"
    name: "昊天侠衣"
    slot: "chest"
    faction: "positive"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 28

  - key: "sword_chest_t3_positive_002"
    name: "广寒侠衣"
    slot: "chest"
    faction: "positive"
    required_level: 70
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 34

  # 邪派
  - key: "sword_chest_t3_negative_001"
    name: "雪天侠衣"
    slot: "chest"
    faction: "negative"
    required_level: 60
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 28

  - key: "sword_chest_t3_negative_002"
    name: "地藏侠衣"
    slot: "chest"
    faction: "negative"
    required_level: 70
    required_career: ["sword"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 34

  # --- t4（≥80级）---
  # 正派
  - key: "sword_chest_t4_positive_001"
    name: "月神侠衣"
    slot: "chest"
    faction: "positive"
    required_level: 80
    required_career: ["sword"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 45

  # 邪派
  - key: "sword_chest_t4_negative_001"
    name: "凝血侠衣"
    slot: "chest"
    faction: "negative"
    required_level: 80
    required_career: ["sword"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 45

  # ===== 枪客防具（衣服） =====
  # --- base（neutral）---
  - key: "spear_chest_base_001"
    name: "无名枪衣"
    slot: "chest"
    faction: "neutral"
    required_level: 10
    required_career: ["spear"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 8

  - key: "spear_chest_base_002"
    name: "金丝枪衣"
    slot: "chest"
    faction: "neutral"
    required_level: 20
    required_career: ["spear"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 12

  - key: "spear_chest_base_003"
    name: "乌蚕枪衣"
    slot: "chest"
    faction: "neutral"
    required_level: 30
    required_career: ["spear"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 16

  # --- t2（≥35级）---
  # 正派
  - key: "spear_chest_t2_positive_001"
    name: "龙虎枪衣"
    slot: "chest"
    faction: "positive"
    required_level: 40
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 18

  - key: "spear_chest_t2_positive_002"
    name: "封神枪衣"
    slot: "chest"
    faction: "positive"
    required_level: 50
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 22

  # 邪派
  - key: "spear_chest_t2_negative_001"
    name: "破天枪衣"
    slot: "chest"
    faction: "negative"
    required_level: 40
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 18

  - key: "spear_chest_t2_negative_002"
    name: "赤龙枪衣"
    slot: "chest"
    faction: "negative"
    required_level: 50
    required_career: ["spear"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 22

  # --- t3（≥60级）---
  # 正派
  - key: "spear_chest_t3_positive_001"
    name: "昊天枪衣"
    slot: "chest"
    faction: "positive"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 26

  - key: "spear_chest_t3_positive_002"
    name: "广寒枪衣"
    slot: "chest"
    faction: "positive"
    required_level: 70
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 32

  # 邪派
  - key: "spear_chest_t3_negative_001"
    name: "雪天枪衣"
    slot: "chest"
    faction: "negative"
    required_level: 60
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 26

  - key: "spear_chest_t3_negative_002"
    name: "地藏枪衣"
    slot: "chest"
    faction: "negative"
    required_level: 70
    required_career: ["spear"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 32

  # --- t4（≥80级）---
  # 正派
  - key: "spear_chest_t4_positive_001"
    name: "月神枪衣"
    slot: "chest"
    faction: "positive"
    required_level: 80
    required_career: ["spear"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 42

  # 邪派
  - key: "spear_chest_t4_negative_001"
    name: "凝血枪衣"
    slot: "chest"
    faction: "negative"
    required_level: 80
    required_career: ["spear"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 42

  # ===== 医师防具（衣服） =====
  # --- base（neutral）---
  - key: "staff_chest_base_001"
    name: "无名法袍"
    slot: "chest"
    faction: "neutral"
    required_level: 10
    required_career: ["staff"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 6

  - key: "staff_chest_base_002"
    name: "金丝法袍"
    slot: "chest"
    faction: "neutral"
    required_level: 20
    required_career: ["staff"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 10

  - key: "staff_chest_base_003"
    name: "乌蚕法袍"
    slot: "chest"
    faction: "neutral"
    required_level: 30
    required_career: ["staff"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 14

  # --- t2（≥35级）---
  # 正派
  - key: "staff_chest_t2_positive_001"
    name: "龙虎法袍"
    slot: "chest"
    faction: "positive"
    required_level: 40
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 16

  - key: "staff_chest_t2_positive_002"
    name: "封神法袍"
    slot: "chest"
    faction: "positive"
    required_level: 50
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  # 邪派
  - key: "staff_chest_t2_negative_001"
    name: "破天法袍"
    slot: "chest"
    faction: "negative"
    required_level: 40
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 16

  - key: "staff_chest_t2_negative_002"
    name: "赤龙法袍"
    slot: "chest"
    faction: "negative"
    required_level: 50
    required_career: ["staff"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  # --- t3（≥60级）---
  # 正派
  - key: "staff_chest_t3_positive_001"
    name: "昊天法袍"
    slot: "chest"
    faction: "positive"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  - key: "staff_chest_t3_positive_002"
    name: "广寒法袍"
    slot: "chest"
    faction: "positive"
    required_level: 70
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 26

  # 邪派
  - key: "staff_chest_t3_negative_001"
    name: "雪天法袍"
    slot: "chest"
    faction: "negative"
    required_level: 60
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  - key: "staff_chest_t3_negative_002"
    name: "地藏法袍"
    slot: "chest"
    faction: "negative"
    required_level: 70
    required_career: ["staff"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 26

  # --- t4（≥80级）---
  # 正派
  - key: "staff_chest_t4_positive_001"
    name: "月神医衣"
    slot: "chest"
    faction: "positive"
    required_level: 80
    required_career: ["staff"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 35

  # 邪派
  - key: "staff_chest_t4_negative_001"
    name: "凝血医衣"
    slot: "chest"
    faction: "negative"
    required_level: 80
    required_career: ["staff"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 35

  # ===== 弓手防具（衣服） =====
  # --- base（neutral）---
  - key: "archer_chest_base_001"
    name: "无名战衣"
    slot: "chest"
    faction: "neutral"
    required_level: 10
    required_career: ["archer"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 6

  - key: "archer_chest_base_002"
    name: "金丝战衣"
    slot: "chest"
    faction: "neutral"
    required_level: 20
    required_career: ["archer"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 10

  - key: "archer_chest_base_003"
    name: "乌蚕战衣"
    slot: "chest"
    faction: "neutral"
    required_level: 30
    required_career: ["archer"]
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 14

  # --- t2（≥35级）---
  # 正派
  - key: "archer_chest_t2_positive_001"
    name: "龙虎战衣"
    slot: "chest"
    faction: "positive"
    required_level: 40
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 16

  - key: "archer_chest_t2_positive_002"
    name: "封神战衣"
    slot: "chest"
    faction: "positive"
    required_level: 50
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  # 邪派
  - key: "archer_chest_t2_negative_001"
    name: "破天战衣"
    slot: "chest"
    faction: "negative"
    required_level: 40
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 16

  - key: "archer_chest_t2_negative_002"
    name: "赤龙战衣"
    slot: "chest"
    faction: "negative"
    required_level: 50
    required_career: ["archer"]
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  # --- t3（≥60级）---
  # 正派
  - key: "archer_chest_t3_positive_001"
    name: "昊天战衣"
    slot: "chest"
    faction: "positive"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 24

  - key: "archer_chest_t3_positive_002"
    name: "广寒战衣"
    slot: "chest"
    faction: "positive"
    required_level: 70
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 30

  # 邪派
  - key: "archer_chest_t3_negative_001"
    name: "雪天战衣"
    slot: "chest"
    faction: "negative"
    required_level: 60
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 24

  - key: "archer_chest_t3_negative_002"
    name: "地藏战衣"
    slot: "chest"
    faction: "negative"
    required_level: 70
    required_career: ["archer"]
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 30

  # --- t4（≥80级）---
  # 正派
  - key: "archer_chest_t4_positive_001"
    name: "月神战衣"
    slot: "chest"
    faction: "positive"
    required_level: 80
    required_career: ["archer"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 37

  # 邪派
  - key: "archer_chest_t4_negative_001"
    name: "凝血战衣"
    slot: "chest"
    faction: "negative"
    required_level: 80
    required_career: ["archer"]
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 37

  # ===== 护手（所有职业通用） =====
  # --- base（neutral）---
  - key: "gloves_base_001"
    name: "皮护手"
    slot: "gloves"
    faction: "neutral"
    required_level: 5
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 5

  - key: "gloves_base_002"
    name: "青铜护手"
    slot: "gloves"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 7

  - key: "gloves_base_003"
    name: "精炼护手"
    slot: "gloves"
    faction: "neutral"
    required_level: 20
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 9

  - key: "gloves_base_004"
    name: "罗汉护手"
    slot: "gloves"
    faction: "neutral"
    required_level: 30
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 11

  # --- t2（≥35级）---
  # 正派
  - key: "gloves_t2_positive_001"
    name: "龙虎护手"
    slot: "gloves"
    faction: "positive"
    required_level: 40
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 13

  - key: "gloves_t2_positive_002"
    name: "封神护手"
    slot: "gloves"
    faction: "positive"
    required_level: 50
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 15

  # 邪派
  - key: "gloves_t2_negative_001"
    name: "破天护手"
    slot: "gloves"
    faction: "negative"
    required_level: 40
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 13

  - key: "gloves_t2_negative_002"
    name: "赤龙护手"
    slot: "gloves"
    faction: "negative"
    required_level: 50
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 15

  # --- t3（≥60级）---
  # 正派
  - key: "gloves_t3_positive_001"
    name: "昊天护手"
    slot: "gloves"
    faction: "positive"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 18

  - key: "gloves_t3_positive_002"
    name: "追月护手"
    slot: "gloves"
    faction: "positive"
    required_level: 70
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  # 邪派
  - key: "gloves_t3_negative_001"
    name: "雪天护手"
    slot: "gloves"
    faction: "negative"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 18

  - key: "gloves_t3_negative_002"
    name: "凌鹰护手"
    slot: "gloves"
    faction: "negative"
    required_level: 70
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  # --- t4（≥80级）---
  # 正派
  - key: "gloves_t4_positive_001"
    name: "月神护手"
    slot: "gloves"
    faction: "positive"
    required_level: 80
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 32

  # 邪派
  - key: "gloves_t4_negative_001"
    name: "凝血护手"
    slot: "gloves"
    faction: "negative"
    required_level: 80
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 32

  # ===== 靴子（所有职业通用） =====
  # --- base（neutral）---
  - key: "boots_base_001"
    name: "无名短靴"
    slot: "boots"
    faction: "neutral"
    required_level: 3
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 2

  - key: "boots_base_002"
    name: "青衣短靴"
    slot: "boots"
    faction: "neutral"
    required_level: 5
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 3

  - key: "boots_base_003"
    name: "皮短靴"
    slot: "boots"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 5

  - key: "boots_base_004"
    name: "无名长靴"
    slot: "boots"
    faction: "neutral"
    required_level: 20
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 7

  - key: "boots_base_005"
    name: "皮长靴"
    slot: "boots"
    faction: "neutral"
    required_level: 30
    required_transfer: 0
    purchaseable: true
        base_stats:
      def: 9

  # --- t2（≥35级）---
  # 正派
  - key: "boots_t2_positive_001"
    name: "龙虎长靴"
    slot: "boots"
    faction: "positive"
    required_level: 40
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 12

  - key: "boots_t2_positive_002"
    name: "封神长靴"
    slot: "boots"
    faction: "positive"
    required_level: 50
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 15

  # 邪派
  - key: "boots_t2_negative_001"
    name: "破天长靴"
    slot: "boots"
    faction: "negative"
    required_level: 40
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 12

  - key: "boots_t2_negative_002"
    name: "赤龙长靴"
    slot: "boots"
    faction: "negative"
    required_level: 50
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 15

  # --- t3（≥60级）---
  # 正派
  - key: "boots_t3_positive_001"
    name: "昊天长靴"
    slot: "boots"
    faction: "positive"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 18

  - key: "boots_t3_positive_002"
    name: "广寒长靴"
    slot: "boots"
    faction: "positive"
    required_level: 70
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  # 邪派
  - key: "boots_t3_negative_001"
    name: "雪天长靴"
    slot: "boots"
    faction: "negative"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 18

  - key: "boots_t3_negative_002"
    name: "地藏长靴"
    slot: "boots"
    faction: "negative"
    required_level: 70
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 22

  # --- t4（≥80级）---
  # 正派
  - key: "boots_t4_positive_001"
    name: "月神长靴"
    slot: "boots"
    faction: "positive"
    required_level: 80
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 30

  # 邪派
  - key: "boots_t4_negative_001"
    name: "凝血长靴"
    slot: "boots"
    faction: "negative"
    required_level: 80
    required_transfer: 4
    purchaseable: false
        base_stats:
      def: 30

  # ===== 内甲（所有职业通用） =====
  # --- base ---
  - key: "inner_armor_base_001"
    name: "兽皮甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 15
    required_transfer: 0
    purchaseable: false
        base_stats:
      def: 10

  - key: "inner_armor_base_002"
    name: "铁锁甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 25
    required_transfer: 0
    purchaseable: false
        base_stats:
      def: 15

  # --- t2（≥35级）---
  - key: "inner_armor_t2_001"
    name: "金丝甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 20

  - key: "inner_armor_t2_002"
    name: "软猬甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 45
    required_transfer: 2
    purchaseable: false
        base_stats:
      def: 25

  # --- t3（≥60级）---
  - key: "inner_armor_t3_001"
    name: "玄武战衣"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 55
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 30

  - key: "inner_armor_t3_002"
    name: "天蚕宝甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 65
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 35

  - key: "inner_armor_t3_003"
    name: "裂魂玄甲"
    slot: "inner_armor"
    faction: "neutral"
    required_level: 75
    required_transfer: 3
    purchaseable: false
        base_stats:
      def: 40

  # ===== 项链（所有职业通用） =====
  # --- base（neutral）---
  - key: "necklace_base_001"
    name: "灵兽项链"
    slot: "amulet"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      missing: 3

  - key: "necklace_base_002"
    name: "幻身项链"
    slot: "amulet"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      missing: 4

  - key: "necklace_base_003"
    name: "玉影项链"
    slot: "amulet"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      missing: 5

  # --- t2（≥35级）---
  - key: "necklace_t2_001"
    name: "五毒链"
    slot: "amulet"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      missing: 6

  - key: "necklace_t2_002"
    name: "灵心链"
    slot: "amulet"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      missing: 7

  - key: "necklace_t2_003"
    name: "碧玉护符"
    slot: "amulet"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      missing: 8

  - key: "necklace_t2_004"
    name: "金罡护符"
    slot: "amulet"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      missing: 5
    fixed_affixes:
      hit: 5
      maxHp: 10
      maxMp: 10

  # --- t3（≥60级）---
  - key: "necklace_t3_001"
    name: "金灵护符"
    slot: "amulet"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      missing: 9

  - key: "necklace_t3_002"
    name: "圣光项链"
    slot: "amulet"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      missing: 10

  - key: "necklace_t3_003"
    name: "天神护符"
    slot: "amulet"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      missing: 10
    fixed_affixes:
      hit: 10
      maxHp: 20
      maxMp: 20

  # ===== 耳环（所有职业通用） =====
  # --- base（neutral）---
  - key: "earring_base_001"
    name: "银耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      maxHp: 10

  - key: "earring_base_002"
    name: "白玉耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      maxHp: 20

  - key: "earring_base_003"
    name: "金耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      maxHp: 30

  # --- t2（≥35级）---
  - key: "earring_t2_001"
    name: "天灵耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      maxHp: 40

  - key: "earring_t2_002"
    name: "紫焰耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      maxHp: 50

  - key: "earring_t2_003"
    name: "玄天耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      qigong: 1

  # --- t3（≥60级）---
  - key: "earring_t3_001"
    name: "圣炎耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      maxHp: 50
      maxMp: 50

  - key: "earring_t3_002"
    name: "磐龙耳环"
    slot: "earring"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      qigong: 2

  # ===== 戒指（所有职业通用） =====
  # --- base（neutral）---
  - key: "ring_base_001"
    name: "银戒指"
    slot: "ring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      hit: 3

  - key: "ring_base_002"
    name: "白金戒指"
    slot: "ring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      hit: 4

  - key: "ring_base_003"
    name: "紫玉戒指"
    slot: "ring"
    faction: "neutral"
    required_level: 10
    required_transfer: 0
    purchaseable: false
        base_stats:
      hit: 5

  # --- t2（≥35级）---
  - key: "ring_t2_001"
    name: "地灵戒"
    slot: "ring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      hit: 6

  - key: "ring_t2_002"
    name: "万寿戒"
    slot: "ring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      hit: 7

  - key: "ring_t2_003"
    name: "麒麟指环"
    slot: "ring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      hit: 8

  - key: "ring_t2_004"
    name: "权智指环"
    slot: "ring"
    faction: "neutral"
    required_level: 35
    required_transfer: 2
    purchaseable: false
        base_stats:
      atkMin: 3
      atkMax: 3

  # --- t3（≥60级）---
  - key: "ring_t3_001"
    name: "圣冠指环"
    slot: "ring"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      hit: 9

  - key: "ring_t3_002"
    name: "馨华指环"
    slot: "ring"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      hit: 10

  - key: "ring_t3_003"
    name: "元始指环"
    slot: "ring"
    faction: "neutral"
    required_level: 60
    required_transfer: 3
    purchaseable: false
        base_stats:
      atkMin: 5
      atkMax: 5

5.5 石头合成与强化系统

5.5.1 石头分类与定义

# ========== [可配置] 石头分类 ==========
# 石头按功能分为四大类，分别合成在不同类型的装备上

stone_categories:
  - key: "cold_jade"
    name: "寒玉石"
    description: "合成在防具上"
    color: "#4488FF"
    target_slots: ["chest", "gloves", "boots", "inner_armor"]

  - key: "vajra"
    name: "金刚石"
    description: "合成在武器上"
    color: "#FF4444"
    target_slots: ["weapon"]

  - key: "enhance"
    name: "强化石"
    description: "用于武器或防具的强化，本身无属性"
    color: "#FFD700"
    target_slots: ["weapon", "chest", "gloves", "boots", "inner_armor"]

  - key: "hot_blood"
    name: "热血石"
    description: "合成在披风上，提供技能与特殊效果"
    color: "#FF6600"
    target_slots: ["cape"]

5.5.2 石头模板定义

# ========== [可配置] 石头定义模板 ==========
# 复制此模板创建新石头
# 每颗石头只有1条属性，属性类型和数值在掉落时随机生成
# 石头key格式：{石头基础key}_{属性key}_{属性值}，用于堆叠判定
# 示例：vajra_atk_self_Add_5 表示攻击力+5的金刚石

stone_template:
  key: "石头唯一标识"
  name: "石头名称"
  description: "石头描述"

  # 石头分类
  category: "cold_jade"          # cold_jade / vajra / enhance / hot_blood

  # 出售价格（金币）
  sell_price: 1000

  # 属性配置（强化石不需要此项）
  attribute:
    # 属性池：掉落时按权重随机选择一条属性
    pool:
      - key: "defselfAdd"          # 属性钩子key（对应属性钩子系统）
        name: "防御力"
        weight: 40                 # 该属性的出现权重
        value_range: [3, 15]       # 属性值随机区间 [最小值, 最大值]

    # 属性值随机规则
    value_distribution: "normal"  # uniform(均匀分布) / normal(正态分布，偏向中间值)

  # 掉落配置
  drop:
    drop_rate: 0.1                # 基础掉落概率（该石头的掉落权重）
    min_level: 1                  # 掉落最低等级门槛
    level_scale: true             # 属性值区间上限是否随掉落等级缩放（最小值不缩放）

  # 热血石技能属性（仅热血石使用）
  skill_attribute: null

  # 特殊效果（仅热血石使用）
  special_effects: []

5.5.3 装备合成孔位规则

# ========== [可配置] 装备合成孔位 ==========
# 合成 = 将石头嵌入装备孔位，一旦合成不可拆卸

synthesis_slots:
  # 各装备类型的合成孔位数
  slot_capacity:
    weapon: 4                     # 武器：4个孔位（金刚石）
    chest: 4                      # 胸甲：4个孔位（寒玉石）
    gloves: 4                     # 手套：4个孔位（寒玉石）
    boots: 4                      # 鞋子：4个孔位（寒玉石）
    inner_armor: 2                # 内甲：2个孔位（寒玉石）
    ring: 0                       # 戒指：无孔位
    amulet: 0                     # 项链：无孔位
    cape: 4                       # 披风：4个孔位（热血石）

  # 孔位与石头类型对应关系
  slot_stone_mapping:
    weapon: "vajra"               # 武器孔位 → 金刚石
    chest: "cold_jade"            # 防具孔位 → 寒玉石
    gloves: "cold_jade"
    boots: "cold_jade"
    inner_armor: "cold_jade"
    cape: "hot_blood"             # 披风孔位 → 热血石

  # 合成规则
  synthesis_rules:
    irreversible: true            # 合成后不可拆卸
    cost_formula: "equip_required_level * 1000"  # 合成费用 = 装备要求等级 × 1000
    same_attribute_stackable: true # 同属性石头可叠加

5.5.4 寒玉石数据配置

# ========== [可配置] 寒玉石列表 ==========
# 寒玉石：合成在防具上
# 每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
# 石头key格式：{石头基础key}_{属性key}_{属性值}，用于堆叠判定
# 示例：cold_jade_01_defselfAdd_5 表示防御力+5的寒玉石

cold_jade_stones:
  - key: "cold_jade_01"
    name: "寒玉石"
    description: "蕴含寒冰之力的玉石，可合成在防具上"
    category: "cold_jade"
    attribute:
      pool:
        - key: "defselfAdd"
          name: "防御力"
          weight: 40
          value_range: [1, 7]
        - key: "missingAdd"
          name: "闪避率"
          weight: 25
          value_range: [1, 10]
        - key: "maxHpAdd"
          name: "生命值"
          weight: 35
          value_range: [5, 50]
      value_distribution: "normal"    # 正态分布，偏向中间值
    drop:
      drop_rate: 0.15
      min_level: 1
      level_scale: true
#暂时不用，为后续版本更新预留
  - key: "cold_jade_02"
    name: "冰魄寒玉"
    description: "极寒之力凝聚的寒玉，属性更强"
    category: "cold_jade"
    attribute:
      pool:
        - key: "defselfAdd"
          name: "防御力"
          weight: 40
          value_range: [10, 35]
        - key: "missingAdd"
          name: "闪避率"
          weight: 30
          value_range: [3, 12]
        - key: "maxHpAdd"
          name: "生命值"
          weight: 30
          value_range: [30, 150]
      value_distribution: "normal"
    drop:
      drop_rate: 0.05
      min_level: 40
      level_scale: true

5.5.5 金刚石数据配置

# ========== [可配置] 金刚石列表 ==========
# 金刚石：合成在武器上
# 每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
# 石头key格式：{石头基础key}_{属性key}_{属性值}，用于堆叠判定
# 示例：vajra_01_atk_self_Add_5 表示攻击力+5的金刚石

vajra_stones:
  - key: "vajra_01"
    name: "金刚石"
    description: "坚硬如金刚的宝石，可合成在武器上"
    category: "vajra"
    attribute:
      pool:
        - key: "atk_self_Add"
          name: "攻击力"
          weight: 30
          value_range: [1, 15]
        - key: "weaponSkillBonusAdd"
          name: "武功攻击力"
          weight: 25
          value_range: [2, 12]           # 百分比（2%~12%）
        - key: "maxHpAdd"
          name: "生命值"
          weight: 20
          value_range: [5, 50]
        - key: "weaponExtraDamageAdd"
          name: "追加伤害"
          weight: 20
          value_range: [2, 15]
        - key: "hitAdd"
          name: "命中率"
          weight: 25
          value_range: [1, 10]
      value_distribution: "uniform"
    drop:
      drop_rate: 0.15
      min_level: 1
      level_scale: true

#暂时不用，为后续版本更新预留
  - key: "vajra_02"
    name: "碎星金刚"
    description: "蕴含星辰碎裂之力的金刚石，攻击属性更强"
    category: "vajra"
    attribute:
      pool:
        - key: "atk_self_Add"
          name: "攻击力"
          weight: 50
          value_range: [12, 45]
        - key: "maxHpAdd"
          name: "生命值"
          weight: 25
          value_range: [20, 120]
        - key: "critRLAdd"
          name: "暴击率"
          weight: 25
          value_range: [2, 10]
      value_distribution: "normal"
      value_distribution: "normal"
    drop:
      drop_rate: 0.05
      min_level: 40
      level_scale: true

5.5.6 强化石数据配置

# ========== [可配置] 强化石列表 ==========
# 强化石：用于武器或防具的强化
# 强化石自身无属性，堆叠key格式：enhance_stone_01（无属性后缀）

enhance_stones:
  - key: "enhance_stone_01"
    name: "强化石"
    description: "用于强化武器或防具的基础属性"
    category: "enhance"
    attribute: null                       # 强化石自身无属性
    drop:
      drop_rate: 0.20
      min_level: 1
      level_scale: false

5.5.7 强化系统规则

# ========== [可配置] 强化系统规则 ==========

enhance_system:
  # 强化等级上限
  max_level: 10

  # 可强化的装备类型
  enhanceable_slots: ["weapon", "chest", "gloves", "boots", "inner_armor"]
  # 披风(cape)、首饰(ring/amulet)不可强化

  # 强化效果：每级增加固定属性值，按装备类型区分
  enhance_bonus_per_level:
    weapon:                               # 武器
      atkMinAdd: 6                        # 每级 +6 最小攻击力
      atkMaxAdd: 6                        # 每级 +6 最大攻击力
    armor:                                # 防具（胸甲/手套/鞋子/内甲）
      defselfAdd: 3                       # 每级 +3 防御力

  # 计算公式
  enhance_formula: |
    # 武器：enhanced_atkMin = base_atkMin + enhance_level * 6
    #       enhanced_atkMax = base_atkMax + enhance_level * 6
    # 防具：enhanced_def = base_def + enhance_level * 3
    # 示例：+5武器 base_atkMin:40, base_atkMax:60 → atkMin:70, atkMax:90
    # 示例：+5胸甲 base_def:30 → 30 + 5 * 3 = 45

  # 强化石消耗规则（根据装备已合成石头数量决定每次消耗颗数）
  stone_cost:
    0_stones: 1                          # 装备未合成任何石头时，每次强化消耗1颗
    1_to_3_stones: 2                     # 装备合成1~3颗石头时，每次强化消耗2颗
    4_plus_stones: 3                     # 装备合成4颗及以上石头时，每次强化消耗3颗

  # 强化成功率（每级不同，可配置）
  success_rate:
    level_1: 0.90                         # +1 → 90%
    level_2: 0.80                         # +2 → 80%
    level_3: 0.60                         # +3 → 60%
    level_4: 0.40                         # +4 → 40%
    level_5: 0.20                         # +5 → 20%
    level_6: 0.10                         # +6 → 10%
    level_7: 0.05                         # +7 → 5%
    level_8: 0.01                         # +8 → 1%
    level_9: 0.001                         # +9 → 0.1%
    level_10: 0.0001                       # +10 → 0.001%

  # 强化失败处理
  failure_behavior: "destroy_equipment"   # destroy_equipment(装备碎裂，已合成石头一同消失)

  # 强化费用公式
  cost_formula: "equip_required_level * 1000"  # 强化费用 = 装备要求等级 × 1000

  # 热血石对强化成功率的影响（见5.5.8热血石配置）
  hot_blood_enhance_bonus: true           # 是否允许热血石增加强化成功率

5.5.8 热血石数据配置

# ========== [可配置] 热血石列表 ==========
# 热血石：合成在披风上，提供技能+1、成功率加成、金币爆率等特殊效果
# 每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
# 石头key格式：{石头基础key}_{属性key}_{属性值}，用于堆叠判定
# 示例：hot_blood_01_skill_level_up_1 表示技能等级+1的热血石

hot_blood_stones:
  - key: "hot_blood_01" #仅包含技能+1的热血石
    name: "热血石"
    description: "蕴含热血之力的奇石，可合成在披风上"
    category: "hot_blood"
    attribute:
      pool:
        - key: "skill_level_up"
          name: "<技能>等级+1"    #<技能>根据实际属性对应技能名称做展示
          weight: 50
          value_range: [1, 1]            # 固定+1
          # 技能从技能池中随机选择，见下方 skill_pool 配置

        - key: "enhanceSuccessRateAdd"
          name: "合成强化成功率"
          weight: 30
          value_range: [1, 1]            # 固定+1%

        - key: "goldDropBonusAdd"
          name: "金币爆率"
          weight: 20
          value_range: [5, 5]           # 固定+5%
      value_distribution: "uniform"
    drop:
      drop_rate: 0.08
      min_level: 10
      level_scale: false

    # 气功池：当属性为"气功等级+1"时，从池中按权重随机选择1个气功
    qigong_pool:
      - skill_key: "blade_qigong_atk_min"
        name: "力劈华山"
        weight: 15
      - skill_key: "blade_qigong_hit"
        name: "摄魂一击"
        weight: 15
      - skill_key: "blade_qigong_counter"
        name: "四两千金"
        weight: 15
      - skill_key: "blade_qigong_armor_break"
        name: "霸气破甲"
        weight: 15
      - skill_key: "sword_qigong_atk_max"
        name: "长虹贯日"
        weight: 15
      - skill_key: "sword_qigong_dodge"
        name: "百变神行"
        weight: 15
      - skill_key: "sword_qigong_combo"
        name: "无影剑"
        weight: 15
      - skill_key: "sword_qigong_shield"
        name: "护身罡气"
        weight: 15
      - skill_key: "sword_qigong_leech"
        name: "移花接木"
        weight: 15
      - skill_key: "sword_qigong_skill_atk"
        name: "回柳身法"
        weight: 15
      - skill_key: "spear_qigong_def"
        name: "金钟罡气"
        weight: 15
      - skill_key: "spear_qigong_heal"
        name: "运气疗伤"
        weight: 15
      - skill_key: "spear_qigong_hp"
        name: "横练太保"
        weight: 15
      - skill_key: "spear_qigong_skill_atk"
        name: "乾坤挪移"
        weight: 15
      - skill_key: "spear_qigong_skill_def"
        name: "灵甲护身"
        weight: 15
      - skill_key: "staff_qigong_mp_reduce"
        name: "太极心法"
        weight: 15
      - skill_key: "staff_qigong_maxhp"
        name: "体血倍增"
        weight: 15
      - skill_key: "staff_qigong_maxmp"
        name: "洗髓易筋"
        weight: 15
      - skill_key: "staff_qigong_skill_atk"
        name: "长攻击力"
        weight: 15
      - skill_key: "staff_qigong_buff_duration"
        name: "吸星大法"
        weight: 15
      - skill_key: "staff_qigong_mp_recovery_bonus"
        name: "运气行心"
        weight: 15
      - skill_key: "common_qigong_skill_crit"
        name: "真武绝击"
        weight: 15

  - key: "hot_blood_02"    #仅包含合成概率和金币爆率的热血石
    name: "热血石"
    description: "蕴含热血之力的奇石，可合成在披风上"
    category: "hot_blood"
    attribute:
      pool:
        - key: "enhanceSuccessRateAdd"
          name: "合成强化成功率"
          weight: 30
          value_range: [1, 1]            # 固定+1%

        - key: "goldDropBonusAdd"
          name: "金币爆率"
          weight: 20
          value_range: [5, 5]           # 固定+5%
      value_distribution: "normal"
    drop:
      drop_rate: 0.02
      min_level: 50
      level_scale: false

# 热血石技能叠加规则
hot_blood_skill_stack_rules:
  # 同一技能可叠加：多颗热血石的"<技能>等级+1"可作用于同一技能,即<技能>都是同一个技能
  # 例：披风4孔全合成"技能等级+1"，随机到同一技能时，该技能 +4 级
  same_skill_stackable: true

  # 技能等级上限
  skill_level_cap: 10                     # 单个技能通过热血石最多叠加到+10

  # 热血石对强化成功率的加成计算方式
  enhance_success_formula: |
    # 角色身上所有披风热血石的"合成强化成功率"之和
    total_bonus = sum(hot_blood_stone.enhance_success_bonus)
    # 实际成功率 = 基础成功率 + 加成（不超过100%）
    actual_rate = min(base_success_rate + total_bonus / 100, 1.0)
    # 示例：+7强化基础28%，披风合计+5% → 实际 28% + 5% = 33%

  # 热血石对金币爆率的加成计算方式
  gold_drop_formula: |
    # 角色身上所有披风热血石的"金币爆率"之和
    total_gold_bonus = sum(hot_blood_stone.gold_drop_bonus)
    # 最终金币掉落 = 基础金币 × (1 + total_gold_bonus / 100)
    # 示例：基础金币100，披风合计+8% → 最终 100 × 1.08 = 108

5.5.9 石头掉落与属性生成规则

# ========== [可配置] 石头掉落与属性生成 ==========

stone_generation:
  # 石头掉落流程：
  # 1. 判定是否掉落石头（按 drop_rate）
  # 2. 按权重随机选择石头类型（寒玉石/金刚石/强化石/热血石）
  # 3. 按该石头的属性池权重随机选择1条属性
  # 4. 在属性的 value_range 内随机生成数值

  # 石头类型掉落权重
  category_drop_weights:
    cold_jade: 35                          # 寒玉石 35%
    vajra: 25                              # 金刚石 25%
    enhance: 30                            # 强化石 30%
    hot_blood: 10                          # 热血石 10%

  # 同类型内不同石头的掉落权重
  # （用于同一分类下有多种石头时，决定掉哪种）
  stone_tier_weights:
    cold_jade:
      cold_jade_01: 80                    # 普通寒玉石 80%
      cold_jade_02: 20                    # 冰魄寒玉 20%
    vajra:
      vajra_01: 80
      vajra_02: 20
    enhance:
      enhance_stone_01: 100
    hot_blood:
      hot_blood_01: 85
      hot_blood_02: 15

  # 属性值随机规则
  value_generation:
    # uniform: 区间内均匀随机
    # normal: 以 (min + max) / 2 为均值，(max - min) / 6 为标准差的正态分布
    #   大部分值集中在中间，极值出现概率低
    distribution_types:
      uniform: "Random.range(min, max + 1)"
      normal: "Mathf.RoundToInt(NormalRandom(mean, stddev))"

    # 等级缩放（level_scale = true 时生效）
    # 缩放的是属性值区间的上限，下限不变，且任何缩放结果不超出 base_range 框定的范围
    # 核心思路：低级怪掉出的石头属性上限低，高级怪掉出的石头属性上限更接近满值
    level_scale_formula: |
      # base_min, base_max: 石头配置中的基础属性区间（绝对边界，不可逾越）
      # monster_level: 掉落怪物的等级
      # level_cap: 参考等级上限（默认100，达到此等级时上限完全开放）

      scale_ratio = min(1.0, monster_level / level_cap)
      effective_max = base_min + (base_max - base_min) * scale_ratio
      effective_min = base_min                          # 最小值始终不升

      value = random_in_range(effective_min, effective_max)

      # 示例：基础区间 = [3, 15]，level_cap = 100
      # 怪物1级:  effective_max = 3 + 12 * 0.01 = 3.12 → [3, 3]
      # 怪物10级: effective_max = 3 + 12 * 0.10 = 4.2  → [3, 4]
      # 怪物50级: effective_max = 3 + 12 * 0.50 = 9    → [3, 9]
      # 怪物80级: effective_max = 3 + 12 * 0.80 = 12.6 → [3, 12]
      # 怪物100级: effective_max = 3 + 12 * 1.00 = 15  → [3, 15]（完全开放）

      # 注：scale_ratio 的增长曲线可替换为非线性
      # 线性: scale_ratio = min(1.0, level / level_cap)
      # 早期快后期慢(开方): scale_ratio = min(1.0, sqrt(level / level_cap))
      # 早期慢后期快(平方): scale_ratio = min(1.0, (level / level_cap)^2)

5.5.10 合成操作规则

# ========== [可配置] 合成操作规则 ==========

synthesis_operations:
  # 合成前提条件
  preconditions:
    - "装备存在空余合成孔位"
    - "石头类型与孔位类型匹配（寒玉石→防具孔, 金刚石→武器孔, 热血石→披风孔）"
    - "角色拥有足够金币支付合成费用"

  # 合成过程
  process:
    - step: "选择装备"
    - step: "选择石头"
    - step: "校验孔位与石头类型匹配"
    - step: "扣除合成费用"
    - step: "判定合成成功率"
    - step_on_success: "石头属性附加到装备，孔位标记为已占用，石头从背包消耗"
    - step_on_failure: "当次合成的石头消失，装备和已合成的石头保留"

  # 合成费用
  cost_formula: "equip_required_level * 1000"  # 合成费用 = 装备要求等级 × 1000

  # 合成成功率（根据已占用孔位数递减）
  # 已占用孔位越多，合成越难
  success_rate:
    0_occupied: 0.90                        # 0孔已占 → 第1孔合成 90%
    1_occupied: 0.50                        # 1孔已占 → 第2孔合成 50%
    2_occupied: 0.20                        # 2孔已占 → 第3孔合成 20%
    3_occupied: 0.05                        # 3孔已占 → 第4孔合成 5%
    # 注：内甲只有2孔，最高只用到 1_occupied
    # 披风和防具有4孔，会用到 3_occupied

  # 热血石对合成成功率的影响
  hot_blood_synthesis_bonus: true           # 是否允许热血石增加合成成功率
  # 加成计算方式（与强化成功率加成一致）
  # actual_rate = min(base_success_rate + total_synthesis_bonus / 100, 1.0)

  # 合成失败处理
  failure_behavior: "stone_lost"            # stone_lost(当次石头消失，装备和已合成石头保留)

  # 合成规则
  irreversible: true                        # 合成成功后石头不可拆卸、不可替换

  # 合成后装备属性计算
  equip_total_formula: |
    # 装备最终属性 = 强化后基础属性 + 词缀属性 + 合成石头属性
    final_stats = enhanced_base_stats + affix_hooks + synthesis_stone_hooks
    # enhanced_base_stats：武器强化1级加6攻击力，防具强化1级加3防御力
    # 武器：enhanced_base_stats.atk = base_stats.atk + enhance_level * 6
    # 防具：enhanced_base_stats.def = base_stats.def + enhance_level * 3


---
6. 战斗系统

6.1 战斗流程

# ========== 战斗流程定义 ==========

battle_flow:
  # 战斗初始化
  init:
    - 加载战斗单位数据
    - 计算最终属性（基础+装备+Buff）
    - 生成技能队列
    - 设置战斗时长限制

  # 战斗循环
  battle_loop:
    interval: 100              # 战斗tick间隔（毫秒）
    steps:
      - 检查战斗结束条件
      - 更新Buff持续时间
        # 计算辅助武功实际持续时间
        # final_buff_duration = base_buff_duration + player.buff_duration
        # buff_duration 来自医师气功"吸星大法"，每级+15秒
      - 触发Buff效果（DOT/HOT）
      - 执行单位行动
        # 单位行动逻辑
        - 选择目标
        - 检查技能冷却
        - 检查内功是否充足（考虑mp_cost_reduce）
          # actual_mp_cost = skill_base_mp_cost * (1 - player.mp_cost_reduce)
          # 如果 player.mp >= actual_mp_cost，执行技能
        - 计算伤害/治疗
        - 更新HP/MP（使用skill_mp_cost公式计算实际内功消耗）
      - 更新HP/MP
      - 触发死亡事件

  # 战斗结束
  end:
    conditions:
      - all_enemies_dead: "win"
      - player_dead: "lose"
      - time_limit_reached: "lose"
    rewards:
      win: "计算经验、金币、掉落"
      lose: "无奖励"

  # 自动战斗（挂机）逻辑
  auto_battle:
    # ===== 挂机技能配置 =====
    hang_skill:
      description: "每个角色可选1个挂机技能（damage/heal二选一）+ 2个buff技能，不选则默认普攻"
      damage_or_heal: "choose_one"   # damage技能或heal技能，二选一
      buff_skill: 2                   # buff技能最多2个
      buff_cooldown: 60               # buff技能施放间隔60秒

    # ===== 挂机技能类型行为 =====
    hang_skill_behavior:
      damage_skill: |
        # 目标锁定 + 额外随机
        # 优先攻击锁定目标，剩余目标数（target_count - 1）从存活怪物中随机选取
      heal_skill: |
        # 仅给自己施放
      buff_skill: |
        # 每60秒施放一次，定时触发
        # 两个buff同时冷却完毕时，按key排序决定施放顺序
        # 60秒cd从施放后开始计时

    # ===== 怪物生成规则 =====
    monster_spawn:
      interval: 1                      # 每秒生成1只
      max_count: 8                    # 同时存在上限8只
      selection: "random"              # 从当前zone配置的怪物池随机选

    # ===== 攻击目标选择 =====
    target_selection:
      lock_target: true                           # 锁定目标打到底，死亡后换新目标
      selection: "random_when_change"             # 换目标时随机选
      trigger: "monster_dead"                      # 怪物死亡后立刻选下一个

    # ===== 攻击行为逻辑 =====
    attack_logic:
      # 普攻间隔
      normal_attack_interval: 1        # 1秒/次
      skill_cooldown: 1                # 技能CD也是1秒（与普攻独立）

      # 技能触发判断
      skill_trigger: |
        if hang_skill selected:
          if (mp >= skill.mp_cost AND skill.cooldown_ready):
            use skill
          else:
            wait  # 等待MP足够 + 冷却完毕，不普攻
            # 等待期间普攻cd暂停，不计时
        else:
          use normal_attack

      # 无目标时行为
      no_target_behavior: "stand_and_wait"  # 怪物全部死亡后站着等下一只出现，不停止挂机

    # ===== 自动喝药规则 =====
    auto_potion:
      description: "玩家配置自动喝药规则（见10.3节），挂机时执行"

    # ===== 死亡处理 =====
    death_handling:
      exp_penalty: "扣除当前等级升级经验的1%（不足则不扣）"
      respawn: "回城"
      stop_hang: true                  # 停止挂机

6.2 伤害计算公式

# ========== [可配置] 伤害公式 ==========

damage_formulas:
  # ==============================
  # 命中率判定（优先于一切伤害计算）
  # ==============================
  hit_check: |
    actualHitRate = attacker.hit / (attacker.hit + target.missing)
    if random() > actualHitRate:
        damage = 0
        is_miss = true
    # 命中率 = 攻击方命中 / (攻击方命中 + 防御方闪避)
    # 双方身法越高，攻方命中越高、守方闪避越高，相互博弈

  # ==============================
  # 普通攻击伤害
  # ==============================
  normal_attack_damage: |
    # 从 [atkMin, atkMax] 区间随机取本次攻击力
    atk = random(attacker.atkMin, attacker.atkMax)
    # 破甲效果：仅对当次攻击生效，使用临时防御力计算
    effective_def = target.def
    effective_mdef = target.mdef
    if random() < attacker.armor_break:
        effective_def = target.def * (1 - 0.20)  # 破甲效果：减少目标20%防御力
        effective_mdef = target.mdef * (1 - 0.20)  # 同时减少目标20%武功防御力
        is_armor_broken = true
    baseDmg = atk - effective_def
    baseDmg = max(1, baseDmg)
    # 暴击判定（仅普通攻击）
    if is_crit:
        baseDmg = baseDmg * attacker.critB    # critB 默认1.5（150%）
    # 连击判定（触发时一次攻击变为3次）
    if random() < attacker.combo:
        combo_hits = 3
        for i in range(combo_hits):
            # 每次连击独立计算伤害
            hit_dmg = max(1, floor(baseDmg * random(0.9, 1.1)))
            target.hp = target.hp - hit_dmg
        return  # 连击已完成伤害计算，直接返回
    # 伤害浮动
    finalDmg = max(1, floor(baseDmg * random(0.9, 1.1)))
    # combo: 连击几率（来自气功连环飞舞，每级+1%）
    # armor_break: 破甲几率（来自气功霸气破甲，每级+1%）
    # armor_break_def_reduce: 破甲效果默认20%防御力降低，仅对当次攻击生效

  # ==============================
  # 武功（技能）伤害
  # ==============================
  skill_damage: |
    # 从 [atkMin, atkMax] 区间随机取本次攻击力
    atk = random(attacker.atkMin, attacker.atkMax)
    # 破甲效果：仅对当次攻击生效，使用临时防御力计算
    effective_def = target.def
    effective_mdef = target.mdef
    if random() < attacker.armor_break:
        effective_def = target.def * (1 - 0.20)  # 破甲效果：减少目标20%防御力
        effective_mdef = target.mdef * (1 - 0.20)  # 同时减少目标20%武功防御力
        is_armor_broken = true
    # 武功伤害 = (人物攻击力 - 目标防御力) × 1.5 + 武功攻击力 × (1 + 武器合成石头武功加成%) + 武器追加伤害
    basePart = max(1, atk - effective_def) * 1.5
    matkPart = attacker.matk * (1 + attacker.weapon_skill_bonus / 100)
    weaponBonus = attacker.weapon_extra_damage
    skillDmg = basePart + matkPart + weaponBonus
    # 武功防御力减免
    skillDmg = skillDmg * (100 / (100 + effective_mdef))
    # 真武绝击判定（仅武功触发）
    if random() < attacker.skill_crit_rate:
        skillDmg = skillDmg * (1 + attacker.skill_crit_damage_bonus)  # skill_crit_damage_bonus 默认0.50（50%）
        is_skill_crit = true
    # 伤害浮动
    finalDmg = max(1, floor(skillDmg * random(0.9, 1.1)))
    # skill_crit_rate: 真武绝击几率（来自刀客气功真武绝击，每级+1%）
    # skill_crit_damage_bonus: 触发真武绝击时的伤害加成（默认50%）
    # armor_break: 破甲几率（来自气功霸气破甲，每级+1%）

    # 参数说明：
    # attacker.atkMin/atkMax: 攻击方最小/最大攻击力（实战取随机值）
    # attacker.def: 防御方最终防御力
    # attacker.matk: 攻击方武功攻击力（由装备/Buff/石头提供）
    # attacker.weapon_skill_bonus: 武器合成石头带来的武功加成百分比
    # attacker.weapon_extra_damage: 武器追加伤害（固定值，来自装备属性）
    # target.mdef: 防御方武功防御力
    # 技能威力系数 value 在技能配置中定义（见effect.value），用于同类技能差异化

  # ==============================
  # 闪避判定
  # ==============================
  evasion: |
    # 闪避已合并到命中率判定中
    # actualHitRate = attacker.hit / (attacker.hit + target.missing)
    # 当 actualHitRate < random() 时，攻击未命中

  # ==============================
  # 格挡判定
  # ==============================
  block: |
    if random() < target.block:
        damage = damage * 0.5
        is_blocked = true
    # block: 格挡率，格挡减少50%伤害

  # ==============================
  # 护身减伤判定
  # ==============================
  shield_rate_check: |
    if random() < target.shield_rate:
        damage = damage * 0.5  # 护身效果：受到攻击时减免50%伤害
        is_shielded = true
    # shield_rate: 护身几率（来自剑客气功护身罡气，每级+1%）

  # ==============================
  # 反伤判定
  # ==============================
  counter_damage_check: |
    if random() < target.counter_damage:
        reflected_damage = damage * target.counter_damage_rate  # counter_damage_rate 默认1.0（100%反伤）
        attacker.hp = attacker.hp - reflected_damage
        is_countered = true
    # counter_damage: 反伤几率（来自气功四两千金，每级+1%）
    # counter_damage_rate: 反伤比例（默认100%伤害）

  # ==============================
  # 暴击判定（仅普通攻击）
  # ==============================
  critical_hit: |
    # 仅普通攻击可暴击，技能（武功）不暴击
    if attack_type == "normal" and random() < attacker.critR:
        damage = damage * attacker.critB    # critB 默认1.5（150%）
        is_crit = true
    # critR: 暴击率（基础30%）
    # critB: 暴击伤害倍率（基础150%）

  # ==============================
  # 生命药剂恢复量计算
  # ==============================
  hp_potion_recovery: |
    # 生命药剂实际恢复量 = 基础恢复量 × (1 + 治疗效果加成)
    # 治疗效果加成由医师气功"体血倍增"提供，每级+1%
    actual_hp_recovery = potion_base_recovery * (1 + player.heal_bonus)
    player.hp = min(player.hp + actual_hp_recovery, player.maxHp)
    # heal_bonus: 治疗效果（基础0%，来自医师气功体血倍增）

  # ==============================
  # 内功药剂恢复量计算
  # ==============================
  mp_potion_recovery: |
    # 内功药剂实际恢复量 = 基础恢复量 × (1 + 内功恢复加成)
    # 内功恢复加成由医师气功"运气行心"提供，每级+1%
    actual_mp_recovery = potion_base_recovery * (1 + player.mp_recovery_bonus)
    player.mp = min(player.mp + actual_mp_recovery, player.maxMp)
    # mp_recovery_bonus: 内功恢复加成（基础0%，来自医师气功运气行心）

  # ==============================
  # 武功内功消耗计算
  # ==============================
  skill_mp_cost: |
    # 武功实际消耗内功 = 武功基础消耗内功 × (1 - 内力消耗减少)
    # 内力消耗减少由医师气功"太极心法"提供，每级+1%
    actual_mp_cost = skill_base_mp_cost * (1 - player.mp_cost_reduce)
    player.mp = player.mp - actual_mp_cost
    # mp_cost_reduce: 内力消耗减少（基础0%，来自医师气功太极心法）

6.3 战斗状态管理

# ========== 战斗单位状态 ==========

unit_state:
  # 基础状态
  hp:                         # 当前生命值
  maxHp:                      # 最大生命值
  mp:                         # 当前法力值
  maxMp:                      # 最大法力值

  # 战斗状态
  buffs: []                   # 当前Buff列表
  cooldowns: {}               # 技能冷却状态
  casting: null               # 正在施放的技能
  stunned: false              # 是否眩晕
  silenced: false             # 是否沉默

  # 目标
  target: null                # 当前目标
  threat: {}                  # 仇恨列表


---

7 怪物系统

7.1 怪物模板定义

# ========== [可配置] 怪物定义模板 ==========
# 怪物定义独立于地图，怪物可被多张地图的多个二级区域引用
# key 使用英文开发命名，name 为中文显示名
#
# 掉落规则：
# - 怪物无 drop_items：只走地图/二级区域的公共掉落池
# - 怪物有 drop_items：叠加怪物掉落 + 地图掉落，且不重复
# - 怪物掉落优先配置任务物品和特殊物品
# - 地图掉落配置通用物品（装备、药剂、金币等）

monster_template:
  key: "怪物唯一标识"
  name: "怪物名称"
  level: 10                    # 等级
  exp: 100                     # 经验（精英/Boss填0由系统另行计算）
  hp: 1000                     # 生命值
  atk: 50                      # 攻击力
  def: 20                      # 防御力
  monster_type: "normal"        # normal/elite/boss
  skills: []                   # 技能列表
  drop_items: []               # 掉落物品（任务物品/特殊物品优先）

7.2 怪物数据配置

# ========== [可配置] 怪物列表 ==========

monsters:
  - key: "stray_cat"
    name: "野猫"
    level: 3
    exp: 3
    hp: 50
    atk: 13
    def: 10
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "toad"
    name: "蛤蟆"
    level: 5
    exp: 5
    hp: 70
    atk: 17
    def: 15
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "fox"
    name: "狐狸"
    level: 8
    exp: 9
    hp: 100
    atk: 24
    def: 18
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "wild_bull"
    name: "狂牛"
    level: 10
    exp: 11
    hp: 120
    atk: 46
    def: 30
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "wild_boar"
    name: "野猪"
    level: 12
    exp: 14
    hp: 160
    atk: 56
    def: 35
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "boar_leg"
        name: "野猪后腿"
        droprate: 0.001
        type: "quest_item"

  - key: "gray_wolf"
    name: "灰狼"
    level: 12
    exp: 19
    hp: 180
    atk: 61
    def: 40
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "wolf_bone"
        name: "灰狼之骨"
        droprate: 0.001
        type: "quest_item"

  - key: "bear"
    name: "熊"
    level: 15
    exp: 26
    hp: 300
    atk: 81
    def: 45
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "gray_wolf_king"
    name: "灰狼王"
    level: 15
    exp: 0
    hp: 330
    atk: 92
    def: 60
    monster_type: "elite"
    skills: []
    drop_items: []

  - key: "three_tail_fox"
    name: "三尾狐"
    level: 18
    exp: 39
    hp: 360
    atk: 107
    def: 50
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "woodcutter"
    name: "伐木工"
    level: 18
    exp: 42
    hp: 360
    atk: 117
    def: 55
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "woodcutter_leader"
    name: "伐木工首领"
    level: 20
    exp: 0
    hp: 400
    atk: 157
    def: 55
    monster_type: "elite"
    skills: []
    drop_items: []

  - key: "blood_wolf"
    name: "血狼"
    level: 20
    exp: 49
    hp: 550
    atk: 152
    def: 70
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "flower_bear"
    name: "花熊"
    level: 20
    exp: 54
    hp: 600
    atk: 157
    def: 80
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "blood_wolf_king"
    name: "血狼王"
    level: 22
    exp: 0
    hp: 780
    atk: 178
    def: 100
    monster_type: "elite"
    skills: []
    drop_items: []

  - key: "big_ape"
    name: "大猿"
    level: 22
    exp: 52
    hp: 650
    atk: 162
    def: 80
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "small_zombie"
    name: "小僵尸"
    level: 25
    exp: 64
    hp: 750
    atk: 167
    def: 90
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "small_blue_ghost"
    name: "小蓝鬼"
    level: 25
    exp: 66
    hp: 800
    atk: 172
    def: 95
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "dancing_girl"
    name: "舞女"
    level: 27
    exp: 71
    hp: 950
    atk: 182
    def: 100
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "broken_monk"
    name: "破戒僧"
    level: 27
    exp: 74
    hp: 1000
    atk: 187
    def: 110
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "mountain_ghost"
    name: "山鬼"
    level: 30
    exp: 0
    hp: 1600
    atk: 350
    def: 150
    monster_type: "elite"
    skills: []
    drop_items: []

  - key: "big_robber"
    name: "大块头山贼"
    level: 30
    exp: 119
    hp: 1200
    atk: 217
    def: 120
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "giant_axe_robber"
    name: "巨斧山贼"
    level: 32
    exp: 129
    hp: 1300
    atk: 227
    def: 130
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "robber_chief"
    name: "山贼头领"
    level: 35
    exp: 0
    hp: 2000
    atk: 450
    def: 250
    monster_type: "elite"
    skills: []
    drop_items: []

  - key: "red_bear"
    name: "赤血熊"
    level: 35
    exp: 199
    hp: 1500
    atk: 263
    def: 140
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "red_bear_skin"
        name: "赤血熊之皮"
        droprate: 0.001
        type: "quest_item"

  - key: "forest_tiger"
    name: "山林黄虎"
    level: 36
    exp: 249
    hp: 1550
    atk: 268
    def: 143
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "forest_tiger_skin"
        name: "山林黄虎之皮"
        droprate: 0.001
        type: "quest_item"

  - key: "white_tiger"
    name: "白纹虎"
    level: 37
    exp: 299
    hp: 1600
    atk: 273
    def: 146
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "white_tiger_skin"
        name: "白纹虎之皮"
        droprate: 0.001
        type: "quest_item"

  - key: "pirate_villager"
    name: "盗鱼村夫"
    level: 38
    exp: 349
    hp: 1650
    atk: 278
    def: 149
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "double_gun_pirate"
    name: "双枪鱼贼"
    level: 40
    exp: 399
    hp: 1800
    atk: 288
    def: 151
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "big_arm_stranger"
    name: "巨臂异人"
    level: 42
    exp: 499
    hp: 1850
    atk: 298
    def: 151
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "small_mountain_creature"
    name: "小山怪"
    level: 43
    exp: 549
    hp: 1950
    atk: 303
    def: 166
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "sharp_claw_sas"
    name: "利爪山魈"
    level: 44
    exp: 599
    hp: 2000
    atk: 323
    def: 169
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "mountain_sas"
    name: "山魈"
    level: 45
    exp: 649
    hp: 2200
    atk: 328
    def: 179
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "lotus_cultist"
    name: "莲花教徒"
    level: 47
    exp: 749
    hp: 2250
    atk: 338
    def: 182
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "foreign_evil_monk"
    name: "异域恶僧"
    level: 48
    exp: 799
    hp: 2300
    atk: 343
    def: 185
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "red_hair_fire_thief"
    name: "赤发火贼"
    level: 49
    exp: 849
    hp: 2350
    atk: 348
    def: 188
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "one_eye_fire_thief"
    name: "独眼火贼"
    level: 50
    exp: 999
    hp: 2700
    atk: 373
    def: 198
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "big_blade_bandit"
    name: "大刀匪兵"
    level: 40
    exp: 399
    hp: 1800
    atk: 288
    def: 151
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "iron_palm_camel"
    name: "铁掌神驼"
    level: 43
    exp: 549
    hp: 1950
    atk: 303
    def: 166
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "one_eye_monster"
    name: "独眼怪人"
    level: 44
    exp: 599
    hp: 2000
    atk: 323
    def: 169
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bounty_hunter_female"
    name: "赏金女猎人"
    level: 45
    exp: 649
    hp: 2200
    atk: 328
    def: 179
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "ronin_warrior"
    name: "浪人武士"
    level: 47
    exp: 749
    hp: 2250
    atk: 338
    def: 182
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "fast_blade_warrior"
    name: "快刀武士"
    level: 48
    exp: 799
    hp: 2300
    atk: 343
    def: 185
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "green_forest_bandit"
    name: "绿林山贼"
    level: 49
    exp: 849
    hp: 2350
    atk: 348
    def: 188
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "prison_escape_bandit"
    name: "越狱山贼"
    level: 50
    exp: 999
    hp: 2700
    atk: 373
    def: 198
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_short_sword_disciple"
    name: "颂武门短刀弟子"
    level: 51
    exp: 1049
    hp: 2800
    atk: 383
    def: 217
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_short_axe_disciple"
    name: "颂武门短斧弟子"
    level: 51
    exp: 1049
    hp: 2950
    atk: 388
    def: 222
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_new_recruit"
    name: "颂武门新丁"
    level: 52
    exp: 1099
    hp: 3100
    atk: 393
    def: 227
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_bully"
    name: "颂武门恶霸"
    level: 53
    exp: 1149
    hp: 3250
    atk: 398
    def: 232
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_spear_disciple"
    name: "颂武门长矛弟子"
    level: 54
    exp: 1199
    hp: 3400
    atk: 403
    def: 237
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_chain_hammer_disciple"
    name: "颂武门链锤弟子"
    level: 54
    exp: 1249
    hp: 3550
    atk: 408
    def: 242
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_crazy_blade_disciple"
    name: "颂武门狂刀弟子"
    level: 55
    exp: 1299
    hp: 3700
    atk: 428
    def: 247
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "jinbei_remote_sword"
    name: "金碑人遥剑"
    level: 56
    exp: 1349
    hp: 3850
    atk: 433
    def: 252
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "songwu_fast_blade_warrior"
    name: "颂武门快刀武士"
    level: 57
    exp: 1399
    hp: 4000
    atk: 438
    def: 257
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "amber_bandit"
    name: "琥珀盗贼"
    level: 51
    exp: 1049
    hp: 2950
    atk: 388
    def: 222
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "tamed_wolf_bandit"
    name: "驯狼盗贼"
    level: 54
    exp: 1249
    hp: 3550
    atk: 408
    def: 242
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "stick_bandit"
    name: "长棍毛贼"
    level: 51
    exp: 1049
    hp: 2800
    atk: 383
    def: 217
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "thief_small_head"
    name: "盗贼小头目"
    level: 52
    exp: 1099
    hp: 3100
    atk: 393
    def: 227
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "meteor_hammer_bandit"
    name: "流星锤强盗"
    level: 53
    exp: 1149
    hp: 3250
    atk: 398
    def: 232
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "black_face_bandit"
    name: "黑面盗贼"
    level: 54
    exp: 1199
    hp: 3400
    atk: 403
    def: 237
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bearded_bandit"
    name: "胡子大盗"
    level: 55
    exp: 1299
    hp: 3700
    atk: 428
    def: 247
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "ring_eye_bandit"
    name: "环眼大盗"
    level: 56
    exp: 1349
    hp: 3850
    atk: 433
    def: 252
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "scar_bandit"
    name: "刀疤大盗"
    level: 57
    exp: 1399
    hp: 4000
    atk: 438
    def: 257
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bamboo_forest_fairy"
    name: "竹林小魔仙"
    level: 57
    exp: 2000
    hp: 4200
    atk: 425
    def: 265
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bamboo_forest_wood_thief"
    name: "竹林盗伐者"
    level: 58
    exp: 2200
    hp: 4350
    atk: 430
    def: 270
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bamboo_god_servant"
    name: "竹神侍女"
    level: 57
    exp: 2000
    hp: 4200
    atk: 425
    def: 265
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bamboo_spear_warrior"
    name: "竹枪武士"
    level: 58
    exp: 2200
    hp: 4350
    atk: 430
    def: 270
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bamboo_forest_swordsman"
    name: "竹林剑士"
    level: 60
    exp: 2400
    hp: 4500
    atk: 445
    def: 275
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "bamboo_strip"
        name: "竹条"
        droprate: 0.001
        type: "quest_item"

  - key: "bamboo_forest_double_sword"
    name: "竹林双剑"
    level: 60
    exp: 2400
    hp: 4500
    atk: 445
    def: 275
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "bamboo_leaf"
        name: "竹叶"
        droprate: 0.001
        type: "quest_item"

  - key: "one_eye_evil_thief"
    name: "独眼恶贼"
    level: 59
    exp: 2600
    hp: 4650
    atk: 440
    def: 280
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "magnet_stone"
        name: "磁铁石"
        droprate: 0.001
        type: "quest_item"

  - key: "long_spear_bandit"
    name: "长枪匪兵"
    level: 38
    exp: 349
    hp: 1650
    atk: 275
    def: 149
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "gold_bell_snake"
    name: "金铃蛇"
    level: 60
    exp: 2750
    hp: 4850
    atk: 470
    def: 295
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "gold_bell_snake_scale"
        name: "金铃蛇蛇鳞"
        droprate: 0.001
        type: "quest_item"

  - key: "coral_snake"
    name: "珊瑚蛇"
    level: 60
    exp: 2900
    hp: 5050
    atk: 478
    def: 302
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "coral_snake_scale"
        name: "珊瑚蛇蛇鳞"
        droprate: 0.001
        type: "quest_item"

  - key: "green_head_snake"
    name: "青头蛇"
    level: 61
    exp: 3050
    hp: 5200
    atk: 486
    def: 309
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "green_head_snake_scale"
        name: "青头蛇蛇鳞"
        droprate: 0.001
        type: "quest_item"
      - item_key: "green_head_snake_fang"
        name: "青头蛇前牙"
        droprate: 0.001
        type: "quest_item"
      - item_key: "qingxuan_wine"
        name: "青玄酒"
        droprate: 0.001
        type: "quest_item"
      - item_key: "green_head_snake_venom"
        name: "青头蛇毒囊"
        droprate: 0.001
        type: "quest_item"

  - key: "red_cloud_tiger"
    name: "赤云虎"
    level: 60
    exp: 2750
    hp: 4850
    atk: 470
    def: 295
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "red_cloud_tiger_skin"
        name: "赤云虎皮"
        droprate: 0.001
        type: "quest_item"

  - key: "saber_tooth_evil_tiger"
    name: "剑齿恶虎"
    level: 60
    exp: 2900
    hp: 5050
    atk: 478
    def: 302
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "saber_tiger_skin"
        name: "剑齿虎皮"
        droprate: 0.001
        type: "quest_item"

  - key: "blood_wolf"
    name: "嗜血狂狼"
    level: 61
    exp: 3050
    hp: 5200
    atk: 486
    def: 309
    monster_type: "normal"
    skills: []
    drop_items:
      - item_key: "blood_wolf_skin"
        name: "嗜血狂狼皮"
        droprate: 0.001
        type: "quest_item"
      - item_key: "blood_wolf_claw"
        name: "嗜血狂狼爪"
        droprate: 0.001
        type: "quest_item"
      - item_key: "blood_wolf_tail"
        name: "嗜血狂狼尾毛"
        droprate: 0.001
        type: "quest_item"
      - item_key: "blood_wolf_blood"
        name: "嗜血狂狼之血"
        droprate: 0.001
        type: "quest_item"

  - key: "hunchback_flying_tiger_thief"
    name: "驼背飞虎贼"
    level: 61
    exp: 3200
    hp: 5400
    atk: 494
    def: 316
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "miser"
    name: "吝啬鬼"
    level: 62
    exp: 3350
    hp: 5600
    atk: 504
    def: 323
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "divine_palm_tiger_thief"
    name: "神掌飞虎贼"
    level: 63
    exp: 3500
    hp: 5800
    atk: 510
    def: 330
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bounty_scar_warrior"
    name: "赏猎刀疤勇士"
    level: 64
    exp: 3700
    hp: 6000
    atk: 518
    def: 337
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "bounty_female_assassin"
    name: "赏猎女刺客"
    level: 65
    exp: 3900
    hp: 6200
    atk: 538
    def: 344
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "iron_armor_guard"
    name: "铁甲卫士"
    level: 66
    exp: 4100
    hp: 6400
    atk: 546
    def: 351
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "ghost_mask_warrior"
    name: "鬼面武士"
    level: 67
    exp: 4300
    hp: 6600
    atk: 554
    def: 358
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "black_pine_patrol_thief"
    name: "黑松巡路贼"
    level: 61
    exp: 3200
    hp: 5400
    atk: 494
    def: 316
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "black_pine_red_eye_thief"
    name: "黑松红眼盗贼"
    level: 62
    exp: 3350
    hp: 5600
    atk: 504
    def: 323
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "black_pine_ghost_mask_thief"
    name: "黑松鬼面贼"
    level: 63
    exp: 3500
    hp: 5800
    atk: 510
    def: 330
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "violent_smuggler"
    name: "暴力走私商"
    level: 64
    exp: 3700
    hp: 6000
    atk: 518
    def: 337
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "straight_brow_drug_dealer"
    name: "直眉禁药商"
    level: 65
    exp: 3900
    hp: 6200
    atk: 538
    def: 344
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "masked_great_thief"
    name: "蒙面大盗"
    level: 66
    exp: 4100
    hp: 6400
    atk: 546
    def: 351
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "flying_female_thief"
    name: "飞天女盗"
    level: 67
    exp: 4300
    hp: 6600
    atk: 554
    def: 358
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "double_oar_escort_warrior"
    name: "双桨司护战士"
    level: 68
    exp: 4500
    hp: 6800
    atk: 560
    def: 365
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "iron_arm_escort_guard"
    name: "铁臂司护守卫"
    level: 69
    exp: 4700
    hp: 7000
    atk: 570
    def: 372
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "blue_face_escort_mad_warrior"
    name: "青面司护狂战"
    level: 70
    exp: 4900
    hp: 7200
    atk: 580
    def: 379
    monster_type: "normal"
    skills: []
    drop_items: []

  - key: "hammer_escort_general"
    name: "铁锤司护战将"
    level: 71
    exp: 5100
    hp: 7400
    atk: 590
    def: 383
    monster_type: "normal"
    skills: []
    drop_items: []


---

8. 地图系统

8.1 地图定义

# ========== [可配置] 地图定义 ==========
# 地图分为城镇、野外、爬塔三类
# 城镇：玩家补给和交互中心，自动恢复满生命和内功
# 野外：怪物分布区域，战斗后不自动恢复
# 爬塔：v1.0不涉及

maps:
  # ========== 城镇地图 ==========
  - key: "town_xuanbo"
    name: "泫渤派城镇"
    type: "town"                   # 城镇类型
    description: "泫渤派主城，玩家可以在这里购买装备和药剂"
    entry_requirement: null        # 无进入条件
    auto_full_restore: true        # 进入后自动恢复满生命和内功
    npcs:
      - npc_key: "shop_weapon_and_enhance"
        name: "刀剑笑"
        type: "shop_and_enhance"
      - npc_key: "shop_armor"
        name: "银娇龙"
        type: "shop"
        shop_type: "chest"
      - npc_key: "shop_potion"
        name: "平十指"
        type: "shop"
        shop_type: "potion"
      - npc_key: "quest_npc"
        name: "泫渤派门主"
        type: "quest"
      - npc_key: "warehouse_npc"
        name: "韦大宝"
        type: "warehouse"

  # ========== 野外地图（泫渤派郊外支持二级区域）==========
  - key: "wilderness_xuanbo_suburb"
    name: "泫渤派郊外"
    type: "wilderness"
    description: "泫渤派周围的郊区地带"
    entry_requirement: null
    auto_full_restore: false
    available_boxes:
      - "box_wood"
    sub_zones:
      - key: "xuanbo_village"
        name: "村庄周围"
        level_range: [3, 5]
        gold_range: [3, 5]
        monsters:
          - key: "stray_cat"
          - key: "toad"

      - key: "xuanbo_field"
        name: "村庄野田"
        level_range: [8, 12]
        gold_range: [8, 12]
        monsters:
          - key: "fox"
          - key: "wild_bull"
          - key: "wild_boar"

      - key: "xuanbo_den"
        name: "狼熊聚居地"
        level_range: [12, 15]
        gold_range: [12, 15]
        monsters:
          - key: "gray_wolf"
          - key: "bear"
          - key: "gray_wolf_king"

      - key: "xuanbo_lumber"
        name: "伐木场"
        level_range: [18, 22]
        gold_range: [18, 22]
        monsters:
          - key: "three_tail_fox"
          - key: "woodcutter"
          - key: "woodcutter_leader"
          - key: "blood_wolf"
          - key: "flower_bear"
          - key: "blood_wolf_king"

      - key: "xuanbo_cemetery"
        name: "墓地"
        level_range: [22, 30]
        gold_range: [22, 30]
        monsters:
          - key: "big_ape"
          - key: "small_zombie"
          - key: "small_blue_ghost"
          - key: "dancing_girl"
          - key: "broken_monk"
          - key: "mountain_ghost"

      - key: "xuanbo_robber"
        name: "山寨"
        level_range: [30, 35]
        gold_range: [30, 35]
        monsters:
          - key: "big_robber"
          - key: "giant_axe_robber"
          - key: "robber_chief"

  - key: "wilderness_liuzheng"
    name: "柳正关"
    type: "wilderness"
    description: "柳正关外的荒野"
    entry_requirement: null
    auto_full_restore: false
    monster_zone: "low"
    available_boxes:
      - "box_silver"
    sub_zones:
      - key: "liuzheng_forest"
        name: "关外山林"
        level_range: [35, 37]
        gold_range: [35, 37]
        monsters:
          - key: "red_bear"
          - key: "forest_tiger"
          - key: "white_tiger"

      - key: "liuzheng_fishing_village"
        name: "渔村"
        level_range: [38, 42]
        gold_range: [38, 42]
        monsters:
          - key: "pirate_villager"
          - key: "double_gun_pirate"
          - key: "big_arm_stranger"

      - key: "liuzheng_monster_camp"
        name: "怪兽营地"
        level_range: [43, 45]
        gold_range: [43, 45]
        monsters:
          - key: "small_mountain_creature"
          - key: "sharp_claw_sas"
          - key: "mountain_sas"

      - key: "liuzheng_fire_thief_den"
        name: "火贼山寨"
        level_range: [47, 50]
        gold_range: [47, 50]
        monsters:
          - key: "lotus_cultist"
          - key: "foreign_evil_monk"
          - key: "red_hair_fire_thief"
          - key: "one_eye_fire_thief"

      - key: "liuzheng_wanshou_pavilion"
        name: "万寿阁下层"
        level_range: [51, 54]
        gold_range: [51, 54]
        monsters:
          - key: "songwu_short_sword_disciple"
          - key: "songwu_short_axe_disciple"
          - key: "songwu_spear_disciple"
          - key: "songwu_new_recruit"
          - key: "songwu_bully"

      - key: "liuzheng_wanshou_pavilion_upper"
        name: "万寿阁上层"
        level_range: [54, 57]
        gold_range: [54, 57]
        monsters:
          - key: "songwu_chain_hammer_disciple"
          - key: "songwu_crazy_blade_disciple"
          - key: "jinbei_remote_sword"
          - key: "songwu_fast_blade_warrior"

      - key: "liuzheng_deep_bamboo"
        name: "渊竹林"
        level_range: [57, 59]
        gold_range: [57, 59]
        monsters:
          - key: "bamboo_forest_fairy"
          - key: "bamboo_forest_wood_thief"
          - key: "bamboo_forest_double_sword"
          - key: "one_eye_evil_thief"

  - key: "wilderness_shenwu"
    name: "神武门"
    type: "wilderness"
    description: "神武门外的山野"
    entry_requirement: null
    auto_full_restore: false
    monster_zone: "mid"            # 中级怪物区域
    available_boxes:
      - "box_silver"
    sub_zones:
      - key: "shenwu_tiger_valley"
        name: "虎峡谷"
        level_range: [60, 61]
        gold_range: [60, 61]
        monsters:
          - key: "red_cloud_tiger"
          - key: "saber_tooth_evil_tiger"
          - key: "blood_wolf"

      - key: "shenwu_miser_cave"
        name: "吝啬鬼洞穴"
        level_range: [61, 63]
        gold_range: [61, 63]
        monsters:
          - key: "hunchback_flying_tiger_thief"
          - key: "miser"
          - key: "divine_palm_tiger_thief"

      - key: "shenwu_degenerate_land"
        name: "变质的荒地"
        level_range: [64, 67]
        gold_range: [64, 67]
        monsters:
          - key: "bounty_scar_warrior"
          - key: "bounty_female_assassin"
          - key: "iron_armor_guard"
          - key: "ghost_mask_warrior"

  - key: "wilderness_sanxie"
    name: "三邪关"
    type: "wilderness"
    description: "三邪关外的荒原"
    entry_requirement: null
    auto_full_restore: false
    monster_zone: "mid"
    available_boxes:
      - "box_silver"
    sub_zones:
      - key: "sanxie_forest"
        name: "关外山林"
        level_range: [35, 37]
        gold_range: [35, 37]
        monsters:
          - key: "red_bear"
          - key: "forest_tiger"
          - key: "white_tiger"

      - key: "sanxie_deserter_camp"
        name: "逃兵营地"
        level_range: [38, 42]
        gold_range: [38, 42]
        monsters:
          - key: "long_spear_bandit"
          - key: "big_blade_bandit"
          - key: "big_arm_stranger"

      - key: "sanxie_hunter_camp"
        name: "猎人寨"
        level_range: [43, 45]
        gold_range: [43, 45]
        monsters:
          - key: "iron_palm_camel"
          - key: "one_eye_monster"
          - key: "bounty_hunter_female"

      - key: "sanxie_green_forest_camp"
        name: "绿林寨"
        level_range: [47, 50]
        gold_range: [47, 50]
        monsters:
          - key: "ronin_warrior"
          - key: "fast_blade_warrior"
          - key: "green_forest_bandit"
          - key: "prison_escape_bandit"

      - key: "sanxie_wutian_lower"
        name: "无天阁下层"
        level_range: [51, 54]
        gold_range: [51, 54]
        monsters:
          - key: "stick_bandit"
          - key: "amber_bandit"
          - key: "thief_small_head"
          - key: "meteor_hammer_bandit"
          - key: "black_face_bandit"

      - key: "sanxie_wutian_upper"
        name: "无天阁上层"
        level_range: [54, 57]
        gold_range: [54, 57]
        monsters:
          - key: "tamed_wolf_bandit"
          - key: "bearded_bandit"
          - key: "ring_eye_bandit"
          - key: "scar_bandit"

      - key: "sanxie_bamboo_fire_forest"
        name: "竹火林"
        level_range: [57, 59]
        gold_range: [57, 59]
        monsters:
          - key: "bamboo_god_servant"
          - key: "bamboo_spear_warrior"
          - key: "bamboo_forest_swordsman"
          - key: "one_eye_evil_thief"

  - key: "wilderness_liushan"
    name: "柳善提督府"
    type: "wilderness"
    description: "柳善提督府外的密林"
    entry_requirement: null
    auto_full_restore: false
    monster_zone: "high"           # 高级怪物区域
    available_boxes:
      - "box_gold"
    sub_zones:
      - key: "liushan_snake_valley"
        name: "蛇谷"
        level_range: [60, 61]
        gold_range: [60, 61]
        monsters:
          - key: "gold_bell_snake"
          - key: "coral_snake"
          - key: "green_head_snake"

      - key: "liushan_black_pine_base"
        name: "黑松贼根据地"
        level_range: [61, 63]
        gold_range: [61, 63]
        monsters:
          - key: "black_pine_patrol_thief"
          - key: "black_pine_red_eye_thief"
          - key: "black_pine_ghost_mask_thief"

      - key: "liushan_thief_nest"
        name: "盗贼巢穴"
        level_range: [64, 67]
        gold_range: [64, 67]
        monsters:
          - key: "violent_smuggler"
          - key: "straight_brow_drug_dealer"
          - key: "masked_great_thief"
          - key: "flying_female_thief"

  - key: "wilderness_nanminghu"
    name: "南明湖"
    type: "wilderness"
    description: "南明湖畔的湿地"
    entry_requirement: null
    auto_full_restore: false
    monster_zone: "high"
    available_boxes:
      - "box_gold"
    sub_zones:
      - key: "nanminghu_lake"
        name: "南明湖"
        level_range: [68, 71]
        gold_range: [68, 71]
        monsters:
          - key: "double_oar_escort_warrior"
          - key: "iron_arm_escort_guard"
          - key: "blue_face_escort_mad_warrior"
          - key: "hammer_escort_general"
      - key: "nanminghu_cave"
        name: "南明洞"
        level_range: [71, 75]
        gold_range: [71, 75]
        monsters: []

  # ========== 爬塔地图（v1.0不涉及）==========
  # - key: "tower_xxx"
  #   name: "xxx塔"
  #   type: "tower"
  #   description: "爬塔地图，挑战层层Boss"
  #   entry_requirement: null
  #   auto_full_restore: false
  #   tower_floors: []              # v1.0不涉及

8.2 NPC配置


# ========== [可配置] NPC配置 ==========
# NPC类型：shop（商店）、quest（任务）、enhance（强化）
# 商店NPC需要配置商品列表和价格倍率

npc_templates:
  # 武器商人 + 强化（刀剑笑）
  shop_weapon_and_enhance:
    name: "刀剑笑"
    type: "shop_and_enhance"        # 商店+强化NPC，细节由强化系统规则控制
    shop_type: "weapon"
    items:
      # 刀客武器（base + t1）
      - item_key: "blade_base_001"
        name: "直刀"
        buy_price: 5000
      - item_key: "blade_base_002"
        name: "铁刀"
        buy_price: 5000
      - item_key: "blade_t1_001"
        name: "钢刀"
        buy_price: 50000
      - item_key: "blade_t1_002"
        name: "半月刀"
        buy_price: 50000
      - item_key: "blade_t1_003"
        name: "精钢刀"
        buy_price: 50000
      - item_key: "blade_t1_004"
        name: "雁月刀"
        buy_price: 50000
      # 剑客武器（base + t1）
      - item_key: "sword_base_001"
        name: "木剑"
        buy_price: 5000
      - item_key: "sword_base_002"
        name: "重剑"
        buy_price: 5000
      - item_key: "sword_t1_001"
        name: "钢剑"
        buy_price: 50000
      - item_key: "sword_t1_002"
        name: "水月剑"
        buy_price: 50000
      - item_key: "sword_t1_003"
        name: "月花剑"
        buy_price: 50000
      - item_key: "sword_t1_004"
        name: "赤星剑"
        buy_price: 50000
      # 杖客武器（base + t1）
      - item_key: "staff_base_001"
        name: "木杖"
        buy_price: 5000
      - item_key: "staff_base_002"
        name: "桃木杖"
        buy_price: 5000
      - item_key: "staff_t1_001"
        name: "越女杖"
        buy_price: 50000
      - item_key: "staff_t1_002"
        name: "太月杖"
        buy_price: 50000
      - item_key: "staff_t1_003"
        name: "碧玉杖"
        buy_price: 50000
      - item_key: "staff_t1_004"
        name: "檀香杖"
        buy_price: 50000
      # 枪客武器（base + t1）
      - item_key: "spear_base_001"
        name: "木枪"
        buy_price: 5000
      - item_key: "spear_base_002"
        name: "长枪"
        buy_price: 5000
      - item_key: "spear_t1_001"
        name: "流星枪"
        buy_price: 50000
      - item_key: "spear_t1_002"
        name: "月牙枪"
        buy_price: 50000
      - item_key: "spear_t1_003"
        name: "狼牙枪"
        buy_price: 50000
      - item_key: "spear_t1_004"
        name: "赤蛇枪"
        buy_price: 50000
      # 弓手武器（base + t1）
      - item_key: "bow_base_001"
        name: "竹弓"
        buy_price: 5000
      - item_key: "bow_base_002"
        name: "硬弓"
        buy_price: 5000
      - item_key: "bow_t1_001"
        name: "青木弓"
        buy_price: 50000
      - item_key: "bow_t1_002"
        name: "绿蛇弓"
        buy_price: 50000
      - item_key: "bow_t1_003"
        name: "青蛇弓"
        buy_price: 50000
      - item_key: "bow_t1_004"
        name: "草流弓"
        buy_price: 50000
    price_multiplier: 1.0

  shop_armor:
    name: "银娇龙"
    type: "shop"
    shop_type: "chest"
    items:
      # 衣服（base阶段，5职业×3件=15件）
      - item_key: "blade_chest_base_001"
        name: "无名战袍"
        buy_price: 2000
      - item_key: "blade_chest_base_002"
        name: "金丝战袍"
        buy_price: 4000
      - item_key: "blade_chest_base_003"
        name: "乌蚕战袍"
        buy_price: 6000
      - item_key: "sword_chest_base_001"
        name: "无名侠衣"
        buy_price: 2000
      - item_key: "sword_chest_base_002"
        name: "金丝侠衣"
        buy_price: 4000
      - item_key: "sword_chest_base_003"
        name: "乌蚕侠衣"
        buy_price: 6000
      - item_key: "staff_chest_base_001"
        name: "无名法袍"
        buy_price: 2000
      - item_key: "staff_chest_base_002"
        name: "金丝法袍"
        buy_price: 4000
      - item_key: "staff_chest_base_003"
        name: "乌蚕法袍"
        buy_price: 6000
      - item_key: "spear_chest_base_001"
        name: "无名枪衣"
        buy_price: 2000
      - item_key: "spear_chest_base_002"
        name: "金丝枪衣"
        buy_price: 4000
      - item_key: "spear_chest_base_003"
        name: "乌蚕枪衣"
        buy_price: 6000
      - item_key: "archer_chest_base_001"
        name: "无名战衣"
        buy_price: 2000
      - item_key: "archer_chest_base_002"
        name: "金丝战衣"
        buy_price: 4000
      - item_key: "archer_chest_base_003"
        name: "乌蚕战衣"
        buy_price: 6000
      # 护手（base阶段，4件）
      - item_key: "gloves_base_001"
        name: "皮护手"
        buy_price: 1000
      - item_key: "gloves_base_002"
        name: "青铜护手"
        buy_price: 2000
      - item_key: "gloves_base_003"
        name: "精炼护手"
        buy_price: 4000
      - item_key: "gloves_base_004"
        name: "罗汉护手"
        buy_price: 6000
      # 靴子（base阶段，5件）
      - item_key: "boots_base_001"
        name: "无名短靴"
        buy_price: 600
      - item_key: "boots_base_002"
        name: "青衣短靴"
        buy_price: 1000
      - item_key: "boots_base_003"
        name: "皮短靴"
        buy_price: 2000
      - item_key: "boots_base_004"
        name: "无名长靴"
        buy_price: 4000
      - item_key: "boots_base_005"
        name: "皮长靴"
        buy_price: 6000
    price_multiplier: 1.0

  shop_potion:
    name: "平十指"
    type: "shop"
    shop_type: "potion"
    items:
      - item_key: "hp_potion_grade1"
        name: "金创药（小）"
        buy_price: 10
      - item_key: "mp_potion_grade1"
        name: "人参"
        buy_price: 10
      - item_key: "hp_potion_grade2"
        name: "金创药（中）"
        buy_price: 50
      - item_key: "mp_potion_grade2"
        name: "野山参"
        buy_price: 50
      - item_key: "hp_potion_grade3"
        name: "金创药（大）"
        buy_price: 120
      - item_key: "mp_potion_grade3"
        name: "雪原参"
        buy_price: 120
    price_multiplier: 1.0

  quest_npc:
    name: "泫渤派门主"
    type: "quest"
    quests:
      - key: "quest_transfer_1"
        name: "初入江湖"
      - key: "quest_transfer_2"
        name: "江湖历练"
      - key: "quest_transfer_3_positive"
        name: "武林正道"
      - key: "quest_transfer_3_negative"
        name: "武林邪道"
      - key: "quest_transfer_4"
        name: "宗师之路"

  # 仓库NPC
  warehouse_npc:
    name: "韦大宝"
    type: "warehouse"
    description: "提供物品存储服务"
    capacity: 50                   # 固定容量，无需扩充

8.3 任务系统


# ========== [可配置] 任务系统 ==========
# 任务类型：转职任务、打怪任务、收集任务
# 转职任务：1转/2转/3转/4转，需要打怪获取任务物品

quest_templates:
  # ===== 1转任务（转职1次）=====
  transfer_1:
    key: "quest_transfer_1"
    name: "初入江湖"
    description: "泫渤派门主让你去郊外猎取证明实力的材料"
    type: "career_transfer"
    required_transfer: 0
    target_transfer: 1
    prerequisite:
      level: 10
    objectives:
      - type: "collect_item"
        item_key: "boar_leg"
        item_name: "野猪后腿"
        count: 10
        drop_monster: "wild_boar"
        drop_rate: 0.001
      - type: "collect_item"
        item_key: "wolf_bone"
        item_name: "灰狼之骨"
        count: 3
        drop_monster: "gray_wolf"
        drop_rate: 0.001
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_1st", "warrior_sword_transfer_1st", "healer_transfer_1st", "warrior_spear_transfer_1st", "archer_transfer_1st"]
    dialogue:
      accept: "去吧，证明你的实力，带回10个野猪后腿和3个灰狼之骨。"
      complete: "不错，你已经具备了转职的条件。"

  # ===== 2转任务（转职2次）=====
  transfer_2:
    key: "quest_transfer_2"
    name: "江湖历练"
    description: "泫渤派门主让你猎取多种猛兽之皮，证明你已经可以独当一面"
    type: "career_transfer"
    required_transfer: 1
    target_transfer: 2
    prerequisite:
      level: 35
    objectives:
      - type: "collect_item"
        item_key: "red_bear_skin"
        item_name: "赤血熊之皮"
        count: 10
        drop_monster: "red_bear"
        drop_rate: 0.0001
      - type: "collect_item"
        item_key: "forest_tiger_skin"
        item_name: "山林黄虎之皮"
        count: 10
        drop_monster: "forest_tiger"
        drop_rate: 0.0001
      - type: "collect_item"
        item_key: "white_tiger_skin"
        item_name: "白纹虎之皮"
        count: 10
        drop_monster: "white_tiger"
        drop_rate: 0.0001
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_2st_Z", "warrior_blade_transfer_2st_X", "warrior_sword_transfer_2st_Z", "warrior_sword_transfer_2st_X", "healer_transfer_2st_Z", "healer_transfer_2st_X", "warrior_spear_transfer_2st_Z", "warrior_spear_transfer_2st_X", "archer_transfer_2st_Z", "archer_transfer_2st_X"]
    dialogue:
      accept: "你已经成长了，去猎取10个赤血熊之皮、10个山林黄虎之皮、10个白纹虎之皮回来。"
      complete: "很好，你已经是合格的江湖人士了。"

  # ===== 3转任务（转职3次）=====
  transfer_3_positive:
    key: "quest_transfer_3_positive"
    name: "武林正道"
    description: "泫渤派门主让你通过三道考验，证明你是正道高手"
    type: "career_transfer"
    faction: "positive"              # 正派专属
    required_transfer: 2
    target_transfer: 3
    prerequisite:
      level: 60
    objectives:
      # 第一轮
      - stage: 1
        name: "初试锋芒"
        items:
          - item_key: "magnet_stone"
            name: "磁铁石"
            count: 10
            drop_monster: "one_eye_evil_thief"    # 独眼恶贼
            drop_rate: 0.0001
          - item_key: "bamboo_leaf"
            name: "竹叶"
            count: 10
            drop_monster: "bamboo_forest_double_sword"   # 竹林双剑
            drop_rate: 0.0001
      # 第二轮
      - stage: 2
        name: "再试身手"
        items:
          - item_key: "saber_tiger_skin"
            name: "剑齿虎皮"
            count: 10
            drop_monster: "saber_tooth_evil_tiger"
            drop_rate: 0.0001
          - item_key: "red_cloud_tiger_skin"
            name: "赤云虎皮"
            count: 10
            drop_monster: "red_cloud_tiger"
            drop_rate: 0.0001
      # 第三轮
      - stage: 3
        name: "终试实力"
        items:
          - item_key: "blood_wolf_skin"
            name: "嗜血狂狼皮"
            count: 10
            drop_monster: "blood_wolf"
            drop_rate: 0.0001
            exclusive_group: "blood_wolf"        # 同组物品单次只掉1个
          - item_key: "blood_wolf_claw"
            name: "嗜血狂狼爪"
            count: 10
            drop_monster: "blood_wolf"
            drop_rate: 0.0001
            exclusive_group: "blood_wolf"
          - item_key: "blood_wolf_tail"
            name: "嗜血狂狼尾毛"
            count: 10
            drop_monster: "blood_wolf"
            drop_rate: 0.0001
            exclusive_group: "blood_wolf"
          - item_key: "blood_wolf_blood"
            name: "嗜血狂狼之血"
            count: 10
            drop_monster: "blood_wolf"
            drop_rate: 0.0001
            exclusive_group: "blood_wolf"
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_3st_Z", "warrior_sword_transfer_3st_Z", "healer_transfer_3st_Z", "warrior_spear_transfer_3st_Z", "archer_transfer_3st_Z"]
    dialogue:
      accept: "你已经是一方高手，但还需证明你的实力。完成三道考验方可转职。"
      complete: "不错，你已经是正道的武林高手了。"

  transfer_3_negative:
    key: "quest_transfer_3_negative"
    name: "武林邪道"
    description: "泫渤派门主让你通过三道考验，证明你是邪道高手"
    type: "career_transfer"
    faction: "negative"              # 邪派专属
    required_transfer: 2
    target_transfer: 3
    prerequisite:
      level: 60
    objectives:
      # 第一轮
      - stage: 1
        name: "初试锋芒"
        items:
          - item_key: "bamboo_strip"
            name: "竹条"
            count: 10
            drop_monster: "bamboo_forest_swordsman"   # 竹林剑士
            drop_rate: 0.0001
          - item_key: "magnet_stone"
            name: "磁铁石"
            count: 10
            drop_monster: "one_eye_evil_thief"    # 独眼恶贼
            drop_rate: 0.0001
      # 第二轮
      - stage: 2
        name: "再试身手"
        items:
          - item_key: "gold_bell_snake_scale"
            name: "金铃蛇蛇鳞"
            count: 10
            drop_monster: "gold_bell_snake" # 金铃蛇
            drop_rate: 0.0001
          - item_key: "coral_snake_scale"
            name: "珊瑚蛇蛇鳞"
            count: 10
            drop_monster: "coral_snake"
            drop_rate: 0.0001
      # 第三轮
      - stage: 3
        name: "终试实力"
        items:
          - item_key: "green_head_snake_scale"
            name: "青头蛇蛇鳞"
            count: 10
            drop_monster: "green_head_snake"
            drop_rate: 0.0001
            exclusive_group: "green_head_snake"
          - item_key: "green_head_snake_fang"
            name: "青头蛇前牙"
            count: 10
            drop_monster: "green_head_snake"
            drop_rate: 0.0001
            exclusive_group: "green_head_snake"
          - item_key: "qingxuan_wine"
            name: "青玄酒"
            count: 10
            drop_monster: "green_head_snake"
            drop_rate: 0.0001
            exclusive_group: "green_head_snake"
          - item_key: "green_head_snake_venom"
            name: "青头蛇毒囊"
            count: 10
            drop_monster: "green_head_snake"
            drop_rate: 0.0001
            exclusive_group: "green_head_snake"
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_3st_X", "warrior_sword_transfer_3st_X", "healer_transfer_3st_X", "warrior_spear_transfer_3st_X", "archer_transfer_3st_X"]
    dialogue:
      accept: "你已经是一方高手，但还需证明你的实力。完成三道考验方可转职。"
      complete: "不错，你已经是邪道的武林高手了。"

  # ===== 4转任务（转职4次）=====  # v1.0不涉及
  transfer_4:
    key: "quest_transfer_4"
    name: "宗师之路"
    description: "泫渤派门主让你去柳善府猎取魂石，证明你已经接近宗师"  # v1.0不涉及
    type: "career_transfer"
    required_transfer: 3
    target_transfer: 4
    prerequisite:
      level: 80
    objectives:
      - type: "collect_item"
        item_key: "soul_stone"
        item_name: "魂石"
        count: 15
        drop_monster: "monster_liushan_001"
        drop_rate: 0.15
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_4st_Z", "warrior_blade_transfer_4st_X", "warrior_sword_transfer_4st_Z", "warrior_sword_transfer_4st_X", "healer_transfer_4st_Z", "healer_transfer_4st_X", "warrior_spear_transfer_4st_Z", "warrior_spear_transfer_4st_X", "archer_transfer_4st_Z", "archer_transfer_4st_X"]
    dialogue:
      accept: "你距宗师只差一步，去柳善府猎取15颗魂石。"
      complete: "从今日起，你便是宗师。"

# ========== [可配置] 任务物品定义 ==========
quest_items:
  boar_leg:
    name: "野猪后腿"
    type: "quest_material"
    description: "野猪的后腿，证明猎人有能力"
    sell_price: 0                     # 任务物品不可出售

  wolf_bone:
    name: "灰狼之骨"
    type: "quest_material"
    description: "灰狼的骨头，坚硬如玉"
    sell_price: 0                     # 任务物品不可出售

  red_bear_skin:
    name: "赤血熊之皮"
    type: "quest_material"
    description: "赤血熊的皮，厚实坚韧"
    sell_price: 0

  forest_tiger_skin:
    name: "山林黄虎之皮"
    type: "quest_material"
    description: "山林黄虎的皮，金纹华丽"
    sell_price: 0

  white_tiger_skin:
    name: "白纹虎之皮"
    type: "quest_material"
    description: "白纹虎的皮，纹理如诗"
    sell_price: 0

  bamboo_leaf:
    name: "竹叶"
    type: "quest_material"
    description: "翠绿竹叶，可入药"
    sell_price: 0

  saber_tiger_skin:
    name: "剑齿虎皮"
    type: "quest_material"
    description: "剑齿虎的皮，坚韧如铁"
    sell_price: 0

  red_cloud_tiger_skin:
    name: "赤云虎皮"
    type: "quest_material"
    description: "赤云虎的皮，纹路如云"
    sell_price: 0

  blood_wolf_skin:
    name: "嗜血狂狼皮"
    type: "quest_material"
    description: "嗜血狂狼的皮，毛发如刺"
    sell_price: 0

  blood_wolf_claw:
    name: "嗜血狂狼爪"
    type: "quest_material"
    description: "嗜血狂狼的爪子，锋利无比"
    sell_price: 0

  blood_wolf_tail:
    name: "嗜血狂狼尾毛"
    type: "quest_material"
    description: "嗜血狂狼的尾毛，血色鲜艳"
    sell_price: 0

  blood_wolf_blood:
    name: "嗜血狂狼之血"
    type: "quest_material"
    description: "嗜血狂狼的血液，殷红如珠"
    sell_price: 0

  # 邪派3转任务物品
  bamboo_strip:
    name: "竹条"
    type: "quest_material"
    description: "竹子劈成的细条，可编织"
    sell_price: 0

  # 正邪3转通用任务物品
  magnet_stone:
    name: "磁铁石"
    type: "quest_material"
    description: "天然磁铁石，带有磁性"
    sell_price: 0

  gold_bell_snake_scale:
    name: "金铃蛇蛇鳞"
    type: "quest_material"
    description: "金铃蛇的金色鳞片，光泽耀眼"
    sell_price: 0

  coral_snake_scale:
    name: "珊瑚蛇蛇鳞"
    type: "quest_material"
    description: "珊瑚蛇的珊瑚色鳞片"
    sell_price: 0

  green_head_snake_scale:
    name: "青头蛇蛇鳞"
    type: "quest_material"
    description: "青头蛇的青色鳞片，晶莹剔透"
    sell_price: 0

  green_head_snake_fang:
    name: "青头蛇前牙"
    type: "quest_material"
    description: "青头蛇的前牙，锋利如针"
    sell_price: 0

  qingxuan_wine:
    name: "青玄酒"
    type: "quest_material"
    description: "青玄蛇浸泡的药酒"
    sell_price: 0

  green_head_snake_venom:
    name: "青头蛇毒囊"
    type: "quest_material"
    description: "青头蛇的毒囊，剧毒无比"
    sell_price: 0

  soul_stone:
    name: "魂石"
    type: "quest_material"
    description: "蕴含灵魂力量的石头"
    sell_price: 50


---

9. 经济与掉落系统

9.1 金币系统

# ========== [可配置] 金币系统 ==========

economy:
  # 金币掉落规则（每次怪物击杀）
  gold_drop:
    drop_rate: 0.10                   # 固定10%掉落概率
    base_formula: "sub_zone.gold_range"   # 基础金币从怪物所属sub_zone的gold_range读取
    bonus_formula: "base_gold * (1 + player.gold_drop_bonus / 100)"  # 热血石金币爆率加成

  # 历练获取规则
  training_drop:
    drop_rate: 1.0                    # 100%获取
    condition: "monster.level >= player.level - 5"  # 怪物等级不低于角色等级-5级
    amount: 1                          # 每次击杀获取1点历练
    no_bonus: true                     # 无任何加成机制

  # 金币获取来源（除怪物掉落外的其他来源）
  income_sources:
    - type: "stage_clear"
      formula: "stage_level * random(5, 15)"

    - type: "sell_equipment"
      formula: "equipment_base_price * 0.5"    # 出售价格为原价的50%

  # 金币消耗
  expenses:
    - type: "buy_equipment"
      formula: "equipment_base_price"

    - type: "upgrade_equipment"
      formula: "current_level * 100"

    - type: "skill_reset"
      fixed: 1000

    - type: "career_change"
      fixed: 5000

9.2 掉落系统

# ========== [可配置] 掉落系统 ==========

drop_system:
  # 空配置，仅保留章节结构


---

9.3 地图掉落池系统

# ========== [可配置] 地图掉落池 ==========
# 每个地图从全局装备/石头中选择部分物品纳入该地图的掉落池
# 在此池中按地图单独配置掉落规则和权重
# 普通怪只走地图掉落池，特殊怪走地图掉落池 + 自身掉落（叠加）

map_drop_template:
  key: "地图掉落池ID"
  sub_zone_key: "对应的二级zone key"    # 按二级zone配置掉落池

  # 掉落轮次：每次击杀可触发多轮掉落判定
  drop_rolls:
    - name: "普通掉落"        # 每次击杀必触发
      roll_count: 1           # 判定次数
      trigger: "always"       # always(每次) / elite_only(仅精英) / boss_only(仅Boss)

  # 装备掉落池（从全局装备中选择纳入本地图的装备）
  equipment_pool:
    - key: "装备key"           # 精确指定装备key
      weight: 50               # 该装备在池中的权重
      drop_rate: 0.05          # 基础掉落率

  # 石头掉落池（从全局石头中选择纳入本地图的石头）
  stone_pool:
    - key: "cold_jade_01"     # 精确指定石头key
      weight: 35
      drop_rate: 0.15

  # 地图掉落倍率
  drop_multiplier:
    equipment_rate: 1.0         # 装备掉落率倍率
    stone_rate: 1.0             # 石头掉落率倍率

  # 等级差惩罚/加成
  level_diff_modifier:
    enabled: true
    formula: |
      level_diff = player_level - monster_level
      if level_diff > 10:
          rate_modifier = max(0.1, 1.0 - (level_diff - 10) * 0.05)
      else:
          rate_modifier = 1.0
      # 玩家等级超出怪物10级以上，每多1级掉落率降低5%，最低10%

# ========== [可配置] 地图掉落池列表 ==========

sub_zone_drops:
  # ===== 泫渤派郊外 =====
  - key: "drop_xuanbo_village"
    sub_zone_key: "xuanbo_village"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_base_002"
        weight: 6
        drop_rate: 0.03
      - key: "sword_base_002"
        weight: 6
        drop_rate: 0.03
      - key: "staff_base_002"
        weight: 6
        drop_rate: 0.03
      - key: "spear_base_002"
        weight: 6
        drop_rate: 0.03
      - key: "bow_base_002"
        weight: 6
        drop_rate: 0.03
      - key: "gloves_base_001"
        weight: 24
        drop_rate: 0.05
      - key: "boots_base_001"
        weight: 24
        drop_rate: 0.05
      - key: "boots_base_002"
        weight: 24
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_xuanbo_field"
    sub_zone_key: "xuanbo_field"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t1_001"
        weight: 6
        drop_rate: 0.03
      - key: "sword_t1_001"
        weight: 6
        drop_rate: 0.03
      - key: "staff_t1_001"
        weight: 6
        drop_rate: 0.03
      - key: "spear_t1_001"
        weight: 6
        drop_rate: 0.03
      - key: "bow_t1_001"
        weight: 6
        drop_rate: 0.03
      - key: "blade_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "sword_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "spear_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "staff_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "archer_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_003"
        weight: 8
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_xuanbo_den"
    sub_zone_key: "xuanbo_den"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t1_002"
        weight: 6
        drop_rate: 0.03
      - key: "sword_t1_002"
        weight: 6
        drop_rate: 0.03
      - key: "staff_t1_002"
        weight: 6
        drop_rate: 0.03
      - key: "spear_t1_002"
        weight: 6
        drop_rate: 0.03
      - key: "bow_t1_002"
        weight: 6
        drop_rate: 0.03
      - key: "blade_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "sword_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "spear_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "staff_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "archer_chest_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_001"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_003"
        weight: 8
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_xuanbo_lumber"
    sub_zone_key: "xuanbo_lumber"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t1_003"
        weight: 6
        drop_rate: 0.03
      - key: "sword_t1_003"
        weight: 6
        drop_rate: 0.03
      - key: "staff_t1_003"
        weight: 6
        drop_rate: 0.03
      - key: "spear_t1_003"
        weight: 6
        drop_rate: 0.03
      - key: "bow_t1_003"
        weight: 6
        drop_rate: 0.03
      - key: "blade_chest_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "sword_chest_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "spear_chest_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "staff_chest_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "archer_chest_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_002"
        weight: 8
        drop_rate: 0.05
      - key: "gloves_base_003"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_003"
        weight: 8
        drop_rate: 0.05
      - key: "boots_base_004"
        weight: 8
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_xuanbo_cemetery"
    sub_zone_key: "xuanbo_cemetery"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t1_004"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t1_004"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t1_004"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t1_004"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t1_004"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_base_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_002"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_base_002"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_base_002"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_base_002"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_base_002"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_base_003"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 5
        drop_rate: 0.05
      - key: "boots_base_004"
        weight: 5
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_xuanbo_robber"
    sub_zone_key: "xuanbo_robber"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t1_005"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t1_006"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t1_005"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t1_006"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t1_005"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t1_006"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t1_005"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t1_006"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t1_005"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t1_006"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_base_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 20
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 20
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.10
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.08
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.15
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  # ===== 柳正关 =====
  - key: "drop_liuzheng_forest"
    sub_zone_key: "liuzheng_forest"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 20
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 20
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_fishing_village"
    sub_zone_key: "liuzheng_fishing_village"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 20
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 20
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_monster_camp"
    sub_zone_key: "liuzheng_monster_camp"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_fire_thief_den"
    sub_zone_key: "liuzheng_fire_thief_den"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_wanshou_pavilion"
    sub_zone_key: "liuzheng_wanshou_pavilion"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_wanshou_pavilion_upper"
    sub_zone_key: "liuzheng_wanshou_pavilion_upper"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "inner_armor_t3_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liuzheng_deep_bamboo"
    sub_zone_key: "liuzheng_deep_bamboo"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "inner_armor_t3_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  # ===== 神武门 =====
  - key: "drop_shenwu_tiger_valley"
    sub_zone_key: "shenwu_tiger_valley"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 10
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_shenwu_miser_cave"
    sub_zone_key: "shenwu_miser_cave"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 10
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_shenwu_degenerate_land"
    sub_zone_key: "shenwu_degenerate_land"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  # ===== 三邪关 =====
  - key: "drop_sanxie_forest"
    sub_zone_key: "sanxie_forest"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 20
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 20
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_deserter_camp"
    sub_zone_key: "sanxie_deserter_camp"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "sword_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "spear_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "staff_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "archer_chest_base_003"
        weight: 20
        drop_rate: 0.05
      - key: "gloves_base_004"
        weight: 20
        drop_rate: 0.05
      - key: "boots_base_005"
        weight: 20
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_hunter_camp"
    sub_zone_key: "sanxie_hunter_camp"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_green_forest_camp"
    sub_zone_key: "sanxie_green_forest_camp"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t2_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t2_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_wutian_lower"
    sub_zone_key: "sanxie_wutian_lower"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t2_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_wutian_upper"
    sub_zone_key: "sanxie_wutian_upper"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "inner_armor_t3_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_sanxie_bamboo_fire_forest"
    sub_zone_key: "sanxie_bamboo_fire_forest"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "blade_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "sword_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "staff_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "spear_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_positive_004"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_001"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_002"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_003"
        weight: 1
        drop_rate: 0.03
      - key: "bow_t2_negative_004"
        weight: 1
        drop_rate: 0.03
      - key: "inner_armor_t3_001"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t2_negative_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_positive_002"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t2_negative_002"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 35
        drop_rate: 0.12
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.10
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  # ===== 柳善提督府 =====
  - key: "drop_liushan_snake_valley"
    sub_zone_key: "liushan_snake_valley"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 10
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liushan_black_pine_base"
    sub_zone_key: "liushan_black_pine_base"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 10
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 5
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 5
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_liushan_thief_nest"
    sub_zone_key: "liushan_thief_nest"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "blade_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "sword_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "staff_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "spear_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_positive_002"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_001"
        weight: 2
        drop_rate: 0.03
      - key: "bow_t3_negative_002"
        weight: 2
        drop_rate: 0.03
      - key: "inner_armor_t3_002"
        weight: 20
        drop_rate: 0.01
      - key: "blade_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "blade_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "sword_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "spear_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "staff_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "archer_chest_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "gloves_t3_negative_001"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t3_positive_001"
        weight: 10
        drop_rate: 0.05
      - key: "boots_t3_negative_001"
        weight: 10
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 30
        drop_rate: 0.14
      - key: "vajra_01"
        weight: 25
        drop_rate: 0.12
      - key: "enhance_stone_01"
        weight: 30
        drop_rate: 0.18
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.06
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  # ===== 南明湖 =====
  - key: "drop_nanminghu_lake"
    sub_zone_key: "nanminghu_lake"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 50
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 25
        drop_rate: 0.16
      - key: "cold_jade_02"
        weight: 20
        drop_rate: 0.05
      - key: "vajra_01"
        weight: 20
        drop_rate: 0.14
      - key: "vajra_02"
        weight: 20
        drop_rate: 0.05
      - key: "enhance_stone_01"
        weight: 25
        drop_rate: 0.22
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.08
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

  - key: "drop_nanminghu_cave"
    sub_zone_key: "nanminghu_cave"
    drop_rolls:
      - name: "普通掉落"
        roll_count: 1
        trigger: "always"
    equipment_pool:
      - key: "blade_t3_positive_001"
        weight: 50
        drop_rate: 0.05
    stone_pool:
      - key: "cold_jade_01"
        weight: 25
        drop_rate: 0.16
      - key: "cold_jade_02"
        weight: 20
        drop_rate: 0.05
      - key: "vajra_01"
        weight: 20
        drop_rate: 0.14
      - key: "vajra_02"
        weight: 20
        drop_rate: 0.05
      - key: "enhance_stone_01"
        weight: 25
        drop_rate: 0.22
      - key: "hot_blood_01"
        weight: 20
        drop_rate: 0.08
    drop_multiplier:
      equipment_rate: 1.0
      stone_rate: 1.0
    level_diff_modifier:
      enabled: true

9.4 掉落判定流程


# ========== [可配置] 掉落判定流程 ==========

drop_evaluation:
  # 掉落优先级与叠加规则
  priority_rules:
    - rule: "地图掉落池和怪物掉落各自独立判定"
      description: "sub_zone_drop掉落池（金币/装备/石头）和monster.drop_items（任务物品）各自独立判定，互不影响"
    - rule: "任务物品掉落需满足任务条件"
      description: "任务物品（type: quest_item）只有在玩家身上有对应未提交任务时才能掉落，否则视为不爆"

  # 完整掉落判定流程
  evaluation_flow: |
    # ===== 1. 地图掉落池判定（所有怪物均触发）=====
    for each drop_roll in sub_zone_drop.drop_rolls:
        if roll trigger matches monster type:
            for i in range(roll_count):
                # 1a. 判定金币掉落（固定10%概率）
                if random() < 0.10:
                    base_gold = random(sub_zone.gold_range[0], sub_zone.gold_range[1])
                    final_gold = base_gold * (1 + player.gold_drop_bonus / 100)
                    drop_gold(final_gold)

                # 1b. 判定装备掉落
                selected = weighted_random(sub_zone_drop.equipment_pool)
                actual_rate = selected.drop_rate * sub_zone_drop.equipment_rate
                if level_diff_modifier.enabled:
                    actual_rate *= level_diff_modifier(player_level, monster_level)
                if random() < actual_rate:
                    drop_equipment(selected)

                # 1c. 判定石头掉落
                selected_stone = weighted_random(sub_zone_drop.stone_pool)
                actual_stone_rate = selected_stone.drop_rate * sub_zone_drop.stone_rate
                if level_diff_modifier.enabled:
                    actual_stone_rate *= level_diff_modifier(player_level, monster_level)
                if random() < actual_stone_rate:
                    drop_stone(selected_stone)

    # ===== 2. 怪物自身任务物品掉落判定（所有怪物均触发）=====
    if monster.drop_items:
        for drop_item in monster.drop_items:
            # 2a. 判定任务物品掉落条件
            if not quest_item_drop_condition(drop_item.item_key):
                continue    # 不满足任务条件，不爆
            # 2b. 判定掉落概率
            if random() < drop_item.droprate:
                drop_item_to_player(drop_item)

# ========== [可配置] 任务物品掉落规则 ==========
quest_item_drop_condition:
  # 任务物品掉落判定逻辑
  # 当怪物掉落任务物品时，需同时满足以下条件才能实际爆出
  condition: |
    # 条件1: 玩家是否接取了对应任务且未提交
    #   - 遍历玩家当前已接取且未提交的任务列表
    #   - 检查是否有任务的 objectives 中包含该 item_key
    #   - 若是转职任务（career_transfer），还需检查任务类型匹配
    has_active_quest = false
    required_count = 0
    for quest in player.quests.accepted:
        if quest.is_career_transfer:
            # 转职任务：正/邪派任务只能各完成一次
            # 正派任务只能正派角色完成，邪派任务只能邪派角色完成
            if quest.faction != null and quest.faction != player.faction:
                continue
        for obj in quest.objectives:
            # 单轮任务（transfer_1/2）：直接是 collect_item
            if obj.type == "collect_item" and obj.item_key == item_key:
                has_active_quest = true
                required_count = obj.count
                break
            # 多轮任务（transfer_3）：stage.items[] 嵌套结构
            if obj.items:
                for item in obj.items:
                    if item.item_key == item_key:
                        has_active_quest = true
                        required_count = item.count
                        break
        if has_active_quest:
            break

    if not has_active_quest:
        return false    # 未接取对应任务，物品不爆

    # 条件2: 任务物品数量是否已达上限
    # 已有的任务物品数量（包含背包和仓库）是否已达到任务需求数量
    current_count = player.inventory.count(item_key)
    if current_count >= required_count:
        return false    # 已收集足够数量，不继续爆

    return true         # 满足全部条件，物品爆出
10.药剂及药剂使用系统
10.1 药剂定义及分类
# =====================================
# 药剂定义模板
# =====================================
consumable_template:
  grade: 1                       # 药剂等级
  name: "药剂名称"
  description: "药剂描述"
  recovery: 70                   # 基础恢复量
  price: 10                     # 购买价格（金币）
  sell_price: 5                 # 出售价格（金币）
  grade_threshold: 1              # 解锁等级
  max_stack: 999                  # 堆叠上限

# ========== [可配置] 药品系统 ==========

consumables:
  # =====================================
  # 生命药剂
  # =====================================
  health_potions:
    - grade: 1
      name: "金创药（小）"
      description: "恢复70点生命值"
      recovery: 70
      price: 10                # 购买价格（金币）
      sell_price: 1           # 出售价格（金币，购入价的10%）
      grade_threshold: 1       # 1级后解锁
      max_stack: 999           # 背包最大叠加数量

    - grade: 2
      name: "金创药（中）"
      description: "恢复160点生命值"
      recovery: 160
      price: 50               # 购买价格（金币）
      sell_price: 5           # 出售价格（金币，购入价的10%）
      grade_threshold: 36      # 36级后解锁
      max_stack: 999

    - grade: 3
      name: "金创药（大）"
      description: "恢复300点生命值"
      recovery: 300
      price: 120              # 购买价格（金币）
      sell_price: 12          # 出售价格（金币，购入价的10%）
      grade_threshold: 61      # 61级后解锁
      max_stack: 999

  # =====================================
  # 内功药剂（MP药剂）
  # =====================================
  mana_potions:
    - grade: 1
      name: "人参"
      description: "恢复70点内功值"
      recovery: 70
      price: 10               # 购买价格（金币）
      sell_price: 1           # 出售价格（金币，购入价的10%）
      grade_threshold: 1
      max_stack: 999

    - grade: 2
      name: "野山参"
      description: "恢复160点内功值"
      recovery: 160
      price: 50               # 购买价格（金币）
      sell_price: 5           # 出售价格（金币，购入价的10%）
      grade_threshold: 36
      max_stack: 999

    - grade: 3
      name: "雪原参"
      description: "恢复320点内功值"
      recovery: 320
      price: 120              # 购买价格（金币）
      sell_price: 12          # 出售价格（金币，购入价的10%）
      grade_threshold: 61
      max_stack: 999

10.1.1 药剂实际恢复量计算公式
  # =====================================
  # 药剂恢复量计算
  # =====================================
  # 生命药剂实际恢复量 = 基础恢复量 × (1 + 治疗效果加成)
  # 治疗效果加成由医师气功"体血倍增"提供，每级+1%
  # hp_actual_recovery = base_recovery * (1 + heal_bonus)

  # 内功药剂实际恢复量 = 基础恢复量 × (1 + 内功恢复加成)
  # 内功恢复加成由医师气功"运气行心"提供，每级+1%
  # mp_actual_recovery = base_recovery * (1 + mp_recovery_bonus)

  # 示例：
  # - 无气功加成时，金创药（小）恢复70点生命值
  # - 有10级体血倍增（heal_bonus=0.10）时，金创药（小）恢复70*(1+0.10)=77点生命值
  # - 无气功加成时，人参恢复70点内功值
  # - 有10级运气行心（mp_recovery_bonus=0.10）时，人参恢复70*(1+0.10)=77点内功值

10.2 药剂使用限制
  # =====================================
  # 等级使用限制
  # =====================================
  # 药剂使用规则：等级达到门槛即可使用对应等级药剂
  usage_rules:
    grade_1: "level >= 1"      # 金创药（小）/ 人参：1级可用
    grade_2: "level > 35"       # 金创药（中）/ 野山参：36级以上可用
    grade_3: "level > 60"       # 金创药（大）/ 雪原参：61级以上可用
10.3 自动喝药规则
  # =====================================
  # 自动喝药配置
  # =====================================
  auto_consume:
    enabled: true              # 是否启用自动喝药

    # HP药剂触发设置
    hp_trigger:
      enabled: true
      threshold: 0.3          # HP低于此百分比时触发（玩家可自定义设置）
      cooldown: 5000          # 喝药冷却时间（毫秒，GM可调整）
      # 实际恢复量计算公式：参见6.2伤害计算公式中的 hp_potion_recovery
      # hp_actual_recovery = base_recovery * (1 + heal_bonus)
      # heal_bonus 来自医师气功"体血倍增"，每级+1%

    # MP药剂触发设置
    mp_trigger:
      enabled: true
      threshold: 0.3          # MP低于此百分比时触发（玩家可自定义设置）
      cooldown: 5000          # 喝药冷却时间（毫秒，GM可调整）
      # 实际恢复量计算公式：参见6.2伤害计算公式中的 mp_potion_recovery
      # mp_actual_recovery = base_recovery * (1 + mp_recovery_bonus)
      # mp_recovery_bonus 来自医师气功"运气行心"，每级+1%
10.4 回城补给规则
  # =====================================
  # 回城补给配置
  # =====================================
  auto_resupply:
    enabled: true              # 是否启用自动补给

    # 最低库存阈值（每种药剂低于此数量时触发回城）
    min_stock:
      health_potion_grade1: 5
      health_potion_grade2: 5
      health_potion_grade3: 5
      mana_potion_grade1: 5
      mana_potion_grade2: 5
      mana_potion_grade3: 5

    # 回城行为
    return_action:
      auto_return_to_town: true   # 自动回城镇
      auto_full_recovery: true    # 回城后自动回满HP和MP
      auto_resume_farming: true   # 补给完成后自动返回原地图继续挂机

    # 金币不足时的处理
    gold_insufficient:
      behavior: "stop_and_wait"   # 停止挂机，等待玩家干预
      notify: true                # 发送通知提醒玩家
10.5 药剂商店配置
  # =====================================
  # 药剂商店配置
  # =====================================
  shop:
    # 城镇商店是否销售所有等级药剂
    sell_all_grades: false
    # 只有满足等级条件后才在商店显示该等级药剂

    # 购买时的最大持有量限制
    purchase_limit:
      single_transaction_max: 999   # 单次购买最多999个
      daily_purchase_limit: -1    # 每日购买上限（-1表示无限制）

11.背包与仓库系统
# =====================================
# 背包与仓库系统
# =====================================

背包与仓库用于存放物品，两者的容量和堆叠规则相同。

背包和仓库容量：各50个格子

# ========== [可配置] 背包容量 ==========
inventory_capacity: 50

# ========== [可配置] 仓库容量 ==========
warehouse_capacity: 50

# ========== [可配置] 物品堆叠规则 ==========
stack_rules:
  # 石头类：同key可堆叠，最多99
  stones:
    stackable: true
    max_stack: 99
    condition: "同key可堆叠"

  # 装备类：不支持堆叠
  equipment:
    stackable: false
    max_stack: 1

  # 药剂类：支持堆叠，最多999
  consumables:
    stackable: true
    max_stack: 999
    condition: "同key（同类型同等级）可堆叠"

  # 盒子类：支持堆叠，最多999
  boxes:
    stackable: true
    max_stack: 999
    condition: "同key（同类型盒子）可堆叠，香木盒子不能与白银盒子混堆"

  # 任务物品类：支持堆叠，最多99
  quest_items:
    stackable: true
    max_stack: 99
    condition: "同key可堆叠"

# ========== [可配置] 背包满时行为 ==========
# 物品获取时的处理规则：
# 1. 若背包已有该物品且未达堆叠上限 → 继续堆叠
# 2. 若背包无该物品或已达堆叠上限 → 无法保存，提示玩家
inventory_full_behavior:
  can_stack_if_has_slot: true    # 有空位且未达上限时可堆叠
  reject_if_no_space: true       # 无法堆叠时拒绝存入
  notification: "背包已满，请先清理或使用仓库"  # 提示信息

# ========== [可配置] 物品操作弹窗 ==========
# 玩家点击物品时的弹窗
item_action_popup:
  title: "物品操作"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - buttons:
        - sell: "出售"
        - discard: "丢弃"
  sell_action:
    description: "点击出售后，按确认数量卖出物品，获得金币"
    # 可出售物品：石头、装备、药剂
    # 不可出售物品：盒子、任务物品
    allowed_types: ["stones", "equipment", "consumables"]
    forbidden_types: ["boxes", "quest_items"]
  discard_action:
    description: "点击丢弃后，按确认数量丢弃物品，物品消失，不可恢复"

# ========== [可配置] 仓库操作规则 ==========
# 点击仓库NPC后，同时打开角色仓库和角色背包
warehouse_npc_action:
  open_ui: ["inventory", "warehouse"]  # 同时打开背包和仓库界面

# 背包物品存入仓库
deposit_popup:
  title: "存入仓库"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - button: "存入"
  condition:
    - target: "inventory"  # 从背包存入
    - result: "warehouse"  # 到仓库

# 仓库物品取出至背包
withdraw_popup:
  title: "取出物品"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - button: "取出"
  condition:
    - target: "warehouse"  # 从仓库取出
    - result: "inventory"  # 到背包

# 仓库操作限制
warehouse_operation_limit:
  full_inventory_warning: "背包已满，无法取出"
  full_warehouse_warning: "仓库已满，无法存入"
  # 仓库物品操作限制：只能取出，出售和丢弃只能在背包中进行
  warehouse_item_actions:
    can_withdraw: true
    can_sell: false
    can_discard: false

# ========== [可配置] 物品整理功能 ==========
# 背包、仓库界面各有"整理"按钮，点击后按key值字母顺序排序
sort_button:
  inventory_button: "整理"
  warehouse_button: "整理"
  sort_rule: "按key值字母顺序排序"

# ========== [可配置] 金币显示 ==========
# 金币不占用背包格子，仅在背包界面展示数值
gold_display:
  not_in_slot: true
  display_only: true

12. 盒子系统

12.1 盒子定义

# =====================================
# 盒子定义
# =====================================
# 盒子是打怪随机掉落的物品，用于开出装备和药剂
# 盒子不可出售、不可交易、只能开启
# 怪物掉落盒子概率：0.001%（每只怪物每次击杀）
# 背包最大堆叠：999个/格子

boxes:
  - key: "box_wood"
    name: "香木盒子"
    description: "低级地图掉落的盒子"
    drop_maps: ["wilderness_xuanbo_suburb"]    # 低级野外地图
    max_stack: 999
    openable_items:
      # 饰品（base阶段）- 权重0.4/个，饰品总概率≈0.89%
      - item_key: "earring_base_001"
        name: "银耳环"
        droprate: 0.4
      - item_key: "earring_base_002"
        name: "白玉耳环"
        droprate: 0.4
      - item_key: "earring_base_003"
        name: "金耳环"
        droprate: 0.4
      - item_key: "ring_base_001"
        name: "银戒指"
        droprate: 0.4
      - item_key: "ring_base_002"
        name: "白金戒指"
        droprate: 0.4
      - item_key: "ring_base_003"
        name: "紫玉戒指"
        droprate: 0.4
      - item_key: "necklace_base_001"
        name: "灵兽项链"
        droprate: 0.4
      - item_key: "necklace_base_002"
        name: "幻身项链"
        droprate: 0.4
      - item_key: "necklace_base_003"
        name: "玉影项链"
        droprate: 0.4
      # 药剂（grade1）- 权重200/个
      - item_key: "hp_potion_grade1"
        name: "金创药（小）"
        droprate: 200
      - item_key: "mp_potion_grade1"
        name: "人参"
        droprate: 200

  - key: "box_silver"
    name: "白银盒子"
    description: "中级地图掉落的盒子"
    drop_maps: ["wilderness_liuzheng", "wilderness_sanxie"]    # 中级野外地图
    max_stack: 999
    openable_items:
      # 饰品（t2阶段）- 权重0.367/个，饰品总概率≈1.00%
      - item_key: "earring_t2_001"
        name: "天灵耳环"
        droprate: 0.367
      - item_key: "earring_t2_002"
        name: "紫焰耳环"
        droprate: 0.367
      - item_key: "earring_t2_003"
        name: "玄天耳环"
        droprate: 0.367
      - item_key: "ring_t2_001"
        name: "地灵戒"
        droprate: 0.367
      - item_key: "ring_t2_002"
        name: "万寿戒"
        droprate: 0.367
      - item_key: "ring_t2_003"
        name: "麒麟指环"
        droprate: 0.367
      - item_key: "ring_t2_004"
        name: "权智指环"
        droprate: 0.367
      - item_key: "necklace_t2_001"
        name: "五毒链"
        droprate: 0.367
      - item_key: "necklace_t2_002"
        name: "灵心链"
        droprate: 0.367
      - item_key: "necklace_t2_003"
        name: "碧玉护符"
        droprate: 0.367
      - item_key: "necklace_t2_004"
        name: "金罡护符"
        droprate: 0.367
      # 药剂（grade2）- 权重200/个
      - item_key: "hp_potion_grade2"
        name: "金创药（中）"
        droprate: 200
      - item_key: "mp_potion_grade2"
        name: "野山参"
        droprate: 200

  - key: "box_gold"
    name: "黄金盒子"
    description: "高级地图掉落的盒子"
    drop_maps: ["wilderness_shenwu", "wilderness_liushan", "wilderness_nanminghu"]    # 高级野外地图
    max_stack: 999
    openable_items:
      # 饰品（t3阶段）- 权重0.4/个，饰品总概率≈0.79%
      - item_key: "earring_t3_001"
        name: "圣炎耳环"
        droprate: 0.4
      - item_key: "earring_t3_002"
        name: "磐龙耳环"
        droprate: 0.4
      - item_key: "ring_t3_001"
        name: "圣冠指环"
        droprate: 0.4
      - item_key: "ring_t3_002"
        name: "馨华指环"
        droprate: 0.4
      - item_key: "ring_t3_003"
        name: "元始指环"
        droprate: 0.4
      - item_key: "necklace_t3_001"
        name: "金灵护符"
        droprate: 0.4
      - item_key: "necklace_t3_002"
        name: "圣光项链"
        droprate: 0.4
      - item_key: "necklace_t3_003"
        name: "天神护符"
        droprate: 0.4
      # 药剂（grade3）- 权重200/个
      - item_key: "hp_potion_grade3"
        name: "金创药（大）"
        droprate: 200
      - item_key: "mp_potion_grade3"
        name: "雪原参"
        droprate: 200

12.2 开盒UI流程
# =====================================
# 开盒操作流程（点击即开）
# =====================================
# 1. 玩家在背包中点击盒子道具
# 2. 弹出开盒窗口，显示：
#    - 盒子的名称和图标
#    - 开盒数量（默认等于背包中该盒子数量，支持玩家手动修改）
#    - 开盒按钮
# 3. 玩家确认数量后，点击开盒按钮
# 4. 系统根据物品池随机抽取并发放奖励（点击即开，无动画）
# 5. 奖励直接进入角色背包（如背包满则提示）

box_open_ui:
  title: "开启盒子"
  quantity_selector: true           # 支持选择数量
  default_quantity: "all"          # 默认全选
  confirm_button: "开盒"
  reward_preview: false             # 不显示奖励预览（随机性）

12.3 盒子掉落配置
# =====================================
# 怪物掉落盒子概率
# =====================================
# 所有怪物掉落盒子概率：0.001%
# 盒子类型由怪物所在地图决定

monster_drop_box:
  drop_rate: 0.001                  # 每只怪物每次击杀掉落概率（0.001%）
  box_type_by_map:                  # 地图key决定盒子类型
    wilderness_xuanbo_suburb: "box_wood"
    wilderness_liuzheng: "box_silver"
    wilderness_sanxie: "box_silver"
    wilderness_shenwu: "box_gold"
    wilderness_liushan: "box_gold"
    wilderness_nanminghu: "box_gold"

13. 存档系统

13.1 存档数据结构

# ========== 存档数据结构 ==========

save_data_structure:
  # 玩家基础数据
  player:
    id: "string"              # 唯一ID
    name: "string"            # 玩家名称
    level: "number"           # 等级
    exp: "number"             # 当前经验
    career: "string"          # 当前职业
    career_history: []        # 职业历史

  # 属性数据
  attributes:
    base:                     # 基础属性
      str: 10
      dex: 10
      int: 10
      sta: 10
    bonus:                    # 额外加成
      str: 0
      dex: 0

  # 装备数据
  equipment:
    weapon: "equipment_key"
    chest: "equipment_key"
    # ... 其他槽位

  # 物品栏
  inventory:
    - key: "item_key"
      count: 10
    - key: "equipment_key"
      data: {}                # 装备随机属性

  # 技能数据
  skills:
    - key: "skill_key"
      level: 5
      enabled: true
    - key: "passive_key"
      level: 3

  # 剧情进度
  progress:
    completed_stories: []
    completed_stages: []
    highest_stage: "stage_key"

  # 资源数据
  resources:
    gold: 1000
    gems: 0
    # ... 其他资源

  # 统计数据
  statistics:
    total_kills: 0
    total_playtime: 0
    highest_damage: 0
    bosses_killed: 0

13.2 存档加密

# ========== 存档加密配置 ==========

save_encryption:
  enabled: true
  algorithm: "AES-256"
  key_derivation: "PBKDF2"
  compression: "gzip"

  # 防篡改校验
  checksum:
    enabled: true
    algorithm: "SHA-256"


---

14. 技术架构

14.1 项目结构

project/
├── src/
│   ├── core/                 # 核心系统
│   │   ├── Game.ts          # 游戏主类
│   │   ├── Timer.ts         # 时间系统
│   │   └── EventEmitter.ts  # 事件系统
│   │
│   ├── data/                 # 数据配置
│   │   ├── careers.yaml     # 职业数据
│   │   ├── skills.yaml      # 技能数据
│   │   ├── equipment.yaml   # 装备数据
│   │   ├── enemies.yaml     # 敌人数据
│   │   └── stages.yaml      # 关卡数据
│   │
│   ├── entities/            # 游戏实体
│   │   ├── Player.ts        # 玩家实体
│   │   ├── Enemy.ts         # 敌人实体
│   │   ├── Equipment.ts     # 装备实体
│   │   └── Buff.ts          # Buff实体
│   │
│   ├── systems/             # 游戏系统
│   │   ├── BattleSystem.ts  # 战斗系统
│   │   ├── DamageSystem.ts  # 伤害计算
│   │   ├── DropSystem.ts    # 掉落系统
│   │   ├── SaveSystem.ts    # 存档系统
│   │   └── AttributeSystem.ts # 属性系统
│   │
│   ├── ui/                  # 界面组件
│   │   ├── BattleUI.ts      # 战斗界面
│   │   ├── InventoryUI.ts   # 背包界面
│   │   └── CharacterUI.ts   # 角色界面
│   │
│   └── utils/               # 工具函数
│       ├── formulas.ts      # 公式计算
│       └── random.ts        # 随机数生成
│
├── tests/                   # 测试文件
├── dist/                    # 编译输出
└── package.json

14.2 核心类设计

# ========== 核心类设计 ==========

classes:
  # 游戏主类
  Game:
    properties:
      - player: Player
      - currentStage: Stage
      - timer: Timer
      - state: GameState
    methods:
      - init(): void
      - start(): void
      - pause(): void
      - resume(): void
      - save(): SaveData
      - load(data: SaveData): void

  # 玩家实体
  Player:
    properties:
      - id: string
      - name: string
      - level: number
      - exp: number
      - career: Career
      - attributes: Attributes
      - equipment: EquipmentSlots
      - skills: Skill[]
      - buffs: Buff[]
    methods:
      - getAttribute(key: string): number
      - equip(item: Equipment): void
      - unequip(slot: string): Equipment
      - learnSkill(skill: Skill): void
      - useSkill(skill: Skill, target: Unit): void
      - addBuff(buff: Buff): void
      - removeBuff(buff: Buff): void

  # 战斗单位
  Unit:
    properties:
      - hp: number
      - maxHp: number
      - mp: number
      - maxMp: number
      - atk: number
      - def: number
      - skills: Skill[]
      - buffs: Buff[]
      - target: Unit
    methods:
      - takeDamage(damage: Damage): void
      - heal(amount: number): void
      - isDead(): boolean
      - update(deltaTime: number): void

  # 战斗系统
  BattleSystem:
    properties:
      - units: Unit[]
      - timeline: Timeline
      - state: BattleState
    methods:
      - start(): void
      - update(deltaTime: number): void
      - end(): BattleResult
      - processSkill(source: Unit, skill: Skill, target: Unit): void
      - calculateDamage(source: Unit, skill: Skill, target: Unit): Damage

  # 伤害系统
  DamageSystem:
    methods:
      - calculate(source: Unit, skill: Skill, target: Unit): DamageResult
      - applyResistance(damage: number, resistance: number): number
      - applyDefense(damage: number, defense: number): number
      - rollCritical(critRate: number, critBonus: number): CriticalResult
      - rollEvasion(evasionRate: number): boolean

14.3 数据加载流程

# ========== 数据加载流程 ==========

data_loading:
  steps:
    - step: 1
      name: "加载配置文件"
      files:
        - "careers.yaml"
        - "skills.yaml"
        - "equipment.yaml"
        - "enemies.yaml"
        - "stages.yaml"

    - step: 2
      name: "解析YAML"
      action: "parse_yaml_to_json"

    - step: 3
      name: "数据验证"
      action: "validate_against_schema"

    - step: 4
      name: "建立索引"
      action: "create_lookup_tables"

    - step: 5
      name: "初始化系统"
      action: "initialize_game_systems"

14.4 游戏循环

# ========== 游戏循环 ==========

game_loop:
  update_interval: 100        # 100ms更新一次

  update_steps:
    - name: "时间更新"
      action: "timer.update(deltaTime)"

    - name: "战斗更新"
      action: "battleSystem.update(deltaTime)"
      condition: "inBattle"

    - name: "Buff更新"
      action: "updateBuffs(deltaTime)"
      condition: "inBattle"

    - name: "资源恢复"
      action: "recoverResources(deltaTime)"
      condition: "not inBattle"

    - name: "自动保存"
      action: "autoSave()"
      interval: 60000          # 每分钟自动保存


15. UI与界面布局

# ========== [可配置] 界面结构总览 ==========

ui_layout:
  # ===== 主界面结构 =====
  main_view:
    description: "游戏入口界面，包含城镇和野外两大区域"
    regions:
      - name: "顶部状态栏"
        components:
          - "角色名称 + 等级"
          - "职业"
          - "金币"
          - "快捷入口按钮"
      - name: "中部主区域"
        components:
          - "地图选择入口"
          - "NPC交互入口"
          - "城镇功能入口"
      - name: "底部快捷栏"
        components:
          - "背包入口"
          - "技能入口"
          - "角色状态入口"
          - "设置入口"

  # ===== 战斗界面结构 =====
  battle_view:
    description: "野外挂机/战斗时的界面"
    regions:
      - name: "顶部"
        components:
          - "当前地图名称"
          - "挂机计时器"
      - name: "中部"
        components:
          - "怪物列表（最多显示8只）"
          - "锁定目标高亮显示"
          - "伤害飘字"
      - name: "底部"
        components:
          - "角色HP条 + 数值"
          - "角色MP条 + 数值"
          - "挂机技能状态图标"
          - "自动喝药状态指示"

  # ===== 角色状态面板 =====
  character_panel:
    regions:
      - name: "基本信息"
        components:
          - "角色名称 + 等级"
          - "职业"
          - "当前经验/升级经验进度条"
      - name: "四维属性"
        display:
          - "str（力）"
          - "int（心）"
          - "sta（体）"
          - "dex（身）"
      - name: "战斗属性"
        display:
          - "生命值（maxHp）"
          - "内功（maxMp）"
          - "最小攻击力（atkMin）"
          - "最大攻击力（atkMax）"
          - "防御力（def）"
          - "武功攻击力（matk）"
          - "武功防御力（mdef）"
          - "命中率（hit）"
          - "闪避率（missing）"
      - name: "资源属性"
        display:
          - "经验值（exp）"
          - "历练（training）"
          - "武勋（merit）"
      - name: "快捷操作"
        buttons:
          - "装备查看/更换"
          - "技能配置"
          - "挂机设置"

  # ===== 背包界面 =====
  inventory_view:
    description: "统一界面展示所有物品，不分类tab"
    regions:
      - name: "顶部"
        components:
          - "背包容量（当前格数/最大格数）"
          - "整理按钮"
      - name: "物品列表区"
        display:
          - "装备（显示名称、等级、品质边框）"
          - "药剂（显示名称、恢复量）"
          - "材料（显示名称）"
          - "盒子（显示名称）"
        item_buttons:
          - "装备：穿戴/卸下"
          - "药剂：使用"
          - "盒子：开启"
          - "通用：丢弃/出售"
      - name: "物品详情区"
        display:
          - "物品名称"
          - "物品描述"
          - "属性数值"
          - "价格信息"

  # ===== 技能界面 =====
  skill_view:
    regions:
      - name: "武功标签页"
        display:
          - "武功列表（名称、等级、消耗、效果）"
          - "锁定图标（挂机时是否启用）"
      - name: "气功标签页"
        display:
          - "气功列表（名称、等级、效果）"
      - name: "被动标签页"
        display:
          - "被动技能列表（名称、效果）"
      - name: "挂机设置区"
        description: "挂机时使用的技能配置"
        slots:
          - slot: "damage_or_heal"
            label: "输出/治疗技能"
            limit: "1个（二选一）"
            default: "普通攻击"
          - slot: "buff_skill_1"
            label: "辅助技能1"
            limit: "60秒冷却"
          - slot: "buff_skill_2"
            label: "辅助技能2"
            limit: "60秒冷却"

  # ===== 商店界面 =====
  shop_view:
    regions:
      - name: "顶部"
        components:
          - "NPC名称"
          - "商店类型（武器/防具/药剂）"
      - name: "商品列表"
        display:
          - "物品图标 + 名称"
          - "价格"
          - "购买按钮"
      - name: "底部"
        components:
          - "玩家金币显示"
          - "购买操作按钮"

  # ===== 地图选择界面 =====
  map_selection_view:
    regions:
      - name: "城镇地图"
        display:
          - "地图名称"
          - "功能说明"
          - "进入按钮"
      - name: "野外地图"
        display:
          - "地图名称"
          - "怪物等级范围"
          - "准入等级"
          - "进入按钮"
      - name: "已解锁地图列表"
        description: "根据玩家等级和任务进度解锁"

  # ===== 挂机设置界面 =====
  hang_settings_view:
    regions:
      - name: "挂机技能选择"
        description: "选择挂机时使用的技能组合"
        slots:
          - "damage技能（二选一或普攻）"
          - "buff技能1（60秒CD）"
          - "buff技能2（60秒CD）"
      - name: "自动喝药规则"
        description: "见10.3节自动喝药规则配置"
        components:
          - "HP阈值设置"
          - "MP阈值设置"
          - "药剂优先级"

  # ===== 战斗信息日志 =====
  battle_log_view:
    display:
      - "伤害数值飘字"
      - "击杀信息（XXX击杀了YYY）"
      - "经验获取提示"
      - "金币掉落提示"
      - "物品掉落提示"
    position: "战斗界面右侧或底部滚动区域"

  # ===== 存档/读档界面 =====
  save_load_view:
    regions:
      - name: "存档列表"
        display:
          - "存档序号"
          - "存档时间"
          - "角色等级 + 职业"
          - "游戏进度说明"
      - name: "操作按钮"
        display:
          - "新建存档"
          - "覆盖存档"
          - "删除存档"
          - "读取存档"

# ========== [可配置] 交互流程 ==========

ui_flows:
  # ===== 主流程 =====
  main_flow:
    - step: 1
      action: "进入游戏 → 显示主界面"
    - step: 2
      action: "选择进入城镇/野外"
    - step: 3
      action: "野外 → 自动战斗开始 → 循环直到死亡或停止"
    - step: 4
      action: "死亡 → 扣除经验 → 回城 → 停止挂机"

  # ===== 城镇交互 =====
  town_interaction:
    - step: 1
      action: "点击NPC → 弹出对应面板（商店/任务/仓库）"
    - step: 2
      action: "完成交易/接取任务"
    - step: 3
      action: "关闭面板"

  # ===== 背包操作 =====
  inventory_operation:
    - step: 1
      action: "打开背包"
    - step: 2
      action: "点击物品 → 显示详情"
    - step: 3
      action: "选择操作（穿戴/使用/出售/丢弃）"
    - step: 4
      action: "执行并刷新界面"

  # ===== 挂机设置流程 =====
  hang_setup_flow:
    - step: 1
      action: "打开设置界面"
    - step: 2
      action: "选择挂机技能（damage/heal/buff）"
    - step: 3
      action: "配置自动喝药规则"
    - step: 4
      action: "保存设置 → 进入野外自动挂机"

# ========== [可配置] UI交互反馈 ==========

ui_feedback:
  # 按钮反馈
  button_feedback:
    click: "按钮按下效果 + 声音提示"
    hover: "高亮边框"

  # 物品操作反馈
  item_feedback:
    equip: "装备图标飞向角色位置 + 音效"
    use: "物品消失 + 效果音"
    sell: "金币飘字 + 音效"

  # 战斗反馈
  battle_feedback:
    damage_number: "飘字显示（白色普攻/黄色暴击/红色格挡）"
    monster_death: "怪物消失动画 + 金币经验飘字"
    player_death: "屏幕变红 + 回城动画"

  # UI动画
  ui_animation:
    panel_open: "从底部滑入"
    panel_close: "向底部滑出"
    notification: "从顶部滑入，3秒后自动消失"


---

附录

A. 公式汇总

# ========== 核心公式汇总 ==========

formulas:
  # 经验公式
  exp_to_level: "a * level^4 + b * level^3 + c * level^2 + d * level + e"

  # 伤害公式
  damage: "value * atk * (100 / (100 + target.def)) * random(0.9, 1.1)"

  # 暴击伤害
  crit_damage: "base_damage * crit_bonus"

  # 伤害加成
  damage_add: "1 + dmgLevel / (1500 + 1.5 * dmgLevel) + dmgLevel / 150000"

  # 抗性减免
  damage_reduction: "100 / (100 + resistance)"

  # 属性成长
  attribute_growth: "base_value + level * career_growth_rate + equipment_bonus"

B. 数值平衡参考

# ========== 数值平衡参考 ==========

balance_reference:
  # 等级属性范围
  level_1:
    hp: 100-200
    atk: 10-20
    def: 5-10

  level_50:
    hp: 2000-5000
    atk: 100-200
    def: 50-150

  level_100:
    hp: 10000-20000
    atk: 300-600
    def: 200-500

  # Boss属性倍率
  boss_multiplier:
    hp: 10-50
    atk: 2-5
    def: 2-3

  # 稀有度属性倍率
  quality_multiplier:
    common: 1.0
    uncommon: 1.2
    rare: 1.5
    epic: 2.0
    legendary: 3.0
    mythic: 5.0


---

文档版本

版本: 1.0
创建日期: 2024-05-11
基于源码: index.js (挂机类RPG游戏)


---

使用说明：修改 [可配置] 标记的区块即可定制新游戏。所有数值、公式、职业、技能、装备、敌人、关卡均可通过修改对应配置来实现个性化设计。AI可直接读取本文档进行编码实现。
