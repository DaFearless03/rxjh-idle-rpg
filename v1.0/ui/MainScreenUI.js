/**
 * @file ui/MainScreenUI.js
 * @desc 主页面骨架（demo 风格）：phone-frame + top-bar + main-scroll + bottom-menu + 所有 panel
 */

import { renderZoneBattleArea } from './ZoneBattleAreaUI.js';

let mainScreenKeydownBound = false;

export function buildMainScreenUI(container) {
  container.innerHTML = `
    <!-- ===== 手机框架 ===== -->
    <div class="phone-frame">

      <!-- ===== 主页 ===== -->
      <div class="page-panel page-home active" id="page-home">

        <!-- 顶部状态栏 -->
        <div class="top-bar">
          <div class="top-row-1">
            <div class="player-bar">
              <span class="name" id="top-name">—</span>
              <span class="sep">·</span>
              <span class="level" id="top-level">Lv.1</span>
              <span class="sep">·</span>
              <span class="faction neutral" id="top-faction">中立</span>
              <span class="sep">·</span>
              <span class="career" id="top-class">—</span>
            </div>
          </div>
          <div class="stat-bars-compact">
            <div class="stat-row">
              <span class="stat-label hp">生命值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-hp" id="home-hp-fill" style="width:100%"></div><div class="gba-bar-pct" id="home-hp-pct">100%</div></div>
              <span class="stat-num" id="home-hp-text">—/—</span>
            </div>
            <div class="stat-row">
              <span class="stat-label mp">内功值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-mp" id="home-mp-fill" style="width:100%"></div><div class="gba-bar-pct" id="home-mp-pct">100%</div></div>
              <span class="stat-num" id="home-mp-text">—/—</span>
            </div>
            <div class="stat-row">
              <span class="stat-label exp">经验值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-exp" id="home-exp-fill" style="width:0%"></div><div class="gba-bar-pct" id="home-exp-pct">0%</div></div>
              <span class="stat-num" id="home-exp-text">—/—</span>
            </div>
          </div>
        </div>

        <!-- 主滚动区 -->
        <div class="main-scroll" id="home-scroll">
          <div class="home-state-content" id="home-town-content">

          <!-- 城镇横幅 -->
          <div class="town-banner" id="town-banner">
            <div class="town-icon">🏠</div>
            <div class="town-info">
              <div class="town-name" id="town-name">泫渤派</div>
              <div class="town-desc" id="town-desc">自动恢复生命和内力</div>
            </div>
            <div class="restore-badge" id="restore-badge">恢复中</div>
          </div>

          <!-- 快速行动 -->
          <div class="panel">
            <div class="panel-title">快速行动</div>
            <div class="quick-action-row">
              <div class="action-card primary clickable" id="ac-hang" onclick="window._openPanel('autoplay')">
                <div class="ac-icon">⚔️</div>
                <div class="ac-body">
                  <div class="ac-label">挂机打怪</div>
                  <div class="ac-sub">自动战斗</div>
                </div>
              </div>
              <div class="action-card clickable" id="ac-map" onclick="window._openMapSheet()">
                <div class="ac-icon">🗺️</div>
                <div class="ac-body">
                  <div class="ac-label">地图</div>
                  <div class="ac-sub">选择区域</div>
                </div>
              </div>
            </div>
          </div>

          <!-- NPC 网格 -->
          <div class="panel">
            <div class="panel-title">NPC</div>
            <div class="npc-grid">
              <div class="npc-card featured has-notice" id="home-leader-card" onclick="window._openNPC('leader')">
                <div class="npc-avatar">📜</div>
                <div class="npc-info">
                  <div class="npc-name">泫渤派门主</div>
                  <div class="npc-type" id="home-leader-meta">任务 · 可接 0 个 / 可交 0 个</div>
                </div>
                <span class="npc-cta">交谈</span>
              </div>

              <div class="npc-card" onclick="window._openNPC('djx')">
                <div class="npc-avatar">⚔</div>
                <div class="npc-info">
                  <div class="npc-name">刀剑笑</div>
                  <div class="npc-type">武器 · 强化 · 合成</div>
                </div>
              </div>

              <div class="npc-card" onclick="window._openNPC('yjl')">
                <div class="npc-avatar">🛡</div>
                <div class="npc-info">
                  <div class="npc-name">银娇龙</div>
                  <div class="npc-type">防具 · 披风</div>
                </div>
              </div>

              <div class="npc-card" onclick="window._openNPC('psz')">
                <div class="npc-avatar">🧪</div>
                <div class="npc-info">
                  <div class="npc-name">平十指</div>
                  <div class="npc-type">药剂商</div>
                </div>
              </div>

              <div class="npc-card" onclick="window._openNPC('wdb')">
                <div class="npc-avatar">📦</div>
                <div class="npc-info">
                  <div class="npc-name">韦大宝</div>
                  <div class="npc-type">仓库 · 50 格</div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div class="home-state-content" id="home-wild-content" hidden>
            <div class="wild-banner">
              <div class="wild-icon">🌳</div>
              <div class="wild-info">
                <div class="wild-name" id="home-wild-name">野外区域</div>
                <div class="wild-desc" id="home-wild-desc">江湖野外 · 持续战斗</div>
              </div>
              <div class="idle-badge" id="home-wild-idle">挂机中</div>
            </div>
            <div class="panel">
              <div class="panel-title"><span>⚡ 快速行动</span></div>
              <div class="quick-action-row wild-actions">
                <div class="action-card danger" id="home-wild-autoplay-action" onclick="window._toggleWildAutoplay()"><span class="ac-icon" id="home-wild-autoplay-icon">⏸</span><div class="ac-body"><div class="ac-label" id="home-wild-autoplay-label">停止挂机</div><div class="ac-sub" id="home-wild-autoplay-sub">保留当前位置</div></div></div>
                <div class="action-card info" onclick="window._returnToTown()"><span class="ac-icon">🏯</span><div class="ac-body"><div class="ac-label">回城补给</div><div class="ac-sub">泫渤派</div></div></div>
                <div class="action-card" onclick="window._openMapSheet()"><span class="ac-icon">⌂</span><div class="ac-body"><div class="ac-label">换地图</div><div class="ac-sub">选择区域</div></div></div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-title"><span>📊 本次挂机简报</span><span class="home-session-note" id="home-session-note">已 0分0秒</span></div>
              <div class="session-stats">
                <div class="stat-cell kill"><span class="num" id="home-wild-kills">0</span><span class="label">击杀</span></div>
                <div class="stat-cell exp"><span class="num" id="home-wild-exp">0</span><span class="label">经验</span></div>
                <div class="stat-cell gold"><span class="num" id="home-wild-gold">0</span><span class="label">金币</span></div>
                <div class="stat-cell"><span class="num" id="home-wild-drops">0</span><span class="label">掉落</span></div>
              </div>
              <div class="buff-row" id="home-wild-buffs"></div>
            </div>
          </div>
        </div><!-- end main-scroll -->

        <!-- 底部导航 -->
        <div class="bottom-menu" id="home-bottom-menu">
          <button class="menu-btn" data-panel="inventory" onclick="window._openPanel('inventory')">
            <div class="icon">🎒</div>背包
          </button>
          <button class="menu-btn" data-panel="character" onclick="window._openPanel('character')">
            <div class="icon">👤</div>角色
          </button>
          <button class="menu-btn active" data-panel="home">
            <div class="icon">🏠</div>主页
          </button>
          <button class="menu-btn" data-panel="quest" onclick="window._openPanel('quest')">
            <div class="icon">📜</div>任务
          </button>
          <button class="menu-btn" data-panel="settings" onclick="window._openPanel('settings')">
            <div class="icon">⚙</div>设置
          </button>
        </div>

      </div><!-- end page-home -->

      <!-- ===== 角色面板 ===== -->
      <div class="page-panel page-character" id="page-character">
        <div class="char-header">
          <div class="top-row-1">
            <div class="player-bar">
              <span class="name" id="char-player-name">—</span><span class="sep">·</span>
              <span class="level" id="char-player-level">Lv.1</span><span class="sep">·</span>
              <span class="faction neutral" id="char-player-faction">中立</span><span class="sep">·</span>
              <span class="career" id="char-player-career">—</span>
            </div>
          </div>
          <div class="stat-bars-compact">
            <div class="stat-row"><span class="stat-label hp">生命值</span><div class="gba-bar"><div class="gba-bar-fill fill-hp" id="char-hp-fill"></div><span class="gba-bar-pct" id="char-hp-pct">100%</span></div><span class="stat-num" id="char-hp-num">0/0</span></div>
            <div class="stat-row"><span class="stat-label mp">内功值</span><div class="gba-bar"><div class="gba-bar-fill fill-mp" id="char-mp-fill"></div><span class="gba-bar-pct" id="char-mp-pct">100%</span></div><span class="stat-num" id="char-mp-num">0/0</span></div>
            <div class="stat-row"><span class="stat-label exp">经验值</span><div class="gba-bar"><div class="gba-bar-fill fill-exp" id="char-exp-fill"></div><span class="gba-bar-pct" id="char-exp-pct">0%</span></div><span class="stat-num" id="char-exp-num">0/0</span></div>
          </div>
        </div>
        <div class="main-scroll">
          <div class="panel-content" id="character-panel-content"></div>
        </div>
        <div class="bottom-menu">
          <button class="menu-btn" onclick="window._openPanel('inventory')"><div class="icon">🎒</div>背包</button>
          <button class="menu-btn active"><div class="icon">👤</div>角色</button>
          <button class="menu-btn" onclick="window._openPanel('home')"><div class="icon">🏠</div>主页</button>
          <button class="menu-btn" onclick="window._openPanel('quest')"><div class="icon">📜</div>任务</button>
          <button class="menu-btn" onclick="window._openPanel('settings')"><div class="icon">⚙</div>设置</button>
        </div>
      </div>

      <!-- ===== 背包面板 ===== -->
      <div class="page-panel page-inventory" id="page-inventory">
        <div class="eq-header">
          <div class="eq-title">背包</div>
          <div class="eq-subtitle">拖装备进槽穿戴 · 拖回背包卸下 · 点物品查看与丢弃</div>
        </div>
        <div class="main-scroll">
          <div class="panel-content" id="inventory-panel-content"></div>
        </div>
        <div class="bottom-menu">
          <button class="menu-btn active"><div class="icon">🎒</div>背包</button>
          <button class="menu-btn" onclick="window._openPanel('character')"><div class="icon">👤</div>角色</button>
          <button class="menu-btn" onclick="window._openPanel('home')"><div class="icon">🏠</div>主页</button>
          <button class="menu-btn" onclick="window._openPanel('quest')"><div class="icon">📜</div>任务</button>
          <button class="menu-btn" onclick="window._openPanel('settings')"><div class="icon">⚙</div>设置</button>
        </div>
      </div>

      <!-- ===== 挂机面板 ===== -->
      <div class="page-panel page-autoplay" id="page-autoplay">
        <div class="top-bar">
          <div class="sheet-header with-back">
            <button class="sheet-back" onclick="window._closePanel()">←</button>
            <span class="sheet-title">⚙️ 挂机设置</span>
          </div>
        </div>
        <div class="main-scroll">
          <div class="panel-content" id="autoplay-panel-content"></div>
        </div>
        <div class="bottom-menu">
          <button class="menu-btn" onclick="window._openPanel('inventory')"><div class="icon">🎒</div>背包</button>
          <button class="menu-btn" onclick="window._openPanel('character')"><div class="icon">👤</div>角色</button>
          <button class="menu-btn active" onclick="window._openPanel('home')"><div class="icon">🏠</div>主页</button>
          <button class="menu-btn" onclick="window._openPanel('quest')"><div class="icon">📜</div>任务</button>
          <button class="menu-btn" onclick="window._openPanel('settings')"><div class="icon">⚙</div>设置</button>
        </div>
      </div>

      <!-- ===== 任务面板 ===== -->
      <div class="page-panel page-quest" id="page-quest">
        <div class="eq-header">
          <div class="eq-title">任务</div>
          <div class="eq-subtitle">推进江湖故事 · 收集目标物品 · 返回 NPC 提交</div>
        </div>
        <div class="main-scroll">
          <div class="panel-content" id="quest-panel-content"></div>
        </div>
        <div class="bottom-menu">
          <button class="menu-btn" onclick="window._openPanel('inventory')"><div class="icon">🎒</div>背包</button>
          <button class="menu-btn" onclick="window._openPanel('character')"><div class="icon">👤</div>角色</button>
          <button class="menu-btn" onclick="window._openPanel('home')"><div class="icon">🏠</div>主页</button>
          <button class="menu-btn active"><div class="icon">📜</div>任务</button>
          <button class="menu-btn" onclick="window._openPanel('settings')"><div class="icon">⚙</div>设置</button>
        </div>
      </div>

      <!-- ===== 设置面板 ===== -->
      <div class="page-panel page-settings" id="page-settings">
        <div class="eq-header">
          <div class="eq-title">设置</div>
          <div class="eq-subtitle">存档导入导出 · 角色管理 · 游戏信息</div>
        </div>
        <div class="main-scroll">
          <div class="panel-content">
            <div class="settings-shell">
              <div class="set-card">
                <div class="sc-head">
                  <span class="sc-ico">📤</span>
                  <div>
                    <div class="sc-name">导出存档</div>
                    <div class="sc-desc">生成 base64 文本，可复制到其他设备。</div>
                  </div>
                </div>
                <button class="sc-radio on" id="exportScopeAll" onclick="window._settingsSetExportScope('all')"><span class="rd-dot"></span><span class="rd-text">全部角色<span class="rd-sub">包含全局配置和所有已创建角色</span></span></button>
                <button class="sc-radio" id="exportScopeCurrent" onclick="window._settingsSetExportScope('current')"><span class="rd-dot"></span><span class="rd-text">当前角色<span class="rd-sub">仅导出正在游玩的角色</span></span></button>
                <textarea class="sc-textarea" id="settingsExportText" readonly placeholder="点击导出后显示存档文本"></textarea>
                <div class="sc-actions">
                  <button class="sc-btn green" onclick="window._settingsExportSave()">导出并复制</button>
                  <button class="sc-btn ghost" onclick="window._settingsCopyExport()">复制文本</button>
                </div>
              </div>
              <div class="set-card">
                <div class="sc-head">
                  <span class="sc-ico">📥</span>
                  <div>
                    <div class="sc-name">导入存档</div>
                    <div class="sc-desc">支持全量导入或单角色导入，导入成功后会刷新页面。</div>
                  </div>
                </div>
                <textarea class="sc-textarea import" id="settingsImportText" placeholder="粘贴 base64 存档文本"></textarea>
                <div class="sc-note"><b>注意：</b>全量导入会替换当前全部角色存档。</div>
                <button class="sc-btn blue" onclick="window._settingsImportSave()">导入存档</button>
              </div>
              <div class="set-card">
                <div class="sc-head">
                  <span class="sc-ico">👥</span>
                  <div>
                    <div class="sc-name">角色管理</div>
                    <div class="sc-desc">保存当前进度并返回角色列表，进行切换、创建或删除。</div>
                  </div>
                </div>
                <button class="sc-btn green" onclick="window._returnToSaveList()">返回角色列表</button>
              </div>
              <div class="set-card">
                <div class="sc-head">
                  <span class="sc-ico">ℹ️</span>
                  <div>
                    <div class="sc-name">关于</div>
                    <div class="sc-desc">v1.0 挂机文字 RPG · schema_version 1.0</div>
                  </div>
                </div>
                <div class="sc-info-row"><span class="sc-info-k">版本</span><span class="sc-info-v">v1.0</span></div>
                <div class="sc-info-row"><span class="sc-info-k">存档结构</span><span class="sc-info-v">1.0</span></div>
                <div class="sc-disabled-note">音量 / 语言 / 主题偏好在 v1.0 暂不开放。</div>
              </div>
            </div>
          </div>
        </div>
        <div class="bottom-menu">
          <button class="menu-btn" onclick="window._openPanel('inventory')"><div class="icon">🎒</div>背包</button>
          <button class="menu-btn" onclick="window._openPanel('character')"><div class="icon">👤</div>角色</button>
          <button class="menu-btn" onclick="window._openPanel('home')"><div class="icon">🏠</div>主页</button>
          <button class="menu-btn" onclick="window._openPanel('quest')"><div class="icon">📜</div>任务</button>
          <button class="menu-btn active"><div class="icon">⚙</div>设置</button>
        </div>
      </div>

      <!-- ===== 打怪面板 ===== -->
      <div class="page-panel page-combat" id="page-combat">
        <!-- 顶部状态栏 -->
        <div class="top-bar">
          <div class="top-row-1">
            <div class="player-bar">
              <span class="name" id="combat-name">—</span>
              <span class="sep">·</span>
              <span class="level" id="combat-level">Lv.1</span>
              <span class="sep">·</span>
              <span class="faction positive" id="combat-faction">正派</span>
              <span class="sep">·</span>
              <span class="career" id="combat-class">—</span>
            </div>
          </div>
          <div class="stat-bars-compact">
            <div class="stat-row">
              <span class="stat-label hp">生命值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-hp" id="role-hp-fill" style="width:100%"></div><span class="gba-bar-pct" id="role-hp-pct">100%</span></div>
              <span class="stat-num" id="role-hp-text">—/—</span>
            </div>
            <div class="stat-row">
              <span class="stat-label mp">内功值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-mp" id="role-mp-fill" style="width:100%"></div><span class="gba-bar-pct" id="role-mp-pct">100%</span></div>
              <span class="stat-num" id="role-mp-text">—/—</span>
            </div>
            <div class="stat-row">
              <span class="stat-label exp">经验值</span>
              <div class="gba-bar"><div class="gba-bar-fill fill-exp" id="role-exp-fill" style="width:0%"></div><span class="gba-bar-pct" id="role-exp-pct">0%</span></div>
              <span class="stat-num" id="role-exp-text">—/—</span>
            </div>
          </div>
        </div>

        <!-- Zone 选择条 -->
        <div class="zone-selector">
          <div class="zone-current" id="zone-current" onclick="window._openMapSheet()">
            <span class="label">⌂ 地图</span>
            <span class="name" id="zone-name">泫渤派郊外</span>
            <span class="dropdown">▼</span>
          </div>
          <div class="idle-indicator" id="idle-indicator">挂机中</div>
        </div>

        <!-- 主滚动区 -->
        <div class="main-scroll battle-zone-layout">
          ${renderZoneBattleArea()}
        </div>

        <!-- 底部动作菜单 -->
        <div class="bottom-menu">
          <button class="menu-btn" onclick="window._openPanel('inventory')"><span class="icon">🎒</span>背包</button>
          <button class="menu-btn" onclick="window._openPanel('character')"><span class="icon">👤</span>角色</button>
          <button class="menu-btn" onclick="window._openPanel('home')"><span class="icon">🏠</span>主页</button>
          <button class="menu-btn" onclick="window._openPanel('quest')"><span class="icon">📋</span>任务</button>
          <button class="menu-btn" onclick="window._openPanel('settings')"><span class="icon">⚙</span>设置</button>
        </div>
      </div><!-- end page-combat -->

      <!-- ===== 地图选择 bottom sheet（在 phone-frame 内任意位置） ===== -->
      <div class="sheet-backdrop" id="mapSheet">
        <div class="bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <span class="sheet-title">⌂ 地图选择</span>
            <button class="sheet-close" id="mapSheetClose" onclick="window._closeMapSheet()">×</button>
          </div>
          <div class="sheet-list" id="map-sheet-list"></div>
        </div>
      </div>

      <!-- ===== NPC 对话气泡 ===== -->
      <div class="npc-dialog-backdrop" id="npcDialogBackdrop">
        <div class="npc-dialog" id="npcDialogBox">
          <div class="npc-dialog-head" id="npcDialogHead">
            <div class="npc-dialog-avatar" id="npcDialogAvatar">👤</div>
            <div>
              <div class="npc-dialog-name" id="npcDialogName">刀剑笑</div>
              <div class="npc-dialog-tag" id="npcDialogTag">武器商 / 强化</div>
            </div>
          </div>
          <div class="npc-dialog-line" id="npcDialogLine">客官，来看看我的神兵利器！</div>
          <div class="npc-func-row" id="npcFuncRow"></div>
          <button class="npc-dialog-close" id="npcDialogClose">关 闭</button>
        </div>
      </div>

      <!-- ===== 数量选择弹窗 ===== -->
      <div class="qty-backdrop" id="qtyBackdrop">
        <div class="qty-box">
          <div class="qty-head">
            <div class="qty-icon" id="qtyIcon">🧪</div>
            <div>
              <div class="qty-name" id="qtyName">小生命药剂</div>
              <div class="qty-unit">单价: <b id="qtyUnitPrice">10</b> 金币 / 个</div>
            </div>
          </div>
          <div class="qty-stepper">
            <button class="qty-step" id="qtyMinus">−</button>
            <input class="qty-input" id="qtyInput" type="number" value="1" min="1" max="9999">
            <button class="qty-step" id="qtyPlus">+</button>
          </div>
          <div class="qty-quick">
            <button data-qty="1">×1</button>
            <button data-qty="10">×10</button>
            <button data-qty="max">全部</button>
          </div>
          <div class="qty-total">
            合计: <span class="qt-val" id="qtyTotalPrice">10</span> 金币
          </div>
          <div class="qty-actions">
            <button class="qty-cancel" id="qtyCancel">取消</button>
            <button class="qty-confirm" id="qtyConfirm">确认购买</button>
          </div>
        </div>
      </div>

      <!-- ===== 韦大宝 · 仓库面板 ===== -->
      <div class="sheet-backdrop" id="warehouseBackdrop">
        <div class="bottom-sheet craft-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-header with-back">
            <button class="sheet-back" id="warehouseBack">←</button>
            <span class="sheet-title">📦 韦大宝 · 仓库</span>
          </div>
          <div class="wh-body">
            <div class="wh-pane top">
              <div class="wh-pane-head">
                <span class="wh-title">🏛 仓库</span>
                <span class="wh-count push" id="whWarehouseCount">0 / 50</span>
                <button class="wh-sort" data-sort="warehouse">整理</button>
              </div>
              <div class="wh-scroll">
                <div class="bag-grid" id="whWarehouseGrid">
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                </div>
              </div>
            </div>
            <div class="wh-pane bottom">
              <div class="wh-pane-head">
                <span class="wh-title">🎒 背包</span>
                <span class="wh-gold push">🪙 <span id="whPlayerGold">0</span></span>
                <span class="wh-count" id="whBagCount">0 / 50</span>
                <button class="wh-sort" data-sort="bag">整理</button>
              </div>
              <div class="wh-scroll">
                <div class="bag-grid" id="whBagGrid">
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                  <div class="bag-tile empty"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 韦大宝 · 存入/取出弹窗 ===== -->
      <div class="qty-backdrop" id="whPopup">
        <div class="qty-box" onclick="event.stopPropagation()">
          <div class="qty-head">
            <div class="qty-icon" id="whIcon">🍶</div>
            <div>
              <div class="qty-name" id="whName">物品</div>
              <div class="qty-unit" id="whMeta">背包 ×1 · 仓库 0/50</div>
            </div>
          </div>
          <div class="qty-stepper">
            <button class="qty-step" data-step="-1">−</button>
            <input class="qty-input" id="whInput" type="number" inputmode="numeric" value="1" min="1">
            <button class="qty-step" data-step="1">＋</button>
          </div>
          <div class="qty-quick">
            <button data-set="1">×1</button>
            <button data-set="10">×10</button>
            <button data-set="max">全部</button>
          </div>
          <div class="qty-actions">
            <button class="qty-cancel" id="whCancel">取消</button>
            <button class="qty-confirm" id="whConfirm">存入</button>
          </div>
        </div>
      </div>

      <!-- ===== 仓库装备详情弹窗 ===== -->
      <div class="qty-backdrop" id="whEquipPopup">
        <div class="qty-box" onclick="event.stopPropagation()">
          <div class="qty-head">
            <div class="qty-icon" id="whEquipIcon">⚔</div>
            <div>
              <div class="qty-name" id="whEquipName">装备</div>
              <div class="qty-unit" id="whEquipSub">装备</div>
            </div>
          </div>
          <div class="ed-body" id="whEquipBody"></div>
          <div class="qty-actions">
            <button class="qty-cancel" id="whEquipCancel">关闭</button>
            <button class="qty-confirm" id="whEquipAction">存入</button>
          </div>
        </div>
      </div>

      <!-- ===== 角色页二次确认弹窗 ===== -->
      <div class="qty-backdrop" id="roleConfirmPopup">
        <div class="qty-box" onclick="event.stopPropagation()">
          <div class="qty-head">
            <div class="qty-icon" id="roleConfirmIcon">⚠</div>
            <div>
              <div class="qty-name" id="roleConfirmTitle">确认操作</div>
              <div class="qty-unit" id="roleConfirmBody">请确认是否继续。</div>
            </div>
          </div>
          <div class="qty-actions">
            <button class="qty-cancel" onclick="window._closeRoleConfirm()">取消</button>
            <button class="qty-confirm" id="roleConfirmAction" onclick="window._confirmRoleAction()">确认</button>
          </div>
        </div>
      </div>

      <!-- ===== 刀剑笑商店面板 ===== -->
      <div class="sheet-backdrop" id="djxShopBackdrop">
        <div class="bottom-sheet djx-shop shop-sell">
          <div class="sheet-handle"></div>
          <div class="sheet-header with-back">
            <button class="sheet-back" id="djxShopBack">←</button>
            <span class="sheet-title" id="djxShopTitle">⚔️ 刀剑笑</span>
            <div class="shop-tabs">
              <span class="shop-tab active" id="tab-weapon" onclick="window._switchDjxTab('weapon')">武器商店</span>
              <span class="shop-tab" id="tab-synth" onclick="window._switchDjxTab('synth')">装备合成</span>
              <span class="shop-tab" id="tab-enhance" onclick="window._switchDjxTab('enhance')">装备强化</span>
            </div>
          </div>
          <div class="djx-shop-gold">💰 金币: <b id="djxShopGold">0</b></div>
          <div id="djx-weapon-content" class="djx-tab-content"></div>
          <div id="djx-synth-content" class="djx-tab-content" style="display:none"></div>
          <div id="djx-enhance-content" class="djx-tab-content" style="display:none"></div>
        </div>
      </div>

      <!-- ===== 强化/合成面板 ===== -->
      <div class="sheet-backdrop" id="craftBackdrop">
        <div class="bottom-sheet craft-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-header with-back">
            <button class="sheet-back" id="craftBack">←</button>
            <span class="sheet-title" id="craftTitle">⚒️ 强化</span>
          </div>
          <div class="craft-body">
            <div class="craft-work" id="craft-work"></div>
            <div class="craft-bag" id="craft-bag"></div>
          </div>
        </div>
      </div>

      <!-- ===== 银娇龙 · 防具商店 ===== -->
      <div class="sheet-backdrop" id="yjlShopBackdrop">
        <div class="bottom-sheet craft-sheet shop-sell">
          <div class="sheet-handle"></div>
          <div class="sheet-header with-back">
            <button class="sheet-back" id="yjlShopBack">←</button>
            <span class="sheet-title">🛡️ 银娇龙</span>
          </div>
          <div class="single-shop-content" id="yjl-weapon-content"></div>
        </div>
      </div>

      <!-- ===== 平十指 · 药剂商店 ===== -->
      <div class="sheet-backdrop" id="pszShopBackdrop">
        <div class="bottom-sheet craft-sheet shop-sell">
          <div class="sheet-handle"></div>
          <div class="sheet-header with-back">
            <button class="sheet-back" id="pszShopBack">←</button>
            <span class="sheet-title">🧪 平十指</span>
          </div>
          <div class="single-shop-content" id="psz-weapon-content"></div>
        </div>
      </div>

      <!-- ===== 多存档 / 创建 / 离线收益 Modal ===== -->
      <div class="modal-overlay save-modal-overlay" id="modal-multi-save">
        <div class="modal-box save-modal-box">
          <div class="modal-title">
            <span>👥 角色列表</span>
            <button class="sheet-close" onclick="window._closeModal()">×</button>
          </div>
          <div class="modal-body" id="multi-save-content"></div>
        </div>
      </div>
      <div class="modal-overlay save-modal-overlay" id="modal-create">
        <div class="modal-box save-modal-box create-modal-box">
          <div class="modal-title">
            <span>✨ 创建角色</span>
            <button class="sheet-close" onclick="window._closeModal()">×</button>
          </div>
          <div class="modal-body" id="create-content"></div>
        </div>
      </div>
      <div class="modal-overlay save-modal-overlay" id="modal-delete-confirm">
        <div class="modal-box delete-modal-box">
          <div class="modal-title">⚠️ 删除角色</div>
          <div class="modal-body">
            <div class="del-body" id="delete-confirm-msg">确认删除该角色？</div>
          </div>
          <div class="modal-footer">
            <button class="btn" onclick="window._closeModal()">取消</button>
            <button class="btn danger" id="confirm-delete-btn">确认删除</button>
          </div>
        </div>
      </div>
      <div class="modal-overlay save-modal-overlay" id="modal-offline">
        <div class="modal-box save-modal-box offline-modal-box">
          <div class="modal-title">
            <span>🌙 离线收益</span>
          </div>
          <div class="modal-body" id="offline-summary"></div>
          <div class="modal-footer">
            <button class="btn primary" onclick="window._confirmOfflineReward()">领取并继续</button>
          </div>
        </div>
      </div>
      <div class="offline-loading-overlay" id="offline-loading-overlay">
        <div class="offline-loading-card">
          <div class="offline-loading-moon">🌙</div>
          <div class="offline-loading-title">离线结算中…</div>
          <div class="offline-loading-sub">正在重放挂机战斗</div>
          <div class="offline-progress">
            <div class="offline-progress-fill" id="offline-progress-fill"></div>
            <div class="offline-progress-text" id="offline-progress-text">0%</div>
          </div>
        </div>
      </div>

    </div><!-- end phone-frame -->
  `;

  if (!mainScreenKeydownBound) {
    document.addEventListener('keydown', handleMainScreenKeydown);
    mainScreenKeydownBound = true;
  }
}

function handleMainScreenKeydown(e) {
  if (e.key !== 'Escape') return;

  // 优先关闭任何打开的 sheet backdrop
  const sheets = document.querySelectorAll('.sheet-backdrop.open');
  if (sheets.length > 0) {
    sheets.forEach(s => s.classList.remove('open'));
    return;
  }
  const npc = document.getElementById('npcDialogBackdrop');
  if (npc?.classList.contains('open')) {
    npc.classList.remove('open');
    return;
  }
  const qty = document.getElementById('qtyBackdrop');
  if (qty?.classList.contains('open')) {
    qty.classList.remove('open');
    return;
  }

  // 面板回退
  const combatPanel = document.getElementById('page-combat');
  const homePanel = document.getElementById('page-home');
  if (combatPanel?.classList.contains('active')) {
    window._openPanel('home');
  } else if (!homePanel?.classList.contains('active')) {
    window._openPanel('home');
  }
}
