4. 武功与气功系统
4.1 武功系统

========== [可配置] 武功模板 ==========

martial_art_template:
  key: "武功唯一标识"
  name: "武功名称"
  description: "武功描述"

效果类型
  type: "damage"    # damage(伤害) / buff(增益) / heal(治疗)

目标
  target: "single"  # single(单体) / aoe(群体)

冷却时间（毫秒）
  coolDown: 1000

释放消耗
  cost:
    mp: 20           # 内功消耗

学习消耗
  learning_cost:
    training: 100     # 历练消耗

效果
  effect:
    value: 50        # damage: 伤害值 / heal: 恢复值 / buff: 对应Buff Key
    target_count: 1   # 群体技能可攻击目标数量（仅target为aoe时有效）

学习条件
  requirement:
    level: 10
    career_family: "blade"  # 职业系
    faction: "positive"   # 正派 (可选，不填表示无职业限制)

4.1.1 武功数据配置
========== [可配置] 武功列表 ==========
武功按职业系、等级和正邪派划分

martial_arts:
===== 刀客武功 =====
- key: "blade_fury_wind_flame"
name: "疾风烈火"
description: "刀客1转技能，以疾风之势催动烈火，造成大额伤害"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 5
learning_cost:
  training: 150
requirement:
  level: 10
  career_family: "blade"
  min_transfer: 1
effect:
  value: 30
- key: "blade_fury_wind_wood"
name: "疾风断木"
description: "刀客1转技能，疾风之力可断木，威力更强"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 10
learning_cost:
  training: 1600
requirement:
  level: 20
  career_family: "blade"
  min_transfer: 1
effect:
  value: 45
- key: "blade_fury_wind_shadow"
name: "疾风残影"
description: "刀客1转技能，疾风如残影般锋利，威力巨大"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 15
learning_cost:
  training: 8800
requirement:
  level: 30
  career_family: "blade"
  min_transfer: 1
effect:
  value: 65
- key: "blade_fury_desert"
name: "狂沙遍野"
description: "刀客2转技能，黄沙万里，威力无穷"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 32000
requirement:
  level: 35
  career_family: "blade"
  min_transfer: 2
  faction: "positive"
effect:
  value: 85
- key: "blade_fury_cloud"
name: "风卷残云"
description: "刀客2转技能，风暴席卷，残云难存"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 50000
requirement:
  level: 45
  career_family: "blade"
  min_transfer: 2
  faction: "positive"
effect:
  value: 100
- key: "blade_fury_godghost"
name: "鬼神绝杀"
description: "刀客2转技能，群体武功，可同时攻击4个目标，威力惊天"
type: "damage"
target: "aoe"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 120000
requirement:
  level: 55
  career_family: "blade"
  min_transfer: 2
  faction: "positive"
effect:
  value: 110
  target_count: 4
  # ===== 刀客邪派2转武功 =====
- key: "blade_fury_dragon"
name: "灭世屠龙"
description: "刀客2转技能，邪派武学，威力惊人"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 32000
requirement:
  level: 35
  career_family: "blade"
  min_transfer: 2
  faction: "negative"
effect:
  value: 85
- key: "blade_fury_blade"
name: "灭世裂刃"
description: "刀客2转技能，邪派武学，无坚不摧"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 50000
requirement:
  level: 45
  career_family: "blade"
  min_transfer: 2
  faction: "negative"
effect:
  value: 100
- key: "blade_fury_heaven"
name: "灭世劈天"
description: "刀客2转技能，邪派群体武功，威力惊天"
type: "damage"
target: "aoe"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 120000
requirement:
  level: 55
  career_family: "blade"
  min_transfer: 2
  faction: "negative"
effect:
  value: 110
  target_count: 4
  # ===== 刀客正派3转武功 =====
- key: "blade_fury_cinnabar"
name: "丹红五炼"
description: "刀客正派3转技能，修炼至化境的绝学"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "blade"
  min_transfer: 3
  faction: "positive"
effect:
  value: 150
- key: "blade_fury_tenpin"
name: "丹红天忍"
description: "刀客正派3转技能，天忍之名，威震八方"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "blade"
  min_transfer: 3
  faction: "positive"
effect:
  value: 180
- key: "blade_fury_brush"
name: "丹红拂面"
description: "刀客正派3转技能，群体武功，可攻击4个目标"
type: "damage"
target: "aoe"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "blade"
  min_transfer: 3
  faction: "positive"
effect:
  value: 150
  target_count: 4
  # ===== 刀客邪派3转武功 =====
- key: "blade_fury_bloodsand"
name: "血流黑沙"
description: "刀客邪派3转技能，邪派绝学，威力惊人"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "blade"
  min_transfer: 3
  faction: "negative"
effect:
  value: 150
- key: "blade_fury_bloodfield"
name: "血流遍野"
description: "刀客邪派3转技能，血流千里，遍地尸骸"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "blade"
  min_transfer: 3
  faction: "negative"
