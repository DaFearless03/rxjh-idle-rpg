8. 地图系统
8.1 地图定义

========== [可配置] 地图定义 ==========
地图分为城镇、野外、爬塔三类
城镇：玩家补给和交互中心，自动恢复满生命和内功
野外：怪物分布区域，战斗后不自动恢复
野外 sub_zone 即战斗模型中的"zone"，刷怪上限 8 只、独立攻速等规则见 6.1 battle_model
sub_zone.monsters 列表中各怪的 normal/elite/boss 分类由其 monster_type 字段决定，
影响刷怪权重（normal 之间等权；elite vs normal = 1:50；boss v1.0 不进刷怪池）
爬塔：v1.0不涉及

maps:
========== 城镇地图 ==========
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
    - key: "bloodthirsty_wolf"
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
    # v1.0 高等级探索区域（L68-75），不设入口门槛；
    # 玩家可自由进入，但 v1.0 等级上限 60，遇 L68+ 怪物难以战胜，预期被打回后退出
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
        # v2.0 待补怪物实例；v1.0 运行时遇到 monsters: [] 的 sub_zone 应跳过刷怪，
        # 玩家进入后展示"此区域暂无敌人"提示，可直接退出
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


========== [可配置] NPC配置 ==========
NPC类型：shop（商店）、quest（任务）、enhance（强化）
商店NPC需要配置商品列表和价格倍率

===== NPC 对话状态（UIState，运行时不存档）=====
UIState.active_npc：玩家当前正在交互的 NPC 对象引用（含 npc_key / type / 关联数据等）
- open_dialog(npc) 时赋值：UIState.active_npc = npc
- close_dialog() 时清空：UIState.active_npc = null
- 玩家在城镇中点击任意 NPC 触发 open_dialog；点关闭按钮 / ESC / 切场景触发 close_dialog
- 仅运行时存在（不进存档，与"战斗现场不存档"同源原则）
- 被 submit_quest 等"必须在某 NPC 处操作"的函数读取做校验：
if UIState.active_npc is None or UIState.active_npc.npc_key != "quest_npc": return error(...)
- 任意切场景 / 角色切换 / 死亡复活 都强制 close_dialog → UIState.active_npc = null
#
===== NPC 分布约束（v1.0）=====
- v1.0 NPC 仅存在于城镇 sub_zone（town_xuanbo），野外 sub_zone 与战斗场景 0 NPC
- 野外 / 战斗中 UIState.active_npc 恒为 null；submit_quest / 商店 / 强化 / 仓库等需 NPC 的函数在野外调用必返 error
- GM 面板传送到野外时同样满足上述约束（GM 不能在野外提交任务）
- 玩家走 teleport_system 离开城镇 → 必触发 close_dialog → UIState.active_npc 置 null（与"切场景"同源）

