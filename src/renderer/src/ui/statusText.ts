import type { CoreMode } from '../../../shared'

const CORE_MODE_LABELS: Record<CoreMode, string> = {
  idle: '待机',
  listening: '聆听',
  transcribing: '转写',
  thinking: '思考',
  speaking: '回应',
  muted: '静音',
  error: '异常'
}

export function coreModeLabel(mode: CoreMode): string {
  return CORE_MODE_LABELS[mode]
}

export function statusText(mode: CoreMode, micStatus: string): string {
  if (micStatus === 'requesting') {
    return '请求麦克风权限'
  }
  if (mode === 'listening') {
    return '正在聆听'
  }
  if (mode === 'transcribing') {
    return '正在转写'
  }
  if (mode === 'thinking') {
    return '正在思考'
  }
  if (mode === 'speaking') {
    return '回应就绪'
  }
  if (mode === 'muted') {
    return '静音待机'
  }
  if (mode === 'error') {
    return '需要处理'
  }
  return '待机'
}
