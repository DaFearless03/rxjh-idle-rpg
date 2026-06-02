6. 战斗系统
6.1 战斗流程

========== 战斗流程定义 ==========

battle_flow:
==============================
战斗模型（v1.0）
==============================
1v N：玩家单兵 vs 同一 zone 内多只怪
zone：野外 sub_zone（如 xuanbo_field、liushan_snake_valley），战斗发生在 sub_zone 范围内
  battle_model:
    type: "1vN"
    same_zone_monster_cap: 8        # 同 zone 同时存在怪物上限
    elite_cap_per_zone: 1           # 同 zone 同时最多 1 只精英怪
    attacker_slot_limit: null       # 不限制攻击位：场上所有存活怪都独立攻击玩家
    monster_spawn:
      # 进入 zone 第 0 秒 → 立即刷出 1 只
      # 之后全局每秒 tick 检查：若当前怪数 < 8 且场上精英满足 elite_cap，则按权重抽 1 只补位
      # 玩家切 zone → 当前 zone 清场，回来时从 0 重新刷
      initial_spawn_count: 1
      spawn_interval_seconds: 1
      clear_on_zone_change: true
      preheat_seconds: 2            # 新刷出的怪 2 秒预热宽限，预热期间不攻击玩家，给玩家 AOE 清场/切场喘息窗口
      # 怪物刷新池权重规则：
      #   按 sub_zone.monsters 列表抽签；每只怪的归类（normal / elite / boss）由其 monster_type 决定
      #   普通怪物之间权重相等（同 normal 的 N 只怪各占 1/N）
      #   精英怪 : 普通怪 = 1 : 50（精英整体权重相对普通整体权重 = 1:50）
      #   若场上已有 elite_cap_per_zone 只精英 → 精英不再参与抽签，本次仅在普通怪池中按等权抽
      #   v1.0 boss 不参与刷怪流程（boss 由特定关卡/任务触发，不进 sub_zone 刷怪池）
      spawn_weight:
        normal_vs_normal: 1
        elite_vs_normal: "1:50"
      # 实现示例（以 xuanbo_field 为例，假设 monsters: [fox(normal), wild_bull(normal), wild_boar(normal)]）：
      #   场上当前 0 只精英、3 只普通可抽
      #   有效池 = [fox: 1, wild_bull: 1, wild_boar: 1]
      #   总权重 = 3，各 1/3 概率
      # 实现示例（xuanbo_den: monsters [gray_wolf(normal), bear(normal), gray_wolf_king(elite)]）：
      #   场上 0 只精英 → 有效池 = [gray_wolf: 50, bear: 50, gray_wolf_king: 1]，总权重 101
      #     gray_wolf 49.5%、bear 49.5%、gray_wolf_king 0.99%
      #   场上 1 只精英已满 → 有效池 = [gray_wolf: 1, bear: 1]，gray_wolf_king 被剔除，各 50%
    monster_attack:
      # 每只怪独立攻速，固定 1 秒攻 1 次（独立计时；新刷出的怪 2 秒预热后开始首击）
      atk_interval_ms: 1000
      independent_cooldown: true
      # 不限攻击位：所有非预热期的存活怪都会按自身 cd 攻击玩家
      # 设计取舍：玩家承担"打同级 N 只怪秒杀"的风险，需通过升装备或主动选低级 zone 来调节
    target_lock:
      # 目标锁定（普攻 / 单体武功 / AOE 共用同一个"当前主目标"指针）
      strategy: "lowest_hp_enemy"   # 选血最少的活怪
      sticky_until_dead: true       # 主目标活着时所有攻击都打它；死后重选
      shared_across_attack_types: true   # 普攻、单体武功、AOE 共用主目标指针
      # AOE 副目标选择（见下方 aoe_resolution）

