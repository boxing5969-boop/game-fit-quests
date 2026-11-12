/**
 * 👋 153운영본부 「일정」 탭 맨 위 — 오늘 만날 회원 (2026-11-12 대표님 「추천하는대로 진행할게」 — 스케줄러는 「오늘 만날 회원」 중심)
 *   감정 설계 「들어올 때 = 환영」: 오늘 약속한 회원 + 오늘 온 회원 중 첫 출석 · 첫 4주 · 오랜만에 온 · 수강권이 곧 끝나는 ·
 *   운동 모집을 올린 회원 — 줄마다 코치님이 할 한 가지(이름 부르기 · '다시 와서 반가워요' · 다음 목표 하나 …).
 *   서버 ops_meet_today(켠 지점 지도진 · 대표님) — 꺼진 지점이거나 오늘 만날 회원이 없으면 그리지 않는다(빈 것은 그리지 않기).
 *   누르면 회원 카드(openMemberCard). 글 · 순서는 src/lib/promise153.ts (meetReasons · sortMeetRows).
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { openMemberCard } from "@/lib/appEvents";
import { kstHm, meetReasons, meetSummary, sortMeetRows, type MeetKey, type MeetRow } from "@/lib/promise153";
import { cn } from "@/lib/utils";
import { useMeetToday } from "@/services/promiseService";

const SHOW = 6;

const CHIP: Record<MeetKey, string> = {
  starter: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  back: "bg-primary/10 text-primary",
  promise: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  expiring: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  partner: "bg-secondary text-foreground",
};

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 OpsMeetToday) */
export const OpsMeetTodayView = ({ rows }: { rows: readonly MeetRow[] }) => {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const sorted = sortMeetRows(rows);
  const shown = all ? sorted : sorted.slice(0, SHOW);
  const summary = meetSummary(rows);
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="오늘 만날 회원">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">오늘 만날 회원</h2>
        <span className="text-label text-muted-foreground">{rows.length}명</span>
      </div>
      {summary && <p className="mt-0.5 text-label text-muted-foreground">{summary}</p>}
      <ul className="mt-3 divide-y divide-border">
        {shown.map((r) => {
          const reasons = meetReasons(r);
          const hm = kstHm(r.cameAt);
          return (
            <li key={r.userId}>
              <button
                type="button"
                onClick={() => openMemberCard(r.userId)}
                className="flex w-full items-start gap-3 py-3 text-left active:bg-secondary/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body font-black text-foreground">{r.name}</span>
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
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {sorted.length > SHOW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
        >
          {all ? "접기" : `${sorted.length - SHOW}명 더 보기`}
        </button>
      )}
    </section>
  );
};

const OpsMeetToday = ({ branch }: { branch: string | null }) => {
  const q = useMeetToday(branch);
  if (!q.data?.on || q.data.rows.length === 0) return null;
  return <OpsMeetTodayView rows={q.data.rows} />;
};

export default OpsMeetToday;
