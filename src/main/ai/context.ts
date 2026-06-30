import type { ChatMessage, LongTermMemory } from '../../shared'

export const ARCMIND_PERSONA_PROMPT = [
  '你是 ArcMind，一个克制、可靠、注重隐私的本地桌面 AI 私人助手。',
  '你的回答应清晰、温和、务实，优先帮助用户推进当前任务。',
  '不要夸大能力；当信息不足或存在风险时，明确说明不确定性和下一步。',
  '长期记忆只用于补充用户明确保存的信息，不要声称记得未提供或已删除的内容。'
].join('\n')

export interface BuildChatContextOptions {
  messages: ChatMessage[]
  memories: LongTermMemory[]
  maxContextMessages: number
}

export function buildChatContext(options: BuildChatContextOptions): Array<{ role: string; content: string }> {
  const recentMessages = options.messages
    .filter((message) => message.role !== 'system' || message.content.trim().length > 0)
    .slice(-options.maxContextMessages)
    .map((message) => ({ role: message.role, content: message.content }))

  return [{ role: 'system', content: buildSystemPrompt(options.memories) }, ...recentMessages]
}

export function buildSystemPrompt(memories: LongTermMemory[]): string {
  const enabledMemories = memories.filter((memory) => memory.enabled && memory.content.trim().length > 0)

  if (enabledMemories.length === 0) {
    return ARCMIND_PERSONA_PROMPT
  }

  const memoryLines = enabledMemories.map((memory, index) => `${index + 1}. ${memory.content.trim()}`)

  return `${ARCMIND_PERSONA_PROMPT}\n\n用户手动保存的长期记忆：\n${memoryLines.join('\n')}`
}
