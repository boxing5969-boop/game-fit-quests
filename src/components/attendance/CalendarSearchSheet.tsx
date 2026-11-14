/**
 * 🔍 운동 달력 검색 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5 '검색(한 줄 · 내 일정)')
 *   내 일정(이름 · 장소 · 메모)과 내가 쓴 한 줄을 찾는다 — 서버 search_my_calendar(각 30개 · 최근 것부터 · 나만).
 *   일정을 누르면 고치기 시트 · 한 줄을 누르면 그날 달력으로. WorkoutCalendar 가 누를 때만 받는 조각.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarDays, PenLine, Search } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { REST_LABEL, mdwShort, myEventHex, myEventNextDay, mySubLine, searchError, type MyEvent } from "@/lib/memberEvents";
import { useCalendarSearch } from "@/services/calendarCheckService";

export interface CalendarSearchSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  today: string;
  onOpenEvent: (e: MyEvent, day: string) => void;
  onPickDay: (day: string) => void;
}

const CalendarSearchSheet = ({ open, onOpenChange, today, onOpenEvent, onPickDay }: CalendarSearchSheetProps) => {
  const [text, setText] = useState("");
  const [q, setQ] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const search = useCalendarSearch(q);

  useEffect(() => {
    if (!open) return;
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const submit = () => {
    const e = searchError(text);
    if (e) {
      setError(e);
      return;
    }
    setError(null);
    setQ(text.replace(/\s+/g, " ").trim());
  };

  const res = search.data;
  const off = !!res && !res.on;
  const empty = !!res && res.on && res.events.length === 0 && res.lines.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">달력에서 찾기</DrawerTitle>
          <DrawerDescription className="text-label">내 일정 · 내가 쓴 한 줄에서 찾아요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              enterKeyHint="search"
              placeholder="예: 회식 · 미트"
              aria-label="찾을 말"
              className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              aria-label="찾기"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          </form>
          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}
          {search.isFetching && <p className="text-label text-muted-foreground">찾는 중…</p>}
          {search.isError && <p className="text-label text-muted-foreground">{(search.error as Error).message}</p>}
          {off && <p className="text-label text-muted-foreground">검색은 곧 열려요</p>}
          {empty && <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">'{res.q}'(이)라는 일정 · 한 줄이 아직 없어요</p>}

          {res?.on && res.events.length > 0 && (
            <section aria-label="내 일정">
              <p className="text-label font-bold text-muted-foreground">내 일정 {res.events.length}</p>
              <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                {res.events.map((e) => {
                  const day = myEventNextDay(e, today);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => onOpenEvent(e, day)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                      >
                        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: myEventHex(e) }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-bold text-foreground">{e.title}</span>
                          <span className="block truncate text-label text-muted-foreground">
                            {mdwShort(day)} · {mySubLine(e)}
                            {e.rest ? ` · ${REST_LABEL}` : ""}
                          </span>
                        </span>
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {res?.on && res.lines.length > 0 && (
            <section aria-label="내가 쓴 한 줄">
              <p className="text-label font-bold text-muted-foreground">내가 쓴 한 줄 {res.lines.length}</p>
              <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                {res.lines.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => onPickDay(l.day)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-muted/60">
                      <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-label font-bold tabular-nums text-muted-foreground">
                          {l.day.slice(0, 4)}년 {mdwShort(l.day)}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-body leading-snug text-foreground">
                          {l.mood ? `${l.mood} · ` : ""}
                          {l.content}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CalendarSearchSheet;
