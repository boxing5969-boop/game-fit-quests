/**
 * 153OS 앱 통로 화면 공용 조각 — 뒤로 단추 · 불러오는 중 · 못 불러옴 · 153OS 회원과 아직 안 이어짐 (2026-11-02)
 * 쓰는 곳: NoticesPage · BranchInfoPage · InquiriesPage
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Link2Off, RotateCcw } from "lucide-react";
import { isNotRegistered } from "@/services/osContentService";
import { cn } from "@/lib/utils";

/** 뒤로 — 앱 안에서 들어왔으면 앞 화면, 바로 열었으면(알림 · 주소) 대신 갈 곳 */
export function OsBackButton({ fallback = "/home" }: { fallback?: string }) {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="뒤로"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
    >
      <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
    </button>
  );
}

export function OsLoading({ rows = 3, label = "불러오는 중" }: { rows?: number; label?: string }) {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="rounded-2xl bg-card p-4 shadow-elev-1">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-2.5 h-3 w-full animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}

/** 을/를 — 마지막 글자 받침으로 */
const obj = (w: string): string => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return `${w}${c >= 0 && c < 11172 && c % 28 !== 0 ? "을" : "를"}`;
};

/** 못 불러옴 — 153OS 회원과 안 이어진 계정이면 그 안내, 아니면 다시 시도 */
export function OsErrorState({ error, onRetry, what }: { error: unknown; onRetry: () => void; what: string }) {
  if (isNotRegistered(error)) {
    return (
      <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="mt-3 text-body font-bold text-foreground">지점 회원 정보와 아직 이어지지 않았어요</p>
        <p className="mt-1 text-label leading-relaxed text-muted-foreground">
          체육관에 등록한 번호로 앱에 가입하면 {obj(what)} 볼 수 있어요.
          <br />
          번호가 다르면 지점에 알려 주세요.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
      <p className="text-body font-bold text-foreground">{obj(what)} 불러오지 못했어요</p>
      <p className="mt-1 text-label text-muted-foreground">
        {error instanceof Error && error.message ? error.message : "잠시 뒤 다시 시도해 주세요"}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
      >
        <RotateCcw className="h-4 w-4" /> 다시 시도
      </button>
    </div>
  );
}

export function OsEmpty({ icon, title, line }: { icon: ReactNode; title: string; line?: string }) {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">{icon}</span>
      <p className="mt-4 text-body font-bold text-foreground">{title}</p>
      {line && <p className="mt-1 text-label leading-relaxed text-muted-foreground">{line}</p>}
    </div>
  );
}

/** 작은 칩 — 고정 · 전 지점 · 분류 */
export function OsChip({ children, tone = "muted" }: { children: ReactNode; tone?: "primary" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-micro font-bold",
        tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
