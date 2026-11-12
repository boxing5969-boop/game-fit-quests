/**
 * 153운영본부 · PT 기록 「오류 신고」 화면 조각 (2026-11-12 대표님 「pt 선생님이 볼때 오류가 있으면 오류신고 할수있도록」)
 *
 *   PtReportSheet       — 코치: 무엇이 틀렸나요(6) · 실제 수업 날짜(입장한 날 칩) · 메모 → 보내기(대표님 · 지점장 알림)
 *   PtReportList        — 코치: 보낸 오류 신고(확인 중 · 고쳤어요 · 그대로 둬요 + 답) / 관리자: 받은 신고 → 신고대로 고치기 · 처리
 *   PtReportResolveSheet — 관리자: 고쳤어요 · 그대로 둬요 + 한마디 → 보낸 코치에게 알림
 *   판단 · 글은 src/lib/opsPtReport.ts, 서버는 src/services/opsPtReportService.ts. 고치기 자체는 기존 기록 시트(OpsPtRecord)가 한다.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Flag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { addDays, dayDiff, mdOf, ptMemberName, type PtMatchResult, type PtRecordData } from "@/lib/opsPtRecord";
import {
  PT_REPORT_KINDS,
  PT_REPORT_KIND_HINT,
  PT_REPORT_KIND_LABEL,
  PT_REPORT_NOTE_MAX,
  PT_REPORT_NOTE_PLACEHOLDER,
  PT_REPORT_STATUS_LABEL,
  emptyPtReportDraft,
  ptReportDraftError,
  ptReportFix,
  ptReportLine,
  ptReportNeedsDate,
  ptReportPayload,
  ptReportStamp,
  type PtReport,
  type PtReportDraft,
  type PtReportFix,
  type PtReportStatus,
} from "@/lib/opsPtReport";
import type { useOpsPtReportActions } from "@/services/opsPtReportService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, fmtDay, kstToday, opsInput } from "./OpsParts";

type ReportActions = ReturnType<typeof useOpsPtReportActions>;

/** "2026-11-11T18:02:00+09:00" → "18:02" (KST) */
const hm = (iso: string) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
};
const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** "11/11 수" */
const mdw = (date: string) => `${mdOf(date)} ${WD[new Date(`${date}T00:00:00Z`).getUTCDay()]}`;

const STATUS_CLS: Record<PtReportStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  fixed: "bg-primary/10 text-primary",
  kept: "bg-secondary text-muted-foreground",
};

export interface PtReportInit {
  draft: PtReportDraft;
  /** 신고하는 것 한 줄 — "가온 · 수업 · 11월 12일 (목)" */
  context?: string;
  /** 회원을 바꾸지 못하게(기록 · 차감에서 열었을 때) */
  lockMember?: boolean;
}

