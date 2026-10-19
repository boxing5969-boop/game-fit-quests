/**
 * 마이복서153 — 오늘 할 일 카드 (단계 47).
 *
 * 홈 최상단에서 회원이 바로 알 수 있는 4가지:
 *   1. 오늘 할 일 1개
 *   2. 추천 활동 1개
 *   3. (오삼이 한마디는 OsamiHomeNote 가 별도 카드로 처리)
 *   4. 내 최근 변화 1줄
 *
 * 보호 규칙:
 *   · 캠프 state 는 localStorage read-only
 *   · 153마인드셋 횟수는 마인드셋 화면과 같은 숫자 — 계정 기록(get_my_mindset_stats, 30초 캐시).
 *     불러오기 전에는 이 기기에 남은 '내 계정' 기록으로 (2026-10-19 검수: 홈 '20회 완료'인데 화면은 '총 0번'이던 것)
 *   · 153마인드셋 / 캠프 / 공식 훈련 흐름 0 변경
 *   · 표현 금지어 0
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Compass, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useMindsetStats } from "@/services/mindsetService";
import { getTutorialCampState } from "@/features/tutorial-camp/tutorialCampStorage";
import { getStep, getStepsCountByDay } from "@/features/tutorial-camp/tutorialCampSteps";

const VIZ_RECORDS_KEY = "myboxer.visualization.records";

interface VizRecordLite {
  sessionId?: string;
  completedAt?: string;
  durationSec?: number;
  completed?: boolean;
  /** 기록한 계정 (2026-10-19부터) — 같은 폰을 여럿이 쓰면 내 것만 센다 */
  uid?: string;
}

/** 한국 날짜 (YYYY-MM-DD) */
const kstDate = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10) : null;
};

/** 이 기기에 남은 내 계정 기록 중 세는 것 (대본 60% 이상 또는 3분 넘게) — 마인드셋 화면과 같은 기준 */
function readVizCount(uid: string | null): { total: number; lastIso: string | null } {
  if (typeof window === "undefined" || !uid) return { total: 0, lastIso: null };
  try {
    const raw = window.localStorage.getItem(VIZ_RECORDS_KEY);
    if (!raw) return { total: 0, lastIso: null };
    const all = JSON.parse(raw) as VizRecordLite[];
    if (!Array.isArray(all)) return { total: 0, lastIso: null };
    const list = all.filter(
      (r) => r && r.uid === uid && (r.completed !== false || (r.durationSec ?? 0) >= 180),
    );
    const lastIso = typeof list[0]?.completedAt === "string" ? list[0].completedAt : null;
    return { total: list.length, lastIso };
  } catch {
    return { total: 0, lastIso: null };
  }
}

interface FocusItem {
  label: string;
  detail: string;
  to: string;
  icon: typeof Target;
}

const TodayFocusCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [today, setToday] = useState<FocusItem | null>(null);
  const [recommend, setRecommend] = useState<FocusItem | null>(null);
  const [campDays, setCampDays] = useState(0);
  const { data: mind } = useMindsetStats();
  const localViz = useMemo(() => readVizCount(user?.id ?? null), [user?.id]);

  useEffect(() => {
    // 캠프 활성 상태에 따라 "오늘 할 일" 결정
    const camp = getTutorialCampState();
    if (camp.status === "active") {
      const step = getStep(camp.currentDay, camp.currentStep);
      const total = getStepsCountByDay(camp.currentDay);
      setToday({
        label: `오늘의 입문 캠프 — Day ${camp.currentDay}`,
        detail: step
          ? `${step.title} · ${camp.currentStep + 1} / ${total}`
          : "오늘 한 단계만 보면 충분해요.",
        to: step?.route ?? "/home",
        icon: Target,
      });
    } else {
      setToday({
        label: "오늘의 마인드셋 1라운드",
        detail: "153복싱짐으로 돌아온 사람 · 3분",
        to: "/myboxer/visualization",
        icon: Target,
      });
    }

    // 추천 활동 — 캠프 상태와 무관, 가벼운 한 줄
    setRecommend({
      label: "오늘 한 줄 챙기기",
      detail: "복싱 IQ 한 줄 또는 오늘 운동 한 줄",
      // 2026-09-29: 복싱 IQ·챔피언 일기는 MY복서 화면에 있다 (첫 화면 /home 은 전체 메뉴만)
      to: "/myboxer",
      icon: Compass,
    });

    setCampDays(camp.completedDays.length);
  }, []);

  // 최근 변화 1줄 — 153마인드셋 누적 (마인드셋 화면과 같은 숫자)
  const recentLine = useMemo(() => {
    const total = mind ? mind.total_sessions : localViz.total;
    const lastIso = mind
      ? (mind.recent.find((r) => r.completed !== false || r.duration_sec >= 180)?.created_at ?? null)
      : localViz.lastIso;
    if (total > 0) {
      const day = lastIso ? kstDate(lastIso) : null;
      return `153마인드셋 ${total}회 완료${day ? ` · 마지막 ${day}` : ""}`;
    }
    if (campDays > 0) return `입문 캠프 ${campDays}일 진행`;
    return "오늘부터 한 칸씩 쌓으면 됩니다.";
  }, [mind, localViz, campDays]);

  const lines = useMemo(() => [today, recommend].filter(Boolean) as FocusItem[], [
    today,
    recommend,
  ]);

  return (
    <section
      data-tour="home-today-focus"
      className="surface-card border border-border bg-card"
      aria-label="오늘의 한 가지"
    >
      <header className="mb-3 flex items-start gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            오늘의 한 가지
          </p>
          <p className="mt-0.5 text-[14px] font-bold text-foreground">
            오늘은 하나만 해도 충분합니다.
          </p>
        </div>
      </header>

      <div className="space-y-2">
        {lines.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.to)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border bg-secondary/40 px-3 py-3 text-left transition-colors active:scale-[0.99]",
              i === 0
                ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
                : "border-border hover:bg-secondary",
            )}
          >
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill",
                i === 0
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              <item.icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[12px] font-bold leading-tight",
                  i === 0 ? "text-foreground" : "text-foreground/85",
                )}
              >
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-bold text-foreground/80">최근 변화 — </span>
        {recentLine}
      </p>
    </section>
  );
};

export default TodayFocusCard;
