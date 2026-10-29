/**
 * 153운영본부 · 근무 — 근무자 카드 (지점장 · 대표님 · 회계매니저)
 *   정보(형태 · 시급 · 앱 계정 · 기간 · 출근 확인) · 시간표(요일마다 구간 여러 개, 고른 날부터) · 이번 달(날짜를 누르면 고치기)
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  OPS_KIND_LABEL,
  OPS_WEEKDAY,
  fmtDuration,
  fmtHours,
  fmtWon,
  laborNotices,
  minWageOn,
  type OpsDay,
  type OpsKind,
  type OpsMonthSummary,
  type OpsPayType,
  type OpsRule,
  type OpsStaff,
} from "@/lib/opsWork";
import { useOpsCandidates, useOpsScheduleSave, useOpsStaffSave, type OpsStaffInput } from "@/services/opsService";
import { DayRow, OpsButton, OpsChip, OpsLabel, OpsSheet, fmtDay, kstToday, opsInput } from "./OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  branch: string;
  staff: OpsStaff | null; // null = 새 근무자
  rules: OpsRule[];
  summary: OpsMonthSummary | null;
  onPickDay: (day: OpsDay) => void;
  /** PT 위탁 코치면 PT 탭 내용 (2026-10-29) */
  ptPanel?: ReactNode;
}

