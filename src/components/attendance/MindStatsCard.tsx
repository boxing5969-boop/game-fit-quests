/**
 * 🧠 마음 능력치 — '내 운동 기록' (2026-11-14 대표님 「마이복서 153 정신적인 향상도 넣자 · 운동을 통한 자신감 힘 ·
 *   과학적이고 설득력이 정말 중요해 — 사람들이 이거 신뢰할 수 있는 데이터인가 생각하기 때문에」)
 *   '같은 나이와 비교'(몸) 다음 카드 — 자신감(로젠버그 자존감 척도) · 힘(활력, RAND-36) · 운동 습관(SRBAI)을 4주마다 2분 체크로 잰다.
 *   주인공 = 가장 많이 오른 능력치(10점 이상이면 금색 '의미 있는 변화') · 처음이면 첫 기록 세 숫자 · 아직이면 안내.
 *   잘한 것만 크게(내려간 점수는 화살표 없이 지금 값만 — 모든 기록은 '지난 기록'에) · 출처 · 계산법 · 연구 · 설정은 '근거 · 계산 방법' 하나로 접기.
 *   숫자 · 문구는 lib/mind153 한 곳 · 문항은 data/mindScales · 서버 mind_* (20261114105414_mind_checks.sql).
 *   알림 '마음 체크할 때예요'(28일) → /mypage/attendance?mind=1 → 이 카드로 내려오고, 4주가 지났거나 처음이면 체크 창이 열린다.
 *   예시 화면 ?demo=1(&mindDemo=none|first|steady|growth) — 서버를 부르지 않고 이 기기 안에서만.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, ChevronDown, Lock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { MIND_SCALE, MIND_SCALES } from "@/data/mindScales";
import { kstToday } from "@/lib/attendanceCheer";
import {
  MIND_HELP_LINE,
  MIND_HOW,
  MIND_RESEARCH,
  MIND_REST_LINE,
  brandLine,
  buildMindView,
  changeText,
  dateKo,
  habitDaysText,
  heroLine,
  nextStepText,
  normalizeMindState,
  scoreConf,
  scoreHabit,
  scoreText,
  scoreVital,
  HABIT_DAYS,
  REPLACE_WITHIN_DAYS,
  daysBetween,
  type MindCheck,
  type MindRow,
  type MindState,
  type MindView,
} from "@/lib/mind153";
import { useClearMind, useMindConsent, useMindRemind, useMindState, useSaveMindCheck } from "@/services/mindService";
import MindCheckSheet, { type MindSaveOutcome } from "@/components/attendance/MindCheckSheet";
import { cn } from "@/lib/utils";

/** 0~100 막대 — 처음 값 눈금(올랐을 때만) */
const ScoreBar = ({ now, first, gold, className }: { now: number; first?: number | null; gold?: boolean; className?: string }) => (
  <div className={cn("relative h-2.5 rounded-full bg-muted", className)} aria-hidden>
    <div className={cn("h-full rounded-full transition-[width] duration-700", gold ? "bg-reward" : "bg-primary")} style={{ width: `${Math.min(100, Math.max(2, now))}%` }} />
    {first != null && (
      <div className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-foreground/70" style={{ left: `calc(${Math.min(100, Math.max(0, first))}% - 1px)` }} />
    )}
  </div>
);

/** 세 숫자 한 덩어리 — 첫 기록 · 흐름을 보는 중 */
const StatTrio = ({ last }: { last: MindCheck }) => (
  <div className="mt-3 grid grid-cols-3 gap-2">
    {MIND_SCALES.map((s) => (
      <div key={s.key} className="min-w-0 rounded-xl bg-muted/50 px-3 py-3">
        <p className="truncate text-label font-bold text-muted-foreground">{s.label}</p>
        <p className="mt-1 text-title font-black tabular-nums text-foreground">{scoreText(last[s.key])}</p>
        <ScoreBar now={last[s.key]} className="mt-2 h-1.5" />
      </div>
    ))}
  </div>
);

