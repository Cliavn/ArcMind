export type SpeechStatus = 'idle' | 'speaking' | 'unsupported' | 'error'

export interface SpeechPlayback {
  status: SpeechStatus
  error: string | null
}

export function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function createUtterance(text: string, onEnd: () => void, onError: (message: string) => void): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.onend = onEnd
  utterance.onerror = () => onError('语音播报失败。')
  return utterance
}

export function shouldAutoSpeak(muted: boolean, text: string): boolean {
  return !muted && text.trim().length > 0
}