==============================
AOE 武功结算规则
==============================
  aoe_resolution:
    cast_mode: "instant"            # 瞬发：一次释放对所有目标同帧结算
    main_target_strategy: "lowest_hp_enemy"   # 主目标 = 血最少的存活怪
    sub_target_strategy: "random_excluding_main"  # 副目标 = 在主目标以外的存活怪中完全随机抽 target_count - 1 只
    sub_target_count_rule: |
      # 副目标数量 = skill.effect.target_count - 1（主目标占 1 个）
      # 若场上存活怪数 >= target_count → 正常 AOE
      # 若场上存活怪数 <  target_count → 退化：只对场上所有存活怪结算（威力不变）
    main_target_lock: |
      # 主目标活着时，连续多次释放 AOE 都打同一主目标
      # 副目标每次释放重新随机抽
      # 单次释放期间（瞬发结算），副目标已锁定到 4 个怪上，不再因死亡补位
      # 主目标死亡后，下一次释放 AOE 时按 lowest_hp_enemy 重选主目标 + 全重选副目标
    newly_spawned_monster: |
      # 新刷出的怪通过 2 秒预热后进入"副目标候选池"
      # 是否参与下一次 AOE 的副目标随机：是
      # 不会在当前 AOE 释放后立即补位（瞬发结算已完成）

==============================
玩家死亡惩罚
==============================
  player_death:
    # v1.0 唯一城镇就是 town_xuanbo；未来若加更多城，本字段改为"最近曾激活的城镇"
    location: "town_xuanbo"
    respawn_action:
      step_1: "teleport_to(town_xuanbo)"   # 通过 teleport_system 强制传回唯一城镇
      step_2: "hp_mp_full_restore"          # 与城镇 auto_full_restore 一致
      step_3: "is_auto_play = false"        # 死亡强制停挂机，玩家需手动重新开启
    hp_mp_after_respawn: "full"
    exp_loss_formula: |
      # 每次死亡损失"当前等级升到下一级所需经验"的 1%
      loss = floor(exp_to_next_level[player.level] * 0.01)
      # 防止掉级：若玩家当前已积累的经验不足以扣除，则不扣（不掉级）
      if player.exp < loss:
          loss = 0
      player.exp = max(0, player.exp - loss)
    item_drop_on_death: false       # 死亡不掉装备、不掉物品、不掉金币
    quest_progress_preserved: true  # 任务进度全部保留：current_stage / completed_stages / progress / 已收任务物品都不变
                                    # 玩家复活后回城，可继续推进当前 stage（与"不掉物品"一致的玩家友好设计）

==============================
战斗中传送（v1.0）
==============================
玩家在战斗中点击主页面"地图列表区"任意 sub_zone → 触发 teleport_system.in_combat_behavior = "instant_exit"
处理流程：
1. 当前 zone 内所有怪物清空（视为玩家撤退，不算击杀）
2. 玩家 HP/MP 保持当前值（不回满；想回满请去城镇 auto_full_restore）
3. 不结算任何掉落 / 经验 / 金币
4. 不触发 player_death 流程
5. 进入目标 sub_zone 后，从第 0 秒开始正常刷怪（含 2 秒预热）
  in_combat_teleport:
    enabled: true
    behavior: "instant_exit"
    preserve_hp_mp: true
    settle_rewards: false
    trigger_player_death: false

战斗初始化
  init:
    - 加载战斗单位数据
    - 计算最终属性（基础+装备+Buff）
    - 生成技能队列
    - 设置战斗时长限制

