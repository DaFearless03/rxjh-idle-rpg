10.药剂及药剂使用系统
10.1 药剂定义及分类
=====================================
药剂定义模板
=====================================
consumable_template:
  key: "药剂唯一标识"             # 如: "hp_potion_grade1"
  grade: 1                       # 药剂等级
  name: "药剂名称"
  description: "药剂描述"
  recovery: 70                   # 基础恢复量
  price: 10                     # 购买价格（金币）
  sell_price: 5                 # 出售价格（金币）
  grade_threshold: 1              # 解锁等级
  max_stack: 999                  # 堆叠上限

========== [可配置] 药品系统 ==========

consumables:
=====================================
生命药剂
=====================================
  health_potions:
    - key: "hp_potion_grade1"
      grade: 1
      name: "金创药（小）"
      description: "恢复70点生命值"
      recovery: 70
      price: 10                # 购买价格（金币）
      sell_price: 1           # 出售价格（金币，购入价的10%）
      grade_threshold: 1       # 1级后解锁
      max_stack: 999           # 背包最大叠加数量

    - key: "hp_potion_grade2"
      grade: 2
      name: "金创药（中）"
      description: "恢复160点生命值"
      recovery: 160
      price: 50               # 购买价格（金币）
      sell_price: 5           # 出售价格（金币，购入价的10%）
      grade_threshold: 36      # 36级后解锁
      max_stack: 999

    - key: "hp_potion_grade3"
      grade: 3
      name: "金创药（大）"
      description: "恢复300点生命值"
      recovery: 300
      price: 120              # 购买价格（金币）
      sell_price: 12          # 出售价格（金币，购入价的10%）
      grade_threshold: 61      # 61级后解锁
      max_stack: 999

=====================================
内功药剂（MP药剂）
=====================================
  mana_potions:
    - key: "mp_potion_grade1"
      grade: 1
      name: "人参"
      description: "恢复70点内功值"
      recovery: 70
      price: 10               # 购买价格（金币）
      sell_price: 1           # 出售价格（金币，购入价的10%）
      grade_threshold: 1
      max_stack: 999

    - key: "mp_potion_grade2"
      grade: 2
      name: "野山参"
      description: "恢复160点内功值"
      recovery: 160
      price: 50               # 购买价格（金币）
      sell_price: 5           # 出售价格（金币，购入价的10%）
      grade_threshold: 36
      max_stack: 999

    - key: "mp_potion_grade3"
      grade: 3
      name: "雪原参"
      description: "恢复320点内功值"
      recovery: 320
      price: 120              # 购买价格（金币）
      sell_price: 12          # 出售价格（金币，购入价的10%）
      grade_threshold: 61
      max_stack: 999

10.1.1 药剂实际恢复量计算公式
=====================================
药剂恢复量计算
=====================================
生命药剂实际恢复量 = 基础恢复量 × (1 + 治疗效果加成)
治疗效果加成由医师气功"体血倍增"提供，每级+1%
hp_actual_recovery = base_recovery * (1 + healBonus)

内功药剂实际恢复量 = 基础恢复量 × (1 + 内功恢复加成)
内功恢复加成由医师气功"运气行心"提供，每级+1%
mp_actual_recovery = base_recovery * (1 + mpRecoveryBonus)

示例：
- 无气功加成时，金创药（小）恢复70点生命值
- 有10级体血倍增（healBonus=0.10）时，金创药（小）恢复70*(1+0.10)=77点生命值
- 无气功加成时，人参恢复70点内功值
- 有10级运气行心（mpRecoveryBonus=0.10）时，人参恢复70*(1+0.10)=77点内功值

10.2 药剂使用限制
=====================================
等级使用限制
=====================================
药剂使用规则：等级达到门槛即可使用对应等级药剂
  usage_rules:
    grade_1: "level >= 1"      # 金创药（小）/ 人参：1级可用
    grade_2: "level > 35"       # 金创药（中）/ 野山参：36级以上可用
    grade_3: "level > 60"       # 金创药（大）/ 雪原参：61级以上可用
10.3 自动喝药与自动治疗武功（挂机模式）
=====================================
挂机模式状态机
=====================================
玩家通过"开始挂机"按钮进入 is_auto_play=true 状态；
自动喝药 / 自动治疗武功 仅在 is_auto_play=true 时生效。
  #
===== is_auto_play 清除规则表（v1.0 完整清单）=====
清挂机的操作（is_auto_play → false）：
1. 玩家点击「停止挂机」按钮
2. 玩家死亡（HP→0）—— 已在 6.1 player_death.step_3 硬编
3. 自动回城补给时金币不足 —— 已在 10.4 auto_resupply.gold_insufficient.check_after_purchase 硬编
4. 玩家切换 zone（点击主页"地图列表区"任意条目，包括野外↔野外、野外↔城、城↔野外）
—— 视为玩家主动重新选择挂机点，必须重新点「开始挂机」
例外：系统触发的 zone 切换不清挂机，包括：
- 自动回城补给（10.4 auto_resupply.return_action.step_1 / step_4 的 teleport_to / teleport_back）
- 玩家死亡复活（player_death.step_1 走 teleport_to(town_xuanbo)，但 step_3 已硬编 is_auto_play=false，无需走例外）
实现约定：teleport_system.teleport(sub_zone, source) 调用方必须传入 source 标记
source="player_click"  → 触发清挂机
source="auto_resupply" → 不清挂机
source="player_death"  → 不触发清挂机（is_auto_play 已被 player_death 流程清掉）
  #
