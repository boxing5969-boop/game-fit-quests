/**
 * 📲 휴대폰 알림 켜기 카드 (2026-10-01 대표님: 앱 푸시).
 *
 *   · inbox    — 알림함 맨 위. 아직 안 켰거나 막혀 있을 때만 보인다 (켜졌거나 지원 안 하는 PC 면 숨김). '나중에'로 2주 접기.
 *   · settings — 설정 화면 카드. 켜짐/꺼짐/막힘/지원 안 함을 모두 보여 주고, 켜진 기기는 테스트 알림 · 끄기.
 *   · manager  — 지점장·본사 관리 화면 맨 위. inbox 와 같게 동작하고 문구만 '결제 알림' (2026-10-01 앱 결제 알림).
 * 아이폰 사파리 탭에서는 켤 수 없다 → '홈 화면에 추가' 안내. 카카오톡 안 화면 → 다른 브라우저로 열기 안내.
 */
import { useState } from "react";
import { BellRing, Check, Share, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { deniedHelp, usePushNotifications } from "@/hooks/usePushNotifications";
import type { PushBlock } from "@/lib/pushClient";

const HIDE_KEY = "153push:card-hidden-until";
const HIDE_KEY_MANAGER = "153push:card-hidden-until:manager";
const HIDE_DAYS = 14;

const readHidden = (key: string): boolean => {
  try {
    const until = Number(window.localStorage.getItem(key));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

const BLOCK_TEXT: Record<PushBlock, { title: string; body: string }> = {
  "ios-install": {
    title: "아이폰은 홈 화면 앱에서 알림을 받아요",
    body: "사파리 아래 공유 버튼 → '홈 화면에 추가' → 홈 화면의 마이복서153을 열고 여기서 '알림 켜기'를 눌러 주세요.",
  },
  "ios-old": {
    title: "iOS 16.4 이상에서 알림을 받을 수 있어요",
    body: "아이폰 설정 → 일반 → 소프트웨어 업데이트 후 홈 화면의 마이복서153을 다시 열어 주세요.",
  },
  "in-app": {
    title: "카카오톡 안에서 연 화면은 알림을 켤 수 없어요",
    body: "오른쪽 ⋮(또는 ⋯) → '다른 브라우저로 열기'로 크롬·사파리에서 연 뒤 켜 주세요.",
  },
  "no-sw": {
    title: "이 브라우저에서는 휴대폰 알림을 쓸 수 없어요",
    body: "안드로이드는 크롬, 아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요.",
  },
  "no-push": {
    title: "이 브라우저에서는 휴대폰 알림을 쓸 수 없어요",
    body: "안드로이드는 크롬, 아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요.",
  },
};

interface Props {
  variant: "inbox" | "settings" | "manager";
  className?: string;
}

const PushOptInCard = ({ variant, className }: Props) => {
  const { state, busy, enable, disable, test, signedIn } = usePushNotifications();
  const hideKey = variant === "manager" ? HIDE_KEY_MANAGER : HIDE_KEY;
  const [hidden, setHidden] = useState(() => readHidden(hideKey));

  if (!signedIn || !state) return null;

  // 관리 화면 카드는 알림함 카드와 똑같이 동작한다 (켜졌거나 PC 미지원이면 숨김 · 나중에)
  const inbox = variant === "inbox" || variant === "manager";
  const manager = variant === "manager";
  if (inbox) {
    if (hidden) return null;
    if (state.kind === "on") return null;
    if (state.kind === "unsupported" && (state.why === "no-push" || state.why === "no-sw")) return null;
  }

  const hideForNow = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(hideKey, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      /* 저장 못 해도 이번 화면에서는 접힌다 */
    }
  };

  const shell = inbox
    ? "rounded-2xl bg-card p-4 shadow-elev-1"
    : "animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1";

  // ── 켜짐 (설정 화면) ──
  if (state.kind === "on") {
    return (
      <section aria-label="휴대폰 알림" className={cn(shell, className)}>
        <h2 className="mb-1 text-base font-bold text-foreground">휴대폰 알림</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">공지 · 출석 · 수업 소식이 오면 이 휴대폰으로 바로 알려 드려요.</p>
        <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
          <span className="text-sm font-semibold text-foreground">이 기기 알림 켜짐</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={test}
            disabled={!!busy}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-[13.5px] font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" />
            {busy === "test" ? "보내는 중…" : "테스트 알림"}
          </button>
          <button
            type="button"
            onClick={disable}
            disabled={!!busy}
            className="flex h-11 items-center justify-center rounded-xl border border-border bg-card text-[13.5px] font-semibold text-muted-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "disable" ? "끄는 중…" : "이 기기 알림 끄기"}
          </button>
        </div>
      </section>
    );
  }

  // ── 켤 수 없는 기기 · 막힘 ──
  if (state.kind === "unsupported" || state.kind === "denied") {
    const t =
      state.kind === "denied"
        ? { title: "휴대폰 알림이 막혀 있어요", body: deniedHelp() }
        : BLOCK_TEXT[state.why];
    const Icon = state.kind === "unsupported" && state.why === "ios-install" ? Share : Smartphone;
    return (
      <section aria-label="휴대폰 알림" className={cn(shell, className)}>
        {!inbox && <h2 className="mb-3 text-base font-bold text-foreground">휴대폰 알림</h2>}
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-snug text-foreground">{t.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        </div>
        {inbox && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={hideForNow}
              className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-muted-foreground active:bg-secondary"
            >
              닫기
            </button>
          </div>
        )}
      </section>
    );
  }

  // ── 꺼짐 — 켜기 ──
  return (
    <section aria-label="휴대폰 알림 켜기" className={cn(shell, className)}>
      {!inbox && <h2 className="mb-3 text-base font-bold text-foreground">휴대폰 알림</h2>}
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <BellRing className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-snug text-foreground">
            {manager ? "💳 결제 알림을 휴대폰으로 받기" : "휴대폰으로도 알림 받기"}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {manager
              ? "앱에서 결제·취소되면 1분 안에 이 기기가 울려요 — 브로제이 입력을 바로 하세요. 공지 소식도 함께 와요."
              : "공지 · 출석 · 수업 소식이 오면 앱을 열지 않아도 바로 알려 드려요."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={enable}
          disabled={!!busy}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-[14px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <BellRing className="h-4 w-4" />
          {busy === "enable" ? "켜는 중…" : "알림 켜기"}
        </button>
        {inbox && (
          <button
            type="button"
            onClick={hideForNow}
            className="h-11 shrink-0 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground active:bg-secondary"
          >
            나중에
          </button>
        )}
      </div>
    </section>
  );
};

export default PushOptInCard;
