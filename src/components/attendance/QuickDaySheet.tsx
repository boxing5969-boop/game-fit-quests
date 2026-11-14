/**
 * ⚡ 날짜를 길게 눌러 바로 넣기 (2026-11-13 대표님 「다음」 — 운동 달력 2-3단계 · 보고서 '길게 눌러 빠른 등록')
 *   오늘 · 6일 전까지의 날짜를 0.45초 길게 누르면 — 나만의 체크 · 기분 스티커를 바로(오늘이면 '오늘 운동 한 줄 쓰기'도).
 *   앞날을 길게 누르면 목표일(DdaySheet) — 나누는 것은 WorkoutCalendar(lib/calendarMarks quickModeOf).
 *   누르는 순간 저장(서버 set_my_check_done · set_my_day_sticker — 그날 카드와 같은 길). 누를 때만 받는 조각.
 */
import { Check, PenLine, Plus } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { STICKERS, itemLabel, itemsForDay, stickerOf, type CalState, type StickerKey } from "@/lib/calendarChecks";
import { mdw } from "@/lib/calendarMarks";
import { cn } from "@/lib/utils";

export interface QuickDaySheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  day: string | null;
  today: string;
  cal: CalState;
  busy?: boolean;
  onToggle: (day: string, itemId: string, done: boolean) => void;
  onSticker: (day: string, key: StickerKey | null) => void;
  onWriteLine: () => void;
  onManage: () => void;
}

const QuickDaySheet = ({ open, onOpenChange, day, today, cal, busy = false, onToggle, onSticker, onWriteLine, onManage }: QuickDaySheetProps) => {
  const d = day ?? today;
  const isToday = d === today;
  const info = cal.days.get(d);
  const done = new Set(info?.done ?? []);
  const items = itemsForDay(cal.items, d);
  const sticker = stickerOf(info?.sticker);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{isToday ? "오늘" : mdw(d)} 바로 넣기</DrawerTitle>
          <DrawerDescription className="text-label">누르면 바로 저장돼요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {isToday && (
            <button
              type="button"
              onClick={onWriteLine}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98]"
            >
              <PenLine className="h-5 w-5" aria-hidden />
              {info?.journal ? "오늘 한 줄 더 쓰기" : "오늘 운동 한 줄 쓰기"}
            </button>
          )}

          <section aria-label="나만의 체크">
            <p className="text-label font-bold text-muted-foreground">나만의 체크</p>
            {items.length > 0 ? (
              <div className="mt-2 grid gap-2">
                {items.map((i) => {
                  const on = done.has(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={on}
                      onClick={() => onToggle(d, i.id, !on)}
                      className={cn(
                        "flex h-12 items-center gap-2 rounded-xl border px-4 text-left text-body font-bold transition-transform active:scale-[0.98]",
                        on ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                      )}
                    >
                      {on ? <Check className="h-5 w-5 shrink-0" aria-hidden /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/50" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{itemLabel(i)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={onManage}
                className="mt-2 flex h-12 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50 bg-primary/5 text-body font-bold text-primary active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                나만의 체크 만들기
              </button>
            )}
          </section>

          <section aria-label="기분 스티커">
            <p className="text-label font-bold text-muted-foreground">
              {isToday ? "오늘 기분" : "그날 기분"}
              {sticker ? ` · ${sticker.label}` : ""}
            </p>
            {/* (3-5) 스티커 20 — 5칸씩 4줄 */}
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {STICKERS.map((s) => {
                const on = info?.sticker === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    aria-label={`기분 스티커 ${s.label}`}
                    onClick={() => onSticker(d, on ? null : s.key)}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-title transition-transform active:scale-95",
                      on ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/60",
                    )}
                  >
                    {s.emoji}
                    <span className="text-micro font-bold text-muted-foreground">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default QuickDaySheet;
