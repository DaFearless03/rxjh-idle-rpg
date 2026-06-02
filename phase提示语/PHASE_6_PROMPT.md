第六阶段实现 Prompt 模板

> 前置：Phase 1-5 已跑通（核心 / 装备 / 任务 / 存档离线 / UI 全部完成）。
目标：补齐药剂系统 + 盒子开盒系统 + 全流程平衡测试 + 上线前 polish。
> 完成本阶段约 5-8 个文件，1000-2000 行代码，预计 token ~150-300K。


---

📝 给 AI 的 Prompt（直接复制粘贴）

你是一名资深 JS 游戏开发工程师，最后阶段：补齐药剂 + 盒子 + 全流程平衡测试 + 上线前 polish。

## 项目位置
GDD 章节文件：/Users/hjp/Documents/rxjh/GDD_split/
代码目录：/Users/hjp/Documents/rxjh/v1.0/（Phase 1-5 已存在）

## 阶段目标
完成 v1.0 所有剩余功能 + 上线前的端到端流程测试：
1. 药剂手动使用（点击背包药剂 → 立即喝）+ 自动喝药已在 Phase 4 实现
2. 盒子开盒系统（点击背包盒子 → 弹窗选数量 → 按 weighted random 抽物品 → 入背包）
3. 完整玩家旅程跑通：创建 → L1 → L10 接 1 转 → 完成 → L35 接 2 转 → 完成 → L60 接 3 转 → 完成
4. 性能优化：长时间挂机 / 大量 EventBus 事件 / 离线模拟 24h 性能可接受
5. 边界 bug 修复：跨章节集成处 / restore 边界 / clamp 防御 / Buff 过期 race condition 等
6. 上线 polish：错误提示文案 / loading 状态 / 关键按钮 disabled 态 / 配置数据校验

## 实现范围（Phase 6）
✅ 必做：
- systems/ConsumableSystem.js（手动使用 / 实际恢复量 = base × (1 + healBonus or mpRecoveryBonus)）
- systems/BoxSystem.js（开盒：按 openable_items 的 weight 加权随机；点击即开无动画；支持批量开 N 个）
- main.js / 各 UI → 集成 ConsumableSystem 和 BoxSystem 到背包物品操作弹窗

✅ 测试套件（专门用于 Phase 6 验证）：
- tests/journey_test.md（完整玩家旅程脚本：从 L1 创角 → L60 满级 + 3 转完成的可执行步骤清单）
- tests/edge_cases.md（边界场景检查清单：脏存档 / 满包 / 死亡 / 跨设备导入 / GM 改 / Buff 过期等）

✅ Polish：
- 错误提示统一改 UI toast（用 UIManager.showToast）
- 长按 / 双击 / 键盘快捷键（仅 ESC 关 modal / Ctrl+Shift+G 开 GM）
- 配置数据加载完做一次 schema 校验（item_classes 白名单 / faction 白名单 / 引用完整性等）
- localStorage 写盘加 try/catch + 满了的提示

❌ 严格不做（v1.0 范围外）：
- 任何 v2.0 内容（boss / PK / 修理 / 公会 / 排行榜 / 成就 / 聊天）
- 修改 v1.0 已锁定的 GDD 设计取舍
- 性能极致优化（够用即可，不做 web worker / wasm）

## 实现规范

### 1. 必读 GDD 章节
- GDD_split/INDEX.md
- GDD_split/10_consumables.md（药剂恢复量公式 + 药剂使用限制 + 自动喝药 Phase 4 已实现）
- GDD_split/12_boxes.md（盒子定义 / 开盒流程 / monster_drop_box 配置 / weight 抽签规则）
- GDD_split/11_inventory.md（物品操作弹窗 / 不可出售盒子和任务物品）

### 2. 关键约定

**手动喝药**：
- 玩家点击背包药剂 → 弹窗（数量 + 使用按钮）→ ConsumableSystem.use(player, item_key, count)
- 校验 grade_threshold：玩家 level < grade_threshold → 拒绝并 toast"等级不足"
- 计算恢复量：hp_actual = base_recovery × (1 + player.healBonus)；mp_actual 同理 × (1 + player.mpRecoveryBonus)
- 应用：player.hp = min(player.hp + hp_actual, player.maxHp)（不超上限）
- 扣除：InventorySystem.remove(player, item_key, count)
- 日志：CombatLogUI.push("auto_consume_hp" event)（同自动喝药）

**开盒**（12 章 open_box_flow）：
- 玩家点击盒子 → 弹窗"开盒数量"（默认 = 背包中该盒子数量，可手动改）
- 按 openable_items 加权随机：sum = sum(weight); p(item) = weight / sum
- 每次开盒抽 1 个 item；批量 N 次 → 重复抽 N 次
- 每个抽中 item → 走 InventorySystem.add（满包则 toast 提示 + items_discarded）
- 盒子 InventorySystem.remove(player, box_key, count)
- 点击即开（无动画），结果列表 toast 或 modal 一次性显示

**ConsumableSystem 接口**：
```js
ConsumableSystem.use(player, item_key, count) -> { success, recovered, remaining_hp_or_mp }
ConsumableSystem.canUse(player, item_key) -> bool   // 校验 grade_threshold
```

**BoxSystem 接口**：
```js
BoxSystem.openBox(player, box_key, count) -> { obtained: [item_key, count], discarded: [...] }
```

