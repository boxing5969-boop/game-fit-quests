/**
 * 👋 153운영본부 「일정」 탭 맨 위 — 오늘 만날 회원 (2026-11-12 대표님 「추천하는대로 진행할게」 — 스케줄러는 「오늘 만날 회원」 중심)
 *   감정 설계 「들어올 때 = 환영」: 오늘 약속한 회원 + 오늘 온 회원 중 첫 출석 · 첫 4주 · 오랜만에 온 · 수강권이 곧 끝나는 ·
 *   운동 모집을 올린 회원 — 줄마다 코치님이 할 한 가지(이름 부르기 · '다시 와서 반가워요' · 다음 목표 하나 …).
 *   서버 ops_meet_today(켠 지점 지도진 · 대표님) — 꺼진 지점이거나 오늘 만날 회원이 없으면 그리지 않는다(빈 것은 그리지 않기).
 *   누르면 회원 카드(openMemberCard). 글 · 순서는 src/lib/promise153.ts (meetReasons · sortMeetRows).
 *   (2-3 · 2026-11-13 대표님 「다음」 — 운동 달력 2-3단계) '오늘 1주년' · '출석 100번째' 칩 · 줄마다 「한마디」 → 그 회원 운동 달력
 *   오늘 칸에 코치 한마디 도장 + 알림 한 번(OpsDayNoteSheet — 의무 아님) · 남긴 한마디는 줄 아래 · 맨 아래 '오늘 온 다른 회원'(접힘)도
 *   한마디를 남길 수 있다(코치 한마디를 받은 회원 4주 30명 → 60명 — 보고서 '숫자로 보는 목표').
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, MessageCircle } from "lucide-react";

import OpsDayNoteSheet, { type OpsDayNoteTarget } from "@/components/ops/OpsDayNoteSheet";
import { openMemberCard } from "@/lib/appEvents";
import { noteWho } from "@/lib/calendarMarks";
import { kstHm, meetReasons, meetSummary, sortMeetRows, type MeetKey, type MeetNote, type MeetOther, type MeetRow } from "@/lib/promise153";
import { cn } from "@/lib/utils";
import { useMeetToday } from "@/services/promiseService";

const SHOW = 6;

const CHIP: Record<MeetKey, string> = {
  starter: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  anniv: "bg-reward/15 text-reward",
  milestone: "bg-reward/15 text-reward",
  back: "bg-primary/10 text-primary",
  promise: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  expiring: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  partner: "bg-secondary text-foreground",
};

/** 줄 아래 — 오늘 남긴 한마디 (나 · 다른 코치님) */
const NoteLines = ({ notes }: { notes: readonly MeetNote[] }) =>
  notes.length === 0 ? null : (
    <ul className="mt-1.5 space-y-1" aria-label="오늘 남긴 한마디">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg bg-primary/5 px-3 py-1.5 text-label leading-snug text-foreground">
          <span className="font-bold text-primary">{n.mine ? "내 한마디" : noteWho(n)}</span> · {n.body}
        </li>
      ))}
    </ul>
  );

