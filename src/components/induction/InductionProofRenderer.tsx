import { useMemo } from "react";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import type { InductionProofKey } from "@/data/inductionTutorialSteps";
import { cn } from "@/lib/utils";

/**
 * InductionProofRenderer — proofItems 키를 실데이터로 매핑해 시각화.
 *
 * 원칙:
 *   · 신규 데이터 호출 0 — 기존 useAuth.profile / useLocalProgress 만 재사용
 *   · 정적 카드(roadmap·1단·코치 검토 등)는 키 매핑만으로 즉시 렌더
 *   · 한 카드당 한 메시지. 중복 노출 방지 (같은 키 두 번이면 첫 번째만)
 *   · 민트 primary + 차콜 surface — 과한 게임 UI 금지
 */

const RANK_ORDER = ["white", "blue", "red", "black"] as const;
const RANK_KO: Record<(typeof RANK_ORDER)[number], string> = {
  white: "백",
  blue: "청",
  red: "적",
  black: "흑",
};
const RANK_TONE: Record<(typeof RANK_ORDER)[number], string> = {
  white: "bg-zinc-200 text-zinc-700 border-zinc-300",
  blue: "bg-sky-400/15 text-sky-600 border-sky-400/40",
  red: "bg-rose-400/15 text-rose-600 border-rose-400/40",
  black: "bg-zinc-800 text-zinc-100 border-zinc-700",
};

interface InductionProofRendererProps {
  items: readonly InductionProofKey[];
  /** 화면 우선순위 — 너무 많아지면 잘라낸다. */
  maxItems?: number;
  className?: string;
}

export const InductionProofRenderer = ({
  items,
  maxItems = 3,
  className,
}: InductionProofRendererProps) => {
  const { profile } = useAuth();
  const local = useLocalProgress();

  // current 데이터
  const currentRank = (profile?.current_rank ?? "white") as
    | "white" | "blue" | "red" | "black";
  const currentLevel = profile?.current_level ?? 1;
  const totalXp = local?.totalXp ?? 0;

  // 다음 레벨까지 진행률 (대략) — useLocalProgress 가 이미 가진 값 활용
  const nextLevelProgressPct = useMemo(() => {
    // levelProgress[activeLevelId]?.currentLevelXp / xpToNext 가 더 정확하지만
    // 튜토리얼 단계라 0% 근처가 일반적. 안전 fallback.
    const lvl = local?.levelProgress?.[`${currentRank}-${currentLevel}`];
    const cur = lvl?.currentLevelXp ?? totalXp;
    const goal = 100; // 튜토리얼 시점 표시용 — 실제 룰엔진 계산은 후속 단계
    return Math.max(0, Math.min(100, Math.round((cur / goal) * 100)));
  }, [local?.levelProgress, currentRank, currentLevel, totalXp]);

  // 중복 제거 + 최대 개수
  const seen = new Set<InductionProofKey>();
  const picked = items.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, maxItems);

  if (picked.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {picked.map((key) => {
        switch (key) {
          case "current_league":
            return (
              <ProofCard
                key={key}
                icon={<Award className="h-3.5 w-3.5" />}
                label="현재 리그"
                value={`${RANK_KO[currentRank]}색 리그`}
                tone="primary"
              />
            );
          case "current_level":
            return (
              <ProofCard
                key={key}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="현재 레벨"
                value={`Lv.${currentLevel}`}
                tone="primary"
              />
            );
          case "next_level_progress":
            return (
              <ProofCard
                key={key}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="다음 레벨까지"
                value={`${nextLevelProgressPct}% 진행`}
                bar={nextLevelProgressPct}
                tone="primary"
              />
            );
          case "league_roadmap":
            return <RoadmapStrip key={key} currentRank={currentRank} />;
          case "first_dan_unlock":
            return (
              <ProofCard
                key={key}
                icon={<Flag className="h-3.5 w-3.5" />}
                label="다음 마일스톤"
                value="Lv.10 도달 시 1단 심사 오픈"
                tone="reward"
              />
            );
          case "today_mission_count":
            return (
              <ProofCard
                key={key}
                icon={<ListChecks className="h-3.5 w-3.5" />}
                label="오늘의 훈련"
                value="홈에서 오늘 미션 확인 가능"
                tone="muted"
              />
            );
          case "today_mission_preview":
            return (
              <ProofCard
                key={key}
                icon={<Target className="h-3.5 w-3.5" />}
                label="오늘 시작할 훈련"
                value="복싱 · 자세 · 습관 중 1개로 시작"
                tone="muted"
              />
            );
          case "rewards_preview":
            return (
              <ProofCard
                key={key}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="혜택 연결"
                value="복서 카드 · 단증 혜택 · 시그너처 굿즈"
                tone="muted"
              />
            );
          case "coach_review_note":
            return (
              <ProofCard
                key={key}
                icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                label="코치 검토"
                value="기록은 코치 평가로 검증됩니다"
                tone="muted"
              />
            );
          case "first_record_callout":
            return (
              <ProofCard
                key={key}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="0일차 시작점"
                value="첫 한 줄이 모든 기록의 출발입니다"
                tone="primary"
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Proof 카드 — 한 카드 한 메시지. 차콜 surface · 민트 강조.
// ──────────────────────────────────────────────────────────────────
const ProofCard = ({
  icon,
  label,
  value,
  bar,
  tone = "muted",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** 0~100 진행 바 (선택) */
  bar?: number;
  tone?: "primary" | "reward" | "muted";
}) => {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "reward"
        ? "border-reward/30 bg-reward/5"
        : "border-border bg-card";

  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClass)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            tone === "primary"
              ? "bg-primary/15 text-primary"
              : tone === "reward"
                ? "bg-reward/15 text-reward"
                : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-[12.5px] font-extrabold leading-tight text-foreground">
            {value}
          </p>
        </div>
      </div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// 백 → 청 → 적 → 흑 미니 로드맵 (현재 위치 강조)
// 너무 많은 텍스트 없이 4단계 + 1단 마커만.
// ──────────────────────────────────────────────────────────────────
const RoadmapStrip = ({
  currentRank,
}: {
  currentRank: (typeof RANK_ORDER)[number];
}) => {
  const idx = RANK_ORDER.indexOf(currentRank);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        성장 로드맵
      </p>
      <div className="mt-2 flex items-center gap-1">
        {RANK_ORDER.map((r, i) => (
          <div key={r} className="flex flex-1 items-center">
            <div
              className={cn(
                "flex h-7 w-full items-center justify-center rounded-md border text-[11px] font-extrabold transition-all",
                RANK_TONE[r],
                i === idx && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                i > idx && "opacity-50",
              )}
            >
              {RANK_KO[r]}
            </div>
            {i < RANK_ORDER.length - 1 && (
              <span
                aria-hidden
                className="mx-0.5 inline-block h-px w-2 bg-muted-foreground/40"
              />
            )}
          </div>
        ))}
        {/* 1단 마커 */}
        <span aria-hidden className="mx-0.5 inline-block h-px w-2 bg-reward/60" />
        <div className="flex h-7 min-w-[34px] items-center justify-center rounded-md border border-reward/40 bg-reward/15 px-1.5 text-[10.5px] font-black tracking-wide text-reward">
          1단
        </div>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
        지금 <span className="font-bold text-foreground">{RANK_KO[currentRank]}색</span> · 흑색 너머에 1단 심사가 열립니다
      </p>
    </div>
  );
};

export default InductionProofRenderer;