战斗循环
  battle_loop:
    interval: 100              # 战斗tick间隔（毫秒）
    steps:
      - 检查战斗结束条件
      - 更新Buff持续时间
        # 计算辅助武功实际持续时间
        # final_buffDuration = baseBuffDuration + player.buffDuration
        # 单位统一为 ms（Buff duration 字段、player.buffDuration、气功 value_per_level 全部用 ms）
        # buffDuration 来自医师气功"吸星大法"，每级 +15000 ms（=15s）
      - 触发Buff效果（DOT/HOT）
      - 怪物刷新检查
        # 每 spawn_interval_seconds 检查一次
        # if 当前 zone 怪数 < same_zone_monster_cap:
        #     按 spawn_weight 抽 1 只，标记 preheat_remaining = preheat_seconds
        # 新刷怪在 preheat_seconds 内不攻击玩家
      - 执行玩家行动
        # 单位行动逻辑
        - 锁定主目标（target_lock.strategy；活着不切）
        - 选择本次行动类型（普攻 / 单体武功 / AOE 武功，依 auto_battle.skill_priority）
        - 若是 AOE：按 aoe_resolution 选副目标
        - 检查技能冷却
        - 检查内功是否充足（考虑mpCostReduce）
          # actual_mp_cost = skill_base_mp_cost * (1 - player.mpCostReduce)
          # 如果 player.mp >= actual_mp_cost，执行技能
        - 对每个目标走 attack_resolution_pipeline（见 6.2）
        - 更新HP/MP（使用skill_mp_cost公式计算实际内功消耗）
      - 执行每只非预热怪的行动
        # 怪物按各自 atk_interval_ms 独立 cd
        # 每只活怪到 cd 时对玩家发起一次普攻，走 attack_resolution_pipeline
      - 触发死亡事件
        # 怪死亡：从场上移除，下一个 spawn_interval tick 走刷怪流程补位
        # 玩家死亡：按 player_death 规则执行（扣经验、回城镇、不掉物）

战斗结束
  end:
    conditions:
      - all_enemies_dead: "win"     # v1.0 实际不会走该分支（zone 持续刷怪），保留给"爬塔"等关卡型玩法
      - player_dead: "lose"          # 触发 player_death 流程
      - time_limit_reached: "lose"
    rewards:
      win: "计算经验、金币、掉落"
      lose: "无奖励（但 player_death 仍按规则扣经验）"

自动战斗逻辑
  auto_battle:
    skill_priority: "highest_damage_first"    # 技能优先级（每次行动选可释放武功中预期伤害最高的）
    target_selection: "lowest_hp_enemy"        # 目标选择，与 target_lock.strategy 一致
    resource_management: "reserve_mp_for_heal" # 资源管理（医师保留 MP 用于群体治疗自己）
    # 注：实际目标锁定走 target_lock（活着不切；普攻/单体武功/AOE 共用主目标指针）
    # 注：AOE 武功的副目标选择走 aoe_resolution
    # 注：自动喝药 / 自动治疗武功 仅在 is_auto_play=true 时触发，配置见 10.3 auto_consume / auto_heal_skill

6.2 伤害计算公式

========== [可配置] 战斗常量 ==========
设计取舍：以下常量曾分别硬编在战斗公式 和 对应气功 effect 中（两处真值），
v1.0 起统一收纳到 combat_constants，公式与气功配置都从这里读，单点修改。
引用方式：在伪代码中直接写 combat_constants.xxx；气功 effect 不再重复声明这些副参数。
combat_constants:
  armorBreakDefReduce: 0.20      # 破甲触发时：减少目标 def/mdef 的比例（来源气功"霸气破甲"）
  counterDamageRate: 1.0          # 反伤比例：反弹给攻击者的伤害 = actualDmg × 此系数（来源气功"四两千金"）
  comboHits: 3                     # 连击触发后的攻击次数（来源气功"连环飞舞"）
  leechRate: 0.20                  # 生命汲取触发时：回血量 = actualDmg × 此系数（来源气功"移花接木"）
  skillCritDamageBonus: 0.50     # 真武绝击触发时：当次武功伤害额外增加比例（来源气功"真武绝击"）
  shieldDamageReduceRate: 0.5    # 护身触发时：减免比例（来源气功"护身罡气"；shieldRate 概率走玩家面板）

========== [可配置] 伤害公式 ==========