effect:
  value: 180
- key: "blade_fury_bloodearth"
name: "血流地裂"
description: "刀客邪派3转技能，群体武功，可攻击4个目标"
type: "damage"
target: "aoe"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "blade"
  min_transfer: 3
  faction: "negative"
effect:
  value: 150
  target_count: 4
  # ===== 剑客正派1转武功 =====
- key: "sword_fury_wave"
name: "碧波潮生"
description: "剑客1转技能，碧波荡漾，潮生不息"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 5
learning_cost:
  training: 160
requirement:
  level: 10
  career_family: "sword"
  min_transfer: 1
effect:
  value: 35
- key: "sword_fury_dance"
name: "劲风魅舞"
description: "剑客1转技能，剑影如魅，劲风随形"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 12
learning_cost:
  training: 1800
requirement:
  level: 20
  career_family: "sword"
  min_transfer: 1
effect:
  value: 50
- key: "sword_fury_moon"
name: "皓月当空"
description: "剑客1转技能，皓月高悬，光照大地"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 18
learning_cost:
  training: 9000
requirement:
  level: 30
  career_family: "sword"
  min_transfer: 1
effect:
  value: 70
  # ===== 剑客正派2转武功 =====
- key: "sword_fury_thunder"
name: "雷霆霹雳"
description: "剑客正派2转技能，雷声轰鸣，霹雳惊天"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 33000
requirement:
  level: 35
  career_family: "sword"
  min_transfer: 2
  faction: "positive"
effect:
  value: 90
- key: "sword_fury_thundershadow"
name: "雷霆残影"
description: "剑客正派2转技能，雷霆之势，如影随形"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 52000
requirement:
  level: 45
  career_family: "sword"
  min_transfer: 2
  faction: "positive"
effect:
  value: 105
- key: "sword_fury_thunderworld"
name: "雷霆四海"
description: "剑客正派2转技能，雷霆震四海，威遍八方"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 125000
requirement:
  level: 55
  career_family: "sword"
  min_transfer: 2
  faction: "positive"
effect:
  value: 125
  # ===== 剑客邪派2转武功 =====
- key: "sword_fury_ghostsound"
name: "鬼煞之音"
description: "剑客邪派2转技能，鬼煞之音，摄人心魄"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 33000
requirement:
  level: 35
  career_family: "sword"
  min_transfer: 2
  faction: "negative"
effect:
  value: 90
- key: "sword_fury_ghoststrike"
name: "鬼煞一击"
description: "剑客邪派2转技能，鬼煞之击，一击必杀"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 52000
requirement:
  level: 45
  career_family: "sword"
  min_transfer: 2
  faction: "negative"
effect:
  value: 105
- key: "sword_fury_ghostdestroy"
name: "鬼煞灭天"
description: "剑客邪派2转技能，鬼煞灭天，毁天灭地"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 125000
requirement:
  level: 55
  career_family: "sword"
  min_transfer: 2
  faction: "negative"
effect:
  value: 125
  # ===== 剑客正派3转武功 =====
- key: "sword_fury_piercemountain"
name: "碧波贯山"
description: "剑客正派3转技能，碧波之力，可贯山岳"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "sword"
  min_transfer: 3
  faction: "positive"
effect:
  value: 150
- key: "sword_fury_pierceair"
name: "碧波贯气"
description: "剑客正派3转技能，碧波之气，可贯虚空"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "sword"
  min_transfer: 3
  faction: "positive"
effect:
  value: 180
- key: "sword_fury_killsquare"
name: "碧波杀阵"
description: "剑客正派3转技能，碧波杀阵，威力惊天"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "sword"
  min_transfer: 3
  faction: "positive"
effect:
  value: 250
  # ===== 剑客邪派3转武功 =====
- key: "sword_fury_sandstorm"
name: "裟衣激风"
description: "剑客邪派3转技能，裟衣之功，激风如刃"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "sword"
  min_transfer: 3
  faction: "negative"
effect:
  value: 150
- key: "sword_fury_willow"
name: "裟衣拂柳"
description: "剑客邪派3转技能，裟衣之功，拂柳无痕"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "sword"
  min_transfer: 3
  faction: "negative"
effect:
  value: 180
- key: "sword_fury_falling"
name: "裟衣落英"
description: "剑客邪派3转技能，裟衣之功，落英无情"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "sword"
  min_transfer: 3
  faction: "negative"
effect:
  value: 250
  # ===== 枪客1转武功 =====
- key: "spear_fury_cloudpierce"
name: "震云贯日"
description: "枪客1转技能，震云贯日，气贯长虹"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 5
learning_cost:
  training: 170
requirement:
  level: 10
  career_family: "spear"
  min_transfer: 1
effect:
  value: 40
- key: "spear_fury_miststrike"
name: "腾雾强击"
description: "枪客1转技能，腾雾出击，威力强绝"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 12
learning_cost:
  training: 1900