type Tab = "info" | "schedule" | "month" | "pt";
const KINDS: OpsKind[] = ["parttime", "intern", "employee", "freelancer", "volunteer"];
/** 월요일부터 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface SegDraft {
  weekday: number;
  start: string;
  end: string;
}

const OpsStaffSheet = ({ open, onClose, branch, staff, rules, summary, onPickDay, ptPanel }: Props) => {
  const isNew = !staff;
  const today = kstToday();
  const [tab, setTab] = useState<Tab>("info");
  const saveStaff = useOpsStaffSave();
  const saveSchedule = useOpsScheduleSave();
  const candidatesQ = useOpsCandidates(branch, open);

  // 정보
  const [form, setForm] = useState<OpsStaffInput>(() => blank(branch));
  // 시간표
  const [segs, setSegs] = useState<SegDraft[]>([]);
  const [from, setFrom] = useState(today);

  useEffect(() => {
    if (!open) return;
    setTab(staff ? "month" : "info");
    setForm(
      staff
        ? {
            id: staff.id,
            branch,
            user_id: staff.user_id,
            name: staff.name,
            kind: staff.kind,
            pay_type: staff.pay_type,
            hourly_wage: staff.hourly_wage,
            monthly_salary: staff.monthly_salary,
            pt_freelancer: staff.pt_freelancer,
            checkin_required: staff.checkin_required,
            start_date: staff.start_date,
            end_date: staff.end_date,
            active: staff.active,
            note: staff.note ?? null,
          }
        : blank(branch),
    );
    setSegs(
      staff
        ? rules
            .filter((r) => r.staff_id === staff.id && r.valid_from <= today && (!r.valid_to || r.valid_to >= today))
            .map((r) => ({ weekday: r.weekday, start: r.start_time, end: r.end_time }))
        : [],
    );
    setFrom(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id]);

  const weeklyMin = useMemo(
    () => segs.reduce((s, x) => s + Math.max(0, toMin(x.end) - toMin(x.start)), 0),
    [segs],
  );
  const notices = staff ? laborNotices({ ...staff, kind: form.kind }, weeklyMin, summary?.creditedMin ?? 0) : [];
  const set = <K extends keyof OpsStaffInput>(k: K, v: OpsStaffInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const minWage2027 = minWageOn("2027-01-01");

  const submitInfo = () => {
    if (!form.name.trim()) return toast.error("이름을 넣어 주세요");
    saveStaff.mutate(form, {
      onSuccess: () => {
        toast.success(isNew ? "근무자를 추가했어요 — 시간표를 넣어 주세요" : "저장했어요");
        if (isNew) onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const submitSchedule = () => {
    if (!staff) return;
    const bad = segs.find((s) => toMin(s.end) <= toMin(s.start));
    if (bad) return toast.error(`${OPS_WEEKDAY[bad.weekday]}요일 끝나는 시각이 시작보다 늦어야 해요`);
    saveSchedule.mutate(
      { staffId: staff.id, rules: segs, from },
      {
        onSuccess: () => toast.success(`${fmtDay(from)}부터 새 시간표예요`),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const worked = (summary?.days ?? []).filter((d) => d.status !== "none");

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title={isNew ? "근무자 추가" : staff!.name}
      sub={isNew ? undefined : `${OPS_KIND_LABEL[staff!.kind]}${staff!.pay_type === "hourly" && staff!.hourly_wage ? ` · 시급 ${fmtWon(staff!.hourly_wage)}` : ""}`}
    >
      {!isNew && (
        <div role="tablist" className={cn("mb-4 grid gap-1 rounded-xl bg-secondary/70 p-1", ptPanel ? "grid-cols-4" : "grid-cols-3")}>
          {(
            [
              { v: "month", label: "이번 달" },
              ...(ptPanel ? [{ v: "pt", label: "PT" }] : []),
              { v: "schedule", label: "시간표" },
              { v: "info", label: "정보" },
            ] as Array<{ v: Tab; label: string }>
          ).map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={tab === t.v}
              onClick={() => setTab(t.v)}
              className={cn(
                "h-10 rounded-lg text-label font-black transition-all",
                tab === t.v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "pt" && ptPanel}

      {tab === "month" && summary && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-label text-muted-foreground">인정 시간</p>
              <p className="mt-0.5 text-title font-black tabular-nums text-foreground">{fmtHours(summary.creditedMin)}시간</p>
              <p className="text-label text-muted-foreground">근무 {summary.workDays}일</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-label text-muted-foreground">기본급</p>
              <p className="mt-1.5 whitespace-nowrap text-heading font-black tabular-nums text-foreground">
                {summary.basePay == null ? "—" : fmtWon(summary.basePay)}
              </p>
              <p className="text-label text-muted-foreground">주휴 · 공제 전</p>
            </div>
          </div>
          {notices.length > 0 && (
            <ul className="mt-2 space-y-1">
              {notices.map((n) => (
                <li key={n} className="rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
                  {n}
                </li>
              ))}
            </ul>
          )}
          <OpsLabel>날짜를 누르면 고칠 수 있어요</OpsLabel>
          {worked.length === 0 ? (
            <p className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">
              이번 달 근무 기록이 없어요 — 시간표를 먼저 넣어 주세요
            </p>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
              {worked.map((d) => (
                <DayRow key={d.date} day={d} onClick={() => onPickDay(d)} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "schedule" && staff && (
        <>
          <p className="text-label text-muted-foreground">
            정해진 시간으로 인정해요 — 출근은 얼굴 인식, 퇴근은 끝 시각에 자동
          </p>
          <ul className="mt-3 space-y-2">
            {WEEK_ORDER.map((wd) => {
              const mine = segs.map((s, i) => ({ s, i })).filter((x) => x.s.weekday === wd);
              return (
                <li key={wd} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-black text-foreground">{OPS_WEEKDAY[wd]}요일</span>
                    <button
                      type="button"
                      onClick={() => setSegs((list) => [...list, { weekday: wd, start: lastEnd(list, wd) ?? "18:00", end: plus2(lastEnd(list, wd) ?? "18:00") }])}
                      className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" /> 시간
                    </button>
                  </div>
                  {mine.length === 0 ? (
                    <p className="mt-1 text-label text-muted-foreground">근무 없음</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {mine.map(({ s, i }) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="time"
                            step={600}
                            value={s.start}
                            onChange={(e) => setSegs((list) => list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                            className={`${opsInput} py-2`}
                            aria-label="시작"
                          />
                          <span className="text-body text-muted-foreground">~</span>
                          <input
                            type="time"
                            step={600}
                            value={s.end}
                            onChange={(e) => setSegs((list) => list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                            className={`${opsInput} py-2`}
                            aria-label="끝"
                          />
                          <button
                            type="button"
                            onClick={() => setSegs((list) => list.filter((_, j) => j !== i))}
                            aria-label="이 시간 빼기"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <OpsLabel>언제부터</OpsLabel>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={opsInput} />
          <p className="mt-2 text-label text-muted-foreground">
            한 주 {fmtDuration(weeklyMin)}
            {weeklyMin >= 15 * 60 && form.kind !== "freelancer" && form.kind !== "volunteer" ? " · 주휴수당 대상" : ""}
          </p>
          <div className="mt-4">
            <OpsButton disabled={saveSchedule.isPending} onClick={submitSchedule}>
              시간표 저장
            </OpsButton>
          </div>
        </>
      )}

      {tab === "info" && (
        <>
          <OpsLabel>이름</OpsLabel>
          <input value={form.name} onChange={(e) => set("name", e.target.value.slice(0, 40))} className={opsInput} placeholder="코치님 이름" />

          <OpsLabel>앱 계정 (얼굴 출근을 이 사람에게 맞춰요)</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={!form.user_id} onClick={() => set("user_id", null)}>없음 · 이름으로</OpsChip>
            {(candidatesQ.data ?? [])
              .filter((c) => !c.linked || c.user_id === form.user_id)
              .map((c) => (
                <OpsChip key={c.user_id} on={form.user_id === c.user_id} onClick={() => set("user_id", c.user_id)}>
                  {c.name}
                </OpsChip>
              ))}
          </div>

          <OpsLabel>형태</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <OpsChip
                key={k}
                on={form.kind === k}
                onClick={() => setForm((f) => ({ ...f, kind: k, pay_type: k === "volunteer" ? "none" : f.pay_type === "none" ? "hourly" : f.pay_type }))}
              >
                {OPS_KIND_LABEL[k]}
              </OpsChip>
            ))}
          </div>
          {form.kind === "intern" && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label text-amber-800">
              수습도 첫 출근일부터 근로자예요 — 근로계약서는 첫날 주세요
            </p>
          )}
          {form.kind === "volunteer" && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label text-amber-800">
              시간을 정해 일을 맡기면 임금을 줘야 하는 일로 볼 수 있어요
            </p>
          )}

          {form.kind !== "volunteer" && (
            <>
              <OpsLabel>급여 방식</OpsLabel>
              <div className="flex gap-1.5">
                {(["hourly", "monthly"] as OpsPayType[]).map((p) => (
                  <OpsChip key={p} on={form.pay_type === p} onClick={() => set("pay_type", p)}>
                    {p === "hourly" ? "시급" : "월급"}
                  </OpsChip>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={(form.pay_type === "hourly" ? form.hourly_wage : form.monthly_salary) ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                    set(form.pay_type === "hourly" ? "hourly_wage" : "monthly_salary", v ? Number(v) : null);
                  }}
                  className={opsInput}
                  placeholder={form.pay_type === "hourly" ? "15000" : "2500000"}
                />
                <span className="shrink-0 text-body text-foreground">원</span>
              </div>
              {form.pay_type === "hourly" && (form.hourly_wage ?? 0) > 0 && (form.hourly_wage ?? 0) < minWage2027 && (
                <p className="mt-1.5 text-label font-bold text-orange-700">
                  2027년 1월부터 최저시급은 {fmtWon(minWage2027)}이에요
                </p>
              )}
              <label className="mt-3 flex items-center gap-2 text-body text-foreground">
                <input type="checkbox" checked={form.pt_freelancer} onChange={(e) => set("pt_freelancer", e.target.checked)} className="h-5 w-5" />
                PT는 프리랜서(3.3%)로 따로 해요
              </label>
            </>
          )}

          <OpsLabel>출근 확인</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={form.checkin_required} onClick={() => set("checkin_required", true)}>입구 얼굴 인식 필수</OpsChip>
            <OpsChip on={!form.checkin_required} onClick={() => set("checkin_required", false)}>시간표대로 자동</OpsChip>
          </div>

          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <OpsLabel>첫 근무일</OpsLabel>
              <input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} className={opsInput} />
            </div>
            <div>
              <OpsLabel>마지막 근무일</OpsLabel>
              <input type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} className={opsInput} />
            </div>
          </div>

          <OpsLabel>메모 (관리자만)</OpsLabel>
          <input value={form.note ?? ""} onChange={(e) => set("note", e.target.value.slice(0, 300))} className={opsInput} placeholder="예: 군 복무 중 · 12월 복귀" />

          {!isNew && (
            <label className="mt-3 flex items-center gap-2 text-body text-foreground">
              <input type="checkbox" checked={!form.active} onChange={(e) => set("active", !e.target.checked)} className="h-5 w-5" />
              지금 근무 안 함 (군 복무 · 휴직 · 퇴사 — 사유는 메모 맨 앞에)
            </label>
          )}

          <div className="mt-5">
            <OpsButton disabled={saveStaff.isPending} onClick={submitInfo}>
              {isNew ? "근무자 추가" : "저장"}
            </OpsButton>
          </div>
        </>
      )}
    </OpsSheet>
  );
};

const blank = (branch: string): OpsStaffInput => ({
  branch,
  user_id: null,
  name: "",
  kind: "parttime",
  pay_type: "hourly",
  hourly_wage: 15000,
  monthly_salary: null,
  pt_freelancer: false,
  checkin_required: true,
  start_date: null,
  end_date: null,
  active: true,
  note: null,
});

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const plus2 = (hm: string) => {
  const t = Math.min(toMin(hm) + 120, 23 * 60 + 50);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const lastEnd = (list: SegDraft[], wd: number) => list.filter((s) => s.weekday === wd).map((s) => s.end).sort().at(-1);

export default OpsStaffSheet;
