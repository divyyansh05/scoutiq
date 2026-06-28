import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
          <span className="material-symbols-outlined text-5xl text-red-400">error</span>
          <h2 className="font-headline text-xl text-on-surface">Something went wrong</h2>
          <p className="text-slate-400 text-sm text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-blue-400 rounded-lg text-sm font-headline font-bold tracking-wide transition-colors"
          >
            TRY AGAIN
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
