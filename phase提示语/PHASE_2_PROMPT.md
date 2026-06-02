第二阶段实现 Prompt 模板

> 前置：Phase 1 已跑通（L1 玩家自动攻击怪 → 升级循环）。
目标：让玩家"杀怪 → 掉装备/石头/金币 → 进背包 → 穿装备（属性提升）→ 强化 → 合成石头"全链路跑通。
> 完成本阶段约 10-15 个文件，2000-3500 行代码，预计 token ~250-450K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深 JS 游戏开发工程师，继续实现"挂机文字 RPG" 第二阶段：装备 + 背包 + 掉落 + 强化合成。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split
代码目录：/Users/hjp/Documents/rxjh/v1.0（Phase 1 已存在）

## 阶段目标
让玩家完整体验"杀怪 → 掉落 → 装备 → 强化 → 合成"循环：
1. 玩家击杀怪物 → 触发 evaluation_flow → 按 sub_zone_drops 配置掉落金币/装备/石头
2. 怪物自身 drop_items 触发任务物品掉落（需玩家接取对应任务才掉；Phase 2 任务系统未做，所以掉落条件返 false，**走通流程即可**）
3. 怪物按 monster_drop_box.drop_rate 概率掉盒子（Phase 2 BoxSystem 未做，仅保留入包不开盒）
4. 所有掉落物入背包（按 InventorySystem.add）
5. 玩家通过 console 命令（或简单 UI）穿装备：`game.equipPlayer("weapon", instance_id)` → 属性面板变化
6. 玩家通过命令强化武器：`game.enhance("weapon")` → 消耗强化石 + 金币 → +1
7. 玩家通过命令合成石头到装备孔位：`game.synthesize("weapon", stoneInstanceId)` → 装备孔位填充 + 属性变化
8. 仓库存取功能跑通：`game.depositItem(...)` / `game.withdrawItem(...)`（任务物品禁止入仓）

## 实现范围（Phase 2 严格限定）
✅ 必做：
- entities/EquipmentInstance.js（装备实例工厂 create_equipment_instance；含 instance_id / item_key / enhance_level / synthesis_slots）
- systems/InventorySystem.js（count / add / remove，三函数；任务物品强保护）
- systems/WarehouseSystem.js（deposit / withdraw；forbidden_types: ["quest_items"]）
- systems/DropSystem.js（evaluation_flow + drop_helpers + drop_adapters 5 个函数）
- systems/EnhanceSystem.js（+0→+10 强化，按 enhance_system 配置成功率 / 失败摧毁）
- systems/SynthesisSystem.js（4 类石头分发到对应装备槽位；合成不可拆）
- utils/uuid.js（v4 UUID 生成）
- data/equipments.json（从 GDD 05 章 equipments 抽取）
- data/stones.json（cold_jade / vajra / enhance_stone / hot_blood 4 类）
- data/sub_zones.json（地图掉落池 sub_zone_drops + monster_drop_box）

✅ 改动现有文件：
- entities/Player.js → 补 equipped / inventory / warehouse / resources 字段
- entities/Monster.js → 补 drop_items 字段 + map_key（实例化时注入）
- systems/AttributeSystem.js → recompute 时聚合 equipped 装备钩子（按 equip_total_formula）
- systems/BattleSystem.js → 怪物死亡时调 DropSystem.evaluate(monster) + grant_gold
- main.js → 加 console 命令接口（window.game.equipPlayer / enhance / synthesize / depositItem 等）

❌ 严格不做（Phase 2 不碰）：
- 任务系统（drop_item_to_player 只走流程，quest_item_drop_condition 直接返 false → 任务物品不掉）
- NPC / 商店（玩家暂时通过 console 命令获得装备/石头测试）
- 气功 / Buff（attribute 钩子聚合只算装备）
- 盒子开盒（盒子能掉落入背包，但 BoxSystem 留空）
- 存档 / 离线模拟
- 战斗中断恢复 / UIState.active_npc / submit_quest
- UI 渲染（继续 console.log）

## 实现规范