npc_templates:
武器商人 + 强化（刀剑笑）
  shop_weapon_and_enhance:
    name: "刀剑笑"
    type: "shop_and_enhance"        # 商店+强化NPC，细节由强化系统规则控制
    shop_type: "weapon"
    # v1.0 商品政策：商店只卖 base 段武器；t1/t2/t3 武器只能通过打怪/任务获得（对应 equipments.purchaseable=false）
    items:
      # 刀客武器（base）
      - item_key: "blade_base_001"
        name: "直刀"
        buy_price: 100
      - item_key: "blade_base_002"
        name: "铁刀"
        buy_price: 200
      # 剑客武器（base）
      - item_key: "sword_base_001"
        name: "木剑"
        buy_price: 100
      - item_key: "sword_base_002"
        name: "重剑"
        buy_price: 200
      # 杖客武器（base）
      - item_key: "staff_base_001"
        name: "木杖"
        buy_price: 100
      - item_key: "staff_base_002"
        name: "桃木杖"
        buy_price: 200
      # 枪客武器（base）
      - item_key: "spear_base_001"
        name: "木枪"
        buy_price: 100
      - item_key: "spear_base_002"
        name: "长枪"
        buy_price: 200
    price_multiplier: 1.0

  shop_armor:
    name: "银娇龙"
    type: "shop"
    shop_type: "chest"
    items:
      # 衣服（base阶段，5职业×3件=15件）
      - item_key: "blade_chest_base_001"
        name: "无名战袍"
        buy_price: 100
      - item_key: "blade_chest_base_002"
        name: "金丝战袍"
        buy_price: 150
      - item_key: "blade_chest_base_003"
        name: "乌蚕战袍"
        buy_price: 200
      - item_key: "sword_chest_base_001"
        name: "无名侠衣"
        buy_price: 100
      - item_key: "sword_chest_base_002"
        name: "金丝侠衣"
        buy_price: 150
      - item_key: "sword_chest_base_003"
        name: "乌蚕侠衣"
        buy_price: 200
      - item_key: "staff_chest_base_001"
        name: "无名法袍"
        buy_price: 100
      - item_key: "staff_chest_base_002"
        name: "金丝法袍"
        buy_price: 150
      - item_key: "staff_chest_base_003"
        name: "乌蚕法袍"
        buy_price: 200
      - item_key: "spear_chest_base_001"
        name: "无名枪衣"
        buy_price: 100
      - item_key: "spear_chest_base_002"
        name: "金丝枪衣"
        buy_price: 150
      - item_key: "spear_chest_base_003"
        name: "乌蚕枪衣"
        buy_price: 200
      # 护手（base阶段，4件）
      - item_key: "gloves_base_001"
        name: "皮护手"
        buy_price: 50
      - item_key: "gloves_base_002"
        name: "青铜护手"
        buy_price: 75
      - item_key: "gloves_base_003"
        name: "精炼护手"
        buy_price: 100
      - item_key: "gloves_base_004"
        name: "罗汉护手"
        buy_price: 150
      # 靴子（base阶段，5件）
      - item_key: "boots_base_001"
        name: "无名短靴"
        buy_price: 50
      - item_key: "boots_base_002"
        name: "青衣短靴"
        buy_price: 60
      - item_key: "boots_base_003"
        name: "皮短靴"
        buy_price: 75
      - item_key: "boots_base_004"
        name: "无名长靴"
        buy_price: 100
      - item_key: "boots_base_005"
        name: "皮长靴"
        buy_price: 150
      # ===== 披风（v1.0 仅银娇龙独家售卖）=====
      - item_key: "cape_iron_man_armor"
        name: "钢铁侠铠甲"
        buy_price: 50000
      - item_key: "cape_spider_man_suit"
        name: "蜘蛛侠连体衣"
        buy_price: 50000
    price_multiplier: 1.0

  shop_potion:
    name: "平十指"
    type: "shop"
    shop_type: "potion"
    items:
      - item_key: "hp_potion_grade1"
        name: "金创药（小）"
        buy_price: 50
      - item_key: "mp_potion_grade1"
        name: "人参"
        buy_price: 50
      - item_key: "hp_potion_grade2"
        name: "金创药（中）"
        buy_price: 100
      - item_key: "mp_potion_grade2"
        name: "野山参"
        buy_price: 100
      - item_key: "hp_potion_grade3"
        name: "金创药（大）"
        buy_price: 200
      - item_key: "mp_potion_grade3"
        name: "雪原参"
        buy_price: 200
    price_multiplier: 1.0

  quest_npc:
    name: "泫渤派门主"
    type: "quest"
    quests:
      - key: "quest_transfer_1"
        name: "初入江湖"
      - key: "quest_transfer_2_positive"
        name: "江湖正道历练"
      - key: "quest_transfer_2_negative"
        name: "江湖邪道历练"
      - key: "quest_transfer_3_positive"
        name: "武林正道"
      - key: "quest_transfer_3_negative"
        name: "武林邪道"

仓库NPC
  warehouse_npc:
    name: "韦大宝"
    type: "warehouse"
    description: "提供物品存储服务"
    capacity: 50                   # 固定容量，无需扩充

8.3 任务系统


