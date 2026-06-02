13. 存档系统
13.1 存档数据结构

========== 存档数据结构 ==========
设计原则（v1.0）：
1. 只存"无法从其他字段推导出的状态"——四维属性 / 派生属性都不存（由 career.base_stats +
attrGrow + level 实时算出）
⚠️ 区分点：hp / mp 是"当前状态值"（玩家受伤后的当前血量/内功），不是派生属性，必须存
maxHp / maxMp 是上限（派生属性），由公式实时算，不存
2. 装备实例存"key + 强化等级 + 已合成石头列表"，不存最终属性（由 5.5.10 equip_total_formula 实时算）
3. 玩家挂机面板的所有勾选 / 阈值 / 选择都进存档，避免下次进游戏要重设
4. 统计字段只留 v1.0 真正展示或使用的，不留无功能的占位
5. 战斗现场不存档（方案 B：见下方"战斗中断恢复规则"）
#
===== 战斗中断恢复规则（v1.0 方案 B）=====
适用场景：玩家刷新页面 / 关浏览器 / 程序意外退出
#
不存档的运行时状态（每次进游戏从 0 重建）：
- 场上怪物列表（含 HP / 预热倒计时 / 攻击 cd）
- 玩家武功冷却（cooldowns）
- 玩家正在施放的技能（casting）
- 玩家身上 Buff 列表（buffs / DOT / HOT）
- auto_consume 各药剂上次喝药时间戳（last_hp_potion_time / last_mp_potion_time）
- auto_heal_skill 上次施放时间戳（last_cast_time）
这些字段一律在玩家"重新进入 zone"时按初始状态重建（与首次进 zone 等价）。
#
存档的玩家状态（重新进游戏后保持）：
- HP / MP（按离线模拟终态；详见 13.4 offline_reward）
- 等级 / 经验 / 装备 / 气功点 / faction / career（transfer_count 由 career 字符串后缀推导）
- 当前位置（current_map_key / current_sub_zone_key）
- 挂机状态（is_auto_play）与挂机面板全部配置
- 背包 / 仓库 / 金币 / 任务进度
#
进游戏后的行为：
step_1: 校验 save.auto_play.is_auto_play 与 save.location.current_sub_zone_key
→ 若两者都满足"上次在野外挂机"条件 → 触发 13.4 离线模拟（按 last_save_timestamp 重放）
→ 否则跳过离线模拟，直接进游戏
step_2: 离线模拟结束后，玩家状态写回；
- 若模拟期间死亡 → 玩家已被 apply_player_death 传送至 town_xuanbo，is_auto_play=false
- 若模拟期间金币耗尽 → 玩家停在城里或目标 sub_zone，is_auto_play=false
- 若正常模拟完成（24h 截断或 elapsed < 24h）→ is_auto_play 保持 true
step_3: 重建战斗现场（仅当 is_auto_play=true 且 current_sub_zone_key 非空）：
- 走 6.1 battle_flow.monster_spawn 标准刷怪流程（initial_spawn_count=1，预热 2s）
- 玩家 cooldowns / Buff / 喝药时间戳全部清零
- 视觉上与"玩家刚点击进入该 zone"完全一致
step_4: UI 显示离线收益弹窗（详见 13.4 notification）；用户点确认后游戏正常运行
#
===== restore_player_from_save 契约（v1.0）=====
该函数在"进游戏首次 load_save"与"离线模拟入口"两处调用；行为必须完全一致。
实现步骤（顺序不可调换）：
1. 反序列化存档基础字段（level / exp / career / faction / equipped / inventory /
qigong / quests / location / auto_play / gold / hp / mp ...）
注：transfer_count / career_family 不进存档，按 career 字符串后缀推导（详见 L826-827 反查规则 + fallback）
2. 实时计算派生属性（按 2.1 章公式 + 装备/石头/Buff 钩子）：
maxHp / maxMp / atkMin / atkMax / def / hit / missing / ... 全部由 AttributeSystem.recompute(player) 算出
3. clamp 当前资源到上限（v1.0 必做，防止跨版本 / 装备掉失 / 平衡调整后 hp 超 maxHp）：
player.hp = clamp(save.player.hp, 0, player.maxHp)
player.mp = clamp(save.player.mp, 0, player.maxMp)
理由：装备失效 / hpGrowth 系数调整 / 离线模拟期间升级后 maxHp 变化 等场景，
若不 clamp 会出现 HP 1000/500 的诡异 UI（且影响所有按 hp/maxHp 比例的逻辑）
4. 重置运行时瞬态字段（与"战斗现场不存档"原则一致）：
player.cooldowns = {}
player.buffs = []
player.last_hp_potion_time = 0
player.last_mp_potion_time = 0
player.last_heal_cast_time = 0
5. 返回 player 对象，交由调用方使用（直接进游戏 / 进入离线模拟循环）
#
save_player_state 契约：写存档前同样 clamp 一次，确保任何外部修改路径（包括 GM 面板）写出的数据都合法
#
设计取舍：
- 不持久化战斗现场避免存档膨胀和版本不一致风险（怪物表更新即旧存档脏）
- 离线模拟天然覆盖"刷新前的最后几十秒"，玩家不会"凭空丢战斗"
- 重建场景与首次进 zone 一致，无需特殊代码路径，实现成本最低

save_data_structure:
===== 玩家基础数据 =====
  player:
    id: "string"                   # 唯一ID
    name: "string"                 # 角色名
    level: 1                       # 当前等级（≤ current_level_cap）
    exp: 0                         # 当前等级已积累经验
    career: "warrior_blade"        # 当前职业 key（含转职后职业，如 warrior_blade_transfer_2st_Z）
    career_history: []             # 已经过的职业 key 列表，按时间顺序
    faction: "neutral"             # neutral / positive / negative；接 2 转任务时设定，不可改
    # ===== 状态值（当前值，非派生属性，必须存）=====
    # 进游戏时 restore_player_from_save 会把 hp / mp clamp 到 [0, 实时算出的 maxHp/maxMp]
    # 离线模拟期间 run_battle_tick 实时变更 hp / mp；模拟结束后写回存档
    hp: 100                        # 当前生命值（受伤后的实际值；新角色 = baseHp）
    mp: 100                        # 当前内功值（释放武功后的实际值；新角色 = baseMp）

===== 资源数据 =====
  resources:
    gold: 0                        # 金币
    training: 0                    # 历练（学武功消耗）
    merit: 0                       # 武勋（v1.0 无产出，保留字段为 v2.0 门派战预留）

===== 气功投点状态 =====
  qigong:
    available_points: 1            # 当前可分配的气功点（升级获得，详见 attribute_points）
    invested:                      # 各气功已投入点数（map 结构）；未投入的气功 key 可不出现
      blade_qigong_atk_min: 0
      blade_qigong_hit: 0
      # ... 其他气功 key 按需展开
    attribute_reset_count: 0       # 累计已重置气功次数（影响下次重置费用，见 attribute_points.reset.cost）

