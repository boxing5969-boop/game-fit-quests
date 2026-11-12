/**
 * 153운영본부 · 근무 — 출근 확정 1단계 화면 조각 (2026-11-12 대표님 「추천대로하자」)
 *   코치: 맨 위 "출근 기록이 아직 없어요"(시간표 시작 15분 뒤) · 지난 누락 날 · 내 출근 신고 · 하루 시트의 「출근 신고」(와 있었어요 · 일찍 퇴근 · 쉬는 날)
 *   관리자: '확인할 것'의 출근 신고(신고대로 승인 · 반려 · 누르면 그날 시트에서 시간 고쳐 승인) · 대표님 출근 알림 켜기
 *   예시 화면(?demo=1): OpsDutyDemo — 지어낸 근무자, 서버를 부르지 않는다.
 *   글 · 계산은 src/lib/opsDuty.ts, 서버는 src/services/opsDutyService.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronRight, Clock3 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtDuration, type OpsDay, type OpsStaff } from "@/lib/opsWork";
import {
  DUTY_KIND_HINT,
  DUTY_KIND_LABEL,
  DUTY_SAMPLE_STAFF,
  DUTY_STATUS,
  dutyDefaultAt,
  dutyDraftError,
  dutyKindText,
  dutyLiveFor,
  dutyMinutesLine,
  dutyMissingDays,
  dutyOpen,
  dutyPayload,
  dutyProposedMinutes,
  dutyTodayNudge,
  type DutyData,
  type DutyKind,
  type DutyReport,
} from "@/lib/opsDuty";
import { useOpsDuty, useOpsDutyActions, type DutyActions } from "@/services/opsDutyService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, fmtDay, opsInput } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

// ───────────────────────── 코치 — 하루 시트의 「출근 신고」 ─────────────────────────
export const DutyReportForm = ({
  staff,
  day,
  data,
  actions,
  today,
  nowHm,
  initialKind,
  onDone,
}: {
  staff: OpsStaff;
  day: OpsDay;
  data: DutyData;
  actions: DutyActions;
  today: string;
  nowHm: string;
  initialKind?: DutyKind | null;
  onDone: () => void;
}) => {
  const kinds: DutyKind[] = day.checkin ? ["early", "off"] : ["here", "early", "off"];
  const firstKind = initialKind && kinds.includes(initialKind) ? initialKind : kinds[0];
  const [kind, setKind] = useState<DutyKind>(firstKind);
  const [at, setAt] = useState(() => dutyDefaultAt(firstKind, day, today, nowHm));
  const [note, setNote] = useState("");
  useEffect(() => {
    setKind(firstKind);
    setAt(dutyDefaultAt(firstKind, day, today, nowHm));
    setNote("");
    // 다른 날을 열면 처음부터
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.date, staff.id]);
  const pick = (k: DutyKind) => {
    setKind(k);
    setAt(dutyDefaultAt(k, day, today, nowHm));
  };

  const live = dutyLiveFor(data.reports, staff.id, day.date);
  const same = live.find((r) => r.kind === kind && r.status === "open");
  const approved = live.find((r) => r.status === "approved");
  const minutes = dutyProposedMinutes(day, kind, at);
  const draft = { kind, date: day.date, at, note };
  const err = dutyDraftError(draft, { today, nowHm, checkedIn: !!day.checkin });
  const busy = actions.send.isPending;

  const send = () => {
    if (err) return toast.error(err);
    actions.send.mutate(
      { p: dutyPayload(staff.id, draft, minutes), staffName: staff.name },
      {
        onSuccess: (r) => {
          toast.success(r.updated ? "보낸 신고를 고쳤어요" : "지점장님께 알렸어요 — 확인되면 알림이 와요");
          onDone();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <OpsChip key={k} on={kind === k} onClick={() => pick(k)}>
            {DUTY_KIND_LABEL[k]}
          </OpsChip>
        ))}
      </div>
      <p className="mt-2 text-label text-muted-foreground">{DUTY_KIND_HINT[kind]}</p>
      {kind !== "off" && (
        <>
          <OpsLabel>{kind === "here" ? "온 시각" : "나간 시각"}</OpsLabel>
          <input type="time" value={at} onChange={(e) => setAt(e.target.value.slice(0, 5))} className={cn(opsInput, "w-40")} aria-label={kind === "here" ? "온 시각" : "나간 시각"} />
        </>
      )}
      <OpsLabel>지점장님께 한마디 (선택)</OpsLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 100))}
        placeholder={kind === "here" ? "예: 입구에서 인식이 안 됐어요" : kind === "early" ? "예: 회원 상담이 일찍 끝났어요" : "예: 미리 말씀드린 휴무예요"}
        className={opsInput}
      />
      <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2.5">
        <p className="text-body font-bold text-foreground">
          {kind === "off" ? "쉰 날로 바뀌어요(0시간)" : dutyMinutesLine(minutes, day.scheduledMin || null)}
        </p>
        <p className="text-label text-muted-foreground">지점장님이 확인하면 반영돼요 — 결과는 알림으로 와요</p>
      </div>
      {approved && <p className="mt-2 text-label font-bold text-primary">이날은 신고가 이미 반영됐어요 — 다시 보내면 지점장님이 한 번 더 확인해요</p>}
      {same && <p className="mt-2 text-label font-bold text-amber-700">보낸 신고가 확인을 기다려요 — 다시 보내면 그 신고가 바뀌어요</p>}
      <div className="mt-4">
        <OpsButton disabled={busy || !!err} onClick={send}>
          {same ? "신고 고치기" : "지점장님께 알리기"}
        </OpsButton>
        {err && <p className="mt-2 text-center text-label font-bold text-destructive">{err}</p>}
      </div>
    </>
  );
};

// ───────────────────────── 코치 — 「근무」 탭 위쪽 ─────────────────────────
export const DutyCoachCards = ({
  staff,
  days,
  data,
  today,
  nowHm,
  onOpenDay,
}: {
  staff: OpsStaff;
  days: OpsDay[];
  data: DutyData;
  today: string;
  nowHm: string;
  /** 하루 시트를 「출근 신고」로 연다 */
  onOpenDay: (date: string, kind?: DutyKind) => void;
}) => {
  const todayDay = days.find((d) => d.date === today) ?? null;
  const nudge = staff.checkin_required
    ? dutyTodayNudge(todayDay, { nowHm, afterMin: data.setting.coach_after_min, reports: data.reports, staffId: staff.id })
    : null;
  const missing = staff.checkin_required ? dutyMissingDays(days, { today, reports: data.reports, staffId: staff.id }) : [];

  return (
    <>
      {nudge && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-black text-foreground">오늘 출근 기록이 아직 없어요</p>
              <p className="mt-0.5 text-label text-muted-foreground">{nudge.start} 근무예요 — 얼굴 인식이 안 됐다면 눌러서 알려 주세요</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenDay(today, "off")}
              className="h-11 rounded-xl border border-border bg-background text-label font-black text-foreground active:scale-[0.98]"
            >
              오늘 쉬는 날
            </button>
            <button
              type="button"
              onClick={() => onOpenDay(today, "here")}
              className="h-11 rounded-xl bg-primary text-label font-black text-primary-foreground active:scale-[0.98]"
            >
              와 있어요 · 알리기
            </button>
          </div>
        </section>
      )}

      {missing.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="px-5 pb-2 pt-5">
            <h2 className="text-heading font-black text-foreground">출근 기록이 없는 날 {missing.length}일</h2>
            <p className="mt-0.5 text-label text-muted-foreground">일했다면 날짜를 눌러 알려 주세요 — 지점장님이 확인하면 시간이 잡혀요</p>
          </div>
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {missing.slice(0, 6).map((d) => (
              <li key={d.date}>
                <button type="button" onClick={() => onOpenDay(d.date, "here")} className="flex w-full items-center gap-2 px-5 py-3 text-left active:bg-secondary/60">
                  <span className="min-w-0 flex-1 truncate text-body font-bold text-foreground">{fmtDay(d.date)}</span>
                  <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                    {d.segs.map((s) => `${s.start}~${s.end}`).join(" · ")}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

/** 코치 — 내 출근 신고(열린 것 + 30일) · 처리 전이면 취소 */
export const DutyMyReports = ({ staffId, data, actions }: { staffId: string; data: DutyData; actions: DutyActions }) => {
  const mine = data.reports.filter((r) => r.staff_id === staffId);
  const [more, setMore] = useState(false);
  const shownMine = more ? mine : mine.slice(0, 4);
  return (
    <>
      {mine.length > 0 && (
        <section className={card}>
          <h2 className="text-heading font-black text-foreground">내 출근 신고</h2>
          <ul className="mt-3 space-y-2">
            {shownMine.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-foreground">
                    {fmtDay(r.work_date)} · {DUTY_KIND_LABEL[r.kind]}
                    {r.at_time ? ` ${r.at_time}` : ""}
                  </p>
                  <p className="truncate text-label text-muted-foreground">
                    {r.status === "approved" && r.kind !== "off" && r.minutes != null ? `인정 ${fmtDuration(r.minutes)}` : ""}
                    {r.status === "approved" && r.kind === "off" ? "쉰 날로 반영" : ""}
                    {r.decide_note ? `${r.status === "approved" ? " · " : ""}${r.decide_note}` : r.status === "open" ? "지점장님 확인을 기다려요" : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", DUTY_STATUS[r.status].cls)}>{DUTY_STATUS[r.status].label}</span>
                {r.status === "open" && (
                  <button
                    type="button"
                    disabled={actions.cancel.isPending}
                    onClick={() =>
                      actions.cancel.mutate(r.id, {
                        onSuccess: () => toast.success("신고를 취소했어요"),
                        onError: (e) => toast.error((e as Error).message),
                      })
                    }
                    className="shrink-0 text-label font-bold text-muted-foreground underline underline-offset-2"
                  >
                    취소
                  </button>
                )}
              </li>
            ))}
          </ul>
          {mine.length > 4 && (
            <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 w-full text-center text-label font-bold text-muted-foreground">
              {more ? "접기" : `${mine.length - 4}건 더 보기`}
            </button>
          )}
        </section>
      )}
    </>
  );
};

// ───────────────────────── 관리자 — '확인할 것'의 출근 신고 ─────────────────────────
export const DutyManagerList = ({
  data,
  actions,
  hq,
  scheduledOf,
  onOpenDay,
}: {
  data: DutyData;
  actions: DutyActions;
  /** 대표님 — 지점장 본인 신고도 처리 */
  hq: boolean;
  /** 그날 시간표 분(근무 자료에서) — 모르면 null */
  scheduledOf: (r: DutyReport) => number | null;
  /** 그날 시트(시간 고쳐 승인) */
  onOpenDay?: (r: DutyReport) => void;
}) => {
  const open = dutyOpen(data.reports);
  if (open.length === 0) return null;
  const busy = actions.decide.isPending;
  const run = (r: DutyReport, approve: boolean) =>
    actions.decide.mutate(
      { id: r.id, approve },
      {
        onSuccess: () => toast.success(approve ? "승인했어요 — 그날 시간이 바뀌었어요" : "반려했어요"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  return (
    <ul className="mt-3 space-y-2">
      {open.map((r) => {
        const own = r.mine && !hq;
        const needMin = r.kind !== "off" && r.minutes == null;
        return (
          <li key={r.id} className="rounded-xl bg-amber-50 p-3">
            <button type="button" onClick={() => onOpenDay?.(r)} disabled={!onOpenDay} className="block w-full text-left">
              <p className="flex items-center gap-1 text-label font-bold text-amber-800">
                <Clock3 className="h-4 w-4" /> 출근 신고 · {fmtDay(r.work_date)}
              </p>
              <p className="mt-0.5 text-body text-foreground">
                <b className="font-black">{r.staff_name}</b> · {dutyKindText(r.kind, r.at_time)}
              </p>
              {r.note && <p className="mt-0.5 text-label text-muted-foreground">“{r.note}”</p>}
              <p className="mt-0.5 text-label font-bold text-foreground">
                {r.kind === "off" ? "승인하면 쉰 날(0시간)로 바뀌어요" : dutyMinutesLine(r.minutes, scheduledOf(r))}
              </p>
            </button>
            {own ? (
              <p className="mt-1 text-label text-muted-foreground">내가 보낸 신고는 대표님이 확인해요</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(r, false)}
                  className="h-10 rounded-xl border border-border bg-background text-label font-black text-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  반려
                </button>
                <button
                  type="button"
                  disabled={busy || (needMin && !onOpenDay)}
                  onClick={() => (needMin ? onOpenDay?.(r) : run(r, true))}
                  className="h-10 rounded-xl bg-primary text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  {needMin ? "시간 정해 승인" : "신고대로 승인"}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** 관리자 — 하루 시트 맨 위: 그날 열린 신고를 시간 고쳐 승인 · 반려 */
export const DutyDecideBox = ({
  reports,
  scheduledMin,
  actions,
  hq,
  onDone,
}: {
  reports: DutyReport[];
  scheduledMin: number;
  actions: DutyActions;
  hq: boolean;
  onDone: () => void;
}) => {
  const r = reports[0] ?? null;
  const base = r?.minutes ?? scheduledMin;
  const [h, setH] = useState(String(Math.floor(base / 60)));
  const [m, setM] = useState(String(base % 60));
  const [note, setNote] = useState("");
  useEffect(() => {
    setH(String(Math.floor(base / 60)));
    setM(String(base % 60));
    setNote("");
  }, [r?.id, base]);
  if (!r) return null;
  const minutes = Math.max(0, (Number(h) || 0) * 60 + (Number(m) || 0));
  const own = r.mine && !hq;
  const run = (approve: boolean) =>
    actions.decide.mutate(
      { id: r.id, approve, minutes: approve && r.kind !== "off" ? minutes : null, note },
      {
        onSuccess: () => {
          toast.success(approve ? "승인했어요 — 그날 시간이 바뀌었어요" : "반려했어요");
          onDone();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-label font-bold text-amber-800">코치 출근 신고{reports.length > 1 ? ` ${reports.length}건` : ""}</p>
      <p className="mt-0.5 text-body font-bold text-foreground">{dutyKindText(r.kind, r.at_time)}</p>
      {r.note && <p className="mt-0.5 text-label text-muted-foreground">“{r.note}”</p>}
      {own ? (
        <p className="mt-2 text-label text-muted-foreground">내가 보낸 신고는 대표님이 확인해요</p>
      ) : (
        <>
          {r.kind !== "off" && (
            <>
              <OpsLabel>인정할 시간</OpsLabel>
              <div className="flex items-center gap-2">
                <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))} className={cn(opsInput, "w-20 text-center")} aria-label="시간" />
                <span className="shrink-0 text-body text-foreground">시간</span>
                <input inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))} className={cn(opsInput, "w-20 text-center")} aria-label="분" />
                <span className="shrink-0 text-body text-foreground">분</span>
              </div>
              <p className="mt-1 text-label text-muted-foreground">
                {r.minutes != null ? `신고대로 ${fmtDuration(r.minutes)}` : "신고에 시간이 없어요"} · 시간표 {fmtDuration(scheduledMin)}
              </p>
            </>
          )}
          <OpsLabel>코치님께 한마디 (선택)</OpsLabel>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 100))} placeholder="예: 확인했어요" className={opsInput} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <OpsButton tone="plain" disabled={actions.decide.isPending} onClick={() => run(false)}>
              반려
            </OpsButton>
            <OpsButton disabled={actions.decide.isPending || (r.kind !== "off" && minutes > 24 * 60)} onClick={() => run(true)}>
              {r.kind === "off" ? "쉰 날로 승인" : `${fmtDuration(minutes)} 승인`}
            </OpsButton>
          </div>
        </>
      )}
    </div>
  );
};

// ───────────────────────── 대표님 — 출근 알림 켜기 ─────────────────────────
export const DutySettingRow = ({ data, actions }: { data: DutyData; actions: DutyActions }) => {
  const [ask, setAsk] = useState(false);
  if (!data.available || !data.can_set) return null;
  const s = data.setting;
  const toggle = (on: boolean) =>
    actions.setting.mutate(
      { on },
      {
        onSuccess: () => {
          toast.success(on ? "출근 알림을 켰어요 — 오늘 근무부터 알려요" : "출근 알림을 껐어요");
          setAsk(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <BellRing className={cn("h-5 w-5 shrink-0", s.on ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold text-foreground">출근 알림 {s.on ? "켜짐" : "꺼짐"}</p>
        <p className="text-label text-muted-foreground">
          시작 {s.coach_after_min}분 뒤 코치님 · {s.manager_after_min}분 뒤 지점장님께 (근로 코치만)
        </p>
      </div>
      {s.on && !ask ? (
        <button type="button" onClick={() => setAsk(true)} className="shrink-0 text-label font-bold text-muted-foreground underline underline-offset-2">
          끄기
        </button>
      ) : (
        <button
          type="button"
          disabled={actions.setting.isPending}
          onClick={() => toggle(!s.on)}
          className={cn(
            "h-9 shrink-0 rounded-full px-3 text-label font-black active:scale-95 disabled:opacity-50",
            s.on ? "border border-destructive/40 text-destructive" : "bg-foreground text-background",
          )}
        >
          {s.on ? "정말 끌게요" : "켜기"}
        </button>
      )}
    </div>
  );
};

// ───────────────────────── 예시 화면(?demo=1) ─────────────────────────
const DEMO_NOW = "18:20";
const demoStaff = (id: string, name: string): OpsStaff => ({
  id,
  user_id: null,
  name,
  kind: "parttime",
  pay_type: "hourly",
  hourly_wage: null,
  monthly_salary: null,
  pt_freelancer: false,
  checkin_required: true,
  start_date: null,
  end_date: null,
  active: true,
});
const demoDay = (date: string, status: OpsDay["status"]): OpsDay => ({
  date,
  weekday: 0,
  segs: [{ start: "18:00", end: "21:00" }],
  scheduledMin: 180,
  checkin: null,
  creditedMin: 0,
  overtimeMin: 0,
  status,
  adjust: null,
  pending: [],
  givenAway: [],
});
const shift = (d: string, n: number) => {
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

/** 예시 — 코치 화면(오늘 출근 기록 없음 · 지난 누락 날 · 신고 시트) / 관리자 화면(확인할 것 · 하루 시트 승인 · 출근 알림 켜기) */
export const OpsDutyDemo = () => {
  const [view, setView] = useState<"coach" | "manage">("coach");
  const coachQ = useOpsDuty(null, { demo: true, demoManage: false });
  const mgrQ = useOpsDuty(null, { demo: true, demoManage: true });
  const coachAct = useOpsDutyActions(null, { demo: true, demoManage: false });
  const mgrAct = useOpsDutyActions(null, { demo: true, demoManage: true });
  const today = coachQ.data?.today ?? mgrQ.data?.today ?? "";
  const me = useMemo(() => demoStaff(DUTY_SAMPLE_STAFF.me, "예시 코치(나)"), []);
  const days = useMemo(
    () => (today ? [demoDay(shift(today, -4), "missing"), demoDay(shift(today, -2), "off"), demoDay(shift(today, -1), "missing"), demoDay(today, "today")] : []),
    [today],
  );
  const [sheet, setSheet] = useState<{ date: string; kind?: DutyKind } | null>(null);
  const [mgrSheet, setMgrSheet] = useState<DutyReport | null>(null);
  const sheetDay = sheet ? days.find((d) => d.date === sheet.date) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-body font-black text-foreground">출근 확정 예시</p>
        <p className="mt-0.5 text-label text-muted-foreground">지어낸 근무자예요 — 눌러도 저장되지 않아요 · 지금 시각은 {DEMO_NOW}로 봐요</p>
        <div className="mt-3 flex gap-1.5">
          <OpsChip on={view === "coach"} onClick={() => setView("coach")}>
            코치 화면
          </OpsChip>
          <OpsChip on={view === "manage"} onClick={() => setView("manage")}>
            관리자 화면
          </OpsChip>
        </div>
      </div>
      {view === "coach" && coachQ.data && (
        <>
          <DutyCoachCards staff={me} days={days} data={coachQ.data} today={today} nowHm={DEMO_NOW} onOpenDay={(date, kind) => setSheet({ date, kind })} />
          <DutyMyReports staffId={me.id} data={coachQ.data} actions={coachAct} />
        </>
      )}
      {view === "manage" && mgrQ.data && (
        <>
          <DutySettingRow data={mgrQ.data} actions={mgrAct} />
          <section className={card}>
            <h2 className="text-heading font-black text-foreground">확인할 것</h2>
            <DutyManagerList data={mgrQ.data} actions={mgrAct} hq scheduledOf={() => 180} onOpenDay={(r) => setMgrSheet(r)} />
            {dutyOpen(mgrQ.data.reports).length === 0 && <p className="mt-2 text-label text-muted-foreground">열린 출근 신고가 없어요</p>}
          </section>
        </>
      )}
      <OpsSheet open={!!sheetDay} onClose={() => setSheet(null)} stacked title={sheetDay ? `${me.name} · ${fmtDay(sheetDay.date)}` : ""} sub="18:00~21:00">
        {sheetDay && coachQ.data && (
          <DutyReportForm staff={me} day={sheetDay} data={coachQ.data} actions={coachAct} today={today} nowHm={DEMO_NOW} initialKind={sheet?.kind} onDone={() => setSheet(null)} />
        )}
      </OpsSheet>
      <OpsSheet open={!!mgrSheet} onClose={() => setMgrSheet(null)} stacked title={mgrSheet ? `${mgrSheet.staff_name} · ${fmtDay(mgrSheet.work_date)}` : ""} sub="18:00~21:00">
        {mgrSheet && mgrQ.data && (
          <DutyDecideBox
            reports={mgrQ.data.reports.filter((r) => r.id === mgrSheet.id && r.status === "open")}
            scheduledMin={180}
            actions={mgrAct}
            hq
            onDone={() => setMgrSheet(null)}
          />
        )}
      </OpsSheet>
    </div>
  );
};
