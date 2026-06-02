14. 技术架构
14.1 项目结构

========== 项目结构 ==========
数据来源说明：
本游戏的所有数据配置（职业 / 武功 / 气功 / 装备 / 石头 / 怪物 / 地图 / NPC / 任务 / 药剂 / 盒子 / 掉落池 等）
均来自本文档（GAME_DESIGN_DOC.md），文档主体中以`[可配置]` 标记的 YAML 块即为配置数据。
#
AI 实现时可在以下三种数据组织方式中任选其一（行为等价）：
(a) 编译期内联：把`[可配置]` 块编译进 JS 模块常量（如 `const careers = {...}`），零运行时加载
(b) 构建期生成：构建脚本从本 .md 抽取 → 生成 *.json，运行时按需 fetch
(c) 运行时解析：直接把本 .md 当资源加载，用 yaml parser 解析`[可配置]` 块
#
文件清单只示意"代码组织"，data/ 子目录如何命名、拆几个文件，由实现者决定。
系统类（systems/）的拆分粒度同理：以下列出的是最小集合，实现时可按业务复杂度拆细。

project/
├── index.html                # 入口HTML文件
│
├── js/
│   ├── main.js              # 游戏主入口
│   │
│   ├── core/                # 核心系统
│   │   ├── Game.js          # 游戏主类
│   │   ├── GameLoop.js      # 游戏循环
│   │   ├── EventBus.js      # 事件总线
│   │   └── SaveManager.js   # 存档管理
│   │
│   ├── data/                # 数据配置（命名 / 拆分由实现者决定，见上方"数据来源说明"）
│   │
│   ├── entities/            # 游戏实体
│   │   ├── Player.js        # 玩家
│   │   ├── Enemy.js         # 敌人
│   │   ├── Equipment.js     # 装备
│   │   └── Buff.js          # Buff
│   │
│   ├── systems/             # 游戏系统（最小集合，实现时可拆细）
│   │   ├── BattleSystem.js  # 战斗系统
│   │   ├── DamageSystem.js  # 伤害计算
│   │   ├── DropSystem.js    # 掉落系统
│   │   ├── AttributeSystem.js  # 属性系统
│   │   ├── TaskSystem.js    # 任务系统
│   │   ├── InventorySystem.js  # 背包系统（11 章定义；统一 count/add/remove）
│   │   └── OfflineSimulator.js  # 离线模拟引擎（13.4 settle_offline_rewards + is_in_offline_simulation flag）
│   │
│   ├── ui/                  # 界面
│   │   ├── UIManager.js    # UI管理器
│   │   ├── BattleUI.js      # 战斗界面
│   │   ├── InventoryUI.js   # 背包界面
│   │   ├── EquipUI.js      # 装备界面
│   │   ├── TaskUI.js       # 任务界面
│   │   └── SaveUI.js       # 存档界面
│   │
│   └── utils/               # 工具函数
│       ├── formulas.js      # 公式计算
│       ├── random.js        # 随机数
│       ├── storage.js       # localStorage封装
│       └── crypto.js         # sha256 校验 / 完整性校验
│
├── css/
│   └── style.css           # 样式文件
│
└── assets/                 # 静态资源
    └── icons/              # 图标资源

14.2 核心模块设计

========== 核心模块 ==========

modules:
游戏主类
  Game:
    responsibilities:
      - 管理游戏生命周期（初始化、运行、暂停、结束）
      - 协调各系统之间的交互
      - 处理存档加载和保存
    state:
      - currentPlayer: Player
      - currentStage: Stage
      - gameState: "menu"|"playing"|"paused"|"battle"

游戏循环
  GameLoop:
    update_interval: 100        # 100ms更新一次
    responsibilities:
      - 驱动游戏时间推进
      - 更新战斗、Buff、恢复等状态
      - 触发UI刷新
    methods:
      - start(): void
      - stop(): void
      - pause(): void
      - resume(): void

事件总线
  EventBus:
    responsibilities:
      - 解耦各系统间的通信
      - 分发事件：升级、转职、获得装备、完成任务等
    events:
      - "player.level_up"
      - "player.career_transfer"
      - "battle.start"
      - "battle.end"
      - "item.obtain"
      - "item.equip"
      - "save.complete"

14.3 数据加载流程