### 1. 必读 GDD 章节
- GDD_split/INDEX.md（跨章节速查表）
- GDD_split/05_equipment.md（装备槽位 / 词缀 / 模板 / 装备列表 / 石头 / 强化 / 合成 / equip_total_formula）
- GDD_split/11_inventory.md（item_classes 枚举 / InventorySystem / 堆叠规则 / 操作弹窗 / 仓库 forbidden_types）
- GDD_split/09_economy_drops.md（金币系统 / 掉落池 / evaluation_flow / drop_helpers / drop_adapters / task_item_drop_config / quest_item_drop_condition）

### 2. 关键约定（务必遵守）

**InventorySystem 函数式调用**（不要 OOP）：
- `InventorySystem.count(player, item_key)`
- `InventorySystem.add(player, item_key, count)` → 返回 `{success, added, discarded}`
- `InventorySystem.remove(player, item_key, count)` → 返回 bool

**装备字段对齐 13.1 schema**（不是 Phase 1 Player.js 里的占位）：
```
equipped: { weapon, chest, gloves, boots, inner_armor, cape, amulet, ring: [null,null], earring: [null,null] }
inventory: { capacity: 50, slots: [...], equipment_instances: { <instance_id>: {item_key, enhance_level, synthesis_slots} } }
warehouse: 同 inventory 结构
resources: { gold: 0, training: 0, merit: 0 }
```

**装备字段 → 钩子映射规则**（05 章 equip_total_formula）：
- base_stats.atkMin: 10 → 等价 atkMinAdd 钩子
- 强化加成：武器 +6/级 → enhanced_atkMin_hook = atkMin + enhance_level * 6（作为 atkMinAdd 钩子）
- 防具 +3/级 → 同理对 defAdd
- 武器**分别**注入 atkMinAdd / atkMaxAdd（不用 atkSelfAdd）

**drop_adapters 5 函数（09 章）**：
- drop_gold / drop_equipment / drop_stone / drop_item_to_player / drop_box_to_player
- 全部走 InventorySystem.add（除 drop_gold 直接累加 player.resources.gold）
- is_in_offline_simulation flag = false（Phase 2 无离线）

**evaluation_flow 调用时机**：
怪物死亡瞬间在 BattleSystem 内调 `DropSystem.evaluate(player, monster)`，按 9.x evaluation_flow 完整伪码：
- step 0: 等级差 modifier 计算
- step 1: grant_exp / grant_training（grant_exp 来自 Phase 1 已实现）
- step 2: 地图掉落池金币/装备/石头
- step 3: 怪物 drop_items（quest_item_drop_condition Phase 2 直接返 false 跳过）
- step 4: 盒子（drop_box_to_player 调 InventorySystem.add，盒子入背包但不开）

**强化系统（05 章 5.5.7）**：
- 玩家命令：`game.enhance(slot)`（slot 限于 weapon/chest/gloves/boots/inner_armor）
- 消耗：1 个强化石 + 等级相关金币
- 成功：enhance_level += 1
- 失败：按 failure_behavior: "destroy_equipment" → 装备 + 已合成石头一同消失（卸装空 slot）
- 成功率：按 enhance_system.success_rate.level_N（+1 90% / +2 80% ... +10 0.01%）
- 不可强化：amulet / ring / earring / cape

**合成系统（05 章 5.5.10）**：
- 玩家命令：`game.synthesize(slot, stoneInstanceId)`
- 校验：装备槽位类型匹配石头类型（武器 → vajra、防具 → cold_jade、披风 → hot_blood）
- 校验：装备孔位未满（按 synthesis_slots.slot_capacity 配置）
- 消耗：1 个石头 + 等级相关金币
- 失败：按 failure_behavior: "stone_lost"（石头消失，装备保留）
- 成功：石头堆叠 key 追加到装备.synthesis_slots 数组
- 不可合成：amulet / ring / earring（v1.0 饰品零孔位）

### 3. 输出格式
- ES6 module（import/export）
- 每个文件顶部 JSDoc：本文件职责 + GDD 哪几节
- 关键函数加 `// GDD: 05_equipment.md L<行号>` 注释
- 改动现有文件时，先 Read，最小化 diff

