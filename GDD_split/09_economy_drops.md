9. 经济与掉落系统
9.1 金币系统

# ========== [可配置] 金币系统 ==========

economy:
  # 金币掉落规则（每次怪物击杀）
  # 实际金币 = base_gold × (1 + goldDropBonus) × gold_modifier
  # goldDropBonus 已是小数百分比（如 0.05 = +5%），无需 /100
  # gold_modifier 来自 9.2 level_diff_modifier：level_diff > 5 时为 0（直接不掉）
  gold_drop:
    drop_rate: 0.10                   # 固定10%掉落概率
    base_formula: "sub_zone.gold_range"   # 基础金币从怪物所属sub_zone的gold_range读取
    bonus_formula: "base_gold * (1 + player.goldDropBonus) * gold_modifier"  # 热血石爆率 + 等级差控制

  # 历练获取规则
  # training_modifier 来自 9.2 level_diff_modifier：level_diff > 5 时为 0
  training_drop:
    drop_rate: 1.0                    # 100%获取（前提：level_diff ≤ 5）
    amount: 1                          # 每次击杀获取1点历练
    no_bonus: true                     # 无任何加成机制（不被 mf/gf 等钩子影响）

  # 金币获取来源（除怪物掉落外的其他来源）
  income_sources:
    - type: "stage_clear"
      formula: "stage_level * random(5, 15)"

    - type: "sell_equipment"
      formula: "equipment_base_price * 0.5"    # 出售价格为原价的50%

  # 金币消耗（v1.0 三大金币黑洞：强化、合成、药剂购买）
  # 设计取舍：
  #   v1.0 装备永久无耐久度（durability 系统不引入）；
  #   金币消耗靠下面三类持续通道——强化（高频赌博）/ 合成石头（中频）/ 药剂购买（低单价高频次）。
  #   修理 / 损坏 / 装备返厂等概念 v1.0 完全不做；如未来玩家金币爆仓明显，可在 v2.0 引入耐久度系统。
  expenses:
    # 一次性消耗（新手期）
    - type: "buy_base_equipment"
      formula: "equipment_base_price"           # 买 base 段武器/防具（30 件，仅商店出售）

    # 持续消耗（核心金币黑洞）
    - type: "enhance_equipment"
      formula: "equip_required_level * 1000"    # 强化费用，详见 5.5.7 enhance_system.cost_formula
                                                # 失败摧毁装备（含已合成石头），高赌博性 → 玩家最大金币消耗渠道
    - type: "synthesis_stone"
      formula: "equip_required_level * 1000"    # 合成石头到装备，详见 5.5.10 synthesis_operations.cost_formula
                                                # 失败时仅损失当次石头，装备保留 → 第二大消耗渠道
    - type: "buy_potion"
      formula: "potion.price (10 / 50 / 120 by grade)"  # 玩家挂机自动喝药持续消耗，需定期补货

    # 偶尔消耗（中后期）
    - type: "qigong_reset"
      formula: "10000 * (10 ** reset_count)"    # 重置气功投点：第1次 10000，第2次 100000，递增
                                                # 详见 attribute_points.reset.cost
    - type: "unlock_character_slot"
      fixed: 100                                # 解锁额外角色栏位，详见 13.5 multi_save

9.2 地图掉落池系统