========== 数据加载流程 ==========
数据源说明：本流程描述"运行时把游戏配置准备好"的步骤，与具体存储方式（内联常量 / 单 JSON / 多 JSON / 直接解析 .md）无关。
见 14.1 "数据来源说明"。

data_loading:
  steps:
    - step: 1
      name: "加载游戏配置数据"
      action: "load_game_config"
      description: |
        从实现者选择的数据来源（编译期常量 / 构建期 JSON / 运行时 .md 解析）中读入所有 [可配置] 块。
        全部配置在内存中以一棵 GameConfig 对象树承载，后续各系统通过该对象访问。

    - step: 2
      name: "数据验证"
      action: "validate_against_schema"
      description: "对关键引用做断言检查（如 monster.drop_items.item_key 必须在 quest_items 中存在）"

    - step: 3
      name: "建立索引"
      action: "create_lookup_tables"
      description: "为 careers / monsters / equipments / quests 等按 key 建 Map，O(1) 查询"

    - step: 4
      name: "初始化系统"
      action: "initialize_game_systems"
      description: "把 GameConfig 注入各 System（BattleSystem / DropSystem / TaskSystem ...）"

14.4 游戏循环

========== 游戏循环 ==========

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


14.5 zone 地图页战斗区域 UI

========== zone 地图页战斗区域布局 ==========
玩家进入任意野外 sub_zone 后，战斗区域为页面主体；从上到下分 4 段：
段 1：角色实时状态条
段 2：怪物列表
段 3：战斗细节面板
段 4：掉落细节面板
#
高度比例（段 1 / 2 / 3 / 4）：固定为 1 : 1.5 : 2 : 1
- 段 3:段 4 = 2:1 见 Q7 决策
- 段 1 / 2 比例供 UI 实现微调，整段战斗区域要能在 750px 高度的手机屏内一屏显示

battle_zone_ui:
===== 段 1：角色实时状态条 =====
  section_1_player_status:
    layout: "三行进度条 + 数字"
    fields:
      - name: "HP"
        format: "进度条 + '当前值/最大值'（如 280/350）"
        bar_color: "red"
        update_trigger: "每个 100ms tick"
      - name: "MP"
        format: "进度条 + '当前值/最大值'（如 120/240）"
        bar_color: "blue"
        update_trigger: "每个 100ms tick"
      - name: "EXP"
        format: "进度条 + '当前经验/升级所需'（如 5000/12000）；满级时（player.level >= current_level_cap）显示 'Lv60 满级 MAX' + 进度条 100% 高亮金色"
        bar_color: "yellow"
        update_trigger: "击杀怪物 / 死亡损失经验时"

===== 段 2：怪物列表 =====
  section_2_monster_list:
    layout: "每只怪物 1 行"
    row_format: "{name} {hp}/{maxHp}"        # 如 "野猪 120/160"
    sort: "保持刷出顺序（先刷的在上）"
    max_visible: 8                            # 同 zone 上限 8（见 6.1 battle_model.same_zone_monster_cap）
    update_trigger: "怪物刷出 / 受伤 / 死亡"
    preheat_indicator: "预热中的怪物名后追加 (预热 1.3s)"
    elite_indicator: "elite 怪名前追加 ★（金色高亮）"

