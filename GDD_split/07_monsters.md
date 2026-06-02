7 怪物系统

7.1 怪物模板定义

========== [可配置] 怪物定义模板 ==========
怪物定义独立于地图，怪物可被多张地图的多个二级区域引用
key 使用英文开发命名，name 为中文显示名
#
掉落规则：
- 怪物无 drop_items：只走地图/二级区域的公共掉落池
- 怪物有 drop_items：叠加怪物掉落 + 地图掉落，且不重复
- 怪物掉落优先配置任务物品和特殊物品
- 地图掉落配置通用物品（装备、药剂、金币等）
- 任务物品 droprate 字段省略时继承 task_item_drop_config.default_droprate（v1.0 默认 0.001 = 0.1%）；
单怪需要覆写时在该 drop_items 条目显式写 droprate 即可（见 9.3 task_item_drop_config）

monster_template:
  key: "怪物唯一标识"
  name: "怪物名称"
  level: 10                    # 等级
  exp: 100                     # 经验（精英/Boss填0由系统另行计算）
  hp: 1000                     # 生命值
  atk: 50                      # 攻击力
  def: 20                      # 防御力
命中/闪避（必填，按下列公式由开发者预生成，避免运行时再次计算；如配置与公式不一致，以配置值为准）
hit     = 3 × level                                （示例：L10 → 30）
missing = round(0.3 × level, 1)                    （示例：L10 → 3，向下保留 1 位小数）
该公式与玩家 hit/missing 公式联动；玩家命中曲线靠 levelToHit=2.0 抗衡此公式，
保证双方在同级时 actualHitRate 大致维持 90% 左右。
精英/Boss 怪可以单独调高 hit/missing 制造"难命中"或"高闪避"，无需修改公式。
  hit: 30
  missing: 3
暴击（可选；v1.0 怪物固定参数，如未配置则按下列 fallback 处理）
critR 未配置 → 默认 0.25（25%）
critB 未配置 → 默认 1.5  （150%）
如需精英/Boss 单独调整，在该怪物实例显式配置 critR / critB 即可覆写默认
  critR: 0.25                  # 选填；未填则取 fallback 0.25
  critB: 1.5                   # 选填；未填则取 fallback 1.5
战斗扩展属性（全部选填；v1.0 怪物默认全 0，永不触发对应特殊判定）
如需精英/Boss 单独调整（如反伤狼王 / 吸血恶虎），在该怪物实例显式配置即可覆写默认
armorBreak    未配置 → fallback 0（怪物不破甲，公式 attacker.armorBreak ?? 0）
shieldRate    未配置 → fallback 0（怪物不护身，公式 target.shieldRate ?? 0）
counterDamage 未配置 → fallback 0（怪物不反伤，公式 target.counterDamage ?? 0）
leech          未配置 → fallback 0（怪物不汲取，公式 attacker.leech ?? 0）
  armorBreak: 0               # 选填；未填则 fallback 0
  shieldRate: 0               # 选填；未填则 fallback 0
  counterDamage: 0            # 选填；未填则 fallback 0
  leech: 0                     # 选填；未填则 fallback 0
连击：v1.0 怪物不参与连击判定（normal_attack_damage 内已硬编 if attacker is player 才判连击）
不需要在怪物模板配 combo 字段
  monster_type: "normal"        # normal/elite/boss
  skills: []                   # 技能列表
  drop_items: []               # 掉落物品（任务物品/特殊物品优先）

7.2 怪物数据配置

========== [可配置] 怪物列表 ==========

monsters:
- key: "stray_cat"
name: "野猫"
level: 3
exp: 3
hp: 50
atk: 13
def: 10
hit: 9
missing: 0.9
monster_type: "normal"
skills: []
drop_items: []
- key: "toad"
name: "蛤蟆"
level: 5
exp: 5
hp: 70
atk: 17
def: 15
hit: 15
missing: 1.5
monster_type: "normal"
skills: []
drop_items: []
- key: "fox"
name: "狐狸"
level: 8
exp: 9
hp: 100
atk: 24
def: 18
hit: 24
missing: 2.4
monster_type: "normal"
skills: []
drop_items: []
- key: "wild_bull"
name: "狂牛"
level: 10
exp: 11
hp: 120
atk: 46
def: 30
hit: 30
missing: 3
monster_type: "normal"
skills: []
drop_items: []
- key: "wild_boar"
name: "野猪"
level: 12
exp: 14
hp: 160
atk: 56
def: 35
hit: 36
missing: 3.6
monster_type: "normal"
skills: []
drop_items:
  - item_key: "boar_leg"
