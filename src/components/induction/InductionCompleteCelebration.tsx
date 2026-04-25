import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Banknote,
  Check,
  Flag,
  Gift,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InductionRewardPreview } from "./InductionRewardPreview";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { cn } from "@/lib/utils";
import { celebrationHaptic } from "@/lib/haptics";

interface InductionCompleteCelebrationProps {
  totalGems: number;
  /** 완료 버튼 — InductionCeremonyOverlay 가 /missions 로 네비게이션까지 처리. */
  onClose: () => void;
  className?: string;
}

const RANK_KO: Record<"white" | "blue" | "red" | "black", string> = {
  white: "백",
  blue: "청",
  red: "적",
  black: "흑",
};

/**
 * 입단식 완료 축하 카드 — 챔피언 벨트 공개식 톤.
 *
 * ── UX 구성 (위→아래, gap-3.5) ──────────────────────────────
 *   1. 체크 메달 (gradient primary→reward) + 뒤 링 펄스
 *   2. "CHAMPION OF THE DAY" 미니 캡스
 *   3. "입단식 완료! 🎉" 대제목 + 서브라인
 *   4. +N,NNN 젬 hero 카운트업 (골든 glow)
 *   5. 보상 4-tile 그리드 (celebrated 모드)
 *   6. 보상 recap — 작은 단일 라인
 *   7. 보너스 안내 박스 (🎁 미션 해금 + 체크인 +300젬)
 *   8. CTA "첫 퀘스트 시작하기 →"
 *
 * ── 밀도 ────────────────────────────────────────────────────
 *   gap-3.5 + p-5 로 전체 카드 높이 ~500px 이내. 대부분 모바일
 *   뷰포트에서 스크롤 없이 한 화면에 들어감. overflow-y-auto
 *   (overlay 레벨) 가 fallback 으로 동작.
 *
 * ── 중복 지급 방지 ──────────────────────────────────────────
 *   표시 전용 — 실제 보상은 상위 오버레이가 이미 RPC 로 지급 완료.
 *   카드 내부는 추가 RPC 호출 없음.
 */
