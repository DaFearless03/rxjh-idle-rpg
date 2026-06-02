3. 职业系统
3.1 职业模板定义

========== [可配置] 职业定义模板 ==========
复制此模板创建新职业

career_template:
  key: "职业唯一标识"              # 如: "warrior"
  name: "职业名称"                 # 如: "战士"
  description: "职业描述文本"

解锁条件
  requirement:
    role: "角色标识"              # 可选，限定特定角色
    level: 1                      # 需要等级
    career: "前置职业"            # 可选，转职需要

默认装备类型
  equipments:
    weapon: "武器类型"

初始属性
规则：
1) base_stats 只配置四维 + 职业化基础值（baseHp/baseMp），不得配置任何派生属性
（maxHp/maxMp/atkMin/atkMax/def/hit/missing 等一律按 2.1 章公式实时计算）。
2) 转职职业不需要再写 base_stats，继承 base 职业的四维与 baseHp/baseMp 作为起点。
3) 转职后只切换 attrGrow（每级成长倍率），按新 attrGrow 继续按等级累加。
四维与派生属性的最终面板永远由公式得出，转职瞬间不重算、不冻结、不打快照。
  base_stats:
    str: 10      # 力量
    dex: 10      # 身法
    int: 10      # 心智
    sta: 10      # 体质
    baseHp: 100  # 职业化的生命基础值（用于 maxHp 公式中的 baseHp 项）
    baseMp: 100  # 职业化的内功基础值（用于 maxMp 公式中的 baseMp 项）

属性成长修正（每级成长倍率，作用于四维）
  attrGrow:
    str: 0.5     # 力量成长
    dex: 0       # 身法成长
    int: 0       # 心智成长
    sta: 0.5     # 体质成长
    hpGrowth: 0  # 每级生命成长（用于 maxHp 公式）
    mpGrowth: 0  # 每级内功成长（用于 maxMp 公式）

可用武功（通过career_family限定，见第4章武功与气功系统）
武功按职业划分：刀客系、剑客系、枪客系、医师系
转职职业自动继承base职业的武功学习权限
  martial_arts: []  # 无需重复配置，武功已按职业career_family划分

被动技能
  passives:
    passive_id: unlock_level

增强技能
  enhances:
    enhance_id: max_level

是否隐藏职业
  hidden: false

3.2 职业数据配置

========== [可配置] 职业列表 ==========
==========================================
装备穿戴判定（v1.0 完整规则）
==========================================
一件装备能否被某玩家穿戴，需同时满足 4 个条件（AND 关系）：
#
def can_equip(player, equipment):
# 1) 等级门槛：玩家等级 ≥ 装备 required_level
if player.level < equipment.required_level:
return False
# 2) 转职次数门槛：玩家已转职次数 ≥ 装备 required_transfer
if player.transfer_count < equipment.required_transfer:
return False
# 3) 职业系匹配：玩家的 career_family 必须在 equipment.required_career 数组中
#    （注：转职后职业自动继承 base 职业的 career_family，如 warrior_blade_transfer_2st_X
#     的 career_family 仍是 "blade"）
if player.career_family not in equipment.required_career:
return False
# 4) 阵营匹配：
#    - equipment.faction == "neutral" → 任何玩家都可穿（无阵营要求）
#    - equipment.faction == "positive"/"negative" → 玩家 faction 必须严格匹配
#    - 玩家 faction == "neutral"（未接 2 转任务）→ 只能穿 neutral 装备
if equipment.faction != "neutral" and player.faction != equipment.faction:
return False
return True
#
字段语义复习：
equipment.faction:           neutral=通用 / positive=正派 / negative=邪派
equipment.required_level:    最小等级下限（玩家等级 ≥ N）
equipment.required_transfer: 需要的转职次数（0=无要求, 1=1转后, 2=2转后, 3=3转后）
equipment.required_career:   允许穿戴的 career_family 数组（如 ["blade"] 或 ["blade","sword"]）
player.transfer_count:       根据 player.career 反查（base=0 / _transfer_1st=1 /2st*=2 / 3st*=3）
player.career_family:        根据 player.career 反查（从 careers 配置中取 career_family 字段）
player.faction:              角色当前阵营（接 2 转任务时设定，详见 8.3 任务系统注释）
#
===== 反查 fallback 规则（v1.0）=====
处理"脏存档 / 版本迁移 / GM 面板误改"导致 player.career 在 careers 表中查不到的边界情况：
1. 控制台 console.warn(`Unknown career: ${player.career}, falling back to base career`)
2. 按 career_family 前缀模糊匹配回退到该职业系的 base career：
"warrior_blade_..." → "warrior_blade"
"warrior_sword_..." → "warrior_sword"
"warrior_spear_..." → "warrior_spear"
"healer_..."        → "healer"
3. 模糊匹配也失败（career 字符串完全异常）→ 终极 fallback 为 "warrior_blade"（v1.0 默认职业）
4. transfer_count / career_family 全部基于回退后的 base career 反查
5. 玩家进游戏后弹 toast："存档异常已自动修复，请检查角色"
#
UI 表现：不满足任一条件 → 装备在背包/商店灰显，点击穿戴弹"不满足穿戴条件"

