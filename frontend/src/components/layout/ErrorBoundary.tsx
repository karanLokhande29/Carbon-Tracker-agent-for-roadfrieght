/**
 * ErrorBoundary — class component catch-all for render errors.
 * Wraps major panels to prevent the whole app crashing.
 */
import { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p className="text-white/80 font-semibold text-sm">
              {this.props.label ?? 'Component'} failed to render
            </p>
            <p className="text-white/30 text-xs mt-1 max-w-xs font-mono break-all">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 text-xs px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