- key: "gray_wolf"
name: "灰狼"
level: 12
exp: 19
hp: 180
atk: 61
def: 40
hit: 36
missing: 3.6
monster_type: "normal"
skills: []
drop_items:
  - item_key: "wolf_bone"
- key: "bear"
name: "熊"
level: 15
exp: 26
hp: 300
atk: 81
def: 45
hit: 45
missing: 4.5
monster_type: "normal"
skills: []
drop_items: []
- key: "gray_wolf_king"
name: "灰狼王"
level: 15
exp: 0
hp: 330
atk: 92
def: 60
hit: 45
missing: 4.5
monster_type: "elite"
skills: []
drop_items: []
- key: "three_tail_fox"
name: "三尾狐"
level: 18
exp: 39
hp: 360
atk: 107
def: 50
hit: 54
missing: 5.4
monster_type: "normal"
skills: []
drop_items: []
- key: "woodcutter"
name: "伐木工"
level: 18
exp: 42
hp: 360
atk: 117
def: 55
hit: 54
missing: 5.4
monster_type: "normal"
skills: []
drop_items: []
- key: "woodcutter_leader"
name: "伐木工首领"
level: 20
exp: 0
hp: 400
atk: 157
def: 55
hit: 60
missing: 6
monster_type: "elite"
skills: []
drop_items: []
- key: "blood_wolf"
name: "血狼"
level: 20
exp: 49
hp: 550
atk: 152
def: 70
hit: 60
missing: 6
monster_type: "normal"
skills: []
drop_items: []
- key: "flower_bear"
name: "花熊"
level: 20
exp: 54
hp: 600
atk: 157
def: 80
hit: 60
missing: 6
monster_type: "normal"
skills: []
drop_items: []
- key: "blood_wolf_king"
name: "血狼王"
level: 22
exp: 0
hp: 780
atk: 178
def: 100
hit: 66
missing: 6.6
monster_type: "elite"
skills: []
drop_items: []
- key: "big_ape"
name: "大猿"
level: 22
exp: 52
hp: 650
atk: 162
def: 80
hit: 66
missing: 6.6
monster_type: "normal"
skills: []
drop_items: []
- key: "small_zombie"
name: "小僵尸"
level: 25
exp: 64
hp: 750
atk: 167
def: 90
hit: 75
missing: 7.5
monster_type: "normal"
skills: []
drop_items: []
- key: "small_blue_ghost"
name: "小蓝鬼"
level: 25
exp: 66
hp: 800
atk: 172
def: 95
hit: 75
missing: 7.5
monster_type: "normal"
skills: []
drop_items: []
- key: "dancing_girl"
name: "舞女"
level: 27
exp: 71
hp: 950
atk: 182
def: 100
hit: 81
missing: 8.1
monster_type: "normal"
skills: []
drop_items: []
- key: "broken_monk"
name: "破戒僧"
level: 27
exp: 74
hp: 1000
atk: 187
def: 110
hit: 81
missing: 8.1
monster_type: "normal"
skills: []
drop_items: []
- key: "mountain_ghost"
name: "山鬼"
level: 30
exp: 0
hp: 1600
atk: 350
def: 150
hit: 90
missing: 9
monster_type: "elite"
skills: []
drop_items: []
- key: "big_robber"
name: "大块头山贼"
level: 30
exp: 119
hp: 1200
atk: 217
def: 120
hit: 90
missing: 9
monster_type: "normal"
skills: []
drop_items: []
- key: "giant_axe_robber"
name: "巨斧山贼"
level: 32
exp: 129
hp: 1300
atk: 227
def: 130
hit: 96
missing: 9.6
monster_type: "normal"
skills: []
drop_items: []
- key: "robber_chief"
name: "山贼头领"
level: 35
exp: 0
hp: 2000
atk: 450
def: 250
hit: 105
missing: 10.5
monster_type: "elite"
skills: []
drop_items: []
- key: "red_bear"
name: "赤血熊"
level: 35
exp: 199
hp: 1500
atk: 263
def: 140
hit: 105
missing: 10.5
monster_type: "normal"
skills: []
drop_items:
  - item_key: "red_bear_skin"
