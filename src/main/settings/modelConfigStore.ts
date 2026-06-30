import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ModelConfig, PublicModelConfig } from '../../shared'

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
  temperature: 0.7,
  maxContextMessages: 12,
  timeoutMs: 60000
}

interface StoredModelConfig {
  modelConfig?: Partial<ModelConfig>
}

export class ModelConfigStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'model-config.json')
  }

  async get(): Promise<ModelConfig> {
    const stored = await this.read()
    return normalizeConfig({ ...DEFAULT_CONFIG, ...stored.modelConfig })
  }

  async getPublic(): Promise<PublicModelConfig> {
    return toPublicModelConfig(await this.get())
  }

  async set(input: Partial<ModelConfig>): Promise<PublicModelConfig> {
    const next = await this.preview(input)

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify({ modelConfig: next }, null, 2)}\n`, 'utf8')
    return toPublicModelConfig(next)
  }

  async preview(input: Partial<ModelConfig>): Promise<ModelConfig> {
    const current = await this.get()
    return normalizeConfig({
      ...current,
      ...input,
      apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey
    })
  }

  private async read(): Promise<StoredModelConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as StoredModelConfig
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }
}

export function normalizeConfig(input: ModelConfig): ModelConfig {
  return {
    provider: 'openai-compatible',
    baseUrl: input.baseUrl.trim().replace(/\/+$/, '') || DEFAULT_CONFIG.baseUrl,
    model: input.model.trim() || DEFAULT_CONFIG.model,
    apiKey: input.apiKey.trim(),
    temperature: clamp(input.temperature, 0, 2),
    maxContextMessages: Math.max(1, Math.min(40, Math.round(input.maxContextMessages || DEFAULT_CONFIG.maxContextMessages))),
    timeoutMs: Math.max(5000, Math.min(180000, Math.round(input.timeoutMs || DEFAULT_CONFIG.timeoutMs)))
  }
}

export function toPublicModelConfig(config: ModelConfig): PublicModelConfig {
  const { apiKey: _apiKey, ...publicConfig } = config
  return {
    ...publicConfig,
    hasApiKey: config.apiKey.length > 0
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_CONFIG.temperature
  }
  return Math.max(min, Math.min(max, value))
}
