import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  Flame,
  Infinity as InfinityIcon,
  ShieldAlert,
  Sparkles,
  Utensils,
  XCircle,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";

import { useAuth } from "@/contexts/AuthContext";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import {
  FOOD_BUCKETS,
  STAGE_SAMPLES,
  getYouthSafeBuckets,
  type FoodBucket,
  type FoodTier,
  type StageSample,
} from "@/data/diet/mealPlan";
import type { DietTrack } from "@/lib/dietTrack";
import { cn } from "@/lib/utils";

/**
 * /diet/meal-plan — 21일 식단 가이드.
 *
 * 구성
 *   1. 4-단계 음식 버킷 (무제한/적정량/줄이기/21일 피하기)
 *   2. 스테이지별 하루 샘플 식단 3종 (Reset/Burning/Lifestyle)
 *
 * 청소년(youth_habit) 트랙 대응
 *   • `youthSafe=false` 항목 숨김 (술 등)
 *   • "21일 피하기" 라벨 → "성장기 주의" 로 부드럽게
 */
const DietMealPlanPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const progressQuery = useDietProgress();

  const track: DietTrack | null = useMemo(() => {
    const p = progressQuery.data;
    if (p && "success" in p && p.success && p.has_active) {
      return p.enrollment?.track ?? null;
    }
    return null;
  }, [progressQuery.data]);
  const isYouth = track === "youth_habit";

  const buckets = useMemo(
    () => (isYouth ? getYouthSafeBuckets() : [...FOOD_BUCKETS]),
    [isYouth],
  );

  const featureEnabled = !!profile?.diet_program_enabled;

  return (
    <AppPage
      header={
        <PageHeader
          title="21일 식단"
          subtitle="무제한 · 적정량 · 줄이기 · 피하기"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-5 pt-2">
        {!featureEnabled ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            153 다이어트 프로그램이 아직 활성화되지 않았어요.
          </div>
        ) : (
          <>
            {/* 안내 */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                MEAL GUIDE · 21 DAYS
              </p>
              <h2 className="mt-1 text-[17px] font-extrabold text-foreground leading-tight">
                양이 아니라 선택이 먼저
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                무제한·적정량·줄이기·피하기 4가지로 분류했어요. 칼로리 계산 대신 '손바닥 한 덩이' 같은 직관 단위로 접근하세요.
              </p>
            </div>

            {/* 음식 버킷 4단계 */}
            <section className="space-y-3">
              {buckets.map((b) => (
                <BucketCard key={b.tier} bucket={b} isYouth={isYouth} />
              ))}
            </section>

            {/* 스테이지별 샘플 */}
            <section className="space-y-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  SAMPLE MEALS
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
                  스테이지별 하루 샘플
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  정답 아니라 참고용. 본인 식사 패턴에 맞춰 가볍게 변형해 보세요.
                </p>
              </div>
              <div className="space-y-2.5">
                {STAGE_SAMPLES.map((s) => (
                  <SampleCard key={s.stage} sample={s} />
                ))}
              </div>
            </section>

            {/* 주의 카피 — 청소년 */}
            {isYouth && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                청소년 트랙은 '단식·식사 거르기'를 포함하지 않습니다. 양을 줄이기보다
                잘 먹고, 잘 자고, 잘 움직이는 쪽으로 중심을 두세요.
              </div>
            )}
          </>
        )}
      </div>
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// Bucket card — 4단계 버킷 시각화
// ──────────────────────────────────────────────────────────────────
const BucketCard = ({
  bucket,
  isYouth,
}: {
  bucket: FoodBucket;
  isYouth: boolean;
}) => {
  const { Icon, tone } = resolveBucketStyle(bucket.tier, isYouth);
  return (
    <div className={cn("rounded-2xl border p-4", tone.wrapper)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone.iconBg,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className={cn("text-[13.5px] font-extrabold", tone.title)}>
            {bucket.label}
          </p>
          <p className="text-[11px] text-muted-foreground">{bucket.summary}</p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1">
        {bucket.items.map((f) => (
          <li
            key={f.name}
            className="flex items-start justify-between gap-3 rounded-lg bg-background/60 px-2.5 py-1.5"
          >
            <span className="text-[12.5px] font-bold text-foreground">
              {f.name}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground text-right">
              {f.hint}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function resolveBucketStyle(tier: FoodTier, isYouth: boolean) {
  if (tier === "unlimited") {
    return {
      Icon: InfinityIcon,
      tone: {
        wrapper: "border-primary/30 bg-primary/5",
        iconBg: "bg-primary/15 text-primary",
        title: "text-primary",
      },
    };
  }
  if (tier === "portioned") {
    return {
      Icon: Sparkles,
      tone: {
        wrapper: "border-accent/25 bg-accent/5",
        iconBg: "bg-accent/15 text-accent",
        title: "text-accent",
      },
    };
  }
  if (tier === "reduce") {
    return {
      Icon: Flame,
      tone: {
        wrapper: "border-reward/30 bg-reward/10",
        iconBg: "bg-reward/20 text-reward-foreground",
        title: "text-reward-foreground",
      },
    };
  }
  // forbidden21 — youth 는 부드럽게
  return {
    Icon: isYouth ? ShieldAlert : XCircle,
    tone: {
      wrapper: "border-destructive/30 bg-destructive/10",
      iconBg: "bg-destructive/15 text-destructive",
      title: "text-destructive",
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// Stage sample card
// ──────────────────────────────────────────────────────────────────
const SampleCard = ({ sample }: { sample: StageSample }) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Utensils className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-wider text-primary">
            {sample.range}
          </p>
          <p className="text-[13.5px] font-extrabold text-foreground leading-tight">
            {sample.title}
          </p>
        </div>
      </div>
      <p className="mt-2 flex items-start gap-1 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-foreground">
        <Clock className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        <span>
          <b>포커스</b> — {sample.focus}
        </span>
      </p>
      <ul className="mt-3 space-y-2">
        {sample.meals.map((m) => (
          <li
            key={m.slot}
            className="rounded-xl border border-border bg-background/50 p-2.5"
          >
            <p className="text-[11.5px] font-black uppercase tracking-wider text-primary">
              {m.slot}
            </p>
            <ul className="mt-1 space-y-0.5">
              {m.items.map((it) => (
                <li
                  key={it}
                  className="pl-3 -indent-3 text-[12.5px] leading-relaxed text-foreground"
                >
                  <span className="mr-1 text-primary">·</span>
                  {it}
                </li>
              ))}
            </ul>
            {m.note && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {m.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DietMealPlanPage;
