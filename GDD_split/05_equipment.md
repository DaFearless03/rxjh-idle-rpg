5. 装备系统
5.1 装备槽位定义

========== [可配置] 装备槽位 ==========
字段约定：
max_count（选填）：该槽位同时可装备的件数；未配置时默认为 1
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
max_count: 2                # 同时可装备 2 件（双手）
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

========== [可配置] 装备词缀（v1.0 全部固定）==========
设计原则：装备属性全部写死、无随机；同 key 装备 → 永远同属性。
装备的差异化乐趣由【强化】+【石头合成】+【装备段位提升】提供，不依赖词缀随机。
#
装备属性的两层结构：
1) base_stats     — 主属性：每个槽位约定一个"基准词条"，所有装备都有
例：amulet 必有 missing；ring 必有 hit；earring 必有 maxHp
（见 5.5 装备模板说明）
2) extra_affixes  — 扩展词条（可选）：同槽位不同装备可挂 0~N 条扩展词条
目的：拉开同槽位装备的数值丰富度（普通 1 条 vs 顶级 4 条）
#
extra_affixes 数量上限（v1.0）：
- amulet / earring：最多 3 条扩展词条（加上 base_stats 主词条 = 最多 4 条）
- ring：0 条（戒指 v1.0 不挂 extra_affixes，仅 base_stats 主词条 hit）
- weapon / chest / gloves / boots / inner_armor / cape：0 条
（这些槽位 v1.0 不用扩展词条；强度差异化全靠 base_stats + 强化 + 石头合成）
#
装备最终属性公式（见 5.5.10 equip_total_formula）：
final_stats = base_stats + 强化加成 + extra_affixes + 合成石头属性
#
写法约定：
- base_stats / extra_affixes 中的 key 必须是 attribute_hooks 已定义的属性
- 数值直接通过对应钩子注入玩家最终面板
（如 extra_affixes.hit: 5 → 等价于一条 hitAdd: 5 钩子加成）
- 装备掉落 / 购买时直接复用配置数值，无任何运行时随机生成流程

5.4 装备模板定义

装备模板字段约定：
sell_price 写法：可以是数字（如 1）或 Python 风格表达式字符串
- 表达式仅支持变量 required_level，运行时按 Python eval 语义解析
- 运算符：+ - * /（不要用中文 ×）
- 条件：x if cond else y（不要用 ? : 三元运算符）

========== [可配置] 武器模板 ==========
复制此模板创建新武器

weapon_template:
  key: "{weapon_type}{faction}{career_stage}"   # 如: blade_positive_t2
  name: "装备名称"
  slot: "weapon"

  faction: "neutral"              # neutral=通用(1转前), positive=正派, negative=邪派
  required_level: 1               # 最小等级下限（≥N）
  required_career: ["blade"]      # 可用职业列表（刀/剑/枪/法杖对应职业key；v1.0 弓手/刺客系不上线）
  required_transfer: 0             # 需要的转职次数（0=无要求, 1=1转, 2=2转...）

  base_stats:
    atkMin: 10                    # 最小攻击力
    atkMax: 15                   # 最大攻击力

  price: 100                    # 购买价格（金币）
  sell_price: "required_level * 100 if required_level < 35 else required_level * 1000"  # 出售价格（金币，35级以下×100，35级及以上×1000）

========== [可配置] 防具模板 ==========
衣服、护手、靴子通用此模板

armor_template:
  key: "{slot}{faction}{career_stage}"   # 如: chest_positive_t3
  name: "装备名称"
  slot: "chest"                  # chest/gloves/boots

  faction: "neutral"             # neutral=通用, positive=正派, negative=邪派
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 10                      # 防御力

  price: 80                     # 购买价格（金币）
  purchaseable: true            # 是否可购买（true/false）
  sell_price: "required_level * 20"  # 出售价格（金币）

========== [可配置] 内甲模板 ==========

inner_armor_template:
  key: "{slot}_{quality}"        # 如: inner_armor_rare
  name: "装备名称"
  slot: "inner_armor"

  faction: "neutral"             # 无正邪派限制，所有角色通用
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 5                       # 防御力

  price: 50                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 项链模板 ==========

amulet_template:
  key: "{slot}{quality}{level}"  # 如: amulet_epic_50
  name: "装备名称"
  slot: "amulet"

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
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 耳环模板 ==========

earring_template:
  key: "{slot}{quality}{level}"  # 如: earring_rare_30
  name: "装备名称"
  slot: "earring"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    maxHp: 20                     # 生命值（基准词条）
    # 可选扩展（部分装备包含）：
    # qigong（特殊字段）：穿戴时为玩家所有"已投点（invested >= 1）的气功"实际等级 +N；
    #   未投点的气功不受影响（不会出现负数）。脱下时所有受影响气功各 -N。
    #   详见 5.5.8 earring_qigong_bonus_rules
    qigong: 0                     # 气功等级加成（N 级）
    maxMp: 0                     # 内功值

  price: 80                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 戒指模板 ==========