========== [可配置] 任务系统 ==========
任务类型：转职任务、打怪任务、收集任务
转职任务：1转/2转/3转，需要打怪获取任务物品
#
====================================================
v1.0 任务奖励设计取舍（必读）
====================================================
任务 reward 仅含 unlock_career + set_faction 两类，不发放 exp / gold / 物品：
- 设计意图：保持"挂机杀怪是唯一进度来源"的纯净设计
- 任务的价值 = 解锁转职职业 = 解锁更高段位的装备 / 武功 / 气功 → 间接提升打怪效率
- 避免"做任务就发钱"导致玩家把任务当短期农场，偏离挂机本意
AI 实现时切勿在任务 rewards 里追加 grant_exp / grant_gold / give_item 等类型；
玩家所有 exp / gold / 物品收益必须经"挂机杀怪 + 离线模拟"路径产生
#
====================================================
转职任务状态机（v1.0 完整规则）
====================================================
1) 接取前置（required_transfer）：
- quest.required_transfer = N 表示玩家必须已完成 N 次转职才能在 NPC 处看到本任务
- 1 转任务 required_transfer=0：任何 base 职业玩家达到 L10 即可接
- 2 转任务 required_transfer=1：必须先完成 1 转（player.transfer_count >= 1）才能在 L35 接取
- 3 转任务 required_transfer=2：必须先完成 2 转（player.transfer_count >= 2）才能在 L60 接取
- 实现侧 NPC 任务列表过滤伪代码：
# 注：quest_npc.quests 仅列 key+name 用于"该 NPC 暴露哪些任务的入口"；
#     完整任务对象（含 required_transfer / prerequisite / faction / target_transfer 等）
#     在 quest_templates 中定义，运行时按 entry.key 反查取得。
all_quests = [quest_templates[entry.key] for entry in quest_npc.quests]
visible_quests = [q for q in all_quests
if q.required_transfer <= player.transfer_count
and player.level >= q.prerequisite.level
and (q.faction == null or q.faction == player.faction or player.faction == "neutral")
and q.key not in player.quests.completed]
#
2) 不可放弃（v1.0）：
- 玩家一旦接取转职任务（1转/2转/3转 任一），不能放弃、不能换接对立派系任务
- UI 表现：转职任务无"放弃任务"按钮；其他类型任务（打怪/收集，非转职）允许放弃
- 设计意图：避免玩家反复横跳钻 faction 切换空子；保证转职选择具有承诺感
#
3) 派系（faction）设定流程：
- 角色创建时：player.faction = "neutral"（中立，所有派系任务均可见）
- 接取 quest_transfer_2_positive → player.faction 立即设为 "positive"，不可更改
- 接取 quest_transfer_2_negative → player.faction 立即设为 "negative"，不可更改
- 一旦 player.faction 设定，quest_npc 自动过滤对立派系的任务（不在列表中显示）
- 3 转任务（已有 faction 字段）自动只显示与 player.faction 匹配的那个
- 任务奖励中的 type: "set_faction" 是接取时即生效的标记，完成时再次校验做审计
#
4) 自动转职流程（reward.unlock_career 的语义）：
- 任务完成时遍历 rewards 找到 type: "unlock_career"
- careers 数组列出"该转职阶段在 4 个职业系上各自对应的新职业 key"
- 实现侧自动按 player.career_family 匹配数组中正确的目标职业，无需玩家选择：
target_career_key = next(c for c in reward.careers
if careers[c].career_family == player.career_family)
player.career = target_career_key          # 自动切换 career
# 注：transfer_count / career_family 由 career 后缀派生（详见 L826-839 fallback 规则），无需显式赋值
- v1.0 不提供"职业切换 UI"：转职完成即自动切换，单向不可回滚
- 转职后保留所有已学武功 / 已穿装备 / 已分配气功点：
* career_family 不变（如 "blade"）→ 武功学习权限、装备穿戴权限均沿用
* 已学武功无须重学；已穿装备无须卸下；气功点无须重置
* 仅 attrGrow 切换为新职业，按新等级成长系数继续累加（详见 3.1 / 3.2）
#
5) 任务物品的派系归属：
- 任务物品本身不分正邪（如 red_bear_skin / forest_tiger_skin 正邪 2 转任务共用同一 item_key）
- 派系隔离靠"任务接取"阶段实现：未接取对应任务，物品掉落判定不通过（见 9.3 quest_item_drop_condition）
- 因此玩家不会在背包里囤"对立派系才需要的物品"——接不到任务，物品就不掉
- 若同一物品被多个已接任务需要：按 quest_item_drop_condition 现有逻辑遍历，任一任务未达上限即掉
#
6) Stage 严格顺序（v1.0）：
- 所有转职任务 objectives 统一为 stage 嵌套结构：[{stage: N, name: "...", items: [...]}, ...]
1 转任务：单 stage（stage:1 only）
2 转任务：单 stage（stage:1 only）
3 转任务：多 stage（stage:1 → 2 → 3）
- 当前阶段字段：quest.current_stage（存档字段，详见 13.1 save_data_structure.quests.accepted[].current_stage）
- 掉落保护：物品仅当其所属 stage == quest.current_stage 时才掉（即"前序未完不掉后序物品"）
- Stage 推进：current_stage 的所有 items 全部收齐 → completed_stages.append(current_stage) → current_stage += 1
若已是最后一个 stage → 任务整体可提交（UI 任务面板亮"提交"按钮）
- 详见 9.3 quest_item_drop_condition.condition / stage_advance_check
#
====================================================
难度设计取舍（v1.0，"硬仗"型转职任务）
====================================================
- 任务接取等级（10/35/60）= 当前可穿装备段位的"上一段"
L10 接 1 转：玩家未转职，只能穿 base 装备（无 t1）打 L12 怪
L35 接 2 转：玩家未 2 转，只能穿 t1 装备打 L35-37 怪
L60 接 3 转：玩家未 3 转，只能穿 t2 装备打 L59-61 怪
- 玩家通过"满 4 孔 def 寒玉石 + 强化+6 + 满气功（百变神行/护身罡气/移花接木）+ 自动喝药"硬刚 4-6 秒
击杀部分怪后场上压力下降，可持续作战
- 任务怪等级 ≥ 接取等级是有意设计，不要降任务怪等级或提前解锁高段位装备
- 任务期间无法靠"主动选低级 zone"绕过（任务物品仅在指定怪身上掉）
#
字段约定：
- item_key  / count           ：必填，任务收集物品 key 与所需数量
- drop_monster                ：仅作 UI 提示用（"去打野猪"），不参与掉率计算
实际掉率定义在该怪物的 monster.drop_items.droprate（见 7.2）；
该字段省略时继承 task_item_drop_config.default_droprate（见 9.3，v1.0 默认 0.001）
- exclusive_group             ：选填，同组物品在"单次击杀"内最多掉 1 个
消费方在掉落判定流程（evaluation_flow，见 9.3）中处理
- 任务定义 不再 重复配置 drop_rate；如需调整任务物品掉率：
* 全局调参 → 改 task_item_drop_config.default_droprate（推荐）
* 单怪覆写 → 改对应 monster.drop_items[].droprate