# ========== [可配置] 地图掉落池 ==========
# 每个地图从全局装备/石头中选择部分物品纳入该地图的掉落池
# 在此池中按地图单独配置掉落规则和权重
# 普通怪只走地图掉落池，特殊怪走地图掉落池 + 自身掉落（叠加）
#
# 字段约定：equipment_pool / stone_pool 同时使用 weight + drop_rate 两个字段，按两步判定（详见 9.3 evaluation_flow）：
#   第 1 步：在池内按 weight 加权随机选 1 个候选物品（决定"如果出，出哪个"）
#   第 2 步：用该物品自身的 drop_rate 做概率判定（决定"到底出不出"），还会乘 level_diff_modifier.rate_modifier
#   也就是说：weight 不是概率（相对值），drop_rate 才是概率（0-1）；二者职责清晰不重叠

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

  # 等级差惩罚/加成（v1.0 统一规则；同时影响掉落 / 经验 / 历练 / 金币）
  level_diff_modifier:
    enabled: true
    formula: |
      level_diff = player_level - monster_level

      # 装备/石头掉落率：指数类衰减
      if level_diff <= 0:
          rate_modifier = 1.0
      elif level_diff == 1:
          rate_modifier = 0.90
      elif level_diff == 2:
          rate_modifier = 0.70
      elif level_diff == 3:
          rate_modifier = 0.50
      elif level_diff == 4:
          rate_modifier = 0.30
      elif level_diff == 5:
          rate_modifier = 0.10
      else:  # level_diff > 5
          rate_modifier = 0.0   # 完全不掉

      # 经验 / 历练 / 金币：统一规则
      # level_diff <= 5 → 全额（不受 rate_modifier 影响）
      # level_diff > 5  → 全部归零（与装备/石头一致）
      if level_diff > 5:
          exp_modifier = 0
          training_modifier = 0
          gold_modifier = 0
      else:
          exp_modifier = 1.0
          training_modifier = 1.0
          gold_modifier = 1.0

    # 设计含义：
    #   - level_diff ≤ 0（怪比玩家高 / 同级）：所有产出 100%，鼓励硬刚（转职任务 / 南明湖）
    #   - level_diff 1~5：装备掉率指数衰减但经验金币历练仍 100%，玩家越级打低级怪能升级但拿不到好装备
    #   - level_diff > 5：所有产出归零，杜绝 L60 回去刷 L1 怪薅金币 / 装备

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
  - key: "inner_armor_t2_003"
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
  - key: "inner_armor_t2_003"
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
  - key: "inner_armor_t2_003"
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
  - key: "inner_armor_t3_001"
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
  - key: "inner_armor_t3_001"
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
  - key: "inner_armor_t3_001"
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
  - key: "inner_armor_t2_003"
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
  - key: "inner_armor_t2_003"
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
  - key: "inner_armor_t3_001"
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
  - key: "inner_armor_t3_001"
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
  - key: "inner_armor_t3_001"
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

9.3 掉落判定流程


========== [可配置] 掉落判定流程 ==========

drop_evaluation:
掉落优先级与叠加规则
  priority_rules:
    - rule: "地图掉落池、怪物任务物品、怪物盒子三类各自独立判定"
      description: "sub_zone_drop（金币/装备/石头）/ monster.drop_items（任务物品）/ monster_drop_box（盒子）三类各自独立判定，互不影响；可同时掉出"
    - rule: "任务物品掉落需满足任务条件"
      description: "任务物品（item_key 出现在 quest_items 表中的条目）只有在玩家身上有对应未提交任务时才能掉落，否则视为不爆"
    - rule: "盒子按地图查表掉落"
      description: "怪物所在地图通过 monster_drop_box.box_type_by_map 反查盒子 key；未配置盒子的地图（如城镇）不掉盒子"