ring_template:
  key: "{slot}{quality}{level}"  # 如: ring_legendary_70
  name: "装备名称"
  slot: "ring"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    hit: 5                        # 命中率（基准词条）
    # 可选扩展（部分装备包含）：
    atkMin: 0                      # 最小攻击力
    atkMax: 0                     # 最大攻击力

  price: 80                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 披风模板 ==========

cape_template:
  key: "{slot}_{quality}"         # 如: cape_legendary
  name: "装备名称"
  slot: "cape"

  faction: "neutral"
  required_level: 0               # 无等级要求
  required_transfer: 0

  base_stats: {}                  # 无词条属性

  price: 10                     # 购买价格（金币）
  sell_price: 1                # 出售价格（金币）

========================================================================
披风实例配置说明（v1.0 锁定 2 件；后续按需扩展）
- 已配置：cape_iron_man_armor（钢铁侠铠甲）/ cape_spider_man_suit（蜘蛛侠连体衣）
两件均为 neutral / 无等级与转职门槛 / 4 系通用 / 由银娇龙独家售卖 50000 金币
- 扩展指引：参照上述 2 件结构追加；披风不强化、不挂 extra_affixes，
唯一差异化通道是 4 孔热血石合成
- 让披风可掉落（除商店购买外）：在 9.2 地图掉落池 sub_zone_drops 的 equipment_pool 加入对应 key
========================================================================

========== [可配置] 装备通用字段说明 ==========
==============================
通用字段说明
==============================
faction: neutral=通用(无阵营要求), positive=正派, negative=邪派
required_level: 最小等级下限（≥N）
required_transfer: 需要的转职次数（0=无要求, 1=1转, 2=2转...）
==============================
各槽位词条属性
==============================
weapon:   atkMin ~ atkMax（最小攻击力~最大攻击力）
chest:    def（防御力）
gloves:   def（防御力）
boots:    def（防御力）
inner_armor: def（防御力）
amulet:   missing（回避率，基准）；可扩展 hit/maxHp/maxMp
earring:  maxHp（生命值，基准）；可扩展 qigong/maxMp
ring:     hit（命中率，基准）；可扩展 atkMin~atkMax
cape:     无词条属性
==============================

cape:     无词条属性
==============================

========== [可配置] 装备列表 ==========
purchaseable 字段语义：
true  → 装备可以被商店列入售卖列表；具体哪个商店卖、按什么价格，由 NPC 配置（见 8.2 npc_templates）决定
false → 装备不进任何商店；只能通过打怪掉落 / 任务奖励 / 开盒获得
v1.0 商品政策（双向一致）：
- base 段装备：purchaseable=true，由 shop_weapon_and_enhance / shop_armor 出售
- t1/t2/t3 段装备：purchaseable=false，必须通过 sub_zone_drop / monster.drop_items / box 获得
- 如果未来想让某件 t1+ 装备进商店，需同时把 purchaseable 改成 true 并在对应 shop 的 items 加入条目
修改 purchaseable 时务必同步检查商店 items 列表，避免再次出现"标 false 却在商店卖"的不一致

equipments:
===== 刀客武器（全部派系） =====
--- base（1级，neutral）---
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

5. 装备系统
5.1 装备槽位定义

========== [可配置] 装备槽位 ==========
字段约定：
max_count（选填）：该槽位同时可装备的件数；未配置时默认为 1
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
max_count: 2                # 同时可装备 2 件（双手）
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

========== [可配置] 装备词缀（v1.0 全部固定）==========
设计原则：装备属性全部写死、无随机；同 key 装备 → 永远同属性。
装备的差异化乐趣由【强化】+【石头合成】+【装备段位提升】提供，不依赖词缀随机。
#
装备属性的两层结构：
1) base_stats     — 主属性：每个槽位约定一个"基准词条"，所有装备都有
例：amulet 必有 missing；ring 必有 hit；earring 必有 maxHp
（见 5.5 装备模板说明）
2) extra_affixes  — 扩展词条（可选）：同槽位不同装备可挂 0~N 条扩展词条
目的：拉开同槽位装备的数值丰富度（普通 1 条 vs 顶级 4 条）
#
extra_affixes 数量上限（v1.0）：
- amulet / earring：最多 3 条扩展词条（加上 base_stats 主词条 = 最多 4 条）
- ring：0 条（戒指 v1.0 不挂 extra_affixes，仅 base_stats 主词条 hit）
- weapon / chest / gloves / boots / inner_armor / cape：0 条
（这些槽位 v1.0 不用扩展词条；强度差异化全靠 base_stats + 强化 + 石头合成）
#
装备最终属性公式（见 5.5.10 equip_total_formula）：
final_stats = base_stats + 强化加成 + extra_affixes + 合成石头属性
#
写法约定：
- base_stats / extra_affixes 中的 key 必须是 attribute_hooks 已定义的属性
- 数值直接通过对应钩子注入玩家最终面板
（如 extra_affixes.hit: 5 → 等价于一条 hitAdd: 5 钩子加成）
- 装备掉落 / 购买时直接复用配置数值，无任何运行时随机生成流程