- key: "forest_tiger"
name: "山林黄虎"
level: 36
exp: 249
hp: 1550
atk: 268
def: 143
hit: 108
missing: 10.8
monster_type: "normal"
skills: []
drop_items:
  - item_key: "forest_tiger_skin"
- key: "white_tiger"
name: "白纹虎"
level: 37
exp: 299
hp: 1600
atk: 273
def: 146
hit: 111
missing: 11.1
monster_type: "normal"
skills: []
drop_items:
  - item_key: "white_tiger_skin"
- key: "pirate_villager"
name: "盗鱼村夫"
level: 38
exp: 349
hp: 1650
atk: 278
def: 149
hit: 114
missing: 11.4
monster_type: "normal"
skills: []
drop_items: []
- key: "double_gun_pirate"
name: "双枪鱼贼"
level: 40
exp: 399
hp: 1800
atk: 288
def: 151
hit: 120
missing: 12
monster_type: "normal"
skills: []
drop_items: []
- key: "big_arm_stranger"
name: "巨臂异人"
level: 42
exp: 499
hp: 1850
atk: 298
def: 151
hit: 126
missing: 12.6
monster_type: "normal"
skills: []
drop_items: []
- key: "small_mountain_creature"
name: "小山怪"
level: 43
exp: 549
hp: 1950
atk: 303
def: 166
hit: 129
missing: 12.9
monster_type: "normal"
skills: []
drop_items: []
- key: "sharp_claw_sas"
name: "利爪山魈"
level: 44
exp: 599
hp: 2000
atk: 323
def: 169
hit: 132
missing: 13.2
monster_type: "normal"
skills: []
drop_items: []
- key: "mountain_sas"
name: "山魈"
level: 45
exp: 649
hp: 2200
atk: 328
def: 179
hit: 135
missing: 13.5
monster_type: "normal"
skills: []
drop_items: []
- key: "lotus_cultist"
name: "莲花教徒"
level: 47
exp: 749
hp: 2250
atk: 338
def: 182
hit: 141
missing: 14.1
monster_type: "normal"
skills: []
drop_items: []
- key: "foreign_evil_monk"
name: "异域恶僧"
level: 48
exp: 799
hp: 2300
atk: 343
def: 185
hit: 144
missing: 14.4
monster_type: "normal"
skills: []
drop_items: []
- key: "red_hair_fire_thief"
name: "赤发火贼"
level: 49
exp: 849
hp: 2350
atk: 348
def: 188
hit: 147
missing: 14.7
monster_type: "normal"
skills: []
drop_items: []
- key: "one_eye_fire_thief"
name: "独眼火贼"
level: 50
exp: 999
hp: 2700
atk: 373
def: 198
hit: 150
missing: 15
monster_type: "normal"
skills: []
drop_items: []
- key: "big_blade_bandit"
name: "大刀匪兵"
level: 40
exp: 399
hp: 1800
atk: 288
def: 151
hit: 120
missing: 12
monster_type: "normal"
skills: []
drop_items: []
- key: "iron_palm_camel"
name: "铁掌神驼"
level: 43
exp: 549
hp: 1950
atk: 303
def: 166
hit: 129
missing: 12.9
monster_type: "normal"
skills: []
drop_items: []
- key: "one_eye_monster"
name: "独眼怪人"
level: 44
exp: 599
hp: 2000
atk: 323
def: 169
hit: 132
missing: 13.2
monster_type: "normal"
skills: []
drop_items: []
- key: "bounty_hunter_female"
name: "赏金女猎人"
level: 45
exp: 649
hp: 2200
atk: 328
def: 179
hit: 135
missing: 13.5
monster_type: "normal"
skills: []
drop_items: []
- key: "ronin_warrior"
name: "浪人武士"
level: 47
exp: 749
hp: 2250
atk: 338
def: 182
hit: 141
missing: 14.1
monster_type: "normal"
skills: []
drop_items: []
- key: "fast_blade_warrior"
name: "快刀武士"
level: 48
exp: 799
hp: 2300
atk: 343
def: 185
hit: 144
missing: 14.4
monster_type: "normal"
skills: []
drop_items: []
- key: "green_forest_bandit"
name: "绿林山贼"
level: 49
exp: 849
hp: 2350
atk: 348
def: 188
hit: 147
missing: 14.7
monster_type: "normal"
skills: []
drop_items: []
- key: "prison_escape_bandit"
name: "越狱山贼"
level: 50
exp: 999
hp: 2700
atk: 373
def: 198
hit: 150
missing: 15
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_short_sword_disciple"
name: "颂武门短刀弟子"
level: 51
exp: 1049
hp: 2800
atk: 383
def: 217
hit: 153
missing: 15.3
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_short_axe_disciple"
name: "颂武门短斧弟子"
level: 51
exp: 1049
hp: 2950
atk: 388
def: 222
hit: 153
missing: 15.3
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_new_recruit"
name: "颂武门新丁"
level: 52
exp: 1099
hp: 3100
atk: 393
def: 227
hit: 156
missing: 15.6
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_bully"
name: "颂武门恶霸"
level: 53
exp: 1149
hp: 3250
atk: 398
def: 232
hit: 159
missing: 15.9
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_spear_disciple"
name: "颂武门长矛弟子"
level: 54
exp: 1199
hp: 3400
atk: 403
def: 237
hit: 162
missing: 16.2
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_chain_hammer_disciple"
name: "颂武门链锤弟子"
level: 54
exp: 1249
hp: 3550
atk: 408
def: 242
hit: 162
missing: 16.2
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_crazy_blade_disciple"
name: "颂武门狂刀弟子"
level: 55
exp: 1299
hp: 3700
atk: 428
def: 247
hit: 165
missing: 16.5
monster_type: "normal"
skills: []
drop_items: []
- key: "jinbei_remote_sword"
name: "金碑人遥剑"
level: 56
exp: 1349
hp: 3850
atk: 433
def: 252
hit: 168
missing: 16.8
monster_type: "normal"
skills: []
drop_items: []
- key: "songwu_fast_blade_warrior"
name: "颂武门快刀武士"
level: 57
exp: 1399
hp: 4000
atk: 438
def: 257
hit: 171
missing: 17.1
monster_type: "normal"
skills: []
drop_items: []
- key: "amber_bandit"
name: "琥珀盗贼"
level: 51
exp: 1049
hp: 2950
atk: 388
def: 222
hit: 153
missing: 15.3
monster_type: "normal"
skills: []
drop_items: []
- key: "tamed_wolf_bandit"
name: "驯狼盗贼"
level: 54
exp: 1249
hp: 3550
atk: 408
def: 242
hit: 162
missing: 16.2
monster_type: "normal"
skills: []
drop_items: []
- key: "stick_bandit"
name: "长棍毛贼"
level: 51
exp: 1049
hp: 2800
atk: 383
def: 217
hit: 153
missing: 15.3
monster_type: "normal"
skills: []
drop_items: []
- key: "thief_small_head"
name: "盗贼小头目"
level: 52
exp: 1099
hp: 3100
atk: 393
def: 227
hit: 156
missing: 15.6
monster_type: "normal"
skills: []
drop_items: []
- key: "meteor_hammer_bandit"
name: "流星锤强盗"
level: 53
exp: 1149
hp: 3250
atk: 398
def: 232
hit: 159
missing: 15.9
monster_type: "normal"
skills: []
drop_items: []
- key: "black_face_bandit"
name: "黑面盗贼"
level: 54
exp: 1199
hp: 3400
atk: 403
def: 237
hit: 162
missing: 16.2
monster_type: "normal"
skills: []
drop_items: []
- key: "bearded_bandit"
name: "胡子大盗"
level: 55
exp: 1299
hp: 3700
atk: 428
def: 247
hit: 165
missing: 16.5
monster_type: "normal"
skills: []
drop_items: []
- key: "ring_eye_bandit"
name: "环眼大盗"
level: 56
exp: 1349
hp: 3850
atk: 433
def: 252
hit: 168
missing: 16.8
monster_type: "normal"
skills: []
drop_items: []
- key: "scar_bandit"
name: "刀疤大盗"
level: 57
exp: 1399
hp: 4000
atk: 438
def: 257
hit: 171
missing: 17.1
monster_type: "normal"
skills: []
drop_items: []
- key: "bamboo_forest_fairy"
name: "竹林小魔仙"
level: 57
exp: 2000
hp: 4200
atk: 425
def: 265
hit: 171
missing: 17.1
monster_type: "normal"
skills: []
drop_items: []
- key: "bamboo_forest_wood_thief"
name: "竹林盗伐者"
level: 58
exp: 2200
hp: 4350
atk: 430
def: 270
hit: 174
missing: 17.4
monster_type: "normal"
skills: []
drop_items: []
- key: "bamboo_god_servant"
name: "竹神侍女"
level: 57
exp: 2000
hp: 4200
atk: 425
def: 265
hit: 171
missing: 17.1
monster_type: "normal"
skills: []
drop_items: []
- key: "bamboo_spear_warrior"
name: "竹枪武士"
level: 58
exp: 2200
hp: 4350
atk: 430
def: 270
hit: 174
missing: 17.4
monster_type: "normal"
skills: []
drop_items: []
- key: "bamboo_forest_swordsman"
name: "竹林剑士"
level: 60
exp: 2400
hp: 4500
atk: 445
def: 275
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "bamboo_strip"
- key: "bamboo_forest_double_sword"
name: "竹林双剑"
level: 60
exp: 2400
hp: 4500
atk: 445
def: 275
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "bamboo_leaf"
- key: "one_eye_evil_thief"
name: "独眼恶贼"
level: 59
exp: 2600
hp: 4650
atk: 440
def: 280
hit: 177
missing: 17.7
monster_type: "normal"
skills: []
drop_items:
  - item_key: "magnet_stone"
