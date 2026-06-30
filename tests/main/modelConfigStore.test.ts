import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { ModelConfigStore, normalizeConfig, toPublicModelConfig } from '../../src/main/settings/modelConfigStore'

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('ModelConfigStore', () => {
  it('does not expose API keys through the public config', () => {
    const publicConfig = toPublicModelConfig(
      normalizeConfig({
        provider: 'openai-compatible',
        baseUrl: 'https://example.com/v1/',
        model: 'test-model',
        apiKey: 'placeholder-credential',
        temperature: 4,
        maxContextMessages: 999,
        timeoutMs: 1
      })
    )

    expect(publicConfig).not.toHaveProperty('apiKey')
    expect(publicConfig.hasApiKey).toBe(true)
    expect(publicConfig.temperature).toBe(2)
    expect(publicConfig.maxContextMessages).toBe(40)
    expect(publicConfig.timeoutMs).toBe(5000)
    expect(publicConfig.baseUrl).toBe('https://example.com/v1')
  })

  it('persists model configuration in the main-process store', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-config-'))
    const store = new ModelConfigStore(tempDir)

    await store.set({
      baseUrl: 'https://example.com/v1',
      model: 'arc-test',
      apiKey: 'placeholder-credential'
    })

    const publicConfig = await store.getPublic()
    const fullConfig = await store.get()

    expect(publicConfig).toMatchObject({
      baseUrl: 'https://example.com/v1',
      model: 'arc-test',
      hasApiKey: true
    })
    expect(fullConfig.apiKey).toBe('placeholder-credential')
  })

  it('can preview draft configuration without persisting it', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-config-'))
    const store = new ModelConfigStore(tempDir)

    await store.set({
      baseUrl: 'https://saved.example.com/v1',
      model: 'saved-model',
      apiKey: 'saved-credential'
    })

    const preview = await store.preview({
      baseUrl: 'https://draft.example.com/v1',
      model: 'draft-model',
      apiKey: 'draft-credential'
    })
    const persisted = await store.get()

    expect(preview).toMatchObject({
      baseUrl: 'https://draft.example.com/v1',
      model: 'draft-model',
      apiKey: 'draft-credential'
    })
    expect(persisted).toMatchObject({
      baseUrl: 'https://saved.example.com/v1',
      model: 'saved-model',
      apiKey: 'saved-credential'
    })
  })
})