5.4 装备模板定义

装备模板字段约定：
sell_price 写法：可以是数字（如 1）或 Python 风格表达式字符串
- 表达式仅支持变量 required_level，运行时按 Python eval 语义解析
- 运算符：+ - * /（不要用中文 ×）
- 条件：x if cond else y（不要用 ? : 三元运算符）

========== [可配置] 武器模板 ==========
复制此模板创建新武器

weapon_template:
  key: "{weapon_type}{faction}{career_stage}"   # 如: blade_positive_t2
  name: "装备名称"
  slot: "weapon"

  faction: "neutral"              # neutral=通用(1转前), positive=正派, negative=邪派
  required_level: 1               # 最小等级下限（≥N）
  required_career: ["blade"]      # 可用职业列表（刀/剑/枪/法杖对应职业key；v1.0 弓手/刺客系不上线）
  required_transfer: 0             # 需要的转职次数（0=无要求, 1=1转, 2=2转...）

  base_stats:
    atkMin: 10                    # 最小攻击力
    atkMax: 15                   # 最大攻击力

  price: 100                    # 购买价格（金币）
  sell_price: "required_level * 100 if required_level < 35 else required_level * 1000"  # 出售价格（金币，35级以下×100，35级及以上×1000）

========== [可配置] 防具模板 ==========
衣服、护手、靴子通用此模板

armor_template:
  key: "{slot}{faction}{career_stage}"   # 如: chest_positive_t3
  name: "装备名称"
  slot: "chest"                  # chest/gloves/boots

  faction: "neutral"             # neutral=通用, positive=正派, negative=邪派
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 10                      # 防御力

  price: 80                     # 购买价格（金币）
  purchaseable: true            # 是否可购买（true/false）
  sell_price: "required_level * 20"  # 出售价格（金币）

========== [可配置] 内甲模板 ==========

inner_armor_template:
  key: "{slot}_{quality}"        # 如: inner_armor_rare
  name: "装备名称"
  slot: "inner_armor"

  faction: "neutral"             # 无正邪派限制，所有角色通用
  required_level: 1
  required_transfer: 0

  base_stats:
    def: 5                       # 防御力

  price: 50                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 项链模板 ==========

amulet_template:
  key: "{slot}{quality}{level}"  # 如: amulet_epic_50
  name: "装备名称"
  slot: "amulet"

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
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 耳环模板 ==========

earring_template:
  key: "{slot}{quality}{level}"  # 如: earring_rare_30
  name: "装备名称"
  slot: "earring"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    maxHp: 20                     # 生命值（基准词条）
    # 可选扩展（部分装备包含）：
    # qigong（特殊字段）：穿戴时为玩家所有"已投点（invested >= 1）的气功"实际等级 +N；
    #   未投点的气功不受影响（不会出现负数）。脱下时所有受影响气功各 -N。
    #   详见 5.5.8 earring_qigong_bonus_rules
    qigong: 0                     # 气功等级加成（N 级）
    maxMp: 0                     # 内功值

  price: 80                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 戒指模板 ==========

ring_template:
  key: "{slot}{quality}{level}"  # 如: ring_legendary_70
  name: "装备名称"
  slot: "ring"

  faction: "neutral"
  required_level: 1
  required_transfer: 0

  base_stats:
    hit: 5                        # 命中率（基准词条）
    # 可选扩展（部分装备包含）：
    atkMin: 0                      # 最小攻击力
    atkMax: 0                     # 最大攻击力

  price: 80                     # 购买价格（金币）
  sell_price: "required_level * 500"  # 出售价格（金币）

========== [可配置] 披风模板 ==========

cape_template:
  key: "{slot}_{quality}"         # 如: cape_legendary
  name: "装备名称"
  slot: "cape"

  faction: "neutral"
  required_level: 0               # 无等级要求
  required_transfer: 0

  base_stats: {}                  # 无词条属性

  price: 10                     # 购买价格（金币）
  sell_price: 1                # 出售价格（金币）

========================================================================
披风实例配置说明（v1.0 锁定 2 件；后续按需扩展）
- 已配置：cape_iron_man_armor（钢铁侠铠甲）/ cape_spider_man_suit（蜘蛛侠连体衣）
两件均为 neutral / 无等级与转职门槛 / 4 系通用 / 由银娇龙独家售卖 50000 金币
- 扩展指引：参照上述 2 件结构追加；披风不强化、不挂 extra_affixes，
唯一差异化通道是 4 孔热血石合成
- 让披风可掉落（除商店购买外）：在 9.2 地图掉落池 sub_zone_drops 的 equipment_pool 加入对应 key
========================================================================

