/**
 * 153운영본부 · 「근무」 탭 (2026-10-29 대표님 · 보고서 「153운영본부 — 코치 계약 · 근태 · 급여 자동화」 1단계)
 *
 *   관리(대표님 · 지정된 지점장 · 회계매니저 — 서버 _ops_can_manage):
 *     지점 · 달 고르기 → 이번 달 인정 시간 합계(주인공) · 기본급 합계 → 확인할 것(연장 · 대타 승인, 출근 기록 없는 날, 시간표 밖 출근)
 *     → 근무자 목록(누르면 근무자 카드: 이번 달 · 시간표 · 정보) · 근무자 추가
 *   돈(시급 · 월급 · 기본급 · PT 수당)은 대표님 · 회계매니저만(서버 _ops_can_see_pay → data.pay) — 지점장은 근무 관리만 하고
 *     다른 사람 돈은 못 본다. 누구든 본인 카드 금액은 본다 (2026-10-29 대표님 "다른 코치님들 일하는 시간이랑 버는 돈 못 보게").
 *   코치님(내 근무자 카드가 있는 분 — 서버가 본인 카드만 보낸다):
 *     이번 달 내 근무 시간 · 내 예상 금액(공제 전) · 얼굴 출근 안내 · 내 시간표 · (PT 위탁 코치) 내 PT 회원 · 내 PT 수당
 *     · 날짜별(누르면 수업 대타 요청 · 연장 근무 신청) · 내 요청
 *   PT (2026-10-29): 브로제이 PT 차감 → 코치별 이번 달 PT · 회원별 남은 횟수 · 수당 — OpsPtPanel · src/lib/opsPt.ts
 *   계산은 src/lib/opsWork.ts 한 곳 — 서버는 자료만.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  OPS_KIND_LABEL,
  computeStaffMonth,
  fmtDuration,
  fmtHours,
  fmtWon,
  scheduleSummary,
  type OpsDay,
  type OpsEntry,
  type OpsMonthSummary,
  type OpsStaff,
} from "@/lib/opsWork";
import {
  readOpsBranch,
  saveOpsBranch,
  shortBranch,
  useOpsEntryCancel,
  useOpsEntryDecide,
  useOpsMonth,
  useOpsPtMonth,
  type OpsMe,
  type OpsMonthData,
} from "@/services/opsService";
import { computePtMonth, type OpsPtSummary } from "@/lib/opsPt";
import OpsDaySheet from "./OpsDaySheet";
import OpsPtPanel, { PtCheckItem } from "./OpsPtPanel";
import OpsStaffSheet from "./OpsStaffSheet";
import { DayRow, MonthSwitcher, OpsChip, StatusPill, fmtDay, kstToday, monthOf } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

const ENTRY_TITLE: Record<OpsEntry["kind"], string> = { adjust: "시간 고침", off: "쉰 날", overtime: "연장 근무", cover: "수업 대타" };
const ENTRY_STATUS: Record<OpsEntry["status"], { label: string; cls: string }> = {
  pending: { label: "승인 대기", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "반영", cls: "bg-primary/10 text-primary" },
  rejected: { label: "반려", cls: "bg-destructive/10 text-destructive" },
  canceled: { label: "취소", cls: "bg-muted text-muted-foreground" },
};

/** 대타 이름을 찾으려면 동료도 넣는다(코치님 화면에는 내 카드만 온다) */
const buildStaffById = (data: OpsMonthData) => {
  const m = new Map<string, OpsStaff>();
  for (const c of data.colleagues)
    m.set(c.id, {
      id: c.id,
      user_id: null,
      name: c.name,
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
  for (const s of data.staff) m.set(s.id, s);
  return m;
};

const entryLine = (e: OpsEntry, byId: Map<string, OpsStaff>) => {
  const who = byId.get(e.staff_id)?.name ?? "";
  if (e.kind === "cover") return `${who} → ${byId.get(e.cover_staff_id ?? "")?.name ?? "동료"} · ${e.start_time}~${e.end_time}`;
  if (e.kind === "overtime") return `${who} · ${fmtDuration(e.minutes ?? 0)} 더${e.reason ? ` · ${e.reason}` : ""}`;
  if (e.kind === "adjust") return `${who} · ${fmtDuration(e.minutes ?? 0)} 인정`;
  return who;
};

const OpsWorkTab = ({ me }: { me: OpsMe }) => {
  const today = kstToday();
  const branches = useMemo(() => [...new Set([...me.manage, ...me.mine.map((m) => m.branch)])], [me]);
  const [branch, setBranchState] = useState<string | null>(() => {
    const saved = readOpsBranch();
    return saved && branches.includes(saved) ? saved : branches[0] ?? null;
  });
  useEffect(() => {
    if (!branch || !branches.includes(branch)) setBranchState(branches[0] ?? null);
  }, [branch, branches]);
  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
  };
  const [month, setMonth] = useState(() => monthOf(today));
  const q = useOpsMonth(branch, month);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {branches.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {branches.map((b) => (
              <OpsChip key={b} on={b === branch} onClick={() => setBranch(b)}>
                {shortBranch(b)}
              </OpsChip>
            ))}
          </div>
        ) : (
          <p className="text-body font-black text-foreground">{branch ? shortBranch(branch) : ""}</p>
        )}
        <MonthSwitcher month={month} onChange={setMonth} max={monthOf(today)} />
      </div>

      {q.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-32 animate-pulse rounded-2xl bg-card" />
          <div className="h-48 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : !q.data ? (
        <div className={cn(card, "text-center")}>
          <p className="text-body font-bold text-foreground">근무 자료를 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : q.data.manage ? (
        <ManagerView data={q.data} />
      ) : (
        <CoachView data={q.data} />
      )}
    </div>
  );
};

