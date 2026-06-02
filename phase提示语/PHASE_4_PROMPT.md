第四阶段实现 Prompt 模板

> 前置：Phase 1+2+3 已跑通（核心战斗 / 装备背包 / 任务气功 Buff）。
目标：localStorage 存档系统 + 离线模拟完整重放 + 角色创建/删除/多存档切换 + 自动挂机 + 启动序列。
> 完成本阶段约 8-12 个文件，2000-3500 行代码，预计 token ~300-500K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深 JS 游戏开发工程师，继续实现"挂机文字 RPG" 第四阶段：存档 + 离线模拟 + 角色管理 + 自动挂机。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split/
代码目录：/Users/hjp/Documents/rxjh/v1.0/（Phase 1-3 已存在）

## 阶段目标
让玩家完整体验"启动游戏 → 创建角色 → 玩 → 关浏览器 → 重新打开 → 离线收益结算 → 继续玩 → 切角色 → 删角色 → 导入导出存档"全流程：
1. 首次启动检测：localStorage 空 → 进入 character_creation_flow
2. 角色创建：选职业（4 base）+ 输名字（不查重）+ 初始化存档（hp/mp/位置/资源全 0）
3. 多存档列表 UI（console 简化版即可）：[职业 / 名 / 等级 / 所在 zone] + 删除按钮 + 解锁槽位
4. 玩家挂机：is_auto_play=true → BattleSystem 自动跑（前几 phase 已支持）
5. 自动喝药 / 自动治疗武功 / 自动回城补给（按 10.x 配置）
6. 关浏览器 → localStorage 存档保留
7. 重新打开 → startup_sequence 检测 → 触发 OfflineSimulator.settle_offline_rewards 完整 tick 重放
8. 离线模拟结束 → 弹窗显示总结（exp/gold/items/deaths/level_ups 11 字段）
9. 角色删除：X 图标 → 二次确认 → 清存档 / unlocked_count 不回退
10. 导出/导入存档（base64 全量 + 单角色）

## 实现范围（Phase 4 严格限定）
✅ 必做：
- core/SaveManager.js（save_player_state / save_global_state / restore_player_from_save / 写盘保护 import_in_progress / clamp 契约）
- core/StartupSequence.js（13.5 global_save_io.startup_sequence 4 步检测）
- systems/OfflineSimulator.js（settle_offline_rewards / is_in_offline_simulation flag / batched_execution / progress_callback）
- systems/AutoPlaySystem.js（is_auto_play 状态机 + 12 项清挂机规则 / auto_consume / auto_heal_skill / auto_resupply）
- systems/TeleportSystem.js（teleport(sub_zone, source) + source 标记例外）
- flows/character_creation_flow.js（4 步：选职业 / 输名字 / 初始化 / 写入 localStorage）
- flows/character_deletion_flow.js（X 触发 / 二次确认 / 执行删除 / 边界）
- flows/save_transfer.js（导出 base64 / 导入 full_replace / partial_replace 两套流程 / import_in_progress 事务标记 + 启动检测）
- utils/storage.js（localStorage 封装 + 写盘守卫）
- utils/crypto.js（sha256 校验 + base64 编解码）
- data/global_save_init.json（全局存档默认结构：character_slots: {unlocked_count: 3, last_used_slot: null}, schema_version: "1.0"）

✅ 改动现有文件：
- core/Game.js → 启动时调 StartupSequence；每秒触发 SaveManager.save
- main.js → 替换 Phase 1 的硬编码 player 创建 → 走 startup_sequence；加 console 命令（createCharacter / deleteCharacter / switchCharacter / exportSave / importSave）
- entities/Player.js → 字段对齐 13.1 save_data_structure（hp/mp 字段 + offline.last_save_timestamp + statistics + auto_play.* 等）
- systems/BattleSystem.js → 死亡触发 player_death（quest_progress_preserved + 扣经验 + is_auto_play=false）

❌ 严格不做（Phase 4 不碰）：
- UI 渲染（multi_save / 创建 / 删除界面继续走 console 命令；Phase 5 才做 UI）
- GM 面板（Phase 5）
- 战斗日志 UI（Phase 5）
- v2.0 字段（durability/pvp_flag/tower_floor）

## 实现规范