========== [可配置] 装备通用字段说明 ==========
==============================
通用字段说明
==============================
faction: neutral=通用(无阵营要求), positive=正派, negative=邪派
required_level: 最小等级下限（≥N）
required_transfer: 需要的转职次数（0=无要求, 1=1转, 2=2转...）
==============================
各槽位词条属性
==============================
weapon:   atkMin ~ atkMax（最小攻击力~最大攻击力）
chest:    def（防御力）
gloves:   def（防御力）
boots:    def（防御力）
inner_armor: def（防御力）
amulet:   missing（回避率，基准）；可扩展 hit/maxHp/maxMp
earring:  maxHp（生命值，基准）；可扩展 qigong/maxMp
ring:     hit（命中率，基准）；可扩展 atkMin~atkMax
cape:     无词条属性
==============================

cape:     无词条属性
==============================

========== [可配置] 装备列表 ==========
purchaseable 字段语义：
true  → 装备可以被商店列入售卖列表；具体哪个商店卖、按什么价格，由 NPC 配置（见 8.2 npc_templates）决定
false → 装备不进任何商店；只能通过打怪掉落 / 任务奖励 / 开盒获得
v1.0 商品政策（双向一致）：
- base 段装备：purchaseable=true，由 shop_weapon_and_enhance / shop_armor 出售
- t1/t2/t3 段装备：purchaseable=false，必须通过 sub_zone_drop / monster.drop_items / box 获得
- 如果未来想让某件 t1+ 装备进商店，需同时把 purchaseable 改成 true 并在对应 shop 的 items 加入条目
修改 purchaseable 时务必同步检查商店 items 列表，避免再次出现"标 false 却在商店卖"的不一致

equipments:
===== 刀客武器（全部派系） =====
--- base（1级，neutral）---
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
  # v2.0 内容：t4 装备结构已铺好，但 v1.0 不掉落、不商店出售（无任何 drop_pool / shop 引用）；
  #          等级上限提高到 80+ 时，再补对应掉落池条目即可启用
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
- key: "inner_armor_t2_003"
name: "玄武战衣"
slot: "inner_armor"
faction: "neutral"
required_level: 55
required_transfer: 2
purchaseable: false
base_stats:
  def: 30
  # --- t3（≥60级）---
- key: "inner_armor_t3_001"
name: "天蚕宝甲"
slot: "inner_armor"
faction: "neutral"
required_level: 65
required_transfer: 3
purchaseable: false
base_stats:
  def: 35
- key: "inner_armor_t3_002"
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
extra_affixes:
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
extra_affixes:
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
  # ===== 披风 =====
- key: "cape_iron_man_armor"
name: "钢铁侠铠甲"
slot: "cape"
faction: "neutral"
required_level: 0
required_transfer: 0
required_career: ["blade", "sword", "spear", "staff"]
description: "如钢铁般坚不可摧的铠甲，泛着冷冽金属光泽"
base_stats: {}
purchaseable: true
price: 50000
sell_price: 1
- key: "cape_spider_man_suit"
name: "蜘蛛侠连体衣"
slot: "cape"
faction: "neutral"
required_level: 0
required_transfer: 0
required_career: ["blade", "sword", "spear", "staff"]
description: "轻巧贴身的连体战衣，灵动如丝"
base_stats: {}
purchaseable: true
price: 50000
sell_price: 1


5.5 石头合成与强化系统

5.5.1 石头分类与定义

========== [可配置] 石头分类 ==========
石头按功能分为四大类，分别合成在不同类型的装备上

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

========== [可配置] 石头定义模板 ==========
复制此模板创建新石头
每颗石头只有1条属性，属性类型和数值在掉落时随机生成
石头key格式：{石头基础key}{属性key}{属性值}，用于堆叠判定
示例：vajra_atkSelfAdd_5 表示攻击力+5的金刚石

stone_template:
  key: "石头唯一标识"
  name: "石头名称"
  description: "石头描述"

石头分类
  category: "cold_jade"          # cold_jade / vajra / enhance / hot_blood

出售价格（金币）
  sell_price: 1000

属性配置（强化石不需要此项）
  attribute:
    # 属性池：掉落时按权重随机选择一条属性
    pool:
      - key: "defAdd"          # 属性钩子key（对应属性钩子系统）
        name: "防御力"
        weight: 40                 # 该属性的出现权重
        value_range: [3, 15]       # 属性值随机区间 [最小值, 最大值]

    # 属性值随机规则
    value_distribution: "normal"  # uniform(均匀分布) / normal(正态分布，偏向中间值)