// ───────────────────────── 코치 — 신고 보내기 ─────────────────────────
export const PtReportSheet = ({
  init,
  onClose,
  branch,
  data,
  actions,
}: {
  init: PtReportInit | null;
  onClose: () => void;
  branch: string;
  data: PtRecordData;
  actions: ReportActions;
}) => {
  const today = data.today ?? kstToday();
  const members = useMemo(() => data.members ?? [], [data.members]);
  const [draft, setDraft] = useState<PtReportDraft>(() => init?.draft ?? emptyPtReportDraft());
  useEffect(() => {
    if (init) setDraft(init.draft);
  }, [init]);
  const set = (p: Partial<PtReportDraft>) => setDraft((d) => ({ ...d, ...p }));
  const picked = members.find((m) => m.user_id === draft.member_user_id) ?? null;
  // 그 회원이 최근 열흘 안에 들어온 날 — 실제 수업 날짜를 눌러 고르게(날짜를 잘못 고르는 일 막기)
  const entries = useMemo(() => {
    if (!draft.member_user_id) return [];
    const byDay = new Map<string, string>();
    for (const a of data.attendance ?? []) {
      if (a.user_id !== draft.member_user_id || a.date > today || dayDiff(a.date, today) > 10) continue;
      const prev = byDay.get(a.date);
      if (!prev || a.at < prev) byDay.set(a.date, a.at);
    }
    return [...byDay].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
  }, [data.attendance, draft.member_user_id, today]);
  const needDate = ptReportNeedsDate(draft.kind);

  const send = () => {
    const err = ptReportDraftError(draft, { today });
    if (err) {
      toast.error(err);
      return;
    }
    actions.send.mutate(
      { p: ptReportPayload(branch, draft), memberName: picked ? ptMemberName(picked) : draft.member_name },
      {
        onSuccess: (r) => {
          toast.success(r.dup ? "이미 보낸 신고예요 — 확인을 기다리고 있어요" : "보냈어요 — 대표님 · 지점장님이 확인하면 알림이 와요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <OpsSheet
      open={!!init}
      onClose={onClose}
      stacked
      title="PT 기록 오류 신고"
      sub="대표님 · 지점장님께 바로 가요"
      footer={
        <OpsButton onClick={send} disabled={actions.send.isPending}>
          <Flag className="h-4 w-4" /> 오류 신고 보내기
        </OpsButton>
      }
    >
      {init?.context && (
        <div className="mb-1 rounded-xl bg-secondary/60 px-3 py-2.5">
          <p className="text-label font-bold text-muted-foreground">신고하는 것</p>
          <p className="mt-0.5 text-body font-bold text-foreground">{init.context}</p>
        </div>
      )}
      {!init?.lockMember && (
        <>
          <OpsLabel>회원</OpsLabel>
          <select
            className={opsInput}
            value={draft.member_user_id ?? ""}
            onChange={(e) => {
              const m = members.find((x) => x.user_id === e.target.value) ?? null;
              set({ member_user_id: m?.user_id ?? null, member_name: m?.name ?? "" });
            }}
            aria-label="회원"
          >
            <option value="">회원 고르기 (그 밖이면 비워 두기)</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {ptMemberName(m)}
                {m.tail ? ` · …${m.tail}` : ""}
              </option>
            ))}
          </select>
        </>
      )}

      <OpsLabel>무엇이 틀렸나요</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {PT_REPORT_KINDS.map((k) => (
          <OpsChip key={k} on={draft.kind === k} onClick={() => set({ kind: k })}>
            {PT_REPORT_KIND_LABEL[k]}
          </OpsChip>
        ))}
      </div>
      {draft.kind && <p className="mt-1.5 text-label text-muted-foreground">{PT_REPORT_KIND_HINT[draft.kind]}</p>}

      {needDate && (
        <>
          <OpsLabel>실제 수업 날짜</OpsLabel>
          {entries.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {entries.map(([date, at]) => (
                <OpsChip key={date} on={draft.right_date === date} onClick={() => set({ right_date: date })}>
                  {mdw(date)} · {hm(at)} 입장
                </OpsChip>
              ))}
            </div>
          )}
          <input
            type="date"
            className={opsInput}
            value={draft.right_date ?? ""}
            max={today}
            min={addDays(today, -120)}
            onChange={(e) => set({ right_date: e.target.value || null })}
            aria-label="실제 수업 날짜"
          />
          {draft.about_date && draft.right_date && draft.right_date !== draft.about_date && (
            <p className="mt-1.5 text-label text-muted-foreground">
              {fmtDay(draft.about_date)} → {fmtDay(draft.right_date)}
            </p>
          )}
        </>
      )}

      <OpsLabel>{draft.kind === "other" ? "무엇이 이상한가요" : "메모 (선택)"}</OpsLabel>
      <textarea
        className={cn(opsInput, "min-h-[88px] resize-none")}
        value={draft.note}
        onChange={(e) => set({ note: e.target.value })}
        maxLength={PT_REPORT_NOTE_MAX}
        placeholder={draft.kind ? PT_REPORT_NOTE_PLACEHOLDER[draft.kind] : "남길 말이 있으면 적어 주세요"}
        aria-label="메모"
      />
      <p className="mt-2 text-label text-muted-foreground">기록은 그대로 두고 신고만 가요 — 처리되면 이 화면과 알림으로 알려 드려요</p>
    </OpsSheet>
  );
};

// ───────────────────────── 관리자 — 처리 ─────────────────────────
export interface PtResolveInit {
  report: PtReport;
  status?: Exclude<PtReportStatus, "open">;
  reply?: string;
}

