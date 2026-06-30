import type { BrowserWindow } from 'electron'
import type { AiStreamEvent, ChatMessage, LongTermMemory, ModelConfig } from '../../shared'
import { appError, isAbortError, normalizeAiError } from './errors'
import { streamOpenAiCompatibleChat, testOpenAiCompatibleConnection, validateConfig } from './openAiCompatible'

interface SendChatOptions {
  requestId: string
  conversationId: string
  messages: ChatMessage[]
  memories?: LongTermMemory[]
  config: ModelConfig
  window: BrowserWindow
  onDone?: (message: ChatMessage) => Promise<void>
}

export class ChatRuntime {
  private readonly controllers = new Map<string, AbortController>()

  send(options: SendChatOptions): void {
    const controller = new AbortController()
    this.controllers.set(options.requestId, controller)

    void streamOpenAiCompatibleChat({
      requestId: options.requestId,
      messages: options.messages,
      memories: options.memories,
      config: options.config,
      signal: controller.signal,
      onEvent: (event) => this.emit(options.window, options.requestId, event)
    })
      .then(async (message) => {
        await options.onDone?.(message)
      })
      .catch((error) => {
        if (isAbortError(error)) {
          this.emit(options.window, options.requestId, {
            type: 'cancelled',
            requestId: options.requestId,
            reason: 'user'
          })
          return
        }

        this.emit(options.window, options.requestId, {
          type: 'error',
          requestId: options.requestId,
          error: normalizeAiError(error)
        })
      })
      .finally(() => {
        this.controllers.delete(options.requestId)
      })
  }

  cancel(requestId: string): void {
    const controller = this.controllers.get(requestId)
    if (controller) {
      controller.abort()
    }
  }

  validateConfig(config: ModelConfig): void {
    validateConfig(config)
  }

  async testConnection(config: ModelConfig): Promise<void> {
    await testOpenAiCompatibleConnection(config)
  }

  private emit(window: BrowserWindow, requestId: string, event: AiStreamEvent): void {
    if (window.isDestroyed()) {
      return
    }
    window.webContents.send(`chat:stream:${requestId}`, event)
  }
}

export function validateChatMessages(messages: ChatMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw appError('validation_failed', '消息不能为空。', true)
  }

  const last = messages[messages.length - 1]
  if (last.role !== 'user' || last.content.trim().length === 0) {
    throw appError('validation_failed', '最后一条消息必须是用户输入。', true)
  }
}
