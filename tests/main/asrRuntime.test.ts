import { describe, expect, it } from 'vitest'
import { validateAudioInput } from '../../src/main/voice/asrRuntime'
import type { TranscribeAudioInput } from '../../src/shared'

describe('validateAudioInput', () => {
  it('accepts non-empty audio buffers', () => {
    expect(() => validateAudioInput(input(new Uint8Array([1, 2, 3]).buffer, 'audio/webm'))).not.toThrow()
  })

  it('rejects empty audio', () => {
    expect(() => validateAudioInput(input(new ArrayBuffer(0), 'audio/webm'))).toThrow()
  })

  it('rejects non-audio mime types', () => {
    expect(() => validateAudioInput(input(new Uint8Array([1]).buffer, 'application/octet-stream'))).toThrow()
  })
})

function input(audio: ArrayBuffer, mimeType: string): TranscribeAudioInput {
  return {
    audio,
    mimeType,
    fileName: 'speech.webm'
  }
}