完整掉落判定流程
  evaluation_flow: |
    # ===== 0. 等级差预判（9.2 level_diff_modifier）=====
    # 击杀瞬间先算一次 level_diff，所有奖励维度共用同一组 modifier
    level_diff = player.level - monster.level
    modifiers = level_diff_modifier.formula(player.level, monster.level)
    # modifiers = { rate_modifier, exp_modifier, training_modifier, gold_modifier }

    # ===== 1. 经验 / 历练（不受 rate_modifier 影响，只看 exp/training_modifier）=====
    grant_exp(monster.exp * modifiers.exp_modifier)
    grant_training(economy.training_drop.amount * modifiers.training_modifier)

    # ===== 2. 地图掉落池判定（所有怪物均触发）=====
    for each drop_roll in sub_zone_drop.drop_rolls:
        if roll trigger matches monster type:
            for i in range(roll_count):
                # 2a. 判定金币掉落（固定10%概率，受 gold_modifier 控制）
                if modifiers.gold_modifier > 0 and random() < 0.10:
                    base_gold = random(sub_zone.gold_range[0], sub_zone.gold_range[1])
                    final_gold = base_gold * (1 + player.goldDropBonus) * modifiers.gold_modifier
                    drop_gold(final_gold)

                # 2b. 判定装备掉落（rate_modifier 应用到掉率上）
                selected = weighted_random(sub_zone_drop.equipment_pool)
                actual_rate = selected.drop_rate * sub_zone_drop.equipment_rate * modifiers.rate_modifier
                if random() < actual_rate:
                    drop_equipment(selected)

                # 2c. 判定石头掉落（rate_modifier 应用到掉率上）
                selected_stone = weighted_random(sub_zone_drop.stone_pool)
                actual_stone_rate = selected_stone.drop_rate * sub_zone_drop.stone_rate * modifiers.rate_modifier
                if random() < actual_stone_rate:
                    drop_stone(selected_stone)

    # ===== 3. 怪物自身任务物品掉落判定（所有怪物均触发；不受 level_diff_modifier 影响）=====
    # 任务物品掉率仅受 quest_item_drop_condition 控制（玩家有未提交对应任务才掉）
    if monster.drop_items:
        exclusive_groups_dropped = set()    # 本次击杀已掉过的 exclusive_group
        for drop_item in monster.drop_items:
            # 3a. 判定任务物品掉落条件
            if not quest_item_drop_condition(drop_item.item_key):
                continue    # 不满足任务条件，不爆
            # 3b. exclusive_group 排他：同次击杀，组内只能掉 1 个
            if drop_item.exclusive_group and drop_item.exclusive_group in exclusive_groups_dropped:
                continue    # 该组已掉过，跳过本项
            # 3c. 判定掉落概率（来自 monster.drop_items.droprate；省略时继承 task_item_drop_config.default_droprate）
            effective_droprate = drop_item.droprate ?? task_item_drop_config.default_droprate
            if random() < effective_droprate:
                ok = drop_item_to_player(drop_item)
                if not ok:
                    break    # 任务物品入包失败 → 已强制停挂机，阻断本怪后续任务物品判定（详见 drop_adapters.drop_item_to_player）
                if drop_item.exclusive_group:
                    exclusive_groups_dropped.add(drop_item.exclusive_group)

    # ===== 4. 盒子掉落判定（所有怪物均触发；不受 level_diff_modifier 影响）=====
    # 配置来源（单一来源）：12.3 monster_drop_box
    #   drop_rate: 全局怪物掉盒概率（默认 0.001 = 千分之一）
    #   box_type_by_map: { 地图 key → 盒子 key } 反查表
    # 与地图掉落池/任务物品互相独立，三者各自判定
    #
    # 运行时约定：怪物模板（7.1 monster_template）不含 map_key 字段——
    #   怪物归属哪张地图由"实例化时所在 zone"决定。
    #   战斗系统在按 sub_zone.monsters 刷怪时，需为每个怪物实例补一个运行时字段：
    #     monster_instance.map_key = current_sub_zone.parent_map_key
    #   ⚠️ parent_map_key 不是 sub_zone 静态配置字段，由 sub_zone 实例化时由 enclosing map 注入：
    #     for map in config.zones:
    #         for sub_zone in map.sub_zones:
    #             sub_zone.parent_map_key = map.key      # 启动时一次性回填，所有 sub_zone 都得到 parent 引用
    #   该字段不写入存档/配置文件，仅运行时挂在 sub_zone 实例上。
    #   monster_instance.map_key 同理 —— 不写入存档，仅在怪物实例上保留至怪物死亡，供盒子掉落查表使用。
    #
    # 边界情况（防御性处理）：
    #   - 若 monster.map_key 为 null/缺失（理论不应发生，但代码兜底）→ 不掉盒子，记日志告警
    #   - 玩家战斗中传送（in_combat_teleport）→ 怪物视为撤退，不进入掉落判定流程，盒子段不执行
    #   - 玩家切 zone 瞬间正在结算的怪物：map_key 已绑定在实例上，结算继续走原 zone 的盒子映射
    #     （即使该 zone 已被清场，map_key 引用的是字符串，不依赖 zone 实例存活）
    if random() < monster_drop_box.drop_rate:
        if not monster.map_key:
            log_warning("monster.map_key missing on kill, skip box drop")
        else:
            box_key = monster_drop_box.box_type_by_map.get(monster.map_key, None)
            if box_key is not None:
                drop_box_to_player(box_key)
            # 若 monster.map_key 不在 box_type_by_map 中（如城镇/未配置盒子的地图）→ 不掉盒子