damage_formulas:
==============================
判定顺序与叠乘规则（适用于所有伤害公式）
==============================
一次攻击的完整结算流程，按以下顺序进行：
1. hit_check          → miss 直接 damage=0，跳过后续所有判定
2. 伤害计算            → normal_attack_damage 或 skill_damage（含暴击、连击、破甲、真武绝击、武功防御减免）
产出：finalDmg（即原始最终伤害，未经 shield 减伤）
3. shieldRate_check  → 守方按 shieldRate 概率减伤 50%
产出：actualDmg（实际承受的最终伤害；未触发护身时 actualDmg = finalDmg）
4. apply_leech         → 攻方按 leech 概率回血，回血量基于 actualDmg（即"实际造成的伤害"，已扣 shield 减伤）
5. counterDamage_check → 守方按 counterDamage 反弹伤害给攻方（按 actualDmg × counterDamageRate）
  #
叠乘规则：
- shieldRate 与暴击/破甲/真武绝击均独立判定，可同时触发，效果按顺序叠乘
- leech 汲取量按 actualDmg 计算（被护身减半后实际造成的伤害），保证"汲取 = 实际造成的伤害的固定比例"
- 反伤伤害走"actualDmg × counterDamageRate"，不再触发新的 hit_check / leech / counter（避免无限循环）
  #
互斥规则：
- 普通攻击走 critical_hit（critR/critB），不走 skillCritRate
- 武功走 skillCritRate（真武绝击），不走 critical_hit
- 连击与暴击互斥：触发连击时不再判暴击，三段共享同一 baseDmg
  #
浮动规则：
- v1.0 不引入任何 finalDmg 浮动（random(0.x, 1.x)）；玩家攻击力 [atkMin, atkMax] 区间随机已是天然小幅波动
- 单次普攻/武功的 finalDmg 完全由公式决定（取整保底 max(1, floor(...))），便于数值平衡和战斗日志可读

==============================
命中率判定（优先于一切伤害计算）
==============================
  hit_check: |
    # 双方均无命中/闪避属性时（如怪物未配置 hit/missing）按必中处理，避免除零
    denom = attacker.hit + target.missing
    if denom <= 0:
        actualHitRate = 1.0
    else:
        actualHitRate = attacker.hit / denom
    # 上下限保护：保留 5% 必中 / 95% 上限，防止极端堆叠让一边倒
    # 5% 下限：玩家堆寒玉石把怪命中拉到极低时，仍能至少打中 5% 攻击，避免"怪永远打不中玩家"
    # 95% 上限：高级怪打低级玩家（或后期玩家漏 dex）时，玩家仍有 5% 闪避机会
    actualHitRate = clamp(actualHitRate, 0.05, 0.95)
    if random() > actualHitRate:
        damage = 0
        is_miss = true
    # 命中率 = 攻击方命中 / (攻击方命中 + 防御方闪避)
    # 双方身法越高、等级越高（levelToHit/levelToMissing），命中与闪避双线增长
    # 怪物 hit / missing 由怪物自身配置（见 monster_template 公式），不走玩家的 dex/level 公式

