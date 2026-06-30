# UI 协作流程

本文件定义 ArcMind 的 UI 和视觉协作方式。

## 修改前

1. 阅读 `design-system.md`。
2. 确认本次改动属于对话界面、视觉系统、设置面板、历史/记忆管理还是通用组件。
3. 查找现有组件、token、状态枚举和动画状态机。
4. 明确要支持的状态：idle、listening、transcribing、thinking、speaking、muted、error。

## 修改中

- 优先复用现有组件和视觉 token。
- 不在组件内散落临时颜色、阴影和动画曲线。
- 粒子状态必须来自业务状态或明确的视觉状态机。
- 新增控制项时必须处理 hover、focus、disabled、loading、error 和窄窗口状态。
- 不用页面文案解释视觉效果或快捷键。

## 修改后

- 执行相关测试、类型检查和手动视觉检查。
- 涉及 WebGL/Canvas 时确认画布非空白、尺寸正确、状态切换可见。
- 记录无法验证的设备、尺寸或性能风险。
- 如果新增长期视觉规则，更新 `design-system.md`。