export const PtReportResolveSheet = ({ init, onClose, actions }: { init: PtResolveInit | null; onClose: () => void; actions: ReportActions }) => {
  const [status, setStatus] = useState<Exclude<PtReportStatus, "open">>("fixed");
  const [reply, setReply] = useState("");
  useEffect(() => {
    if (!init) return;
    setStatus(init.status ?? (init.report.status === "kept" ? "kept" : "fixed"));
    setReply(init.reply ?? init.report.reply ?? "");
  }, [init]);
  const r = init?.report;
  const save = () => {
    if (!r) return;
    actions.resolve.mutate(
      { id: r.id, status, reply: reply.trim() },
      {
        onSuccess: () => {
          toast.success("처리했어요 — 코치님께 알림이 가요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  return (
    <OpsSheet
      open={!!init}
      onClose={onClose}
      stacked
      title="오류 신고 처리"
      footer={
        <OpsButton onClick={save} disabled={actions.resolve.isPending}>
          처리하고 알리기
        </OpsButton>
      }
    >
      {r && (
        <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
          <p className="text-label font-bold text-muted-foreground">
            {r.reporter_name ?? "코치"} · {ptReportStamp(r.created_at)}
          </p>
          <p className="mt-0.5 text-body font-bold text-foreground">
            {r.member_name ?? "회원 없음"} · {ptReportLine(r)}
          </p>
          {r.note && <p className="mt-0.5 text-body text-foreground">{r.note}</p>}
        </div>
      )}
      <OpsLabel>처리 결과</OpsLabel>
      <div className="flex gap-1.5">
        <OpsChip on={status === "fixed"} onClick={() => setStatus("fixed")}>
          고쳤어요
        </OpsChip>
        <OpsChip on={status === "kept"} onClick={() => setStatus("kept")}>
          그대로 둬요
        </OpsChip>
      </div>
      <OpsLabel>코치님께 한마디 (선택)</OpsLabel>
      <input
        className={opsInput}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={300}
        placeholder={status === "fixed" ? "예: 브로제이 차감도 맞췄어요" : "예: 브로제이 기록이 맞아요"}
        aria-label="코치님께 한마디"
      />
      <p className="mt-2 text-label text-muted-foreground">기록 · 차감을 고치는 일은 기록 시트 · 브로제이에서 — 여기는 결과만 알려요</p>
    </OpsSheet>
  );
};

// ───────────────────────── 목록 ─────────────────────────
const ReportItem = ({ r, manage }: { r: PtReport; manage: boolean }) => (
  <>
    <p className="flex items-center gap-1.5">
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", STATUS_CLS[r.status])}>{PT_REPORT_STATUS_LABEL[r.status]}</span>
      <span className="min-w-0 truncate text-label text-muted-foreground">
        {manage ? `${r.reporter_name ?? "코치"} · ` : ""}
        {ptReportStamp(r.created_at)}
      </span>
    </p>
    <p className="mt-1 text-body font-bold text-foreground">
      {r.member_name ?? "회원 없음"} · {ptReportLine(r)}
    </p>
    {r.note && <p className="text-body text-foreground">{r.note}</p>}
    {r.reply && <p className="mt-1 rounded-lg bg-background/70 px-2.5 py-1.5 text-label font-bold text-foreground">답 · {r.reply}</p>}
  </>
);

export const PtReportList = ({
  reports,
  manage,
  res,
  busy,
  onFix,
  onResolve,
}: {
  reports: PtReport[];
  manage: boolean;
  res: PtMatchResult | null;
  busy?: boolean;
  /** 관리자 — 신고대로 고치기(기록 시트를 연다) */
  onFix?: (r: PtReport, fix: PtReportFix) => void;
  /** 관리자 — 처리 시트 */
  onResolve?: (init: PtResolveInit) => void;
}) => {
  const [showDone, setShowDone] = useState(false);
  if (reports.length === 0) return null;
  const open = reports.filter((r) => r.status === "open");
  const done = reports.filter((r) => r.status !== "open");

  if (!manage) {
    return (
      <>
        <OpsLabel>보낸 오류 신고</OpsLabel>
        <ul className="space-y-2">
          {[...open, ...done].slice(0, showDone ? undefined : 3).map((r) => (
            <li key={r.id} className={cn("rounded-xl p-3", r.status === "open" ? "bg-amber-50" : "bg-secondary/60")}>
              <ReportItem r={r} manage={false} />
            </li>
          ))}
        </ul>
        {reports.length > 3 && (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="mt-2 w-full text-center text-label font-bold text-muted-foreground">
            {showDone ? "접기" : `${reports.length - 3}건 더 보기`}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="mb-4">
      {open.length > 0 && (
        <>
          <OpsLabel>오류 신고 {open.length}</OpsLabel>
          <ul className="space-y-2">
            {open.map((r) => {
              const fix = ptReportFix(r, res);
              return (
                <li key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <ReportItem r={r} manage />
                  {fix?.type === "done" && <p className="mt-1 text-label font-bold text-primary">{fix.text}</p>}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve?.({ report: r, status: "kept" })}
                      className="h-10 rounded-xl border border-border bg-background px-3 text-label font-black text-foreground active:scale-[0.98] disabled:opacity-50"
                    >
                      그대로 둬요
                    </button>
                    {fix && fix.type !== "done" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onFix?.(r, fix)}
                        className="h-10 rounded-xl bg-primary px-3 text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                      >
                        {fix.type === "edit" ? `${mdOf(fix.date)}로 고치기` : fix.type === "new" ? `${mdOf(fix.date)} 기록 넣기` : "기록 지우기"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResolve?.({ report: r, status: "fixed", reply: fix?.type === "done" ? fix.text : undefined })}
                        className="h-10 rounded-xl bg-primary px-3 text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                      >
                        고쳤어요
                      </button>
                    )}
                  </div>
                  {!fix && <p className="mt-1.5 text-label text-muted-foreground">앱에서 바로 고칠 수 없는 신고예요 — 브로제이 · 기록을 확인하고 처리해 주세요</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="mt-3 flex items-center gap-1 text-label font-bold text-muted-foreground"
            aria-expanded={showDone}
          >
            처리한 오류 신고 {done.length}건
            <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onResolve?.({ report: r })}
                    className="w-full rounded-xl bg-secondary/60 p-3 text-left active:bg-secondary"
                  >
                    <ReportItem r={r} manage />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

/** 작은 「오류 신고」 글 단추 — 확인 필요 카드 · 기록 시트 아래 */
export const PtReportLink = ({ onClick, label = "오류 신고" }: { onClick: () => void; label?: string }) => (
  <button type="button" onClick={onClick} className="mt-2 flex items-center gap-1 text-label font-bold text-muted-foreground underline underline-offset-2">
    <Flag className="h-3.5 w-3.5" /> {label}
  </button>
);
