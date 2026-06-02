12. 盒子系统
12.1 盒子定义
=====================================
盒子定义
=====================================
盒子是打怪随机掉落的物品，用于开出装备和药剂
盒子不可出售、不可交易、只能开启
怪物掉落盒子概率：0.001（即千分之一 = 0.1%，每只怪物每次击杀）
背包最大堆叠：999个/格子
#
盒子 ↔ 地图的对应关系单一来源：见 12.3 monster_drop_box.box_type_by_map
此处 boxes 段只定义盒子的属性、内容、开盒物品池；不再重复"哪些地图掉哪种盒子"
#
字段约定：
openable_items[].weight：相对权重（任意正数），不是概率
- 开盒时按 weight 做加权随机：每次开盒抽 1 个 item，p(item) = weight / sum(all weights)
- 不同物品 weight 数量级差异巨大是有意设计：药剂 200 / 饰品 0.4 → 药剂占绝大多数，饰品稀有
- 示例（box_wood）：sum(weight) = 0.4×9 + 200×2 = 403.6
开出某个饰品 ≈ 0.4 / 403.6 ≈ 0.10% / 个；开出某瓶药剂 ≈ 200 / 403.6 ≈ 49.6% / 个

boxes:
- key: "box_wood"
name: "香木盒子"
description: "低级地图掉落的盒子"
max_stack: 999
openable_items:
      # 饰品（base阶段）- 权重0.4/个，饰品总概率≈0.89%
      - item_key: "earring_base_001"
        name: "银耳环"
        weight: 0.4
      - item_key: "earring_base_002"
        name: "白玉耳环"
        weight: 0.4
      - item_key: "earring_base_003"
        name: "金耳环"
        weight: 0.4
      - item_key: "ring_base_001"
        name: "银戒指"
        weight: 0.4
      - item_key: "ring_base_002"
        name: "白金戒指"
        weight: 0.4
      - item_key: "ring_base_003"
        name: "紫玉戒指"
        weight: 0.4
      - item_key: "necklace_base_001"
        name: "灵兽项链"
        weight: 0.4
      - item_key: "necklace_base_002"
        name: "幻身项链"
        weight: 0.4
      - item_key: "necklace_base_003"
        name: "玉影项链"
        weight: 0.4
      # 药剂（grade1）- 权重200/个
      - item_key: "hp_potion_grade1"
        name: "金创药（小）"
        weight: 200
      - item_key: "mp_potion_grade1"
        name: "人参"
        weight: 200

- key: "box_silver"
name: "白银盒子"
description: "中级地图掉落的盒子"
max_stack: 999
openable_items:
      # 饰品（t2阶段）- 权重0.367/个，饰品总概率≈1.00%
      - item_key: "earring_t2_001"
        name: "天灵耳环"
        weight: 0.367
      - item_key: "earring_t2_002"
        name: "紫焰耳环"
        weight: 0.367
      - item_key: "earring_t2_003"
        name: "玄天耳环"
        weight: 0.367
      - item_key: "ring_t2_001"
        name: "地灵戒"
        weight: 0.367
      - item_key: "ring_t2_002"
        name: "万寿戒"
        weight: 0.367
      - item_key: "ring_t2_003"
        name: "麒麟指环"
        weight: 0.367
      - item_key: "ring_t2_004"
        name: "权智指环"
        weight: 0.367
      - item_key: "necklace_t2_001"
        name: "五毒链"
        weight: 0.367
      - item_key: "necklace_t2_002"
        name: "灵心链"
        weight: 0.367
      - item_key: "necklace_t2_003"
        name: "碧玉护符"
        weight: 0.367
      - item_key: "necklace_t2_004"
        name: "金罡护符"
        weight: 0.367
      # 药剂（grade2）- 权重200/个
      - item_key: "hp_potion_grade2"
        name: "金创药（中）"
        weight: 200
      - item_key: "mp_potion_grade2"
        name: "野山参"
        weight: 200

- key: "box_gold"
name: "黄金盒子"
description: "高级地图掉落的盒子"
max_stack: 999
openable_items:
      # 饰品（t3阶段）- 权重0.4/个，饰品总概率≈0.79%
      - item_key: "earring_t3_001"
        name: "圣炎耳环"
        weight: 0.4
      - item_key: "earring_t3_002"
        name: "磐龙耳环"
        weight: 0.4
      - item_key: "ring_t3_001"
        name: "圣冠指环"
        weight: 0.4
      - item_key: "ring_t3_002"
        name: "馨华指环"
        weight: 0.4
      - item_key: "ring_t3_003"
        name: "元始指环"
        weight: 0.4
      - item_key: "necklace_t3_001"
        name: "金灵护符"
        weight: 0.4
      - item_key: "necklace_t3_002"
        name: "圣光项链"
        weight: 0.4
      - item_key: "necklace_t3_003"
        name: "天神护符"
        weight: 0.4
      # 药剂（grade3）- 权重200/个
      - item_key: "hp_potion_grade3"
        name: "金创药（大）"
        weight: 200
      - item_key: "mp_potion_grade3"
        name: "雪原参"
        weight: 200

12.2 开盒UI流程
=====================================
开盒操作流程（点击即开）
=====================================
1. 玩家在背包中点击盒子道具
2. 弹出开盒窗口，显示：
- 盒子的名称和图标
- 开盒数量（默认等于背包中该盒子数量，支持玩家手动修改）
- 开盒按钮
3. 玩家确认数量后，点击开盒按钮
4. 系统根据物品池随机抽取并发放奖励（点击即开，无动画）
5. 奖励直接进入角色背包（如背包满则提示）

box_open_ui:
  title: "开启盒子"
  quantity_selector: true           # 支持选择数量
  default_quantity: "all"          # 默认全选
  confirm_button: "开盒"
  reward_preview: false             # 不显示奖励预览（随机性）

12.3 盒子掉落配置
=====================================
怪物掉落盒子概率
=====================================
所有怪物掉落盒子概率：0.001（即千分之一 = 0.1%）
盒子类型由怪物所在地图决定

monster_drop_box:
  drop_rate: 0.001                  # 每只怪物每次击杀掉落概率（0.001 = 千分之一 = 0.1%）
  box_type_by_map:                  # 地图key决定盒子类型
    wilderness_xuanbo_suburb: "box_wood"
    wilderness_liuzheng: "box_silver"
    wilderness_sanxie: "box_silver"
    wilderness_shenwu: "box_gold"
    wilderness_liushan: "box_gold"
    wilderness_nanminghu: "box_gold"

