import type { ArcMindApi } from '../../preload'

declare global {
  interface Window {
    arcMind?: ArcMindApi
  }
}

export {}