===== 已学武功 =====
武功是布尔状态（学过 / 没学过），没有等级概念
  learned_martial_arts:
    - "blade_fury_wind_flame"
    - "blade_fury_wind_wood"
    # ...

===== 装备槽位 =====
已穿戴装备的实例引用；空槽位为 null
实例数据本体在 inventory.equipment_instances 中，按 instance_id 索引
  equipped:
    weapon: "inst_001"             # instance_id（指向 inventory.equipment_instances）
    chest: "inst_002"
    inner_armor: null
    amulet: null
    cape: null
    gloves: ["inst_003", "inst_004"]   # max_count: 2，双手
    boots: "inst_005"
    ring: ["inst_006", null]
    earring: [null, null]

===== 背包 =====
共 50 格；每格是 stack（堆叠物品）或 equipment_instance（单件装备）
装备类不堆叠（stack_rules.equipment.stackable=false），每件占 1 格
  inventory:
    capacity: 50
    slots:
      # 堆叠类（药剂 / 石头 / 任务物品 / 盒子）
      - type: "stack"
        item_key: "hp_potion_grade1"
        count: 12
      - type: "stack"
        item_key: "cold_jade_01_defAdd_5"   # 堆叠 key = stone_template 的合并 key
        count: 7
      # 装备实例（每件 1 格）
      - type: "equipment_instance"
        instance_id: "inst_007"
    # 装备实例库（被 equipped 和 inventory.slots[type=equipment_instance] 共同引用）
    equipment_instances:
      inst_001:
        item_key: "blade_t1_001"          # 指向 equipments 配置
        enhance_level: 3                  # 强化等级（0~10）
        synthesis_slots:                  # 已合成的石头（按孔位顺序；空孔位为 null）
          - "vajra_01_atkSelfAdd_5"    # 堆叠 key（指向具体属性 + 数值）
          - "vajra_01_hitAdd_3"
          - null
          - null

===== 仓库 =====
结构与 inventory 完全一致；通过仓库 NPC 操作（详见 11 背包与仓库系统）
  warehouse:
    capacity: 50
    slots: []
    equipment_instances: {}

===== 任务状态 =====
  quests:
    accepted:                       # 已接取未完成的任务
      # 实例字段约定（v1.0）：accepted[] 只存"动态状态"，objectives 等静态结构按 quest.key 反查 quest_templates 取得
      #   例：drop_helpers.find_active_quest_key / stage_advance_check / submit_quest 内
      #       run-time 引用 quest.objectives[].stage / .items 时，实际是 quest_templates[quest.key].objectives
      #   推荐实现：定义 lookup_active_quest(accepted_entry) → 返回 { ...accepted_entry, ...quest_templates[key] } 的合并对象
      - key: "quest_transfer_1"
        current_stage: 1            # 当前正在执行的 stage 号（与任务定义 objectives[].stage 对齐）
                                    # 严格顺序模式：前序 stage 全部完成才会推进到下一 stage
                                    # 1/2 转任务永远 current_stage=1（只有 1 个 stage）
                                    # 3 转任务从 1 推进到 3
        progress:                   # 按 stage 嵌套的收集进度
          1:                        # stage 号（YAML int key）
            boar_leg: 3             # item_key: 已收集数量
            wolf_bone: 0
          # 3 转范例（stage 1 全收齐推进到 stage 2 后才出现 2 这层）：
          # 2:
          #   red_bear_skin: 5
        completed_stages: []        # 已完成的 stage 号列表，如 [1, 2]；用于严格顺序判定与 UI 进度展示
    completed: []                   # 已提交的任务 key 列表

===== 玩家位置状态（详见 8.4 teleport_system）=====
  location:
    current_map_key: "town_xuanbo"         # 玩家所在一级地图 key
    current_sub_zone_key: null             # 在 town 时为 null；在野外为具体 sub_zone key
    last_wilderness_sub_zone: null         # 上一个野外 sub_zone（auto_resupply 回程目标）

===== 挂机状态与面板配置 =====
挂机面板上的所有勾选/选择/阈值都进存档，下次进游戏自动恢复
  auto_play:
    is_auto_play: false             # 当前是否处于挂机状态
    # 自动喝药配置（详见 10.3 auto_consume）
    auto_consume:
      hp_potion:
        enabled: true
        selected_item_key: null     # 玩家从背包下拉选 1 种 HP 药剂
        threshold: 0.30
      mp_potion:
        enabled: true
        selected_item_key: null
        threshold: 0.30
    # 自动治疗武功配置（详见 10.3 auto_heal_skill；非医师可忽略）
    auto_heal_skill:
      enabled: false
      selected_skill_key: null
    # 自动回城补给配置（详见 10.4 auto_resupply）
    auto_resupply:
      trigger_rules:
        hp: { enabled: false, selected_potion: null, trigger_threshold: 5 }
        mp: { enabled: false, selected_potion: null, trigger_threshold: 5 }
      purchase_rules:
        hp: { enabled: false, selected_potion: null, target_quantity: 10 }
        mp: { enabled: false, selected_potion: null, target_quantity: 10 }

===== 离线收益时间戳（详见 13.4 offline_reward）=====
  offline:
    last_save_timestamp: 0          # 上次存档的 Unix 时间戳（毫秒）

===== 统计数据（v1.0 仅展示用，不参与任何逻辑）=====
  statistics:
    total_kills: 0                  # 累计击杀怪物数
    total_playtime_ms: 0            # 累计在线时长（毫秒）
    total_gold_earned: 0            # 累计赚到的金币（不减消耗）
    total_deaths: 0                 # 累计死亡次数

13.2 存储方案

========== 手机端存储方案 ==========
手机端网页游戏使用 localStorage 存储存档

storage:
localStorage 配置
  localStorage:
    enabled: true
    max_size: "5MB"              # localStorage 容量限制（约5MB）
    key_prefix: "player-"        # 角色存档key前缀
    global_key: "game"           # 全局数据key

存档格式
  save_format:
    # 角色存档：player-{slot_index}（slot_index = 1..10，与槽位号对齐）
    # 全局存档：game（跨角色共享的状态，详见 global_save_data_structure）
    # 示例：player-1, player-2, ..., player-10, game

========== 全局存档数据结构（v1.0）==========
localStorage["game"] 的内容；与角色存档（localStorage["player-X"]）严格分离
设计原则：仅存"跨角色共享"或"无角色上下文也要的"状态
global_save_data_structure:
===== 角色栏位状态（跨角色共享）=====
  character_slots:
    unlocked_count: 3              # 当前已解锁栏位数（初始 3，每次花金币解锁一个 → +1，max 10）
                                   # 解锁付费由触发"解锁"按钮的当前角色出（扣其 gold）
    last_used_slot: null           # 玩家上次进入的角色槽位号（1..10）；null 表示首次启动
                                   # 用于"继续上次游戏"快捷入口；玩家在 multi_save 列表显式选其他角色时同步更新