===== drop_adapters 的辅助函数与全局 flag（v1.0）=====
  drop_helpers:
    is_in_offline_simulation: |
      # 全局 boolean flag，标记当前是否在 settle_offline_rewards 主循环内
      # 设置时机：simulation_flow 入口前置为 true；退出时（return / break / 异常）清除为 false
      # 在线 100ms tick (game_loop) 内恒为 false；drop_adapters 5 函数据此切换 UI toast 与 summary 行为
      # 实现侧约定：作为模块级变量挂在 OfflineSimulator.is_in_offline_simulation；GM 面板不可见

    create_equipment_instance: |
      def create_equipment_instance(equipment_template) -> dict:
          # 装备模板（来自 equipments[] 列表的某一条）→ 创建唯一实例
          # 返回结构 = 13.1 save_data_structure.inventory.equipment_instances[<instance_id>] 的值
          # 字段语义复习：
          #   instance_id  : UUID，由 equipped[slot] 或 inventory.slots 引用
          #   item_key     : 反查 equipments[] 配置模板的 key（注意：实例字段叫 item_key，不是 key）
          #   enhance_level: 强化等级 0~10
          #   synthesis_slots: 已合成石头堆叠 key 列表
          return {
              instance_id: generate_uuid(),
              item_key: equipment_template.key,       # 模板的 key 写入实例的 item_key 字段
              enhance_level: 0,                       # 初始未强化
              synthesis_slots: [],                    # 初始未合成石头
          }

    find_active_quest_key: |
      def find_active_quest_key(item_key) -> string | None:
          # 找出"玩家正接取且当前 stage 需要该 item"的 quest_key
          # 用于 drop_item_to_player 满包时生成 summary.quest_item_lost.quest_key 字段
          for quest in player.quests.accepted:
              for stage_block in quest.objectives:
                  if stage_block.stage != quest.current_stage: continue
                  if any(item.item_key == item_key for item in stage_block.items):
                      return quest.key
          return None

    find_required_count: |
      def find_required_count(item_key) -> int:
          # 找出"玩家正接取任务当前 stage 中"该 item 的 required count
          # 用于 drop_item_to_player 满包时生成 summary.quest_item_lost.required_count 字段
          quest_key = find_active_quest_key(item_key)
          if quest_key is None: return 0
          quest = next(q for q in player.quests.accepted if q.key == quest_key)
          stage_block = next(s for s in quest.objectives if s.stage == quest.current_stage)
          return next(i.count for i in stage_block.items if i.item_key == item_key)

