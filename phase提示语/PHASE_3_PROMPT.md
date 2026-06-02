第三阶段实现 Prompt 模板

> 前置：Phase 1+2 已跑通（杀怪 / 掉落 / 装备 / 强化 / 合成 全链路）。
目标：NPC 对话 + 商店买卖 + 任务系统（接取/进度/提交）+ 气功投点 + Buff 系统。
> 完成本阶段约 8-12 个文件，1800-3000 行代码，预计 token ~250-400K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深 JS 游戏开发工程师，继续实现"挂机文字 RPG" 第三阶段：NPC + 任务 + 气功 + Buff。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split/
代码目录：/Users/hjp/Documents/rxjh/v1.0/（Phase 1+2 已存在）

## 阶段目标
让玩家完整体验"找 NPC → 接任务 → 打怪收集 → 提交任务 → 转职 → 投点气功"循环：
1. 玩家通过 console 命令打开 NPC 对话（如 `game.talkToNPC("quest_npc")`）→ UIState.active_npc 设置
2. 商店 NPC 可买卖物品（buy_price / sell_price 配置）
3. 任务 NPC 可接取转职任务（按 required_transfer / prerequisite.level 过滤）
4. 玩家挂机刷怪 → 任务物品按 quest_item_drop_condition 真正掉落（Phase 2 是 false 跳过）
5. stage_advance_check 推进任务（拾起任务物品后立即跑）
6. 玩家收齐所有 stage → 任务可提交 → submit_quest 触发自动转职（career 切换 + 装备属性重算）
7. 玩家投点气功（按 attribute_points 分配 available_points）→ AttributeSystem 重算属性
8. Buff 应用 / 过期 / DOT/HOT 触发流程跑通（v1.0 仅"狂风万破" + 6 个医师增益 Buff）

## 实现范围（Phase 3 严格限定）
✅ 必做：
- entities/QuestInstance.js（accepted[] 项的运行时对象 + lookup_active_quest）
- entities/Buff.js（buff 实例 + DOT/HOT 计时）
- systems/NPCSystem.js（open_dialog / close_dialog / UIState.active_npc 状态机；NPC 仅城镇约束）
- systems/ShopSystem.js（商店买卖 / 价格倍率 / forbidden 检查）
- systems/TaskSystem.js（任务接取过滤 / stage_advance_check / submit_quest 5 步流程）
- systems/QigongSystem.js（投点 / 重置 / 加成计算 / earring_qigong_bonus_rules）
- systems/BuffSystem.js（apply_buff / expire / DOT/HOT tick / attribute_mods 注入钩子）
- data/qigong.json（22 个气功 + qigong_effect_types 白名单 + attribute_points 规则）
- data/buffs.json（rage_buff 狂风万破 + 6 个医师增益 Buff）
- data/npcs.json（quest_npc / shop_weapon_and_enhance / shop_armor / shop_potion / warehouse_npc / enhance_npc）
- data/quests.json（quest_templates: 1转/2转正/邪/3转正/邪 共 5 个 + quest_items 定义）
- data/martial_arts.json（武功列表，Phase 3 仅"学会"标记，不实现释放）

✅ 改动现有文件：
- entities/Player.js → 补 quests.accepted/completed / qigong.invested / buffs[] / learned_martial_arts[] 字段
- systems/AttributeSystem.js → recompute 时聚合 Buff 钩子（带 expire 过滤） + 气功加成 + 耳环 qigong 加成
- systems/BattleSystem.js → 战斗 tick 调 BuffSystem.tick / 死亡触发任务进度检查
- systems/DropSystem.js → drop_item_to_player 真正校验 quest_item_drop_condition + 调 stage_advance_check
- main.js → 加 console 命令（talkToNPC / acceptQuest / submitQuest / investQigong / resetQigong 等）

❌ 严格不做（Phase 3 不碰）：
- 武功释放（Phase 4 才做战斗武功）
- 自动喝药 / 自动治疗武功 / 自动回城补给（Phase 4）
- 存档 / 离线模拟（Phase 4）
- 角色创建 / 删除 / 多存档（Phase 4）
- UI 渲染（继续 console.log）
- GM 面板（Phase 5）
- 离线 buff_duration 加成（实现简化版"在线 tick 时按 player.buffDuration 延长"即可）