===== 版本字段（独立于角色存档版本，方便全局 schema 单独迁移）=====
  schema_version: "1.0"            # 全局存档结构版本（与 save_version.current_version 解耦）

===== v2.0 预留（v1.0 不存）=====
ui_preferences:                # UI 偏好（如音量 / 语言 / 主题），v1.0 无此功能
last_login_timestamp: 0        # 上次启动游戏的时间戳（统计用），v1.0 不需要

========== 全局存档读写约定 ==========
global_save_io:
===== 启动序列（v1.0 main 流程）=====
游戏每次启动时按以下顺序判断，不可乱序：
  startup_sequence: |
    def on_game_startup():
        # 1) 先检测导入事务残留（详见 save_transfer.on_startup_check_import）
        if localStorage.getItem("import_in_progress") == "true":
            cleanup_dirty_import_state()        # 清空所有 player-* + game + import_in_progress
            show_toast("上次导入未完成，存档已重置")
            run_character_creation_flow()       # 等价首次启动
            return

        # 2) 检查 global_save 是否存在
        if localStorage.getItem("game") is None:
            on_first_launch()                   # 创建默认 global_save + 进入 character_creation_flow
            return

        # 3) 检查是否有任何 player-* 存档
        if no_player_save_exists():
            run_character_creation_flow()       # 有 global_save 但无角色（如玩家删光所有角色后重启）
            return

        # 4) 校验 last_used_slot 有效性（防御性兜底）
        # 场景：玩家手动清了 player-N、异常断电、跨设备数据不一致 → last_used_slot 指向不存在的角色
        # 不修复 → 列表 UI 可能高亮空槽位 / "继续上次游戏"快捷入口点击崩
        if global_save.character_slots.last_used_slot is not None:
            slot = global_save.character_slots.last_used_slot
            if localStorage.getItem(f"player-{slot}") is None:
                global_save.character_slots.last_used_slot = None
                save_global_state()             # 持久化校正后的值

        # 5) 进入 multi_save 列表 UI（玩家选角色或创建新角色）
        show_multi_save_list()
        # 如玩家选了 last_used_slot 的角色（或在列表点其他角色），走 on_enter_character → restore_player_from_save

  on_first_launch: |
    # localStorage["game"] 不存在时（首次进入游戏）：
    #   1. 创建默认 global_save: { character_slots: { unlocked_count: 3, last_used_slot: null }, schema_version: "1.0" }
    #   2. 立即写入 localStorage["game"]
    #   3. 因 player-* 也都不存在 → 跳转 character_creation_flow（强制创建首个角色）
  on_unlock_slot: |
    # 玩家在 multi_save 列表点击"解锁第 N 个栏位"按钮：
    #   前置：必须先进入某角色（Game.currentPlayer != null），否则按钮禁用 + 提示
    #          "请先进入任意角色再解锁新栏位"（详见 multi_save.save_list.locked_slot.no_active_warning）
    #   1. 校验 Game.currentPlayer.gold >= multi_save.character_slots.unlock_cost[N]
    #   2. 扣 gold；写当前角色存档（save_player_state）
    #   3. global_save.character_slots.unlocked_count += 1
    #   4. 写 localStorage["game"]
  on_enter_character: |
    # 玩家在 multi_save 列表选某角色进入：
    #   1. global_save.character_slots.last_used_slot = N
    #   2. 写 localStorage["game"]
    #   3. 加载 player-{N} 走 restore_player_from_save
  on_delete_character: |
    # 玩家在 multi_save 列表点 X 删除某角色（详见 character_deletion_flow.step_3_execute）：
    #   1. localStorage.removeItem(f"player-{N}")
    #   2. 若 global_save.character_slots.last_used_slot == N → 置 null（避免下次启动续到已删角色）
    #   3. unlocked_count 不回退（已花钱解锁的槽位永久保留）
    #   4. 写 localStorage["game"]
    #   5. 若 localStorage 中已无任何 player-* → 下次启动按 on_first_launch 重新进入创建流程

数据压缩
v1.0 设计取舍：不压缩，存档以原始 JSON 字符串存入 localStorage
- 单角色存档约 30~100 KB（玩家 + 背包 + 仓库 + 任务）；localStorage 单 key 上限约 5 MB，远未到瓶颈
- 浏览器原生无 gzip API（CompressionStream 在老 Safari < 16.4 / 部分微信内核不支持），强行用必崩手机端
- 避免引入第三方压缩库（如 LZ-string），减少依赖与 bug 面
- 未来如果撑爆 5 MB，再升级为 LZ-string + 双轨降级即可（届时 algorithm 字段启用）
  compression:
    enabled: false               # v1.0 关闭压缩
    algorithm: null              # 预留字段；启用压缩时填 "lz-string" 或 "gzip"

完整性校验（只防意外损坏，不防作弊）
v1.0 立场：纯前端单机 + 无排行榜，不引入虚假的"反作弊"机制
- 玩家修改 localStorage 只影响自己的单机体验，不影响他人
- 任何客户端签名/HMAC/JWT 都因密钥必然泄露而无实际防护意义
- 本字段唯一目的：检测 localStorage 字节级损坏（浏览器崩溃 / 半写入 / 配额溢出截断）
  integrity:
    enabled: true
    algorithm: "sha256"
    formula: |
      # 写存档时：
      payload = { data, version, saved_at }
      checksum = sha256(JSON.stringify(payload))
      localStorage.set(key, JSON.stringify({ ...payload, checksum }))
      # 读存档时：
      raw = JSON.parse(localStorage.get(key))
      expected = sha256(JSON.stringify({ data: raw.data, version: raw.version, saved_at: raw.saved_at }))
      if expected != raw.checksum:
          # 存档损坏（不一定是作弊；可能是浏览器异常截断）
          show_recovery_dialog()    # 触发 redundancy 的双存档恢复流程

双存档冗余（提升防意外损坏的可靠性）
  redundancy:
    enabled: true
    write_strategy: "primary_then_shadow"
    keys:
      primary: "player-$${roleKey}"           # 主存档
      shadow: "player-$${roleKey}-bak"        # 影子存档
    recovery_flow: |
      # 加载时同时读 primary 和 shadow，按 integrity 各自校验
      # 1. 两份 checksum 都对 → 用 primary（默认源）
      # 2. 只有 primary 对 → 用 primary，静默把 shadow 重写为一致
      # 3. 只有 shadow 对 → 用 shadow，提示"检测到主存档损坏，已从影子存档恢复"
      # 4. 两份都不对 → 提示"存档损坏，请选择重置 / 联系反馈"
      # 5. 两份都对但 data 不一致（极少见，通常是写主存档后浏览器崩溃）
      #    → 取 saved_at 更新的那份

v1.0 不实现的"反作弊"机制（明确列出，避免 AI 误以为漏配）
  not_implemented:
    - "JWT / HMAC 签名（密钥必然泄露，无防护价值）"
    - "客户端反作弊（投入产出比极低）"
    - "服务端校验（v1.0 无服务端；v2.0 联机版本再补）"
    - "WASM 混淆（成本巨大，仍能绕过）"

