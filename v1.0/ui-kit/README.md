# 独立UI组件样板

通过静态服务器打开本目录index.html（Pages为 /v1.0/ui-kit/）。

样板使用演示数据，不加载游戏入口、不读取或修改玩家存档。正式游戏未引用这里的文件。

- tokens.css：--rpg-设计变量
- components.css：.rpg-ui作用域组件
- index.html：语义结构与样例
- demo.js：仅样板操作，不迁入游戏运行时
- ../docs/ui/STYLE_GUIDE.md：样式规范
- ../docs/ui/INTERACTION_MAP.md：交互对照
- ../docs/ui/PREPARATION_QA.md：验证结果

后续复用：在目标区域添加rpg-ui作用域，加载两份CSS、使用rpg-*组件结构并绑定原业务处理器。按组件迁移旧样式，不复制演示数据。