## 实现规范

### 1. 必读 GDD 章节
- GDD_split/INDEX.md
- GDD_split/04_skills_qigong_buff.md（武功 / 气功 / Buff 全部）
- GDD_split/08_maps_npc_quests.md（NPC / 任务系统 6 条规则 / 转职状态机 / UIState.active_npc / NPC 分布约束 / 派系隔离）
- GDD_split/09_economy_drops.md（quest_item_drop_condition / stage_advance_check / submit_quest）

### 2. 关键约定

**UIState.active_npc 状态机（08 章）**：
- `NPCSystem.openDialog(npc)` → UIState.active_npc = npc
- `NPCSystem.closeDialog()` → UIState.active_npc = null
- 任意切场景 / 角色死亡 / GM 传送 → 强制 closeDialog
- v1.0 NPC 仅城镇，野外恒为 null

**任务接取过滤伪代码（08 章）**：
```
visible_quests = [
  quest_templates[entry.key]
  for entry in quest_npc.quests
  if quest_templates[entry.key].required_transfer <= player.transfer_count
     and player.level >= quest_templates[entry.key].prerequisite.level
     and (quest.faction == null or quest.faction == player.faction or player.faction == "neutral")
     and entry.key not in player.quests.completed
]
```

**stage_advance_check 触发**：仅在"获取任务物品入背包"路径（DropSystem.drop_item_to_player 成功后立即调用）

**submit_quest 5 步（09 章）**：
1. 校验前置（accepted / 全 stage 完成 / UIState.active_npc.npc_key == "quest_npc"）
2. InventorySystem.remove 扣除全部 stage items
3. 应用 rewards（unlock_career 自动按 player.career_family 切 career）
4. accepted → completed
5. UI/log/EventBus("quest.completed")/save_player_state

**自动转职后**：必须立即 AttributeSystem.recompute(player) 重算（新职业 attrGrow 切换）

**气功投点规则（04 章 4.2）**：
- 玩家 available_points >= 投点数才能投
- 单气功最大 20 级
- 投点后立即 AttributeSystem.recompute
- 重置费用按 attribute_reset_count 阶梯（10000 × 10^count）

**气功 effect.type 映射（04 章）**：
- 数值类（atkMin / def / hit 等）→ 走对应 xxxAdd 钩子
- 百分比类（atkMinPct / maxHpPct 等）→ 走对应 xxxPct 钩子
- 特殊类（armorBreak / shieldRate / leech 等概率）→ 走对应 xxxAdd 钩子（概率 0~1）
- weaponSkillBonus（武功攻击力）→ value 是整数百分比基数（5 = 5%）

**Buff 系统（04 章 4.3）**：
- attribute_mods.key 必须是 attribute_hooks 已定义的钩子名（白名单）
- 不允许混用数值 / 百分比（已在 Phase 11/12 全部统一为 *Pct）
- DOT/HOT 按 interval 触发 tick
- buff 过期 = duration 到 → 从 player.buffs[] 移除 + AttributeSystem.recompute
- duration: -1 永久（不过期）

**耳环 qigong 加成规则（05 章 earring_qigong_bonus_rules）**：
- 仅当 player.qigong.invested[k] >= 1 时该气功 +N 级
- 多耳环叠加 sum
- 与热血石叠加：final_skill_level = invested + earring_qigong + sum(hot_blood_skill_level_up matching k)
- 上限 min(skill_level_cap=10, qigong.max_level=20)

### 3. console 命令接口（main.js 扩展）
```js
window.game = {
    // Phase 1+2 已有 ...

    // NPC / 商店
    talkToNPC(npc_key),                  // 打开 NPC 对话
    closeDialog(),
    buyFromShop(npc_key, item_key, count),
    sellToShop(npc_key, item_key, count),

    // 任务
    listAvailableQuests(),               // 当前 NPC 可接任务
    acceptQuest(quest_key),
    submitQuest(quest_key),
    listAcceptedQuests(),

    // 气功
    listQigong(),                        // 玩家可学气功
    investQigong(qigong_key, points),
    resetQigong(),

    // Buff（调试用）
    applyBuff(buff_key),
    listBuffs(),
};
```

