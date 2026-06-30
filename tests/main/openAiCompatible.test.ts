import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../src/shared'
import { buildRequestMessages, parseOpenAiCompatibleStream, parseStreamLine } from '../../src/main/ai/openAiCompatible'

describe('openAiCompatible stream parsing', () => {
  it('parses token deltas from server-sent event lines', () => {
    expect(parseStreamLine('data: {"choices":[{"delta":{"content":"Arc"}}]}')).toBe('Arc')
    expect(parseStreamLine('data: [DONE]')).toBeNull()
    expect(parseStreamLine(': keepalive')).toBeNull()
  })

  it('parses streamed chunks across line boundaries', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Ar"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"cMind"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n'))
        controller.close()
      }
    })

    const tokens: string[] = []
    for await (const token of parseOpenAiCompatibleStream(body)) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Ar', 'cMind'])
  })
})

describe('buildRequestMessages', () => {
  it('prefixes the persona prompt and keeps only the requested conversation window', () => {
    const messages: ChatMessage[] = [
      message('1', 'assistant', 'ready'),
      message('2', 'user', 'first'),
      message('3', 'assistant', 'second'),
      message('4', 'user', 'third')
    ]

    const requestMessages = buildRequestMessages(messages, 2)

    expect(requestMessages[0]).toMatchObject({ role: 'system' })
    expect(requestMessages[0].content).toContain('ArcMind')
    expect(requestMessages.slice(1)).toEqual([
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' }
    ])
  })
})

function message(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    createdAt: new Date(0).toISOString()
  }
}
