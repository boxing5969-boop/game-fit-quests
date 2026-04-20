import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Root error boundary — surfaces render-time errors instead of letting
 * React unmount the whole tree into an empty <div id="root"> (which
 * reads as a black screen on the new dark theme). Provides a reload
 * button and a copy-friendly stack trace for user reports.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const message = error.message || String(error);
    const stack = info?.componentStack || error.stack || "";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-elev-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-lg font-bold">앱을 불러오는 중 문제가 발생했습니다</h1>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            새로고침으로 해결되지 않으면 아래 내용을 개발자에게 공유해주세요.
          </p>
          <div className="mb-4 max-h-60 overflow-auto rounded-xl border border-border bg-muted/30 p-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-2 font-bold text-destructive">{message}</p>
            {stack && <pre className="whitespace-pre-wrap">{stack}</pre>}
          </div>
          <button
            onClick={this.handleReload}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }
}