quest_templates:
===== 1转任务（转职1次）=====
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
      # 1 转任务只有单 stage（结构与 2 转 / 3 转统一，便于 AI 单套解析）
      - stage: 1
        name: "证明实力"
        items:
          - item_key: "boar_leg"
            item_name: "野猪后腿"
            count: 10
            drop_monster: "wild_boar"
          - item_key: "wolf_bone"
            item_name: "灰狼之骨"
            count: 3
            drop_monster: "gray_wolf"
    rewards:
      - type: "unlock_career"
        # 自动按 player.career_family 匹配数组中目标职业 → 立即切换 career + transfer_count+=1
        # （已学武功/已穿装备全部保留，详见 8.3 章头部 "自动转职流程"）
        careers: ["warrior_blade_transfer_1st", "warrior_sword_transfer_1st", "healer_transfer_1st", "warrior_spear_transfer_1st"]
    dialogue:
      accept: "去吧，证明你的实力，带回10个野猪后腿和3个灰狼之骨。"
      complete: "不错，你已经具备了转职的条件。"

===== 2转任务（转职2次）=====
玩家在 quest_npc 处看到正派 / 邪派两个任务，二选一接取
接取后立即设定 player.faction，不可更改；未接取的另一派任务在 quest_npc 列表中将被自动隐藏
任务物品（皮料）两派完全相同，仅 key / name / dialogue / 解锁职业按派系区分
  transfer_2_positive:
    key: "quest_transfer_2_positive"
    name: "江湖正道历练"
    description: "泫渤派门主让你以正道之名，猎取多种猛兽之皮，证明你已经可以独当一面"
    type: "career_transfer"
    faction: "positive"              # 正派专属
    required_transfer: 1
    target_transfer: 2
    prerequisite:
      level: 35
    objectives:
      # 2 转任务只有单 stage（结构与 3 转统一）
      - stage: 1
        name: "正道历练"
        items:
          - item_key: "red_bear_skin"
            item_name: "赤血熊之皮"
            count: 10
            drop_monster: "red_bear"
          - item_key: "forest_tiger_skin"
            item_name: "山林黄虎之皮"
            count: 10
            drop_monster: "forest_tiger"
          - item_key: "white_tiger_skin"
            item_name: "白纹虎之皮"
            count: 10
            drop_monster: "white_tiger"
    rewards:
      - type: "set_faction"          # 接取时即生效；完成时再校验作审计
        faction: "positive"
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_2st_Z", "warrior_sword_transfer_2st_Z", "healer_transfer_2st_Z", "warrior_spear_transfer_2st_Z"]
    dialogue:
      accept: "既然你愿以正道立身，便去猎取10个赤血熊之皮、10个山林黄虎之皮、10个白纹虎之皮回来。"
      complete: "好，你已经是正道的合格江湖人士了。"

  transfer_2_negative:
    key: "quest_transfer_2_negative"
    name: "江湖邪道历练"
    description: "泫渤派门主以邪道之名考验你，猎取多种猛兽之皮，证明你的杀伐之力"
    type: "career_transfer"
    faction: "negative"              # 邪派专属
    required_transfer: 1
    target_transfer: 2
    prerequisite:
      level: 35
    objectives:
      # 2 转任务只有单 stage（结构与 3 转统一）
      # 任务物品与正派相同（同怪同掉率），仅 dialogue / 解锁职业按派系区分
      - stage: 1
        name: "邪道历练"
        items:
          - item_key: "red_bear_skin"
            item_name: "赤血熊之皮"
            count: 10
            drop_monster: "red_bear"
          - item_key: "forest_tiger_skin"
            item_name: "山林黄虎之皮"
            count: 10
            drop_monster: "forest_tiger"
          - item_key: "white_tiger_skin"
            item_name: "白纹虎之皮"
            count: 10
            drop_monster: "white_tiger"
    rewards:
      - type: "set_faction"
        faction: "negative"
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_2st_X", "warrior_sword_transfer_2st_X", "healer_transfer_2st_X", "warrior_spear_transfer_2st_X"]
    dialogue:
      accept: "既然你愿入邪道，便去猎取10个赤血熊之皮、10个山林黄虎之皮、10个白纹虎之皮回来，证明你的狠厉。"
      complete: "不错，你已经是邪道的合格江湖人士了。"

