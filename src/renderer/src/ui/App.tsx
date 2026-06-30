import { Brain, Check, Mic, MicOff, Pencil, Plus, Send, Settings, Sparkles, Square, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AiStreamEvent, ChatMessage, ConversationState, ConversationSummary, CoreMode, LongTermMemory, ModelConfig, PublicModelConfig, RuntimeInfo } from '../../../shared'
import { deriveCoreMode } from '../../../shared'
import { useMicrophoneLevel } from '../audio/useMicrophoneLevel'
import { ParticleCore } from '../visual/ParticleCore'
import { resolveVisualSignal } from '../visual/signal'
import { canUseSpeechSynthesis, createUtterance, shouldAutoSpeak } from '../voice/speech'
import { desktopBridgeUnavailableMessage, hasModelSettingsBridge } from './runtimeBridge'
import { coreModeLabel, statusText } from './statusText'

const seedMessages: ChatMessage[] = [
  {
    id: 'assistant-seed',
    role: 'assistant',
    content: 'ArcMind 已就绪。粒子核心会根据麦克风输入呼吸，后续可接入大模型流式对话。',
    createdAt: new Date(0).toISOString()
  }
]

const fallbackConversation: ConversationState = {
  id: 'local-fallback',
  title: '新的会话',
  messages: seedMessages,
  status: 'idle',
  activeRequestId: null,
  updatedAt: new Date(0).toISOString()
}