requirement:
  level: 20
  career_family: "spear"
  min_transfer: 1
effect:
  value: 55
- key: "spear_fury_secret"
name: "密传绝杀"
description: "枪客1转技能，密传绝杀，一击必杀"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 18
learning_cost:
  training: 9200
requirement:
  level: 30
  career_family: "spear"
  min_transfer: 1
effect:
  value: 75
  # ===== 枪客正派2转武功 =====
- key: "spear_fury_chainkill"
name: "连环归灭"
description: "枪客正派2转技能，连环攻击，归灭一切"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 34000
requirement:
  level: 35
  career_family: "spear"
  min_transfer: 2
  faction: "positive"
effect:
  value: 100
- key: "spear_fury_chaindragon"
name: "连环屠龙"
description: "枪客正派2转技能，连环屠龙，威力惊天"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 54000
requirement:
  level: 45
  career_family: "spear"
  min_transfer: 2
  faction: "positive"
effect:
  value: 115
- key: "spear_fury_chaindeath"
name: "连环绝杀"
description: "枪客正派2转技能，连环绝杀，威力无极"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 128000
requirement:
  level: 55
  career_family: "spear"
  min_transfer: 2
  faction: "positive"
effect:
  value: 135
  # ===== 枪客邪派2转武功 =====
- key: "spear_fury_ignite"
name: "火星乍现"
description: "枪客邪派2转技能，火星乍现，威力惊燃"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 34000
requirement:
  level: 35
  career_family: "spear"
  min_transfer: 2
  faction: "negative"
effect:
  value: 100
- key: "spear_fury_backbone"
name: "中流砥柱"
description: "枪客邪派2转技能，中流砥柱，坚不可摧"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 54000
requirement:
  level: 45
  career_family: "spear"
  min_transfer: 2
  faction: "negative"
effect:
  value: 115
- key: "spear_fury_overlord"
name: "威凌天下"
description: "枪客邪派2转技能，威凌天下，谁与争锋"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 128000
requirement:
  level: 55
  career_family: "spear"
  min_transfer: 2
  faction: "negative"
effect:
  value: 135
  # ===== 枪客正派3转武功 =====
- key: "spear_fury_whiteTiger"
name: "白虎吞天"
description: "枪客正派3转技能，白虎之名，吞天灭地"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "spear"
  min_transfer: 3
  faction: "positive"
effect:
  value: 150
- key: "spear_fury_sorrow"
name: "哀伤魔枪"
description: "枪客正派3转技能，哀伤之枪，魔威难挡"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "spear"
  min_transfer: 3
  faction: "positive"
effect:
  value: 180
- key: "spear_fury_tortoise"
name: "龟寿裂杀"
description: "枪客正派3转技能，龟寿之功，一裂天下"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "spear"
  min_transfer: 3
  faction: "positive"
effect:
  value: 250
  # ===== 枪客邪派3转武功 =====
- key: "spear_fury_rebelliondragon"
name: "逆天灭龙"
description: "枪客邪派3转技能，逆天之功，灭龙无形"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 35
learning_cost:
  training: 124000
requirement:
  level: 60
  career_family: "spear"
  min_transfer: 3
  faction: "negative"
effect:
  value: 150
- key: "spear_fury_rebellionstar"
name: "逆天煞星"
description: "枪客邪派3转技能，逆天之煞，星落尘凡"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 132000
requirement:
  level: 64
  career_family: "spear"
  min_transfer: 3
  faction: "negative"
effect:
  value: 180
- key: "spear_fury_rebelliondemon"
name: "逆天将魔"
description: "枪客邪派3转技能，逆天之将，魔颤抖栗"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 143000
requirement:
  level: 68
  career_family: "spear"
  min_transfer: 3
  faction: "negative"
effect:
  value: 250
  # ===== 医师1转武功 =====
- key: "staff_fury_shadowpalm"
name: "绝影神掌"
description: "医师1转技能，绝影神掌，妙手回春"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 10
learning_cost:
  training: 150
requirement:
  level: 10
  career_family: "staff"
  min_transfer: 1
effect:
  value: 50
  # ===== 医师正派2转武功 =====
- key: "staff_fury_sunnycold"
name: "青阳寒天"
description: "医师正派2转技能，青阳一出，寒天必灭"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 10000
requirement:
  level: 35
  career_family: "staff"
  min_transfer: 2
  faction: "positive"
effect:
  value: 80
- key: "staff_fury_sunnybreak"
name: "青阳破天"
description: "医师正派2转技能，青阳破天，威力无穷"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 20000
requirement:
  level: 45
  career_family: "staff"
  min_transfer: 2
  faction: "positive"
effect:
  value: 100
- key: "staff_fury_sunnychaos"
name: "青阳乱天"
description: "医师正派2转技能，青阳乱天，毁天灭地"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 32000
requirement:
  level: 55
  career_family: "staff"
  min_transfer: 2
  faction: "positive"