export const InductionCompleteCelebration = ({
  totalGems,
  onClose,
  className,
}: InductionCompleteCelebrationProps) => {
  const [displayGems, setDisplayGems] = useState(0);
  const { profile } = useAuth();
  const local = useLocalProgress();

  // 가치 회수 데이터 — 신규 호출 0 (기존 훅 재사용).
  // profile 타입에 current_rank / current_level 가 미정의이므로 as any 우회 (앱 내 동일 패턴).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any;
  const currentRank = (p?.current_rank ?? "white") as
    | "white" | "blue" | "red" | "black";
  const currentLevel = (p?.current_level ?? 1) as number;
  const xpCurrent = local?.metrics?.xp?.current ?? 0;
  const xpTarget = local?.metrics?.xp?.target ?? 0;
  const xpRemaining = Math.max(0, xpTarget - xpCurrent);
  const xpPct = xpTarget > 0
    ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpTarget) * 100)))
    : 0;
  const firstDanUnlocked = currentRank === "black" && currentLevel >= 10;

  useEffect(() => {
    // 마운트 시 1회 haptic.
    celebrationHaptic();

    // 젬 카운트업 — 1.2s easeOutCubic.
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayGems(Math.round(totalGems * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalGems]);

  return (
    <div
      className={cn(
        "relative w-full max-w-[360px] overflow-hidden rounded-3xl",
        "bg-gradient-to-b from-card via-card to-card/95",
        "border border-reward/45 shadow-[0_0_64px_rgba(246,196,83,0.4)]",
        "animate-bounce-in",
        className,
      )}
      role="alertdialog"
      aria-labelledby="induction-complete-title"
    >
      {/* 상단 챔피언 벨트 라인 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-reward via-primary to-reward" />

      <div className="flex flex-col gap-3.5 p-5">
        {/* 1. 체크 메달 + 펄스 링 */}
        <div className="flex justify-center pt-1">
          <div className="relative">
            <span
              className="absolute inset-0 rounded-full bg-reward/35 animate-ping"
              aria-hidden
            />
            <span
              className="absolute -inset-1 rounded-full bg-reward/20 blur-md"
              aria-hidden
            />
            <span
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full",
                "bg-gradient-to-br from-reward via-reward to-primary",
                "text-primary-foreground shadow-[0_0_40px_rgba(246,196,83,0.6)]",
                "ring-4 ring-reward/30",
                "animate-bounce-in",
              )}
              aria-hidden
            >
              <Check className="h-9 w-9" strokeWidth={3.5} />
            </span>
          </div>
        </div>

        {/* 2 + 3. 타이틀 블록 */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.28em] text-reward">
            WELCOME TO 153
          </span>
          <h2
            id="induction-complete-title"
            className="text-2xl font-extrabold tracking-tight text-foreground"
          >
            시작 준비 완료 <span className="inline-block animate-bounce-in">🎉</span>
          </h2>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            오늘부터 당신의 모든 훈련이 기록됩니다.
          </p>
        </div>

        {/* 4. 가치 회수 — 현재 위치 + 다음 목표 (메인 비주얼). */}
        <div className="space-y-2">
          {/* 4a. 현재 위치 (이번 입단식의 결과 = 시작점 확정) */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Award className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  나의 시작점
                </p>
                <p className="mt-0.5 text-[14px] font-extrabold leading-tight text-foreground">
                  {RANK_KO[currentRank]}색 리그 · Lv.{currentLevel}
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              지금 이 위치가 당신의 0일차입니다. 모든 훈련은 여기서부터 누적돼요.
            </p>
          </div>

          {/* 4b. 다음 목표 — 다음 레벨까지 + 1단 도전 거리 */}
          <div className="rounded-2xl border border-primary/25 bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  다음 목표
                </p>
                <p className="mt-0.5 text-[12.5px] font-bold leading-tight text-foreground">
                  {xpTarget > 0
                    ? `다음 레벨까지 ${xpRemaining} XP · ${xpPct}%`
                    : "오늘의 훈련 1개만 완료해도 진행이 시작됩니다"}
                </p>
              </div>
            </div>
            {xpTarget > 0 && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            )}
          </div>

          {/* 4c. 1단 도전 연결 — 가치 회수의 클라이맥스 */}
          <div
            className={cn(
              "rounded-2xl border p-3",
              firstDanUnlocked
                ? "border-reward bg-reward/10 ring-1 ring-reward/40"
                : "border-reward/35 bg-reward/5",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-reward/20 text-reward">
                <Flag className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">
                  1단 도전
                </p>
                <p className="mt-0.5 text-[12.5px] font-bold leading-tight text-foreground">
                  {firstDanUnlocked
                    ? "지금 1단 심사 도전 가능"
                    : "흑색 Lv.10 도달 시 1단 심사가 열립니다"}
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              레벨업·승급은 1단 도전이라는 실제 목표로 이어집니다. 오늘의 훈련이 그 첫 발이에요.
            </p>
          </div>
        </div>

        {/* 5. 보상 — 보조로 격하. hero 카운트업 → 인라인 한 줄 */}
        <div
          className="flex items-center justify-between gap-2 rounded-xl border border-reward/25 bg-reward/5 px-3 py-2"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Banknote className="h-3.5 w-3.5 text-reward/80" />
            <span>입단식 보상</span>
          </span>
          <span className="number-font text-[13px] font-extrabold text-reward">
            +{displayGems.toLocaleString()}
            <span className="ml-0.5 text-[10.5px] font-semibold text-reward/80">
              {" "}파이트 머니
            </span>
          </span>
        </div>

        {/* 4d. 5대 가치 checklist — 회원이 튜토리얼에서 반드시 가지고 나가야 하는
                핵심 메시지 요약. 보상 위에 배치해 "가치 회수" 를 먼저 닫는다. */}
        <div className="rounded-2xl border border-border bg-card/70 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">
            오늘 이해하고 가는 5가지
          </p>
          <ul className="mt-2 space-y-1">
            {[
              "단순 출석앱이 아니라 성장 기록 시스템",
              "오늘의 훈련 = 다음 레벨·승급의 연료",
              "기록 + 코치 기준의 이중 증명",
              "리그·레벨로 내 위치와 목표가 분명",
              "흑색 Lv.10 너머 — 1단 도전이라는 실제 목표",
            ].map((msg, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[11.5px] leading-snug text-foreground"
              >
                <Check
                  className="mt-0.5 h-3 w-3 shrink-0 text-primary"
                  strokeWidth={3}
                />
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 5b. 보상 recap — 신입 배지 / 이펙트 (보조). 4-tile 그리드 보존. */}
        <InductionRewardPreview totalGems={totalGems} celebrated />
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          {totalGems.toLocaleString()} 파이트 머니 · 신입 회원 배지 · 기본 이펙트
        </p>

        {/* 6. 보너스 안내 — 오늘 첫 체크인 인센티브 (계속 사용해야 하는 이유) */}
        <div className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent"
            aria-hidden
          >
            <Gift className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[12px] font-bold text-accent">
              오늘 첫 훈련 시작하면
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              추가{" "}
              <span className="font-bold text-reward">+300 파이트 머니</span>{" "}
              · 첫 기록은 0일차가 됩니다
            </div>
          </div>
        </div>

        {/* 7. CTA — primary glow */}
        <Button
          onClick={onClose}
          className={cn(
            "h-12 w-full rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary via-primary to-primary/90",
            "text-primary-foreground hover:from-primary/95 hover:to-primary/85",
            "shadow-[0_8px_28px_-8px_rgba(217,54,32,0.8)]",
          )}
        >
          <span>오늘의 훈련 시작하기</span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InductionCompleteCelebration;