// ───────────────────────── 관리 (대표님 · 지점장 · 회계매니저) ─────────────────────────
const ManagerView = ({ data }: { data: OpsMonthData }) => {
  const decide = useOpsEntryDecide();
  const byId = useMemo(() => buildStaffById(data), [data]);
  const ctx = useMemo(
    () => ({ rules: data.rules, entries: data.entries, checkins: data.checkins, staffById: byId, today: data.today, nowHm: data.now_hm }),
    [data, byId],
  );
  const months = useMemo(() => {
    const m = new Map<string, OpsMonthSummary>();
    for (const s of data.staff) m.set(s.id, computeStaffMonth(s, data.month, ctx));
    return m;
  }, [data, ctx]);

  const [staffSheet, setStaffSheet] = useState<{ staff: OpsStaff | null } | null>(null);
  const [daySheet, setDaySheet] = useState<{ staffId: string; date: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  // PT — 브로제이 차감 기록 → 코치별 수당 (2026-10-29). PT 위탁 코치가 있는 지점만 읽는다
  const ptCoaches = data.staff.filter((s) => s.pt_freelancer);
  const ptQ = useOpsPtMonth(data.branch, data.month, ptCoaches.length > 0);
  const pt = ptQ.data;
  // 돈 = 대표님 · 회계매니저(data.pay). 예전 서버(pay 없음)는 관리자 = 돈
  const canPay = data.pay ?? data.manage;
  const ptPay = !!pt && (pt.pay ?? pt.manage) && canPay;
  const ptByCoach = useMemo(() => {
    const m = new Map<string, OpsPtSummary>();
    if (!pt) return m;
    for (const c of ptCoaches) m.set(c.id, computePtMonth(pt.events, pt.members, ptPay ? pt.rates : null, c.id));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pt, data.staff, ptPay]);
  const ptGross = [...ptByCoach.values()].reduce((s, x) => s + (x.gross ?? 0), 0);
  const ptToCheck = pt ? pt.events.filter((e) => e.status === "check") : [];

  const active = data.staff.filter((s) => s.active);
  const gone = data.staff.filter((s) => !s.active);
  const totalMin = active.reduce((s, x) => s + (months.get(x.id)?.creditedMin ?? 0), 0);
  const totalPay = active.reduce((s, x) => s + (months.get(x.id)?.basePay ?? 0), 0);
  const ref = data.today.slice(0, 7) === data.month.slice(0, 7) ? data.today : data.month;

  // 확인할 것 — 승인 대기 · 출근 기록 없는 날 · 시간표 밖 출근
  const pending = data.entries.filter((e) => e.status === "pending");
  const flags: Array<{ staff: OpsStaff; day: OpsDay }> = [];
  for (const s of data.staff) {
    for (const d of months.get(s.id)?.days ?? []) if (d.status === "missing" || d.status === "extra") flags.push({ staff: s, day: d });
  }
  flags.sort((a, b) => b.day.date.localeCompare(a.day.date));
  const shownFlags = showAll ? flags : flags.slice(0, 5);

  const openStaff = data.staff.find((s) => s.id === staffSheet?.staff?.id) ?? null;
  const dayStaff = daySheet ? data.staff.find((s) => s.id === daySheet.staffId) ?? null : null;
  const dayObj = daySheet && dayStaff ? months.get(dayStaff.id)?.days.find((d) => d.date === daySheet.date) ?? null : null;

  const run = (id: string, approve: boolean) =>
    decide.mutate(
      { id, approve },
      {
        onSuccess: () => toast.success(approve ? "승인했어요" : "반려했어요"),
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <>
      {/* 주인공 — 이번 달 인정 시간 합계 */}
      <section className={card}>
        <p className="text-label font-bold text-muted-foreground">{Number(data.month.slice(5, 7))}월 인정 시간 합계</p>
        <p className="mt-1 text-display font-black tabular-nums leading-none text-foreground">
          {fmtHours(totalMin)}
          <span className="ml-1 text-heading">시간</span>
        </p>
        {canPay ? (
          <>
            <p className="mt-3 text-body font-bold tabular-nums text-foreground">기본급 {fmtWon(totalPay)}</p>
            <p className="text-label text-muted-foreground">근무자 {active.length}명 · 주휴수당 · 공제 전</p>
          </>
        ) : (
          <p className="mt-3 text-label text-muted-foreground">근무자 {active.length}명 · 시급 · 급여는 대표님만 봐요</p>
        )}
        {canPay && ptGross > 0 && (
          <p className="mt-2 text-body font-bold tabular-nums text-foreground">
            PT 수당 {fmtWon(ptGross)} <span className="text-label font-normal text-muted-foreground">· 3.3% 전</span>
          </p>
        )}
      </section>

      {/* 확인할 것 */}
      {(pending.length > 0 || flags.length > 0 || ptToCheck.length > 0) && (
        <section className={card}>
          <h2 className="text-heading font-black text-foreground">확인할 것</h2>
          {ptToCheck.length > 0 && (
            <ul className="mt-3 space-y-2">
              {ptToCheck.map((e) => (
                <PtCheckItem key={e.id} e={e} />
              ))}
            </ul>
          )}
          {pending.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pending.map((e) => {
                const canDecide = e.kind === "cover" || data.hq;
                return (
                  <li key={e.id} className="rounded-xl bg-amber-50 p-3">
                    <p className="text-label font-bold text-amber-800">
                      {ENTRY_TITLE[e.kind]} · {fmtDay(e.work_date)}
                    </p>
                    <p className="mt-0.5 text-body text-foreground">{entryLine(e, byId)}</p>
                    {canDecide ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => run(e.id, false)}
                          className="h-10 rounded-xl border border-border bg-background text-label font-black text-foreground active:scale-[0.98] disabled:opacity-50"
                        >
                          반려
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => run(e.id, true)}
                          className="h-10 rounded-xl bg-primary text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                        >
                          승인
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-label text-muted-foreground">대표님 승인을 기다려요</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {flags.length > 0 && (
            <>
              <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
                {shownFlags.map(({ staff, day }) => (
                  <li key={`${staff.id}${day.date}`}>
                    <button
                      type="button"
                      onClick={() => setDaySheet({ staffId: staff.id, date: day.date })}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-secondary/60"
                    >
                      <span className="min-w-0 flex-1 truncate text-body text-foreground">
                        <b className="font-black">{staff.name}</b> · {fmtDay(day.date)}
                      </span>
                      <StatusPill status={day.status} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              {flags.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 w-full text-center text-label font-bold text-muted-foreground"
                >
                  {showAll ? "접기" : `${flags.length - 5}개 더 보기`}
                </button>
              )}
              <p className="mt-2 text-label text-muted-foreground">출근 기록이 없는 날은 0시간이에요 — 일했다면 눌러서 고쳐 주세요</p>
            </>
          )}
        </section>
      )}

      {/* 근무자 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-heading font-black text-foreground">근무자</h2>
          <button
            type="button"
            onClick={() => setStaffSheet({ staff: null })}
            className="flex h-9 items-center gap-1 rounded-full bg-foreground px-3 text-label font-black text-background active:scale-95"
          >
            <Plus className="h-4 w-4" /> 추가
          </button>
        </div>
        {active.length === 0 ? (
          <p className="px-5 pb-5 text-body text-muted-foreground">근무자를 추가하고 요일마다 시간표를 넣어 주세요</p>
        ) : (
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {active.map((s) => {
              const m = months.get(s.id);
              const sched = scheduleSummary(s, data.rules, ref);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStaffSheet({ staff: s })}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-secondary/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-body font-black text-foreground">{s.name}</span>
                        <span className="truncate rounded-full bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">
                          {OPS_KIND_LABEL[s.kind]}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-label text-muted-foreground">
                        {(m?.missing ?? 0) > 0 && <span className="font-bold text-destructive">출근 없음 {m!.missing}일 · </span>}
                        {sched || "시간표를 넣어 주세요"}
                      </p>
                      {s.pt_freelancer && ptByCoach.get(s.id) && (
                        <p className="mt-0.5 text-label font-bold tabular-nums text-primary">
                          PT {ptByCoach.get(s.id)!.uses}회
                          {ptByCoach.get(s.id)!.gross != null ? ` · ${fmtWon(ptByCoach.get(s.id)!.gross ?? 0)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-body font-black tabular-nums text-foreground">{fmtHours(m?.creditedMin ?? 0)}시간</p>
                      {/* 금액 — 돈을 보는 분이거나 본인 카드만 (지점장은 남의 시급을 받지 않아 basePay 가 비어 있다) */}
                      {(canPay || m?.basePay != null) && (
                        <p className="text-label tabular-nums text-muted-foreground">
                          {m?.basePay == null ? "—" : s.pay_type === "none" ? "무급" : fmtWon(m.basePay)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {gone.length > 0 && (
          <details className="border-t border-border/70">
            <summary className="cursor-pointer px-5 py-3 text-label font-bold text-muted-foreground">지금 근무 안 함 {gone.length}명</summary>
            <ul className="divide-y divide-border/70">
              {gone.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStaffSheet({ staff: s })}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-secondary/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-bold text-foreground">{s.name}</p>
                      {/* 사유(군 복무 · 휴직 · 퇴사)는 메모 첫머리 — '그만둠'으로 단정하지 않는다 (2026-10-29 대표님) */}
                      {s.note && <p className="truncate text-label text-muted-foreground">{s.note}</p>}
                    </div>
                    <span className="shrink-0 text-label tabular-nums text-muted-foreground">{fmtHours(months.get(s.id)?.creditedMin ?? 0)}시간</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <OpsStaffSheet
        open={!!staffSheet}
        onClose={() => setStaffSheet(null)}
        branch={data.branch}
        staff={openStaff}
        rules={data.rules}
        summary={openStaff ? months.get(openStaff.id) ?? null : null}
        canPay={canPay}
        onPickDay={(d) => openStaff && setDaySheet({ staffId: openStaff.id, date: d.date })}
        ptPanel={
          openStaff?.pt_freelancer && pt && ptByCoach.get(openStaff.id) ? (
            <OpsPtPanel
              summary={ptByCoach.get(openStaff.id)!}
              events={pt.events.filter((e) => e.coach_staff_id === openStaff.id)}
              manage
              showPay={ptPay}
            />
          ) : undefined
        }
      />
      <OpsDaySheet
        open={!!dayObj}
        onClose={() => setDaySheet(null)}
        staff={dayStaff}
        day={dayObj}
        hq={data.hq}
        manage
        colleagues={data.colleagues}
        staffById={byId}
        entries={data.entries}
      />
    </>
  );
};

// ───────────────────────── 코치님 (내 근무) ─────────────────────────
const CoachView = ({ data }: { data: OpsMonthData }) => {
  const cancel = useOpsEntryCancel();
  const byId = useMemo(() => buildStaffById(data), [data]);
  const mine = data.staff.find((s) => s.mine) ?? data.staff[0] ?? null;
  const ctx = useMemo(
    () => ({ rules: data.rules, entries: data.entries, checkins: data.checkins, staffById: byId, today: data.today, nowHm: data.now_hm }),
    [data, byId],
  );
  const month = useMemo(() => (mine ? computeStaffMonth(mine, data.month, ctx) : null), [mine, data.month, ctx]);
  const [pick, setPick] = useState<string | null>(null);
  // PT 위탁 코치 — 내 PT 회원 · 이번 달 차감 · 내 PT 수당(서버가 본인에게 수당표를 보낼 때만)
  const ptQ = useOpsPtMonth(data.branch, data.month, !!mine?.pt_freelancer);
  const ptPay = !!ptQ.data?.pay && (ptQ.data?.rates.length ?? 0) > 0;
  const ptSummary = useMemo(
    () => (ptQ.data && mine ? computePtMonth(ptQ.data.events, ptQ.data.members, ptPay ? ptQ.data.rates : null, mine.id) : null),
    [ptQ.data, mine, ptPay],
  );

  if (!mine || !month) {
    return (
      <div className={cn(card, "text-center")}>
        <p className="text-body font-bold text-foreground">아직 내 근무 카드가 없어요</p>
        <p className="mt-1 text-label text-muted-foreground">지점장님이 근무자로 넣어 주면 여기에서 근무 시간을 볼 수 있어요</p>
      </div>
    );
  }

  const ref = data.today.slice(0, 7) === data.month.slice(0, 7) ? data.today : data.month;
  const sched = scheduleSummary(mine, data.rules, ref);
  const days = month.days.filter((d) => d.status !== "none" || d.creditedMin > 0);
  const myRequests = data.entries.filter((e) => e.requested_by_me && (e.kind === "overtime" || e.kind === "cover"));
  const dayObj = pick ? month.days.find((d) => d.date === pick) ?? null : null;

  return (
    <>
      {/* 주인공 — 이번 달 내 근무 */}
      <section className={card}>
        <p className="text-label font-bold text-muted-foreground">{Number(data.month.slice(5, 7))}월 내 근무</p>
        <p className="mt-1 text-display font-black tabular-nums leading-none text-foreground">
          {fmtHours(month.creditedMin)}
          <span className="ml-1 text-heading">시간</span>
        </p>
        <p className="mt-2 text-label text-muted-foreground">
          근무 {month.workDays}일{month.overtimeMin > 0 ? ` · 연장 ${fmtDuration(month.overtimeMin)}` : ""}
          {month.pending > 0 ? ` · 승인 대기 ${month.pending}` : ""}
        </p>
        {/* 내 금액 — 본인 카드의 시급 · 월급만 서버가 보낸다 (2026-10-29 대표님 "본인 금액도 보여주기") */}
        {month.basePay != null && mine.pay_type !== "none" && (
          <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2.5">
            <p className="text-body font-black tabular-nums text-foreground">
              {mine.pay_type === "monthly" ? "월급" : "이번 달 예상"} {fmtWon(month.basePay)}
            </p>
            <p className="text-label text-muted-foreground">
              {mine.pay_type === "hourly" && mine.hourly_wage ? `시급 ${fmtWon(mine.hourly_wage)} × 인정 시간 · ` : ""}
              주휴 · 공제 전 · 확정은 월 마감 때
            </p>
          </div>
        )}
      </section>

      {mine.checkin_required && (
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            month.missing > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <p className="text-body font-black">
            {month.missing > 0 ? `출근 기록이 없는 날 ${month.missing}일` : "출근할 때 입구 얼굴 인식을 꼭 찍어 주세요"}
          </p>
          <p className="mt-0.5 text-label">
            {month.missing > 0 ? "안 찍은 날은 0시간이에요 — 일했다면 지점장님께 말씀해 주세요" : "안 찍은 날은 0시간 · 퇴근은 시간표대로 자동이에요"}
          </p>
        </div>
      )}

      <section className={card}>
        <h2 className="text-heading font-black text-foreground">내 시간표</h2>
        <p className="mt-1 text-body text-foreground">{sched || "아직 시간표가 없어요 — 지점장님이 넣어 줘요"}</p>
      </section>

      {ptSummary && ptQ.data && (
        <section className={card}>
          <h2 className="mb-3 text-heading font-black text-foreground">PT</h2>
          <OpsPtPanel summary={ptSummary} events={ptQ.data.events.filter((e) => e.coach_staff_id === mine.id)} manage={false} showPay={ptPay} />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="px-5 pb-2 pt-5">
          <h2 className="text-heading font-black text-foreground">날짜별 근무</h2>
          <p className="mt-0.5 text-label text-muted-foreground">날짜를 누르면 수업 대타 · 연장 근무를 신청해요</p>
        </div>
        {days.length === 0 ? (
          <p className="px-5 pb-5 text-body text-muted-foreground">이번 달 근무가 없어요</p>
        ) : (
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {days.map((d) => (
              <DayRow key={d.date} day={d} onClick={() => setPick(d.date)} />
            ))}
          </ul>
        )}
      </section>

      {myRequests.length > 0 && (
        <section className={card}>
          <h2 className="text-heading font-black text-foreground">내 요청</h2>
          <ul className="mt-3 space-y-2">
            {myRequests.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-foreground">
                    {e.kind === "overtime"
                      ? `연장 근무 ${fmtDuration(e.minutes ?? 0)}`
                      : `수업 대타 → ${byId.get(e.cover_staff_id ?? "")?.name ?? "동료"}`}
                  </p>
                  <p className="truncate text-label text-muted-foreground">
                    {fmtDay(e.work_date)}
                    {e.kind === "cover" ? ` · ${e.start_time}~${e.end_time}` : ""}
                    {e.decide_note || e.reason ? ` · ${e.decide_note || e.reason}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", ENTRY_STATUS[e.status].cls)}>
                  {ENTRY_STATUS[e.status].label}
                </span>
                {e.status === "pending" && (
                  <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(e.id, {
                        onSuccess: () => toast.success("요청을 취소했어요"),
                        onError: (err) => toast.error((err as Error).message),
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
        </section>
      )}

      <OpsDaySheet
        open={!!dayObj}
        onClose={() => setPick(null)}
        staff={mine}
        day={dayObj}
        hq={data.hq}
        manage={false}
        colleagues={data.colleagues}
        staffById={byId}
        entries={data.entries}
      />
    </>
  );
};

export default OpsWorkTab;
