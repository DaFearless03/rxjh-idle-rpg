第五阶段实现 Prompt 模板

> 前置：Phase 1-4 已跑通（战斗 / 装备 / 任务 / 存档 / 离线 / 多角色 全部 console 命令可操作）。
目标：把所有 console 命令包装成可视化 UI；实现 14.5 zone 战斗 4 段布局 + 各 modal + GM 面板挂接。
> 完成本阶段约 15-20 个文件，3000-5500 行代码 + CSS，预计 token ~400-700K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深前端工程师，继续实现"挂机文字 RPG" 第五阶段：UI 全面化。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split/
代码目录：/Users/hjp/Documents/rxjh/v1.0/（Phase 1-4 已存在）

## 阶段目标
把所有玩家操作从 console 命令升级为可视化 UI。完成后：
1. 玩家进游戏看到主页面（地图列表区 / 战斗区 / 顶部信息栏）
2. 选 zone 进入 → 显示 14.5 四段战斗区（玩家状态 / 怪物列表 / 战斗细节 / 掉落细节）
3. 城镇可点击 NPC → 弹商店 / 任务 / 强化 / 合成 / 仓库等 modal
4. 多存档列表 UI（角色卡 + X 删除 + 解锁按钮）
5. 角色创建 UI（4 职业卡选择 + 名字输入）
6. 离线收益弹窗
7. GM 面板（按 14.6 + 我之前给的模板代码挂接 7 个全局接口）

## 实现范围（Phase 5 严格限定）
✅ 必做（UI 文件）：
- ui/UIManager.js（UI 总控 + modal 层级管理 + toast）
- ui/MainScreenUI.js（主页面骨架：顶部信息栏 + 地图列表区 + 战斗区容器）
- ui/MapListPanelUI.js（左侧地图列表，点击触发 teleport_system.teleport(key, "player_click")）
- ui/ZoneBattleAreaUI.js（14.5 四段战斗区容器）
- ui/PlayerStatusBarUI.js（段 1：HP/MP/EXP 进度条 + 满级"MAX"显示）
- ui/MonsterListUI.js（段 2：怪物列表 + 预热标记 + 精英 ★）
- ui/CombatLogUI.js（段 3：14 种事件模板 + 200 条环形 + auto_scroll + 颜色高亮）
- ui/RewardLogUI.js（段 4：7 种事件模板 + 200 条环形）
- ui/InventoryUI.js（背包界面 + 整理按钮 + 物品弹窗）
- ui/WarehouseUI.js（仓库 + 背包并列，存取按钮）
- ui/EquipUI.js（已穿装备 + 卸装）
- ui/QigongUI.js（气功面板 + 投点 + 重置）
- ui/TaskUI.js（任务面板 + 提交按钮可见性规则）
- ui/ShopUI.js（商店买卖）
- ui/EnhanceUI.js（强化界面：选装备 + 选石头 + +1 按钮 + 成功率显示）
- ui/SynthesisUI.js（合成界面）
- ui/NPCDialogUI.js（NPC 对话窗口 + 多任务列表 + 关闭按钮）
- ui/AutoPlayPanelUI.js（挂机面板：阈值滑块 / 药剂选择下拉 / 治疗武功选择 / 自动补给规则）
- ui/MultiSaveUI.js（多存档列表 + 创建/删除/解锁入口）
- ui/CharacterCreationUI.js（4 职业卡 + 名字输入 + 创建按钮）
- ui/OfflineRewardPopupUI.js（离线收益弹窗 11 字段聚合显示）
- css/style.css（响应式布局：桌面端水平 / 手机端垂直；详见 14.5）

✅ 本地（不提交 git，单独维护）：
- gm.js（参考前面对话中我给的 gm.js 完整模板代码 + 14.6 章 gm_required_globals 7 个接口）
- .gitignore 加 gm.js

