import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * /minigame — 외부 트레이닝(Speed Strike Trainer) 임베드 페이지.
 *
 * iframe 로드가 체감상 길기 때문에, 완전히 그려지기 전까지는 복싱 명언을
 * 페이드 인/아웃으로 순환시키는 로딩 오버레이를 띄운다. iframe onLoad
 * 이 발화되면 오버레이를 즉시 제거한다. onLoad 가 일정 시간 내에 오지
 * 않아도 안전하게 통과하도록 MAX_WAIT_MS 후 폴백으로 숨긴다.
 */

const MINIGAME_URL = "https://speed-strike-trainer.lovable.app";

// ── 복싱 명언 — 링에 오르는 마음가짐을 다듬는 구절들.
// 출처가 있는 유명 인물 위주로, 운동 직전 집중을 끌어올리는 톤만 선별.
type Quote = { line: string; by: string };
const BOXING_QUOTES: readonly Quote[] = Object.freeze([
  { line: "복싱은 타이밍의 예술이다.", by: "Sugar Ray Robinson" },
  { line: "나비처럼 날아 벌처럼 쏴라.", by: "Muhammad Ali" },
  { line: "모두에게는 계획이 있다. 한 대 맞기 전까지는.", by: "Mike Tyson" },
  { line: "두려움은 친구이자 적이다. 통제하면 무기가 된다.", by: "Cus D'Amato" },
  { line: "챔피언은 링이 아니라 체육관에서 만들어진다.", by: "Muhammad Ali" },
  { line: "나는 훈련하는 매 1분이 싫었다. 그러나 '포기하지 마라, 지금 고통받고 평생 챔피언으로 살아라'라고 말했다.", by: "Muhammad Ali" },
  { line: "승리는 이미 이긴 사람의 것이 아니라, 포기하지 않은 사람의 것이다.", by: "Rocky Balboa" },
  { line: "중요한 건 얼마나 세게 때리느냐가 아니다. 얼마나 세게 맞고도 전진하느냐다.", by: "Rocky Balboa" },
  { line: "규율이 재능을 이긴다. 매일 반복하는 자를 이기는 건 쉽지 않다.", by: "Coach's Corner" },
  { line: "스피드가 파워다. 손이 빠르면 주먹은 무거워진다.", by: "Sugar Ray Leonard" },
  { line: "준비되지 않은 자에게 기회는 재앙일 뿐.", by: "George Foreman" },
  { line: "땀은 거짓말하지 않는다.", by: "Old Gym Wisdom" },
]);

// iframe 이 떠오르기 전 최소 노출 시간 — 너무 빨리 사라지면 깜빡거림으로 보임.
const MIN_VISIBLE_MS = 1600;
// iframe onLoad 가 오지 않을 경우 폴백으로 로더 제거.
const MAX_WAIT_MS = 8000;
// 명언 한 개 노출 시간 (ms).
const QUOTE_ROTATE_MS = 2600;

const MinigamePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const mountedAt = useRef<number>(Date.now());

  // 시작 명언은 매 진입 시 랜덤으로 골라 반복 피로감 완화.
  const startIdx = useMemo(
    () => Math.floor(Math.random() * BOXING_QUOTES.length),
    [],
  );
  useEffect(() => {
    setQuoteIdx(startIdx);
  }, [startIdx]);

  // 명언 rotation — 오버레이가 보이는 동안만 돈다.
  useEffect(() => {
    if (!showOverlay) return;
    const id = window.setInterval(() => {
      setQuoteIdx((i) => (i + 1) % BOXING_QUOTES.length);
    }, QUOTE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [showOverlay]);

  // iframe 로드 완료 → 최소 노출 시간 보장 후 오버레이 해제.
  useEffect(() => {
    if (!iframeLoaded) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = window.setTimeout(() => setShowOverlay(false), remaining);
    return () => window.clearTimeout(t);
  }, [iframeLoaded]);

  // 안전 폴백 — 로드 이벤트 미발화 대비.
  useEffect(() => {
    const t = window.setTimeout(() => setShowOverlay(false), MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (loading) {
    return <LoadingOverlay quoteIdx={quoteIdx} />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Dumbbell className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-bold text-foreground">로그인이 필요합니다</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          복싱 트레이닝 게임은 로그인 후 이용할 수 있어요. 점수는 내 계정에 연동됩니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
        >
          로그인 하러가기
        </button>
      </div>
    );
  }

  const src = `${MINIGAME_URL}?uid=${encodeURIComponent(user.id)}`;

  return (
    <div className="relative min-h-screen w-full bg-background">
      <iframe
        src={src}
        width="100%"
        height="100%"
        style={{ border: "none", minHeight: "100vh" }}
        title="복싱 트레이닝 게임 — Speed Strike Trainer"
        allow="accelerometer; gyroscope; fullscreen"
        onLoad={() => setIframeLoaded(true)}
      />
      {showOverlay && (
        <LoadingOverlay quoteIdx={quoteIdx} fadingOut={iframeLoaded} />
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Loading overlay — 복싱 명언 순환 + 글러브 펀치 애니메이션
// ──────────────────────────────────────────────────────────────────
const LoadingOverlay = ({
  quoteIdx,
  fadingOut = false,
}: {
  quoteIdx: number;
  fadingOut?: boolean;
}) => {
  const q = BOXING_QUOTES[quoteIdx] ?? BOXING_QUOTES[0];
  return (
    <div
      aria-live="polite"
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-6 transition-opacity duration-500 ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* 링 조명 느낌의 radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, hsl(8 75% 48% / 0.22), transparent 55%)",
        }}
      />

      {/* 펀치 애니메이션 — 글러브 이모지 2개가 번갈아 꽂힌다 */}
      <div className="relative mb-7 flex h-16 w-28 items-center justify-center">
        <span
          aria-hidden
          className="absolute left-0 animate-[punchL_0.9s_ease-in-out_infinite] text-[44px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(217,54,32,0.45))" }}
        >
          🥊
        </span>
        <span
          aria-hidden
          className="absolute right-0 scale-x-[-1] animate-[punchR_0.9s_ease-in-out_infinite] text-[44px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(217,54,32,0.45))" }}
        >
          🥊
        </span>
      </div>

      {/* 명언 — key 를 idx 로 주어 전환 시 리마운트되며 페이드/슬라이드 인 */}
      <div className="relative mx-auto flex min-h-[88px] max-w-[320px] flex-col items-center justify-center text-center">
        <p
          key={`q-${quoteIdx}`}
          className="animate-[quoteIn_520ms_ease-out] text-[16px] font-extrabold leading-snug text-foreground"
        >
          "{q.line}"
        </p>
        <p
          key={`by-${quoteIdx}`}
          className="mt-2 animate-[quoteIn_620ms_ease-out] text-[11px] font-semibold tracking-wide text-muted-foreground"
        >
          — {q.by}
        </p>
      </div>

      {/* 진행 바 — 시각적 리듬용, 시간은 iframe onLoad 로 결정 */}
      <div className="mt-7 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-primary/60" />
        ROUND 1 · READY
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-primary/60" />
      </div>

      {/* 로컬 keyframes — Tailwind config 확장 없이 인라인 주입 */}
      <style>{`
        @keyframes punchL {
          0%, 100% { transform: translateX(-16px) rotate(-8deg) scale(1); }
          50%      { transform: translateX(14px)  rotate(8deg)  scale(1.15); }
        }
        @keyframes punchR {
          0%, 100% { transform: translateX(16px)  rotate(8deg)  scale(1); }
          50%      { transform: translateX(-14px) rotate(-8deg) scale(1.15); }
        }
        @keyframes quoteIn {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MinigamePage;
