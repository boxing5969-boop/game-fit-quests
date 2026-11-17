/**
 * 153운영본부 「오늘 청소」 1단계 — 입구 (2026-11-16 대표님 「운영본부 탭에 청소 매뉴얼 … 코치님들이 직관적으로 보고
 *   수행할수있도록 편리하게」 → 「올려서 반영하자」 · 보고서 「153복싱짐 선릉역점 청소 매뉴얼·체크리스트 보고서」)
 *
 *   · OpsCleanEntry — 운영본부 탭 줄 바로 아래 띠 「오늘 청소」
 *       코치님: 오늘 내 차례(아직 안 끝난 것)가 있으면 어느 탭에서나 · 다 끝내면 「근무」 · 「일정」 탭에서만
 *       대표님 · 지점 관리자: 「근무」 · 「일정」 탭에서 세 시간대(오픈 · 저녁 · 마감) 한눈에
 *       누르면 전체 화면 한 장(OpsCleanSheet). 새 탭 · 새 페이지는 없다.
 *   · 링크 /office?clean=<시간대|1>(&cd=날짜) — 홈 카드 · '청소 문제' 알림이 이 주소로 온다(열고 나면 주소에서 지운다)
 *   · 예시 /office?cleandemo=coach · manager — 서버를 부르지 않고 이 기기 안에서만 바뀐다(지어낸 이름 · 저장 안 됨)
 *   서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 아무것도 그리지 않는다 — 예시만 보인다.
 *   읽고 쓰기 src/services/opsCleanService.ts · 계산 src/lib/opsClean.ts · DB 20261116211742_ops_clean_stage1.sql
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  cleanDayLabel,
  finishLine,
  myOpenSlots,
  pickSlot,
  slotStatus,
  slotStatusText,
  slotSubLine,
  type CleanDay,
  type CleanSlot,
} from "@/lib/opsClean";
import { applyCleanDemo, buildCleanSample, type CleanDemoWho } from "@/lib/opsCleanSample";
import { reportRange, type CleanReport } from "@/lib/opsCleanReport";
import { applyReportDemo, buildCleanReportSample, withTodayFromDay, type ReportDemoAction } from "@/lib/opsCleanReportSample";
import { useOpsCleanActions, useOpsCleanDay } from "@/services/opsCleanService";
import { useOpsCleanReport, useOpsCleanReportActions } from "@/services/opsCleanReportService";
import type { CleanReportActions } from "./OpsCleanReport";
import OpsCleanSheet, { type CleanSheetActions } from "./OpsCleanSheet";
import { OpsChip, kstToday } from "./OpsParts";

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
// 2단계 「청소 현황」 · 「항목 고치기」 — 대표님 · 지점 관리자만 열어서 따로 받는다
const OpsCleanReport = lazy(() => import("./OpsCleanReport"));
const kstNowHm = (): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

// ── 띠 ───────────────────────────────────────────────────────

const StatusChip = ({ slot }: { slot: CleanSlot }) => {
  const st = slotStatus(slot);
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-label font-black tabular-nums",
        st === "finished"
          ? "bg-primary/10 text-primary"
          : st === "doing"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
            : slot.mine
              ? "bg-foreground text-background"
              : "bg-secondary text-muted-foreground",
      )}
    >
      {st === "idle" && slot.mine ? "시작" : slotStatusText(slot)}
    </span>
  );
};

/** 운영본부 탭 줄 아래 한 장 — 시간대마다 한 줄 */
export const CleanStrip = ({
  day,
  wide,
  demo = false,
  onOpen,
  onReport,
}: {
  day: CleanDay;
  /** 「근무」 · 「일정」 탭 — 끝난 것까지 다 보여 준다 */
  wide: boolean;
  demo?: boolean;
  onOpen: (slot: string | null) => void;
  /** (대표님 · 지점 관리자) 「청소 현황」 — 2단계 */
  onReport?: () => void;
}) => {
  const mine = myOpenSlots(day);
  const rows = wide || demo ? day.slots : mine;
  if (rows.length === 0 && !(wide && day.manage)) return null;
  return (
    <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label="오늘 청소">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-heading font-black text-foreground">오늘 청소</h2>
        <span className="shrink-0 text-label font-bold text-muted-foreground">{cleanDayLabel(day.date)}</span>
      </div>
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpen(null)}
          className="mt-2 flex h-12 w-full items-center justify-between rounded-2xl px-1 text-left text-body text-muted-foreground active:opacity-70"
        >
          {day.closed ? "오늘은 휴관일이에요" : "오늘은 청소가 없는 날이에요"}
          <span className="flex items-center text-label font-bold text-foreground">
            지난 기록 <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </button>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {rows.map((s) => {
            const st = slotStatus(s);
            return (
              <li key={s.slot}>
                <button
                  type="button"
                  onClick={() => onOpen(s.slot)}
                  aria-label={`${s.label} ${s.time} 청소 열기`}
                  className={cn(
                    "flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-transform active:scale-[0.99]",
                    s.mine && st !== "finished" ? "border-primary/60 bg-background" : "border-border bg-background",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-body font-black text-foreground">{s.label}</span>
                      <span className="text-label font-bold tabular-nums text-muted-foreground">{s.time}</span>
                      {day.manage && s.people.length > 0 && <span className="truncate text-label text-muted-foreground">· {s.people.join(" · ")}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-label text-muted-foreground">{st === "idle" ? slotSubLine(s) : finishLine(s)}</span>
                  </span>
                  <StatusChip slot={s} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onReport && wide && day.manage && (
        <button
          type="button"
          onClick={onReport}
          className="mt-2 flex h-11 w-full items-center justify-between rounded-2xl px-1 text-left text-body font-bold text-foreground active:opacity-70"
        >
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
            청소 현황 · 문제 · 항목 고치기
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>
      )}
    </section>
  );
};

// ── 서버에 이어진 입구 ───────────────────────────────────────

const LiveEntry = ({ enabled, tab }: { enabled: boolean; tab: string }) => {
  const [params, setParams] = useSearchParams();
  // 열린 화면 — 보고 있는 시간대 · (관리자) 넘겨 본 날. null = 닫힘
  const [open, setOpen] = useState<{ slot: string | null; date: string | null } | null>(null);
  // (대표님 · 지점 관리자) 고른 지점 · 「청소 현황」(몇 주) — null = 닫힘
  const [branch, setBranch] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);
  const todayQ = useOpsCleanDay(branch, null, enabled, !!open);
  const pastQ = useOpsCleanDay(branch, open?.date ?? null, enabled && !!open?.date, true);
  const act = useOpsCleanActions();
  const today = todayQ.data;
  const range = reportRange(today?.today || kstToday(), weeks ?? 2);
  const repQ = useOpsCleanReport(branch, range.from, range.to, enabled && weeks !== null && !!today?.manage);
  const ract = useOpsCleanReportActions();
  const rep = repQ.data;
  useEffect(() => {
    if (weeks !== null && rep && !rep.on) {
      toast(rep.available ? "볼 수 있는 청소 현황이 없어요" : "청소 현황은 준비 중이에요");
      setWeeks(null);
    }
  }, [weeks, rep]);
  useEffect(() => {
    if (weeks !== null && repQ.isError) {
      toast.error((repQ.error as Error).message);
      setWeeks(null);
    }
  }, [weeks, repQ.isError, repQ.error]);
  const shown = open?.date && pastQ.data?.on ? pastQ.data : today;

  // 링크 /office?clean=<시간대|1>(&cd=날짜) — 읽은 뒤에 열고 주소에서 지운다
  const want = params.get("clean");
  const wantDate = params.get("cd");
  const settled = todayQ.isSuccess || todayQ.isError;
  useEffect(() => {
    if (!want || !enabled || !settled) return;
    if (today?.on) {
      const date = today.manage && isDay(wantDate) && wantDate < today.today ? wantDate : null;
      const slot = want === "1" ? (pickSlot(today, null, Date.now())?.slot ?? null) : want;
      setOpen({ slot, date });
    }
    setParams(
      (p) => {
        p.delete("clean");
        p.delete("cd");
        return p;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, wantDate, enabled, settled, today?.on]);

  const actions: CleanSheetActions = useMemo(() => {
    const onError = (e: unknown) => toast.error((e as Error).message);
    return {
      check: (itemId, state, note) => {
        if (shown?.on) act.check.mutate({ itemId, date: shown.date, state, note }, { onError });
      },
      start: (slot) => {
        if (shown?.on) act.start.mutate({ branch: shown.branch, date: shown.date, slot }, { onError });
      },
      finish: (slot, note, _at, done) => {
        if (!shown?.on) return;
        act.finish.mutate(
          { branch: shown.branch, date: shown.date, slot, note },
          {
            onError,
            onSuccess: () => {
              done();
              toast.success("청소를 끝냈어요");
            },
          },
        );
      },
      busy: act.start.isPending || act.finish.isPending,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, act.start.isPending, act.finish.isPending]);

  const reportActions: CleanReportActions = useMemo(() => {
    const onError = (e: unknown) => toast.error((e as Error).message);
    return {
      resolve: (itemId, date, note, done) =>
        ract.resolve.mutate(
          { itemId, date, note },
          {
            onError,
            onSuccess: () => {
              done();
              toast.success("처리했어요 · 남긴 분께 알렸어요");
            },
          },
        ),
      saveItem: (payload, done) => ract.saveItem.mutate(payload, { onError, onSuccess: () => done() }),
      order: (slotId, ids) => ract.order.mutate({ slotId, ids }, { onError }),
      saveSlot: (payload, done) => ract.saveSlot.mutate(payload, { onError, onSuccess: () => done() }),
      busy: ract.resolve.isPending || ract.saveItem.isPending || ract.order.isPending || ract.saveSlot.isPending,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ract.resolve.isPending, ract.saveItem.isPending, ract.order.isPending, ract.saveSlot.isPending]);

  if (!today?.available || !today.on) return null;
  const wide = tab === "work" || tab === "plan";
  const openReport = today.manage ? () => setWeeks((w) => w ?? 2) : undefined;
  return (
    <>
      <CleanStrip
        day={today}
        wide={wide}
        onOpen={(slot) => setOpen({ slot: slot ?? pickSlot(today, null, Date.now())?.slot ?? null, date: null })}
        onReport={openReport}
      />
      {open && shown?.on && (
        <OpsCleanSheet
          day={shown}
          slotKey={open.slot}
          onSlot={(slot) => setOpen((o) => (o ? { ...o, slot } : o))}
          onClose={() => setOpen(null)}
          actions={actions}
          onDate={today.manage ? (d) => setOpen((o) => (o ? { ...o, date: d >= today.today ? null : d } : o)) : undefined}
          loading={!!open.date && pastQ.data?.date !== open.date && pastQ.isFetching}
          onReport={openReport}
          onBranch={today.manage ? (b) => setBranch(b) : undefined}
          covered={weeks !== null}
        />
      )}
      {weeks !== null && rep?.on && (
        <Suspense fallback={null}>
          <OpsCleanReport
            rep={rep}
            weeks={weeks}
            onWeeks={setWeeks}
            onBranch={(b) => setBranch(b)}
            onClose={() => setWeeks(null)}
            onOpenDay={(date, slot) => {
              setWeeks(null);
              setOpen({ slot, date: date >= today.today ? null : date });
            }}
            actions={reportActions}
            loading={repQ.isFetching && repQ.isPlaceholderData}
          />
        </Suspense>
      )}
    </>
  );
};

// ── 예시 ─────────────────────────────────────────────────────

const DemoEntry = ({ who }: { who: CleanDemoWho }) => {
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState<CleanDay>(() => buildCleanSample(kstToday(), who));
  const [slot, setSlot] = useState<string | null | undefined>(undefined);
  // 관리자 예시 — 「청소 현황」 · 「항목 고치기」 (최근 4주 지어낸 기록)
  const [rep, setRep] = useState<CleanReport>(() => buildCleanReportSample(kstToday(), kstNowHm()));
  const [weeks, setWeeks] = useState<number | null>(null);
  useEffect(() => {
    setDay(buildCleanSample(kstToday(), who));
    setSlot(undefined);
    setRep(buildCleanReportSample(kstToday(), kstNowHm()));
    setWeeks(null);
  }, [who]);
  const shownRep = useMemo(() => {
    const r = withTodayFromDay(rep, day);
    if (weeks === null) return r;
    const from = reportRange(r.today, weeks).from;
    return { ...r, from, days: r.days.filter((d) => d.date >= from) };
  }, [rep, day, weeks]);
  const demoRep = (a: ReportDemoAction) => setRep((r) => applyReportDemo(r, a, new Date().toISOString()));
  const reportActions: CleanReportActions = {
    resolve: (itemId, date, note, done) => {
      demoRep({ type: "resolve", itemId, date, note });
      done();
      toast.success("예시에서 처리했어요 · 저장되지 않아요");
    },
    saveItem: (payload, done) => {
      demoRep({ type: "item", payload });
      done();
    },
    order: (slotId, ids) => demoRep({ type: "order", slotId, ids }),
    saveSlot: (payload, done) => {
      demoRep({ type: "slot", payload });
      done();
    },
    busy: false,
  };
  const openReport = who === "manager" ? () => setWeeks((w) => w ?? 2) : undefined;

  // 예시도 /office?cleandemo=coach&clean=open 으로 바로 열 수 있다
  const want = params.get("clean");
  useEffect(() => {
    if (!want) return;
    setSlot(want === "1" ? null : want);
    setParams(
      (p) => {
        p.delete("clean");
        p.delete("cd");
        return p;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  const setWho = (w: CleanDemoWho | null) =>
    setParams(
      (p) => {
        if (w) p.set("cleandemo", w);
        else p.delete("cleandemo");
        return p;
      },
      { replace: true },
    );

  const actions: CleanSheetActions = {
    check: (itemId, state, note, at) => setDay((d) => applyCleanDemo(d, { type: "check", itemId, state, note }, at)),
    start: (s, at) => setDay((d) => applyCleanDemo(d, { type: "start", slot: s }, at)),
    finish: (s, note, at, done) => {
      setDay((d) => applyCleanDemo(d, { type: "finish", slot: s, note }, at));
      done();
      toast.success("예시에서 끝냈어요 · 저장되지 않아요");
    },
    busy: false,
  };

  return (
    <>
      <section className="rounded-3xl border border-dashed border-border bg-background p-4" aria-label="오늘 청소 예시">
        <p className="text-body font-black text-foreground">오늘 청소 예시</p>
        <p className="mt-0.5 text-label text-muted-foreground">지어낸 이름이고, 눌러도 저장되지 않아요</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <OpsChip on={who === "coach"} onClick={() => setWho("coach")}>
            코치 화면
          </OpsChip>
          <OpsChip on={who === "manager"} onClick={() => setWho("manager")}>
            관리자 화면
          </OpsChip>
          <OpsChip on={false} onClick={() => setWho(null)}>
            예시 끄기
          </OpsChip>
        </div>
      </section>
      <CleanStrip day={day} wide demo onOpen={(s) => setSlot(s ?? pickSlot(day, null, Date.now())?.slot ?? null)} onReport={openReport} />
      {slot !== undefined && (
        <OpsCleanSheet
          day={day}
          slotKey={slot}
          onSlot={setSlot}
          onClose={() => setSlot(undefined)}
          actions={actions}
          demo
          onReport={openReport}
          covered={weeks !== null}
        />
      )}
      {weeks !== null && (
        <Suspense fallback={null}>
          <OpsCleanReport
            rep={shownRep}
            weeks={weeks}
            onWeeks={setWeeks}
            onClose={() => setWeeks(null)}
            onOpenDay={(date, s) => {
              if (date !== day.today) return toast("예시는 오늘 목록만 열려요");
              setWeeks(null);
              setSlot(s);
            }}
            actions={reportActions}
            demo
          />
        </Suspense>
      )}
    </>
  );
};

/** 운영본부 탭 줄 바로 아래 — 볼 것이 없으면 아무것도 그리지 않는다 */
export const OpsCleanEntry = ({ enabled, tab }: { enabled: boolean; tab: string }) => {
  const [params] = useSearchParams();
  const demo = params.get("cleandemo");
  const who: CleanDemoWho | null = demo === "manager" ? "manager" : demo === "coach" || demo === "1" ? "coach" : null;
  return who ? <DemoEntry who={who} /> : <LiveEntry enabled={enabled} tab={tab} />;
};

export default OpsCleanEntry;
