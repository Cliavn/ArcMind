# Workflow：UI 与视觉改造

## 目标

UI 改造必须提升可用性、状态清晰度或 ArcMind 识别度，不能只增加装饰。

## 步骤

1. 阅读 `design-system.md`、`design-ops.md` 和相关模块文档。
2. 明确改动影响的状态、页面和交互路径。
3. 检查现有组件、token 和动画状态机。
4. 实现改动并处理 loading、empty、error、disabled、hover、focus 和窄窗口状态。
5. 对 WebGL/Canvas 场景检查非空白、尺寸正确和状态切换。
6. 运行相关测试和手动视觉验收。
7. 如果沉淀出长期规则，更新 `design-system.md`。

## 禁止事项

- 不允许创建营销 landing page 作为应用首页。
- 不允许让粒子视觉遮挡聊天内容和核心操作。
- 不允许只靠颜色表达状态。
- 不允许复制外部项目的原创视觉资产或受许可约束的源码。