===== drop_* 适配层（evaluation_flow → InventorySystem / 玩家资源）=====
evaluation_flow 内调用的 5 个 drop_* 函数统一定义在此；调用方差异：
- 在线：UI toast + push_reward_log_event + 即时反馈
- 离线：UI 静默，行为累加到 summary.* 字段（详见 13.4 simulation_flow.summary）
是否在离线模拟中由全局 flag`is_in_offline_simulation` 判定
  drop_adapters:
    drop_gold: |
      def drop_gold(amount):
          # 金币不占背包格，直接累加 player.resources.gold
          player.resources.gold += amount
          if is_in_offline_simulation:
              summary.gold_gained += amount
          else:
              push_reward_log_event("gold", { amount })

    drop_equipment: |
      def drop_equipment(equipment_template):
          # 装备每件唯一实例（instance_id），不堆叠 → 走专属接口 addEquipmentInstance
          # 注意：装备不能走 InventorySystem.add（add 是按 item_key 堆叠的，会让 +5 武器与 +3 武器错误合并）
          new_instance = create_equipment_instance(equipment_template)
          result = InventorySystem.addEquipmentInstance(player, new_instance)
          if result.success:
              if is_in_offline_simulation:
                  summary.items_obtained.append(new_instance.item_key)
              else:
                  push_reward_log_event("equipment_dropped", { name: equipment_template.name })
          else:
              # 背包满 → 装备直接丢弃（与离线 inventory_full_handling.equipment 分支一致）
              summary.items_discarded += 1
              if not is_in_offline_simulation:
                  show_toast(f"背包已满，装备 {equipment_template.name} 已丢弃")

    drop_stone: |
      def drop_stone(stone_template):
          # 石头按 max_stack 堆叠 → 走 InventorySystem.add 1 件
          result = InventorySystem.add(player, stone_template.key, 1)
          if result.success:
              if is_in_offline_simulation:
                  summary.items_obtained.append(stone_template.key)
              else:
                  push_reward_log_event("stone_dropped", { name: stone_template.name })
          else:
              summary.items_discarded += 1
              if not is_in_offline_simulation:
                  show_toast(f"背包已满，石头 {stone_template.name} 已丢弃")

    drop_item_to_player: |
      def drop_item_to_player(drop_item) -> bool:
          # 任务物品（item_class == "quest_items"）→ 走 InventorySystem.add 1 件
          # 返回 bool: True=入包成功；False=背包满 → 调用方应 break 阻断后续掉落判定
          result = InventorySystem.add(player, drop_item.item_key, 1)
          if result.success:
              if is_in_offline_simulation:
                  summary.items_obtained.append(drop_item.item_key)
              else:
                  push_reward_log_event("quest_item", { name: quest_items[drop_item.item_key].name })
              stage_advance_check()           # 入背包成功后立即跑（在线/离线同；详见 9.3 stage_advance_check）
              return True
          else:
              # 背包满 → 触发 inventory_full_handling 的 "quest_item" 分支
              player.is_auto_play = False     # 在线/离线统一停挂机
              summary.stopped_reason = "inventory_full_quest_item"
              summary.quest_item_lost = {
                  item_key: drop_item.item_key,
                  quest_key: find_active_quest_key(drop_item.item_key),
                  current_count: InventorySystem.count(player, drop_item.item_key),
                  required_count: find_required_count(drop_item.item_key)
              }
              if not is_in_offline_simulation:
                  show_toast(f"⚠️ 背包已满，任务物品 {quest_items[drop_item.item_key].name} 无法保存，已停止挂机")
              return False

    drop_box_to_player: |
      def drop_box_to_player(box_key):
          # 盒子 max_stack 999 → 走 InventorySystem.add 1 件
          result = InventorySystem.add(player, box_key, 1)
          if result.success:
              if is_in_offline_simulation:
                  summary.boxes_obtained += 1
              else:
                  push_reward_log_event("box_dropped", { name: boxes[box_key].name })
          else:
              summary.items_discarded += 1
              if not is_in_offline_simulation:
                  show_toast(f"背包已满，盒子 {boxes[box_key].name} 已丢弃")

========== [可配置] 任务物品掉率全局配置 ==========
设计取舍：
- 全游戏任务物品默认掉率统一由本配置提供，便于一处调参
- 怪物 drop_items 条目省略 droprate 时，掉落判定使用本配置的 default_droprate
- 单只怪如需特殊掉率（如 boss 任务物品提高到 5%），在 monster.drop_items[].droprate 显式覆写即可
- 本配置仅决定"基础掉率"，最终是否爆出还需通过 quest_item_drop_condition 校验
（玩家已接取对应任务 & 库存未达 required_count）
task_item_drop_config:
  default_droprate: 0.001          # 默认任务物品掉率（v1.0 = 0.1%），可全局调参
解析规则（与 evaluation_flow 3c 对齐）：
effective_droprate = monster.drop_items[i].droprate ?? task_item_drop_config.default_droprate