effect:
  value: 150
  # ===== 医师邪派2转武功 =====
- key: "staff_fury_northblood"
name: "北冥凝血"
description: "医师邪派2转技能，北冥神功，凝血无形"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 10000
requirement:
  level: 35
  career_family: "staff"
  min_transfer: 2
  faction: "negative"
effect:
  value: 80
- key: "staff_fury_northsoul"
name: "北冥夺魄"
description: "医师邪派2转技能，北冥夺魄，摄人心魂"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 20000
requirement:
  level: 45
  career_family: "staff"
  min_transfer: 2
  faction: "negative"
effect:
  value: 100
- key: "staff_fury_northheart"
name: "北冥破心"
description: "医师邪派2转技能，北冥破心，心神俱灭"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 32000
requirement:
  level: 55
  career_family: "staff"
  min_transfer: 2
  faction: "negative"
effect:
  value: 150
  # ===== 医师正派3转武功 =====
- key: "staff_fury_goldpalm"
name: "金掌敌虎"
description: "医师正派3转技能，金掌一出，敌虎难逃"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 50
learning_cost:
  training: 120000
requirement:
  level: 60
  career_family: "staff"
  min_transfer: 3
  faction: "positive"
effect:
  value: 180
- key: "staff_fury_goldphoenix"
name: "金掌破凰"
description: "医师正派3转技能，金掌破凰，威震四方"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 60
learning_cost:
  training: 130000
requirement:
  level: 64
  career_family: "staff"
  min_transfer: 3
  faction: "positive"
effect:
  value: 220
- key: "staff_fury_golddragon"
name: "金掌绝龙"
description: "医师正派3转技能，金掌绝龙，毁龙灭敌"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 70
learning_cost:
  training: 141000
requirement:
  level: 68
  career_family: "staff"
  min_transfer: 3
  faction: "positive"
effect:
  value: 250
  # ===== 医师邪派3转武功 =====
- key: "staff_fury_supreme_mountain"
name: "独尊移山"
description: "医师邪派3转技能，独尊之功，移山填海"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 50
learning_cost:
  training: 120000
requirement:
  level: 60
  career_family: "staff"
  min_transfer: 3
  faction: "negative"
effect:
  value: 180
- key: "staff_fury_supreme_sea"
name: "独尊填海"
description: "医师邪派3转技能，独尊填海，威不可挡"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 60
learning_cost:
  training: 130000
requirement:
  level: 64
  career_family: "staff"
  min_transfer: 3
  faction: "negative"
effect:
  value: 220
- key: "staff_fury_supreme_gold"
name: "独尊熔金"
description: "医师邪派3转技能，独尊熔金，无坚不摧"
type: "damage"
target: "single"
coolDown: 1000
cost:
  mp: 70
learning_cost:
  training: 141000
requirement:
  level: 68
  career_family: "staff"
  min_transfer: 3
  faction: "negative"
effect:
  value: 250
  # ===== 医师治疗武功 =====
- key: "staff_fury_heal"
name: "运气疗伤"
description: "医师1转技能，运气疗伤，回复生命"
type: "heal"
target: "single"
coolDown: 1000
cost:
  mp: 10
learning_cost:
  training: 0
requirement:
  level: 1
  career_family: "staff"
  min_transfer: 0
effect:
  value: 110
- key: "staff_fury_restore"
name: "回气疗伤"
description: "医师1转技能，回气疗伤，恢复能力更强"
type: "heal"
target: "single"
coolDown: 1000
cost:
  mp: 15
learning_cost:
  training: 150
requirement:
  level: 15
  career_family: "staff"
  min_transfer: 1
effect:
  value: 160
- key: "staff_fury_gatherheal"
name: "聚气疗伤"
description: "医师2转技能，聚气疗伤，群体治愈，可治疗4个队友"
type: "heal"
target: "aoe"
coolDown: 1000
cost:
  mp: 50
learning_cost:
  training: 10000
requirement:
  level: 35
  career_family: "staff"
  min_transfer: 2
effect:
  value: 180
  target_count: 4
- key: "staff_fury_taiji"
name: "太极五行"
description: "医师1转技能，太极五行，增加20%攻击力"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 20
learning_cost:
  training: 1500
requirement:
  level: 20
  career_family: "staff"
  min_transfer: 1
effect:
  value: 0.2
  buff_key: "atk_up_20"
- key: "staff_fury_bagua"
name: "太极八卦"
description: "医师1转技能，太极八卦，增加5%防御力"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 25
learning_cost:
  training: 3500
requirement:
  level: 30
  career_family: "staff"
  min_transfer: 1
effect:
  value: 0.05
  buff_key: "def_up_5"
- key: "staff_fury_gangqi"
name: "太极罡气"
description: "医师1转技能，太极罡气，增加10%防御力"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 5000
requirement:
  level: 30
  career_family: "staff"
  min_transfer: 1
effect:
  value: 0.1
  buff_key: "def_up_10"
