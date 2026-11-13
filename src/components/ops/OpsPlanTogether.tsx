/**
 * 153운영본부 · 「일정」 — 함께 쓰기 (캘린더 3-3단계 · 2026-11-13 대표님 「남은거 진행하자」)
 *   · 답할 초대 카드 · 초대 응답 시트(참석 · 아마 · 못 가요 · 메모 60자 · 다른 시간 제안 · 회의 링크 · 첨부 · 함께하는 사람)
 *   · 손님 고르기(그 지점 팀만 · 20명) · 일정 시트의 '함께하는 사람'(답 · 메모 · 제안 → 「이 시간으로」)
 *   · 시간 찾기(나 + 1 ~ 5명 · 30 / 60 / 90분 · 7일 · 근무 시간 안 · 칸 3개 → 누르면 그 시간 · 그 사람들로 새 일정)
 *   · 캘린더 켜고 끄기(DB 에 — 내 일정 · 초대 · 근무 · 153 일정 · 정기 회의 · 팀 바쁨) · 기본 알림 · 시간 인사이트 ·
 *     휴무를 넣은 뒤 그 기간의 수업 · PT · 근무 → 「근무」 탭 대타 요청 · 겹쳐 그린 캘린더(153 일정 · 정기 회의) 보기 · 첨부
 *   계산은 src/lib/opsPlans.ts · 서버는 src/services/opsPlanService.ts (3-3 함수가 없으면 부르는 쪽이 숨긴다)
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, FileText, Image as ImageIcon, Paperclip, Video, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { MEETING_LINK_LABEL, meetingLinkKind } from "@/lib/meetingLink";
import {
  CAL_LAYERS,
  INSIGHT_KEYS,
  INSIGHT_META,
  PLAN_ATTACH_MAX,
  PLAN_GUEST_MAX,
  PLAN_NOTE_MAX,
  REMINDER_MAX,
  REMINDER_OPTIONS,
  RESPONSE_META,
  addDays,
  calsOff,
  guestLine,
  guestProposals,
  insightTotal,
  isRepeat,
  minutesLabel,
  mondayOf,
  offOverlaps,
  planDay,
  planMeta,
  planRepeatLabel,
  planTitle,
  proposalLabel,
  responseKey,
  timeLabel,
  type CalKey,
  type DayItem,
  type InsightRow,
  type OpsPlan,
  type PlanAttachment,
  type PlanGuest,
  type PlanMember,
  type PlansWeek,
  type TeamPerson,
} from "@/lib/opsPlans";
import {
  planFileError,
  planFileUrl,
  uploadPlanFile,
  useOpsPlanFindTimes,
  useOpsPlanInsights,
  useOpsPlanPrefsSave,
  useOpsPlanRespond,
  useOpsPlansRange,
  type FindTimesResult,
} from "@/services/opsPlanService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

/** 줌 · 미트 · 첨부 열기 — 아이폰 앱은 앱 안 사파리 창 */
const openOutside = (url: string) => {
  if (isIosApp()) void loadIosAppNative().then((n) => n.openInAppBrowser(url));
  else window.open(url, "_blank", "noopener,noreferrer");
};

/** "11월 17일 (화) 19:00~20:00" · 반복이면 "매주 화 · 19:00~20:00" */
const whenOf = (p: OpsPlan, date: string | null): string => {
  const time = timeLabel(p.all_day, p.start_time, p.end_time);
  if (date) return `${planDay(date)} ${time}`;
  return isRepeat(p) ? `${planRepeatLabel(p)} · ${time}` : `${planDay(p.start_on)} ${time}`;
};

// ───────────────────────── 회의 링크 단추 ─────────────────────────
export const MeetLinkButton = ({ url }: { url: string }) => {
  const kind = meetingLinkKind(url);
  return (
    <button
      type="button"
      onClick={() => openOutside(url)}
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-body font-black text-white active:scale-[0.99]"
    >
      <Video className="h-4 w-4" aria-hidden /> {MEETING_LINK_LABEL[kind]} 회의 들어가기
    </button>
  );
};

