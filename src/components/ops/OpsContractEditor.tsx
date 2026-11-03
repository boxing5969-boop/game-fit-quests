/**
 * 계약서 쓰기 (2026-11-03 대표님 "코치님들 계약서 작성 기능") — 근무자 카드 › 계약서 › 쓰기
 *   ① 채우기 — 근무자 카드 · 시간표 · PT 수당표로 미리 채운 고용노동부 표준 양식 칸 + 특약. 법에서 꼭 적으라는 것 점검(빠지면 못 보냄)
 *   ② 미리 보기 — 보낼 글 그대로 + 대표님 서명 → '서명해서 보내기'(코치님 앱 알림). 보낸 뒤에는 고칠 수 없다(새로 보내면 앞의 것은 무효)
 *   글 만들기 · 점검은 src/lib/opsContract.ts 한 곳.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  WEEK_ORDER,
  autoBreakMin,
  breakShortMin,
  buildContractDoc,
  checkContract,
  contractTitle,
  dayGapMin,
  daySetSegs,
  dayWorkMin,
  daysFromRules,
  defaultFreelanceTerms,
  defaultInsurance,
  defaultLaborTerms,
  defaultWeeklyHoliday,
  employerReady,
  hourlyEquivalent,
  weeklyWorkMin,
  type ContractDay,
  type ContractKind,
  type FreelanceTerms,
  type LaborTerms,
} from "@/lib/opsContract";
import { OPS_WEEKDAY, fmtDuration, fmtWon, minWageOn, type OpsRule, type OpsStaff } from "@/lib/opsWork";
import { useOpsContractSend, type OpsContractListData } from "@/services/opsContractService";
import OpsContractDoc from "./OpsContractDoc";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, kstToday, opsInput } from "./OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  kind: ContractKind | null;
  branch: string;
  staff: OpsStaff;
  rules: OpsRule[];
  data: OpsContractListData;
  onSent: (id: string) => void;
  stacked?: boolean;
}

const BREAKS = [0, 30, 60, 90];
const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const digits = (v: string, max = 9) => {
  const d = v.replace(/\D/g, "").slice(0, max);
  return d ? Number(d) : 0;
};
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const plus = (hm: string, min: number) => {
  const t = Math.min(toMin(hm) + min, 23 * 60 + 50);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const OpsContractEditor = ({ open, onClose, kind, branch, staff, rules, data, onSent, stacked }: Props) => {
  const today = kstToday();
  const send = useOpsContractSend();
  const employer = data.employer;
  const [step, setStep] = useState<"form" | "preview">("form");
  const [labor, setLabor] = useState<LaborTerms | null>(null);
  const [free, setFree] = useState<FreelanceTerms | null>(null);
  const [notify, setNotify] = useState(true);
  const hasRules = rules.some((r) => r.staff_id === staff.id);

  const prefill = useMemo(
    () => ({
      branch,
      staff,
      rules,
      employer,
      today,
      lastLabor: data.last_labor,
      lastFreelance: data.last_freelance,
      ptRates: data.pt_rates,
    }),
    [branch, staff, rules, employer, today, data.last_labor, data.last_freelance, data.pt_rates],
  );

  useEffect(() => {
    if (!open || !kind) return;
    setStep("form");
    setNotify(!!staff.user_id);
    if (kind === "labor") setLabor(defaultLaborTerms(prefill));
    else setFree(defaultFreelanceTerms(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, staff.id]);

  const terms = kind === "labor" ? labor : free;
  const check = useMemo(
    () => (terms ? checkContract(terms, { staffKind: staff.kind, hasRules }) : { errors: [], warns: [] }),
    [terms, staff.kind, hasRules],
  );
  const doc = useMemo(
    () => (terms && employerReady(employer) && check.errors.length === 0 ? buildContractDoc(terms, employer, today) : null),
    [terms, employer, check.errors.length, today],
  );

  const submit = () => {
    if (!terms || !doc) return;
    send.mutate(
      {
        staff_id: staff.id,
        kind: terms.kind,
        title: doc.title,
        start_date: terms.start,
        end_date: terms.end,
        terms,
        doc,
        notify: notify && !!staff.user_id,
      },
      {
        onSuccess: (r) => {
          toast.success(staff.user_id && notify ? `${staff.name}님 앱으로 보냈어요` : "계약서를 만들었어요 — 서명을 받아 주세요");
          onSent(r.id);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const errorBox =
    check.errors.length + check.warns.length > 0 ? (
      <div className="mt-5 space-y-1.5">
        {check.errors.map((m) => (
          <p key={m} className="rounded-xl bg-destructive/10 px-3 py-2 text-label font-bold text-destructive">
            {m}
          </p>
        ))}
        {check.warns.map((m) => (
          <p key={m} className="rounded-xl bg-amber-50 px-3 py-2 text-label text-amber-800">
            {m}
          </p>
        ))}
      </div>
    ) : (
      <p className="mt-5 rounded-xl bg-primary/10 px-3 py-2 text-label font-bold text-primary">
        {kind === "labor" ? "법에서 꼭 적으라는 항목이 모두 들어 있어요" : "빠진 칸이 없어요"}
      </p>
    );

  return (
    <OpsSheet
      open={open && !!kind}
      onClose={onClose}
      title={terms ? contractTitle(terms) : "계약서"}
      sub={`${staff.name} · ${step === "form" ? "채우기" : "미리 보기"}`}
      stacked={stacked}
      footer={
        step === "form" ? (
          <OpsButton onClick={() => setStep("preview")} disabled={!doc}>
            {check.errors.length > 0 ? `고칠 것 ${check.errors.length}개` : "미리 보기"}
          </OpsButton>
        ) : (
          <div className="space-y-2">
            {staff.user_id ? (
              <label className="flex items-center gap-2 text-label text-foreground">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-5 w-5" />
                {staff.name}님 앱으로 알림 보내기 (앱에서 읽고 서명)
              </label>
            ) : (
              <p className="text-label text-muted-foreground">앱 계정이 없는 분이에요 — 보낸 뒤 이 휴대폰으로 직접 서명을 받아요</p>
            )}
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <OpsButton tone="plain" onClick={() => setStep("form")} disabled={send.isPending}>
                고치기
              </OpsButton>
              <OpsButton onClick={submit} disabled={!doc || send.isPending}>
                {send.isPending ? "보내는 중…" : "서명해서 보내기"}
              </OpsButton>
            </div>
          </div>
        )
      }
    >
      {step === "preview" && doc && employerReady(employer) ? (
        <>
          <p className="mb-3 text-label text-muted-foreground">보내면 고칠 수 없어요 — 바꾸려면 새로 보내요(앞의 것은 무효)</p>
          <OpsContractDoc doc={doc} employerSign={employer.sign} />
        </>
      ) : kind === "labor" && labor ? (
        <LaborForm t={labor} set={setLabor} staff={staff} rules={rules} today={today} />
      ) : kind === "freelance" && free ? (
        <FreelanceForm t={free} set={setFree} />
      ) : null}
      {step === "form" && terms && errorBox}
    </OpsSheet>
  );
};

// ───────────────────────── 근로계약서 칸 ─────────────────────────
const LaborForm = ({
  t,
  set,
  staff,
  rules,
  today,
}: {
  t: LaborTerms;
  set: (fn: (t: LaborTerms | null) => LaborTerms | null) => void;
  staff: OpsStaff;
  rules: OpsRule[];
  today: string;
}) => {
  const up = <K extends keyof LaborTerms>(k: K, v: LaborTerms[K]) => set((x) => (x ? { ...x, [k]: v } : x));
  const weekly = weeklyWorkMin(t.days);
  const setDays = (fn: (days: ContractDay[]) => ContractDay[]) =>
    set((x) => {
      if (!x) return x;
      const days = fn(x.days).filter((d) => d.segs.length > 0);
      const wh = x.weeklyHoliday != null && !days.some((d) => d.weekday === x.weeklyHoliday) ? x.weeklyHoliday : defaultWeeklyHoliday(days);
      return { ...x, days, weeklyHoliday: wh };
    });
  const eq = hourlyEquivalent(t);
  const min = minWageOn(t.start || today);

  return (
    <>
      <p className="rounded-xl bg-secondary/70 px-3 py-2.5 text-label text-muted-foreground">
        고용노동부 표준근로계약서 양식이에요 — 근무자 카드 · 시간표로 채웠어요
      </p>

      <OpsLabel>근로자 이름</OpsLabel>
      <input value={t.workerName} onChange={(e) => up("workerName", e.target.value.slice(0, 40))} className={opsInput} />

      <PeriodFields start={t.start} end={t.end} onStart={(v) => up("start", v)} onEnd={(v) => up("end", v)} />

      <OpsLabel>수습기간</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3].map((m) => (
          <OpsChip key={m} on={t.probationMonths === m} onClick={() => up("probationMonths", m)}>
            {m === 0 ? "없음" : `${m}개월`}
          </OpsChip>
        ))}
      </div>
      {t.probationMonths > 0 && <p className="mt-1.5 text-label text-muted-foreground">수습기간에도 임금은 똑같이 적어요</p>}

      <OpsLabel>근무장소</OpsLabel>
      <input value={t.place} onChange={(e) => up("place", e.target.value.slice(0, 160))} className={opsInput} />
      <OpsLabel>업무의 내용</OpsLabel>
      <textarea value={t.duties} onChange={(e) => up("duties", e.target.value.slice(0, 300))} rows={2} className={cn(opsInput, "resize-none")} />

      <div className="mb-1.5 mt-4 flex items-center justify-between">
        <p className="text-label font-bold text-muted-foreground">근로일 · 근로시간</p>
        <button
          type="button"
          onClick={() => {
            const days = daysFromRules(staff.id, rules, t.start > today ? t.start : today);
            set((x) => (x ? { ...x, days, weeklyHoliday: defaultWeeklyHoliday(days), insurance: defaultInsurance(days) } : x));
          }}
          className="flex items-center gap-1 text-label font-bold text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 시간표에서 다시
        </button>
      </div>
      <ul className="space-y-2">
        {WEEK_ORDER.map((wd) => {
          const day = t.days.find((d) => d.weekday === wd);
          return (
            <li key={wd} className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-black text-foreground">{OPS_WEEKDAY[wd]}요일</span>
                <span className="min-w-0 flex-1 truncate text-right text-label text-muted-foreground">
                  {day ? `근로 ${fmtDuration(dayWorkMin(day))}` : "근무 없음"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDays((days) => {
                      const cur = days.find((d) => d.weekday === wd);
                      const lastEnd = cur?.segs.map((s) => s.end).sort().at(-1) ?? "18:00";
                      const seg = { start: lastEnd, end: plus(lastEnd, 120) };
                      if (!cur) return [...days, { weekday: wd, segs: [seg], breakMin: autoBreakMin([seg]) }];
                      return days.map((d) => (d.weekday === wd ? daySetSegs(d, [...d.segs, seg]) : d));
                    })
                  }
                  className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" /> 시간
                </button>
              </div>
              {day && (
                <div className="mt-2 space-y-1.5">
                  {day.segs.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        step={600}
                        value={s.start}
                        aria-label="시업"
                        onChange={(e) =>
                          setDays((days) =>
                            days.map((d) => (d.weekday === wd ? daySetSegs(d, d.segs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x))) : d)),
                          )
                        }
                        className={`${opsInput} py-2`}
                      />
                      <span className="text-body text-muted-foreground">~</span>
                      <input
                        type="time"
                        step={600}
                        value={s.end}
                        aria-label="종업"
                        onChange={(e) =>
                          setDays((days) =>
                            days.map((d) => (d.weekday === wd ? daySetSegs(d, d.segs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x))) : d)),
                          )
                        }
                        className={`${opsInput} py-2`}
                      />
                      <button
                        type="button"
                        aria-label="이 시간 빼기"
                        onClick={() =>
                          setDays((days) => days.map((d) => (d.weekday === wd ? daySetSegs(d, d.segs.filter((_, j) => j !== i)) : d)))
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-label font-bold text-muted-foreground">휴게</span>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set([...BREAKS, day.breakMin])].sort((a, b) => a - b).map((b) => (
                        <OpsChip
                          key={b}
                          on={day.breakMin === b}
                          onClick={() => setDays((days) => days.map((d) => (d.weekday === wd ? { ...d, breakMin: b } : d)))}
                        >
                          {b === 0 ? "없음" : fmtDuration(b)}
                        </OpsChip>
                      ))}
                    </div>
                  </div>
                  {dayGapMin(day) > 0 && <p className="text-label text-muted-foreground">구간 사이 {fmtDuration(dayGapMin(day))}은 이미 휴게예요</p>}
                  {breakShortMin(day) > 0 && (
                    <p className="text-label font-bold text-orange-700">하루 4시간 일하면 30분 · 8시간이면 1시간 이상 쉬어야 해요</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-label text-muted-foreground">
        1주 {fmtDuration(weekly)}
        {weekly >= 15 * 60 ? " · 주휴수당 · 연차 대상" : weekly > 0 ? " · 주 15시간 미만(주휴 · 연차 없음)" : ""}
        {weekly > 0 && weekly < 40 * 60 ? " · 단시간근로자 양식" : ""}
      </p>

      {weekly >= 15 * 60 && (
        <>
          <OpsLabel>주휴일 (쉬는 날 · 유급)</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((wd) => (
              <OpsChip
                key={wd}
                on={t.weeklyHoliday === wd}
                disabled={t.days.some((d) => d.weekday === wd)}
                onClick={() => up("weeklyHoliday", wd)}
              >
                {OPS_WEEKDAY[wd]}
              </OpsChip>
            ))}
          </div>
        </>
      )}

      <OpsLabel>임금</OpsLabel>
      <div className="flex gap-1.5">
        {(["hourly", "monthly"] as const).map((pt) => (
          <OpsChip key={pt} on={t.payType === pt} onClick={() => up("payType", pt)}>
            {pt === "hourly" ? "시간급" : "월급"}
          </OpsChip>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          inputMode="numeric"
          value={t.wage ? String(t.wage) : ""}
          onChange={(e) => up("wage", digits(e.target.value))}
          className={opsInput}
          placeholder={t.payType === "hourly" ? "12000" : "2500000"}
        />
        <span className="shrink-0 text-body text-foreground">원</span>
      </div>
      {t.wage > 0 && (
        <p className={cn("mt-1.5 text-label", eq < min ? "font-bold text-destructive" : "text-muted-foreground")}>
          {t.payType === "monthly" && weekly > 0 ? `시급으로 ${fmtWon(Math.floor(eq))} · ` : ""}그해 최저시급 {fmtWon(min)}
        </p>
      )}

      <OpsLabel>상여금</OpsLabel>
      <div className="flex items-center gap-1.5">
        <OpsChip on={!t.bonus} onClick={() => up("bonus", null)}>
          없음
        </OpsChip>
        <OpsChip on={!!t.bonus} onClick={() => up("bonus", t.bonus || 100000)}>
          있음
        </OpsChip>
        {!!t.bonus && (
          <>
            <input
              inputMode="numeric"
              value={String(t.bonus)}
              onChange={(e) => up("bonus", digits(e.target.value) || null)}
              className={cn(opsInput, "py-2")}
              aria-label="상여금"
            />
            <span className="shrink-0 text-body text-foreground">원</span>
          </>
        )}
      </div>

      <OpsLabel>기타급여 (제수당) — 없으면 비워 두기</OpsLabel>
      <input value={t.extras} onChange={(e) => up("extras", e.target.value.slice(0, 200))} className={opsInput} placeholder="예: 대회 인솔 수당 1회 30,000원" />

      {weekly > 0 && weekly < 40 * 60 && (
        <>
          <OpsLabel>정한 시간을 넘겨 일하면 가산</OpsLabel>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={String(t.overtimeRate)}
              onChange={(e) => up("overtimeRate", Math.min(200, digits(e.target.value, 3)))}
              className={cn(opsInput, "w-24")}
              aria-label="가산임금률"
            />
            <span className="text-body text-foreground">%</span>
            <span className="text-label text-muted-foreground">상시 5인 이상이면 50% 이상</span>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <OpsLabel>임금지급일</OpsLabel>
          <select value={t.payDay} onChange={(e) => up("payDay", Number(e.target.value))} className={opsInput}>
            {PAY_DAYS.map((d) => (
              <option key={d} value={d}>
                매월 {d === 31 ? "말일" : `${d}일`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <OpsLabel>지급방법</OpsLabel>
          <select value={t.payMethod} onChange={(e) => up("payMethod", e.target.value as LaborTerms["payMethod"])} className={opsInput}>
            <option value="account">통장 입금</option>
            <option value="direct">직접 지급</option>
          </select>
        </div>
      </div>

      <OpsLabel>사회보험</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["employment", "고용보험"],
            ["accident", "산재보험"],
            ["pension", "국민연금"],
            ["health", "건강보험"],
          ] as Array<[keyof LaborTerms["insurance"], string]>
        ).map(([k, label]) => (
          <OpsChip key={k} on={t.insurance[k]} onClick={() => up("insurance", { ...t.insurance, [k]: !t.insurance[k] })}>
            {label}
          </OpsChip>
        ))}
      </div>
      <p className="mt-1.5 text-label text-muted-foreground">월 60시간 이상이면 4대보험, 산재보험은 누구나</p>

      <OpsLabel>특약 (대표님이 더 넣을 약속 — 없으면 비워 두기)</OpsLabel>
      <textarea
        value={t.special}
        onChange={(e) => up("special", e.target.value.slice(0, 1500))}
        rows={3}
        className={cn(opsInput, "resize-none")}
        placeholder="예: 수업 준비 · 정리 시간도 근로시간에 넣는다"
      />
    </>
  );
};

// ───────────────────────── 업무위탁 계약서 칸 ─────────────────────────
const FreelanceForm = ({ t, set }: { t: FreelanceTerms; set: (fn: (t: FreelanceTerms | null) => FreelanceTerms | null) => void }) => {
  const up = <K extends keyof FreelanceTerms>(k: K, v: FreelanceTerms[K]) => set((x) => (x ? { ...x, [k]: v } : x));
  const setRate = (i: number, patch: Partial<FreelanceTerms["rates"][number]>) =>
    set((x) => (x ? { ...x, rates: x.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : x));
  return (
    <>
      <p className="rounded-xl bg-secondary/70 px-3 py-2.5 text-label text-muted-foreground">
        수업 시간 · 방법을 코치님이 스스로 정하는 일(예: PT)에만 써요 — 3.3% 원천징수
      </p>

      <OpsLabel>수탁자 이름</OpsLabel>
      <input value={t.workerName} onChange={(e) => up("workerName", e.target.value.slice(0, 40))} className={opsInput} />

      <PeriodFields start={t.start} end={t.end} onStart={(v) => up("start", v)} onEnd={(v) => up("end", v)} />

      <OpsLabel>맡기는 업무</OpsLabel>
      <textarea value={t.duties} onChange={(e) => up("duties", e.target.value.slice(0, 300))} rows={2} className={cn(opsInput, "resize-none")} />
      <OpsLabel>장소</OpsLabel>
      <input value={t.place} onChange={(e) => up("place", e.target.value.slice(0, 160))} className={opsInput} />

      <OpsLabel>수수료</OpsLabel>
      <div className="flex gap-1.5">
        <OpsChip on={t.feeType === "per_session"} onClick={() => up("feeType", "per_session")}>
          수업 1회당
        </OpsChip>
        <OpsChip on={t.feeType === "monthly"} onClick={() => up("feeType", "monthly")}>
          매달 정한 금액
        </OpsChip>
      </div>
      {t.feeType === "per_session" ? (
        <div className="mt-2 space-y-1.5">
          {t.rates.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={r.team}
                onChange={(e) => setRate(i, { team: Number(e.target.value) })}
                className={cn(opsInput, "w-[5.5rem] shrink-0 px-2 py-2")}
                aria-label="정원"
              >
                {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1:1" : `${n}인 팀`}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                value={r.sessions ? String(r.sessions) : ""}
                onChange={(e) => setRate(i, { sessions: digits(e.target.value, 3) })}
                className={cn(opsInput, "w-16 shrink-0 px-2 py-2 text-center")}
                aria-label="회권"
                placeholder="10"
              />
              <span className="shrink-0 text-label text-muted-foreground">회권</span>
              <input
                inputMode="numeric"
                value={r.rate ? String(r.rate) : ""}
                onChange={(e) => setRate(i, { rate: digits(e.target.value, 7) })}
                className={cn(opsInput, "min-w-0 px-2 py-2")}
                aria-label="1회 금액"
                placeholder="1회 금액"
              />
              <button
                type="button"
                aria-label="이 줄 빼기"
                onClick={() => set((x) => (x ? { ...x, rates: x.rates.filter((_, j) => j !== i) } : x))}
                className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set((x) => (x ? { ...x, rates: [...x.rates, { team: 1, sessions: 10, rate: 0 }] } : x))}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> 줄 더하기
          </button>
          <p className="text-label text-muted-foreground">팀은 팀 1회 금액 — 차감된 팀원 1명당 정원으로 나눠 줘요 (PT 수당표와 같은 식)</p>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input
            inputMode="numeric"
            value={t.monthlyFee ? String(t.monthlyFee) : ""}
            onChange={(e) => up("monthlyFee", digits(e.target.value) || null)}
            className={opsInput}
            placeholder="1500000"
          />
          <span className="shrink-0 text-body text-foreground">원</span>
        </div>
      )}

      <OpsLabel>지급일</OpsLabel>
      <select value={t.payDay} onChange={(e) => up("payDay", Number(e.target.value))} className={opsInput}>
        {PAY_DAYS.map((d) => (
          <option key={d} value={d}>
            매월 {d === 31 ? "말일" : `${d}일`}
          </option>
        ))}
      </select>

      <OpsLabel>특약 (없으면 비워 두기)</OpsLabel>
      <textarea
        value={t.special}
        onChange={(e) => up("special", e.target.value.slice(0, 1500))}
        rows={3}
        className={cn(opsInput, "resize-none")}
        placeholder="예: 수업 장비는 위탁자가 준비한다"
      />
    </>
  );
};

const PeriodFields = ({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string | null;
  onStart: (v: string) => void;
  onEnd: (v: string | null) => void;
}) => (
  <>
    <OpsLabel>계약 기간</OpsLabel>
    <div className="flex gap-1.5">
      <OpsChip on={end == null} onClick={() => onEnd(null)}>
        끝나는 날 없음
      </OpsChip>
      <OpsChip on={end != null} onClick={() => onEnd(end ?? oneYearLater(start))}>
        끝나는 날 정함
      </OpsChip>
    </div>
    <div className={cn("mt-2 grid gap-2", end != null ? "grid-cols-2" : "grid-cols-1")}>
      <label className="block">
        <span className="mb-1 block text-label text-muted-foreground">시작</span>
        <input type="date" value={start} onChange={(e) => e.target.value && onStart(e.target.value)} className={opsInput} />
      </label>
      {end != null && (
        <label className="block">
          <span className="mb-1 block text-label text-muted-foreground">끝</span>
          <input type="date" value={end} onChange={(e) => e.target.value && onEnd(e.target.value)} className={opsInput} />
        </label>
      )}
    </div>
  </>
);

/** 시작일 + 1년 − 1일 */
const oneYearLater = (start: string) => {
  const d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return start;
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default OpsContractEditor;
