第一阶段实现 Prompt 模板

目标：跑通"L1 玩家自动攻击怪物 → 杀掉 → 获得经验 → 升级"端到端循环。
无 UI（控制台输出即可）/ 无装备 / 无背包 / 无任务 / 无存档 / 无武功 / 无气功 / 无 Buff / 无离线。
> 完成本阶段约 8-12 个文件，1500-2500 行代码，预计 token ~150-300K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深 JS 游戏开发工程师，现在要按游戏设计文档 (GDD) 实现"挂机文字 RPG"的第一阶段核心骨架。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split
代码输出目录：/Users/hjp/Documents/rxjh/v1.0（不存在则创建）

## 阶段目标（必读后再开工）
跑通这个端到端循环（控制台输出即可，无需 UI）：
1. 创建一个 L1 刀客玩家（warrior_blade，baseHp=100, baseMp=100, str/sta/int/dex 按配置）
2. 进入测试 zone，按 6.1 battle_flow 规则刷怪（initial_spawn_count=1, 2s 预热）
3. 玩家自动攻击场上怪物（只走普攻 normal_attack_damage，不释放武功）
4. 怪物攻击玩家
5. 怪物死亡 → grant_exp + on_level_up（HP/MP 回满 + 气功点+1）
6. 玩家死亡 → apply_player_death（扣经验 + console 提示）
7. 控制台每秒打印一次玩家状态 + 战斗事件

## 实现范围（Phase 1 严格限定）
✅ 必做：
- core/Game.js, core/GameLoop.js, core/EventBus.js
- entities/Player.js, entities/Monster.js
- systems/AttributeSystem.js（recompute 派生属性）
- systems/DamageSystem.js（hit_check + normal_attack_damage + attack_resolution_pipeline）
- systems/BattleSystem.js（1vN 战斗 / 刷怪 / target_lock / 死亡判定）
- utils/random.js, utils/formulas.js
- main.js + index.html（最简）
- data/ 必要 JSON：attributes / careers / monsters / config

❌ 严格不做（Phase 1 不碰）：
- UI 渲染（仅 console.log）
- 装备 / 背包 / 仓库（player.equipped / inventory 都是空 placeholder）
- 武功释放（玩家只走普攻，技能 cd / mp 检查全跳过）
- 气功效果（available_points 字段保留但不触发任何加成）
- Buff 系统
- 任务 / NPC / 商店 / 强化 / 合成 / 盒子
- 存档 / 离线模拟 / 多角色
- 自动喝药 / 自动治疗武功 / 自动回城补给
- GM 面板

## 实现规范

### 1. 先读这些 GDD 章节（不要读 GAME_DESIGN_DOC.md 全文）：
- GDD_split/INDEX.md（必读，了解全局）
- GDD_split/02_attributes.md（base_attributes / attribute_hooks / attribute_constants / 派生属性聚合规则 / grant_exp / on_level_up / apply_death_exp_loss）
- GDD_split/03_careers.md（仅读 warrior_blade base 部分）
- GDD_split/06_battle.md（battle_flow / damage_formulas / combat_constants）
- GDD_split/07_monsters.md（monster_template + 前 5 只怪：stray_cat / toad / fox / wild_bull / wild_boar）

### 2. 严格遵守 GDD 命名约定
- 派生属性 100% camelCase（armorBreak / shieldRate / counterDamage / skillCritRate / weaponSkillBonus 等）
- 配置 block 名 snake_case（attribute_hooks / base_attributes 等）
- 字段 ?? fallback：怪物缺 critR/critB/armorBreak/shieldRate/counterDamage/leech 时取 0/默认值

### 3. EventBus 事件名约定（snake_case）
- "player.level_up" / "player.death" / "monster.death" / "battle.tick" 等

### 4. 派生属性聚合规则（02_attributes 章头部）
任何派生属性 final = base_value + sum(对应 xxxAdd 钩子)；含 *Pct 钩子的走 (base + Add) * (1 + Pct)。

### 5. 战斗 tick 100ms（不可改）

### 6. 输出格式
- 每个 JS 文件用 ES6 module（import/export）
- 每个文件顶部加 JSDoc 说明该文件职责
- 关键函数加 // 注释说明实现的 GDD 章节哪一节
- index.html 是空壳（仅 `<script type="module" src="main.js">`），所有日志走 console

### 7. main.js 写一个最简启动序列
```js
// 1. 加载所有 data/*.json 配置
// 2. 创建 L1 warrior_blade Player
// 3. 创建 BattleSystem，进入测试 zone（如 xuanbo_field 简化版：只放 5 只低级怪）
// 4. GameLoop.start() 跑 100ms tick
// 5. 每秒 console.log 玩家状态（hp/mp/exp/level）+ 最近 5 条战斗事件
```

## 执行流程
1. 先 ls /Users/myxiaojin/Downloads/GDD_split/ 确认章节文件存在
2. Read INDEX.md
3. Read 02 / 03 / 06 / 07 章节
4. 列出本阶段要创建的文件清单（让我确认）
5. 我确认后，逐个创建文件
6. 创建完成后，用 `node main.js` 或 `python -m http.server` 在浏览器跑一下，console 输出"L1 玩家击杀 stray_cat，经验 +3" 之类的日志
7. 我会人工验证后，告诉你"通过"再进 Phase 2

## 边界与原则
- 不发明 GDD 未定义的字段
- 不实现 GDD 未要求的功能（即使你觉得"顺手做了更好"）
- 遇到 GDD 字段缺失或矛盾，停下来问我，不要瞎猜
- 每个文件输出后做语法自检（让 node 解析一遍或简单 grep 检查）

开始吧。先 ls + Read INDEX.md。


---

📋 验收清单（Phase 1 跑通后玩家自检）

打开浏览器 console，应该看到（约 30 秒内）：

[启动] Player Lv1 warrior_blade hp:100/100 mp:100/100 exp:0/100
[刷怪] 野猫 出现（预热 2.0s）
[战斗] 你 → 野猫：12（暴击!）
[战斗] 野猫 → 你：5
[战斗] 你 → 野猫：10
[战斗] 野猫 已倒下
[战斗] 击杀 野猫 → 经验 +3
[刷怪] 蛤蟆 出现（预热 2.0s）
...
[升级] Lv1 → Lv2（+1 气功点，HP/MP 已回满）
[状态] Player Lv2 warrior_blade hp:160/160 mp:120/120 exp:0/229

如果出现：
- ✅ 玩家持续打怪 + 升级 → Phase 1 通过
- ❌ NaN / undefined → 字段映射错，定位修复
- ❌ 玩家秒死 → DamageSystem 公式实现有 bug
- ❌ 经验不增长 → grant_exp / on_level_up 链路断
通过后告诉我"Phase 1 跑通"，我给你 Phase 2 prompt（装备 + 背包 + 掉落）。


---

💡 实操建议

1. 用 Claude Code 跑：自带 prompt cache，章节 read 一次后续基本免费
2. 遇到 AI 瞎猜：立刻打断 → 让 TA 停下来问你 → 你查 GDD 给答案
3. 不要让 AI 一次写完所有文件：让 TA 列出文件清单后，你逐个 review 再实现
4. 第一次跑通预计 2-4 个工时（含来回调试）