==============================
普通攻击伤害
==============================
攻击力规则：
- 玩家：atk 从 [atkMin, atkMax] 区间随机取值（atk 区间已是天然"小幅波动"，无需额外浮动）
- 怪物：atk 直接取 attacker.atk 固定值
v1.0 不引入伤害浮动（finalDmg 直接由公式结果取整保底，无 random(0.x, 1.x) 后乘）
  normal_attack_damage: |
    # 从攻击力字段取本次攻击力（按 attacker 类型分支）
    if attacker is monster:
        atk = attacker.atk
    else:
        atk = random(attacker.atkMin, attacker.atkMax)
    # 破甲效果：仅对当次攻击生效，使用临时防御力计算
    # 怪物 armorBreak 未配置时按 0 处理（fallback）
    effective_def = target.def
    effective_mdef = target.mdef
    if random() < (attacker.armorBreak ?? 0):
        effective_def = target.def * (1 - combat_constants.armorBreakDefReduce)   # 减少目标防御力
        effective_mdef = target.mdef * (1 - combat_constants.armorBreakDefReduce) # 同时减少目标武功防御力
        is_armor_broken = true
    baseDmg = max(1, atk - effective_def)

    # 连击判定（先判，触发后跳过暴击 —— 连击与暴击互斥）
    # 仅玩家参与连击：v1.0 怪物 combo 字段恒为 0，不触发连击；如果未来想让怪物连击，需给怪物模板补 combo 字段
    if attacker is player and random() < attacker.combo:
        is_combo = true
        # v1.0 简化：连击的每段直接结算 hp，不走 shieldRate / leech / counter 流程
        #   （未来若想让连击也走完整流程，需把每段 hit_dmg 收集到列表后交战斗循环统一处理）
        # 连击段数共享同一 baseDmg（沿用首击判定，包含 effective_def），无浮动、无暴击
        for i in range(combat_constants.comboHits):
            hit_dmg = max(1, floor(baseDmg))
            target.hp = target.hp - hit_dmg
        return  # 连击已完成伤害计算，直接返回

    # 暴击判定（连击未触发时才判 —— 与连击互斥）
    # 玩家：critR 来自属性面板（默认 0.30，可被装备/Buff 修改）
    # 怪物：critR 来自怪物配置；未配置 → fallback 0.25（与 monster_template 一致）
    # 怪物：critB 来自怪物配置；未配置 → fallback 1.5
    crit_rate = attacker.critR ?? 0.25
    crit_bonus = attacker.critB ?? 1.5
    if random() < crit_rate:
        baseDmg = baseDmg * crit_bonus
        is_crit = true

    # 单击伤害固定（玩家/怪物无差异，均无浮动）
    finalDmg = max(1, floor(baseDmg))
    return finalDmg
    # finalDmg 返回给战斗结算流程，后续按"判定顺序与叠乘规则"统一走：
    #   shieldRate_check → apply_leech → counterDamage_check → target.hp -= actualDmg
    # combo: 连击几率（来自气功连环飞舞，每级+1%；仅玩家）
    # critR / critB: 暴击率 / 暴击伤害倍率（玩家走属性面板，怪物走模板字段）
    # armorBreak: 破甲几率（来自气功霸气破甲，每级+1%）
    # armorBreakDefReduce: 破甲效果默认减少 20% 防御力（见 combat_constants）

==============================
武功（技能）伤害
==============================
攻击力规则同普通攻击：
- 玩家：atk 从 [atkMin, atkMax] 区间随机
- 怪物：atk 直接取 attacker.atk 固定值（v1.0 怪物无武功，本分支主要为玩家保留）
v1.0 不引入伤害浮动（玩家与怪物 finalDmg 均直接由公式结果取整保底）
  #