- key: "long_spear_bandit"
name: "长枪匪兵"
level: 38
exp: 349
hp: 1650
atk: 275
def: 149
hit: 114
missing: 11.4
monster_type: "normal"
skills: []
drop_items: []
- key: "gold_bell_snake"
name: "金铃蛇"
level: 60
exp: 2750
hp: 4850
atk: 470
def: 295
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "gold_bell_snake_scale"
- key: "coral_snake"
name: "珊瑚蛇"
level: 60
exp: 2900
hp: 5050
atk: 478
def: 302
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "coral_snake_scale"
- key: "green_head_snake"
name: "青头蛇"
level: 61
exp: 3050
hp: 5200
atk: 486
def: 309
hit: 183
missing: 18.3
monster_type: "normal"
skills: []
drop_items:
  - item_key: "green_head_snake_scale"
  - item_key: "green_head_snake_fang"
  - item_key: "qingxuan_wine"
  - item_key: "green_head_snake_venom"
- key: "red_cloud_tiger"
name: "赤云虎"
level: 60
exp: 2750
hp: 4850
atk: 470
def: 295
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "red_cloud_tiger_skin"
- key: "saber_tooth_evil_tiger"
name: "剑齿恶虎"
level: 60
exp: 2900
hp: 5050
atk: 478
def: 302
hit: 180
missing: 18
monster_type: "normal"
skills: []
drop_items:
  - item_key: "saber_tiger_skin"