掉落配置
  drop:
    drop_rate: 0.1                # 基础掉落概率（该石头的掉落权重）
    min_level: 1                  # 掉落最低等级门槛
    level_scale: true             # 属性值区间上限是否随掉落等级缩放（最小值不缩放）

热血石技能属性（仅热血石使用）
  skill_attribute: null

特殊效果（仅热血石使用）
  special_effects: []

5.5.3 装备合成孔位规则

========== [可配置] 装备合成孔位 ==========
合成 = 将石头嵌入装备孔位，一旦合成不可拆卸

synthesis_slots:
各装备类型的合成孔位数
v1.0 规则：饰品（amulet / ring / earring）一律 0 孔，不参与合成
  slot_capacity:
    weapon: 4                     # 武器：4个孔位（金刚石）
    chest: 4                      # 胸甲：4个孔位（寒玉石）
    gloves: 4                     # 手套：4个孔位（寒玉石）
    boots: 4                      # 鞋子：4个孔位（寒玉石）
    inner_armor: 2                # 内甲：2个孔位（寒玉石）
    ring: 0                       # 戒指：v1.0 不合成
    amulet: 0                     # 项链：v1.0 不合成
    earring: 0                    # 耳环：v1.0 不合成
    cape: 4                       # 披风：4个孔位（热血石）

孔位与石头类型对应关系
  slot_stone_mapping:
    weapon: "vajra"               # 武器孔位 → 金刚石
    chest: "cold_jade"            # 防具孔位 → 寒玉石
    gloves: "cold_jade"
    boots: "cold_jade"
    inner_armor: "cold_jade"
    cape: "hot_blood"             # 披风孔位 → 热血石

合成规则
  synthesis_rules:
    irreversible: true            # 合成后不可拆卸
    cost_formula: "equip_required_level * 1000"  # 合成费用 = 装备要求等级 × 1000
    same_attribute_stackable: true # 同属性石头可叠加

5.5.4 寒玉石数据配置

========== [可配置] 寒玉石列表 ==========
寒玉石：合成在防具上
每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
石头key格式：{石头基础key}{属性key}{属性值}，用于堆叠判定
示例：cold_jade_01_defAdd_5 表示防御力+5的寒玉石

cold_jade_stones:
- key: "cold_jade_01"
name: "寒玉石"
description: "蕴含寒冰之力的玉石，可合成在防具上"
category: "cold_jade"
attribute:
  pool:
    - key: "defAdd"
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
    - key: "defAdd"
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

========== [可配置] 金刚石列表 ==========
金刚石：合成在武器上
每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
石头key格式：{石头基础key}{属性key}{属性值}，用于堆叠判定
示例：vajra_01_atkSelfAdd_5 表示攻击力+5的金刚石

vajra_stones:
- key: "vajra_01"
name: "金刚石"
description: "坚硬如金刚的宝石，可合成在武器上"
category: "vajra"
attribute:
  pool:
    - key: "atkSelfAdd"
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
    - key: "atkSelfAdd"
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
drop:
  drop_rate: 0.05
  min_level: 40
  level_scale: true
5.5.6 强化石数据配置

========== [可配置] 强化石列表 ==========
强化石：用于武器或防具的强化
强化石自身无属性，堆叠key格式：enhance_stone_01（无属性后缀）

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

========== [可配置] 强化系统规则 ==========

enhance_system:
强化等级上限
  max_level: 10

可强化的装备类型
  enhanceable_slots: ["weapon", "chest", "gloves", "boots", "inner_armor"]
v1.0 规则：饰品（amulet / ring / earring）和披风（cape）都不可强化
- 饰品差异化：靠 base_stats 段位差 + amulet/earring 的 extra_affixes（ring 无）
- 披风差异化：4 孔热血石合成（见 synthesis_slots）

强化效果：每级增加固定属性值，按装备类型区分
  enhance_bonus_per_level:
    weapon:                               # 武器
      atkMinAdd: 6                        # 每级 +6 最小攻击力
      atkMaxAdd: 6                        # 每级 +6 最大攻击力
    armor:                                # 防具（胸甲/手套/鞋子/内甲）
      defAdd: 3                       # 每级 +3 防御力

计算公式
  enhance_formula: |
    # 武器：enhanced_atkMin = base_atkMin + enhance_level * 6
    #       enhanced_atkMax = base_atkMax + enhance_level * 6
    # 防具：enhanced_def = base_def + enhance_level * 3
    # 示例：+5武器 base_atkMin:40, base_atkMax:60 → atkMin:70, atkMax:90
    # 示例：+5胸甲 base_def:30 → 30 + 5 * 3 = 45