- key: "staff_fury_strengthen"
name: "强筋健体"
description: "医师2转技能，强筋健体，增加10%命中率"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 30
learning_cost:
  training: 20000
requirement:
  level: 40
  career_family: "staff"
  min_transfer: 2
effect:
  value: 0.1
  buff_key: "hit_up_10"
- key: "staff_fury_agile"
name: "身轻如燕"
description: "医师2转技能，身轻如燕，增加10%回避率"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 40
learning_cost:
  training: 32000
requirement:
  level: 45
  career_family: "staff"
  min_transfer: 2
effect:
  value: 0.1
  buff_key: "dodge_up_10"
- key: "staff_fury_hpboost"
name: "九转回心"
description: "医师2转技能，九转回心，增加10%最大生命值"
type: "buff"
target: "single"
coolDown: 1000
cost:
  mp: 45
learning_cost:
  training: 43000
requirement:
  level: 55
  career_family: "staff"
  min_transfer: 2
effect:
  value: 0.1
  buff_key: "maxhp_up_10"
4.2 气功系统

========== [可配置] 气功规则 ==========
气功说明：
- 玩家可直接在气功界面看到已解锁的气功
- 气功解锁范围根据角色等级和转职情况展示
- 每个气功可投入1~20点气功点，每点消耗1点气功点
- 气功效果由 base_value + 投入点数 × value_per_level 计算
- 气功只支持加点，不支持减点，重置时一次性清零所有气功加点
#
effect.type 与属性钩子的映射约定（v1.0）：
- effect.type 直接对应 attribute_hooks 中的某个 hook 名，无中间映射表
- 数值加法类（atkMin / hit / def / maxHp ...）→ 走对应 xxxAdd 钩子（operation: "add"）
- 百分比加成类（atkMinPct / hitPct / maxHpPct ...）→ 走对应 xxxPct 钩子（operation: "multiply"）
- effect.type 必须在 qigong_effect_types 白名单内；未在白名单的会被实现层拒绝

qigong_template:
  key: "气功唯一标识"
  name: "气功名称"
  description: "气功描述"

职业系限制（支持多职业系）
  career_family: ["blade"]  # 可为单值或数组，如 ["blade", "sword"]

显示条件（转职次数+等级）
  unlock:
    min_transfer: 1       # 最低转职次数
    min_level: 10         # 最低等级

最大等级（气功可投入的最大点数，统一为20）
  max_level: 20

气功效果
  effect:
    type: "atkMin"        # 属性类型（见下方列表）
    base_value: 0         # 基础效果（投入1点时的效果）
    value_per_level: 5    # 每级增加效果值

消耗
  cost:
    attribute_point: 1     # 每级消耗1点气功点

========== [可配置] 气功属性类型 ==========
气功可加成的属性类型

qigong_effect_types:
数值加法类（走对应的 xxxAdd 钩子，operation: "add"）
- atkMin           # 最小攻击力（数值加）
- atkMax           # 最大攻击力（数值加）
- def              # 防御力（数值加）
- maxHp            # 生命值（数值加）
- maxMp            # 内功（数值加）
- mdef             # 武功防御力（数值加，v1.0 预留）
- missing           # 闪避率（数值加）
- hit              # 命中率（数值加）
- weaponSkillBonus  # 武功攻击力（数值加，走 weaponSkillBonusAdd → weaponSkillBonus 字段；战斗公式按 /100 解释为百分比）
- critR            # 暴击率（数值加）
- critB            # 暴击伤害（数值加）
- hpRecovery        # 生命恢复（数值加）
- mpRecovery        # 内功恢复（数值加）
- leech            # 生命汲取（概率，数值加 0~1；命中时回血比例见 combat_constants.leechRate）
- combo            # 连击几率（概率，数值加 0~1；命中后段数见 combat_constants.comboHits）
- shieldRate       # 护身几率（概率，数值加 0~1；命中时减伤比例见 combat_constants.shieldDamageReduceRate）
- counterDamage   # 反伤几率（概率，数值加 0~1；命中时反伤比例见 combat_constants.counterDamageRate）
- armorBreak      # 破甲几率（概率，数值加 0~1；命中时减防比例见 combat_constants.armorBreakDefReduce）
- skillCritRate  # 真武绝击几率（概率，数值加 0~1；命中时伤害加成见 combat_constants.skillCritDamageBonus）
- healBonus       # 治疗效果加成（数值加，0.01 = +1%；公式 (1 + healBonus) 直接使用）
- mpCostReduce   # 内力消耗减少（数值加，0.01 = +1%；公式 (1 - mpCostReduce) 直接使用）
- mpRecoveryBonus # 内功恢复加成（数值加，0.01 = +1%；公式 (1 + mpRecoveryBonus) 直接使用）
- buffDuration    # 辅助武功延长（数值加，单位"毫秒"；与 Buff duration 字段一致，避免单位混算）
- mf               # 魔法掉落率（数值加）
- gf               # 金币掉落率（数值加）
  # 百分比加成类（走对应的 xxxPct 钩子，operation: "multiply"；value 为小数表示百分比，0.01 = +1%）
