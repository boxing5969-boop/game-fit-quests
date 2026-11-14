/**
 * 🗂 운동 달력 보기 설정 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5 '캘린더 켜고 끄기' · '리그 테마')
 *   캘린더 켜고 끄기(내 일정 · 153 일정 · 공휴일 · 운동 표시) + 리그 색 도장 — 계정마다 저장(set_my_calendar_view · 기기가 바뀌어도 그대로).
 *   출석 도장은 늘 보인다(끌 수 없음). WorkoutCalendar 가 누를 때만 받는 조각.
 */
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { CAL_LAYERS, LEAGUE_STAMP, layerOn, toggleLayer, type CalView } from "@/lib/memberEvents";
import { useSetCalendarView } from "@/services/calendarCheckService";

export interface CalendarViewSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  view: CalView;
  league: string | null;
}

const CalendarViewSheet = ({ open, onOpenChange, view, league }: CalendarViewSheetProps) => {
  const setView = useSetCalendarView();
  const stamp = league ? LEAGUE_STAMP[league] : null;
  const apply = (next: CalView) => setView.mutate(next, { onError: (e) => toast.error((e as Error).message) });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">달력에 보일 것</DrawerTitle>
          <DrawerDescription className="text-label">출석 도장은 늘 보여요 · 휴대폰이 바뀌어도 그대로예요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label="캘린더 켜고 끄기">
            {CAL_LAYERS.map((l) => (
              <li key={l.key} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold text-foreground">{l.label}</span>
                  <span className="block text-label text-muted-foreground">{l.hint}</span>
                </span>
                <Switch checked={layerOn(view, l.key)} onCheckedChange={() => apply(toggleLayer(view, l.key))} aria-label={l.label} />
              </li>
            ))}
          </ul>

          {stamp && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label font-extrabold text-white"
                style={{ backgroundColor: stamp.hex }}
                aria-hidden
              >
                14
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold text-foreground">{stamp.label} 리그 색 도장</span>
                <span className="block text-label text-muted-foreground">출석 도장을 내 리그 색으로 찍어요</span>
              </span>
              <Switch
                checked={view.theme === "league"}
                onCheckedChange={(on) => apply({ ...view, theme: on ? "league" : null })}
                aria-label={`${stamp.label} 리그 색 도장`}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CalendarViewSheet;
