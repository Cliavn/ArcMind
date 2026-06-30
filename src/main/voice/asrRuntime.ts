import type { ModelConfig, TranscribeAudioInput, TranscribeAudioResult } from '../../shared'
import { appError } from '../ai/errors'
import { validateConfig } from '../ai/openAiCompatible'

export async function transcribeOpenAiCompatibleAudio(config: ModelConfig, input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  validateConfig(config)
  validateAudioInput(input)

  const form = new FormData()
  form.set('model', 'whisper-1')
  form.set('file', new Blob([input.audio], { type: input.mimeType }), input.fileName ?? defaultFileName(input.mimeType))

  const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    body: form,
    signal: AbortSignal.timeout(Math.min(config.timeoutMs, 60000))
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as { text?: unknown }
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    throw appError('unknown', '语音识别没有返回文字。', true)
  }

  return { text }
}

export function validateAudioInput(input: TranscribeAudioInput): void {
  if (!(input.audio instanceof ArrayBuffer) || input.audio.byteLength === 0) {
    throw appError('validation_failed', '录音为空，请重新说话。', true)
  }

  if (input.audio.byteLength > 25 * 1024 * 1024) {
    throw appError('validation_failed', '录音太长，请缩短后重试。', true)
  }

  if (!input.mimeType.startsWith('audio/')) {
    throw appError('validation_failed', '录音格式不可用。', true)
  }
}

function defaultFileName(mimeType: string): string {
  if (mimeType.includes('webm')) {
    return 'speech.webm'
  }
  if (mimeType.includes('mpeg')) {
    return 'speech.mp3'
  }
  if (mimeType.includes('wav')) {
    return 'speech.wav'
  }
  return 'speech.audio'
}