- atkMinPct        # 最小攻击力百分比（刀客气功"力劈华山"）
- atkMaxPct        # 最大攻击力百分比（剑客气功"长虹贯日"）
- hitPct           # 命中百分比（刀客气功"摄魂一击"）
- missingPct       # 闪避百分比（剑客气功"百变神行"）
- maxHpPct         # 生命值百分比（医师气功"体血倍增"）
- maxMpPct         # 内功百分比（医师气功"洗髓易筋"）
========== [可配置] 气功属性点规则 ==========

attribute_points:
初始气功点（角色创建时 L1 自带；不通过升级获取）
  initial: 1

升级时获得的气功点数量
调用时机：玩家升级后立即调用（player.level 已是升级后的新值）
跨 35 级语义：34→35 升级 → new_level=35 → 返回 2（即"达到 35 级开始享受 2 点/级"）
重置不影响 player.qigong.available_points 的累计上限：重置只是把所有 invested 退回 available，
实际历史累计 = initial + sum(gain_per_level(L)) for L in 2..player.level
  gain_per_level: |
    # new_level: 升级后的目标等级
    def gain_per_level(new_level):
        if new_level < 35:
            return 1    # 1→2 ... 33→34 升级，每次 +1
        else:
            return 2    # 34→35 起，每次 +2

气功点上限（累计可拥有的上限；超过时不再获得）
  max_points: 999

重置机制
  reset:
    enabled: true
    cost: |
      reset_count = player.qigong.attribute_reset_count
      return 10000 * (10 ** reset_count)  # 第1次10000，第2次100000，第3次1000000，以此类推
    behavior: |
      # 重置所有气功的加点为0，返还对应气功点数给玩家
      refunded_points = sum(player.qigong.invested.values())   # 累加所有气功已投入的点数
      player.qigong.invested = {}                              # 清零所有气功投入
      player.qigong.available_points += refunded_points
      player.qigong.attribute_reset_count += 1

4.2.1 气功数据配置
========== [可配置] 气功列表 ==========
气功按职业系划分，达到转职次数和等级条件后显示

qigongs:
===== 刀客气功 =====
- key: "blade_qigong_atk_min"
name: "力劈华山"
description: "增加最小攻击力，每级+1%"
career_family: "blade"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "atkMinPct"    # 百分比加成，走 multiply 钩子
  base_value: 0
  value_per_level: 0.01  # 每级+1%
cost:
  attribute_point: 1
- key: "blade_qigong_hit"
name: "摄魂一击"
description: "增加命中率，投入1点+11%，每级+1%"
career_family: "blade"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "hitPct"       # 百分比加成，走 multiply 钩子
  base_value: 0.10  # 投入1点+11%
  value_per_level: 0.01  # 每级+1%
cost:
  attribute_point: 1
- key: "blade_qigong_counter"
name: "四两千金"
description: "受到攻击时按一定几率返还伤害给对方（反伤比例见 combat_constants.counterDamageRate）"
career_family: "blade"
unlock:
  min_transfer: 1
  min_level: 10
effect:
  type: "counterDamage"
  base_value: 0.10  # 投入1点+11%反伤几率
  value_per_level: 0.01  # 每级+1%反伤几率
cost:
  attribute_point: 1
- key: "blade_qigong_armorBreak"
name: "霸气破甲"
description: "攻击时一定几率减少对方防御力，仅对当次攻击生效，每级增加1%破甲几率（减防比例见 combat_constants.armorBreakDefReduce）"
career_family: "blade"
unlock:
  min_transfer: 2
  min_level: 35
effect:
  type: "armorBreak"
  base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
  value_per_level: 0.01  # 每级+1%破甲几率
cost:
  attribute_point: 1
  # ===== 剑客气功 =====
- key: "sword_qigong_atk_max"
name: "长虹贯日"
description: "增加最大攻击力，每级+1%"
career_family: "sword"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "atkMaxPct"    # 百分比加成，走 multiply 钩子
  base_value: 0
  value_per_level: 0.01  # 每级+1%最大攻击力
cost:
  attribute_point: 1
- key: "sword_qigong_dodge"
name: "百变神行"
description: "增加回避率，投入1点+11%，每级+1%"
career_family: "sword"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "missingPct"   # 百分比加成，走 multiply 钩子
  base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
  value_per_level: 0.01  # 每级+1%
cost:
  attribute_point: 1
- key: "sword_qigong_combo"
name: "连环飞舞"
description: "增加连击几率（触发后攻击次数见 combat_constants.comboHits）"
career_family: ["sword", "blade", "spear"]
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "combo"  # 连击几率
  base_value: 0.10  # 投入1点时+11%
  value_per_level: 0.01  # 每级+1%
cost:
  attribute_point: 1
