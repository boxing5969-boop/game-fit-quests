/**
 * 얼굴 키오스크 위 안내 — 153OS 「출석 프로그램 설정」 (2026-11-02 · FaceKioskPage 에서만 쓴다)
 *   · 쉬는 화면: 153OS 에서 얼굴 출석을 끄면 카메라 위를 덮는다(인식도 멈춤). 아래 소리 · 얼굴 등록 단추는 그대로 눌린다.
 *   · 안내 줄: 기다리는 화면 아래 — 지점이 적은 안내 문구 · "앱 QR 로도 출석할 수 있어요".
 *   · 인식 뒤 카드(2026-11-25): [출석](10초 뒤 자동) · [출석][퇴장](퇴장을 눌러야 실제 운동 시간) — KioskActionCard.
 *   글씨는 6단계 이름 — 1m 앞 태블릿에서 읽히게 큰 단계(title 24 · display 40)만 쓴다.
 */
import { KIOSK_TEXT, type KioskSettings } from "@/lib/kioskSettings";

/** 기다리는 화면 아래 안내 줄 — 안내 문구도 QR 안내도 없으면 그리지 않는다 */
export function KioskNoticeBar({ settings }: { settings: KioskSettings }) {
  if (!settings.notice_text && !settings.qr_hint) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-20 flex justify-center">
      <div className="max-w-xl rounded-3xl bg-black/65 px-6 py-3 text-center text-white">
        {settings.notice_text && <p className="text-title text-white">{settings.notice_text}</p>}
        {settings.qr_hint && (
          <p className={`${settings.notice_text ? "mt-1 " : ""}text-heading text-white/75`}>📱 {KIOSK_TEXT.qr}</p>
        )}
      </div>
    </div>
  );
}

/**
 * 인식 뒤 카드 — [출석] · [퇴장] 버튼 (2026-11-25 대표님 「얼굴인식후 출석누르면 출석이 되고 … 퇴장 버튼을 누르면 운동 시간 저장」)
 *   글 · 버튼 · 카운트다운은 FaceKioskPage 가 정해서 넘긴다(lib/faceKioskFlow). 1m 앞 태블릿에서 손가락으로 누르게 버튼은 크게.
 */
export interface KioskCardView {
  emoji: string;
  name: string;
  /** 이름 아래 인사 · 입장 시각 줄 */
  timeLine: string;
  /** 상태 줄 — 확인 중 · 거절 사유 · 결과 */
  status: string | null;
  statusTone: "muted" | "primary" | "pending";
  /** 결과 보조 줄(+XP · 수고하셨어요 · 실패 안내) */
  sub: string | null;
  /** 이용권 만료 임박 안내 */
  notice: string | null;
  attend: boolean;
  leave: boolean;
  /** 퇴장 카드 — [퇴장]이 주인공, [출석]은 작게 */
  leavePrimary: boolean;
  notMe: boolean;
  busy: boolean;
  countdown: { ratio: number; hint: string } | null;
}

export function KioskActionCard({ view, onAttend, onLeave, onNotMe }: {
  view: KioskCardView;
  onAttend: () => void;
  onLeave: () => void;
  onNotMe: () => void;
}) {
  const tone = view.statusTone === "primary" ? "text-primary" : view.statusTone === "pending" ? "text-status-pending" : "text-muted-foreground";
  const big = "h-20 rounded-2xl text-display font-black transition-transform active:scale-95 disabled:opacity-40";
  const primary = `${big} bg-primary text-primary-foreground shadow-elev-2`;
  const secondary = `${big} border-2 border-border bg-background text-foreground`;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
      <div className="animate-bounce-in w-full max-w-lg rounded-3xl bg-card p-8 text-center shadow-elev-3">
        <p className="text-display">{view.emoji}</p>
        <p className="mt-3 text-display font-black text-foreground">{view.name}님</p>
        <p className="mt-1.5 text-heading text-muted-foreground">{view.timeLine}</p>
        {view.status && <p className={`mt-3 text-title ${tone}`}>{view.status}</p>}
        {view.sub && <p className="mt-1 text-heading text-muted-foreground">{view.sub}</p>}
        {view.notice && (
          <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-body font-bold text-status-pending">{view.notice}</p>
        )}
        {(view.attend || view.leave) && (
          <div className="mt-6 flex gap-3">
            {view.attend && (
              <button type="button" onClick={onAttend} disabled={view.busy}
                className={`${view.leavePrimary ? `${secondary} flex-[2]` : `${primary} flex-1`}`}>
                출석
              </button>
            )}
            {view.leave && (
              <button type="button" onClick={onLeave} disabled={view.busy} className={`${primary} flex-[3]`}>
                퇴장
              </button>
            )}
          </div>
        )}
        {view.countdown && (
          <div className="mt-4" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
                style={{ width: `${Math.round(view.countdown.ratio * 100)}%` }} />
            </div>
            <p className="mt-2 text-body font-bold text-muted-foreground">{view.countdown.hint}</p>
          </div>
        )}
        {view.notMe && (
          <button type="button" onClick={onNotMe} disabled={view.busy}
            className="mt-4 text-body font-bold text-muted-foreground underline underline-offset-4 disabled:opacity-40">
            제가 아니에요
          </button>
        )}
      </div>
    </div>
  );
}

/** 얼굴 출석을 쉬는 화면 */
export function KioskPausedScreen({ settings }: { settings: KioskSettings }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-8 text-center" role="status">
      <p className="text-display text-white">{settings.paused_text ?? KIOSK_TEXT.paused}</p>
      <p className="text-title text-white/75">{settings.qr_hint ? `📱 ${KIOSK_TEXT.qr}` : KIOSK_TEXT.pausedSub}</p>
    </div>
  );
}