// ───────────────────────── 첨부 ─────────────────────────
const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export const PlanAttachments = ({
  items,
  uid,
  editable,
  onChange,
}: {
  items: PlanAttachment[];
  uid: string | null;
  editable: boolean;
  onChange?: (next: PlanAttachment[]) => void;
}) => {
  const [busy, setBusy] = useState(false);
  if (!editable && items.length === 0) return null;
  const open = async (a: PlanAttachment) => {
    try {
      openOutside(await planFileUrl(a.path));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const add = async (file: File | undefined) => {
    if (!file || !uid || !onChange) return;
    const err = planFileError(file);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const a = await uploadPlanFile(uid, file);
      onChange([...items, a]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      {items.map((a) => {
        const Icon = a.type.startsWith("image/") ? ImageIcon : FileText;
        return (
          <div key={a.path} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <button type="button" onClick={() => void open(a)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-body font-bold text-foreground">{a.name}</span>
              <span className="block text-label text-muted-foreground">{sizeLabel(a.size)} · 눌러서 보기</span>
            </button>
            {editable && onChange && (
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x.path !== a.path))}
                aria-label={`${a.name} 빼기`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
      {editable && onChange && items.length < PLAN_ATTACH_MAX && (
        <label
          className={cn(
            "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-label font-bold text-foreground active:scale-[0.99]",
            (busy || !uid) && "pointer-events-none opacity-50",
          )}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
          {busy ? "올리는 중…" : "사진 · PDF 넣기"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="sr-only"
            aria-label="첨부 파일 넣기"
            disabled={busy || !uid}
            onChange={(e) => {
              void add(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
};

// ───────────────────────── 손님 목록 (답 칩) ─────────────────────────
export const GuestList = ({ guests, meUid }: { guests: PlanGuest[]; meUid?: string | null }) => (
  <ul className="space-y-1.5">
    {guests.map((g) => {
      const meta = RESPONSE_META[responseKey(g.response)];
      return (
        <li key={g.user_id} className="flex items-start gap-2">
          <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", meta.chip)}>{meta.label}</span>
          <span className="min-w-0 flex-1">
            <span className="text-body font-bold text-foreground">
              {g.name}
              {g.user_id === meUid ? " · 나" : ""}
            </span>
            {(g.auto || g.note || g.proposed_on) && (
              <span className="block text-label text-muted-foreground">
                {[g.auto ? "휴무라 저절로 '아니요'" : g.note ? `"${g.note}"` : null, g.proposed_on ? `제안 ${proposalLabel(g)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </span>
        </li>
      );
    })}
  </ul>
);

// ───────────────────────── 손님 고르기 ─────────────────────────
export const GuestPicker = ({
  open,
  team,
  selected,
  onChange,
  onClose,
}: {
  open: boolean;
  team: TeamPerson[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}) => {
  const others = team.filter((t) => !t.me);
  const toggle = (uid: string) => {
    if (selected.includes(uid)) onChange(selected.filter((x) => x !== uid));
    else if (selected.length < PLAN_GUEST_MAX) onChange([...selected, uid]);
  };
  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      stacked
      title="함께하는 사람"
      sub="같은 지점 팀만 · 저장하면 알림이 가요"
      footer={<OpsButton onClick={onClose}>{selected.length ? `${selected.length}명 골랐어요` : "닫기"}</OpsButton>}
    >
      {others.length === 0 ? (
        <p className="text-body text-muted-foreground">이 지점에 함께할 팀원이 아직 없어요</p>
      ) : (
        <ul className="divide-y divide-border">
          {others.map((t) => {
            const on = selected.includes(t.user_id);
            return (
              <li key={t.user_id}>
                <button type="button" onClick={() => toggle(t.user_id)} aria-pressed={on} className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-label font-black",
                      on ? "border-foreground bg-foreground text-background" : "border-border",
                    )}
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 text-body font-bold text-foreground">
                    {t.name}
                    <span className="ml-1.5 text-label font-bold text-muted-foreground">{t.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </OpsSheet>
  );
};

/** 일정 시트의 '함께하는 사람' — 고른 사람 칩(고칠 때는 답) · 사람 고르기 · 제안 → 「이 시간으로」 */
export const GuestsEditor = ({
  team,
  selected,
  plan,
  onChange,
  onUseProposal,
}: {
  team: TeamPerson[];
  selected: string[];
  /** 고치는 일정 (손님 답 · 제안을 보여 줌) */
  plan: OpsPlan | null;
  onChange: (next: string[]) => void;
  onUseProposal: (g: PlanGuest) => void;
}) => {
  const [picking, setPicking] = useState(false);
  const known = new Map((plan?.guests ?? []).map((g) => [g.user_id, g]));
  const nameOf = (uid: string) => team.find((t) => t.user_id === uid)?.name ?? known.get(uid)?.name ?? "팀원";
  const proposals = guestProposals(plan?.guests).filter((g) => selected.includes(g.user_id));
  if (team.filter((t) => !t.me).length === 0 && selected.length === 0) return null;
  return (
    <>
      <OpsLabel>함께하는 사람 (선택)</OpsLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((uid) => {
          const g = known.get(uid);
          const meta = g ? RESPONSE_META[responseKey(g.response)] : null;
          return (
            <span key={uid} className="flex h-9 items-center gap-1 rounded-full border border-border bg-background pl-3 pr-1 text-label font-bold text-foreground">
              {nameOf(uid)}
              {meta && <span className={cn("rounded px-1 text-micro font-black", meta.chip)}>{meta.label}</span>}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== uid))}
                aria-label={`${nameOf(uid)} 빼기`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex h-9 items-center rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
        >
          + 사람 고르기
        </button>
      </div>
      {plan && (plan.guests ?? []).some((g) => g.note || g.auto) && (
        <ul className="mt-2 space-y-0.5">
          {(plan.guests ?? [])
            .filter((g) => (g.note || g.auto) && selected.includes(g.user_id))
            .map((g) => (
              <li key={g.user_id} className="text-label text-muted-foreground">
                {g.name} · {g.auto ? "휴무라 저절로 '아니요'" : `"${g.note}"`}
              </li>
            ))}
        </ul>
      )}
      {proposals.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-2xl bg-secondary/60 p-3">
          {proposals.map((g) => (
            <div key={g.user_id} className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-label text-foreground">
                <span className="font-black">{g.name}</span>님 제안 · {proposalLabel(g)}
              </p>
              <button
                type="button"
                onClick={() => onUseProposal(g)}
                className="h-9 shrink-0 rounded-full bg-foreground px-3 text-label font-black text-background active:scale-95"
              >
                이 시간으로
              </button>
            </div>
          ))}
        </div>
      )}
      <GuestPicker open={picking} team={team} selected={selected} onChange={onChange} onClose={() => setPicking(false)} />
    </>
  );
};

// ───────────────────────── 답할 초대 카드 ─────────────────────────
export const PlanInvitesCard = ({ invites, onOpen }: { invites: OpsPlan[]; onOpen: (p: OpsPlan, date: string | null) => void }) => {
  if (invites.length === 0) return null;
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">답할 초대</h2>
        <span className="text-label text-muted-foreground">{invites.length}개</span>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {invites.slice(0, 5).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p, p.next_on ?? null)} className="flex w-full items-center gap-2 py-3 text-left active:bg-secondary/60">
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", planMeta(p).chip)}>{planMeta(p).label}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-foreground">{planTitle(p)}</span>
                <span className="block truncate text-label text-muted-foreground">
                  {p.owner_name ?? "팀원"}님 · {whenOf(p, p.next_on ?? null)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ───────────────────────── 초대 응답 시트 ─────────────────────────
type Reply = "yes" | "maybe" | "no";
const REPLIES: ReadonlyArray<{ key: Reply; label: string }> = [
  { key: "yes", label: "참석" },
  { key: "maybe", label: "아마" },
  { key: "no", label: "못 가요" },
];

export const PlanInviteSheet = ({
  target,
  meUid,
  today,
  onClose,
}: {
  target: { plan: OpsPlan; date: string | null } | null;
  meUid: string | null;
  today: string;
  onClose: () => void;
}) => {
  const respond = useOpsPlanRespond();
  const [last, setLast] = useState(target);
  const [reply, setReply] = useState<Reply | null>(null);
  const [note, setNote] = useState("");
  const [propose, setPropose] = useState(false);
  const [pOn, setPOn] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");

  useEffect(() => {
    if (!target) return;
    setLast(target);
    const mine = (target.plan.guests ?? []).find((g) => g.user_id === meUid);
    setReply((target.plan.my_response ?? null) as Reply | null);
    setNote(mine?.note && !mine.auto ? mine.note : "");
    setPropose(!!mine?.proposed_on);
    setPOn(mine?.proposed_on ?? target.date ?? target.plan.start_on);
    setPStart(mine?.proposed_start ?? target.plan.start_time ?? "19:00");
    setPEnd(mine?.proposed_end ?? target.plan.end_time ?? "20:00");
  }, [target, meUid]);

  const t = target ?? last;
  if (!t) return null;
  const p = t.plan;
  const mine = (p.guests ?? []).find((g) => g.user_id === meUid);
  const proposeErr =
    propose && (!pOn || pOn < today || (!p.all_day && (!pStart || !pEnd || pEnd <= pStart))) ? "제안 시간을 확인해 주세요" : null;
  const err = !reply ? "답을 골라 주세요" : note.trim().length > PLAN_NOTE_MAX ? `메모는 ${PLAN_NOTE_MAX}자까지예요` : proposeErr;

  const send = () => {
    if (err || !reply) return;
    respond.mutate(
      {
        plan: p.id,
        response: reply,
        note: note.trim() || null,
        on: propose ? pOn : null,
        start: propose && !p.all_day ? pStart : null,
        end: propose && !p.all_day ? pEnd : null,
      },
      {
        onSuccess: () => {
          toast.success(propose ? "다른 시간을 제안했어요" : reply === "yes" ? "참석으로 답했어요" : reply === "maybe" ? "'아마'로 답했어요" : "'못 가요'로 답했어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <OpsSheet
      open={!!target}
      onClose={onClose}
      title="초대받은 일정"
      sub={`${p.owner_name ?? "팀원"}님이 초대했어요`}
      footer={
        <div className="space-y-2">
          {err && reply && <p className="text-center text-label text-muted-foreground">{err}</p>}
          <OpsButton onClick={send} disabled={!!err || respond.isPending}>
            {respond.isPending ? "보내는 중…" : propose ? "제안 보내기" : "답 보내기"}
          </OpsButton>
        </div>
      }
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("rounded-md px-1.5 py-0.5 text-micro font-black", planMeta(p).chip)}>{planMeta(p).label}</span>
        {mine?.auto && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-micro font-black text-rose-800">휴무라 저절로 '아니요'</span>}
      </div>
      <p className="mt-2 text-title font-black leading-tight text-foreground">{planTitle(p)}</p>
      <p className="mt-1 text-body font-bold tabular-nums text-foreground">{whenOf(p, t.date)}</p>
      {isRepeat(p) && t.date && <p className="text-label text-muted-foreground">{planRepeatLabel(p)} · 답은 반복 전체에</p>}
      {p.location && <p className="mt-1 text-body text-muted-foreground">{p.location}</p>}
      {p.memo && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-secondary/60 px-3 py-2 text-body text-foreground">{p.memo}</p>}
      {p.meet_url && (
        <div className="mt-3">
          <MeetLinkButton url={p.meet_url} />
        </div>
      )}
      {(p.attachments ?? []).length > 0 && (
        <>
          <OpsLabel>첨부</OpsLabel>
          <PlanAttachments items={p.attachments ?? []} uid={null} editable={false} />
        </>
      )}
      {(p.guests ?? []).length > 0 && (
        <>
          <OpsLabel>함께하는 사람 · {guestLine(p.guests)}</OpsLabel>
          <GuestList guests={p.guests ?? []} meUid={meUid} />
        </>
      )}

      <OpsLabel>내 답</OpsLabel>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/70 p-1">
        {REPLIES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={reply === r.key}
            onClick={() => setReply(r.key)}
            className={cn(
              "h-11 rounded-xl text-body font-black transition-all active:scale-[0.98]",
              reply === r.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, PLAN_NOTE_MAX))}
        placeholder="한마디 (선택) — 예) 10분 늦어요"
        maxLength={PLAN_NOTE_MAX}
        className={cn(opsInput, "mt-2")}
        aria-label="한마디"
      />
      <label className="mt-3 flex items-center gap-2 text-body text-foreground">
        <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} className="h-5 w-5" />
        다른 시간 제안하기
      </label>
      {propose && (
        <div className="mt-2 space-y-2 rounded-2xl bg-secondary/50 p-3">
          <input type="date" value={pOn} min={today} max={addDays(today, 400)} onChange={(e) => setPOn(e.target.value)} className={opsInput} aria-label="제안하는 날" />
          {!p.all_day && (
            <div className="flex items-center gap-1.5">
              <input type="time" step={300} value={pStart} onChange={(e) => setPStart(e.target.value)} className={`${opsInput} py-2`} aria-label="제안 시작 시각" />
              <span className="text-body text-muted-foreground">~</span>
              <input type="time" step={300} value={pEnd} onChange={(e) => setPEnd(e.target.value)} className={`${opsInput} py-2`} aria-label="제안 끝 시각" />
            </div>
          )}
          <p className="text-label text-muted-foreground">만든 분이 그 시간으로 바꾸면 모두에게 알림이 가요</p>
        </div>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 시간 찾기 ─────────────────────────
const FIND_MINUTES = [30, 60, 90] as const;

export const PlanFindTimeSheet = ({
  open,
  branch,
  team,
  onPick,
  onClose,
}: {
  open: boolean;
  branch: string;
  team: TeamPerson[];
  onPick: (slot: { date: string; start: string; end: string }, users: string[]) => void;
  onClose: () => void;
}) => {
  const find = useOpsPlanFindTimes();
  const [users, setUsers] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number>(60);
  const [res, setRes] = useState<FindTimesResult | null>(null);
  useEffect(() => {
    if (!open) {
      setRes(null);
      find.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const others = team.filter((t) => !t.me);
  const toggle = (uid: string) => {
    setRes(null);
    setUsers((u) => (u.includes(uid) ? u.filter((x) => x !== uid) : u.length >= 5 ? u : [...u, uid]));
  };
  const run = () =>
    find.mutate(
      { branch, users, minutes },
      {
        onSuccess: (r) => setRes(r),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  const loose = res?.people.filter((p) => p.window === "default").map((p) => p.name) ?? [];

  return (
    <OpsSheet open={open} onClose={onClose} title="시간 찾기" sub="나와 함께할 1 ~ 5명 · 오늘부터 7일 · 근무 시간 안">
      <OpsLabel>함께할 사람</OpsLabel>
      {others.length === 0 ? (
        <p className="text-body text-muted-foreground">이 지점에 함께할 팀원이 아직 없어요</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {others.map((t) => (
            <OpsChip key={t.user_id} on={users.includes(t.user_id)} onClick={() => toggle(t.user_id)} disabled={!users.includes(t.user_id) && users.length >= 5}>
              {t.name}
            </OpsChip>
          ))}
        </div>
      )}
      <OpsLabel>얼마나</OpsLabel>
      <div className="flex gap-1.5">
        {FIND_MINUTES.map((m) => (
          <OpsChip
            key={m}
            on={minutes === m}
            onClick={() => {
              setMinutes(m);
              setRes(null);
            }}
          >
            {minutesLabel(m)}
          </OpsChip>
        ))}
      </div>
      <div className="mt-4">
        <OpsButton onClick={run} disabled={users.length === 0 || find.isPending}>
          {find.isPending ? "찾는 중…" : "비는 시간 찾기"}
        </OpsButton>
      </div>
      {res && (
        <div className="mt-4">
          {res.slots.length === 0 ? (
            <p className="text-body text-muted-foreground">7일 안에 모두 근무하면서 비는 시간이 없어요 — 근무 시간이 겹치는 사람으로 줄이거나 30분으로 찾아 보세요</p>
          ) : (
            <>
              <p className="text-label font-bold text-muted-foreground">누르면 그 시간 · 그 사람들로 일정을 넣어요</p>
              <ul className="mt-2 space-y-2">
                {res.slots.map((s) => (
                  <li key={`${s.date}${s.start}`}>
                    <button
                      type="button"
                      onClick={() => onPick(s, users)}
                      className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-left active:scale-[0.99]"
                    >
                      <span>
                        <span className="block text-body font-black text-foreground">
                          {planDay(s.date)}
                          {s.date === res.from ? " · 오늘" : ""}
                        </span>
                        <span className="block text-body font-bold tabular-nums text-primary">
                          {s.start}~{s.end}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {loose.length > 0 && <p className="mt-2 text-label text-muted-foreground">근무 시간표가 없는 {loose.join(" · ")}님은 9시 ~ 22시로 봤어요</p>}
        </div>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 캘린더 켜고 끄기 · 기본 알림 ─────────────────────────
export const PlanCalendarsSheet = ({
  open,
  data,
  hasEvents,
  hasMeetings,
  hasTodo = false,
  onClose,
}: {
  open: boolean;
  data: PlansWeek;
  hasEvents: boolean;
  hasMeetings: boolean;
  /** (3-4) 할 일 함수가 있는 DB — '할 일 마감' 칸 */
  hasTodo?: boolean;
  onClose: () => void;
}) => {
  const save = useOpsPlanPrefsSave();
  // 누르자마자 바뀌어 보이게 — 서버 답이 오면(다시 읽기) 그 값으로 (실패하면 되돌림)
  const [local, setLocal] = useState<{ off?: CalKey[]; remind?: number[]; brief?: boolean }>({});
  useEffect(() => setLocal({}), [data.prefs]);
  const off = new Set<CalKey>(local.off ?? [...calsOff(data)]);
  const layers = CAL_LAYERS.filter(
    (l) => (l.key !== "events" || hasEvents) && (l.key !== "meetings" || hasMeetings) && (l.key !== "team" || (data.team ?? []).length > 1) && (l.key !== "todo" || hasTodo),
  );
  const remind = local.remind ?? data.prefs?.remind_default ?? [10];
  const briefOn = local.brief ?? data.prefs?.brief_on !== false;
  const fail = (e: unknown) => {
    setLocal({});
    toast.error((e as Error).message);
  };

  const toggle = (k: CalKey) => {
    const next = new Set(off);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setLocal((l) => ({ ...l, off: [...next] }));
    save.mutate({ cals_off: [...next] }, { onError: fail });
  };
  const toggleRemind = (min: number | null) => {
    let next: number[];
    if (min === null) next = [];
    else if (remind.includes(min)) next = remind.filter((x) => x !== min);
    else if (remind.length >= REMINDER_MAX) return;
    else next = [...remind, min].sort((a, b) => a - b);
    setLocal((l) => ({ ...l, remind: next }));
    save.mutate({ remind_default: next }, { onError: fail });
  };

  return (
    <OpsSheet open={open} onClose={onClose} title="캘린더" sub="이 계정에 저장돼요 — 다른 기기도 같아요">
      <ul className="divide-y divide-border">
        {layers.map((l) => {
          const on = !off.has(l.key);
          return (
            <li key={l.key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={save.isPending}
                onClick={() => toggle(l.key)}
                className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60 disabled:opacity-60"
              >
                <span className={cn("h-3 w-3 shrink-0 rounded-full", l.dot)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold text-foreground">{l.label}</span>
                  <span className="block text-label text-muted-foreground">{l.hint}</span>
                </span>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")} aria-hidden>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", on ? "left-[1.125rem]" : "left-0.5")} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        role="switch"
        aria-checked={briefOn}
        disabled={save.isPending}
        onClick={() => {
          const next = !briefOn;
          setLocal((l) => ({ ...l, brief: next }));
          save.mutate(
            { brief_on: next },
            {
              onSuccess: () => toast.success(next ? "아침 8시에 그날 일정을 알려 드릴게요" : "아침 브리핑을 껐어요"),
              onError: fail,
            },
          );
        }}
        className="mt-2 flex w-full items-center gap-3 border-t border-border py-3 text-left active:bg-secondary/60 disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">아침 8시 브리핑</span>
          <span className="block text-label text-muted-foreground">그날 일정 · 할 일 · 약속한 회원이 있을 때만</span>
        </span>
        <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", briefOn ? "bg-primary" : "bg-muted-foreground/30")} aria-hidden>
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", briefOn ? "left-[1.125rem]" : "left-0.5")} />
        </span>
      </button>

      <OpsLabel>기본 알림 — 새 일정 · 참석하는 초대 (4개까지)</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        <OpsChip on={remind.length === 0} onClick={() => toggleRemind(null)} disabled={save.isPending}>
          없음
        </OpsChip>
        {REMINDER_OPTIONS.map((o) => (
          <OpsChip
            key={o.min}
            on={remind.includes(o.min)}
            disabled={save.isPending || (!remind.includes(o.min) && remind.length >= REMINDER_MAX)}
            onClick={() => toggleRemind(o.min)}
          >
            {o.label}
          </OpsChip>
        ))}
      </div>
      <p className="mt-2 text-label text-muted-foreground">밤 10시 ~ 아침 8시 알림은 알림함에만 들어가요</p>
    </OpsSheet>
  );
};

// ───────────────────────── 시간 인사이트 ─────────────────────────
const InsightBar = ({ row, max }: { row: InsightRow; max: number }) => {
  const total = insightTotal(row);
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
      {INSIGHT_KEYS.filter((k) => row[k] > 0).map((k) => (
        <span key={k} className={cn("h-full", INSIGHT_META[k].dot)} style={{ width: `${(row[k] / Math.max(max, total, 1)) * 100}%` }} />
      ))}
    </div>
  );
};

export const PlanInsightsCard = ({ branch, today }: { branch: string; today: string }) => {
  const [week, setWeek] = useState<"this" | "last">("this");
  const [open, setOpen] = useState(false);
  const monday = week === "this" ? mondayOf(today) : addDays(mondayOf(today), -7);
  const q = useOpsPlanInsights(branch, monday, true);
  const rows = q.data?.rows ?? [];
  const me = rows.find((r) => r.me) ?? (q.data?.manage ? null : rows[0] ?? null);
  const team = q.data?.manage ? rows.filter((r) => !r.me && (insightTotal(r) > 0 || r.shift > 0)) : [];
  const max = Math.max(1, ...rows.map((r) => Math.max(insightTotal(r), r.shift)));
  if (!q.data?.available) return null;
  const summary = me
    ? INSIGHT_KEYS.filter((k) => me[k] > 0)
        .map((k) => `${INSIGHT_META[k].label} ${minutesLabel(me[k])}`)
        .join(" · ")
    : "";

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">{week === "this" ? "이번 주" : "지난주"} 시간</h2>
        <div className="flex gap-1">
          <OpsChip on={week === "this"} onClick={() => setWeek("this")}>
            이번 주
          </OpsChip>
          <OpsChip on={week === "last"} onClick={() => setWeek("last")}>
            지난주
          </OpsChip>
        </div>
      </div>
      {me && (
        <>
          <p className="mt-2 text-body font-bold text-foreground">{summary || "잡힌 수업 · PT · 업무 · 회의가 없어요"}</p>
          {me.shift > 0 && <p className="text-label text-muted-foreground">근무 시간 {minutesLabel(me.shift)}</p>}
          {insightTotal(me) > 0 && (
            <div className="mt-2">
              <InsightBar row={me} max={Math.max(insightTotal(me), me.shift)} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {INSIGHT_KEYS.filter((k) => me[k] > 0).map((k) => (
                  <span key={k} className="flex items-center gap-1 text-micro text-muted-foreground">
                    <span className={cn("h-1.5 w-3 rounded-full", INSIGHT_META[k].dot)} aria-hidden />
                    {INSIGHT_META[k].label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {team.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 flex h-11 w-full items-center justify-between border-t border-border pt-3 text-body font-bold text-foreground">
            코치님별 시간 ({team.length}명)
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />
          </button>
          {open && (
            <ul className="mt-1 space-y-3">
              {team.map((r) => (
                <li key={r.user_id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body font-bold text-foreground">{r.name}</span>
                    <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                      {minutesLabel(insightTotal(r))}
                      {r.shift > 0 ? ` / 근무 ${minutesLabel(r.shift)}` : ""}
                    </span>
                  </div>
                  <div className="mt-1">
                    <InsightBar row={r} max={max} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

// ───────────────────────── 휴무를 넣은 뒤 — 그 기간의 수업 · PT · 근무 ─────────────────────────
export const PlanOffSheet = ({
  target,
  me,
  today,
  canCover = true,
  onClose,
}: {
  target: { branch: string; start: string; end: string } | null;
  me: Pick<PlanMember, "key" | "user_id"> | null;
  today: string;
  /** 「대타 요청」 단추 — 코치 화면만(관리자 「근무」 화면은 cover 링크를 읽지 않는다 · 근무자 카드에서 바로 고친다) */
  canCover?: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const [last, setLast] = useState(target);
  useEffect(() => {
    if (target) setLast(target);
  }, [target]);
  const t = target ?? last;
  const q = useOpsPlansRange(t?.branch ?? null, t?.start ?? today, t?.end ?? today, !!target);
  const rows = useMemo(() => (t && me && q.data ? offOverlaps(q.data, me, t.start, t.end) : []), [t, me, q.data]);
  if (!t) return null;
  const monthEnd = (() => {
    const [y, m] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  })();
  const label = (i: DayItem) => (i.type === "plan" ? `${planMeta(i.plan).label} ${planTitle(i.plan)}` : "근무 시간");

  return (
    <OpsSheet
      open={!!target}
      onClose={onClose}
      title="휴무를 넣었어요"
      sub={t.end > t.start ? `${planDay(t.start)} – ${planDay(t.end)}` : planDay(t.start)}
      footer={<p className="text-center text-label text-muted-foreground">이 기간에 받는 초대(한 번 하는 일정)에는 저절로 '아니요'로 답해요</p>}
    >
      {q.isLoading ? (
        <p className="text-label text-muted-foreground">휴무 기간의 수업 · 근무를 찾는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-body text-muted-foreground">휴무 기간에 잡힌 수업 · PT · 근무가 없어요</p>
      ) : (
        <>
          <p className="text-body font-bold text-foreground">
            이 기간에 잡혀 있던 수업 · 근무예요 — 대타가 필요하면 「근무」 탭{canCover ? "에서 요청해요" : " 근무자 카드에서 정해요"}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.date} className="flex items-start gap-2 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-black text-foreground">{planDay(r.date)}</span>
                  {r.items.map((i) => (
                    <span key={i.id} className="block truncate text-label text-muted-foreground">
                      {timeLabel(i.allDay, i.start, i.end)} · {label(i)}
                    </span>
                  ))}
                </span>
                {canCover && r.date >= today && r.date <= monthEnd && r.items.some((i) => i.type === "shift") && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/office?tab=work&cover=${r.date}`);
                    }}
                    className="h-9 shrink-0 rounded-full bg-foreground px-3 text-label font-black text-background active:scale-95"
                  >
                    대타 요청
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canCover && rows.some((r) => r.date > monthEnd) && <p className="mt-2 text-label text-muted-foreground">다음 달 대타는 그 달이 되면 「근무」 탭에서 요청해요</p>}
        </>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 겹쳐 그린 캘린더 한 줄 보기 (153 일정 · 정기 회의) ─────────────────────────
export const PlanLayerSheet = ({ target, onClose }: { target: { plan: OpsPlan; date: string | null } | null; onClose: () => void }) => {
  const navigate = useNavigate();
  const [last, setLast] = useState(target);
  useEffect(() => {
    if (target) setLast(target);
  }, [target]);
  const t = target ?? last;
  if (!t) return null;
  const p = t.plan;
  const meeting = p.layer === "meeting";
  return (
    <OpsSheet
      open={!!target}
      onClose={onClose}
      title={meeting ? "정기 회의" : "153 일정"}
      sub={meeting ? "사무실 정기 회의 — 1시간으로 그렸어요" : `${p.layer_kind ?? "153 일정"} · 회원 달력에도 보여요`}
      footer={
        meeting ? (
          <div className="space-y-2">
            {p.layer_url && <MeetLinkButton url={p.layer_url} />}
            <OpsButton
              tone="plain"
              onClick={() => {
                onClose();
                navigate("/office");
              }}
            >
              사무실로 가기
            </OpsButton>
          </div>
        ) : undefined
      }
    >
      <p className="text-title font-black leading-tight text-foreground">{planTitle(p)}</p>
      <p className="mt-1 text-body font-bold tabular-nums text-foreground">
        {t.date ? planDay(t.date) : planDay(p.start_on)}
        {!p.all_day ? ` ${p.start_time}~${p.end_time}` : p.end_on > p.start_on ? ` – ${planDay(p.end_on)}` : " · 하루 종일"}
      </p>
      {!meeting && <p className="mt-2 text-label text-muted-foreground">고치기 · 빼기는 아래 「회원 달력」 카드에서 해요</p>}
    </OpsSheet>
  );
};