强化石消耗规则（根据装备已合成石头数量决定每次消耗颗数）
  stone_cost:
    0_stones: 1                          # 装备未合成任何石头时，每次强化消耗1颗
    1_to_3_stones: 2                     # 装备合成1~3颗石头时，每次强化消耗2颗
    4_plus_stones: 3                     # 装备合成4颗及以上石头时，每次强化消耗3颗

强化成功率（每级不同，可配置）
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
    level_10: 0.0001                       # +10 → 0.01%（即万分之一）

强化失败处理
  failure_behavior: "destroy_equipment"   # destroy_equipment(装备碎裂，已合成石头一同消失)

强化费用公式
  cost_formula: "equip_required_level * 1000"  # 强化费用 = 装备要求等级 × 1000

热血石对强化成功率的影响（见5.5.8热血石配置）
  hot_blood_enhance_bonus: true           # 是否允许热血石增加强化成功率

5.5.8 热血石数据配置

========== [可配置] 热血石列表 ==========
热血石：合成在披风上，提供技能+1、成功率加成、金币爆率等特殊效果
每颗石头掉落时从属性池中随机1条属性，并在区间内随机数值
石头key格式：{石头基础key}{属性key}{属性值}，用于堆叠判定
示例：hot_blood_01_skill_level_up_1 表示技能等级+1的热血石

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
        value_range: [0.01, 0.01]            # 固定+1%（数值即小数百分比，0.01 = +1%）
      - key: "goldDropBonusAdd"
        name: "金币爆率"
        weight: 20
        value_range: [0.05, 0.05]           # 固定+5%（数值即小数百分比，0.05 = +5%）
    value_distribution: "uniform"
  drop:
    drop_rate: 0.08
    min_level: 10
    level_scale: false
    # 气功池：当属性为"<技能>等级+1"时，从池中按权重随机选择 1 个气功
    # 全池随机不限本职：玩家职业不影响抽签结果（生效校验见 hot_blood_skill_stack_rules）
    # 当前 22 项均权重 15（4 刀客 + 6 剑客 + 5 枪客 + 6 医师 + 1 通用）
    # 抽到非本职 / 玩家未投点 / 未达解锁条件 → 沉默失效（不弹窗、不标红）
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
      - skill_key: "blade_qigong_armorBreak"
        name: "霸气破甲"
        weight: 15
      - skill_key: "sword_qigong_atk_max"
        name: "长虹贯日"
        weight: 15
      - skill_key: "sword_qigong_dodge"
        name: "百变神行"
        weight: 15
      - skill_key: "sword_qigong_combo"
        name: "连环飞舞"
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
      - skill_key: "staff_qigong_buffDuration"
        name: "吸星大法"
        weight: 15
      - skill_key: "staff_qigong_mpRecoveryBonus"
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
      value_range: [0.01, 0.01]            # 固定+1%（数值即小数百分比，0.01 = +1%）
      - key: "goldDropBonusAdd"
        name: "金币爆率"
        weight: 20
        value_range: [0.05, 0.05]           # 固定+5%（数值即小数百分比，0.05 = +5%）
    value_distribution: "normal"
  drop:
    drop_rate: 0.02
    min_level: 50
    level_scale: false
========== [可配置] 耳环 qigong 加成规则（v1.0）==========
装备 base_stats.qigong: N 的语义：
- 穿戴时：玩家所有"已投点（player.qigong.invested[k] >= 1）的气功"实际等级 +N
- 未投点的气功（不在 invested 或 invested = 0）不受影响 → 脱下时不会出现负数
- 脱下耳环：所有受影响气功各 -N（即穿戴时的影响完全回退）
- 重置气功：清空 invested → 所有气功不再受耳环加成（因为没投点），但耳环 base_stats.qigong 数值不变
→ 玩家重新投点后该气功立即又获得 +N 加成（每次刷新最终面板时重新评估）
#
与热血石"<技能>等级+1"的区别：
- 热血石：绑定到 1 个具体气功（key 编码进石头），随机绑定
- 耳环 qigong: N：对所有已投点气功统一 +N，无随机绑定
#
生效后等级计算（与热血石叠加）：
final_skill_level(k) = invested(k) + (earring_qigong if invested(k) >= 1 else 0)
+ sum(hot_blood_skill_level_up where binding == k)
上限：min(skill_level_cap=10, qigong.max_level=20) —— 与热血石规则一致
#
多耳环叠加（v1.0 max_count=2 见 5.1 equipment_slots）：
穿 2 只耳环（各 qigong: 1）→ 所有已投点气功各 +2
earring_qigong_bonus_rules:
  trigger: "玩家穿戴 base_stats.qigong > 0 的耳环时"
  scope: "player.qigong.invested 中 value >= 1 的所有气功"
  per_skill_bonus: "earring.base_stats.qigong 数值（多耳环叠加 sum）"
  cap_per_skill: "min(skill_level_cap=10 from hot_blood_skill_stack_rules, qigong.max_level=20)"
  recompute_trigger: "每次玩家投点 / 重置 / 穿脱装备时刷新最终面板"

