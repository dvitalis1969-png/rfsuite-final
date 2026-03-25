import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "A critical error occurred in this module.";
      let debugInfo = "";
      
      try {
        if (this.state.errorMessage) {
          const parsed = JSON.parse(this.state.errorMessage);
          if (parsed.operationType && parsed.error) {
            displayMessage = `Database Error: You don't have permission to ${parsed.operationType} this data.`;
            debugInfo = `Path: ${parsed.path} | Error: ${parsed.error}`;
          }
        }
      } catch (e) {
        displayMessage = this.state.errorMessage || displayMessage;
      }

      return (
        <div className="p-8 text-center bg-slate-900 rounded-xl border border-red-500/50">
          <h2 className="text-xl font-bold text-white mb-2">System Error</h2>
          <p className="text-slate-400 mb-2 text-sm">{displayMessage}</p>
          {debugInfo && <p className="text-red-400 mb-4 text-xs font-mono">{debugInfo}</p>}
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 rounded-lg text-xs font-bold"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
