/**
 * 153운영본부 · PT 기록 1단계 — 코치 「오늘 PT」 · 확인 필요 · 수업 기록 (2026-11-11 대표님 「추천대로 진행하자」
 *   · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ)
 *
 *   코치 화면(「근무」 탭 맨 위): 오늘 들어온 PT 회원마다 [개인 운동] [수업 완료] · [안 온 회원 기록](노쇼 · 당일취소 · 일정 변경 · 코치 사정)
 *     · 확인 필요(사유 없는 차감 · 기록 없는 입장 · 차감 대기 …) · 최근 기록. 알림 링크 /office?tab=work&pt=today 로 오면 여기로 내려온다.
 *   관리자 화면(근무자 카드 'PT' 탭 위쪽): 그 코치의 확인 필요(늦은 기록 확인 포함) · 달별 수업 기록 · 차감 기준 / 기록 기준 횟수.
 *     돈은 여기 없다(수당은 아래 OpsPtPanel — 기준은 그대로 차감 기록).
 *   짝짓기 · 판정은 src/lib/opsPtRecord.ts. 지점마다 대표님이 켠 곳만 보인다(꺼져 있으면 아무것도 안 그린다).
 *   `demo` = 예시 화면(?demo=1) — 지어낸 회원 · 이 기기 안에서만 바뀜.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  PT_KIND_HINT,
  PT_KIND_LABEL,
  PT_NO_ENTRY_MONTH_LIMIT,
  PT_REASON_LABEL,
  addDays,
  isUseKind,
  matchPtRecord,
  mdOf,
  ptCounts,
  ptDraftError,
  ptDraftPayload,
  ptMemberName,
  ptMemberSub,
  ptMonthCompare,
  ptRowStatus,
  ptTodayList,
  type PtDraft,
  type PtExtra,
  type PtKind,
  type PtMatchResult,
  type PtNoEntryReason,
  type PtRecMember,
  type PtRecordData,
  type PtRow,
  type PtUnrecorded,
} from "@/lib/opsPtRecord";
import { PT_SAMPLE_COACH } from "@/lib/opsPtRecordSample";
import { useOpsPtRecord, useOpsPtRecordActions } from "@/services/opsPtRecordService";
import { ptTicketLabel } from "./OpsPtPanel";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, fmtDay, kstToday, monthOf, opsInput } from "./OpsParts";

const KINDS: PtKind[] = ["lesson", "noshow", "late_cancel", "moved", "coach_cancel", "self"];
const REASONS: PtNoEntryReason[] = ["door_open", "manual", "other"];
const REASON_SHORT: Record<PtNoEntryReason, string> = { door_open: "문 열림", manual: "체크 못 함", other: "그 밖" };
const KIND_CLS: Record<PtKind, string> = {
  lesson: "bg-primary/10 text-primary",
  noshow: "bg-amber-100 text-amber-800",
  late_cancel: "bg-amber-100 text-amber-800",
  moved: "bg-secondary text-muted-foreground",
  coach_cancel: "bg-secondary text-muted-foreground",
  self: "bg-secondary text-muted-foreground",
};
const TONE = { ok: "text-primary", warn: "text-amber-700", muted: "text-muted-foreground" } as const;
const smallBtn = "h-10 rounded-xl px-3 text-label font-black active:scale-[0.98] disabled:opacity-50";
const plainBtn = cn(smallBtn, "border border-border bg-background text-foreground");
const mainBtn = cn(smallBtn, "bg-primary text-primary-foreground");

/** "2026-11-11T18:02:00+09:00" → "18:02" (KST) */
const hm = (iso: string) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
};

type Actions = ReturnType<typeof useOpsPtRecordActions>;
interface SheetInit {
  draft: PtDraft;
  /** 고치는 기록 */
  row?: PtRow;
  /** 회원을 바꾸지 못하게(알림 · 확인 필요에서 열었을 때) */
  lockMember?: boolean;
  hint?: string;
}