const Row = ({ r, heroKey }: { r: MindRow; heroKey: string | null }) => (
  <div className="mt-4 border-t border-border pt-4">
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-body text-foreground">
        {r.label} <span className="text-label text-muted-foreground">{r.test}</span>
      </span>
      <span className="shrink-0 text-body font-black tabular-nums text-foreground">
        {r.change != null && r.first != null ? (
          <>
            <span className="font-bold text-muted-foreground">{scoreText(r.first)} → </span>
            {scoreText(r.now)}
          </>
        ) : (
          scoreText(r.now)
        )}
      </span>
    </div>
    <ScoreBar now={r.now} first={r.change != null ? r.first : null} gold={r.meaningful} className="mt-2" />
    {r.change != null && r.key !== heroKey && (
      <p className={cn("mt-1.5 flex items-center gap-1 text-label font-bold", r.meaningful ? "text-reward" : "text-primary")}>
        <TrendingUp className="h-4 w-4" aria-hidden />
        {changeText(r.change)}
        {r.meaningful ? " · 의미 있는 변화" : ""}
      </p>
    )}
  </div>
);

const Li = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <li>
    <b>{k}</b> — {children}
  </li>
);

export interface MindStatsBodyProps {
  state: MindState;
  today: string;
  onCheck: () => void;
  onRemind?: (on: boolean) => void;
  onClear?: () => void;
  busy?: boolean;
  /** 예시 화면 표시 */
  demo?: boolean;
  className?: string;
}

