/**
 * 153운영본부 · 근무 — 하루 (관리: 지점장 · 대표님 · 회계매니저 / 코치님: 내 근무)
 *   대표님 규칙: 일찍 감 · 늦게 옴은 그날 인정 시간을 고친다 · 쉰 날 · 수업 대타 지정 · 연장 근무(대표님은 바로, 그 밖은 대표님 승인)
 *   코치님(manage=false)은 수업 대타 요청(지점장님 승인) · 연장 근무 신청(대표님 승인)만, 내가 낸 대기 중 요청만 되돌린다.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { fmtDuration, hmToMin, type OpsDay, type OpsEntry, type OpsStaff } from "@/lib/opsWork";
import { useOpsEntryCancel, useOpsEntrySave } from "@/services/opsService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, StatusPill, fmtDay, opsInput } from "./OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  staff: OpsStaff | null;
  day: OpsDay | null;
  hq: boolean;
  /** 지점장 · 대표님 · 회계매니저 — 인정 시간 · 쉰 날 고치기, 대타는 바로 반영 */
  manage: boolean;
  colleagues: Array<{ id: string; name: string }>;
  staffById: Map<string, OpsStaff>;
  /** 그 달 기록 전체 — 이날 · 이 사람 것만 골라 보여 준다 */
  entries: OpsEntry[];
}

const ENTRY_LABEL: Record<OpsEntry["kind"], string> = { adjust: "시간 고침", off: "쉰 날", overtime: "연장 근무", cover: "수업 대타" };
const STATUS_LABEL: Record<OpsEntry["status"], string> = { pending: "승인 대기", approved: "반영", rejected: "반려", canceled: "취소" };

type Mode = "hours" | "cover" | "overtime";

