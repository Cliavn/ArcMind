import { describe, expect, it } from 'vitest'
import { coreModeLabel, statusText } from '../../src/renderer/src/ui/statusText'

describe('statusText', () => {
  it('describes renderer status without depending on React state', () => {
    expect(statusText('idle', 'idle')).toBe('待机')
    expect(statusText('listening', 'listening')).toBe('正在聆听')
    expect(statusText('transcribing', 'idle')).toBe('正在转写')
    expect(statusText('muted', 'idle')).toBe('静音待机')
    expect(statusText('error', 'idle')).toBe('需要处理')
  })

  it('shows microphone permission requests before the visual mode label', () => {
    expect(statusText('idle', 'requesting')).toBe('请求麦克风权限')
  })

  it('provides Chinese labels for core modes', () => {
    expect(coreModeLabel('thinking')).toBe('思考')
    expect(coreModeLabel('speaking')).toBe('回应')
    expect(coreModeLabel('error')).toBe('异常')
  })
})