===== 3转任务（转职3次）=====
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
            item_name: "磁铁石"
            count: 10
            drop_monster: "one_eye_evil_thief"    # 独眼恶贼
          - item_key: "bamboo_leaf"
            item_name: "竹叶"
            count: 10
            drop_monster: "bamboo_forest_double_sword"   # 竹林双剑
      # 第二轮
      - stage: 2
        name: "再试身手"
        items:
          - item_key: "saber_tiger_skin"
            item_name: "剑齿虎皮"
            count: 10
            drop_monster: "saber_tooth_evil_tiger"
          - item_key: "red_cloud_tiger_skin"
            item_name: "赤云虎皮"
            count: 10
            drop_monster: "red_cloud_tiger"
      # 第三轮
      - stage: 3
        name: "终试实力"
        items:
          - item_key: "blood_wolf_skin"
            item_name: "嗜血狂狼皮"
            count: 10
            drop_monster: "bloodthirsty_wolf"
            exclusive_group: "bloodthirsty_wolf"        # 同组物品单次只掉1个
          - item_key: "blood_wolf_claw"
            item_name: "嗜血狂狼爪"
            count: 10
            drop_monster: "bloodthirsty_wolf"
            exclusive_group: "bloodthirsty_wolf"
          - item_key: "blood_wolf_tail"
            item_name: "嗜血狂狼尾毛"
            count: 10
            drop_monster: "bloodthirsty_wolf"
            exclusive_group: "bloodthirsty_wolf"
          - item_key: "blood_wolf_blood"
            item_name: "嗜血狂狼之血"
            count: 10
            drop_monster: "bloodthirsty_wolf"
            exclusive_group: "bloodthirsty_wolf"
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_3st_Z", "warrior_sword_transfer_3st_Z", "healer_transfer_3st_Z", "warrior_spear_transfer_3st_Z"]
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
            item_name: "竹条"
            count: 10
            drop_monster: "bamboo_forest_swordsman"   # 竹林剑士
          - item_key: "magnet_stone"
            item_name: "磁铁石"
            count: 10
            drop_monster: "one_eye_evil_thief"    # 独眼恶贼
      # 第二轮
      - stage: 2
        name: "再试身手"
        items:
          - item_key: "gold_bell_snake_scale"
            item_name: "金铃蛇蛇鳞"
            count: 10
            drop_monster: "gold_bell_snake" # 金铃蛇
          - item_key: "coral_snake_scale"
            item_name: "珊瑚蛇蛇鳞"
            count: 10
            drop_monster: "coral_snake"
      # 第三轮
      - stage: 3
        name: "终试实力"
        items:
          - item_key: "green_head_snake_scale"
            item_name: "青头蛇蛇鳞"
            count: 10
            drop_monster: "green_head_snake"
            exclusive_group: "green_head_snake"
          - item_key: "green_head_snake_fang"
            item_name: "青头蛇前牙"
            count: 10
            drop_monster: "green_head_snake"
            exclusive_group: "green_head_snake"
          - item_key: "qingxuan_wine"
            item_name: "青玄酒"
            count: 10
            drop_monster: "green_head_snake"
            exclusive_group: "green_head_snake"
          - item_key: "green_head_snake_venom"
            item_name: "青头蛇毒囊"
            count: 10
            drop_monster: "green_head_snake"
            exclusive_group: "green_head_snake"
    rewards:
      - type: "unlock_career"
        careers: ["warrior_blade_transfer_3st_X", "warrior_sword_transfer_3st_X", "healer_transfer_3st_X", "warrior_spear_transfer_3st_X"]
    dialogue:
      accept: "你已经是一方高手，但还需证明你的实力。完成三道考验方可转职。"
      complete: "不错，你已经是邪道的武林高手了。"