13.3 自动存档机制

========== 自动存档配置 ==========

auto_save:
自动存档间隔
  interval: 60000               # 每分钟自动存档（毫秒）

触发存档的条件
  triggers:
    - event: "level_up"        # 升级时
    - event: "equip_change"     # 装备变更时
    - event: "quest_complete"   # 任务完成时
    - event: "career_transfer"  # 转职时
    - event: "purchase"         # 购买物品时
    - event: "battle_end"       # 战斗结束时（无论胜败）

切后台/页面隐藏时存档
  visibility_change:
    save_on_hidden: true         # 页面不可见时存档
    save_on_blur: true          # 窗口失焦时存档

13.4 离线收益计算

========== 离线收益配置 ==========
实现模块命名约定（v1.0）：
- 配置块名：offline_reward（YAML 配置 + 数据驱动部分，本节内容）
- 运行时模块名：OfflineSimulator（实现侧的代码模块，承载 settle_offline_rewards 函数
与 OfflineSimulator.is_in_offline_simulation 模块级 flag）
- 两者关系：offline_reward 是数据，OfflineSimulator 是执行该数据的运行时引擎
- 文档中所有 OfflineSimulator.xxx 形式的引用 = 实现侧的运行时模块属性
设计取舍（v1.0）：方案 C1 —— 完整 tick-by-tick 战斗模拟
理由：玩家挂机过程中有真实的"自动喝药消耗药剂、自动回城补给消耗金币、死亡停挂机"等行为，
简化版（如 1exp+1gold/s）会让离线产出与在线偏差百倍以上，不公平
实现：上线时把"离线时长"作为输入，复用在线战斗循环（battle_flow）+ auto_consume + auto_heal_skill
+ auto_resupply 等模块，按 100ms tick 整段重放，最终把累计 delta 应用到玩家状态
性能：24h 离线 = 86400s = 864000 个 tick；JS 单线程瞬间跑会卡 UI
→ 上线时弹出"离线结算中…"loading；按 60s 为一批分块跑（requestIdleCallback / setTimeout）
→ 大多数玩家离线 < 24h，结算耗时 1~3 秒可接受

offline_reward:
  enabled: true

===== 触发条件 =====
  trigger:
    # 仅当存档显示玩家最后状态为"野外挂机中"才结算；其他情况按 0 收益处理
    condition: "save.auto_play.is_auto_play == true and save.location.current_sub_zone_key != null"
    offline_time_seconds: "(currentTimestamp - save.offline.last_save_timestamp) / 1000"
    # 注：本结算完成后，运行时还要走"战斗现场重建"step_3（见 13.1 战斗中断恢复规则）：
    #     cooldowns / Buff / 怪物列表 / 喝药时间戳全部清零，重新进 zone 视为首次进入

===== 5 条核心规则（v1.0 锁定）=====
  rules:
    cap_offline_seconds: 86400               # 1. 24h 上限：超出部分直接截断（不累计、不补发）
    on_death_behavior: "stop_simulation"     # 2. 死亡即停：模拟到 player.hp<=0 立即结束循环，
                                             #             与在线 player_death 一致（is_auto_play=false，回城）
                                             #             玩家上线后看到"离线第 X 秒死亡，挂机已停止"
    on_inventory_full: "discard"             # 3. 背包满：后续装备/盒子掉落直接丢弃，
                                             #             不卖低段、不触发回城（与在线"无法保存"逻辑一致）
                                             #             药剂 / 金币 / 任务物品不受影响（金币不占格、药剂可叠加到上限、任务物品独立校验）
    auto_resupply_spends_gold: true          # 4. 自动回城补给：真实扣金币买药；金币不足时按 10.4 auto_resupply 规则停挂机
    run_auto_heal_skill: true                # 5. 自动治疗武功：医师正常释放（auto_heal_skill.enabled=true 时）

===== 模拟流程（伪代码）=====
  simulation_flow: |
    # 入口：load_save() 完成后立即检查
    # 注：本函数是 async 异步函数；分批 yield 给 UI 防止主线程冻死（见下方 batched_execution）
    async def settle_offline_rewards(save):
        if not (save.auto_play.is_auto_play and save.location.current_sub_zone_key):
            return None                                  # 不在挂机状态，无离线收益

        elapsed_s = (now() - save.offline.last_save_timestamp) / 1000
        sim_seconds = min(elapsed_s, offline_reward.rules.cap_offline_seconds)
        if sim_seconds < 1:
            return None                                  # 时间太短无需结算

        # 标记全局 flag：drop_adapters 5 函数据此切换在线/离线分支（详见 9.x drop_helpers.is_in_offline_simulation）
        # 出口约定：所有 return / break 路径 + 异常都必须保证 OfflineSimulator.is_in_offline_simulation = False
        # 实现侧建议用 try/finally 包裹整个主体，下方伪码省略 try/finally 但实现侧必须加
        OfflineSimulator.is_in_offline_simulation = True

        # 把存档反序列化为运行时玩家对象（沿用在线 Player 类）
        player = restore_player_from_save(save)
        sub_zone = world.get_sub_zone(save.location.current_sub_zone_key)

        # 模拟统计（用于上线时弹窗展示）
        summary = {
            "elapsed_s": sim_seconds, "kills": 0, "exp_gained": 0, "gold_gained": 0,
            "potions_consumed": {}, "items_obtained": [], "boxes_obtained": 0,
            "items_discarded": 0,                        # 因背包满丢弃的装备/盒子数
            "deaths": 0, "died_at_s": None,
            "resupply_trips": 0, "gold_spent_on_potions": 0,
            "stopped_reason": None,                       # null / "death" / "auto_resupply_gold_insufficient" / "inventory_full_quest_item"
            "quest_item_lost": None,                      # 仅当 stopped_reason="inventory_full_quest_item" 时填充
                                                          # 格式：{ item_key, quest_key, current_count, required_count }
            "level_ups": [],                              # 离线模拟期间所有升级事件，由 on_level_up 累加；上线弹窗汇总展示
                                                          # 每项格式：{ from_level, to_level, gained_points }
        }

        # 复用在线战斗循环，强制 tick 间隔 100ms；按 batch_size_seconds 分批 yield
        TICK_MS = 100
        BATCH_TICKS = int(batched_execution.batch_size_seconds * 1000 / TICK_MS)  # 默认 60s = 600 ticks
        total_ticks = int(sim_seconds * 1000 / TICK_MS)

        for tick in range(total_ticks):
            # 1) 跑一次完整 battle_loop tick（见 6.1 battle_flow.battle_loop.steps）
            #    包括：刷怪、玩家行动、怪物行动、Buff、auto_consume、auto_heal_skill、auto_resupply
            #    任何掉落 / 消耗 / 扣血都直接落到 player 对象
            run_battle_tick(player, sub_zone, summary)

            # 2) 玩家死亡 → 停模拟（rule 2: stop_simulation）
            if player.hp <= 0:
                summary["deaths"] += 1
                summary["died_at_s"] = tick * TICK_MS / 1000
                # 走标准死亡流程（teleport_to town、is_auto_play=false、扣经验、HP/MP 满）
                apply_player_death(player)
                break                                     # v1.0 死了就停，不自动重开

            # 3) 任何环节把 is_auto_play 置为 false → 停模拟
            #    最常见路径：auto_resupply.gold_insufficient.check_after_purchase
            #              （回城买药后金币仍不够 → is_auto_play=false 见 10.4）
            if not player.is_auto_play:
                break

            # 4) 每 BATCH_TICKS 报告一次进度 + yield 给 UI（避免主线程冻死）
            if (tick + 1) % BATCH_TICKS == 0:
                percent = min(100, floor((tick + 1) / total_ticks * 100))
                progress_callback(percent)               # 走 batched_execution.progress_callback
                await yield_to_ui()                      # 让 UI 渲染进度条与 loading 文字

        # 收尾：保证进度条 100%，再写存档
        # 注：save_player_state 内部 clamp hp/mp 到上限（见 13.1 restore_player_from_save 契约）
        progress_callback(100)
        save_player_state(player)
        save.offline.last_save_timestamp = now()

        # 清除全局 flag（详见入口处约定）；实现侧必须用 try/finally 保证异常路径也执行
        OfflineSimulator.is_in_offline_simulation = False

        # 返回弹窗摘要（详见 notification.show_offline_summary）
        return summary

    # ===== yield_to_ui 工具函数（v1.0 实现约定）=====
    # 优先 requestIdleCallback：现代浏览器在 UI idle 时调度，体验最佳
    # 不可用时降级 setTimeout(fn, 0)：让浏览器走一遍事件循环（最坏 ~16ms 延迟），仍能保持响应
    def yield_to_ui():
        return new Promise(resolve => {
            if window.requestIdleCallback:
                requestIdleCallback(() => resolve(), { timeout: 50 })
            else:
                setTimeout(resolve, 0)
        })