### 3. 配置校验（启动时跑一次）
- 所有 monster.drop_items 的 item_key 在 quest_items 中存在
- 所有 quest_template.rewards.careers 的 key 在 careers 中存在
- 所有 sub_zone_drops.equipment_pool 的 key 在 equipments 中存在
- 所有 stone 配置的 hooks 字段在 attribute_hooks 中存在
- 不通过 → console.error + 阻止启动（防止"打怪后崩"）

### 4. 完整玩家旅程测试脚本（tests/journey_test.md）
按以下顺序在浏览器跑一遍：
```
1. 创角 warrior_blade "测试" → L1 hp=100
2. 在 xuanbo_field 挂机 → 升到 L10
3. talk quest_npc → accept quest_transfer_1
4. 继续挂机刷野猪/灰狼 → 收齐任务物品 → submit
5. career 应变 warrior_blade_transfer_1st
6. 装 base 装备 → 强化几次 → 合成几颗寒玉石
7. 继续挂机 → L35
8. accept quest_transfer_2_positive → faction 立即设 positive
9. 完成 → career 变 warrior_blade_transfer_2st_Z
10. 在 t1 装备 + 满气功 + 自动喝药下 → 挂机 L35-60
11. L60 accept quest_transfer_3_positive
12. 完成 → career 变 warrior_blade_transfer_3st_Z（满级毕业）
13. 整个流程无崩溃 / 无数据丢失 / 离线模拟正常
```

### 5. 边界场景检查（tests/edge_cases.md）
- 玩家死亡 → 任务进度保留 / 装备保留 / hp/mp 回满 / is_auto_play=false
- 离线 24h+ → 截断 + 提示 / 不卡死
- 离线模拟期间死亡 → stopped_reason="death" / died_at_s 填充 / is_auto_play=false
- 离线模拟期间满包任务物品 → stopped_reason="inventory_full_quest_item" + 强提示
- 装备失效（如手动改 localStorage 删了装备实例）→ restore 时 clamp hp/mp 不报错
- 跨设备导入：A 设备 L60 导出 → B 设备空 → 导入 → 完整恢复
- 导入中途关浏览器 → 重启时 import_in_progress 标记触发清理 + 重新创角
- GM 面板乱改：hp=-10 / level=999 → 写盘时 clamp 兜底
- 角色切换时 UIState.active_npc 必须清 null
- 长时间挂机（连续 1 小时无操作）→ 内存 / CPU 占用稳定
- 切窗口 / 后台 → 触发 save_on_hidden / save_on_blur

## 执行流程
1. ls + Read INDEX + 10/12/11 章
2. 列文件清单（含 tests/）→ 我确认
3. 实现 ConsumableSystem + BoxSystem
4. 集成进 InventoryUI 物品弹窗
5. 写 journey_test.md / edge_cases.md
6. 我按 journey_test 跑完整流程，发现 bug 告诉你修
7. 通过后 v1.0 即可上线

## 边界与原则
- 不要新加 v2.0 字段（即使顺手能写）
- 不要改 GDD 已锁定的设计取舍（如任务奖励仅 unlock_career / 不做新手引导 / 离线全 tick 模拟等）
- Polish 仅做"已有功能的表达更友好"，不加新功能
- 性能优化只到"24h 离线 < 3 秒结算 / 长时间挂机不内存泄漏"即可
- 配置校验失败时阻塞启动（不要让玩家进游戏后崩）

开始吧。先 ls + Read。


---

📋 Phase 6 验收清单

1. 手动喝药：背包点药剂 → 弹窗 → 使用 → hp 增加（按 healBonus 加成）
2. 开盒：背包点盒子 → 弹窗 → 输入数量 → 抽物品 → 入背包（满了部分丢弃 + 提示）
3. 完整旅程：按 journey_test.md 一路跑到 L60 满级 + 3 转完成 → 无崩溃
4. 边界场景：edge_cases.md 全部通过
5. 配置校验：故意改坏一条 monster.drop_items 引用 → 启动时报错阻塞

通过后 v1.0 正式可上线。


---

🚀 上线流程

1. git status 确认 gm.js 在 .gitignore（不上线）
2. git add . && git commit -m "v1.0 release"
3. git push 到 GitHub
4. GitHub Pages 配置 → 启用 → 选 main 分支根目录
5. 等几分钟 → 访问 https://<username>.github.io/<repo>/
6. 分享链接给朋友测试
🎉 v1.0 后续维护

- GM 调试：本地 gm.js 不变；线上玩家看不到
- 数值调整：直接改 GDD_split/02_attributes.md / 06_battle.md 等，重新拆出对应 JSON，重新部署即可
- 加新装备 / 怪物 / 任务：在对应章节追加数据，无需改代码
- v2.0 规划：boss / PK / 修理 / 公会 / 排行榜 / 成就 / 聊天 等已在文档里标 v2.0 预留位置


---

💡 Phase 6 关键风险

风险
应对
journey_test 走不完
大概率是 Phase 1-5 某处集成 bug，按 edge_cases.md 二分定位
配置数据引用断
启动时校验 + 早期失败（fail-fast）
内存泄漏（EventBus 监听不释放）
UI 组件 destroy 时务必 unsubscribe
离线 24h 性能
60s/批 + yield_to_ui 在 Phase 4 已实现，确认到位即可
跨浏览器兼容
v1.0 仅承诺 Chrome/Edge/Safari 16.4+；老 Safari 部分 API 不可用（如 CompressionStream，但已删压缩功能）

