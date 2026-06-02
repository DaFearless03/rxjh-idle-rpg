11.背包与仓库系统
=====================================
背包与仓库系统
=====================================

背包与仓库用于存放物品，两者的容量和堆叠规则相同。

背包和仓库容量：各50个格子

========== [可配置] 物品类别枚举（v1.0）==========
物品的 item_class 由其所在 YAML 配置 block 决定（无需在每个物品上加显式字段）：
equipments[]                                                  → "equipment"
cold_jade_stones / vajra_stones / enhance_stones / hot_blood_stones → "stones"
consumables.health_potions / consumables.mana_potions         → "consumables"
quest_items[]                                                  → "quest_items"
boxes[]                                                        → "boxes"
这 5 个值是 v1.0 全部 item_classes，用于驱动 sell / deposit / forbidden_types 等判定。
实现侧约定：运行时按 item.key 反查 → 命中哪个 block 即为该物品的 item_class
item_classes: ["equipment", "stones", "consumables", "quest_items", "boxes"]

========== 全局枚举白名单（v1.0）==========
所有跨章节使用的 enum 字段在此集中声明合法值；AI 实现校验时按此对照，超出白名单的值一律拒绝
faction_classes: ["neutral", "positive", "negative"]
faction 取值语义：neutral=通用 / positive=正派 / negative=邪派
角色创建时 player.faction = "neutral"，接 2 转任务时设定 positive/negative 不可改（详见 8.3）

career_family_classes: ["blade", "sword", "spear", "staff"]
career_family 取值语义：刀客系 / 剑客系 / 枪客系 / 医师系（v1.0 共 4 系）
v2.0 上线弓手 / 刺客系时在此追加；career.career_family 字段必须取自本白名单

monster_type_classes: ["normal", "elite", "boss"]
monster_type 取值语义：普通 / 精英 / 首领
注：boss 类型 v1.0 不进刷怪池（见 6.1 battle_model.spawn_weight），但仍是合法值，v2.0 boss 玩法上线后启用

========== [可配置] 背包容量 ==========
inventory_capacity: 50

========== [可配置] 仓库容量 ==========
warehouse_capacity: 50

========== InventorySystem 标准函数（v1.0）==========
11 章所有 inventory 操作必须通过 InventorySystem.* 函数调用（不直接操作 player.inventory.slots）
统一 add / remove / count 三个原子操作；函数式签名（非 OOP），避免与 13.1 schema 中 inventory 仅是数据字段的认知冲突
InventorySystem:
  count: |
    def count(player, item_key) -> int:
        # 返回背包中该物品总数（仅 inventory，不查 warehouse）
        # 装备实例按 instance_id 单件存储，不参与堆叠 count（如需查装备数量遍历 equipment_instances）
        return sum(slot.count for slot in player.inventory.slots if slot.item_key == item_key)

  add: |
    def add(player, item_key, count) -> { success: bool, added: int, discarded: int }:
        # 添加物品到背包；按规则尝试堆叠 / 新建槽位 / 拒绝
        # 行为顺序：
        #   1. 先尝试堆叠到已有同 key 槽位（按 stack_rules.<class>.max_stack 限制；溢出进入 step 2）
        #   2. 剩余数量 → 新建槽位（直到 player.inventory.capacity 用完，每个新槽位独立 max_stack）
        #   3. 超出容量的部分 → discarded（在线提示玩家"背包已满"、离线累计 summary.items_discarded）
        # 任务物品特例（item_class == "quest_items"）：
        #   - step 3 不丢弃，改为 success=False, added=0, discarded=count
        #   - 调用方决策：在线提示"任务物品无法保存"+ 阻断后续掉落；离线模拟立刻 stopped_reason="inventory_full_quest_item" + 跳出循环
        # 金币 / training / merit：不走 InventorySystem，直接累加 player.resources.<field>

  remove: |
    def remove(player, item_key, count) -> bool:
        # 从背包移除指定数量；按"先扣堆叠最少的槽位"顺序遍历，扣到 0 时释放该槽位
        # 原子性保护：不足时返回 False 且不扣（调用方需先 count 校验或 try 后再回滚）
        # 仅作用于 inventory（不动 warehouse）
        if InventorySystem.count(player, item_key) < count:
            return False
        # 按槽位顺序扣减；释放空槽位
        remaining = count
        for slot in sorted(player.inventory.slots by slot.count asc):
            if slot.item_key != item_key: continue
            take = min(slot.count, remaining)
            slot.count -= take
            remaining -= take
            if slot.count == 0:
                player.inventory.slots.remove(slot)
            if remaining == 0:
                break
        return True