========== [可配置] 任务物品定义 ==========
v1.0 任务物品操作约束（统一规则）：
- 允许丢弃（item_action_popup.discard_action）：但丢弃后已 completed_stages 不回退，
仅 current_stage 进度的物品需要重打（见 9.3 stage_advance_check）
- 禁止存仓库（见 11 章 deposit_popup.forbidden_types）：保证 progress 单点判定
- 禁止出售（sell_price=0 + item_action_popup.sell_action.forbidden_types）
- 禁止从盒子开出（盒子 openable_items 不含任务物品）
- 禁止商店购买（任何 NPC.items 不含任务物品）
- 唯一获取路径：怪物 drop_items 掉落（条件见 9.3 quest_item_drop_condition）
quest_items:
  boar_leg:
    name: "野猪后腿"
    description: "野猪的后腿，证明猎人有能力"
    sell_price: 0                     # 任务物品不可出售

  wolf_bone:
    name: "灰狼之骨"
    description: "灰狼的骨头，坚硬如玉"
    sell_price: 0                     # 任务物品不可出售

  red_bear_skin:
    name: "赤血熊之皮"
    description: "赤血熊的皮，厚实坚韧"
    sell_price: 0

  forest_tiger_skin:
    name: "山林黄虎之皮"
    description: "山林黄虎的皮，金纹华丽"
    sell_price: 0

  white_tiger_skin:
    name: "白纹虎之皮"
    description: "白纹虎的皮，纹理如诗"
    sell_price: 0

  bamboo_leaf:
    name: "竹叶"
    description: "翠绿竹叶，可入药"
    sell_price: 0

  saber_tiger_skin:
    name: "剑齿虎皮"
    description: "剑齿虎的皮，坚韧如铁"
    sell_price: 0

  red_cloud_tiger_skin:
    name: "赤云虎皮"
    description: "赤云虎的皮，纹路如云"
    sell_price: 0

  blood_wolf_skin:
    name: "嗜血狂狼皮"
    description: "嗜血狂狼的皮，毛发如刺"
    sell_price: 0

  blood_wolf_claw:
    name: "嗜血狂狼爪"
    description: "嗜血狂狼的爪子，锋利无比"
    sell_price: 0

  blood_wolf_tail:
    name: "嗜血狂狼尾毛"
    description: "嗜血狂狼的尾毛，血色鲜艳"
    sell_price: 0

  blood_wolf_blood:
    name: "嗜血狂狼之血"
    description: "嗜血狂狼的血液，殷红如珠"
    sell_price: 0

