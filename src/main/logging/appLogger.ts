import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type LogLevel = 'info' | 'warn' | 'error'

export interface AppLogEntry {
  level: LogLevel
  event: string
  message?: string
  details?: Record<string, string | number | boolean | null | undefined>
}

const SENSITIVE_KEY_PATTERN = /(api[-_ ]?key|authorization|token|secret|password|audio|conversation|message|content|path)/i

export class AppLogger {
  private readonly filePath: string

  constructor(userDataPath: string, fileName = 'arcmind.log') {
    this.filePath = join(userDataPath, 'logs', fileName)
  }

  async write(entry: AppLogEntry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await appendFile(this.filePath, `${JSON.stringify(toSafeLogLine(entry))}\n`, 'utf8')
  }

  info(event: string, details?: AppLogEntry['details']): void {
    void this.write({ level: 'info', event, details })
  }

  warn(event: string, message?: string, details?: AppLogEntry['details']): void {
    void this.write({ level: 'warn', event, message, details })
  }

  error(event: string, error: unknown, details?: AppLogEntry['details']): void {
    void this.write({ level: 'error', event, message: errorMessage(error), details })
  }
}

export function toSafeLogLine(entry: AppLogEntry): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    level: entry.level,
    event: sanitizeValue(entry.event),
    message: entry.message ? sanitizeValue(entry.message) : undefined,
    details: sanitizeDetails(entry.details)
  }
}

function sanitizeDetails(details: AppLogEntry['details']): Record<string, string | number | boolean | null> | undefined {
  if (!details) {
    return undefined
  }

  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) {
      continue
    }
    safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(value)
  }
  return safe
}

function sanitizeValue(value: string | number | boolean | null): string | number | boolean | null {
  if (typeof value !== 'string') {
    return value
  }
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9._-]+/g, 'sk-[redacted]')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return typeof error === 'string' ? error : 'Unknown error'
}
