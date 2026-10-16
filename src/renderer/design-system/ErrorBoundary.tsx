import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[káno̱ ErrorBoundary] Caught unhandled error:', error, errorInfo);
    if (window.kanoDesktop) {
      window.kanoDesktop.log('error', `Unhandled React error: ${error.message}`);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center p-6 bg-kano-bg text-kano-text-primary select-none"
        >
          <div className="max-w-md w-full bg-kano-surface border border-kano-border rounded-xl p-6 shadow-modal flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-kano-danger-subtle text-kano-danger flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-kano-text-primary mb-1.5">
              Something went wrong in the workspace
            </h2>
            <p className="text-xs text-kano-text-secondary leading-relaxed mb-4">
              An unexpected interface error occurred. Your local drafts remain safe. You can reload this view to continue.
            </p>
            {this.state.error && (
              <div className="w-full bg-kano-bg border border-kano-border rounded-md p-3 mb-5 text-left overflow-x-auto">
                <code className="text-[11px] font-mono text-kano-danger break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={this.handleReset}
              >
                Reload Workspace
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
