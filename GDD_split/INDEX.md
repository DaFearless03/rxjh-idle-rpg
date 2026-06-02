GDD 章节索引（v1.0）

游戏：文字类自动挂机 RPG（武侠题材，刀剑枪医师 4 职业系）

源文件已拆为 15 个章节文件，每个文件独立可读。AI 实现时按需选读相关章节即可。

章节清单（按章号排序）

文件
行数
内容
[00_intro.md](00_intro.md)
57
文档约定 / v1.0 版本说明 / 战斗设计取舍 / 章节目录
[01_overview.md](01_overview.md)
20
1. 游戏概述（类型、核心循环、长期目标）
[02_attributes.md](02_attributes.md)
705
2. 核心数值系统：四维属性、派生属性、attribute_hooks 钩子、attribute_constants 常量、经验/等级公式、grant_exp/on_level_up
[03_careers.md](03_careers.md)
798
3. 职业系统：12 个职业（4 base + 8 转职）、career_balance
[04_skills_qigong_buff.md](04_skills_qigong_buff.md)
1828
4. 武功 / 气功 / Buff 系统：全部武功 + 22 气功 + Buff 列表
[05_equipment.md](05_equipment.md)
3373
5. 装备系统：槽位、词缀、装备模板、装备列表、石头合成、强化、热血石规则、equip_total_formula
[06_battle.md](06_battle.md)
532
6. 战斗系统：战斗流程、combat_constants、伤害公式、attack_resolution_pipeline
[07_monsters.md](07_monsters.md)
1304
7. 怪物系统：怪物模板（含 critR/critB/armorBreak/shieldRate/counterDamage/leech fallback）+ 94 只怪
[08_maps_npc_quests.md](08_maps_npc_quests.md)
1076
8. 地图 / NPC（含 UIState.active_npc + NPC 分布约束）/ 任务系统（含转职状态机 6 条规则）/ 传送系统
[09_economy_drops.md](09_economy_drops.md)
3069
9. 经济 / 掉落：金币系统、地图掉落池、evaluation_flow（含 drop_helpers + drop_adapters 5 函数）、task_item_drop_config、quest_item_drop_condition、stage_advance_check、submit_quest
[10_consumables.md](10_consumables.md)
325
10. 药剂：定义、限制、自动喝药 / 自动治疗武功 / 自动回城补给 / 药剂商店
[11_inventory.md](11_inventory.md)
197
11. 背包 / 仓库：容量、item_classes 枚举白名单、InventorySystem.count/add/remove、堆叠规则、操作弹窗、forbidden_types
[12_boxes.md](12_boxes.md)
185
12. 盒子系统：盒子定义、开盒流程、monster_drop_box.box_type_by_map 反查表
[13_save.md](13_save.md)
994
13. 存档系统：save_data_structure（玩家/资源/气功/装备/背包/任务/位置/挂机/统计）、restore_player_from_save 契约、global_save_data_structure、global_save_io、startup_sequence、自动存档、离线收益（settle_offline_rewards + simulation_flow + 收益弹窗）、多存档、character_creation_flow、character_deletion_flow、save_transfer（含 full_replace + partial_replace）、版本迁移
[14_tech.md](14_tech.md)
363
14. 技术架构：项目结构（含 InventorySystem.js + OfflineSimulator.js）、核心模块、数据加载、游戏循环、zone 地图页 UI（14.5）、GM 调试面板（14.6）

跨章节关键引用速查

概念
主定义在
关联章节
派生属性公式
02_attributes
06_battle 战斗中实时算
钩子聚合规则（xxxAdd / xxxPct）
02_attributes
05_equipment / 04_qigong / 04_buff
combat_constants（armorBreakDefReduce 等）
06_battle
04_qigong 引用
转职流程 / submit_quest
08_maps_npc_quests
09_economy_drops（stage_advance_check）
InventorySystem
11_inventory
09_economy_drops（drop_adapters 调用）
drop_adapters / drop_helpers
09_economy_drops
11_inventory（InventorySystem）
restore_player_from_save 契约
13_save
13_save 离线模拟 + 启动序列
UIState.active_npc
08_maps_npc_quests
09_economy_drops（submit_quest）
OfflineSimulator
13_save
09_economy_drops（drop_adapters 用 is_in_offline_simulation flag）
全局枚举白名单
11_inventory
全文

v1.0 实现关键约束（必读）

1. 不预留 v2.0 字段：merit 字段已在 hidden_stats，但代码不主动产出（13_save schema 保留为 0）
2. 派生属性 100% camelCase：armorBreak / shieldRate / counterDamage / skillCritRate / buffDuration / healBonus / mpCostReduce / mpRecoveryBonus / enhanceSuccessRate / goldDropBonus / weaponExtraDamage / weaponSkillBonus 等
3. 不存可推导的状态：transfer_count / career_family 由 career 后缀派生（fallback 见 02 / 03）；maxHp/maxMp/atkMin/atkMax/def/hit/missing/critR/critB 全部公式实时算
4. 存档原则 5 条：见 13_save L13138 头部
5. 战斗现场不存档（方案 B）：刷新页面后走 startup_sequence → 离线模拟 → 战斗现场清零重建
6. 任务奖励仅 unlock_career + set_faction：不发 exp / gold / 物品（保持挂机杀怪是唯一进度来源）
7. NPC 仅在城镇：野外 / 战斗中 UIState.active_npc 恒为 null
8. 任务物品规则：允许丢弃 / 禁止入仓 / 禁止出售（仅怪物掉落唯一获取路径）
9. 离线模拟方案 C1：完整 tick-by-tick 重放，60s 分批 yield_to_ui，强制停挂机时 stopped_reason
10. 角色管理：v1.0 不查重 / 不改名 / 不做新手引导；删除角色后 unlocked_count 不回退

实现建议执行顺序（方案 C 62 文件分阶段）

1. 第一阶段（核心骨架）：02 + 03 + 06 + 07 → 实现 Player + AttributeSystem + DamageSystem + BattleSystem + Monster 实体 → "杀第一只怪 + 加经验" 跑通
2. 第二阶段（装备 + 背包）：05 + 11 + 09 → InventorySystem + DropSystem + drop_adapters + EnhanceSystem + SynthesisSystem
3. 第三阶段（NPC + 任务）：08 + 04 → NPC 对话 / 商店 / 任务接取 / 气功投点 / Buff 系统
4. 第四阶段（存档 + 离线）：13 → SaveManager / OfflineSimulator / character_creation_flow / character_deletion_flow / startup_sequence
5. 第五阶段（UI）：14 → MainScreen / ZoneBattleArea / 各 modal / multi_save / GM 面板挂接
6. 第六阶段（药剂 + 盒子 + 收尾）：10 + 12 → ConsumableSystem / BoxSystem / 自动挂机面板 / 平衡测试

每阶段产出可单独测试。

