import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

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

    // 화면 파일을 못 받아온 경우 — 회원 잘못이 아니고 대개 새로고침이면 끝난다.
    // (lazyWithRetry 가 먼저 재시도·자동 새로고침을 하므로 여기까지 오는 건 드물다.)
    if (isChunkLoadError(error)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-elev-3">
            <div className="mb-3 text-4xl">🔄</div>
            <h1 className="mb-2 text-lg font-bold">잠깐 연결이 끊겼어요</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              새로고침을 누르면 바로 이어서 사용할 수 있어요.
              <br />
              계속 이러면 데스크에 말씀해주세요.
            </p>
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
