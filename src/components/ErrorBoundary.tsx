import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this a single render throw leaves the user staring at a blank page
 * with no indication anything went wrong.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-coral-100 text-brand-coral-800 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-slate-600 mt-1">
              The scheduler hit an unexpected error. Your saved reservations are safe —
              reloading usually clears it.
            </p>
          </div>
          <pre className="text-[11px] text-left text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload the app</span>
          </button>
        </div>
      </div>
    );
  }
}