- key: "sword_qigong_shield"
name: "护身罡气"
description: "受到攻击时有一定几率减免伤害（减免比例见 combat_constants.shieldDamageReduceRate，默认 50%）"
career_family: "sword"
unlock:
  min_transfer: 1
  min_level: 10
effect:
  type: "shieldRate"   # 走玩家面板 shieldRate 概率；命中时的减伤倍率由战斗常量决定
  base_value: 0.10  # 投入1点+11%
  value_per_level: 0.01  # 每级+1%
cost:
  attribute_point: 1
- key: "sword_qigong_leech"
name: "移花接木"
description: "攻击时按一定几率吸血（回血比例见 combat_constants.leechRate，默认 20% 伤害）"
career_family: "sword"
unlock:
  min_transfer: 2
  min_level: 35
effect:
  type: "leech"
  base_value: 0
  value_per_level: 0.004  # 每级+0.4%触发几率
cost:
  attribute_point: 1
- key: "sword_qigong_skill_atk"
name: "回柳身法"
description: "增加武功攻击力，每级+0.6%（满 20 级 = +12%）"
career_family: "sword"
unlock:
  min_transfer: 3
  min_level: 60
effect:
  type: "weaponSkillBonus"
  base_value: 0
  value_per_level: 0.6  # 每级+0.6%武功攻击力（与金刚石单位一致：5 = 5%，公式按 /100 解释）
cost:
  attribute_point: 1
  # ===== 枪客气功 =====
- key: "spear_qigong_def"
name: "金钟罡气"
description: "提高防御力，每级增加1防御"
career_family: "spear"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "def"
  base_value: 0
  value_per_level: 1  # 每级+1防御
cost:
  attribute_point: 1
- key: "spear_qigong_heal"
name: "运气疗伤"
description: "提高运气疗伤的能力，每级增加1%生命药剂治疗效果"
career_family: "spear"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "healBonus"
  base_value: 0
  value_per_level: 0.01  # 每级+1%生命药剂治疗效果
cost:
  attribute_point: 1
- key: "spear_qigong_hp"
name: "横练太保"
description: "提高生命值，每级增加8生命值"
career_family: "spear"
unlock:
  min_transfer: 1
  min_level: 10
effect:
  type: "maxHp"
  base_value: 0
  value_per_level: 8  # 每级+8生命值
cost:
  attribute_point: 1
- key: "spear_qigong_skill_atk"
name: "乾坤挪移"
description: "提高武功攻击力，每级增加1.5%武功攻击力（满 20 级 = +30%）"
career_family: "spear"
unlock:
  min_transfer: 2
  min_level: 35
effect:
  type: "weaponSkillBonus"
  base_value: 0
  value_per_level: 1.5  # 每级+1.5%武功攻击力（与金刚石单位一致：5 = 5%，公式按 /100 解释）
cost:
  attribute_point: 1
- key: "spear_qigong_skill_def"
name: "灵甲护身"
description: "提高武功防御力，每级增加3武功防御力"
    # v1.0 预留：v1.0 怪物不释放武功，本气功投点对实际战斗无生效场景；
    #            UI 仍正常展示与可投，但建议在解锁/分配界面给玩家一行提示文案。
    #            v2.0 怪物武功上线后自动生效，无需改气功配置。
    career_family: "spear"
    unlock:
      min_transfer: 2
      min_level: 60
    effect:
      type: "mdef"
      base_value: 0
      value_per_level: 3  # 每级+3武功防御力
    cost:
      attribute_point: 1

  # ===== 医师气功 =====
- key: "staff_qigong_mp_reduce"
name: "太极心法"
description: "减少使用武功时消耗的内功值，每级提高1%内力消耗减少"
career_family: "staff"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "mpCostReduce"
  base_value: 0
  value_per_level: 0.01  # 每级+1%内力消耗减少
cost:
  attribute_point: 1
- key: "staff_qigong_maxhp"
name: "体血倍增"
description: "增加最大生命值，每级提高1%的最大生命值"
career_family: "staff"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "maxHpPct"     # 百分比加成，走 multiply 钩子
  base_value: 0
  value_per_level: 0.01  # 每级+1%最大生命值
cost:
  attribute_point: 1
- key: "staff_qigong_maxmp"
name: "洗髓易筋"
description: "增加最大内功值，每级提高1%的最大内功值"
career_family: "staff"
unlock:
  min_transfer: 0
  min_level: 1
effect:
  type: "maxMpPct"     # 百分比加成，走 multiply 钩子
  base_value: 0
  value_per_level: 0.01  # 每级+1%最大内功值
cost:
  attribute_point: 1
- key: "staff_qigong_skill_atk"
name: "长攻击力"
description: "提升武功攻击力，每级提高2%的武功攻击力（满 20 级 = +40%）"
career_family: "staff"
unlock:
  min_transfer: 1
  min_level: 10