不清挂机的操作（is_auto_play 保持 true）：
5.  换装备（穿/卸/换）
6.  强化装备
7.  合成石头
8.  学武功 / 加气功点 / 重置气功
9.  买/卖物品（商店）
10. 整理背包 / 仓库存取
11. 开盒子 / 手动喝药
12. 调整挂机面板阈值（如 hp_potion.threshold 滑块）—— 实时生效，无需重启挂机
  #
设计取舍：
- 只有"位置变更（切 zone）"和"系统级中断（死亡/金币耗尽/玩家主动停）"才清挂机
- 其他操作（5-12）都视为"挂机过程中的玩家维护行为"，不打断节奏
- 第 12 项玩家在战斗中拖滑块改阈值，下一个 100ms tick 立即生效，不重启战斗循环
- UI 实现注意：清挂机后必须主动刷新挂机按钮状态（从"停止挂机" → "开始挂机"），避免按钮态与 is_auto_play 不一致
  auto_play_state:
    is_auto_play: false               # 默认未挂机
    enter_trigger: "玩家点击「开始挂机」按钮"
    exit_triggers:                    # 见上方"清挂机规则表"4 项
      - "玩家点击「停止挂机」按钮"
      - "玩家死亡（HP→0；走 6.1 player_death）"
      - "自动回城补给金币不足（走 10.4 auto_resupply.gold_insufficient）"
      - "玩家切换 zone（点主页地图列表区任意条目）"

=====================================
自动喝药配置（挂机面板，玩家自定义）
=====================================
  auto_consume:
    enabled: true                     # 是否启用自动喝药（玩家挂机面板开关；默认 true）

    # 检查时机：每个战斗 tick（100ms）检查一次，独立于玩家行动（不抢占普攻/武功 cd）
    check_interval_ms: 100

    # HP 药剂槽位（玩家在挂机面板从背包中选 1 种 HP 药剂）
    hp_potion:
      enabled: true
      selected_item_key: null         # 玩家配置（如 "hp_potion_grade2"）；为 null 时不触发自动 HP 喝药
      threshold: 0.30                 # HP/maxHP 低于此百分比时触发；玩家可调，范围 [0.05, 0.95]，步进 0.05
      threshold_range: [0.05, 0.95]
      threshold_step: 0.05
      cooldown: 5000                  # 喝药冷却（毫秒，GM 可调），与战斗 tick 独立计时
      # 触发逻辑：
      #   if is_auto_play and selected_item_key is not None:
      #       if player.hp / player.maxHp <= threshold and (now - last_hp_potion_time) >= cooldown:
      #           if 背包.count(selected_item_key) > 0:
      #               consume(selected_item_key)        # 见 hp_potion_recovery 公式
      #               last_hp_potion_time = now
      #           else:
      #               # 药剂耗尽：本次跳过，不降级到其他药剂、不停挂机、不弹窗
      #               pass

    # MP 药剂槽位（玩家在挂机面板从背包中选 1 种 MP 药剂）
    mp_potion:
      enabled: true
      selected_item_key: null         # 玩家配置（如 "mp_potion_grade2"）；为 null 时不触发自动 MP 喝药
      threshold: 0.30                 # MP/maxMP 低于此百分比时触发；玩家可调，范围 [0.05, 0.95]，步进 0.05
      threshold_range: [0.05, 0.95]
      threshold_step: 0.05
      cooldown: 5000                  # 喝药冷却（毫秒），与 HP 药独立计时
      # 触发逻辑同 hp_potion，公式见 mp_potion_recovery

=====================================
自动治疗武功配置（挂机面板，玩家自定义；医师专属）
=====================================
与自动喝药互不依赖、各走各的 cd；玩家可同时开启或只开一个
触发逻辑不看血量，按武功自身 coolDown 硬循环施放
  auto_heal_skill:
    enabled: false                    # 默认关闭（非医师职业留空即可）
    selected_skill_key: null          # 玩家从已学的 heal 类武功中选 1 个（如 "staff_fury_heal"）
    # 触发逻辑：
    #   if is_auto_play and selected_skill_key is not None:
    #       skill = get_skill(selected_skill_key)         # 玩家已学武功
    #       if (now - last_cast_time) >= skill.coolDown:  # 读武功自身 coolDown 字段（默认 1000ms）
    #           if player.mp >= actual_mp_cost(skill):    # MP 充足才施放
    #               cast(skill, target=self)              # v1.0 单人挂机，目标固定为自己（含 AOE 类退化为自治）
    #               last_cast_time = now
    #           else:
    #               # MP 不足：本次跳过；建议玩家在挂机面板同时配 MP 自动喝药（mp_potion）补 MP
    #               pass

