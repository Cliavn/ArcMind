import type { AiStreamEvent, ChatMessage, LongTermMemory, ModelConfig } from '../../shared'
import { buildChatContext } from './context'
import { appError } from './errors'

export interface StreamChatOptions {
  requestId: string
  messages: ChatMessage[]
  memories?: LongTermMemory[]
  config: ModelConfig
  signal: AbortSignal
  onEvent: (event: AiStreamEvent) => void
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

export async function streamOpenAiCompatibleChat(options: StreamChatOptions): Promise<ChatMessage> {
  const { config, messages, requestId, signal, onEvent } = options
  validateConfig(config)

  const assistantMessage: ChatMessage = {
    id: requestId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString()
  }

  const timeout = AbortSignal.timeout(config.timeoutMs)
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildRequestMessages(messages, config.maxContextMessages, options.memories ?? []),
      temperature: config.temperature,
      stream: true
    }),
    signal: AbortSignal.any([signal, timeout])
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Model response did not include a stream body.')
  }

  onEvent({ type: 'metadata', requestId, model: config.model })

  for await (const delta of parseOpenAiCompatibleStream(response.body)) {
    assistantMessage.content += delta
    onEvent({ type: 'token', requestId, delta })
  }

  onEvent({ type: 'done', requestId, message: assistantMessage })
  return assistantMessage
}

export async function testOpenAiCompatibleConnection(config: ModelConfig): Promise<void> {
  validateConfig(config)

  const response = await fetch(`${config.baseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    signal: AbortSignal.timeout(Math.min(config.timeoutMs, 15000))
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
}

export function validateConfig(config: ModelConfig): void {
  if (!config.apiKey) {
    throw appError('validation_failed', '请先在设置中配置 API Key。', true)
  }
  if (!config.baseUrl.startsWith('https://') && !config.baseUrl.startsWith('http://')) {
    throw appError('validation_failed', 'Base URL 必须以 http:// 或 https:// 开头。', true)
  }
  if (!config.model) {
    throw appError('validation_failed', '请配置模型名称。', true)
  }
}

export function buildRequestMessages(
  messages: ChatMessage[],
  maxContextMessages: number,
  memories: LongTermMemory[] = []
): Array<{ role: string; content: string }> {
  return buildChatContext({ messages, maxContextMessages, memories })
}

export async function* parseOpenAiCompatibleStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''

      for (const event of events) {
        const delta = parseStreamEvent(event)
        if (delta) {
          yield delta
        }
      }
    }

    buffer += decoder.decode()
    const delta = parseStreamEvent(buffer)
    if (delta) {
      yield delta
    }
  } finally {
    reader.releaseLock()
  }
}

export function parseStreamLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) {
    return null
  }

  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') {
    return null
  }

  const parsed = JSON.parse(payload) as ChatCompletionChunk
  return parsed.choices?.[0]?.delta?.content ?? null
}

export function parseStreamEvent(event: string): string | null {
  const lines = event.split(/\r?\n/)
  let content = ''

  for (const line of lines) {
    const delta = parseStreamLine(line)
    if (delta) {
      content += delta
    }
  }

  return content || null
}