effect:
  type: "weaponSkillBonus"
  base_value: 0
  value_per_level: 2  # 每级+2%武功攻击力（与金刚石单位一致：5 = 5%，公式按 /100 解释）
cost:
  attribute_point: 1
- key: "staff_qigong_buffDuration"
name: "吸星大法"
description: "延长辅助武功的生效时间，每级提高 15 秒（15000 毫秒）"
career_family: "staff"
unlock:
  min_transfer: 2
  min_level: 35
effect:
  type: "buffDuration"
  base_value: 0
  value_per_level: 15000  # 每级 +15000 ms（=15s）。单位 ms，与 Buff duration 字段一致
cost:
  attribute_point: 1
- key: "staff_qigong_mpRecoveryBonus"
name: "运气行心"
description: "增加内功药剂的恢复量，每级提高1%内功恢复加成"
career_family: "staff"
unlock:
  min_transfer: 3
  min_level: 60
effect:
  type: "mpRecoveryBonus"
  base_value: 0
  value_per_level: 0.01  # 每级+1%内功恢复加成
cost:
  attribute_point: 1
  # ===== 通用气功（命名遗留，v1.0 实际仅刀客可学）=====
  # 注：尽管段名是"通用气功"，本气功 career_family 仅 blade，v1.0 仅刀客可学；
  #     其他职业拿到"真武绝击+1"热血石将沉默失效（见 hot_blood_skill_stack_rules）。
- key: "common_qigong_skill_crit"
name: "真武绝击"
description: "提高武功致命打击出现的概率，每级增加1%几率（触发伤害加成见 combat_constants.skillCritDamageBonus，默认 +50%）"
career_family: "blade"
unlock:
  min_transfer: 3
  min_level: 60
effect:
  type: "skillCritRate"
  base_value: 0.10  # 投入1点时效果为11%（base_value + 1*value_per_level = 0.10 + 0.01 = 0.11）
  value_per_level: 0.01  # 每级+1%真武绝击几率
cost:
  attribute_point: 1
4.3 Buff系统


========== [可配置] Buff定义模板 ==========
attribute_mods 字段约定（v1.0）：
- key 必须是 attribute_hooks 中已定义的钩子名（如 atkSelfPct / defPct / hitPct / maxHpPct）
- 数值加法走 xxxAdd 钩子（key 末尾 Add），百分比加成走 xxxPct 钩子（key 末尾 Pct）
- 同名 key 在不同 Buff 间语义一致，不允许"数值/百分比混用"
- 不允许引用 base_attributes 之外的属性（如 speed 等）

buff_template:
  key: "buff唯一标识"
  name: "Buff名称"
  description: "Buff描述"

持续时间（毫秒），-1表示永久
  duration: 5000

是否可叠加
  stackable: false
  max_stacks: 1

是否可被驱散
  dispellable: true

是否为负面效果
  is_debuff: false

效果类型
  effect_type: "attribute"     # attribute(属性修改) / dot(持续伤害) / hot(持续治疗) / special(特殊)

属性修改（key 必须是 attribute_hooks 中已定义的钩子名）
  attribute_mods:
    atkSelfPct: 0.10         # 攻击力 +10%（同时作用 atkMin / atkMax）
    defPct: 0.05               # 防御力 +5%

特殊效果
  special_effects:
    - type: "immune_damage"    # 免疫伤害
    - type: "reflect_damage"   # 反弹伤害
      value: 0.2               # 反弹20%

========== [可配置] Buff列表 ==========

buffs:
===== 增益Buff =====
- key: "rage_buff"
name: "狂风万破"
description: "攻击力和防御力同时提升 30%"
duration: 15000
stackable: false
is_debuff: false
effect_type: "attribute"
attribute_mods:
  atkSelfPct: 0.30       # +30% 攻击力（同时作用 atkMin / atkMax）
  defPct: 0.30             # +30% 防御力
  # ===== 医师增益Buff =====
- key: "atk_up_20"
name: "攻击提升"
description: "最小和最大攻击力各提升20%"
duration: 60000               # 1分钟
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  atkSelfPct: 0.20          # +20% 攻击力（同时作用 atkMin / atkMax）
- key: "def_up_5"
name: "防御提升"
description: "防御力提升5%"
duration: -1
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  defPct: 0.05                # +5% 防御力
- key: "def_up_10"
name: "防御提升"
description: "防御力提升10%"
duration: -1
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  defPct: 0.10                # +10% 防御力
- key: "hit_up_10"
name: "命中提升"
description: "命中率提升10%"
duration: -1
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  hitPct: 0.10                # +10% 命中率
- key: "dodge_up_10"
name: "回避提升"
description: "回避率提升10%"
duration: -1
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  missingPct: 0.10            # +10% 回避率
- key: "maxhp_up_10"
name: "生命提升"
description: "最大生命值提升10%"
duration: -1
stackable: false
is_debuff: false
dispellable: true
effect_type: "attribute"
attribute_mods:
  maxHpPct: 0.10              # +10% 最大生命值

---