===== run_battle_tick 内部行为约定 =====
  battle_tick_in_offline:
    description: |
      离线模拟下 run_battle_tick 与在线 100ms tick 完全相同，仅以下两处特例：
      - 不渲染 UI（不触发 BattleUI/InventoryUI 更新）
      - 不写存档（避免每 tick 写 localStorage 卡死；统一在 settle_offline_rewards 结束时一次性保存）
    inventory_full_handling: |
      当 InventorySystem.add(player, item_key, count) 返回 success=False（容量满）时：
      - 装备 / 盒子 → 直接丢弃，summary.items_discarded += 1
      - 药剂 → 已堆叠到 max_stack 时同样丢弃（在线本身就是这个规则）
      - 金币 → 不占格，直接累加
      - 任务物品 → 漏洞修复（v1.0）：
          required_count 未满 + 背包总格满 → InventorySystem.add 返回 success=False → 强制停挂机：
            player.is_auto_play = False
            summary.stopped_reason = "inventory_full_quest_item"
            summary.quest_item_lost = { item_key, quest_key, current_count, required_count }
            break  # 立即跳出 simulation_flow 主循环
          理由：若静默丢弃 → 玩家 stage 永远推不进且看不到提示；
                停挂机让玩家上线后立即看到"背包已满，任务物品丢失"弹窗 → 主动清理后再开挂机
          UI：notification.summary_fields 加 stopped_reason / quest_item_lost；当 stopped_reason
              非空时弹窗强提示（与正常离线总结弹窗区分样式）
    death_handling: |
      与在线 player_death 完全一致：teleport_to(town_xuanbo) / hp_mp_full_restore /
      is_auto_play=false / exp_loss = floor(exp_to_next_level[level] * 0.01)

===== 分批执行（避免阻塞 UI）=====
  batched_execution:
    enabled: true
    batch_size_seconds: 60           # 每批模拟 60 秒游戏内时间
    yield_method: "requestIdleCallback"  # 不可用时降级 setTimeout(fn, 0)
    progress_callback: "onOfflineSettleProgress(percent)"  # UI 显示进度条

===== UI 提示 =====
  notification:
    show_loading: true                # 开始结算时弹"离线结算中…"全屏 loading
    show_summary: true                # 结算完弹离线收益总结弹窗
    summary_fields:
      - elapsed_s                     # "离线时长 X 小时 Y 分"（超 24h 显示"已截断至 24h"）
      - kills                         # "击杀 N 只怪"
      - exp_gained                    # "经验 +X（升 Y 级）"
      - gold_gained                   # "金币 +X"
      - potions_consumed              # "消耗药剂：金创药小 ×N、人参 ×M"
      - gold_spent_on_potions         # "买药花费 -X 金币"
      - items_obtained                # "获得物品：[列表]"
      - items_discarded               # "丢弃 N 件（背包满）"
      - boxes_obtained                # "获得盒子 N 个"
      - resupply_trips                # "自动补给 N 次"
      - deaths / died_at_s            # "离线第 X 秒死亡 → 已停止挂机"（仅死亡时显示）
      - stopped_reason / quest_item_lost
        # 当 stopped_reason="inventory_full_quest_item" 时，额外用强提示样式弹：
        # "⚠️ 背包已满，任务物品 [赤血熊之皮] 无法保存，已停止挂机
        #   当前任务进度 [X/10]，请清理背包后重新开始挂机"
      - level_ups
        # 离线模拟期间升级事件列表（来自 on_level_up 累加；见 13.4 summary 字段定义）
        # 聚合算法约定（v1.0）：
        #   - on_level_up 期间按顺序 append 原始记录到 summary.level_ups（每次升级 1 条），不做合并
        #   - 聚合发生在 UI render 弹窗时（不修改 summary 原始 list，便于事后审计 / debug）
        #   - "连续升级" 定义：同一次离线模拟内的所有升级整段视为连续（不按 tick 拆分）
        #     → 取 list[0].from_level 作起点 / list[-1].to_level 作终点 / sum(gained_points) 作累计
        # 显示规则：
        #   - 列表空（未升级）→ 不显示该行
        #   - 列表非空 → 显示 "升级 N 次：Lv{from}→Lv{to}（+M 气功点）"
        #     示例：summary.level_ups = [{from:24, to:25, gained_points:1}, {from:25, to:26, gained_points:1}]
        #          → "升级 2 次：Lv24→Lv26（+2 气功点）"
        #   - 聚合策略：连续升级合并展示（首→末 + 累计气功点），避免列表过长
        # 与 exp_gained 配合：exp_gained 是"经验总数"；level_ups 是"实际升了几级 + 气功点收益"

===== 边界情况 =====
  edge_cases:
    elapsed_lt_1s: "无收益弹窗，直接进游戏"
    not_in_auto_play: "上次未挂机（is_auto_play=false）→ 不结算"
    in_town: "上次在城镇（current_sub_zone_key=null）→ 不结算"
    elapsed_gt_24h: "截断为 24h 模拟，弹窗注明'已截断至 24 小时'"
    save_corrupted: "存档损坏 → 跳过离线结算，按 0 收益处理（不阻塞登录）"