========== [可配置] 物品堆叠规则 ==========
stack_rules:
石头类：同key可堆叠，最多99
  stones:
    stackable: true
    max_stack: 99
    condition: "同key可堆叠"

装备类：不支持堆叠
  equipment:
    stackable: false
    max_stack: 1

药剂类：支持堆叠，最多999
  consumables:
    stackable: true
    max_stack: 999
    condition: "同key（同类型同等级）可堆叠"

盒子类：支持堆叠，最多999
  boxes:
    stackable: true
    max_stack: 999
    condition: "同key（同类型盒子）可堆叠，香木盒子不能与白银盒子混堆"

任务物品类：支持堆叠，最多99
  quest_items:
    stackable: true
    max_stack: 99
    condition: "同key可堆叠"

========== [可配置] 背包满时行为 ==========
物品获取时的处理规则：
1. 若背包已有该物品且未达堆叠上限 → 继续堆叠
2. 若背包无该物品或已达堆叠上限 → 无法保存，提示玩家
inventory_full_behavior:
  can_stack_if_has_slot: true    # 有空位且未达上限时可堆叠
  reject_if_no_space: true       # 无法堆叠时拒绝存入
  notification: "背包已满，请先清理或使用仓库"  # 提示信息

========== [可配置] 物品操作弹窗 ==========
玩家点击物品时的弹窗
item_action_popup:
  title: "物品操作"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - buttons:
        - sell: "出售"
        - discard: "丢弃"
  sell_action:
    description: "点击出售后，按确认数量卖出物品，获得金币"
    # 可出售物品：石头、装备、药剂
    # 不可出售物品：盒子、任务物品
    # allowed_types / forbidden_types 取值范围 = item_classes 枚举
    allowed_types: ["stones", "equipment", "consumables"]
    forbidden_types: ["boxes", "quest_items"]
  discard_action:
    description: "点击丢弃后，按确认数量丢弃物品，物品消失，不可恢复"

========== [可配置] 仓库操作规则 ==========
点击仓库NPC后，同时打开角色仓库和角色背包
warehouse_npc_action:
  open_ui: ["inventory", "warehouse"]  # 同时打开背包和仓库界面

背包物品存入仓库
deposit_popup:
  title: "存入仓库"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - button: "存入"
  condition:
    - target: "inventory"  # 从背包存入
    - result: "warehouse"  # 到仓库
v1.0 禁止入仓的物品类别（与 item_action_popup.sell_action.forbidden_types 类似机制）
任务物品禁止入仓：保证 stage_advance_check 只在"背包计数"上判定，进度可预测、无歧义
forbidden_types 取值范围 = item_classes 枚举
  forbidden_types: ["quest_items"]
  forbidden_warning: "该物品不可存入仓库"

仓库物品取出至背包
withdraw_popup:
  title: "取出物品"
  contents:
    - item_name: "物品名称"
    - item_count: "数量（默认为该格子堆叠总数，可手动修改）"
    - button: "取出"
  condition:
    - target: "warehouse"  # 从仓库取出
    - result: "inventory"  # 到背包

仓库操作限制
warehouse_operation_limit:
  full_inventory_warning: "背包已满，无法取出"
  full_warehouse_warning: "仓库已满，无法存入"
仓库物品操作限制：只能取出，出售和丢弃只能在背包中进行
  warehouse_item_actions:
    can_withdraw: true
    can_sell: false
    can_discard: false

========== [可配置] 物品整理功能 ==========
背包、仓库界面各有"整理"按钮，点击后按key值字母顺序排序
sort_button:
  inventory_button: "整理"
  warehouse_button: "整理"
  sort_rule: "按key值字母顺序排序"

========== [可配置] 金币显示 ==========
金币不占用背包格子，仅在背包界面展示数值
gold_display:
  not_in_slot: true
  display_only: true