伤害结构（三层叠加）：
1) basePart       — 物理基础部分：受 str/装备 atk/敌 def 影响
2) matkPart       — 武功攻击力部分：受武器 atkMax/金刚石 weaponSkillBonus 影响
3) weaponBonus    — 固定附加部分：武功自带 effect.value + 武器追加伤害（金刚石 weaponExtraDamageAdd）
三层之和 → 武功防御减免 → 真武绝击 → 取整保底
  skill_damage: |
    # v1.0 死代码注意：所有怪物 skills:[]、不释放武功 → 本函数 attacker 永远是 player；
    #                  if attacker is monster 分支为 v2.0 怪物武功上线预留，v1.0 不会走到。
    # 从攻击力字段取本次攻击力（按 attacker 类型分支）
    if attacker is monster:
        atk = attacker.atk
    else:
        atk = random(attacker.atkMin, attacker.atkMax)
    # 破甲效果：仅对当次攻击生效，使用临时防御力计算
    # 怪物 armorBreak 未配置时按 0 处理（fallback）
    effective_def = target.def
    effective_mdef = target.mdef
    if random() < (attacker.armorBreak ?? 0):
        effective_def = target.def * (1 - combat_constants.armorBreakDefReduce)   # 减少目标防御力
        effective_mdef = target.mdef * (1 - combat_constants.armorBreakDefReduce) # 同时减少目标武功防御力
        is_armor_broken = true
    # 三层伤害：
    # 1) 物理基础部分（与普攻共享 atk-def 通道，但带 ×1.5 武功放大）
    basePart = max(1, atk - effective_def) * 1.5
    # 2) 武功攻击力部分（matk 来自武器 atkMax × matk_weapon_ratio；金刚石词条做百分比加成）
    matkPart = attacker.matk * (1 + attacker.weaponSkillBonus / 100)
    # 3) 固定附加部分（武功自带 effect.value + 武器追加伤害固定数）
    #    skill.effect.value 取自当前释放武功的 effect.value 字段（不同武功威力差异化的关键）
    weaponBonus = skill.effect.value + attacker.weaponExtraDamage
    skillDmg = basePart + matkPart + weaponBonus
    # 武功防御力减免
    # v1.0 预留：怪物 mdef=0 → effective_mdef=0 → 减免系数恒为 100/100=1.0（公式空转）；
    #            v2.0 怪物配置 mdef 后自动生效，无需改公式。
    skillDmg = skillDmg * (100 / (100 + effective_mdef))
    # 真武绝击判定（仅武功触发；AOE 武功也只判一次，触发后对所有目标的 skillDmg 一并 ×(1+加成)）
    if random() < attacker.skillCritRate:
        skillDmg = skillDmg * (1 + combat_constants.skillCritDamageBonus)
        is_skill_crit = true
    # 伤害取整保底（无浮动）
    finalDmg = max(1, floor(skillDmg))
    return finalDmg
    # finalDmg 返回给战斗结算流程，AOE 武功对每个目标独立返回 finalDmg；
    # 后续按"判定顺序与叠乘规则"统一走：shieldRate_check → apply_leech → counterDamage_check → target.hp -= actualDmg
    # skillCritRate: 真武绝击几率（来自刀客气功真武绝击，每级+1%）
    # skillCritDamageBonus: 触发真武绝击时的伤害加成（见 combat_constants，默认 0.50 = +50%）
    # armorBreak: 破甲几率（来自气功霸气破甲，每级+1%）

    # 参数说明：
    # attacker.atkMin/atkMax:        玩家最小/最大攻击力（实战取随机值；见 2.1 atkMin/atkMax 公式）
    # attacker.atk:                  怪物固定攻击力
    # attacker.matk:                 攻击方武功攻击力 = 已装备武器.atkMax × matk_weapon_ratio
    #                                未装备武器时 matk = 0（matkPart 自然为 0）
    # attacker.weaponSkillBonus:   武器合成金刚石带来的武功加成百分比（sum(weaponSkillBonusAdd)）
    # attacker.weaponExtraDamage:  武器追加伤害（固定值，来自金刚石 weaponExtraDamageAdd 词条）
    # skill.effect.value:            当前释放武功的固定附加伤害（damage 类武功的差异化主要靠这一项）
    # target.def / target.mdef:      防御方物理防御 / 武功防御

    # ==============================
    # 示例（L60 枪客对同级怪）：
    #   武器 spear_t3_*_003 atkMax=216，强化+6 → 216+36=252
    #   matk = 252 × 1.0 = 252
    #   weaponSkillBonus = 4 颗 23% 金刚石 = 92
    #   atk 中位 ≈ 395，怪 def = 275，武功 effect.value = 150
    #   basePart = max(1, 395-275) × 1.5 = 180
    #   matkPart = 252 × 1.92 ≈ 484
    #   weaponBonus = 150 + 0 = 150
    #   skillDmg ≈ 814（无浮动，直接取整）
    # ==============================

==============================
闪避判定
==============================
  evasion: |
    # 闪避已合并到 hit_check 中（见上方）
    # 实际闪避概率 = 1 - actualHitRate = 1 - clamp(attacker.hit / (attacker.hit + target.missing), 0.05, 0.95)
    # 因 clamp 上下限保护，玩家闪避率上限 95%、下限 5%；不会出现 100% 必躲或 0% 永远被打中
    # 当 attacker.hit + target.missing == 0 时按必中处理（actualHitRate = 1.0），避免除零