- key: "bloodthirsty_wolf"
name: "嗜血狂狼"
level: 61
exp: 3050
hp: 5200
atk: 486
def: 309
hit: 183
missing: 18.3
monster_type: "normal"
skills: []
drop_items:
  - item_key: "blood_wolf_skin"
  - item_key: "blood_wolf_claw"
  - item_key: "blood_wolf_tail"
  - item_key: "blood_wolf_blood"
- key: "hunchback_flying_tiger_thief"
name: "驼背飞虎贼"
level: 61
exp: 3200
hp: 5400
atk: 494
def: 316
hit: 183
missing: 18.3
monster_type: "normal"
skills: []
drop_items: []
- key: "miser"
name: "吝啬鬼"
level: 62
exp: 3350
hp: 5600
atk: 504
def: 323
hit: 186
missing: 18.6
monster_type: "normal"
skills: []
drop_items: []
- key: "divine_palm_tiger_thief"
name: "神掌飞虎贼"
level: 63
exp: 3500
hp: 5800
atk: 510
def: 330
hit: 189
missing: 18.9
monster_type: "normal"
skills: []
drop_items: []
- key: "bounty_scar_warrior"
name: "赏猎刀疤勇士"
level: 64
exp: 3700
hp: 6000
atk: 518
def: 337
hit: 192
missing: 19.2
monster_type: "normal"
skills: []
drop_items: []
- key: "bounty_female_assassin"
name: "赏猎女刺客"
level: 65
exp: 3900
hp: 6200
atk: 538
def: 344
hit: 195
missing: 19.5
monster_type: "normal"
skills: []
drop_items: []
- key: "iron_armor_guard"
name: "铁甲卫士"
level: 66
exp: 4100
hp: 6400
atk: 546
def: 351
hit: 198
missing: 19.8
monster_type: "normal"
skills: []
drop_items: []
- key: "ghost_mask_warrior"
name: "鬼面武士"
level: 67
exp: 4300
hp: 6600
atk: 554
def: 358
hit: 201
missing: 20.1
monster_type: "normal"
skills: []
drop_items: []
- key: "black_pine_patrol_thief"
name: "黑松巡路贼"
level: 61
exp: 3200
hp: 5400
atk: 494
def: 316
hit: 183
missing: 18.3
monster_type: "normal"
skills: []
drop_items: []
- key: "black_pine_red_eye_thief"
name: "黑松红眼盗贼"
level: 62
exp: 3350
hp: 5600
atk: 504
def: 323
hit: 186
missing: 18.6
monster_type: "normal"
skills: []
drop_items: []
- key: "black_pine_ghost_mask_thief"
name: "黑松鬼面贼"
level: 63
exp: 3500
hp: 5800
atk: 510
def: 330
hit: 189
missing: 18.9
monster_type: "normal"
skills: []
drop_items: []
- key: "violent_smuggler"
name: "暴力走私商"
level: 64
exp: 3700
hp: 6000
atk: 518
def: 337
hit: 192
missing: 19.2
monster_type: "normal"
skills: []
drop_items: []
- key: "straight_brow_drug_dealer"
name: "直眉禁药商"
level: 65
exp: 3900
hp: 6200
atk: 538
def: 344
hit: 195
missing: 19.5
monster_type: "normal"
skills: []
drop_items: []
- key: "masked_great_thief"
name: "蒙面大盗"
level: 66
exp: 4100
hp: 6400
atk: 546
def: 351
hit: 198
missing: 19.8
monster_type: "normal"
skills: []
drop_items: []
- key: "flying_female_thief"
name: "飞天女盗"
level: 67
exp: 4300
hp: 6600
atk: 554
def: 358
hit: 201
missing: 20.1
monster_type: "normal"
skills: []
drop_items: []
- key: "double_oar_escort_warrior"
name: "双桨司护战士"
level: 68
exp: 4500
hp: 6800
atk: 560
def: 365
hit: 204
missing: 20.4
monster_type: "normal"
skills: []
drop_items: []
- key: "iron_arm_escort_guard"
name: "铁臂司护守卫"
level: 69
exp: 4700
hp: 7000
atk: 570
def: 372
hit: 207
missing: 20.7
monster_type: "normal"
skills: []
drop_items: []
- key: "blue_face_escort_mad_warrior"
name: "青面司护狂战"
level: 70
exp: 4900
hp: 7200
atk: 580
def: 379
hit: 210
missing: 21
monster_type: "normal"
skills: []
drop_items: []
- key: "hammer_escort_general"
name: "铁锤司护战将"
level: 71
exp: 5100
hp: 7400
atk: 590
def: 383
hit: 213
missing: 21.3
monster_type: "normal"
skills: []
drop_items: []

---

