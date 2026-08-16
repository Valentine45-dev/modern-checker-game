import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import { clearGameState } from '../utils/gamePersistence';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Label for the primary recovery button, when retrying in place makes sense. */
  resetLabel?: string;
  /** Called when the user retries — e.g. to navigate back to the menu. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a crash does not leave a blank page.
 *
 * Without this, any throw during render unmounts the whole tree and the user is
 * left staring at white with no indication anything happened and no way back
 * except a manual reload.
 *
 * The second recovery option matters more than it looks: if the crash comes from
 * a saved game the app cannot handle, retrying in place just crashes again.
 * Discarding the save and starting over is the escape hatch that actually works.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Caught by ErrorBoundary:', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  handleStartOver = () => {
    // The saved game is the most likely thing to reproduce the crash.
    clearGameState();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main
        role="alert"
        className="flex-grow flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm rounded-2xl border border-red-500/30 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-red-500/15 border border-red-500/30">
              <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-300 mb-6">
            The game hit an unexpected error. Your settings are safe.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {this.props.resetLabel ?? 'Try again'}
            </button>
            <button
              onClick={this.handleStartOver}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 font-medium text-gray-200 bg-primary/15 hover:bg-primary/25 border border-primary/30 rounded-lg transition-all duration-200"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Discard saved game and restart
            </button>
          </div>

          <details className="text-left">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Error details
            </summary>
            <pre className="mt-3 p-3 rounded-lg bg-black/40 border border-primary/20 text-xs text-red-300 whitespace-pre-wrap break-words">
              {error.message || String(error)}
            </pre>
          </details>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