==============================
一次攻击的统一结算 pipeline
==============================
入口：战斗循环（6.1 battle_loop）在一次攻击事件中按以下顺序调用各组件
普攻 / 单体武功 / AOE 武功（对每个目标分别走一次 pipeline）共用同一流程
  attack_resolution_pipeline: |
    # 0. hit_check：若 miss，actualDmg = 0，跳过 1~4，直接结束
    if not hit_check(attacker, target):
        log(is_miss=true)
        return
    # 1. 计算原始伤害 finalDmg
    if attack_type == "normal":
        finalDmg = normal_attack_damage(attacker, target)
    else:  # attack_type == "skill"
        finalDmg = skill_damage(attacker, target, skill)
    # 2. 护身减伤（守方）；怪物 shieldRate 未配置时按 0 处理（fallback）
    actualDmg = finalDmg
    if random() < (target.shieldRate ?? 0):
        actualDmg = floor(actualDmg * (1 - combat_constants.shieldDamageReduceRate))
        is_shielded = true
    # 3. 生命汲取（攻方）：基于实际造成的伤害汲取；怪物 leech 未配置时按 0 处理（fallback）
    leech_chance = attacker.leech ?? 0
    if leech_chance > 0 and random() < leech_chance:
        heal_amount = floor(actualDmg * combat_constants.leechRate)
        attacker.hp = min(attacker.hp + heal_amount, attacker.maxHp)
        is_leech_triggered = true
    # 4. 守方扣血
    target.hp = max(0, target.hp - actualDmg)
    # 5. 反伤（守方反击给攻方）：基于 actualDmg；不再触发新一轮 hit_check/leech/counter
    # 怪物 counterDamage 未配置时按 0 处理（fallback）
    if random() < (target.counterDamage ?? 0):
        reflected = floor(actualDmg * combat_constants.counterDamageRate)
        attacker.hp = max(0, attacker.hp - reflected)
        is_countered = true
    # 注：连击的每段在 normal_attack_damage 内部已直接扣血，不走本 pipeline
    #     （v1.0 简化设计；如需让连击也走 pipeline，需重构 normal_attack_damage 返回 hit_dmg 列表）

==============================
护身减伤判定
==============================
  shieldRate_check: |
    # 此组件被 attack_resolution_pipeline 调用（见上方步骤 2），不单独触发
    # 怪物 shieldRate 未配置时按 0 处理（fallback）
    if random() < (target.shieldRate ?? 0):
        damage = floor(damage * (1 - combat_constants.shieldDamageReduceRate))
        is_shielded = true
    # shieldRate: 护身几率（来自剑客气功护身罡气，每级+1%）
    # shieldDamageReduceRate: 触发时的减免比例（见 combat_constants）

==============================
反伤判定
==============================
触发位置：attack_resolution_pipeline 步骤 5（在 leech 之后，扣血之后）
入参 damage = actualDmg（已被护身减半后的实际承受伤害）
反伤造成的伤害不再触发新一轮 hit_check / shield / leech / counter（避免无限循环）
  counterDamage_check: |
    # 怪物 counterDamage 未配置时按 0 处理（fallback）
    if random() < (target.counterDamage ?? 0):
        reflected_damage = floor(damage * combat_constants.counterDamageRate)
        attacker.hp = max(0, attacker.hp - reflected_damage)
        is_countered = true
    # counterDamage: 反伤几率（来自气功四两千金，每级+1%）
    # counterDamageRate: 反伤比例（见 combat_constants，默认 1.0 = 100%）