热血石技能叠加规则
hot_blood_skill_stack_rules:
同一技能可叠加：多颗热血石的"<技能>等级+1"可作用于同一技能,即<技能>都是同一个技能
例：披风4孔全合成"技能等级+1"，随机到同一技能时，该技能 +4 级
  same_skill_stackable: true

技能等级上限
  skill_level_cap: 10                     # 单个技能通过热血石最多叠加到+10

===== 热血石"<技能>等级+1"生效规则（v1.0）=====
掉落策略：全池随机，不限制本职业
热血石掉落时从 hot_blood_01.qigong_pool 全 22 个气功中按权重随机抽 1 个，
不会因玩家职业过滤；玩家可能拿到非本职词条（视为废词条）。
  #
装备策略：可装备但不校验
玩家可以把任何"<气功>+1"热血石合成到披风孔位，系统不阻止；
但是否生效完全由下面"生效条件"决定（沉默失效，不弹窗、不提示、不标红）。
  #
生效条件（同时满足才生效）：
1. 该气功的 career_family 必须包含玩家当前职业的 career_family（"是本职气功"）
例：刀客装"医师吸星大法+1" → 不生效（career_family: staff，刀客 career_family: blade）
例：通用气功"真武绝击" career_family: blade → 仅刀客生效（v1.0 不改为多职业）
2. 玩家在该气功上至少投入了 1 点气功点（"已学"）
未投点 → 不生效（即使玩家已达 unlock 条件）
3. 玩家等级满足 unlock.min_level / min_transfer
未达解锁条件 → 不能投点 → 自然不生效
注：以上 3 条任何一条不满足都"沉默失效"——面板上不显示加成，不弹任何提示
  #
生效后的等级计算：
final_skill_level = invested_points + sum(matching_hot_blood_skill_level_up)
final_skill_level 上限受 skill_level_cap (10) + 气功自身 max_level (20) 共同约束 → 取较小值
  #
解锁后的自动生效：
玩家披风上若已合成"四两千金+1"热血石，但当时未投点（不生效）；
后续投入 1 点后，每次刷新最终面板时按上述生效条件重新评估，自动开始享受 +1 加成；
不需要玩家"重新装备"或"取出再合成"。
  #
设计取舍：v1.0 不做掉落本职过滤、不做装备校验、不做 UI 标红（玩家自己看着办）；
换取规则极简、运行时性能好、收集体验有"赌运气"乐趣。

热血石对强化成功率的加成计算方式
  enhance_success_formula: |
    # 角色身上所有披风热血石的"合成强化成功率"之和
    total_bonus = sum(hot_blood_stone.enhanceSuccessBonus)
    # 实际成功率 = 基础成功率 + 加成（数值即小数百分比，0.05 = +5%，直接相加；不超过 100%）
    actual_rate = min(base_success_rate + total_bonus, 1.0)
    # 示例：+7强化基础5%（见 enhance_system.success_rate.level_7），披风合计 +0.05 → 实际 0.05 + 0.05 = 0.10（10%）

热血石对金币爆率的加成计算方式
  gold_drop_formula: |
    # 角色身上所有披风热血石的"金币爆率"之和
    total_gold_bonus = sum(hot_blood_stone.goldDropBonus)
    # 最终金币掉落 = 基础金币 × (1 + total_gold_bonus)（数值即小数百分比，无需 /100）
    # 示例：基础金币 100，披风合计 +0.08 → 最终 100 × 1.08 = 108

5.5.9 石头掉落与属性生成规则

========== [可配置] 石头掉落与属性生成 ==========

stone_generation:
石头掉落流程：
1. 判定是否掉落石头（按 drop_rate）
2. 按权重随机选择石头类型（寒玉石/金刚石/强化石/热血石）
3. 按该石头的属性池权重随机选择1条属性
4. 在属性的 value_range 内随机生成数值

石头类型掉落权重
  category_drop_weights:
    cold_jade: 35                          # 寒玉石 35%
    vajra: 25                              # 金刚石 25%
    enhance: 30                            # 强化石 30%
    hot_blood: 10                          # 热血石 10%

同类型内不同石头的掉落权重
（用于同一分类下有多种石头时，决定掉哪种）
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

属性值随机规则
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

========== [可配置] 合成操作规则 ==========

synthesis_operations:
合成前提条件
  preconditions:
    - "装备存在空余合成孔位"
    - "石头类型与孔位类型匹配（寒玉石→防具孔, 金刚石→武器孔, 热血石→披风孔）"
    - "角色拥有足够金币支付合成费用"