const emptyDraft = (today: string, more: Partial<PtDraft> = {}): PtDraft => ({
  member_user_id: null,
  member_name: "",
  kind: "noshow",
  session_date: today,
  uses: 1,
  moved_to: null,
  no_entry_reason: null,
  note: "",
  ...more,
});

// ───────────────────────── 기록 한 줄 ─────────────────────────
const RecordRow = ({ r, onClick }: { r: PtRow; onClick: () => void }) => {
  const st = ptRowStatus(r);
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-secondary/60">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-body font-bold text-foreground">{r.name}</span>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", KIND_CLS[r.s.kind])}>
              {PT_KIND_LABEL[r.s.kind]}
              {r.s.uses > 1 ? ` ${r.s.uses}회` : ""}
            </span>
          </p>
          <p className="truncate text-label text-muted-foreground">
            {fmtDay(r.s.session_date)}
            {r.entryAt ? ` · 입장 ${hm(r.entryAt)}` : r.noEntry ? ` · 출석 없음${r.s.no_entry_reason ? ` · ${REASON_SHORT[r.s.no_entry_reason]}` : ""}` : ""}
            {r.s.note ? ` · ${r.s.note}` : ""}
          </p>
        </div>
        {st.text && <span className={cn("shrink-0 text-label font-bold", TONE[st.tone])}>{st.text}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
};

// ───────────────────────── 넣기 · 고치기 시트 ─────────────────────────
const RecordSheet = ({
  init,
  onClose,
  branch,
  data,
  manage,
  coachId,
  actions,
}: {
  init: SheetInit | null;
  onClose: () => void;
  branch: string;
  data: PtRecordData;
  manage: boolean;
  coachId: string | null;
  actions: Actions;
}) => {
  const today = data.today ?? kstToday();
  const members = useMemo(() => data.members ?? [], [data.members]);
  const [draft, setDraft] = useState<PtDraft>(() => emptyDraft(today));
  const [typing, setTyping] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [labelFor, setLabelFor] = useState<string | null>(null);
  const [labelText, setLabelText] = useState("");
  useEffect(() => {
    if (!init) return;
    setDraft(init.draft);
    setTyping(!init.draft.member_user_id && !!init.draft.member_name);
    setRemoving(false);
    setReason("");
    setLabelFor(null);
  }, [init]);

  const editing = !!init?.row;
  const lock = editing || !!init?.lockMember;
  const picked = members.find((m) => m.user_id === draft.member_user_id) ?? null;
  const hasEntry = !!draft.member_user_id && (data.attendance ?? []).some((a) => a.user_id === draft.member_user_id && a.date === draft.session_date);
  const needReason = draft.kind === "lesson" && !!draft.member_user_id && !hasEntry;
  const lateNote = isUseKind(draft.kind) && draft.session_date < today && !manage;
  const set = (p: Partial<PtDraft>) => setDraft((d) => ({ ...d, ...p }));
  const busy = actions.save.isPending || actions.remove.isPending;

  const save = () => {
    const err = ptDraftError(draft, { today, hasEntry });
    if (err) {
      toast.error(err);
      return;
    }
    actions.save.mutate(ptDraftPayload(branch, { ...draft, no_entry_reason: needReason ? draft.no_entry_reason : null, coach_staff_id: manage ? coachId : undefined }), {
      onSuccess: () => {
        toast.success(editing ? "고쳤어요" : isUseKind(draft.kind) ? "기록했어요 — 브로제이 차감도 해 주세요" : "기록했어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };
  const remove = () => {
    if (!init?.row) return;
    if (reason.trim().length < 2) {
      toast.error("지우는 이유를 적어 주세요");
      return;
    }
    actions.remove.mutate(
      { id: init.row.s.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("기록을 지웠어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  const saveLabel = (m: PtRecMember) =>
    actions.label.mutate(
      { member: m.user_id, label: labelText },
      {
        onSuccess: () => {
          toast.success(labelText.trim() ? "이름표를 붙였어요" : "이름표를 뗐어요");
          setLabelFor(null);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  const memberLine = (m: PtRecMember) =>
    [ptTicketLabel(m.ticket), m.remaining != null ? `남음 ${m.remaining}회` : "", ptMemberSub(m)].filter(Boolean).join(" · ");

  return (
    <OpsSheet
      open={!!init}
      onClose={onClose}
      stacked={manage}
      title={editing ? "기록 고치기" : "PT 기록"}
      footer={
        removing ? (
          <div className="grid grid-cols-2 gap-2">
            <OpsButton tone="plain" onClick={() => setRemoving(false)} disabled={busy}>
              돌아가기
            </OpsButton>
            <OpsButton tone="danger" onClick={remove} disabled={busy}>
              기록 지우기
            </OpsButton>
          </div>
        ) : (
          <OpsButton onClick={save} disabled={busy}>
            {editing ? "고치기" : "기록하기"}
          </OpsButton>
        )
      }
    >
      {removing ? (
        <>
          <OpsLabel>지우는 이유</OpsLabel>
          <input className={opsInput} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 날짜를 잘못 넣었어요" maxLength={100} />
          <p className="mt-2 text-label text-muted-foreground">지운 기록은 이유와 함께 남아요</p>
        </>
      ) : (
        <>
          {init?.hint && <p className="mb-3 rounded-xl bg-secondary/60 px-3 py-2 text-label font-bold text-muted-foreground">{init.hint}</p>}
          <OpsLabel>회원</OpsLabel>
          {lock ? (
            <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">{picked ? ptMemberName(picked) : init?.row?.name ?? draft.member_name}</p>
                {picked && <p className="truncate text-label text-muted-foreground">{memberLine(picked)}</p>}
              </div>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
                {members.map((m) => {
                  const on = !typing && draft.member_user_id === m.user_id;
                  return (
                    <li key={m.user_id}>
                      {labelFor === m.user_id ? (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <input
                            className={opsInput}
                            value={labelText}
                            onChange={(e) => setLabelText(e.target.value)}
                            placeholder={`${m.name} 님을 알아볼 이름`}
                            maxLength={20}
                            aria-label="PT 이름표"
                          />
                          <button type="button" disabled={actions.label.isPending} onClick={() => saveLabel(m)} className={cn(mainBtn, "shrink-0")}>
                            저장
                          </button>
                        </div>
                      ) : (
                        <div className={cn("flex items-center", on && "bg-primary/5")}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              setTyping(false);
                              set({ member_user_id: m.user_id, member_name: m.name });
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left active:bg-secondary/60"
                          >
                            <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", on ? "border-primary bg-primary" : "border-border")} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body font-bold text-foreground">{ptMemberName(m)}</span>
                              <span className="block truncate text-label text-muted-foreground">{memberLine(m)}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`${ptMemberName(m)} 이름표`}
                            onClick={() => {
                              setLabelFor(m.user_id);
                              setLabelText(m.label ?? "");
                            }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground active:scale-95"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {typing ? (
                <input
                  className={cn(opsInput, "mt-2")}
                  value={draft.member_name}
                  onChange={(e) => set({ member_user_id: null, member_name: e.target.value })}
                  placeholder="회원 이름"
                  maxLength={40}
                  aria-label="회원 이름"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTyping(true);
                    set({ member_user_id: null, member_name: "" });
                  }}
                  className="mt-2 text-label font-bold text-muted-foreground underline underline-offset-2"
                >
                  목록에 없는 회원이에요
                </button>
              )}
              <p className="mt-1.5 text-label text-muted-foreground">연필을 누르면 앱 이름 대신 알아보기 쉬운 이름표를 붙일 수 있어요</p>
            </>
          )}

          <OpsLabel>무슨 일이었나요</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <OpsChip key={k} on={draft.kind === k} onClick={() => set({ kind: k })}>
                {PT_KIND_LABEL[k]}
              </OpsChip>
            ))}
          </div>
          <p className="mt-1.5 text-label text-muted-foreground">{PT_KIND_HINT[draft.kind]}</p>

          <OpsLabel>{draft.kind === "moved" ? "원래 날짜" : "날짜"}</OpsLabel>
          <input
            type="date"
            className={opsInput}
            value={draft.session_date}
            min={data.started_on ? addDays(data.started_on, -14) : undefined}
            max={isUseKind(draft.kind) || draft.kind === "self" ? today : addDays(today, 31)}
            onChange={(e) => set({ session_date: e.target.value })}
            aria-label="날짜"
          />
          {draft.kind === "moved" && (
            <>
              <OpsLabel>옮긴 날짜</OpsLabel>
              <input type="date" className={opsInput} value={draft.moved_to ?? ""} onChange={(e) => set({ moved_to: e.target.value || null })} aria-label="옮긴 날짜" />
            </>
          )}

          {needReason && (
            <>
              <OpsLabel>그날 출석 체크가 없어요 — 사유</OpsLabel>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <OpsChip key={r} on={draft.no_entry_reason === r} onClick={() => set({ no_entry_reason: r })}>
                    {PT_REASON_LABEL[r]}
                  </OpsChip>
                ))}
              </div>
              <p className="mt-1.5 text-label text-muted-foreground">한 달에 {PT_NO_ENTRY_MONTH_LIMIT}회를 넘으면 대표님께 보여요</p>
            </>
          )}

          {draft.kind === "lesson" && (
            <>
              <OpsLabel>차감 횟수</OpsLabel>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <OpsChip key={n} on={draft.uses === n} onClick={() => set({ uses: n })}>
                    {n}회
                  </OpsChip>
                ))}
              </div>
              <p className="mt-1.5 text-label text-muted-foreground">연속 수업으로 하루에 여러 회를 차감할 때만 바꿔 주세요</p>
            </>
          )}

          <OpsLabel>메모 (선택)</OpsLabel>
          <input className={opsInput} value={draft.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder="남길 말이 있으면 적어 주세요" aria-label="메모" />

          {lateNote && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
              수업 날이 지나서 적는 기록은 지점장님 확인 뒤에 인정돼요
            </p>
          )}
          {editing && (
            <button type="button" onClick={() => setRemoving(true)} className="mt-4 text-label font-bold text-muted-foreground underline underline-offset-2">
              이 기록 지우기
            </button>
          )}
        </>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 확인 필요 ─────────────────────────
const TodoCard = ({ title, body, sub, two, children }: { title: string; body: string; sub?: string; two?: boolean; children?: ReactNode }) => (
  <li className="rounded-xl bg-amber-50 p-3">
    <p className="text-label font-bold text-amber-800">{title}</p>
    <p className="mt-0.5 text-body text-foreground">{body}</p>
    {sub && <p className="text-label text-muted-foreground">{sub}</p>}
    {children && <div className={cn("mt-2 grid gap-2", two && "grid-cols-2")}>{children}</div>}
  </li>
);

const TodoList = ({
  res,
  rows,
  extras,
  manage,
  busy,
  onRecord,
  onEdit,
  onQuick,
  onReview,
}: {
  res: PtMatchResult;
  rows: PtRow[];
  extras: PtExtra[];
  manage: boolean;
  busy: boolean;
  onRecord: (init: SheetInit) => void;
  onEdit: (r: PtRow) => void;
  onQuick: (u: PtUnrecorded, kind: PtKind) => void;
  onReview: (r: PtRow) => void;
}) => {
  const past = res.unrecorded.filter((u) => !u.isToday);
  const reviews = rows.filter((r) => r.needReview);
  return (
    <ul className="space-y-2">
      {rows
        .filter((r) => r.needReason)
        .map((r) => (
          <TodoCard key={`reason${r.s.id}`} title={`출석 체크 없음 · ${fmtDay(r.s.session_date)}`} body={`${r.name} · 수업 — 사유를 골라 주세요`}>
            <button type="button" className={mainBtn} onClick={() => onEdit(r)}>
              사유 고르기
            </button>
          </TodoCard>
        ))}
      {extras.map((x) => (
        <TodoCard
          key={`extra${x.eventId}`}
          title={`사유 없는 차감 · ${fmtDay(x.workDate)}`}
          body={`${x.name} · ${x.count}회 — 어떤 수업이었는지 기록해 주세요`}
          sub="기록이 없으면 과차감일 수 있어요 · 잘못 뺀 것이면 브로제이에서 되돌려 주세요"
        >
          <button
            type="button"
            className={mainBtn}
            onClick={() =>
              onRecord({
                draft: emptyDraft(res.today, {
                  member_user_id: x.userId,
                  member_name: x.name,
                  kind: "lesson",
                  session_date: x.workDate > res.today ? res.today : x.workDate,
                }),
                lockMember: true,
                hint: `차감이 잡힌 날은 ${mdOf(x.workDate)} — 실제 수업 날짜를 골라 주세요`,
              })
            }
          >
            기록하기
          </button>
        </TodoCard>
      ))}
      {past.map((u) => (
        <TodoCard key={`in${u.userId}${u.date}`} two title={`기록 없는 입장 · ${fmtDay(u.date)} ${hm(u.at)}`} body={`${u.name} — PT 수업이었나요?`}>
          <button type="button" disabled={busy} className={plainBtn} onClick={() => onQuick(u, "self")}>
            개인 운동
          </button>
          <button type="button" disabled={busy} className={mainBtn} onClick={() => onQuick(u, "lesson")}>
            수업
          </button>
        </TodoCard>
      ))}
      {rows
        .filter((r) => r.state === "wait" && !r.heldByCheck)
        .map((r) => (
          <TodoCard
            key={`wait${r.s.id}`}
            title={`차감 대기 · ${fmtDay(r.s.session_date)}`}
            body={
              r.untracked
                ? `${r.name} · ${PT_KIND_LABEL[r.s.kind]} — 앱에 이어지지 않은 회원이에요`
                : `${r.name} · ${PT_KIND_LABEL[r.s.kind]} — 브로제이에서 차감해 주세요`
            }
            sub={r.untracked ? "지점장님이 브로제이를 확인하고 차감을 직접 넣어요" : "차감하면 하루 이틀 안에 여기서 사라져요"}
          />
        ))}
      {rows
        .filter((r) => r.movedMissing && r.s.moved_to)
        .map((r) => (
          <TodoCard
            key={`moved${r.s.id}`}
            title={`옮긴 날 기록 없음 · ${fmtDay(r.s.moved_to!)}`}
            body={`${r.name} · ${mdOf(r.s.session_date)} 수업을 옮긴 날이에요`}
          >
            <button
              type="button"
              className={mainBtn}
              onClick={() =>
                onRecord({
                  draft: emptyDraft(res.today, { member_user_id: r.s.member_user_id, member_name: r.s.member_name, kind: "lesson", session_date: r.s.moved_to! }),
                  lockMember: true,
                })
              }
            >
              기록하기
            </button>
          </TodoCard>
        ))}
      {reviews.map((r) =>
        manage ? (
          <TodoCard
            key={`review${r.s.id}`}
            two
            title={`늦은 기록 · ${fmtDay(r.s.session_date)}`}
            body={`${r.name} · ${PT_KIND_LABEL[r.s.kind]} — ${mdOf(r.s.created_at.slice(0, 10))}에 적었어요`}
            sub="수업 당일 자정을 넘긴 기록이에요"
          >
            <button type="button" disabled={busy} className={plainBtn} onClick={() => onEdit(r)}>
              고치기 · 지우기
            </button>
            <button type="button" disabled={busy} className={mainBtn} onClick={() => onReview(r)}>
              확인
            </button>
          </TodoCard>
        ) : (
          <li key={`review${r.s.id}`} className="rounded-xl bg-secondary/60 p-3">
            <p className="text-label font-bold text-muted-foreground">늦은 기록 · {fmtDay(r.s.session_date)}</p>
            <p className="mt-0.5 text-body text-foreground">
              {r.name} · {PT_KIND_LABEL[r.s.kind]} — 지점장님 확인을 기다려요
            </p>
          </li>
        ),
      )}
    </ul>
  );
};

// ───────────────────────── 본체 ─────────────────────────
interface Props {
  branch: string;
  /** 관리자 화면(근무자 카드 'PT' 탭) — 없으면 코치 화면 */
  manage?: boolean;
  /** 이 코치의 기록 · 차감만 (코치 화면은 본인) */
  coachId: string | null;
  /** 관리자 화면에서 보는 달 (YYYY-MM-01) */
  month?: string;
  /** 예시 화면 */
  demo?: boolean;
  /** 관리자 화면 아래에 수당(OpsPtPanel)이 이어진다 — 머리글을 그린다 */
  payBelow?: boolean;
}

const OpsPtRecord = ({ branch, manage = false, coachId, month, demo = false, payBelow = false }: Props) => {
  const q = useOpsPtRecord(branch, { demo, demoManage: manage });
  const actions = useOpsPtRecordActions(branch, { demo, demoManage: manage });
  const data = q.data;
  const res = useMemo(() => (data?.on ? matchPtRecord(data) : null), [data]);
  const [sheet, setSheet] = useState<SheetInit | null>(null);
  const [more, setMore] = useState(false);
  const [offAsk, setOffAsk] = useState(false);

  // 알림을 누르고 왔을 때(/office?tab=work&pt=today) — 오늘 PT 로 내려온다
  const [params] = useSearchParams();
  const rootRef = useRef<HTMLElement | null>(null);
  const wantScroll = params.get("pt") === "today" && !manage;
  const scrolled = useRef(false);
  useEffect(() => {
    if (!wantScroll || scrolled.current || !res || !rootRef.current) return;
    scrolled.current = true;
    rootRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [wantScroll, res]);

  if (!data) return null;
  const today = data.today ?? kstToday();
  const busy = actions.save.isPending || actions.review.isPending;

  // 꺼져 있음 — 대표님에게만 켜는 카드(관리자 화면)
  if (!data.on || !res) {
    if (!manage || !data.can_set) return null;
    return (
      <div className="mb-4 rounded-2xl border border-border p-4">
        <p className="text-body font-black text-foreground">PT 기록이 꺼져 있어요</p>
        <p className="mb-3 mt-1 text-label text-muted-foreground">
          켜면 코치 화면에 「오늘 PT」가 생기고, PT 회원이 입장하면 코치님께 알림이 가요. 수당 계산은 지금 그대로예요.
        </p>
        <OpsButton
          tone="dark"
          disabled={actions.setting.isPending}
          onClick={() =>
            actions.setting.mutate(
              { record_on: true, notify_on: true, started_on: today },
              { onSuccess: () => toast.success("PT 기록을 켰어요"), onError: (e) => toast.error((e as Error).message) },
            )
          }
        >
          이 지점에서 켜기
        </OpsButton>
      </div>
    );
  }

  const rows = coachId ? res.rows.filter((r) => r.s.coach_staff_id === coachId) : res.rows;
  const extras = coachId ? res.extras.filter((x) => x.coachId === coachId) : res.extras;
  const counts = ptCounts(res, coachId, manage);
  const showTodo = counts.total > 0 || rows.some((r) => r.needReview);

  const editRow = (r: PtRow) =>
    setSheet({
      row: r,
      draft: {
        id: r.s.id,
        member_user_id: r.s.member_user_id,
        member_name: r.s.member_name,
        kind: r.s.kind,
        session_date: r.s.session_date,
        uses: r.s.uses || 1,
        moved_to: r.s.moved_to,
        no_entry_reason: r.s.no_entry_reason,
        note: r.s.note ?? "",
      },
    });
  const quick = (userId: string, name: string, kind: PtKind, date: string) =>
    actions.save.mutate(
      ptDraftPayload(branch, emptyDraft(today, { member_user_id: userId, member_name: name, kind, session_date: date, coach_staff_id: manage ? coachId : undefined })),
      {
        onSuccess: () => toast.success(kind === "lesson" ? "수업을 기록했어요 — 브로제이 차감도 해 주세요" : "개인 운동으로 닫았어요"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  const review = (r: PtRow) =>
    actions.review.mutate(r.s.id, { onSuccess: () => toast.success("확인했어요"), onError: (e) => toast.error((e as Error).message) });

  const todo = showTodo && (
    <>
      <OpsLabel>확인 필요{counts.total > 0 ? ` ${counts.total}` : ""}</OpsLabel>
      <TodoList
        res={res}
        rows={rows}
        extras={extras}
        manage={manage}
        busy={busy}
        onRecord={setSheet}
        onEdit={editRow}
        onQuick={(u, kind) => quick(u.userId, u.name, kind, u.date)}
        onReview={review}
      />
    </>
  );
  const sheetEl = <RecordSheet init={sheet} onClose={() => setSheet(null)} branch={branch} data={data} manage={manage} coachId={coachId} actions={actions} />;
  const sampleNote = data.sample && (
    <p className="mb-3 rounded-xl bg-secondary/60 px-3 py-2 text-label font-bold text-muted-foreground">예시 화면이에요 — 지어낸 회원이고, 눌러도 저장되지 않아요</p>
  );

  // ── 관리자 화면 (근무자 카드 'PT' 탭)
  if (manage) {
    const ym = (month ?? monthOf(today)).slice(0, 7);
    const cmp = ptMonthCompare(res, data.events ?? [], ym, coachId);
    const monthRows = rows.filter((r) => r.s.session_date.startsWith(ym));
    const shown = more ? monthRows : monthRows.slice(0, 8);
    return (
      <div className="mb-5">
        {sampleNote}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border p-4">
            <p className="text-label text-muted-foreground">{Number(ym.slice(5, 7))}월 차감 기준</p>
            <p className="mt-0.5 text-title font-black tabular-nums text-foreground">{cmp.byDeduct}회</p>
            <p className="text-label text-muted-foreground">지금 수당 기준</p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-label text-muted-foreground">기록 기준</p>
            <p className="mt-0.5 text-title font-black tabular-nums text-foreground">{cmp.byRecord}회</p>
            <p className="text-label text-muted-foreground">기록 + 차감이 맞은 수업</p>
          </div>
        </div>
        {cmp.noEntry > 0 && (
          <p className={cn("mt-2 rounded-xl px-3 py-2 text-label font-bold", cmp.noEntryOver ? "bg-amber-50 text-amber-800" : "bg-secondary/60 text-muted-foreground")}>
            출석 체크 없는 수업 {cmp.noEntry}회{cmp.noEntryOver ? ` — 한 달 ${PT_NO_ENTRY_MONTH_LIMIT}회를 넘었어요` : ""}
          </p>
        )}
        {todo}
        <div className="mb-1.5 mt-4 flex items-center justify-between">
          <p className="text-label font-bold text-muted-foreground">수업 기록 ({Number(ym.slice(5, 7))}월 · {monthRows.length}건)</p>
          <button
            type="button"
            onClick={() => setSheet({ draft: emptyDraft(today) })}
            className="flex h-9 items-center gap-1 rounded-full bg-foreground px-3 text-label font-black text-background active:scale-95"
          >
            <Plus className="h-4 w-4" /> 기록
          </button>
        </div>
        {monthRows.length === 0 ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">이 달 수업 기록이 아직 없어요</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
            {shown.map((r) => (
              <RecordRow key={r.s.id} r={r} onClick={() => editRow(r)} />
            ))}
          </ul>
        )}
        {monthRows.length > 8 && (
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 w-full text-center text-label font-bold text-muted-foreground">
            {more ? "접기" : `${monthRows.length - 8}건 더 보기`}
          </button>
        )}
        {data.can_set && !demo && (
          <div className="mt-3 text-right">
            {offAsk ? (
              <button
                type="button"
                disabled={actions.setting.isPending}
                onClick={() =>
                  actions.setting.mutate(
                    { record_on: false, notify_on: false },
                    {
                      onSuccess: () => {
                        toast.success("PT 기록을 껐어요 — 적어 둔 기록은 남아 있어요");
                        setOffAsk(false);
                      },
                      onError: (e) => toast.error((e as Error).message),
                    },
                  )
                }
                className="text-label font-bold text-destructive underline underline-offset-2"
              >
                정말 끌게요 (기록은 남아요)
              </button>
            ) : (
              <button type="button" onClick={() => setOffAsk(true)} className="text-label font-bold text-muted-foreground underline underline-offset-2">
                이 지점 PT 기록 끄기
              </button>
            )}
          </div>
        )}
        {payBelow && <p className="mb-1 mt-5 border-t border-border pt-4 text-label font-bold text-muted-foreground">수당 (차감 기록 기준)</p>}
        {sheetEl}
      </div>
    );
  }

  // ── 코치 화면 「오늘 PT」
  const items = ptTodayList(data, res);
  const recent = rows.filter((r) => r.s.session_date !== today);
  const shownRecent = more ? recent : recent.slice(0, 5);
  return (
    <section ref={rootRef} className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
      {sampleNote}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">오늘 PT</h2>
        <button
          type="button"
          onClick={() => setSheet({ draft: emptyDraft(today) })}
          className="flex h-9 items-center gap-1 rounded-full bg-foreground px-3 text-label font-black text-background active:scale-95"
        >
          <Plus className="h-4 w-4" /> 안 온 회원 기록
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">
          오늘 들어온 PT 회원이 아직 없어요 — 회원이 입장하면 여기에 떠요
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
          {items.map((i) => {
            const st = i.row ? ptRowStatus(i.row) : null;
            const info = (
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">{i.name}</p>
                <p className="truncate text-label text-muted-foreground">
                  {i.at ? `입장 ${hm(i.at)}` : "입장 없음"}
                  {i.member?.remaining != null ? ` · 남음 ${i.member.remaining}회` : ""}
                </p>
              </div>
            );
            if (i.row) {
              return (
                <li key={i.key}>
                  <button type="button" onClick={() => editRow(i.row!)} className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-secondary/60">
                    {info}
                    <span className="shrink-0 text-right">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-micro font-bold", KIND_CLS[i.row.s.kind])}>{PT_KIND_LABEL[i.row.s.kind]}</span>
                      {st?.text && <span className={cn("block text-label font-bold", TONE[st.tone])}>{st.text}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            }
            return (
              <li key={i.key} className="px-4 py-3">
                {info}
                {i.userId && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} className={plainBtn} onClick={() => quick(i.userId!, i.member?.name ?? i.name, "self", today)}>
                      개인 운동
                    </button>
                    <button type="button" disabled={busy} className={mainBtn} onClick={() => quick(i.userId!, i.member?.name ?? i.name, "lesson", today)}>
                      수업 완료
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {todo}
      {recent.length > 0 && (
        <>
          <OpsLabel>최근 기록</OpsLabel>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
            {shownRecent.map((r) => (
              <RecordRow key={r.s.id} r={r} onClick={() => editRow(r)} />
            ))}
          </ul>
          {recent.length > 5 && (
            <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 w-full text-center text-label font-bold text-muted-foreground">
              {more ? "접기" : `${recent.length - 5}건 더 보기`}
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-label text-muted-foreground">
        수업권 차감은 지금처럼 브로제이에서 해 주세요 — 앱은 차감을 하루 이틀 안에 읽어 기록과 맞춰 봐요
      </p>
      {sheetEl}
    </section>
  );
};

/** 예시 화면 — 근무 탭이 아직 없는 곳(옛 DB 를 보는 미리보기)에서 `/office?tab=work&demo=1` 로 본다 */
export const OpsPtRecordDemo = () => {
  const [view, setView] = useState<"coach" | "manage">("coach");
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <OpsChip on={view === "coach"} onClick={() => setView("coach")}>
          코치 화면
        </OpsChip>
        <OpsChip on={view === "manage"} onClick={() => setView("manage")}>
          관리자 화면
        </OpsChip>
      </div>
      {view === "coach" ? (
        <OpsPtRecord branch="예시 지점" coachId={PT_SAMPLE_COACH} demo />
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-heading font-black text-foreground">예시 코치 · PT</h2>
          <OpsPtRecord branch="예시 지점" manage coachId={PT_SAMPLE_COACH} demo />
        </section>
      )}
    </div>
  );
};

export default OpsPtRecord;