export function App(): JSX.Element {
  const microphone = useMicrophoneLevel()
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [conversationId, setConversationId] = useState(fallbackConversation.id)
  const [conversationTitle, setConversationTitle] = useState(fallbackConversation.title)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages)
  const [draft, setDraft] = useState('')
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [conversationStatus, setConversationStatus] = useState<ConversationState['status']>('idle')
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [version, setVersion] = useState('0.1.0')
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelConfig, setModelConfig] = useState<PublicModelConfig | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<Partial<ModelConfig>>({})
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memories, setMemories] = useState<LongTermMemory[]>([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [tokenPulse, setTokenPulse] = useState(0)
  const [errorPulse, setErrorPulse] = useState(0)
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false)

  useEffect(() => {
    void window.arcMind?.getAppVersion().then(setVersion).catch(() => setVersion('0.1.0'))
    void window.arcMind?.getRuntimeInfo?.().then(setRuntimeInfo).catch(() => setRuntimeInfo(null))
    void window.arcMind?.settings.getModelConfig().then((config) => {
      setModelConfig(config)
      setSettingsDraft(config)
    })
    void loadInitialConversation()
    void refreshMemories()
  }, [])

  const loadInitialConversation = async (): Promise<void> => {
    const conversation = await window.arcMind?.storage.getMostRecentConversation()
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const mode: CoreMode = useMemo(() => {
    return deriveCoreMode({
      conversationStatus,
      microphoneStatus: microphone.status,
      muted,
      lastMessage: messages[messages.length - 1],
      transcribing: recordingStatus === 'transcribing',
      speaking
    })
  }, [conversationStatus, messages, microphone.status, muted, recordingStatus, speaking])

  const visualSignal = useMemo(
    () =>
      resolveVisualSignal({
        mode,
        audio: microphone.signal,
        tokenPulse,
        errorPulse
      }),
    [errorPulse, microphone.signal, mode, tokenPulse]
  )

  const hudSummary = useMemo(() => {
    const persistedMessages = messages.filter((message) => message.id !== 'assistant-seed')
    const enabledMemories = memories.filter((memory) => memory.enabled).length

    return {
      model: modelConfig?.model || '未配置',
      modelReady: Boolean(modelConfig?.hasApiKey && modelConfig.model),
      messageCount: persistedMessages.length,
      enabledMemories,
      totalMemories: memories.length,
      tokenPulse
    }
  }, [memories, messages, modelConfig, tokenPulse])

  const submit = (): void => {
    const value = draft.trim()
    if (!value || conversationStatus === 'streaming') {
      return
    }

    setDraft('')
    setConversationStatus('streaming')
    setError(null)
    setTokenPulse(0)
    const requestId = crypto.randomUUID()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value,
      createdAt: new Date().toISOString()
    }
    const assistantMessage: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    }

    const currentMessages = messages.filter((message) => message.id !== 'assistant-seed')
    const nextMessages = [...currentMessages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setActiveRequestId(requestId)

    const unsubscribe = window.arcMind?.chat.onStream(requestId, (event) => {
      handleStreamEvent(event, unsubscribe)
    })

    void window.arcMind?.chat
      .sendMessage({ requestId, conversationId, messages: nextMessages.filter((message) => message.id !== requestId) })
      .catch((unknownError) => {
        unsubscribe?.()
        setConversationStatus('error')
        setActiveRequestId(null)
        setError(errorMessage(unknownError))
        setErrorPulse((value) => value + 1)
      })
  }

  const handleStreamEvent = (event: AiStreamEvent, unsubscribe?: () => void): void => {
    if (event.type === 'token') {
      setMessages((current) =>
        current.map((message) => (message.id === event.requestId ? { ...message, content: `${message.content}${event.delta}` } : message))
      )
      setTokenPulse((value) => value + 1)
      return
    }

    if (event.type === 'done') {
      unsubscribe?.()
      setMessages((current) => current.map((message) => (message.id === event.requestId ? event.message : message)))
      setConversationStatus('idle')
      setActiveRequestId(null)
      speakAssistantMessage(event.message.content)
      void refreshConversationList()
      return
    }

    if (event.type === 'cancelled') {
      unsubscribe?.()
      setConversationStatus('cancelled')
      setActiveRequestId(null)
      return
    }

    if (event.type === 'error') {
      unsubscribe?.()
      setConversationStatus('error')
      setActiveRequestId(null)
      setError(event.error.message)
      setErrorPulse((value) => value + 1)
    }
  }

  const cancel = (): void => {
    if (!activeRequestId) {
      return
    }
    void window.arcMind?.chat.cancel(activeRequestId)
  }

  const speakAssistantMessage = (text: string): void => {
    if (!shouldAutoSpeak(muted, text)) {
      return
    }

    void window.arcMind?.voice.speak({ text })
    if (!canUseSpeechSynthesis()) {
      setError('当前运行环境不支持语音播报。')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = createUtterance(
      text,
      () => setSpeaking(false),
      (message) => {
        setSpeaking(false)
        setError(message)
      }
    )
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = (): void => {
    void window.arcMind?.voice.stopSpeaking()
    if (canUseSpeechSynthesis()) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }

  const saveSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    const next = await bridge.settings.setModelConfig(withoutBlankApiKey(settingsDraft))
    if (next) {
      setModelConfig(next)
      setSettingsDraft(next)
      setError(null)
    }
  }

  const createConversation = async (): Promise<void> => {
    const conversation = await window.arcMind?.storage.createConversation('新的会话')
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const openConversation = async (id: string): Promise<void> => {
    const conversation = await window.arcMind?.storage.getConversation(id)
    if (conversation) {
      applyConversation(conversation)
    }
  }

  const deleteCurrentConversation = async (): Promise<void> => {
    if (!conversationId || conversationId === fallbackConversation.id) {
      return
    }
    await window.arcMind?.storage.deleteConversation(conversationId)
    const conversation = await window.arcMind?.storage.getMostRecentConversation()
    if (conversation) {
      applyConversation(conversation)
    }
    await refreshConversationList()
  }

  const clearCurrentConversation = async (): Promise<void> => {
    const conversation = await window.arcMind?.storage.clearConversation(conversationId)
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const refreshConversationList = async (): Promise<void> => {
    const summaries = await window.arcMind?.storage.listConversations()
    if (summaries) {
      setConversations(summaries)
    }
  }

  const refreshMemories = async (): Promise<void> => {
    const items = await window.arcMind?.storage.listMemories()
    if (items) {
      setMemories(items)
    }
  }

  const saveMemory = async (): Promise<void> => {
    const content = memoryDraft.trim()
    if (!content) {
      setError('记忆内容不能为空。')
      return
    }

    try {
      if (editingMemoryId) {
        await window.arcMind?.storage.updateMemory({ id: editingMemoryId, content })
      } else {
        await window.arcMind?.storage.createMemory({ content })
      }

      setMemoryDraft('')
      setEditingMemoryId(null)
      setError(null)
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆保存失败。')
    }
  }

  const editMemory = (memory: LongTermMemory): void => {
    setEditingMemoryId(memory.id)
    setMemoryDraft(memory.content)
  }

  const cancelMemoryEdit = (): void => {
    setEditingMemoryId(null)
    setMemoryDraft('')
  }

  const toggleMemory = async (memory: LongTermMemory): Promise<void> => {
    try {
      await window.arcMind?.storage.setMemoryEnabled({ id: memory.id, enabled: !memory.enabled })
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆状态更新失败。')
    }
  }

  const deleteMemory = async (memory: LongTermMemory): Promise<void> => {
    try {
      await window.arcMind?.storage.deleteMemory(memory.id)
      if (editingMemoryId === memory.id) {
        cancelMemoryEdit()
      }
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆删除失败。')
    }
  }

  const applyConversation = (conversation: ConversationState): void => {
    stopSpeaking()
    setConversationId(conversation.id)
    setConversationTitle(conversation.title)
    setMessages(conversation.messages.length > 0 ? conversation.messages : seedMessages)
    setConversationStatus(conversation.status === 'streaming' ? 'idle' : conversation.status)
    setActiveRequestId(null)
    setError(null)
  }

  const testSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    const result = await bridge.settings.testModelConfig(withoutBlankApiKey(settingsDraft))
    setError(result?.ok ? '模型配置可用。' : result?.error?.message ?? '模型配置不可用。')
  }

  const toggleMic = async (): Promise<void> => {
    if (recordingStatus === 'recording') {
      mediaRecorder?.stop()
      return
    }

    if (recordingStatus === 'transcribing') {
      return
    }

    try {
      setError(null)
      setRecordingStatus('recording')
      await microphone.start()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream)

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      })

      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop())
        microphone.stop()
        setMediaRecorder(null)
        void transcribeChunks(chunks, recorder.mimeType || 'audio/webm')
      })

      setMediaRecorder(recorder)
      recorder.start()
    } catch (unknownError) {
      microphone.stop()
      setRecordingStatus('idle')
      setError(errorMessage(unknownError) || '麦克风不可用。')
      setErrorPulse((value) => value + 1)
    }
  }

  const transcribeChunks = async (chunks: BlobPart[], mimeType: string): Promise<void> => {
    try {
      setRecordingStatus('transcribing')
      const blob = new Blob(chunks, { type: mimeType })
      const result = await window.arcMind?.voice.transcribe({
        audio: await blob.arrayBuffer(),
        mimeType,
        fileName: mimeType.includes('webm') ? 'speech.webm' : 'speech.audio'
      })

      if (result?.text) {
        setDraft((current) => (current ? `${current} ${result.text}` : result.text))
      }
      setRecordingStatus('idle')
    } catch (unknownError) {
      setRecordingStatus('idle')
      setError(errorMessage(unknownError) || '语音识别失败。')
      setErrorPulse((value) => value + 1)
    }
  }

  return (
    <main className={`app-shell ${conversationDrawerOpen ? 'is-conversation-drawer-open' : ''}`}>
      <ParticleCore mode={mode} signal={visualSignal} sidebarOpen={conversationDrawerOpen} />

      <div className="ambient-grid" />
      <section className="command-surface" aria-label="ArcMind conversation">
        <header className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            <div>
              <h1>ArcMind</h1>
              <p>{conversationTitle}</p>
            </div>
          </div>
          <div className="status-strip">
            <span className={`status-dot status-${mode}`} />
            <span>{statusText(mode, microphone.status)}</span>
            <span>v{version}</span>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              title="记忆"
              onClick={() => {
                setMemoryOpen((value) => !value)
                setSettingsOpen(false)
              }}
            >
              <Brain size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="设置"
              onClick={() => {
                setSettingsOpen((value) => !value)
                setMemoryOpen(false)
              }}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div
          className="conversation-drawer-zone"
          onPointerEnter={() => setConversationDrawerOpen(true)}
          onPointerLeave={() => setConversationDrawerOpen(false)}
          onFocus={() => setConversationDrawerOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setConversationDrawerOpen(false)
            }
          }}
        >
          <button
            className="conversation-edge-tab"
            type="button"
            title="会话列表"
            onClick={() => setConversationDrawerOpen((value) => !value)}
          >
            会话
          </button>
          <aside className={`conversation-list ${conversationDrawerOpen ? 'is-open' : ''}`} aria-label="会话历史">
            <div className="conversation-list-header">
              <span>会话</span>
              <button className="mini-button" type="button" title="新建会话" onClick={() => void createConversation()}>
                <Plus size={14} />
              </button>
            </div>
            <div className="conversation-items">
              {conversations.map((conversation) => (
                <button
                  className={`conversation-item ${conversation.id === conversationId ? 'is-current' : ''}`}
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation.id)}
                >
                  <span>{conversation.title}</span>
                  <small>{conversation.messageCount} 条</small>
                </button>
              ))}
            </div>
            <div className="conversation-tools">
              <button className="mini-button" type="button" title="清空当前会话" onClick={() => void clearCurrentConversation()}>
                清空
              </button>
              <button className="mini-button" type="button" title="删除当前会话" onClick={() => void deleteCurrentConversation()}>
                <Trash2 size={14} />
              </button>
            </div>
          </aside>
        </div>

        <section className="hero-stage" aria-label="ArcMind core status">
          <div className="core-readout">
            <span>弦核模式</span>
            <strong>{coreModeLabel(mode)}</strong>
          </div>
        </section>

        <aside className="hud-panel side-hud" aria-label="弦核状态">
          <div className="hud-row">
            <span>模型</span>
            <strong>{hudSummary.modelReady ? hudSummary.model : '未配置'}</strong>
          </div>
          <div className="hud-row">
            <span>会话</span>
            <strong>{hudSummary.messageCount} 条</strong>
          </div>
          <div className="hud-row">
            <span>记忆</span>
            <strong>
              {hudSummary.enabledMemories}/{hudSummary.totalMemories}
            </strong>
          </div>
          <div className="hud-row">
            <span>令牌</span>
            <strong>{hudSummary.tokenPulse}</strong>
          </div>
          <div className="hud-row">
            <span>麦克风</span>
            <strong>{Math.round(microphone.level * 100)}%</strong>
          </div>
          <div className="signal-bars" aria-label="音频频段">
            <span style={{ transform: `scaleY(${0.18 + visualSignal.audio.low * 0.82})` }} />
            <span style={{ transform: `scaleY(${0.18 + visualSignal.audio.mid * 0.82})` }} />
            <span style={{ transform: `scaleY(${0.18 + visualSignal.audio.high * 0.82})` }} />
            <span style={{ transform: `scaleY(${0.18 + visualSignal.audio.rhythm * 0.82})` }} />
          </div>
        </aside>

        <section className="conversation-panel" aria-label="对话">
          {messages.map((message) => (
            <article className={`message message-${message.role}`} key={message.id}>
              <span>{message.role === 'assistant' ? 'ArcMind' : '你'}</span>
              <p>{message.content || (message.role === 'assistant' && conversationStatus === 'streaming' ? '正在连接模型...' : '')}</p>
            </article>
          ))}
        </section>

        <footer className="composer">
          <button
            className={`round-button ${microphone.status === 'listening' ? 'is-active' : ''}`}
            type="button"
            title={recordingStatus === 'recording' ? '停止录音' : recordingStatus === 'transcribing' ? '正在转写' : '点击说话'}
            onClick={() => void toggleMic()}
          >
            {recordingStatus === 'recording' ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submit()
              }
            }}
            placeholder={recordingStatus === 'transcribing' ? '正在转写语音...' : '输入一句话，先让弧核亮起来...'}
            aria-label="输入消息"
          />
          <button
            className="icon-button send-button"
            type="button"
            title={conversationStatus === 'streaming' ? '停止' : '发送'}
            onClick={conversationStatus === 'streaming' ? cancel : submit}
          >
            {conversationStatus === 'streaming' ? <Square size={16} /> : <Send size={18} />}
          </button>
          <button
            className="icon-button"
            type="button"
            title={speaking ? '停止播报' : muted ? '开启播报' : '关闭播报'}
            onClick={() => {
              if (speaking) {
                stopSpeaking()
                return
              }
              setMuted((value) => {
                const next = !value
                if (next) {
                  stopSpeaking()
                }
                return next
              })
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </footer>

        {settingsOpen ? (
          <section className="settings-panel" aria-label="模型设置">
            <label>
              Base URL
              <input value={settingsDraft.baseUrl ?? ''} onChange={(event) => setSettingsDraft((current) => ({ ...current, baseUrl: event.target.value }))} />
            </label>
            <label>
              Model
              <input value={settingsDraft.model ?? ''} onChange={(event) => setSettingsDraft((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <label>
              API Key
              <input
                type="password"
                placeholder={modelConfig?.hasApiKey ? '已配置，留空表示不修改' : '输入 API Key'}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>
            <label>
              Temperature
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settingsDraft.temperature ?? 0.7}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, temperature: Number(event.target.value) }))}
              />
            </label>
            <label>
              Context
              <input
                type="number"
                min="1"
                max="40"
                value={settingsDraft.maxContextMessages ?? 12}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, maxContextMessages: Number(event.target.value) }))}
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={() => void saveSettings()}>
                保存
              </button>
              <button type="button" onClick={() => void testSettings()}>
                测试连接
              </button>
            </div>
            <p className="runtime-line">
              v{runtimeInfo?.version ?? version} · Electron {runtimeInfo?.electron ?? 'unknown'} · {runtimeInfo?.platform ?? 'browser'} {runtimeInfo?.arch ?? ''}
              {runtimeInfo?.packaged ? ' · packaged' : ''}
            </p>
          </section>
        ) : null}

        {memoryOpen ? (
          <section className="memory-panel" aria-label="长期记忆">
            <div className="panel-heading">
              <span>长期记忆</span>
              <small>{memories.filter((memory) => memory.enabled).length} 启用</small>
            </div>
            <label>
              记忆内容
              <textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} rows={3} />
            </label>
            <div className="memory-editor-actions">
              <button type="button" onClick={() => void saveMemory()}>
                <Check size={14} />
                {editingMemoryId ? '保存修改' : '保存记忆'}
              </button>
              {editingMemoryId ? (
                <button type="button" onClick={cancelMemoryEdit}>
                  <X size={14} />
                  取消
                </button>
              ) : null}
            </div>
            <div className="memory-items">
              {memories.length === 0 ? <p className="empty-line">暂无长期记忆</p> : null}
              {memories.map((memory) => (
                <article className={`memory-item ${memory.enabled ? '' : 'is-disabled'}`} key={memory.id}>
                  <p>{memory.content}</p>
                  <div className="memory-actions">
                    <button type="button" onClick={() => void toggleMemory(memory)}>
                      {memory.enabled ? '停用' : '启用'}
                    </button>
                    <button type="button" title="编辑记忆" onClick={() => editMemory(memory)}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" title="删除记忆" onClick={() => void deleteMemory(memory)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {microphone.error || error ? <p className="error-line">{microphone.error ?? error}</p> : null}
      </section>
    </main>
  )
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '请求失败，请检查模型配置。'
}

function withoutBlankApiKey(input: Partial<ModelConfig>): Partial<ModelConfig> {
  if (input.apiKey !== undefined && input.apiKey.trim() === '') {
    const { apiKey: _apiKey, ...rest } = input
    return rest
  }
  return input
}