const OpsDaySheet = ({ open, onClose, staff, day, hq, manage, colleagues, staffById, entries }: Props) => {
  const save = useOpsEntrySave();
  const cancel = useOpsEntryCancel();
  const [mode, setMode] = useState<Mode>("hours");
  const [h, setH] = useState("0");
  const [m, setM] = useState("0");
  const [reason, setReason] = useState("");
  const [coverTo, setCoverTo] = useState<string>("");
  const [segIdx, setSegIdx] = useState(0);
  const [otMin, setOtMin] = useState(60);

  useEffect(() => {
    if (!open || !day) return;
    const base = day.adjust ? day.adjust.minutes ?? 0 : day.scheduledMin;
    setH(String(Math.floor(base / 60)));
    setM(String(base % 60));
    setReason("");
    setMode(manage ? "hours" : day.segs.some((s) => !s.coverFor) ? "cover" : "overtime");
    setCoverTo("");
    setSegIdx(0);
    setOtMin(60);
  }, [open, day, manage]);

  if (!staff || !day) return null;
  const busy = save.isPending || cancel.isPending;
  const ownSegs = day.segs.filter((s) => !s.coverFor);
  const run = (p: Parameters<typeof save.mutate>[0], done: string) =>
    save.mutate(p, {
      onSuccess: () => {
        toast.success(done);
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });

  const minutes = Math.max(0, (Number(h) || 0) * 60 + (Number(m) || 0));
  const dayEntries = entries.filter(
    (e) => e.work_date === day.date && (e.staff_id === staff.id || e.cover_staff_id === staff.id) && e.status !== "canceled",
  );

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      stacked
      title={`${staff.name} · ${fmtDay(day.date)}`}
      sub={day.segs.length ? day.segs.map((s) => `${s.start}~${s.end}${s.coverFor ? ` (${s.coverFor} 대타)` : ""}`).join(" · ") : "시간표 없음"}
    >
      {/* 그날 한눈에 */}
      <div className="flex items-center justify-between rounded-2xl border border-border p-4">
        <div>
          <p className="text-label text-muted-foreground">인정</p>
          <p className="text-title font-black tabular-nums text-foreground">{fmtDuration(day.creditedMin)}</p>
        </div>
        <div className="text-right">
          <StatusPill status={day.status} />
          <p className="mt-1 text-label text-muted-foreground">
            {day.checkin
              ? `얼굴 출근 ${day.checkin}`
              : day.status === "future"
                ? "앞으로 할 근무"
                : staff.checkin_required
                  ? "얼굴 출근 기록 없음"
                  : "출근 확인 안 함"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
        {manage && (
          <OpsChip on={mode === "hours"} onClick={() => setMode("hours")}>인정 시간</OpsChip>
        )}
        {ownSegs.length > 0 && (
          <OpsChip on={mode === "cover"} onClick={() => setMode("cover")}>수업 대타</OpsChip>
        )}
        <OpsChip on={mode === "overtime"} onClick={() => setMode("overtime")}>연장 근무</OpsChip>
      </div>

      {mode === "hours" && manage && (
        <>
          <OpsLabel>이날 인정할 시간</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {day.scheduledMin > 0 && (
              <OpsChip on={minutes === day.scheduledMin} onClick={() => { setH(String(Math.floor(day.scheduledMin / 60))); setM(String(day.scheduledMin % 60)); }}>
                시간표대로 {fmtDuration(day.scheduledMin)}
              </OpsChip>
            )}
            <OpsChip on={minutes === 0} onClick={() => { setH("0"); setM("0"); }}>0시간</OpsChip>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))} className={cn(opsInput, "w-20 text-center")} aria-label="시간" />
            <span className="shrink-0 text-body text-foreground">시간</span>
            <input inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))} className={cn(opsInput, "w-20 text-center")} aria-label="분" />
            <span className="shrink-0 text-body text-foreground">분</span>
          </div>
          <OpsLabel>이유 (선택)</OpsLabel>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 100))} placeholder="예: 1시간 일찍 퇴근" className={opsInput} />
          <div className="mt-4 grid gap-2">
            <OpsButton
              disabled={busy || minutes > 24 * 60}
              onClick={() => run({ staff_id: staff.id, work_date: day.date, kind: "adjust", minutes, reason }, "인정 시간을 고쳤어요")}
            >
              {fmtDuration(minutes)} 인정하기
            </OpsButton>
            <OpsButton
              tone="plain"
              disabled={busy}
              onClick={() => run({ staff_id: staff.id, work_date: day.date, kind: "off", reason }, "쉰 날로 바꿨어요")}
            >
              쉰 날로 바꾸기
            </OpsButton>
          </div>
        </>
      )}

      {mode === "cover" && (
        <>
          <OpsLabel>어느 수업을</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {ownSegs.map((s, i) => (
              <OpsChip key={`${s.start}${s.end}`} on={segIdx === i} onClick={() => setSegIdx(i)}>
                {s.start}~{s.end}
              </OpsChip>
            ))}
          </div>
          <OpsLabel>누가 대신</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {colleagues.filter((c) => c.id !== staff.id).map((c) => (
              <OpsChip key={c.id} on={coverTo === c.id} onClick={() => setCoverTo(c.id)}>
                {c.name}
              </OpsChip>
            ))}
          </div>
          <p className="mt-3 text-label text-muted-foreground">
            {manage ? "대타 코치님도 그날 입구 얼굴 인식을 찍어야 시간이 잡혀요" : "지점장님이 승인하면 반영돼요 · 대타 코치님도 얼굴 인식을 찍어야 해요"}
          </p>
          <div className="mt-4">
            <OpsButton
              disabled={busy || !coverTo || !ownSegs[segIdx]}
              onClick={() =>
                run(
                  {
                    staff_id: staff.id,
                    work_date: day.date,
                    kind: "cover",
                    cover_staff_id: coverTo,
                    start_time: ownSegs[segIdx]?.start,
                    end_time: ownSegs[segIdx]?.end,
                  },
                  manage
                    ? `${staffById.get(coverTo)?.name ?? "동료"} 코치님이 대타로 정해졌어요`
                    : "지점장님께 대타 승인을 요청했어요",
                )
              }
            >
              {manage ? "대타 정하기" : "대타 요청하기"}
            </OpsButton>
          </div>
        </>
      )}

      {mode === "overtime" && (
        <>
          <OpsLabel>더 일한 시간</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {[30, 60, 90, 120].map((v) => (
              <OpsChip key={v} on={otMin === v} onClick={() => setOtMin(v)}>
                {fmtDuration(v)}
              </OpsChip>
            ))}
          </div>
          <OpsLabel>이유</OpsLabel>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 100))} placeholder="예: 저녁 수업 인원이 많아 30분 더" className={opsInput} />
          <p className="mt-3 text-label text-muted-foreground">
            {hq ? "대표님이 넣으면 바로 반영돼요" : "대표님 승인 뒤에 반영돼요"}
          </p>
          <div className="mt-4">
            <OpsButton
              disabled={busy}
              onClick={() =>
                run(
                  { staff_id: staff.id, work_date: day.date, kind: "overtime", minutes: otMin, reason },
                  hq ? "연장 근무를 넣었어요" : "대표님께 승인을 요청했어요",
                )
              }
            >
              연장 근무 {fmtDuration(otMin)} {hq ? "넣기" : "요청"}
            </OpsButton>
          </div>
        </>
      )}

      {dayEntries.length > 0 && (
        <>
          <OpsLabel>이날 기록</OpsLabel>
          <ul className="space-y-1.5">
            {dayEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-label text-foreground">
                  {ENTRY_LABEL[e.kind]}
                  {e.kind === "adjust" && e.minutes != null ? ` ${fmtDuration(e.minutes)}` : ""}
                  {e.kind === "overtime" && e.minutes ? ` ${fmtDuration(e.minutes)}` : ""}
                  {e.kind === "cover" && e.start_time ? ` ${e.start_time}~${e.end_time} → ${staffById.get(e.cover_staff_id ?? "")?.name ?? ""}` : ""}
                  {" · "}
                  {STATUS_LABEL[e.status]}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
                {(manage || (e.requested_by_me && e.status === "pending")) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    cancel.mutate(e.id, {
                      onSuccess: () => toast.success("되돌렸어요"),
                      onError: (err) => toast.error((err as Error).message),
                    })
                  }
                  className="shrink-0 text-label font-bold text-muted-foreground underline underline-offset-2"
                >
                  {manage ? "되돌리기" : "요청 취소"}
                </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {manage && day.segs.length > 0 && day.checkin && hmToMin(day.checkin) > hmToMin(day.segs[0].start) + 10 && (
        <p className="mt-3 text-label text-orange-700">시간표({day.segs[0].start})보다 늦게 찍혔어요 — 늦게 왔다면 인정 시간을 줄여 주세요</p>
      )}
    </OpsSheet>
  );
};

export default OpsDaySheet;