合成过程
  process:
    - step: "选择装备"
    - step: "选择石头"
    - step: "校验孔位与石头类型匹配"
    - step: "扣除合成费用"
    - step: "判定合成成功率"
    - step_on_success: "石头属性附加到装备，孔位标记为已占用，石头从背包消耗"
    - step_on_failure: "当次合成的石头消失，装备和已合成的石头保留"

合成费用
  cost_formula: "equip_required_level * 1000"  # 合成费用 = 装备要求等级 × 1000

合成成功率（根据已占用孔位数递减）
已占用孔位越多，合成越难
  success_rate:
    0_occupied: 0.90                        # 0孔已占 → 第1孔合成 90%
    1_occupied: 0.50                        # 1孔已占 → 第2孔合成 50%
    2_occupied: 0.20                        # 2孔已占 → 第3孔合成 20%
    3_occupied: 0.05                        # 3孔已占 → 第4孔合成 5%
    # 注：内甲只有2孔，最高只用到 1_occupied
    # 披风和防具有4孔，会用到 3_occupied

热血石对合成成功率的影响
  hot_blood_synthesis_bonus: true           # 是否允许热血石增加合成成功率
加成计算方式（与强化成功率加成一致；数值即小数百分比，0.05 = +5%，直接相加）
actual_rate = min(base_success_rate + total_synthesis_bonus, 1.0)

合成失败处理
  failure_behavior: "stone_lost"            # stone_lost(当次石头消失，装备和已合成石头保留)

合成规则
  irreversible: true                        # 合成成功后石头不可拆卸、不可替换

合成后装备属性计算
  equip_total_formula: |
    # ========== 装备属性聚合规则（v1.0 显式约定）==========
    # 装备所有数值化属性都按"字段名 + Add 后缀 → 同名钩子"的统一规则转换，
    # 不引入任何字段名映射表，避免 AI 实现时反复查表。
    #
    # ===== 转换规则 =====
    # 1) base_stats 字段名 → xxxAdd 钩子（直接拼后缀）
    #    例：base_stats: { atkMin: 10 }     → 等价 atkMinAdd: 10
    #    例：base_stats: { atkMax: 15 }     → 等价 atkMaxAdd: 15
    #    例：base_stats: { def: 25 }        → 等价 defAdd: 25
    #    例：base_stats: { missing: 5 }     → 等价 missingAdd: 5
    #    例：base_stats: { hit: 5 }         → 等价 hitAdd: 5
    #    例：base_stats: { maxHp: 30 }      → 等价 maxHpAdd: 30
    #
    # 2) extra_affixes 字段名 → xxxAdd 钩子（与 base_stats 完全同规则）
    #    例：extra_affixes: { hit: 5, maxHp: 10 } → hitAdd:5 + maxHpAdd:10
    #
    # 3) 武器的 atkMin / atkMax 即使数值相同，也分别转 atkMinAdd / atkMaxAdd，
    #    不用 atkSelfAdd（atkSelfAdd 仅供"必须同时影响两者且数值相等"的来源使用，如 Buff "狂风万破"）
    #
    # 4) 强化加成（武器 +6/级，防具 +3/级）按"独立 xxxAdd 钩子"形式注入：
    #    enhanced_atkMin_hook = base_stats.atkMin + enhance_level × 6  → 作为单条 atkMinAdd 钩子
    #    enhanced_atkMax_hook = base_stats.atkMax + enhance_level × 6  → 作为单条 atkMaxAdd 钩子
    #    enhanced_def_hook    = base_stats.def    + enhance_level × 3  → 作为单条 defAdd 钩子
    #    （即：装备的 base_stats + 强化加成 合并成"一条加大数值的 *Add 钩子"，再走玩家公式聚合）
    #
    # 5) 字段名必须是 attribute_hooks 中存在对应 xxxAdd 钩子的属性；
    #    遇到没有对应钩子的字段（如未来加新属性时未同步建钩子）→ 抛错告警
    #
    # 6) 特殊字段例外（不走 xxxAdd 钩子聚合通道）：
    #    - base_stats.qigong（仅耳环可有）：触发"耳环 qigong 加成规则"（见 5.5.8 earring_qigong_bonus_rules）
    #      不转 qigongAdd 钩子（不存在该钩子），而是穿戴时为所有已投点气功实际等级 +N
    # ===================================================
    final_stats_hooks = enhanced_base_stats_hooks + extra_affixes_hooks + synthesis_stone_hooks
    # 上述 3 类钩子注入玩家属性公式（见 2.1 base_attributes），最终汇总到玩家面板
    #
    # 字段语义复习：
    # enhanced_base_stats_hooks：装备 base_stats 字段（含强化加成）按规则 4 合并出的钩子集合
    # extra_affixes_hooks       ：装备 extra_affixes 字段按规则 2 直接转出的钩子集合
    # synthesis_stone_hooks     ：装备孔位中所有已合成石头属性的钩子聚合（见 5.5.2 stone_template）



---

