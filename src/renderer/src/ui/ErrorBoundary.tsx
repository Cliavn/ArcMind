import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    error: null
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep renderer crashes local; do not serialize UI state, prompts, or message content into logs.
  }

  public render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="app-shell">
        <section className="fatal-panel" aria-label="ArcMind error boundary">
          <span>ARCMIND RECOVERY</span>
          <h1>界面需要恢复</h1>
          <p>ArcMind 捕获到一次界面异常。当前窗口可以安全刷新，已保存的设置、会话和记忆不会因此删除。</p>
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </section>
      </main>
    )
  }
}
