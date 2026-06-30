# 模块：AGENT 协作系统

## 模块职责

AGENT 协作系统负责维护项目事实、开发流程、模块边界、质量门禁和任务报告规范。

不负责保存运行配置、API Key、私密对话、语音样本或用户本地路径。

## 公共接口

- `AGENTS.md`：最高优先级入口。
- `docs/agent/00-index.md`：阅读路由。
- `docs/agent/modules/`：模块边界。
- `docs/agent/workflows/`：任务流程。
- `docs/agent/checklists/`：任务完成检查。

## 边界规则

- 文档必须描述可执行约束，不堆砌空泛原则。
- 项目事实变化必须落到对应文档。
- 外部方案必须先进入 `04-decisions.md`，不能直接覆盖架构事实。

## 验证要求

- 修改文档结构后运行 `scripts/check-agent-system.ps1`。
- 若检查脚本尚不可用，手动确认索引引用的文件存在。
