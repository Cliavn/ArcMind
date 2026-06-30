import { describe, expect, it } from 'vitest'
import { desktopBridgeUnavailableMessage, hasModelSettingsBridge } from '../../src/renderer/src/ui/runtimeBridge'

describe('runtime bridge checks', () => {
  it('reports unavailable settings bridge outside Electron preload', () => {
    expect(hasModelSettingsBridge(undefined)).toBe(false)
    expect(desktopBridgeUnavailableMessage).toContain('浏览器预览环境')
  })

  it('accepts a bridge with the model settings contract', () => {
    expect(
      hasModelSettingsBridge({
        settings: {
          getModelConfig: async () => ({
            provider: 'openai-compatible',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxContextMessages: 12,
            timeoutMs: 60000,
            hasApiKey: true
          }),
          setModelConfig: async () => ({
            provider: 'openai-compatible',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxContextMessages: 12,
            timeoutMs: 60000,
            hasApiKey: true
          }),
          testModelConfig: async () => ({ ok: true })
        }
      } as never)
    ).toBe(true)
  })
})