===== 段 3：战斗细节面板 =====
  section_3_combat_log:
    capacity: 200                              # 环形缓冲，超出从顶部丢弃
    persistence: false                         # 不存档；刷新页面清空；与战斗现场重建一致
    auto_scroll: true                          # 默认追新；玩家手动向上滚 → 暂停 auto_scroll；滚到底部 → 恢复
    record_all_attacks: true                   # Q9 决策：每只怪每次攻击都记一条
    record_all_skill_releases: true            # Q3 决策：玩家每次释放武功都记一条

    # 事件类型与文案模板（| 表示同事件多种变体）
    event_templates:
      - event: "player_normal_attack_hit"
        template: "你 → {target}: {damage}{crit_suffix}"      # crit_suffix 为 ' (暴击!)' 或空
      - event: "player_normal_attack_miss"
        template: "你 → {target}: 未命中"
      - event: "player_skill_release"                          # 力劈华山是气功不是武功，不进此事件
        template: "你 释放 {skill_name} → {target}: {damage}{skill_crit_suffix}"
                                                                # skill_crit_suffix 为 ' (真武绝击!)' 或空
                                                                # AOE 武功首目标按本模板，副目标按 player_skill_aoe_sub
      - event: "player_skill_aoe_sub"
        template: "  ↳ → {target}: {damage}"                   # 缩进表示同次释放的副目标
      - event: "monster_attack_hit"
        template: "{attacker} → 你: {damage}{shield_suffix}"
                                                                # shield_suffix 为 ' (护身! 原 {raw_damage})' 或空
                                                                # 同名怪不编号（Q8 决策），全写 "野猪 → 你"
      - event: "monster_attack_miss"
        template: "{attacker} → 你: 未命中"
      - event: "combo_triggered"
        template: "你 → {target}: {damages_joined} (连击!)"     # damages_joined 如 "120 / 120 / 120"
      - event: "leech_triggered"
        template: "你 → {target}: {damage} (汲取 +{heal} HP)"
      - event: "counter_triggered"
        template: "{attacker} → 你: {damage} → 反伤 {reflected} ({attacker} -{reflected})"
      - event: "armorBreak_triggered"
        template: "你 → {target}: {damage} (破甲!)"
      - event: "auto_consume_hp"
        template: "自动喝药: {item_name} +{recovery} HP"
      - event: "auto_consume_mp"
        template: "自动喝药: {item_name} +{recovery} MP"
      - event: "buff_applied"
        template: "获得 Buff: {buff_name}（{duration}s）"      # duration: -1 永久 Buff 不展示括号
      - event: "buff_expired"
        template: "Buff 消失: {buff_name}"
      - event: "monster_died"
        template: "{monster_name} 已倒下"
      - event: "player_died"
        template: "你 已倒下"

===== 段 4：掉落细节面板 =====
  section_4_reward_log:
    capacity: 200
    persistence: false
    auto_scroll: true

    # 事件类型与文案模板
    event_templates:
      - event: "monster_kill_reward"
        template: "击杀 {monster_name} → 经验 +{exp} / 金币 +{gold}"
      - event: "equipment_dropped"
        template: "获得装备: {equipment_name}"                  # 只显示装备 name，不附 t 段（用户决策）
      - event: "stone_dropped"
        template: "获得石头: {stone_base_name}"                  # 只显示石头基础名（如"寒玉石"），不附属性（用户决策）
      - event: "box_dropped"
        template: "获得盒子: {box_name}"
      - event: "potion_dropped"
        template: "获得药剂: {item_name} ×{count}"               # 同次击杀多瓶合并显示
      - event: "level_up"
        template: "升级！Lv.{from_level} → Lv.{to_level}"
      - event: "exp_loss_on_death"
        template: "死亡损失经验: -{loss}"                         # 与战斗细节"你 已倒下"互补

===== 通用规则 =====
  common_rules:
    color_coding:
      crit: "橙色高亮 '(暴击!)' / '(真武绝击!)' / '(连击!)' / '(破甲!)'"
      heal: "绿色高亮 '+N HP' / '+N MP'"
      damage_to_player: "红色高亮 '{attacker} → 你' 行"
      level_up: "金色高亮整行"
      death: "深红色加粗整行"
    pause_on_scroll: "玩家拖动滚动条向上离底部超过 50px → 暂停 auto_scroll；点击回到底部按钮或滚回底部 → 恢复"
    timestamp: "v1.0 不显示时间戳（条目按时间顺序自然排列）；v2.0 可选添加 'mm:ss'"
    offline_simulation_handling: |
      # 离线模拟期间不写入逐条日志（避免上万条记录占内存且玩家进游戏看不到）
      # 离线模拟产生的事件统一聚合到 13.4 offline_reward.notification 弹窗
      # 上线后玩家点击离线弹窗"确认"，battle_log / reward_log 仍是空状态，与战斗现场清零一致
    save_consistency: "战斗日志 + 怪物列表 + cooldowns 共同遵守 13.1 战斗中断恢复规则（方案 B 不持久化）"


14.6 GM 调试面板（本地专用，不上线）