13.5 多存档管理

========== 角色创建流程（v1.0）==========
触发场景：
- 玩家首次打开游戏（localStorage 中无任何 player-* 存档）→ 强制进入角色创建（无法跳过）
- 玩家在多存档列表点击"+ 新建角色"（已用栏位 < unlocked_count）
- 玩家通过 GM 面板"清空 localStorage + 刷新"后等价于"首次打开" → 同样强制进入
#
不查重设计：
- v1.0 不做角色名查重（包括同设备内）；玩家可以在不同存档槽用相同名字
- multi_save.save_list 通过 career / level / current_zone 等字段帮玩家区分（即使同名也有上下文）
#
v1.0 不支持改名：
- 创建后角色名不可修改；如需改名只能"删除角色 → 新建"（详见下方 character_deletion_flow）

character_creation_flow:
===== 步骤 1：选择职业 =====
  step_1_select_career:
    ui: "平铺展示所有 v1.0 base 职业（4 个：刀客 / 剑客 / 枪客 / 医师）"
    layout: "网格布局（如 2×2）"
    each_card_displays:
      - field: "name"
        source: "careers[<key>].name"        # 如"刀客"
      - field: "icon"
        source: "assets/icons/career_<key>.png"  # 资源命名约定：career_warrior_blade.png
      - field: "description"
        source: "careers[<key>].description"  # 职业介绍文本
    # v1.0 仅 4 个 base 职业可选：转职职业必须从 base 出发，玩家不能直接选转职职业
    selectable_careers: ["warrior_blade", "warrior_sword", "warrior_spear", "healer"]
    on_select: "高亮选中卡片，启用'下一步'按钮"

===== 步骤 2：输入角色名 =====
  step_2_input_name:
    ui: "弹窗或下一页面：单行文本框 + '确认创建'按钮"
    validation:
      min_length: 1
      max_length: 10
      allowed_chars: "中文 + 英文（大小写）+ 数字 + 下划线"
      reject_pattern: "纯空格 / emoji / 特殊符号"
      duplicate_check: false       # v1.0 不查重（与 multi_save 列表设计一致）
    error_messages:
      empty: "角色名不能为空"
      too_long: "角色名不超过 10 个字符"
      invalid_char: "仅支持中文 / 英文 / 数字 / 下划线"

===== 步骤 3：写入新存档 =====
  step_3_initialize_save:
    # 创建新存档对象（结构同 13.1 save_data_structure），按以下规则填充初始值：
    initial_values: |
      new_save = {
          player: {
              id: generate_uuid(),                       # UUID v4 唯一标识（不依赖名字）
              name: input_name,                          # 玩家输入的名字
              level: 1,
              exp: 0,
              career: selected_career,                   # 步骤 1 选的 base 职业
              career_history: [selected_career],         # 历史轨迹起点
              faction: "neutral",                        # 中立（接 2 转任务时设定）
              hp: careers[selected_career].base_stats.baseHp,    # 起始 HP = baseHp（满血）
              mp: careers[selected_career].base_stats.baseMp,    # 起始 MP = baseMp（满 MP）
          },
          resources: {
              gold: 100,                                 # 起始金币（够买几瓶 grade1 药剂）
              training: 0,
              merit: 0,                                  # v2.0 预留
          },
          qigong: {
              available_points: attribute_points.initial, # = 1（见 4.x attribute_points.initial）
              invested: {},                              # 未投入任何气功
              attribute_reset_count: 0,
          },
          learned_martial_arts: [],                       # 顶层数组（与 save_data_structure 对齐）；未学任何武功
          equipped: {                                    # 全空：未穿任何装备（v1.0 不送起始装备）
              weapon: null,
              chest: null,
              boots: null,
              inner_armor: null,
              cape: null,
              amulet: null,
              gloves: [null, null],                       # max_count=2 用 array of 2 nulls
              ring: [null, null],
              earring: [null, null],
          },
          inventory: {
              capacity: 50,                               # 必填，与 save_data_structure.inventory.capacity 对齐
              slots: [],                                  # 空背包（v1.0 不送起始物品）
              equipment_instances: {},
          },
          warehouse: {
              capacity: 50,                               # 必填，与 save_data_structure.warehouse.capacity 对齐
              slots: [],
              equipment_instances: {},
          },
          quests: {
              accepted: [],
              completed: [],
          },
          location: {
              current_map_key: "town_xuanbo",            # 起始位置：唯一城镇
              current_sub_zone_key: null,                # 在城镇为 null
              last_wilderness_sub_zone: null,
          },
          auto_play: {
              is_auto_play: false,                       # 默认未挂机
              auto_consume: { hp_potion: {...默认值}, mp_potion: {...默认值} },
              auto_heal_skill: { enabled: false, selected_skill_key: null },
              auto_resupply: { trigger_rules: {...默认}, purchase_rules: {...默认} },
          },
          offline: {
              last_save_timestamp: now(),                 # 创建瞬间作为初始时间戳
          },
          statistics: {
              total_kills: 0,
              total_playtime_ms: 0,
              total_gold_earned: 0,
              total_deaths: 0,
          },
      }

===== 步骤 4：写入 localStorage =====
  step_4_persist:
    # slot_index 解析顺序（v1.0）：
    #   1) 优先取调用方传入的 target_slot_index（如玩家点击第 5 槽的"+ 新建角色" → target=5）
    #   2) 未传时回退："1..global_save.character_slots.unlocked_count 范围内第一个空槽"
    #   3) 解析后必须在 [1, unlocked_count] 范围内（不允许塞入未解锁槽位）；越界 → 抛错
    save_key_pattern: "player-{slot_index}"   # 如 player-1, player-2, ..., player-10
    actions:
      - "slot_index = resolve_slot_index(target_slot_index)   # 见上方解析顺序"
      - "save_player_state(new_save)             # 走 13.1 save_player_state 契约（含 clamp）"
      - "global_save.character_slots.last_used_slot = slot_index   # 记录本次进入的槽位（嵌套全路径，与 13.5 schema 对齐）"
      - "save_global_state()                      # 写 localStorage[\"game\"]"
      - "Game.currentPlayer = new_save.player    # 加载到运行时"
      - "进入主城镇 town_xuanbo 主页面"

===== 新手引导（v1.0 设计取舍）=====
v1.0 不做任何新手引导 / tutorial / onboarding：
- 玩家进入主城镇后自行探索 NPC（quest_npc 接任务 / shop_* 买卖 / enhance_npc 强化 / warehouse_npc 存仓）
- 不弹首次提示 toast、不做高亮指引、不做强制对话
- 主城镇 NPC 名字本身即引导（如"泫渤派门主"暗示这是任务 NPC）
设计意图：
- 挂机游戏核心是"找节奏感"，玩家自主探索 = 自主理解节奏
- 引导 / tutorial 工程量大、易引发遗漏 bug、未来调 UI 需同步改引导
v2.0 视玩家反馈再决定是否引入

