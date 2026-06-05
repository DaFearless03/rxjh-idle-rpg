# Phase6 后续路线清单

记录日期：2026-06-05

## 当前判断

`phase提示语` 目录目前只有 `PHASE_1_PROMPT.md` 到 `PHASE_6_PROMPT.md`，没有 `PHASE_7_PROMPT.md`。Phase6 prompt 将本阶段定义为“v1.0 所有剩余功能 + 上线前 polish”，因此当前下一步不应默认继续扩展新系统，而应先做 v1.0 发布准备。

## 推荐下一项：v1.0 发布准备

优先级：P0

目标：把当前本地可运行版本发布到 GitHub Pages，让外部测试者能访问。

执行顺序：

1. 确认本地代码状态：`git status` 中 `v1.0` 应为 clean；`demo/` 参考文件改动不纳入发布提交。
2. 确认 GM 本地调试文件不上线：`.gitignore` 已包含 `v1.0/gm.js`，`git check-ignore -v v1.0/gm.js` 已通过。
3. 确认启动质量门槛：`ConfigValidator` 为 `0 errors / 0 warnings`，浏览器 smoke 无 error/warning。
4. 在 GitHub 仓库启用 Pages：Settings → Pages → Build and deployment → Deploy from a branch → `main` 分支。
5. 如果 Pages 只能选根目录或 `/docs`，建议新增一个根目录跳转页或改用 `/docs` 发布目录；不要移动 `v1.0` 代码结构前先确认。
6. 发布后访问 `https://DaFearless03.github.io/rxjh-idle-rpg/v1.0/`。
7. 用无 GM 的线上环境跑一次 `journey_test.md` 的人工主流程 smoke。

## 发布前仍建议人工验证

优先级：P1

- 长时间挂机 1 小时，观察战斗日志、掉落日志、页面性能和保存节流。
- 真实离线 24h+ 截断、离线死亡、离线任务物品满包。
- 跨浏览器导入导出：本地导出全部角色，在另一浏览器导入后刷新确认。
- 移动端连续操作：创建角色、NPC、购买、背包、地图、返回角色列表。
- 故障演练：破坏 localStorage、导入中断、配置引用故意改坏后确认 fail-fast。

## 后续开发候选方向

如果 v1.0 发布后继续开发，可从以下方向里选一个作为“Phase7”：

1. 人工长测反馈修复：最稳，优先处理线上试玩发现的卡点、错位、误解文案和移动端问题。
2. 武功学习 UI：当前 `CharacterUI` 仍提示“武功学习 UI 将在后续批次接入”，适合做成 Phase7 的实际功能。
3. 装备穿戴交互：当前装备 UI 有“后续接拖拽穿戴”提示，可补可穿戴校验、穿脱、灰显与提示。
4. v2.0 内容预研：boss、怪物武功、PK/门派战、修理耐久、公会、排行榜、成就、聊天等都属于 GDD 标注的后续大系统。

## 不建议立刻做的事

- 不建议在没有线上试玩反馈前直接开大系统（PK、公会、排行榜），容易把 v1.0 还没验证的基础问题埋得更深。
- 不建议把 `gm.js` 上传，线上版本应保持无 GM 调试入口。
- 不建议为了 GitHub Pages 改乱当前目录结构；若需要根目录入口，优先加轻量跳转页。

## 当前仓库备注

- `v1.0/gm.js` 已被 `.gitignore` 忽略。
- `demo/` 目录存在用户/参考文件改动，当前开发提交一直刻意避开该目录。
- Phase6 验收结论见 `v1.0/tests/phase6_acceptance.md`。