========== GM 调试面板（本地开发用）==========
用途：游戏作者（GM）在本地调试 / 调数值 / 测试时快速修改自己存档
（加金币 / 加经验 / 给装备 / 切派系 / 满气功 / 传送 / 清存档 等）
#
部署策略（保证不污染线上玩家）：
1. 项目根目录添加文件 gm.js（独立文件，本规范 v1.0 不提供完整代码，由作者自行维护）
2. .gitignore 加入 gm.js → git 不会提交，仓库与 GitHub Pages 上不存在该文件
3. index.html 末尾加<script src="gm.js"></script>
→ 本地有该文件 → 正常加载；线上 404 → 不影响游戏运行
4. 作者换设备时从私人备份（网盘 / Gist / USB）拷贝 gm.js
#
触发与 UI：
- 加载完毕自动注入悬浮面板 DOM，默认隐藏
- 热键 Ctrl+Shift+G 切换显隐
- 面板可拖动；6 个 Tab：资源 / 装备 / 道具 / 状态 / 传送 / 危险
- 每个按钮点击后自动：执行 → 重算属性 → 写存档 → 触发 UI 刷新
#
===== v1.0 实现侧必须提供的全局接口（让 gm.js 能挂上去）=====
命名约定务必稳定，否则 gm.js 的适配层每次都要改；这些接口在游戏初始化完毕后必须可用：
gm_required_globals:
- name: "Game.currentPlayer"
purpose: "当前玩家对象（含 hp/mp/level/exp/gold/inventory/equipped/qigong.invested/qigong.available_points/faction 等存档字段；以及派生只读属性 transfer_count / career_family（由 career 后缀反查，详见 L826-839，不存档）；详见 13.1 save_data_structure）"
- name: "GameConfig"
purpose: "加载完成的全量配置树，至少含 equipments / qigongs / zones / current_level_cap / exp_to_next_level"
- name: "SaveManager.save()"
purpose: "立即写存档到 localStorage"
- name: "EventBus.emit(eventName)"
purpose: "广播事件让所有 UI 模块刷新（gm.js 用 EventBus.emit('gm.refresh')）"
- name: "InventorySystem.add(player, itemKey, count)"
purpose: "向背包添加物品（统一通过 InventorySystem.add；详见 11 章。返回 {success, added, discarded}，调用方按此决策）"
- name: "teleport_system.teleport(subZoneKey)"
purpose: "传送到指定 sub_zone（见 8.4 teleport_system）"
- name: "AttributeSystem.recompute(player)"
purpose: "强制重算 player 的派生属性（gm.js 改完原始字段后调一次，确保面板属性实时同步）"
===== GM 面板能力清单（仅作参考，作者本地实现可增删）=====
gm_panel_capabilities:
  资源: ["+金币", "+经验（自动连升级）", "+气功点", "满 HP/MP", "设置等级"]
  装备: ["给指定装备 key", "一键给所有 base/t1/t2/t3 装备", "当前武器强化到 +10"]
  道具: ["+寒玉石/金刚石/强化石/热血石", "+各级 HP/MP 药剂", "+各类盒子"]
  状态: ["切换 faction（positive/negative/neutral）", "切换 career（直接改 player.career；transfer_count 由 career 后缀自动推导）", "一键满气功", "气功重置"]
  传送: ["动态读 GameConfig.zones 生成每个 sub_zone 一个按钮"]
  危险: ["清背包", "清仓库", "导出/导入存档（剪贴板 base64 或 JSON）", "清空 localStorage + 刷新"]

===== 设计取舍 =====
- 不做"线上版 GM"：纯静态托管无法做真正的权限校验；密码也只是阻挡随手开
- gm.js 不进 git → 线上玩家 0 风险，仓库可以保持公开
- 适配层（GM_API）只用以上 7 个全局接口；接口稳定后 gm.js 不需要随业务改动同步修改
- GM 操作直接走业务函数（InventorySystem.add / teleport_system.teleport 等），
保持与正常玩法等价的副作用链路（堆叠校验、任务校验、刷怪重建等），避免造出畸形存档



---


---

文档版本

版本: 1.0
创建日期: 2024-05-11
基于源码: index.js (挂机类RPG游戏)



---

使用说明：修改 [可配置] 标记的区块即可定制新游戏。所有数值、公式、职业、技能、装备、敌人、关卡均可通过修改对应配置来实现个性化设计。AI可直接读取本文档进行编码实现。