/** 화면만 — 데이터는 MindStatsCard 가 넣는다 (시험 · 화면 확인용으로 따로 둔다) */
export const MindStatsBody = ({ state, today, onCheck, onRemind, onClear, busy, demo, className }: MindStatsBodyProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const view: MindView = useMemo(() => buildMindView(state.checks, today), [state.checks, today]);
  const { hero, last } = view;
  const heroKey = hero.kind === "growth" ? hero.key : null;
  const habitLine = habitDaysText(view);
  const brand = brandLine(state.brand);
  const showCta = hero.kind === "invite" || !!view.due?.isDue;

  return (
    <section id="mind-stats" aria-label="마음 능력치" className={cn("scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 truncate text-heading text-foreground">
          <Brain className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          마음 능력치
          {demo && <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-micro font-bold text-muted-foreground">예시</span>}
        </h3>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-label font-bold text-foreground">
          <Lock className="h-4 w-4 text-primary" aria-hidden />
          나만 봐요
        </span>
      </div>

      {/* ─── 주인공 ─── */}
      {hero.kind === "invite" && (
        <div className="mt-4">
          <p className="text-title font-black leading-snug text-foreground">운동은 마음도 키워요</p>
          <p className="mt-1 text-body leading-snug text-foreground">{heroLine(hero)}</p>
          <ul className="mt-4 space-y-2">
            {MIND_SCALES.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
                <span className="text-body font-bold text-foreground">{s.label}</span>
                <span className="min-w-0 truncate text-label text-muted-foreground">{s.test}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(hero.kind === "first" || hero.kind === "steady") && last && (
        <div className="mt-4">
          <p className="text-label font-bold text-muted-foreground">
            {hero.kind === "first" ? "첫 기록" : "지금"} · {dateKo(last.takenOn)}
          </p>
          <StatTrio last={last} />
          <p className="mt-3 text-body leading-snug text-foreground">{heroLine(hero, false)}</p>
        </div>
      )}

      {hero.kind === "growth" && (
        <div className="mt-4">
          <p className="text-label font-bold text-muted-foreground">
            {MIND_SCALE[hero.key].label} · {MIND_SCALE[hero.key].test}
          </p>
          <p className={cn("mt-1 text-display tracking-tight tabular-nums", hero.meaningful ? "text-reward" : "text-foreground")}>
            {changeText(hero.change)}
            <span className="ml-1 text-title">점</span>
          </p>
          <p className="text-body font-bold leading-snug text-foreground">{heroLine(hero, false)}</p>
          {view.rows.map((r) => (
            <Row key={r.key} r={r} heroKey={heroKey} />
          ))}
        </div>
      )}

      {/* ─── 66일 습관 ─── */}
      {habitLine && view.habitDays && (
        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3">
          <p className="text-label font-bold leading-snug text-foreground">{habitLine}</p>
          <div className="mt-2 h-1.5 rounded-full bg-card" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (view.habitDays.since / HABIT_DAYS) * 100)}%` }} />
          </div>
        </div>
      )}

      {view.lowConf && <p className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">{MIND_HELP_LINE}</p>}
      {view.lowVital && <p className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">{MIND_REST_LINE}</p>}

      {/* ─── 다음 걸음 하나 ─── */}
      {showCta ? (
        <button
          type="button"
          onClick={onCheck}
          disabled={busy}
          className="mt-4 h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {hero.kind === "invite" ? "첫 마음 체크 · 2분" : "다시 재기 · 4주가 지났어요"}
        </button>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="min-w-0 text-body font-bold leading-snug text-foreground">{nextStepText(view)}</p>
          <button
            type="button"
            onClick={onCheck}
            disabled={busy}
            className="h-10 shrink-0 rounded-xl border border-border px-3 text-label font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
          >
            지금 다시
          </button>
        </div>
      )}

      {/* ─── 근거 · 계산 방법 — 접기 ─── */}
      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-4 flex w-full items-center justify-between gap-2 text-left text-label text-muted-foreground"
      >
        <span className="min-w-0 truncate">검증된 검사 3가지 · 연구 근거</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          근거 · 계산 방법 <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-label font-bold text-foreground">연구로 보면</p>
            <ul className="mt-2 space-y-2.5">
              {MIND_RESEARCH.map((x) => (
                <li key={x.key} className="text-label leading-relaxed text-foreground">
                  <b>{x.title}</b> — {x.body}
                  <span className="mt-0.5 block text-micro text-muted-foreground">{x.cite}</span>
                </li>
              ))}
            </ul>
            {brand && <p className="mt-3 border-t border-border pt-3 text-label font-bold leading-relaxed text-foreground">{brand}</p>}
          </div>

          <ul className="space-y-2 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">
            {MIND_HOW.map((h) => (
              <Li key={h.k} k={h.k}>
                {h.v}
              </Li>
            ))}
          </ul>

          {state.checks.length > 0 && (
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-label font-bold text-foreground">지난 기록 {state.checks.length}</p>
              <ul className="mt-2 divide-y divide-border">
                {[...state.checks].reverse().map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-label tabular-nums text-foreground">
                    <span className="shrink-0 font-bold">{dateKo(c.takenOn)}</span>
                    <span className="min-w-0 truncate text-right">
                      {MIND_SCALES.map((s) => `${s.short} ${scoreText(c[s.key])}`).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              {last && daysBetween(last.takenOn, today) < REPLACE_WITHIN_DAYS && (
                <p className="mt-1 text-micro text-muted-foreground">마지막 체크 뒤 2주 안에 다시 하면 그 기록을 고쳐 써요</p>
              )}
            </div>
          )}

          {state.consent && (onRemind || onClear) && (
            <div className="space-y-2">
              {onRemind && (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                  <span className="text-body text-foreground">4주가 되면 알림 받기</span>
                  <input
                    type="checkbox"
                    checked={state.remind}
                    disabled={busy}
                    onChange={(e) => onRemind(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                </label>
              )}
              {onClear && (
                <button type="button" onClick={onClear} disabled={busy} className="w-full py-2 text-label font-bold text-destructive disabled:opacity-60">
                  마음 체크 기록 지우기 · 동의 거두기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/* ───────────── 예시 화면 (?demo=1) — 지어낸 기록, 이 기기 안에서만 ───────────── */

const demoChecks = (kind: string, today: string): MindCheck[] => {
  const at = (days: number) => {
    const d = new Date(`${today}T12:00:00+09:00`);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const c = (days: number, conf: number, vital: number, habit: number): MindCheck => ({
    id: `demo-${days}`,
    takenAt: `${at(days)}T12:00:00+09:00`,
    takenOn: at(days),
    conf,
    vital,
    habit,
  });
  if (kind === "none") return [];
  if (kind === "first") return [c(3, 56.7, 45, 33.3)];
  if (kind === "steady") return [c(60, 66.7, 60, 50), c(31, 63.3, 55, 54.2)];
  return [c(61, 56.7, 45, 33.3), c(32, 63.3, 55, 50), c(2, 70, 60, 58.3)];
};

const demoState = (kind: string, today: string): MindState => ({
  active: true,
  consent: kind !== "none",
  consentAt: kind !== "none" ? `${today}T00:00:00+09:00` : null,
  remind: true,
  age: null,
  checks: demoChecks(kind, today),
  brand: { ready: false },
});

/** '내 운동 기록' 카드 — 내 마음 체크 상태를 읽어 그린다 (서버 함수가 없으면 예시 화면에서만) */
const MindStatsCard = ({ className }: { className?: string }) => {
  const [params, setParams] = useSearchParams();
  const demo = params.get("demo") === "1";
  const today = kstToday();
  const { data, isLoading } = useMindState(!demo);
  const consent = useMindConsent();
  const saveCheck = useSaveMindCheck();
  const clear = useClearMind();
  const remind = useMindRemind();
  const [demoData, setDemoData] = useState<MindState>(() => demoState(params.get("mindDemo") ?? "growth", today));
  const [open, setOpen] = useState(false);
  const handled = useRef(false);

  const state: MindState | null = demo ? demoData : (data ?? null);

  // 알림 링크 ?mind=1 — 이 카드로 내려오고, 처음이거나 4주가 지났으면 체크 창을 연다 (한 번만 · 주소에서 지운다)
  useEffect(() => {
    if (handled.current || !state || params.get("mind") !== "1") return;
    handled.current = true;
    window.setTimeout(() => document.getElementById("mind-stats")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    const v = buildMindView(state.checks, today);
    if (v.hero.kind === "invite" || v.due?.isDue) setOpen(true);
    const next = new URLSearchParams(params);
    next.delete("mind");
    setParams(next, { replace: true });
  }, [state, params, setParams, today]);

  if (!demo && (isLoading || !data || !data.active)) return null;
  if (!state) return null;

  const onConsent = async (adult: boolean) => {
    if (demo) {
      setDemoData((s) => ({ ...s, consent: true, consentAt: new Date().toISOString() }));
      return;
    }
    await consent.mutateAsync({ adult });
  };

  const onSave = async (a: { conf: number[]; vital: number[]; habit: number[] }): Promise<MindSaveOutcome> => {
    if (demo) {
      const row: MindCheck = {
        id: `demo-now-${Date.now()}`,
        takenAt: new Date().toISOString(),
        takenOn: today,
        conf: scoreConf(a.conf) ?? 0,
        vital: scoreVital(a.vital) ?? 0,
        habit: scoreHabit(a.habit) ?? 0,
      };
      const prev = demoData.checks[demoData.checks.length - 1];
      const replaced = !!prev && daysBetween(prev.takenOn, today) < REPLACE_WITHIN_DAYS;
      const checks = replaced ? [...demoData.checks.slice(0, -1), row] : [...demoData.checks, row];
      const next = normalizeMindState({
        active: true,
        consent: true,
        remind: demoData.remind,
        checks: checks.map((c) => ({ id: c.id, taken_at: c.takenAt, taken_on: c.takenOn, conf: c.conf, vital: c.vital, habit: c.habit })),
        brand: demoData.brand,
      });
      setDemoData(next);
      return { replaced, state: next };
    }
    const r = await saveCheck.mutateAsync(a);
    return { replaced: r.replaced, state: r.state };
  };

  const onClear = () => {
    if (!window.confirm("마음 체크 기록을 모두 지우고 동의를 거둘까요? 지운 기록은 되돌릴 수 없어요")) return;
    if (demo) {
      setDemoData(demoState("none", today));
      return;
    }
    clear.mutate(undefined, {
      onSuccess: () => toast.success("마음 체크 기록을 지웠어요"),
      onError: (e) => toast.error(e.message),
    });
  };

  const onRemind = (on: boolean) => {
    if (demo) {
      setDemoData((s) => ({ ...s, remind: on }));
      return;
    }
    remind.mutate(on, { onError: (e) => toast.error(e.message) });
  };

  return (
    <>
      <MindStatsBody
        state={state}
        today={today}
        onCheck={() => setOpen(true)}
        onRemind={onRemind}
        onClear={onClear}
        busy={clear.isPending || remind.isPending}
        demo={demo}
        className={className}
      />
      <MindCheckSheet open={open} onClose={() => setOpen(false)} state={state} today={today} onConsent={onConsent} onSave={onSave} />
    </>
  );
};

export default MindStatsCard;
