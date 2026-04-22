import { ArrowRight, Bell, Heart, RotateCcw, Sparkles } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  isReminderEnabled,
  resolveReminderSlot,
  type DietReminderSlot,
} from "@/lib/diet/preferences";
import type { DietPreferences } from "@/lib/diet/preferences";
import { cn } from "@/lib/utils";

type DietLogStatus = Database["public"]["Enums"]["diet_log_status"];

interface DietReminderBannerProps {
  /** 오늘 로그의 status — null 이면 아직 기록 없음 */
  todayStatus: DietLogStatus | null;
  prefs: DietPreferences;
  /** 배너 클릭 시 이동 콜백 (보통 /diet/tracker) */
  onGo: () => void;
  /** 마지막 승인된 로그 일자 (YYYY-MM-DD). null 이면 아직 없음 */
  lastLogDate?: string | null;
  /** 테스트 주입용 현재 시각 */
  now?: Date;
  className?: string;
}

/** 오늘 기준 N일 공백 계산 — 실패 시 null (배너 숨김) */
function daysSinceLastLog(
  lastLogDate: string | null | undefined,
  now: Date,
): number | null {
  if (!lastLogDate) return null;
  try {
    const last = new Date(`${lastLogDate}T00:00:00`);
    if (Number.isNaN(last.getTime())) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor(
      (today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000),
    );
    return diff >= 0 ? diff : null;
  } catch {
    return null;
  }
}

/**
 * 홈에서 보여주는 스마트 리마인더 배너.
 *
 * 우선순위
 *   1. 오늘 rejected 상태 → 회복 독려 ("다음 식사부터 다시 시작")
 *   2. 오늘 기록 없음 + 해당 시간대 리마인더 on → 시간대별 문구
 *   3. 그 외 → 배너 미표시
 *
 * 시간대 문구는 자체 작성. 실패 상황에서도 친절하고 non-shaming.
 */
export const DietReminderBanner = ({
  todayStatus,
  prefs,
  onGo,
  lastLogDate = null,
  now,
  className,
}: DietReminderBannerProps) => {
  const effectiveNow = now ?? new Date();

  // 0) drop-off 감지 — 3일 이상 기록 공백 시 복귀 독려 (최우선)
  if (todayStatus === null) {
    const gap = daysSinceLastLog(lastLogDate, effectiveNow);
    if (gap !== null && gap >= 3) {
      return (
        <Banner
          tone="recover"
          icon={<Heart className="h-4 w-4" />}
          title={`${gap}일 쉬었어도 괜찮아요`}
          body="완벽히 지키는 사람은 없어요. 오늘 한 끼만 제자리로 돌려도 다시 리듬이 잡혀요."
          cta="돌아오기"
          onGo={onGo}
          className={className}
        />
      );
    }
  }

  // 1) rejected 상태는 시간대 설정과 무관하게 표시
  if (todayStatus === "rejected") {
    return (
      <Banner
        tone="recover"
        icon={<RotateCcw className="h-4 w-4" />}
        title="오늘 놓쳐도 괜찮아요"
        body="다음 식사부터 다시 시작하면 됩니다. 기록만 남겨도 회복 시작이에요."
        cta="다시 시작"
        onGo={onGo}
        className={className}
      />
    );
  }

  // 2) 기록 있음 (pending/approved/revision) → 배너 필요 없음
  if (todayStatus !== null) return null;

  const slot = resolveReminderSlot(effectiveNow);
  if (!isReminderEnabled(prefs, slot)) return null;

  const copy = slotCopy(slot);
  if (!copy) return null;

  return (
    <Banner
      tone={copy.tone}
      icon={copy.icon}
      title={copy.title}
      body={copy.body}
      cta={copy.cta}
      onGo={onGo}
      className={className}
    />
  );
};

// ──────────────────────────────────────────────────────────────────
// 슬롯별 카피
// ──────────────────────────────────────────────────────────────────
type BannerTone = "morning" | "midday" | "evening" | "recover";

function slotCopy(slot: DietReminderSlot): {
  tone: BannerTone;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
} | null {
  if (slot === "morning") {
    return {
      tone: "morning",
      icon: <Sparkles className="h-4 w-4" />,
      title: "아침 시작, 오늘의 미션 확인",
      body: "첫 끼는 단백질로, 물 한 컵부터. 30초면 오늘 미션이 보여요.",
      cta: "오늘 미션 보기",
    };
  }
  if (slot === "midday") {
    return {
      tone: "midday",
      icon: <Bell className="h-4 w-4" />,
      title: "점심 체크, 천천히 먹기",
      body: "점심에 단백질 + 채소 한 접시 챙겼다면 오늘 반은 성공.",
      cta: "체크인 하기",
    };
  }
  if (slot === "evening") {
    return {
      tone: "evening",
      icon: <Bell className="h-4 w-4" />,
      title: "저녁, 오늘 하루 정리",
      body: "야식은 취침 3시간 전까지만. 잠들기 전 오늘 기록 한 줄 남겨요.",
      cta: "체크인 하기",
    };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 배너 UI
// ──────────────────────────────────────────────────────────────────
const Banner = ({
  tone,
  icon,
  title,
  body,
  cta,
  onGo,
  className,
}: {
  tone: BannerTone;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onGo: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onGo}
    className={cn(
      "w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99]",
      toneClass(tone),
      className,
    )}
    aria-label={cta}
  >
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          iconBgClass(tone),
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
      <div
        className={cn(
          "mt-1 flex shrink-0 items-center gap-1 text-[11px] font-bold",
          toneAccent(tone),
        )}
      >
        <span className="hidden sm:inline">{cta}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </div>
  </button>
);

function toneClass(tone: BannerTone): string {
  switch (tone) {
    case "recover":
      return "border-primary/35 bg-gradient-to-r from-primary/10 to-transparent";
    case "morning":
      return "border-reward/35 bg-gradient-to-r from-reward/10 to-transparent";
    case "midday":
      return "border-primary/25 bg-primary/5";
    case "evening":
      return "border-accent/25 bg-accent/5";
  }
}
function iconBgClass(tone: BannerTone): string {
  switch (tone) {
    case "recover":
      return "bg-primary/15 text-primary";
    case "morning":
      return "bg-reward/20 text-reward";
    case "midday":
      return "bg-primary/15 text-primary";
    case "evening":
      return "bg-accent/15 text-accent";
  }
}
function toneAccent(tone: BannerTone): string {
  return tone === "evening" ? "text-accent" : "text-primary";
}

export default DietReminderBanner;