careers:
===== 刀客 =====
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
    # 初始属性（只配置四维 + 职业化基础值；派生属性由 2.1 公式实时计算）
    base_stats:
      int: 8       # 心智
      str: 8       # 力量
      sta: 15      # 体质
      dex: 9       # 身法
      baseHp: 100  # 生命基础值
      baseMp: 100  # 内功基础值
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
      
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
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "blade"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 1.5
      dex: 1
      int: 1
      sta: 1.5
      hpGrowth: 60
      mpGrowth: 20
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限

===== 剑客 =====
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
    # 初始属性（只配置四维 + 职业化基础值；派生属性由 2.1 公式实时计算）
    base_stats:
      int: 9       # 心智
      str: 11      # 力量
      sta: 11      # 体质
      dex: 9       # 身法
      baseHp: 100  # 生命基础值
      baseMp: 100  # 内功基础值
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
      
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
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "sword"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 2
      int: 1.5
      sta: 1
      hpGrowth: 40
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限

===== 医师 =====
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
    # 初始属性（只配置四维 + 职业化基础值；派生属性由 2.1 公式实时计算）
    base_stats:
      int: 9       # 心智
      str: 11      # 力量
      sta: 9       # 体质
      dex: 11      # 身法
      baseHp: 100  # 生命基础值
      baseMp: 100  # 内功基础值
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
      
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
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "staff"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 2
      dex: 1
      int: 3.5
      sta: 1
      hpGrowth: 30
      mpGrowth: 30
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限

  # ===== 枪客 =====
- key: "warrior_spear"
name: "枪客"
description: "高血量高攻击"#待完善
stage: "base"
faction: "neutral"
career_family: "spear"
requirement:
  role: "warrior_spear"  #枪客角色
  level: 1
equipments:
  weapon: "spear"
    # 初始属性（只配置四维 + 职业化基础值；派生属性由 2.1 公式实时计算）
    base_stats:
      int: 9       # 心智
      str: 13      # 力量
      sta: 11      # 体质
      dex: 7       # 身法
      baseHp: 100  # 生命基础值
      baseMp: 100  # 内功基础值
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
    # 可装备类型
      
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
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限
      
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
    # 默认装备类型
    equipments:
      weapon: "spear"
    # 属性成长修正（每级成长倍率）
    attrGrow:
      str: 3
      dex: 1
      int: 1
      sta: 1
      hpGrowth: 50
      mpGrowth: 25
    # 可用武功（通过career_family限定，见第4章武功与气功系统）
    # 转职职业自动继承base职业的武功学习权限

3.3 职业平衡规则

========== [可配置] 职业平衡规则 ==========

career_balance:
定位分配
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
      example_careers: ["剑客"]

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


成长系数平衡参考  #待定
用途：仅用于内部数值平衡推导（评估"每职业每级 attrGrow.str/int/sta/dex 涨多少"是否平衡），
不对应任何游戏内可触发的装备词条或外部加成。
原因：四维不接受任何外部加成（见 2.2 attribute_hooks 顶部声明），
因此下面这些等价系数无法通过装备/石头/Buff 兑现，仅是"理论换算用的参考值"。
  growth_balance:
    # 每1点四维属性"理论上"等效于多少派生属性的内部参考
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

转职设计原则
  job_change_rules:
    - 转职需要等级门槛 (10/35/60；其他档位由 current_level_cap 与后续版本内容决定)
    - 转职需要完成特定剧情
        10级公共的1转任务
        35/60级根据职业&正邪派区分专职任务内容
    - 转职后属性成长改变
    - 转职后解锁新技能树
    - 同级转职应保持战力相当



---