邪派3转任务物品
  bamboo_strip:
    name: "竹条"
    description: "竹子劈成的细条，可编织"
    sell_price: 0

正邪3转通用任务物品
  magnet_stone:
    name: "磁铁石"
    description: "天然磁铁石，带有磁性"
    sell_price: 0

  gold_bell_snake_scale:
    name: "金铃蛇蛇鳞"
    description: "金铃蛇的金色鳞片，光泽耀眼"
    sell_price: 0

  coral_snake_scale:
    name: "珊瑚蛇蛇鳞"
    description: "珊瑚蛇的珊瑚色鳞片"
    sell_price: 0

  green_head_snake_scale:
    name: "青头蛇蛇鳞"
    description: "青头蛇的青色鳞片，晶莹剔透"
    sell_price: 0

  green_head_snake_fang:
    name: "青头蛇前牙"
    description: "青头蛇的前牙，锋利如针"
    sell_price: 0

  qingxuan_wine:
    name: "青玄酒"
    description: "青玄蛇浸泡的药酒"
    sell_price: 0

  green_head_snake_venom:
    name: "青头蛇毒囊"
    description: "青头蛇的毒囊，剧毒无比"
    sell_price: 0


8.4 地图与传送系统

========== [可配置] 传送系统 ==========
v1.0 设计取舍：
- 唯一城镇模型：只有 town_xuanbo 一座城（所有 NPC：商店/强化/任务/仓库都在此）
- 自由传送：玩家随时可在主页面"地图列表区"点击任意 sub_zone 完成传送
- 免费、无 CD、无消耗 —— 避免与"自动回城补给"、"死亡回城"等高频场景冲突
- 战斗中传送 = 立即放弃当前战斗（视为主动撤退），不掉经验、不结算掉落

teleport_system:
  enabled: true

传送规则
  rules:
    cost: 0                              # 金币消耗
    cooldown_ms: 0                       # 冷却时间
    in_combat_behavior: "instant_exit"   # 战斗中传送：立即结束战斗，HP/MP 保留，怪物清空

传送目标列表（运行时动态生成）：
- 1 座城镇：town_xuanbo
- 23 个 sub_zone（v1.0 全部已配置，全部可见可传）
- 南明湖的 nanminghu_cave（v2.0 待补怪物）仍可传入，但无怪可打，玩家进入后看到空地
  target_source: "maps[].sub_zones + towns"

UI 入口（修正：主页面常驻"地图列表区"，不是按钮，不是独立页）
  ui_entry:
    display_type: "panel_section"        # 主页面布局中常驻的一个 UI 区域
    location: "home_screen"              # 主页面（含挂机时）始终可见

列表展示规则
  display_rules:
    group_by: "parent_map"               # 按一级地图（如 wilderness_xuanbo_suburb）分组
    group_display:                       # 每组内容
      - parent_map_name                  # 一级地图中文名（如"泫渤派郊外"）
      - sub_zone_list                    # 该地图下所有 sub_zone（如"村庄周围 / 村庄野田 / ..."）
    per_zone_display:                    # 每个 sub_zone 展示字段
      - sub_zone_name                    # 中文名（如"村庄野田"）
      - level_range                      # 等级范围（如"L8-12"）
      - current_marker                   # 玩家当前所在 zone 标记
    click_action: "instant_teleport"     # 点击 sub_zone → 立即传送

玩家位置追踪（运行时字段，写入存档；详见 13.1 save_data_structure.location）
  player_location_state:
    current_map_key: "string"            # 如 "wilderness_xuanbo_suburb"，玩家在城镇时为 "town_xuanbo"
    current_sub_zone_key: "string"       # 如 "xuanbo_field"；玩家在 town 时为 null
    last_wilderness_sub_zone: "string"   # 上一个野外 sub_zone（用于"自动回城补给"返回原地）



---