========== [可配置] 任务物品掉落规则 ==========
quest_item_drop_condition:
任务物品掉落判定逻辑
当怪物掉落任务物品时，需同时满足以下条件才能实际爆出
----------------------------------------------------------------
派系隔离说明（v1.0）：
- 任务物品本身不分正邪（如 red_bear_skin 在正派 2 转 / 邪派 2 转任务中共用同一 item_key）
- 派系隔离靠"任务接取"实现：玩家只能接同派系任务（详见 8.3 转职任务状态机）
- 因此条件1中"遍历已接取任务"自然过滤了对立派系：玩家根本接不到对立任务，物品掉落条件不通过
- 一份相同 item_key 可同时服务正/邪 2 转任务，无需为两派复制两份物品定义
----------------------------------------------------------------
Stage 严格顺序说明（v1.0）：
- 所有转职任务 objectives 统一为 stage 嵌套结构（1/2 转单 stage，3 转多 stage）
- 严格顺序：物品仅当其所属 stage == quest.current_stage 时才能掉落
例：3 转任务玩家正在 stage 1 → stage 2/3 的物品（如剑齿虎皮）即使打到对应怪也不掉
- stage 推进时机：quest.current_stage 的物品全部收齐（current_count >= required_count for all items）
→ completed_stages.append(current_stage) → current_stage += 1 → UI 弹"进入下一阶段"提示
- 1/2 转任务永远 current_stage=1，无推进逻辑（单 stage）
----------------------------------------------------------------
  condition: |
    # 条件1: 玩家是否接取了对应任务且未提交，且该物品属于"当前 stage"
    has_active_quest = false
    required_count = 0
    for quest in player.quests.accepted:
        if quest.type == "career_transfer":
            # 转职任务：正/邪派任务只能各完成一次
            if quest.faction != null and quest.faction != player.faction:
                continue
        # 仅匹配"当前 stage"的 items（严格顺序保护：前序 stage 未完 / 后序 stage 不掉）
        for stage_block in quest.objectives:
            if stage_block.stage != quest.current_stage:
                continue                        # 不是当前 stage，跳过
            for item in stage_block.items:
                if item.item_key == item_key:
                    has_active_quest = true
                    required_count = item.count
                    break
            if has_active_quest:
                break
        if has_active_quest:
            break

    if not has_active_quest:
        return false    # 未接取对应任务 或 不在当前 stage，物品不爆

    # 条件2: 任务物品数量是否已达上限
    # 仅看背包内数量（v1.0 任务物品禁止入仓库，见 11 章 deposit_popup.forbidden_types）
    current_count = InventorySystem.count(player, item_key)
    if current_count >= required_count:
        return false    # 已收集足够数量，不继续爆

    return true         # 满足全部条件，物品爆出

===== Stage 推进检查（v1.0 触发规则）=====
触发时机（仅 2 个）：
1. 战斗中怪物掉落任务物品入背包后立即调用（同一 tick 内）
2. 离线模拟期间，每次怪物掉落任务物品入背包同样调用（与在线行为完全一致）
不触发的场景（v1.0 显式约定）：
- 玩家手动丢弃任务物品 → 不触发；stage 推进是单调递增的，已 completed_stages 不会回退
（丢弃后玩家需要重新打掉落补齐当前 stage，但已完成的 stage 不需重做）
- 仓库存取 → 不触发；v1.0 任务物品禁止入仓库（见 11 章 deposit_popup.forbidden_types）
- 商店买卖 → 不触发；任务物品 sell_price=0 已隐式不可卖，盒子也不掉任务物品
设计取舍：v1.0 仅在"获取"方向触发推进、"减少"方向不回退；规则极简且玩家可预测
  stage_advance_check: |
    # 在玩家拾起任意任务物品后调用，检查当前 stage 是否全部收齐 → 推进到下一 stage
    for quest in player.quests.accepted:
        current_stage_block = next(s for s in quest.objectives if s.stage == quest.current_stage)
        all_collected = all(
            InventorySystem.count(player, item.item_key) >= item.count
            for item in current_stage_block.items
        )
        if all_collected:
            quest.completed_stages.append(quest.current_stage)
            # 还有下一 stage → 推进
            next_stage = quest.current_stage + 1
            has_next = any(s.stage == next_stage for s in quest.objectives)
            if has_next:
                quest.current_stage = next_stage
                notify_player(f"进入第 {next_stage} 阶段：{stage_name_of(quest, next_stage)}")
            # else: 全部 stage 完成 → UI 任务面板亮"可提交" 按钮（提交流程见下方 submit_quest）

