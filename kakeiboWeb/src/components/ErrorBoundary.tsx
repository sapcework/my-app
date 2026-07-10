import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#090912] flex items-center justify-center px-6">
          <div className="text-center space-y-4">
            <p className="text-slate-900 dark:text-slate-50 font-semibold">予期しないエラーが発生しました</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">お手数ですが再読み込みしてください</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium"
            >
              再読み込み
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