### 4. console 命令接口（main.js 暴露 window.game）
```js
window.game = {
    // Phase 1 已有
    player, battleSystem, ...

    // Phase 2 新增
    equipPlayer(slot, instance_id),
    unequipPlayer(slot),
    enhance(slot),                          // 强化
    synthesize(slot, stone_instance_id),    // 合成
    depositItem(item_key, count),           // 存仓库
    withdrawItem(item_key, count),          // 取仓库
    // 调试用
    giveItem(item_key, count),              // 直接发物品到背包
    giveEquipment(equipment_key),           // 直接造装备实例发背包
    addGold(amount),
    showInventory(),                        // console 打印背包
    showEquipped(),                         // console 打印已穿装备
};
```

## 执行流程
1. ls Phase 1 已创建的文件，确认基线
2. Read 4 个相关 GDD 章节
3. 列出本阶段要创建/改动的文件清单（让我确认）
4. 我确认后逐个创建/修改
5. 完成后做集成测试：
   ```js
   // 在浏览器 console 跑
   game.giveEquipment("blade_base_001");
   game.equipPlayer("weapon", <返回的 instance_id>);
   game.showEquipped();          // 应看到武器
   game.addGold(10000);
   game.giveItem("enhance_stone_01", 10);
   game.enhance("weapon");        // 武器 +1（或失败提示）
   game.giveItem("vajra_01_atkSelfAdd_5", 1);
   game.synthesize("weapon", <石头 instance_id>);
   ```
6. 然后启动战斗，玩家击杀怪物 → console 应看到金币 / 装备 / 石头掉落入背包
7. 我人工验证后告诉你"Phase 2 通过"再进 Phase 3

## 边界与原则
- 严禁实现 Phase 2 范围外的功能（即使顺手能做）
- 遇到 GDD 字段缺失或矛盾，停下来问我
- 数值校验：玩家穿 base_001 武器（atkMin: 10）后，player.atkMin 应增加 10（含 str 贡献）
- 不要把 stoneInstanceId 跟 stone item_key 混淆；石头堆叠 key 格式见 05 章
- 不要发明 GDD 未定义的字段；不要为"美观"加额外字段

开始吧。先 ls + Read INDEX.md + 4 个章节。


---

📋 Phase 2 验收清单

在浏览器 console 跑这套测试，全部通过即 Phase 2 完成：

// 1. 装备基础
game.giveEquipment("blade_base_001");        // 返回 instance_id
game.equipPlayer("weapon", instance_id);
game.showEquipped();                          // 武器槽显示 blade_base_001
// 玩家 atkMin 应增加（base + 武器 atkMin）

// 2. 强化
game.addGold(50000);
game.giveItem("enhance_stone_01", 5);
for (let i = 0; i < 5; i++) game.enhance("weapon");
game.showEquipped();                          // weapon enhance_level 应为 +5 左右（按成功率）

// 3. 合成
game.giveItem("vajra_01_atkSelfAdd_5", 4);
for (let i = 0; i < 4; i++) {
    game.synthesize("weapon", "<vajra stone instance>");
}
game.showEquipped();                          // weapon synthesis_slots 4 个孔位填充

// 4. 仓库
game.giveItem("hp_potion_grade1", 50);
game.depositItem("hp_potion_grade1", 20);
game.showInventory();                         // 背包剩 30
// game.depositItem("任务物品 key", 1) 应被拒绝

// 5. 战斗掉落
game.startBattle("xuanbo_field");             // 进入测试 zone
// 持续 console 输出：
// "击杀 野猪 → 经验 +14"
// "掉落：金币 +25"
// "掉落：装备 [无名战袍]"
// "掉落：石头 [寒玉石]"

通过后 Phase 2 完成，Phase 3 开 NPC + 任务 + 气功 + Buff。


---

💡 Phase 2 关键风险

风险
应对
装备实例 instance_id 混乱
严格区分 instance_id（装备唯一 ID）vs item_key（装备模板 key）
强化 +N 后 atk 计算错
按 05 章 equip_total_formula 严格走"enhanced_xxx_hook 作为单条钩子"
石头堆叠 key 解析错
格式 {base_key}_{attribute_key}_{value}，如 vajra_01_atkSelfAdd_5
InventorySystem.add 返回值未消费
drop_adapters 必须按返回值决策（success / discarded）
仓库存任务物品
必须按 11 章 deposit_popup.forbidden_types 拒绝

