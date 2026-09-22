/**
 * 가이드 — 레벨 40까지 가는 길 (2026-09-22)
 *
 * 회원님들이 가장 궁금해하는 "그래서 몇 년 걸려요?" 에 답하는 페이지.
 * 숫자는 전부 서버 규칙(get_levelup_rules · get_workout_rules · get_level_cycle_progress)에서
 * 받아 journeyMath 로 계산한다 — 승급 판정과 같은 식이라 화면과 실제가 어긋나지 않는다.
 *
 * 구성: 내 페이스(주인공 숫자) → 총 필요 출석 → 주당 출석별 표 → 리그별 구간 → 규칙 한눈에.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Timer, Flag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RANK_LABELS, RANK_ICONS } from "@/data/sharedConstants";
import { whoLabel } from "@/lib/levelAuthority";
import { useLevelCycleProgress } from "@/hooks/useLevelCycleProgress";
import {
  daysToLevel40,
  formatArrival,
  formatDuration,
  leaguePlans,
  remainingDaysToLevel40,
  remainingVisitsToLevel40,
  totalVisits,
  totalVisitsAtBonus,
  type LeagueRule,
  type WorkoutRules,
} from "@/lib/journeyMath";

const RATE_WEEKS = 12;
const TABLE_RATES = [1, 2, 3, 4, 5];

const GuideJourneyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rules = [] } = useQuery({
    queryKey: ["levelup-rules"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_levelup_rules", {});
      if (error) throw error;
      return (data || []) as LeagueRule[];
    },
  });

  const { data: wr } = useQuery({
    queryKey: ["workout-rules"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_workout_rules", {});
      if (error) throw error;
      return data as WorkoutRules;
    },
  });

  const { data: cycle } = useLevelCycleProgress();

  // 최근 12주 내 출석 빈도 — 하루 1회(is_duplicate=false), KST 날짜 기준.
  // 분모는 "첫 출석 이후 지난 주수"(최대 12, 최소 1) — 12주로 고정하면 가입 n주차 회원의 페이스가
  // 12/n 배 과소평가되어 "38년" 같은 숫자가 나온다 (검수 발견).
  const { data: pace } = useQuery({
    queryKey: ["my-attendance-rate", user?.id ?? "anon", RATE_WEEKS],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - RATE_WEEKS * 7 * 86400000).toISOString();
      const [recent, first] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("checked_in_at")
          .eq("user_id", user!.id)
          .eq("is_duplicate", false)
          .gte("checked_in_at", since)
          .limit(500),
        supabase
          .from("attendance_logs")
          .select("checked_in_at")
          .eq("user_id", user!.id)
          .eq("is_duplicate", false)
          .order("checked_in_at", { ascending: true })
          .limit(1),
      ]);
      if (recent.error) throw recent.error;
      if (first.error) throw first.error;
      const days = new Set<string>();
      for (const r of (recent.data || []) as { checked_in_at: string }[]) {
        const kst = new Date(new Date(r.checked_in_at).getTime() + 9 * 3600 * 1000);
        days.add(kst.toISOString().slice(0, 10));
      }
      const firstAt = (first.data?.[0] as { checked_in_at: string } | undefined)?.checked_in_at;
      const weeksSinceFirst = firstAt ? (Date.now() - new Date(firstAt).getTime()) / (7 * 86400000) : 0;
      const weeks = Math.min(RATE_WEEKS, Math.max(1, weeksSinceFirst));
      return { perWeek: days.size / weeks, weeks: Math.round(weeks), days: days.size };
    },
  });
  const perWeek = pace?.perWeek;
  const paceWeeks = pace?.weeks ?? RATE_WEEKS;

  const maxProgress = wr?.maxProgress ?? 1;
  const total = rules.length ? totalVisits(rules) : 0;
  const totalBonus = rules.length ? totalVisitsAtBonus(rules, maxProgress) : 0;
  const plans = useMemo(() => (rules.length ? leaguePlans(rules) : []), [rules]);

  const me = useMemo(() => {
    if (!cycle || !rules.length) return null;
    const pos = {
      rank: cycle.rank,
      currentLevel: cycle.currentLevel,
      progress: Number(cycle.progress ?? 0),
      elapsedDays: cycle.elapsedDays ?? 0,
    };
    const rate = perWeek ?? 0;
    return {
      pos,
      rate,
      remainingVisits: remainingVisitsToLevel40(rules, pos),
      daysBase: remainingDaysToLevel40(rules, pos, rate, 1),
      daysBonus: remainingDaysToLevel40(rules, pos, rate, maxProgress),
      done: pos.rank === "black" && pos.currentLevel >= 10,
    };
  }, [cycle, rules, perWeek, maxProgress]);

  const fmtRate = (r: number) => (Math.round(r * 10) / 10).toLocaleString();

  return (
    <div className="light-surface min-h-screen mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95" aria-label="가이드로">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">레벨 40까지 가는 길</h1>
          <p className="text-[11px] text-muted-foreground">얼마나 걸릴까요? 규칙 그대로 계산했습니다</p>
        </div>
      </div>

      {/* ── 내 페이스 (주인공) ── */}
      {me && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Timer className="h-3.5 w-3.5 text-primary" /> 내 페이스로는?
          </p>
          {me.done ? (
            <p className="mt-2 text-sm font-bold text-foreground">레벨 40에 도달했어요. 여기부터는 마스터의 길입니다 🥊</p>
          ) : me.rate > 0 ? (
            <>
              <p className="number-font mt-1.5 text-4xl font-black text-primary">
                {formatDuration(me.daysBase)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                지금처럼 <b className="number-font text-foreground">주 {fmtRate(me.rate)}회</b> 오시면{" "}
                <b className="text-foreground">{formatArrival(me.daysBase)}</b> 레벨 40 · 남은 출석{" "}
                <b className="number-font text-foreground">{me.remainingVisits}회</b>
              </p>
              {maxProgress > 1 && me.daysBonus < me.daysBase - 30 && (
                <p className="mt-2 rounded-lg bg-card px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  매번 {wr?.bonusCapMinutes}분 이상 운동하고 종료 버튼을 누르면{" "}
                  <b className="text-foreground">{formatDuration(me.daysBonus)}</b>까지 줄어요.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              최근 {RATE_WEEKS}주 출석 기록이 없어 아직 계산할 수 없어요. 주 2회면 약{" "}
              <b className="text-foreground">{rules.length ? formatDuration(daysToLevel40(rules, 2)) : "-"}</b>, 주 3회면 약{" "}
              <b className="text-foreground">{rules.length ? formatDuration(daysToLevel40(rules, 3)) : "-"}</b> 걸립니다.
            </p>
          )}
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            최근 {paceWeeks}주 출석으로 계산한 예상치예요. 승인 대기 시간(타이틀매치, 레드·블랙 전 레벨)은 포함되지 않습니다.
          </p>
        </div>
      )}

      {/* ── 총 필요 출석 ── (규칙을 아직 못 받았으면 0 이 잠깐 보이지 않게 숨긴다) */}
      {rules.length > 0 && (
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <p className="text-[11px] font-bold text-muted-foreground">화이트 L1에서 레벨 40까지, 필요한 출석</p>
        <p className="number-font mt-1 text-2xl font-black text-foreground">
          {total}
          <span className="ml-0.5 text-sm font-bold text-muted-foreground">회</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {plans.map((p) => `${RANK_LABELS[p.rank] || p.rank} ${p.visits}`).join(" · ")}
        </p>
        {wr && maxProgress > 1 && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            매번 <b className="number-font text-foreground">{wr.bonusCapMinutes}분</b> 이상 운동하면 한 번이{" "}
            <b className="number-font text-foreground">{maxProgress}회</b>로 쌓여{" "}
            <b className="number-font text-primary">{totalBonus}회</b>면 됩니다.
          </p>
        )}
      </div>
      )}

      {/* ── 주당 출석별 소요 기간 ── */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-foreground">주에 몇 번 오느냐가 전부입니다</p>
        </div>
        <div className="grid grid-cols-3 border-b border-border bg-muted/30 px-4 py-2 text-[10.5px] font-bold text-muted-foreground">
          <span>주당 출석</span>
          <span className="text-right">매번 {wr?.defaultMinutes ?? 50}분</span>
          <span className="text-right">매번 {wr?.bonusCapMinutes ?? 120}분</span>
        </div>
        {rules.length > 0 &&
          TABLE_RATES.map((w) => {
            const mine = me && me.rate > 0 && Math.abs(me.rate - w) < 0.5;
            return (
              <div
                key={w}
                className={`grid grid-cols-3 border-b border-border px-4 py-2.5 last:border-b-0 ${mine ? "bg-primary/5" : ""}`}
              >
                <span className="number-font text-xs font-bold text-foreground">
                  주 {w}회{mine && <span className="ml-1 text-[10px] font-black text-primary">나</span>}
                </span>
                <span className="number-font text-right text-xs font-bold text-foreground">
                  {formatDuration(daysToLevel40(rules, w, 1))}
                </span>
                <span className="number-font text-right text-xs font-bold text-primary">
                  {formatDuration(daysToLevel40(rules, w, maxProgress))}
                </span>
              </div>
            );
          })}
        <p className="px-4 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
          주 4회 이상은 거의 차이가 없어요 — 블랙 리그의 "레벨마다 최소 일수"가 속도의 바닥이 됩니다.
        </p>
      </div>

      {/* ── 리그별 구간 ── */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <Flag className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-foreground">리그별로 쌓아야 하는 것</p>
        </div>
        {rules
          .slice()
          .sort((a, b) => a.firstLevel - b.firstLevel)
          .map((r) => {
            const p = plans.find((x) => x.rank === r.rank);
            if (!p) return null;
            return (
              <div key={r.rank} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span className="mt-0.5 text-base">{RANK_ICONS[r.rank] || "🥊"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    {RANK_LABELS[r.rank] || r.rank} 리그{" "}
                    <span className="number-font text-[10.5px] font-semibold text-muted-foreground">
                      Lv {r.firstLevel}~{r.lastLevel}
                    </span>
                  </p>
                  <p className="number-font mt-0.5 text-xs text-foreground">
                    {p.passes}번 승급 × {p.visitsPerPass}회 = <b className="text-primary">{p.visits}회</b>
                    {p.minDaysPerPass > 0 && <> · 레벨마다 최소 <b className="text-primary">{p.minDaysPerPass}일</b></>}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    {r.autoAdvance
                      ? `출석을 채우면 자동 승급 · 레벨 ${r.lastLevel}(타이틀매치)만 ${whoLabel(r.titleAuthority)} 승인`
                      : `출석을 채우면 심사가 열리고 ${whoLabel(r.levelAuthority)}이 보고 승급 · 레벨 ${r.lastLevel}은 ${whoLabel(r.titleAuthority)} 승인`}
                  </p>
                </div>
              </div>
            );
          })}
      </div>

      {/* ── 규칙 한눈에 ── */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <p className="mb-2 text-xs font-bold text-foreground">계산에 쓴 규칙</p>
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <li>· 출석은 <b className="text-foreground">하루 1회</b>만 쌓여요 — 입구 얼굴 인식 또는 보드 QR.</li>
          <li>
            · 종료 버튼을 안 누르면 <b className="number-font text-foreground">{wr?.defaultMinutes ?? 50}분</b>으로 기록돼요.
            {wr && maxProgress > 1 && (
              <> 오래 운동하고 종료를 누르면 한 번이 최대 <b className="number-font text-foreground">{maxProgress}회</b>({wr.bonusCapMinutes}분)로 쌓여요.</>
            )}
          </li>
          <li>· 레벨 10·20·30은 <b className="text-foreground">타이틀매치</b> — 출석을 채운 뒤 담당자(코치·지점장·관장) 승인으로 다음 리그로 갑니다.</li>
          <li>· 블랙 리그는 출석을 몰아쳐도 <b className="text-foreground">레벨마다 최소 일수</b>를 채워야 해요.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs leading-relaxed text-foreground">
          레벨 40은 몇 년에 걸친 여정이에요. 오늘 한 번의 출석이 그 {total || 340}회 중 하나입니다 — 빨리 가는 길은 <b>꾸준히 오는 것</b>, 그리고 오래 운동하고 종료 버튼을 누르는 것. 🥊
        </p>
      </div>
    </div>
  );
};

export default GuideJourneyPage;
