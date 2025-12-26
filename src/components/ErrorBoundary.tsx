import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  showDetails: boolean;
}

const MAX_RETRIES = 3;

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount,
    });
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="min-h-[400px] flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Something Went Wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              
              {this.state.retryCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Retry attempt {this.state.retryCount} of {MAX_RETRIES}
                </p>
              )}

              <div className="flex gap-2">
                {canRetry && (
                  <Button 
                    onClick={this.handleRetry}
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button 
                  onClick={() => window.location.reload()} 
                  variant={canRetry ? "outline" : "default"}
                  className="flex-1"
                >
                  Reload Page
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'} 
                  variant="outline"
                  size="icon"
                  title="Go Home"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </div>

              {/* Error details toggle for debugging */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <div className="pt-2 border-t">
                  <button
                    onClick={this.toggleDetails}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {this.state.showDetails ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {this.state.showDetails ? 'Hide' : 'Show'} Error Details
                  </button>
                  
                  {this.state.showDetails && (
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