========== 角色删除流程（v1.0）==========
入口：multi_save 列表每个角色卡右侧"X"小图标（红色）
流程：点击 X → 二次确认弹窗 → 确认后清存档并释放槽位
character_deletion_flow:
===== 步骤 1：触发 =====
  step_1_trigger:
    ui_entry: "multi_save.save_list 列表项右侧的红色 X 图标按钮"
    visual: "鼠标悬浮 X 图标变红 + 显示 tooltip '删除角色'"
    keyboard_shortcut: null   # v1.0 无快捷键

===== 步骤 2：二次确认弹窗 =====
  step_2_confirm:
    ui: "modal 弹窗"
    title: "删除角色确认"
    body_template: "确认删除「{name}」（Lv{level} {career_display_name}）？此操作不可恢复。"
                  # career_display_name 取 careers[career].name（如"刀客"）
    buttons:
      - { text: "取消", action: "close_modal" }
      - { text: "确认删除", action: "execute_delete", style: "danger_red" }

===== 步骤 3：执行删除 =====
  step_3_execute:
    actions: |
      slot_index = save_list_item.slot_index            # 被删角色的槽位号（1..10）
      # 1. 清存档
      localStorage.removeItem(f"player-{slot_index}")
      # 2. 处理 last_used_slot 边界（如删的恰好是上次进入的角色）
      if global_save.character_slots.last_used_slot == slot_index:
          global_save.character_slots.last_used_slot = null
      # 3. 注：unlocked_count 不回退（已花钱解锁的槽位永久保留，鼓励一次解锁完）
      #    被删槽位变空，后续创建新角色时可由 character_creation_flow 复用
      # 4. 写全局存档
      save_global_state()
      # 5. 刷新 multi_save 列表 UI（被删角色卡消失，空槽位用"+ 新建角色"占位卡显示）
      refresh_multi_save_list()

===== 边界情况 =====
  edge_cases:
    delete_only_character: |
      # 玩家删了唯一一个角色 → localStorage 不再有 player-* → 下次进游戏触发 first_launch 流程
      # （等价于"清空 localStorage 后重启"，强制进入 character_creation_flow）
      "释放槽位后，若 localStorage 中已无任何 player-* → 下次启动按 on_first_launch 处理"
    delete_during_play: |
      # v1.0 不允许在角色游戏中删除自己（防误操作）
      # 必须先返回 multi_save 列表才能删
      "删除入口仅在 multi_save 列表可见；进入某角色后 GM 面板外无删除按钮"

========== 多角色存档配置 ==========

multi_save:
支持的最大角色数量
  max_characters: 10            # 最多10个角色

角色栏位
  character_slots:
    initial: 3                   # 初始3个栏位
    max_slots: 10                # 最多10个栏位
    # 解锁新栏位消耗金币（按目标栏位号配置）
    # v1.0 全部默认 100；后续可自由调整每档价格（如改成 100/500/2000/10000/50000/200000/1000000 递增模型）
    # 实现侧读取：cost = unlock_cost[target_slot_index]；查不到则按 unlock_cost_default 兜底
    unlock_cost:
      4: 100                      # 第 4 个槽位解锁费用
      5: 100
      6: 100
      7: 100
      8: 100
      9: 100
      10: 100
    unlock_cost_default: 100     # 未在 unlock_cost 表中的槽位号默认费用（v2.0 扩容时兜底）

存档列表
  save_list:
    display: ["career", "name", "level", "current_zone"]   # 职业 / 角色名 / 等级 / 所在 zone
    # current_zone 展示规则：
    #   - 在城镇：显示 "town_xuanbo" 对应的中文名（如 "泫渤派"）
    #   - 在野外：显示 current_sub_zone_key 对应的中文名（如 "柳善提督府"）
    sort_by: "last_save"         # 按最后存档时间排序（影响列表顺序，但 last_save 字段不在 display 里）

    # ===== UI 元素布局 =====
    # 列表项（已创建角色卡）：
    #   左侧：display 字段平铺
    #   右侧：红色 X 图标 → 触发 character_deletion_flow（详见上方）
    # 空槽位项（unlocked 但无角色）：
    #   显示 "+ 新建角色" 占位卡 → 点击进入 character_creation_flow
    # 锁定槽位项（unlocked_count 之外的槽位）：
    #   显示 "🔒 解锁第 N 个栏位（{cost} 金币）" 占位卡
    #   点击触发 unlock_slot_action（见下）；若当前未进入任何角色 → 提示"请先进入任意角色再解锁"
    item_buttons:
      delete: "红色 X 图标，点击触发 character_deletion_flow.step_2_confirm"
    empty_slot:
      label: "+ 新建角色"
      action: "trigger_character_creation_flow(target_slot_index=N)"   # N = 该空槽位号（玩家点击哪个空槽就传哪个）
      # step_4_persist 会优先使用 target_slot_index，新角色严格落到玩家点击的槽位
      # 仅当 target_slot_index 未传或越界时，才回退到"第一个空槽"
    locked_slot:
      label_template: "🔒 解锁第 {N} 个栏位（{cost} 金币）"
      cost_lookup: "multi_save.character_slots.unlock_cost[N] ?? unlock_cost_default"
      action: "trigger_unlock_slot_action"
      requires_active_character: true   # 必须先进入某角色才能解锁（解锁费从该角色 gold 扣）
      no_active_warning: "请先进入任意角色再解锁新栏位"

13.6 存档导入/导出

========== 存档迁移配置 ==========

save_transfer:
导出功能
  export:
    enabled: true
    format: "base64"             # 导出为base64编码字符串
    # 导出包内容（v1.0 完整版）：
    #   { game: <localStorage["game"] 全局存档>,
    #     players: { "player-1": <存档1>, "player-3": <存档3>, ... },  # 所有现存的 player-* 槽位
    #     export_meta: { schema_version, exported_at, source_device_id } }
    include_all_characters: true  # true: 导出全部 player-* + global_save；false: 仅导出当前 last_used_slot 那个角色（不含 global_save）
    fields_breakdown:
      game: "localStorage[\"game\"] 完整内容（含 character_slots.unlocked_count / last_used_slot）"
      players: "所有 player-{N} 存档（按 N 排序），N 仅包含已存在的槽位"
      export_meta: { schema_version: "save_version.current_version", exported_at: "ISO 时间戳", source_device_id: "可选，用于跨设备追溯" }