### 1. 必读 GDD 章节
- GDD_split/INDEX.md
- GDD_split/13_save.md（存档 schema / restore 契约 / 自动存档 / 离线模拟 simulation_flow / character_creation_flow / character_deletion_flow / save_transfer / startup_sequence / 版本迁移）
- GDD_split/10_consumables.md（auto_consume / auto_heal_skill / auto_resupply）
- GDD_split/08_maps_npc_quests.md（teleport_system + source 标记例外）
- GDD_split/14_tech.md（systems/ 目录新增 OfflineSimulator.js + InventorySystem.js）

### 2. 关键约定

**13.1 设计原则 5 条**（务必遵守）：
1. 派生属性都不存（hp/mp 是状态值必须存）
2. 装备实例存 key + 强化等级 + synthesis_slots
3. 挂机面板所有勾选 / 阈值进存档
4. 统计字段只留 v1.0 真正展示用的
5. 战斗现场不存档（方案 B）

**restore_player_from_save 契约（5 步顺序不可调换）**：
1. 反序列化存档字段（不读 transfer_count / career_family，按 career 推导）
2. AttributeSystem.recompute 算派生属性
3. clamp hp/mp 到 [0, maxHp/maxMp]
4. 重置运行时瞬态（cooldowns/buffs/last_*_time 全清）
5. 返回 player 对象

**OfflineSimulator.settle_offline_rewards**：
```python
# 入口 set is_in_offline_simulation = True；finally clear
# 5 步：trigger 校验 → restore_player → batched_execution(60s/批) → 走完整 battle_loop tick → 写 save
# 100ms tick / yield_to_ui 让 UI 不冻死
# 5 规则：24h 截断 / 死亡停 / 背包满丢弃 / 真扣金币买药 / 医师治疗
# 任务物品满包停挂机 → summary.stopped_reason
```

**startup_sequence 4 步（不可乱序）**：
1. 检测 import_in_progress（脏导入 → 清空 + 进 character_creation_flow）
2. 检测 localStorage["game"] 是否存在（无 → on_first_launch）
3. 检测有无 player-* 存档（无 → character_creation_flow）
4. 校验 last_used_slot 有效性（指向不存在角色 → 置 null + save）→ show_multi_save_list

**character_creation_flow 4 步**：
1. UI 选职业（4 base）
2. 输名字（1-10 字符 / 中英数下划线 / 不查重）
3. 初始化存档：hp = baseHp / mp = baseMp / gold = 100 / 位置 = town_xuanbo / qigong.available_points = 1 / 其余空
4. 写入：slot_index 优先用 target_slot_index 参数（empty_slot 入口传），否则第一个 unlocked 空槽

**character_deletion_flow 3 步**：
1. UI X 触发 → 弹窗"确认删除「{name}」（Lv{level} {career}）？"
2. 确认后 localStorage.removeItem(player-N) + last_used_slot==N 时置 null + unlocked_count 不回退
3. 刷新列表

**自动挂机规则（10.3）**：
- is_auto_play 进入：玩家点"开始挂机"按钮
- is_auto_play 退出 4 条：手动停 / 死亡 / 金币不足 / 切 zone（系统触发的 zone 切换有 source 标记例外）
- 12 项不清挂机操作明示
- auto_consume：每 100ms tick 检查 hp/mp 阈值 + cooldown 5000ms（独立计时）
- auto_heal_skill：按武功 coolDown 硬循环，无血量阈值
- auto_resupply：触发规则 + 购买规则各自独立 4 条，金币不足 → check_after_purchase 停挂机

**save_transfer**：
- 导出 base64：{ game, players: {player-1, player-3, ...}, export_meta: {schema_version, exported_at, source_device_id} }
- 导入分流：include_all_characters=true 走 full_replace_actions（5 步 + import_in_progress 标记）；false 走 partial_replace_actions（无事务标记）
- v1.0 无 cooldown / 无 min_playtime（已删）

**写盘保护**：save_player_state / save_global_state / on_delete_character / auto_save 入口都加守卫：
```js
if (localStorage.getItem("import_in_progress") === "true") return;
```

