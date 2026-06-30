import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUseSpeechSynthesis, createUtterance, shouldAutoSpeak } from '../../src/renderer/src/voice/speech'

describe('speech helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('only auto speaks when playback is enabled and text is not blank', () => {
    expect(shouldAutoSpeak(false, 'hello')).toBe(true)
    expect(shouldAutoSpeak(true, 'hello')).toBe(false)
    expect(shouldAutoSpeak(false, '   ')).toBe(false)
  })

  it('detects browser speech synthesis support', () => {
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: vi.fn(),
        cancel: vi.fn()
      },
      SpeechSynthesisUtterance: vi.fn()
    })

    expect(canUseSpeechSynthesis()).toBe(true)
  })

  it('creates an utterance with stable defaults and lifecycle callbacks', () => {
    class TestSpeechSynthesisUtterance {
      public rate = 0
      public pitch = 0
      public onend: (() => void) | null = null
      public onerror: (() => void) | null = null

      public constructor(public text: string) {}
    }

    vi.stubGlobal('SpeechSynthesisUtterance', TestSpeechSynthesisUtterance)

    const onEnd = vi.fn()
    const onError = vi.fn()
    const utterance = createUtterance('ArcMind online', onEnd, onError)

    expect(utterance.text).toBe('ArcMind online')
    expect(utterance.rate).toBe(1)
    expect(utterance.pitch).toBe(1)

    utterance.onend?.(new Event('end') as SpeechSynthesisEvent)
    utterance.onerror?.(new Event('error') as SpeechSynthesisErrorEvent)

    expect(onEnd).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('语音播报失败。')
  })
})