导入功能
  import:
    enabled: true
    # v1.0 设计取舍：纯单机游戏，无导入冷却 / 无最低游戏时长门槛
    #   - 原 cooldown / min_playtime_required 是为多人游戏防作弊设计的（防止瞬时跨设备升级、刷排行榜等）
    #   - v1.0 无排行榜、无 PvP、无多设备同步竞争，玩家想跳级用 GM 面板更直接
    #   - 删除这两个字段后无需在存档里维护 last_import_at（避免被 full_replace 覆盖的复杂边界）
    # 未来 v2.0 上线多人功能时再启用冷却（届时把 last_import_at 字段加进 global_save）

    # ===== 覆盖策略（v1.0）=====
    # 导入策略分流（v1.0）：根据 import_pack.include_all_characters 字段分发：
    #   true  → 走 full_replace_actions（破坏性，清空全部 + 写入全部）
    #   false → 走 partial_replace_actions（仅替换对应单角色槽位，不动其他角色 / 全局存档）
    # 入口伪码：
    #   if import_pack.include_all_characters:
    #       full_replace_actions(import_pack)
    #   else:
    #       partial_replace_actions(import_pack)
    overwrite_strategy: ["full_replace", "partial_replace"]

    full_replace_actions: |
      # 入口：import_pack.include_all_characters == true（全量导入）
      # 1. 校验 import_pack.export_meta.schema_version 与 save_version.current_version 一致
      #    不一致 → 走 13.7 save_version.migration 规则尝试自动迁移；migrate=skip/reset 则按对应 action 处理
      # 1.5. 写入事务标记：localStorage["import_in_progress"] = true
      #      （用于检测下方 step 2~5 期间浏览器崩溃 / 关闭导致的"半新半空"脏状态）
      # 2. 清空当前所有 localStorage：移除全部 player-* + game key（保留 import_in_progress 标记）
      # 3. 写入导入包：localStorage["game"] = import_pack.game; for each player-N → write
      # 4. global_save.character_slots.last_used_slot 沿用导入包中的值；若指向不存在的角色 → 置 null
      # 5. 清除事务标记：localStorage.removeItem("import_in_progress")
      # 6. 触发"导入成功，请重启游戏"toast → 玩家点击后强制 reload page

    partial_replace_actions: |
      # 入口：import_pack.include_all_characters == false（单角色导入）
      # 导入包结构：{ player: { slot_index, data }, export_meta }  —— 不含 game / 不含其他 player
      # 1. 校验 schema_version（同 full_replace step 1）
      # 2. 校验目标槽位号合法：
      #      target_slot = import_pack.player.slot_index
      #      if target_slot > global_save.character_slots.unlocked_count:
      #          return error("目标槽位未解锁，请先在游戏中解锁该栏位")
      # 3. 仅替换对应槽位：localStorage[f"player-{target_slot}"] = import_pack.player.data
      #    不动 global_save、不动其他 player-* 存档
      # 4. 注意：不需要 import_in_progress 事务标记
      #    （单 key 写入是 localStorage 原子操作；不存在"半新半空"风险）
      # 5. 触发"角色导入成功"toast → 不强制 reload（其他角色 / 全局存档无变化）

    # ===== 写盘保护（v1.0）=====
    # import_in_progress=true 期间（仅 full_replace 流程使用），所有非 import 写盘路径必须 no-op return（防御性），
    # 防止 import 进行中其他写盘破坏事务一致性。涉及的写盘函数（所有都要加守卫）：
    #   - save_player_state / save_global_state / on_delete_character / auto_save
    # 实现侧：每个写盘函数入口加 if localStorage.getItem("import_in_progress") == "true": return
    # 注：v1.0 import 后强制 reload，正常路径不会并发；本守卫是为未来 autosave timer 等异步场景兜底
    # partial_replace 不写 import_in_progress 标记（单 key 原子操作，无事务边界问题）

    # ===== 启动时事务恢复检查 =====
    on_startup_check_import: |
      # 每次游戏启动时（先于 character_creation_flow 触发判断）必跑一次：
      if localStorage.getItem("import_in_progress") == "true":
          # 上次导入未完成 → 当前 localStorage 处于"半新半空"脏状态
          # v1.0 简单策略：清空所有相关 key + 走首次启动流程（玩家需要重做创建或重新导入）
          for key in localStorage.keys():
              if key.startswith("player-") or key == "game" or key == "import_in_progress":
                  localStorage.removeItem(key)
          notify_player("上次导入未完成，存档已重置，请重新创建角色或重新导入")
          → 跳转 character_creation_flow（按 on_first_launch 处理）

    # ===== 边界情况 =====
    edge_cases:
      # 注：partial_only 行为已独立为 partial_replace_actions 流程（见上方），不再作为 full_replace 的 edge case
      schema_mismatch: |
        import_pack.export_meta.schema_version != save_version.current_version：
        - 老版本（如 0.x → 1.0）：按 13.7 migration 规则尝试 migrate；不可迁移则拒绝
        - 新版本（导入包来自更新版游戏）：拒绝导入并提示"导入包版本过新，请升级游戏"
      corrupted_pack: |
        base64 解码失败 / JSON parse 失败 / export_meta 缺失 → 拒绝导入并提示"存档包损坏"

存档验证
  validation:
    version_check: true          # 验证存档版本（含 schema_version 比对，详见 import.edge_cases.schema_mismatch）
    data_integrity: true         # 验证数据完整性（base64 解码 + JSON parse 通过）
    auto_migrate: true           # 自动迁移旧版本存档（走 13.7 migration 规则）

13.7 存档版本管理

========== 存档版本控制 ==========
设计取舍（v1.0）：方案 A —— 不预留 v2.0 字段位，靠 migration 机制升级
理由：
- v1.0 schema 保持干净；AI 实现时不会被"durability/pvp_flag/tower_floor"等空字段误导去实现未做功能
- v2.0 新增字段时，统一通过 save_version.migration 一次性补默认值，老存档自动兼容
- 存档体积小，serialize/deserialize 更快
#
未来升级流程（v2.0 范例）：
1. 把 save_data_structure 中需要的新字段直接加上（如 player.durability / player.pvp_flag）
2. 把 current_version 提升到 "2.0"
3. 在 migration 段加一条规则：
"1.0": {
action: "migrate",
description: "为 v1.0 存档补默认值",
field_defaults: {
"player.durability": 100,
"player.pvp_flag": false,
"player.tower_floor": 0
}
}
4. 实现侧 migration runner 按 field_defaults 逐字段写入（仅当字段缺失时）
5. 写入完成后 save_version 字段同步更新到 "2.0"

save_version:
  current_version: "1.0"        # 当前存档版本

版本迁移规则
  migration:
    # 从旧版本迁移时的处理
    # 格式：version: {action: "migrate|skip|reset", description: "..." [, field_defaults: {...}]}
    #   action: migrate → 按 field_defaults 给缺失字段补默认值（保留其他字段不变）
    #   action: skip    → 不迁移、不重置，直接按当前版本读取（仅当 schema 完全兼容）
    #   action: reset   → 老存档无法兼容，重新开始（玩家会丢进度，慎用）
    "0.x": {action: "reset", description: "旧版本存档无法迁移，需重新开始"}
    # v2.0 上线时在此追加 "1.0": {action: "migrate", field_defaults: {...}}


---