=====================================
加血药剂实际恢复量
=====================================
参见 6.2 hp_potion_recovery / mp_potion_recovery 公式
hp_actual_recovery = base_recovery * (1 + healBonus)   # healBonus 来自医师气功"体血倍增"
mp_actual_recovery = base_recovery * (1 + mpRecoveryBonus)  # mpRecoveryBonus 来自医师气功"运气行心"
10.4 回城补给规则
=====================================
回城补给配置
=====================================
设计：触发规则 与 购买规则 是两组独立配置，各自按 HP/MP 区分
4 条规则全部独立勾选生效（无总开关）；任意组合均合法
玩家在挂机面板可分别设置
  auto_resupply:

    # ===== 触发规则：什么时候回城 =====
    # 任一条已启用规则命中 → 触发完整回城补给流程
    trigger_rules:
      hp:
        enabled: false                     # 独立开关（玩家勾选）
        selected_potion: null              # 下拉：hp_potion_grade1 / grade2 / grade3 之一
        trigger_threshold: 5               # 选中药剂数量 < 此值 → 命中
      mp:
        enabled: false
        selected_potion: null              # 下拉：mp_potion_grade1 / grade2 / grade3 之一
        trigger_threshold: 5

    # ===== 购买规则：回城后买什么、买到多少 =====
    # 与触发规则完全独立：玩家可监控小药、回城却买大药；或只补 HP、不补 MP
    # 未启用的规则 → 回城后不购买对应类型药剂
    purchase_rules:
      hp:
        enabled: false                     # 独立开关
        selected_potion: null              # 下拉：hp_potion_grade1 / grade2 / grade3 之一
        target_quantity: 10                # 补到背包拥有此数量为止；玩家可配，默认 10
      mp:
        enabled: false
        selected_potion: null              # 下拉：mp_potion_grade1 / grade2 / grade3 之一
        target_quantity: 10

    # ===== 检查时机 =====
    check_logic: |
      # 每次喝药后 + 野外每 1s tick 检查一次
      triggered = false
      if trigger_rules.hp.enabled and trigger_rules.hp.selected_potion:
          if InventorySystem.count(player, trigger_rules.hp.selected_potion) < trigger_rules.hp.trigger_threshold:
              triggered = true
      if trigger_rules.mp.enabled and trigger_rules.mp.selected_potion:
          if InventorySystem.count(player, trigger_rules.mp.selected_potion) < trigger_rules.mp.trigger_threshold:
              triggered = true
      if triggered:
          execute(return_action)

    # ===== 回城流程 =====
    return_action:
      step_1: "teleport_to(town_xuanbo)"     # 经 teleport_system 传到唯一城镇
      step_2: "auto_full_recovery"           # 进城瞬间满 HP/MP（town.auto_full_restore 已配）
      step_3: "auto_buy_potions"             # 按 purchase_rules 执行（见 purchase_logic）
      step_4: "teleport_back"                # 传回 player.last_wilderness_sub_zone
      step_5: "resume_auto_play"             # 继续挂机（is_auto_play 保持 true）

    # ===== 购买逻辑 =====
    # 价格 = 药剂商店原价（与玩家手动购买完全一致，不加额外服务费）
    purchase_logic: |
      for rule in [purchase_rules.hp, purchase_rules.mp]:
          if not rule.enabled or rule.selected_potion is null:
              continue
          current = InventorySystem.count(player, rule.selected_potion)
          need = rule.target_quantity - current
          if need <= 0:
              continue   # 已达目标量，不买
          unit_price = shop.get_buy_price(rule.selected_potion)   # 与玩家手动买价一致
          affordable = min(need, floor(player.gold / unit_price))
          if affordable > 0:
              InventorySystem.add(player, rule.selected_potion, affordable)
              player.gold -= affordable * unit_price

    # ===== 金币不足处理 =====
    # 仅在"补给执行完后，已启用的触发规则仍然命中"时才停挂机
    # 这样玩家短期金币不足但很快能赚回来时不会被频繁打断
    gold_insufficient:
      check_after_purchase: |
        # step_3 完成后，立即重新跑一次 check_logic
        # 如果仍会触发 → 停挂机；否则正常 step_4 回原 sub_zone
        will_re_trigger = check_logic()
        if will_re_trigger:
            is_auto_play = false
            notify_player("金币不足以补充药剂，已停止挂机")
        else:
            continue_to_step_4()

    # ===== 边界情况 =====
    edge_cases:
      no_last_wilderness: "stay_in_town"     # last_wilderness_sub_zone 为 null（新角色没出过城）→ 留在城里
      teleport_disabled: "stop_auto_play"    # 未来若关闭传送（v2.0）→ 直接停挂机
10.5 药剂商店配置
=====================================
药剂商店配置
=====================================
  shop:
    # 城镇商店是否销售所有等级药剂
    sell_all_grades: false
    # 只有满足等级条件后才在商店显示该等级药剂

    # 购买时的最大持有量限制
    purchase_limit:
      single_transaction_max: 999   # 单次购买最多999个
      daily_purchase_limit: -1    # 每日购买上限（-1表示无限制）

