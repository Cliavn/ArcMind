# ArcMind

ArcMind，中文定位为“弧核智能终端”，是一款面向 Windows 桌面的沉浸式 AI 对话软件。第一版目标是做出类似电影中私人智能助手的交流感：粒子核心视觉、流式大模型对话、语音输入、语音播报、本地会话历史和可控的长期记忆。

当前仓库先建立开发协助操作系统，便于后续由人类和 agent 共同推进设计、编码、验证和迭代。

## 文档入口

- `AGENTS.md`：agent 工作入口和硬规则。
- `docs/agent/00-index.md`：协作文档索引。
- `docs/agent/01-project-overview.md`：项目目标和阶段边界。
- `docs/agent/02-architecture.md`：架构分层和模块边界。
- `docs/agent/design-system.md`：ArcMind 视觉和交互基线。

## 第一版默认方向

- 平台：Windows 桌面优先。
- 桌面壳：Electron。
- 前端：React + TypeScript + Three.js/WebGL。
- 模型：云端大模型 API 优先，后续保留本地模型适配空间。
- 交互：文字聊天 + 点击说话 + 语音播报。
- 数据：本地会话历史、设置和可查看/可删除的长期记忆。

## 本地命令

- `npm install`：安装依赖。
- `npm run dev`：启动开发版桌面应用。
- `npm run typecheck`：运行 TypeScript 检查。
- `npm test`：运行单元测试。
- `npm run build`：构建生产产物。
- `npm run smoke`：启动生产 renderer 并检查输入、设置入口和粒子 canvas。
- `npm run package:win`：构建 Windows NSIS 安装包。