===== 任务提交流程（v1.0 完整定义）=====
触发：玩家所有 stage 已 completed_stages 全满（last_stage in completed_stages）
→ multi_save / 任务 UI 该任务行亮起绿色"提交"按钮
→ 玩家必须返回接取该任务的 quest_npc（v1.0 仅 quest_npc：泫渤派门主，详见 8.2 npc_templates）
→ 玩家点击 NPC 对话框中的"提交「任务名」"选项 → 调用 submit_quest()
设计取舍（v1.0）：
- 手动提交（非自动）：给玩家"完成转职里程碑"的仪式感，符合"硬仗里程碑"设计
- 任务物品扣除：让玩家直观感觉"交差了"，背包同步释放空间
- 必须回原 NPC：玩家走"接 → 打 → 交"完整闭环，与传统 RPG 一致
  submit_quest: |
    def submit_quest(player, quest):
        # ===== 1. 校验前置 =====
        # 仅 accepted 列表里的任务可提交
        if quest.key not in [q.key for q in player.quests.accepted]:
            return error("任务未接取")
        # 必须所有 stage 全部 completed
        all_stages = [s.stage for s in quest.objectives]
        if not all(s in quest.completed_stages for s in all_stages):
            return error("任务尚未全部完成")
        # 必须在接取的 NPC 处提交（quest_template 已隐含 → v1.0 仅 quest_npc）
        # UIState.active_npc 由 open_dialog(npc) 维护，详见 8.2 NPC 对话状态
        if UIState.active_npc is None or UIState.active_npc.npc_key != "quest_npc":
            return error("请到泫渤派门主处提交此任务")

        # ===== 2. 扣除任务物品（按所有 stage 的 items 总和）=====
        for stage_block in quest.objectives:
            for item in stage_block.items:
                InventorySystem.remove(player, item.item_key, item.count)
                # remove 内部走 inventory_remove 标准流程，更新堆叠/槽位

        # ===== 3. 应用奖励（按 rewards 列表顺序执行）=====
        for reward in quest.rewards:
            if reward.type == "unlock_career":
                # 自动按 player.career_family 匹配目标职业 key（详见 8.3 章头部 "自动转职流程"）
                target_career_key = next(
                    c for c in reward.careers
                    if careers[c].career_family == player.career_family
                )
                player.career = target_career_key   # 自动切换 career（transfer_count / career_family 由 career 后缀派生）
                player.career_history.append(target_career_key)
                # 派生属性按新职业 attrGrow 重算
                AttributeSystem.recompute(player)
                # 触发 EventBus
                EventBus.emit("player.career_transfer", { from_career, to_career: target_career_key })
            elif reward.type == "set_faction":
                # 二次审计校验（接取时已设；提交时再确认未被篡改）
                if player.faction != reward.faction:
                    log_warn(f"faction mismatch on submit: expected {reward.faction}, got {player.faction}")
                player.faction = reward.faction
            # 未来扩展类型（如 grant_exp / grant_gold 奖励）在此 elif 追加

        # ===== 4. 移交任务状态：accepted → completed =====
        player.quests.accepted = [q for q in player.quests.accepted if q.key != quest.key]
        player.quests.completed.append(quest.key)

        # ===== 5. UI / 日志 / 存档 =====
        notify_player(f"任务完成：{quest.name}")
        push_reward_log_event("quest_completed", { quest_key: quest.key })
        EventBus.emit("quest.completed", { quest_key: quest.key })
        save_player_state(player)

===== UI 入口与可见性约定 =====
  submit_button_visibility: |
    # multi_save 列表 / 任务 UI 中任务行的提交按钮显示规则：
    #   绿色亮起："可提交"——所有 stage in completed_stages
    #   灰色禁用："收集中"——存在 stage 未完成
    #   隐藏：     该任务未接取（不在 accepted 列表）
    # NPC 对话框中的提交选项：
    #   仅当玩家与 quest_npc 对话 且 该 NPC 关联的任意一个任务可提交时 → 显示"提交「任务名」"选项
    #   多个任务同时可提交 → 列出多个选项