/** 「한마디」 단추 — 내가 남겼으면 '고치기' */
const NoteButton = ({ name, notes, onClick }: { name: string; notes: readonly MeetNote[]; onClick: () => void }) => {
  const mine = notes.some((n) => n.mine);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}님에게 오늘 한마디${mine ? " 고치기" : ""}`}
      className={cn(
        "mt-0.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-label font-bold active:scale-95",
        mine ? "bg-primary/10 text-primary" : "bg-secondary text-foreground",
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {mine ? "고치기" : "한마디"}
    </button>
  );
};

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 OpsMeetToday) */
export const OpsMeetTodayView = ({
  rows,
  others = [],
  canNote = false,
}: {
  rows: readonly MeetRow[];
  others?: readonly MeetOther[];
  canNote?: boolean;
}) => {
  const [all, setAll] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [noteFor, setNoteFor] = useState<OpsDayNoteTarget | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  if (rows.length === 0 && others.length === 0) return null;
  const sorted = sortMeetRows(rows);
  const shown = all ? sorted : sorted.slice(0, SHOW);
  const summary = meetSummary(rows);
  const othersNoted = others.filter((o) => o.notes.length > 0).length;
  const openNote = (t: OpsDayNoteTarget) => {
    setNoteFor(t);
    setNoteOpen(true);
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="오늘 만날 회원">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">오늘 만날 회원</h2>
        {rows.length > 0 && <span className="text-label text-muted-foreground">{rows.length}명</span>}
      </div>
      {summary && <p className="mt-0.5 text-label text-muted-foreground">{summary}</p>}
      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {shown.map((r) => {
            const reasons = meetReasons(r);
            const hm = kstHm(r.cameAt);
            return (
              <li key={r.userId} className="py-3">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => openMemberCard(r.userId)} className="min-w-0 flex-1 text-left active:opacity-70">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-0.5">
                        <span className="truncate text-body font-black text-foreground">{r.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </span>
                      <span className={cn("shrink-0 text-label tabular-nums", hm ? "font-bold text-foreground" : "text-muted-foreground")}>
                        {hm ? `${hm} 들어옴` : "아직"}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {reasons.map((x) => (
                        <span key={x.key} className={cn("rounded-md px-1.5 py-0.5 text-micro font-black", CHIP[x.key])}>
                          {x.label}
                        </span>
                      ))}
                    </span>
                    {reasons[0] && <span className="mt-1 block text-label leading-snug text-muted-foreground">{reasons[0].say}</span>}
                  </button>
                  {canNote && <NoteButton name={r.name} notes={r.notes} onClick={() => openNote({ userId: r.userId, name: r.name, notes: r.notes })} />}
                </div>
                <NoteLines notes={r.notes} />
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > SHOW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
        >
          {all ? "접기" : `${sorted.length - SHOW}명 더 보기`}
        </button>
      )}
      {/* (2-3) 오늘 온 다른 회원 — 누구에게나 코치 한마디 (접힘) */}
      {canNote && others.length > 0 && (
        <div className={cn(rows.length > 0 ? "mt-1 border-t border-border pt-1" : "mt-2")}>
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers}
            className="flex h-11 w-full items-center justify-between gap-2 rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
          >
            <span className="min-w-0 truncate">
              오늘 온 {rows.length > 0 ? "다른 " : ""}회원 {others.length}명{othersNoted > 0 ? ` · 한마디 ${othersNoted}명` : " · 한마디 남기기"}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showOthers && "rotate-180")} aria-hidden />
          </button>
          {showOthers && (
            <ul className="divide-y divide-border" aria-label="오늘 온 다른 회원">
              {others.map((o) => {
                const hm = kstHm(o.cameAt);
                return (
                  <li key={o.userId} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openMemberCard(o.userId)} className="flex min-w-0 flex-1 items-baseline justify-between gap-2 text-left active:opacity-70">
                        <span className="truncate text-body font-bold text-foreground">{o.name}</span>
                        {hm && <span className="shrink-0 text-label tabular-nums text-muted-foreground">{hm}</span>}
                      </button>
                      <NoteButton name={o.name} notes={o.notes} onClick={() => openNote({ userId: o.userId, name: o.name, notes: o.notes })} />
                    </div>
                    <NoteLines notes={o.notes} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {canNote && <OpsDayNoteSheet open={noteOpen} onOpenChange={setNoteOpen} target={noteFor} />}
    </section>
  );
};

const OpsMeetToday = ({ branch }: { branch: string | null }) => {
  const q = useMeetToday(branch);
  if (!q.data?.on || (q.data.rows.length === 0 && q.data.others.length === 0)) return null;
  return <OpsMeetTodayView rows={q.data.rows} others={q.data.others} canNote={q.data.canNote} />;
};

export default OpsMeetToday;