✅ 改动现有文件：
- main.js → 加 UIManager 初始化 / EventBus 监听挂接到 UI 刷新 / 暴露 7 个全局接口（Game.currentPlayer / GameConfig / SaveManager.save / EventBus.emit / InventorySystem.add / teleport_system.teleport / AttributeSystem.recompute）供 gm.js 用
- 所有 systems/* 内部触发的 EventBus 事件保证按 14.x 命名规范（player.level_up / player.career_transfer / battle.start 等）

❌ 严格不做（Phase 5 不碰）：
- 不写华丽动画 / 不写图标资源（用文字 emoji 占位即可，如 ⚔️ 🛡️ 💊）
- 不做引导教程（v1.0 设计取舍：不做新手引导）
- 不做改名功能
- 不做战斗中传送以外的复杂动效

## 实现规范

### 1. 必读 GDD 章节
- GDD_split/INDEX.md
- GDD_split/14_tech.md（项目结构 + 核心模块 + 14.5 zone 地图页战斗区域 UI + 14.6 GM 面板）
- GDD_split/11_inventory.md（背包 / 仓库 UI 规则 / 物品弹窗 / 操作限制）
- GDD_split/08_maps_npc_quests.md（NPC 对话 / 任务 UI）
- GDD_split/10_consumables.md（药剂 UI / 自动喝药面板）
- GDD_split/13_save.md（multi_save UI 元素布局 + character_creation_flow + character_deletion_flow + 离线收益弹窗 11 字段）

### 2. 14.5 zone 战斗区 4 段布局（核心）

**高度比例固定 1 : 1.5 : 2 : 1**：
- 段 1：PlayerStatusBarUI（HP/MP/EXP 三条进度条 + 数字）
- 段 2：MonsterListUI（每只怪 1 行 `名 HP/maxHP`，max_visible: 8）
- 段 3：CombatLogUI（200 条环形）
- 段 4：RewardLogUI（200 条环形）

**响应式**：桌面端可选侧边面板 / 手机端固定 4 段垂直

### 3. CombatLogUI 14 种事件模板（务必按 14.5 实现）

```
player_normal_attack_hit:    "你 → {target}: {damage}{crit_suffix}"
player_normal_attack_miss:   "你 → {target}: 未命中"
player_skill_release:        "你 释放 {skill_name} → {target}: {damage}{skill_crit_suffix}"
player_skill_aoe_sub:        "  ↳ → {target}: {damage}"
monster_attack_hit:          "{attacker} → 你: {damage}{shield_suffix}"
monster_attack_miss:         "{attacker} → 你: 未命中"
combo_triggered:             "你 → {target}: {damages_joined} (连击!)"
leech_triggered:             "你 → {target}: {damage} (汲取 +{heal} HP)"
counter_triggered:           "{attacker} → 你: {damage} → 反伤 {reflected} ({attacker} -{reflected})"
armor_break_triggered:       "你 → {target}: {damage} (破甲!)"
auto_consume_hp:             "自动喝药: {item_name} +{recovery} HP"
auto_consume_mp:             "自动喝药: {item_name} +{recovery} MP"
buff_applied:                "获得 Buff: {buff_name}（{duration}s）"
buff_expired:                "Buff 消失: {buff_name}"
monster_died:                "{monster_name} 已倒下"
player_died:                 "你 已倒下"
```

**颜色高亮**：crit 橙色 / heal 绿色 / damage_to_player 红色 / level_up 金色 / death 深红加粗
**滚动规则**：自动追新；玩家手动向上滚 >50px → 暂停 auto_scroll；回底部恢复

### 4. RewardLogUI 7 种事件模板

```
monster_kill_reward:    "击杀 {monster_name} → 经验 +{exp} / 金币 +{gold}"
equipment_dropped:      "获得装备: {equipment_name}"  // 不显示 t 段
stone_dropped:          "获得石头: {stone_base_name}" // 不显示属性
box_dropped:            "获得盒子: {box_name}"
potion_dropped:         "获得药剂: {item_name} ×{count}"
level_up:               "升级！Lv.{from_level} → Lv.{to_level}"
exp_loss_on_death:      "死亡损失经验: -{loss}"
```

### 5. NPC 对话窗口
- 顶部：NPC 名（如"泫渤派门主"）
- 主体：根据 NPC type 显示不同 UI：
  - quest → 可接任务列表 / 可提交任务列表 / 任务详情
  - shop → 商品 grid（带 buy_price） + 玩家背包 grid（带 sell_price，仅可售物品）
  - enhance → 选装备 + 选强化石 + 强化按钮
  - warehouse → 背包 + 仓库并列
- 关闭：右上 X / ESC 键 / 切场景 → closeDialog → UIState.active_npc = null

### 6. multi_save UI 元素（13.5 save_list）
- 已创建角色卡：[职业 / 名字 / 等级 / 所在 zone] + 右侧红色 X 按钮
- 空槽位：["+ 新建角色"] 占位卡 → 点击触发 character_creation_flow(target_slot_index=N)
- 锁定槽位：["🔒 解锁第 N 个栏位（100 金币）"] → 必须在角色内才能解锁

### 7. 角色创建 UI
- 步骤 1：4 个职业卡平铺（warrior_blade/warrior_sword/warrior_spear/healer）
  - 卡片显示：name / icon (用 emoji ⚔️🗡️🛡️💊 占位即可) / description
- 步骤 2：弹窗或下一页：名字输入框 + 校验（1-10 中英数下划线）
- 步骤 3：点击"确认创建" → 走 character_creation_flow.step_3_initialize_save

### 8. 离线收益弹窗（13.4 notification）
显示 11 字段（已在 13.4 summary_fields 定义）：
- elapsed_s / kills / exp_gained / gold_gained / potions_consumed / gold_spent_on_potions
- items_obtained / items_discarded / boxes_obtained / resupply_trips
- deaths/died_at_s（仅死亡时显示）
- stopped_reason/quest_item_lost（强提示样式）
- level_ups（聚合显示"升级 N 次：Lv{from}→Lv{to}（+M 气功点）"）

### 9. CSS 规范（最小集合）
- 暗黑配色（黑底 + 浅灰文字 + 关键操作橙色）
- 等宽字体（monospace）
- 进度条用 div + width%
- 响应式：max-width 750px 屏切 4 段垂直
- 不要引第三方 UI 库（保持依赖 0）

## 执行流程
1. ls + Read INDEX + 5 个章节
2. 列文件清单 → 我确认
3. 创建文件
4. 集成测试：
   - 浏览器打开 index.html
   - 应看到主页面 + 地图列表（含 town_xuanbo + 6 张野外地图）
   - 点 xuanbo_field → 进入战斗区 4 段
   - 段 3 持续滚动战斗日志
   - 点城镇 → 点 NPC → 各 modal 弹出
   - 多存档列表 / 角色创建 / 删除 / 切换 全部走 UI
   - 离线 2h 后开浏览器 → 弹窗
   - 本地 gm.js 加载后 Ctrl+Shift+G 弹出 GM 面板

## 边界与原则
- UI 严格按 EventBus 事件驱动刷新（不要轮询）
- 不要在 UI 里写业务逻辑（UI 只调 systems/* 的对外接口）
- 玩家任何操作都走 systems/* → 系统层处理 → emit EventBus → UI 刷新
- 严禁在 UI 里直接改 player 字段（如 player.gold -= 100；必须 ShopSystem.buy(...) 走链路）
- 暗黑模式 v1.0 唯一主题，不做白天/夜间切换

开始吧。先 ls + Read。


---

📋 Phase 5 验收清单

浏览器打开 index.html，依次通过：

1. 主页面渲染：顶部信息栏 + 地图列表（town + 6 野外）+ 战斗区占位
2. 进 zone：点 xuanbo_field → 4 段渲染（玩家状态 / 怪物列表 / 战斗日志滚动 / 掉落日志滚动）
3. 战斗日志：14 种事件模板都能触发（手动给 buff / 喝药 / 让玩家死 / 触发 leech 等）
4. 掉落日志：杀怪后段 4 出现"击杀 {name} → 经验 +X / 金币 +Y"+ 装备 / 石头 / 升级
5. 城镇 NPC：点 quest_npc → 任务列表 modal；点 shop_armor → 商店 modal；点 enhance_npc → 强化 modal
6. 任务提交：在 quest_npc 处可提交（按钮亮）；在野外不显示提交按钮
7. 气功面板：投点 / 重置 + 实时显示加成效果
8. 多存档：创建 / 删除 / 切换 / 解锁全部走 UI
9. 离线弹窗：fastForwardOffline(2) 后弹窗显示 11 字段
10. GM 面板：本地放 gm.js，Ctrl+Shift+G 唤起，6 个 tab 可操作

通过后 Phase 6（药剂 + 盒子 + 平衡测试 + 收尾）。


---

💡 Phase 5 关键风险

风险
应对
段 3/4 日志频繁刷新卡顿
用 requestAnimationFrame batch update / 不要每条都 reflow
战斗日志环形缓冲实现错
用循环 array + head/tail 指针，不要 splice
modal 层级混乱
UIManager 统一管理 zIndex / 唯一活动 modal
EventBus 重复订阅
UI 组件 destroy 时必须 unsubscribe
响应式断点错
严格 max-width 750px 切布局，桌面端测一遍
GM 面板挂不上
必须确认 main.js 暴露了 14.6 列出的 7 个全局接口
战斗日志事件丢失
EventBus 监听必须在 BattleSystem.start() 之前订阅好