==============================
生命汲取判定
==============================
触发位置：attack_resolution_pipeline 步骤 3（在 shieldRate_check 减伤之后）
入参 dmg = actualDmg（即被护身减半后的实际承受伤害；未触发护身时 actualDmg = finalDmg）
AOE 武功：每个目标走一次 pipeline，独立判定 leech
连击：v1.0 简化，连击的每段在 normal_attack_damage 内部直接结算，不走 pipeline、不触发 leech
反伤：counter 反弹的伤害不再触发 leech（避免反伤回血循环）
  leech_check: |
    # 伪函数：apply_leech(attacker, dmg)
    # 其中 dmg = actualDmg（pipeline 中已经 shield 减伤后的实际承受伤害）
    # 怪物 leech 未配置时按 0 处理（fallback）
    leech_chance = attacker.leech ?? 0
    if leech_chance > 0 and random() < leech_chance:
        heal_amount = floor(dmg * combat_constants.leechRate)
        attacker.hp = min(attacker.hp + heal_amount, attacker.maxHp)
        is_leech_triggered = true
    # attacker.leech: 生命汲取触发几率（来自剑客气功移花接木，每级+0.4%；可被热血石"<技能>等级+1"叠加）
    # leechRate:    每次汲取的回血比例（见 combat_constants，默认 0.20 = 20%）
    # 实战示例：剑客投满 20 点移花接木 → leech = 0 + 20×0.004 = 0.08（8% 触发几率）
    #          单次武功原始 800 伤害，未触发护身 → actualDmg=800 → 触发汲取时回血 floor(800 × 0.20) = 160
    #          若同时触发护身 → actualDmg=400 → 触发汲取时回血 floor(400 × 0.20) = 80

==============================
暴击 / 真武绝击说明（公式已合并）
==============================
普通攻击暴击（critR/critB）：已合并到 normal_attack_damage 末尾的"暴击判定"段
触发条件：连击未触发（连击与暴击互斥）
玩家：critR 默认 0.30（base_attributes.critR），critB 默认 1.5
怪物：critR 默认 0.25（monster_template.critR），critB 默认 1.5；每次普攻独立判定
武功暴击（skillCritRate / skillCritDamageBonus）：已合并到 skill_damage 末尾的"真武绝击判定"段
仅玩家武功触发；AOE 武功一次释放只判一次（触发后所有目标的 skillDmg 一并 ×(1+加成)）

==============================
生命药剂恢复量计算
==============================
  hp_potion_recovery: |
    # 生命药剂实际恢复量 = 基础恢复量 × (1 + 治疗效果加成)
    # 治疗效果加成由医师气功"体血倍增"提供，每级+1%
    actual_hp_recovery = potion_base_recovery * (1 + player.healBonus)
    player.hp = min(player.hp + actual_hp_recovery, player.maxHp)
    # healBonus: 治疗效果（基础0%，来自医师气功体血倍增）

==============================
内功药剂恢复量计算
==============================
  mp_potion_recovery: |
    # 内功药剂实际恢复量 = 基础恢复量 × (1 + 内功恢复加成)
    # 内功恢复加成由医师气功"运气行心"提供，每级+1%
    actual_mp_recovery = potion_base_recovery * (1 + player.mpRecoveryBonus)
    player.mp = min(player.mp + actual_mp_recovery, player.maxMp)
    # mpRecoveryBonus: 内功恢复加成（基础0%，来自医师气功运气行心）

==============================
武功内功消耗计算
==============================
  skill_mp_cost: |
    # 武功实际消耗内功 = 武功基础消耗内功 × (1 - 内力消耗减少)
    # 内力消耗减少由医师气功"太极心法"提供，每级+1%
    actual_mp_cost = skill_base_mp_cost * (1 - player.mpCostReduce)
    player.mp = player.mp - actual_mp_cost
    # mpCostReduce: 内力消耗减少（基础0%，来自医师气功太极心法）

6.3 战斗状态管理

========== 战斗单位状态 ==========

unit_state:
基础状态
  hp:                         # 当前生命值
  maxHp:                      # 最大生命值
  mp:                         # 当前法力值
  maxMp:                      # 最大法力值

战斗状态
  buffs: []                   # 当前Buff列表
  cooldowns: {}               # 技能冷却状态
  casting: null               # 正在施放的技能
  stunned: false              # 是否眩晕
  silenced: false             # 是否沉默

目标
  target: null                # 当前目标
  threat: {}                  # 仇恨列表



---

