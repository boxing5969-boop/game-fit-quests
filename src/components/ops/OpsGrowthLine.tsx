/**
 * 🗣 153운영본부 「일정」 탭 맨 위 — 오늘의 한마디 (2026-11-17 대표님 「다음진행」 · 오늘의 1분 성장 2단계 · 선릉역점부터)
 *   보고서 「2단계. 체육관으로」: 앱을 여는 회원(평일 하루 17명)보다 체육관에 오는 회원(43명)이 많다 —
 *   그날 글의 한 문장을 코치님이 수업 시작이나 마무리에 말로 전한다. 감정 설계 ④ 「코치님의 말이 닿나」.
 *   · 그날 글의 coach 한 줄(40자 안 · O/X 날은 답을 말하지 않는다 — lib/growthStage2 coachLineOf). 글은 홈 카드와 같은 달 파일.
 *   · 의무가 아니다 — 「전했어요」는 한 번 누르기(다시 누르면 취소) · 사람 이름 없이 오늘 몇 명이 전했는지만.
 *   · 서버 growth_coach_state(켠 지점 지도진 · 대표님 · 운영진) — 꺼진 지점 · 함수가 없는 서버면 그리지 않는다.
 *   자리: 「오늘 만날 회원」 바로 위(OpsPlanTab). 새 탭 · 새 페이지 없음.
 */
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { loadGrowthLessons, monthsFor, todayLesson } from "@/data/growthLessons";
import { kstToday } from "@/lib/attendanceCheer";
import { coachLineOf, coachSaidLine, type CoachLine, type GrowthCoachState } from "@/lib/growthStage2";
import { cn } from "@/lib/utils";
import { useGrowthCoach, useGrowthCoachSay } from "@/services/growthStage2Service";

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 OpsGrowthLine) */
export const OpsGrowthLineView = ({
  line,
  state,
  busy = false,
  onSay,
}: {
  line: CoachLine;
  state: GrowthCoachState;
  busy?: boolean;
  onSay: (on: boolean) => void;
}) => (
  <section className="rounded-2xl border border-border bg-card p-5" aria-label="오늘의 한마디">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-label font-bold text-muted-foreground">오늘의 한마디</h2>
      {line.corner && <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-micro font-black text-primary">{line.corner}</span>}
    </div>
    <p className="mt-1.5 break-keep text-heading font-black leading-snug text-foreground">{line.line}</p>
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="min-w-0 break-keep text-label leading-snug text-muted-foreground">{coachSaidLine(state)}</p>
      <button
        type="button"
        aria-pressed={state.mine}
        aria-label={state.mine ? "전했어요 취소" : "오늘의 한마디를 수업에서 전했어요"}
        disabled={busy}
        onClick={() => onSay(!state.mine)}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-4 text-body font-black transition-all active:scale-95 disabled:opacity-60",
          state.mine ? "bg-primary/10 text-primary" : "bg-foreground text-background",
        )}
      >
        {state.mine && <Check className="h-4 w-4" aria-hidden />}
        전했어요
      </button>
    </div>
  </section>
);

const OpsGrowthLine = ({ branch }: { branch: string | null | undefined }) => {
  const q = useGrowthCoach(branch);
  const say = useGrowthCoachSay(branch);
  const on = q.data?.on === true;
  const today = kstToday();
  // 글은 홈 카드와 같은 캐시 — 켠 지점에서만 받는다
  const { data: lessons } = useQuery({
    queryKey: ["153growth", "lessons", monthsFor(today).join(",")],
    queryFn: () => loadGrowthLessons(today),
    enabled: on,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
  if (!on || !q.data || !lessons) return null;
  const line = coachLineOf(todayLesson(today, lessons));
  if (!line) return null;
  return (
    <OpsGrowthLineView
      line={line}
      state={q.data}
      busy={say.isPending}
      onSay={(v) => say.mutate(v, { onError: (e) => toast.error(e instanceof Error ? e.message : "저장하지 못했어요") })}
    />
  );
};

export default OpsGrowthLine;