### 3. console 命令接口（main.js 扩展）
```js
window.game = {
    // Phase 1-3 已有 ...

    // 角色管理
    createCharacter(career_key, name),      // 创建（target_slot_index 可选）
    deleteCharacter(slot_index),
    switchCharacter(slot_index),
    listCharacters(),                       // 多存档列表
    unlockSlot(slot_index),                 // 解锁槽位

    // 挂机
    startAutoPlay(),
    stopAutoPlay(),
    setAutoConsumeHP(item_key, threshold),
    setAutoConsumeMP(item_key, threshold),
    setAutoHealSkill(skill_key),
    setAutoResupply(rules),

    // 存档
    exportSave({ include_all_characters }),
    importSave(base64_string),

    // 测试用
    fastForwardOffline(hours),              // 模拟离线 N 小时（不真关浏览器）
};
```

## 执行流程
1. ls + Read INDEX + 4 章节
2. 列文件清单 → 我确认
3. 创建/改动
4. 集成测试：
   ```js
   // 1. 首次启动
   localStorage.clear();
   game.restart();                            // 应走 character_creation_flow
   game.createCharacter("warrior_blade", "测试角色");
   game.showPlayer();                         // hp=100 mp=100 gold=100 位置=town_xuanbo

   // 2. 自动挂机
   game.teleport("xuanbo_field");
   game.startAutoPlay();
   game.setAutoConsumeHP("hp_potion_grade1", 0.30);
   game.giveItem("hp_potion_grade1", 50);
   // 玩家应自动战斗 + 喝药

   // 3. 关浏览器模拟
   game.fastForwardOffline(2);                // 模拟 2 小时离线
   // 应弹窗显示 离线 2 小时 / 击杀 N 只 / 经验 +X / 金币 +Y / ...

   // 4. 角色管理
   game.listCharacters();                     // [测试角色 L?? 刀客 ...]
   game.createCharacter("warrior_sword", "测试剑客");
   game.switchCharacter(2);
   game.deleteCharacter(1);
   game.listCharacters();                     // 槽位 1 应空

   // 5. 导出/导入
   const pack = game.exportSave({include_all_characters: true});
   localStorage.clear();
   game.importSave(pack);
   // 应恢复所有角色
   ```

## 边界与原则
- transfer_count 不存档（从 career 字符串后缀推导）
- restore 必须 try/finally 保证 is_in_offline_simulation 清除
- 离线模拟期间 on_level_up 走 summary.level_ups 分支（不触发 EventBus / 不弹窗）
- 删除角色时若是 last_used_slot 必须置 null
- save_transfer 校验 schema_version 不一致时走 13.7 migration
- character_creation 的 slot_index 解析顺序：传入优先 → 第一个空槽 → 越界抛错

开始吧。先 ls + Read。


---

📋 Phase 4 验收清单

按上面"集成测试"5 步全部通过 = Phase 4 完成。核心要看：

测试
期望
首次启动 → 创建角色
localStorage["game"] 写入 + player-1 写入
关浏览器 + 2h 后开
弹窗显示 2h 模拟结果（含击杀数 / 经验 / 金币 / 升级次数 / 死亡）
离线满级时
summary.exp_gained 不报满级后的击杀 exp（自动停累加）
离线模拟期间死亡
summary.stopped_reason="death" + died_at_s
离线模拟期间满包
summary.stopped_reason="inventory_full_quest_item" + quest_item_lost
删除当前角色
last_used_slot 置 null + 列表少 1 个槽
全量导出 + 清空 + 全量导入
所有角色 + 全局存档完整复原

通过后 Phase 5（UI 4 段 + 各 modal + GM 面板挂接）。


---

💡 Phase 4 关键风险

风险
应对
派生属性误存
严格遵守 13.1 设计原则 1（hp/mp 是状态值，maxHp/maxMp 不存）
restore 漏 clamp
hp/mp 必须 clamp 到上限（防 1000/500 诡异显示）
离线模拟 flag 泄漏
finally 保证 clear；异常路径也清
离线模拟 60s/批没 yield
浏览器主线程冻死 → 必须 await yield_to_ui()
import 中途崩溃
import_in_progress 标记 + on_startup_check_import 兜底
auto_consume cooldown 误算
独立计时（不抢战斗 tick）
切 zone 时 close_dialog
UIState.active_npc 必须强制清 null

