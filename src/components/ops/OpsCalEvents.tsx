/**
 * 📅 153운영본부 「일정」 탭 — 회원 달력 (2026-11-13 운동 달력 2-2단계 · 대표님 「다음」 → 153 일정은 「앱 운영본부에서」)
 *   지점장님 · 대표님이 휴관 · 단축 운영 · 이벤트 · 대회 · 특강 · 그 밖을 올리면 그 지점 회원 운동 달력에 바로 보이고
 *   알림이 간다(그날 아침 · 하루 전 저녁 — 고른 것만, 일정마다 한 번). 감정 설계 「오기 전 = 기대」.
 *   · 코치님은 보기만 — 올라간 일정이 없으면 카드도 그리지 않는다(빈 것은 그리지 않기).
 *   · 서버 ops_cal_events · ops_cal_event_save · ops_cal_event_remove (services/calendarEventService) — 함수가 없으면 카드 없음.
 *   글 · 검사 · 알림 한 줄은 src/lib/calendarEvents.ts. 회원 화면은 WorkoutCalendar(칸 점) · CalendarChecks(그날 카드).
 *   · (2-3 · 2026-11-13) 종류 '승급 심사' — 알림 · D-day 는 타이틀매치 차례(레벨 10) 회원에게만 (DB 는 kind event + is_exam).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, ChevronRight } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  EVENT_KINDS,
  EVENT_KIND_META,
  EVENT_TITLE_MAX,
  draftFromEvent,
  eventDraftError,
  eventRange,
  hmLabel,
  newEventDraft,
  noticeStatus,
  sendHint,
  upcomingEvents,
  type EventDraft,
  type EventKind,
  type OpsCalEvent,
  type OpsCalState,
} from "@/lib/calendarEvents";
import { shortBranch } from "@/services/opsService";
import { useOpsCalEvents, useRemoveOpsCalEvent, useSaveOpsCalEvent } from "@/services/calendarEventService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, kstToday, opsInput } from "./OpsParts";

const SHOW = 4;
const card = "rounded-2xl border border-border bg-card p-5";

const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const kstHm = (): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

const KindChip = ({ kind }: { kind: EventKind }) => (
  <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", EVENT_KIND_META[kind].chip)}>{EVENT_KIND_META[kind].label}</span>
);

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 OpsCalEvents) */
export const OpsCalEventsView = ({
  st,
  today,
  onAdd,
  onOpen,
}: {
  st: OpsCalState;
  today: string;
  onAdd: () => void;
  onOpen: (e: OpsCalEvent) => void;
}) => {
  const [all, setAll] = useState(false);
  const upcoming = upcomingEvents(st.events, today);
  if (!st.on || (!st.canEdit && upcoming.length === 0)) return null;
  const shown = all ? upcoming : upcoming.slice(0, SHOW);
  return (
    <section className={card} aria-label="회원 달력">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-heading font-black text-foreground">회원 달력</h2>
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {st.branch ? `${shortBranch(st.branch)} 회원님 달력에 보여요` : "회원님 달력에 보여요"}
          </p>
        </div>
        {st.canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-foreground px-3.5 text-label font-black text-background active:scale-95"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> 올리기
          </button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-body leading-snug text-muted-foreground">
          휴관 · 단축 운영 · 이벤트 · 대회 · 특강을 올리면 회원님 달력에 바로 보이고, 고른 때 알림이 가요
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {shown.map((e) => {
            const body = (
              <>
                <KindChip kind={e.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-foreground">{e.title}</span>
                  <span className="block text-label leading-snug tabular-nums text-muted-foreground">
                    {eventRange(e)} · {noticeStatus(e, st)}
                  </span>
                </span>
                {st.canEdit && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              </>
            );
            return (
              <li key={e.id}>
                {st.canEdit ? (
                  <button type="button" onClick={() => onOpen(e)} className="flex w-full items-start gap-2 py-3 text-left active:bg-secondary/60">
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-2 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > SHOW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
        >
          {all ? "접기" : `${upcoming.length - SHOW}개 더 보기`}
        </button>
      )}
    </section>
  );
};

type Target = { mode: "new"; date: string } | { mode: "edit"; event: OpsCalEvent };

/** 올리기 · 고치기 시트 */
const EventSheet = ({ target, st, onClose }: { target: Target | null; st: OpsCalState; onClose: () => void }) => {
  const today = st.today ?? kstToday();
  const [draft, setDraft] = useState<EventDraft>(() => newEventDraft(today));
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const save = useSaveOpsCalEvent();
  const remove = useRemoveOpsCalEvent();
  const editing = target?.mode === "edit" ? target.event : null;

  useEffect(() => {
    if (!target) return;
    setDraft(target.mode === "edit" ? draftFromEvent(target.event) : newEventDraft(target.date < today ? today : target.date));
    setError(null);
    setConfirmRemove(false);
  }, [target, today]);

  const set = (patch: Partial<EventDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };
  const pickKind = (kind: EventKind) =>
    // 새로 올릴 때만 종류에 맞춰 '하루 전 저녁' 알림을 켜고 끈다 (휴관 · 단축 운영 = 켬)
    set(editing ? { kind } : { kind, notifyEve: EVENT_KIND_META[kind].eve });

  const submit = async () => {
    const e = eventDraftError(draft, today);
    if (e) {
      setError(e);
      return;
    }
    try {
      await save.mutateAsync({ draft, branch: st.branch, id: editing?.id ?? null });
      toast.success(editing ? "153 일정을 고쳤어요" : "회원 달력에 올렸어요");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRemove = async () => {
    if (!editing) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    try {
      await remove.mutateAsync({ id: editing.id, branch: st.branch });
      toast.success("회원 달력에서 뺐어요");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const busy = save.isPending || remove.isPending;
  const hint = sendHint(draft, st, today, kstHm());
  const titleLen = [...draft.title.replace(/\s+/g, " ").trim()].length;
  const audience = st.audience != null ? `알림 받는 회원 ${st.audience.toLocaleString("ko-KR")}명` : null;

  return (
    <OpsSheet
      open={!!target}
      onClose={onClose}
      title={editing ? "153 일정 고치기" : "회원 달력에 올리기"}
      sub={[st.branch ? shortBranch(st.branch) : null, audience].filter(Boolean).join(" · ")}
      footer={
        <div className="space-y-2">
          <OpsButton onClick={() => void submit()} disabled={busy || !draft.title.trim()}>
            {save.isPending ? "저장하는 중…" : editing ? "이렇게 고칠게요" : "회원 달력에 올리기"}
          </OpsButton>
          {editing && (
            <OpsButton tone="danger" onClick={() => void onRemove()} disabled={busy}>
              {confirmRemove ? "한 번 더 누르면 회원 달력에서 빼요" : "회원 달력에서 빼기"}
            </OpsButton>
          )}
        </div>
      }
    >
      <OpsLabel>무슨 일정인가요?</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {EVENT_KINDS.map((k) => (
          <OpsChip key={k} on={draft.kind === k} onClick={() => pickKind(k)}>
            {EVENT_KIND_META[k].pick}
          </OpsChip>
        ))}
      </div>

      <OpsLabel>한 줄 설명</OpsLabel>
      <input
        value={draft.title}
        maxLength={EVENT_TITLE_MAX + 10}
        onChange={(e) => set({ title: e.target.value })}
        placeholder={EVENT_KIND_META[draft.kind].placeholder}
        aria-label="한 줄 설명"
        className={opsInput}
      />
      <p className={cn("mt-1 text-right text-micro tabular-nums", titleLen > EVENT_TITLE_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
        {titleLen}/{EVENT_TITLE_MAX}
      </p>

      <OpsLabel>날짜</OpsLabel>
      <div className="flex gap-1.5">
        <OpsChip on={!draft.multi} onClick={() => set({ multi: false })}>
          하루
        </OpsChip>
        <OpsChip on={draft.multi} onClick={() => set({ multi: true, endOn: draft.endOn > draft.startOn ? draft.endOn : addDays(draft.startOn, 1) })}>
          여러 날
        </OpsChip>
      </div>
      <div className={cn("mt-2 grid gap-2", draft.multi ? "grid-cols-2" : "grid-cols-1")}>
        <input
          type="date"
          value={draft.startOn}
          min={today}
          max={addDays(today, 400)}
          onChange={(e) => set({ startOn: e.target.value, endOn: draft.endOn < e.target.value ? e.target.value : draft.endOn })}
          aria-label={draft.multi ? "시작하는 날" : "날짜"}
          className={opsInput}
        />
        {draft.multi && (
          <input
            type="date"
            value={draft.endOn}
            min={draft.startOn}
            max={draft.startOn ? addDays(draft.startOn, 30) : undefined}
            onChange={(e) => set({ endOn: e.target.value })}
            aria-label="끝나는 날"
            className={opsInput}
          />
        )}
      </div>

      <OpsLabel>회원님께 알림</OpsLabel>
      <div className="divide-y divide-border rounded-xl border border-border">
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-body font-bold text-foreground">하루 전 {hmLabel(st.eveAt)}</span>
            <span className="block text-label text-muted-foreground">오기 전에 알아야 하는 일정 (휴관 · 단축 운영)</span>
          </span>
          <Switch checked={draft.notifyEve} onCheckedChange={(v) => set({ notifyEve: v })} aria-label="하루 전 저녁 알림" />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-body font-bold text-foreground">그날 {hmLabel(st.morningAt)}</span>
            <span className="block text-label text-muted-foreground">여러 날이면 첫날 한 번</span>
          </span>
          <Switch checked={draft.notifyMorning} onCheckedChange={(v) => set({ notifyMorning: v })} aria-label="그날 아침 알림" />
        </label>
      </div>
      {hint && <p className="mt-2 text-label font-bold text-primary">{hint}</p>}
      {/* (2-3) 승급 심사 — 알림 · D-day 는 타이틀매치 차례(레벨 10) 회원에게만 */}
      {draft.kind === "exam" && (
        <p className="mt-2 text-label text-muted-foreground">승급 심사 알림은 타이틀매치 차례(레벨 10)인 회원님께만 가고, 그 회원님 달력 머리에 D-day로 보여요</p>
      )}
      {editing && (editing.morningSentAt || editing.eveSentAt) && (
        <p className="mt-2 text-label text-muted-foreground">이미 보낸 알림은 다시 안 가요 · 날짜를 바꾸면 새 날짜로 다시 알려요</p>
      )}

      {/* 회원님 달력에는 이렇게 */}
      {draft.title.trim() && (
        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-micro font-bold text-muted-foreground">회원님 달력에는 이렇게 보여요</p>
          <p className="mt-1 flex items-center gap-1.5">
            <KindChip kind={draft.kind} />
            <span className="min-w-0 truncate text-body font-bold text-foreground">{draft.title.replace(/\s+/g, " ").trim()}</span>
          </p>
          <p className="mt-0.5 text-label tabular-nums text-muted-foreground">
            {eventRange({ startOn: draft.startOn, endOn: draft.multi ? draft.endOn : draft.startOn })}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-label font-bold text-destructive">
          {error}
        </p>
      )}
    </OpsSheet>
  );
};

/** 데이터 + 시트 — branch = 「일정」 탭에서 고른 지점, date = 새로 올릴 때 처음 날짜(고른 날) */
const OpsCalEvents = ({ branch, date }: { branch: string; date: string }) => {
  const q = useOpsCalEvents(branch);
  const [target, setTarget] = useState<Target | null>(null);
  const st = q.data;
  if (!st?.on) return null;
  const today = st.today ?? kstToday();
  return (
    <>
      <OpsCalEventsView
        st={st}
        today={today}
        onAdd={() => setTarget({ mode: "new", date: date >= today ? date : today })}
        onOpen={(e) => setTarget({ mode: "edit", event: e })}
      />
      {st.canEdit && <EventSheet target={target} st={st} onClose={() => setTarget(null)} />}
    </>
  );
};

export default OpsCalEvents;
