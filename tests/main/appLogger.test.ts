import { describe, expect, it } from 'vitest'
import { toSafeLogLine } from '../../src/main/logging/appLogger'

describe('app logger redaction', () => {
  it('redacts sensitive detail fields and bearer tokens', () => {
    const line = toSafeLogLine({
      level: 'error',
      event: 'settings.save',
      message: 'Authorization: Bearer sk-example-secret',
      details: {
        apiKey: 'sk-example-secret',
        path: 'private-user-path',
        model: 'openai-compatible-model',
        packaged: false
      }
    })

    expect(line.message).toBe('Authorization: Bearer [redacted]')
    expect(line.details).toMatchObject({
      apiKey: '[redacted]',
      path: '[redacted]',
      model: 'openai-compatible-model',
      packaged: false
    })
  })
})