## 执行流程
1. ls + Read INDEX + 4 个章节
2. 列文件清单 → 我确认
3. 创建/改动文件
4. 集成测试：
   ```js
   // 装备已存在的 L10 玩家
   game.setLevel(10);                    // 调试函数
   game.talkToNPC("quest_npc");
   game.listAvailableQuests();           // 应看到 quest_transfer_1
   game.acceptQuest("quest_transfer_1");
   game.startBattle("xuanbo_field");     // 打野猪 + 灰狼
   // 等待 stage_advance_check 推进
   game.submitQuest("quest_transfer_1"); // 必须在 quest_npc 处
   // career 应变成 warrior_blade_transfer_1st
   game.investQigong("blade_qigong_atk_min", 20);
   // atkMin 应 +20%
   game.applyBuff("rage_buff");
   // atkMin/atkMax/def 各 +30%
   ```
5. 我人工验证后告诉你"Phase 3 通过"

## 边界与原则
- 不要把 Buff attribute_mods 当 *Pct 钩子的快捷写法（必须是钩子名）
- 不要发明任务奖励类型（v1.0 只有 unlock_career + set_faction）
- 不要在野外触发 submit_quest（UIState.active_npc 必须是 quest_npc）
- 不要在死亡后清空任务进度（quest_progress_preserved: true）
- 严格按 6 条转职任务状态机规则（接取前置 / 不可放弃 / faction 设定 / 自动转职 / 任务物品共用 / stage 严格顺序）

开始吧。先 ls + Read。


---

📋 Phase 3 验收清单

// 1. NPC 对话
game.talkToNPC("quest_npc");          // UIState.active_npc 应是 quest_npc
game.listAvailableQuests();           // L10 应看到 quest_transfer_1

// 2. 任务接取与推进
game.acceptQuest("quest_transfer_1"); // accepted 数组 +1
game.giveItem("boar_leg", 10);        // 调试快速给
game.giveItem("wolf_bone", 3);
// stage_advance_check 自动跑，应推进 completed_stages

// 3. 提交（必须在 quest_npc 处）
game.closeDialog();
game.submitQuest("quest_transfer_1");  // 应报错"请到 quest_npc 处"
game.talkToNPC("quest_npc");
game.submitQuest("quest_transfer_1");  // 应成功 → career 变 warrior_blade_transfer_1st
game.showPlayer();                     // career / transfer_count（派生）应正确

// 4. 派系（2 转分支）
game.setLevel(35);
game.talkToNPC("quest_npc");
game.listAvailableQuests();            // 应看到 transfer_2_positive + transfer_2_negative
game.acceptQuest("quest_transfer_2_positive");  // player.faction 立即 = "positive"
game.listAvailableQuests();            // 此时不应再有 transfer_2_negative

// 5. 气功
game.investQigong("blade_qigong_atk_min", 20);  // atkMinPct +0.20
game.showPlayer();                     // atkMin 应变化（基础 * 1.2）
game.resetQigong();                    // available_points 归还，扣金币
game.showPlayer();                     // atkMin 复原

// 6. Buff
game.applyBuff("rage_buff");           // 狂风万破：atkSelfPct/defPct +0.30
game.showPlayer();                     // atk/def 各 +30%
// 等 15 秒后 buff 过期 → 属性复原

通过后 Phase 4（存档 + 离线模拟 + 角色管理）。


---

💡 Phase 3 关键风险

风险
应对
提交任务时 UIState 校验缺失
submit_quest 严格按 09 章 5 步流程
气功投点没触发 recompute
每次 invest/reset 后必须立即 recompute
Buff 过期没清属性
过期时必须 recompute + 触发 EventBus 通知 UI
stage_advance_check 多触发
只在 drop_item_to_player 成功路径触发，不在 deposit/sell 触发
career_history 漏 append
转职时 player.career_history.append(target_career_key)

