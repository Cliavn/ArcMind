# Workflow：性能优化

## 目标

性能优化必须有可比较证据，尤其关注 WebGL、流式回复、录音播放和 Electron 启动性能。

## 步骤

1. 明确性能问题和测量方式。
2. 记录优化前证据。
3. 定位瓶颈，优先选择低风险改动。
4. 实施优化并记录优化后证据。
5. 验证功能行为不变。
6. 如涉及视觉降级策略，更新 `design-system.md` 或 `visual-system.md`。

## 常见关注点

- WebGL draw call、粒子数量、材质和 resize 频率。
- 流式 token 渲染导致的重复 layout。
- TTS 播放和录音资源释放。
- Electron main 与 renderer IPC 频率。
