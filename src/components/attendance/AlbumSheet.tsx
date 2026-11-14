/**
 * 📷 나의 153 앨범 (2026-11-13 대표님 「시작하자」 · 운동 달력 2-4단계 — 네이버 캘린더 '사진 모아보기'를 바꿔 넣기)
 *   그 달 '오늘 운동 한 줄'에 올린 사진만 모아 본다(새 자료 없음 — get_my_calendar 의 그날 한 줄 · lib/calendarTogether albumOf).
 *   사진을 누르면 크게 · 그날 한 줄 · 「그날 보기」(달력에서 그날을 고른다). 사진이 없는 달엔 단추부터 없다(빈 것은 그리지 않기).
 */
import { useEffect, useState } from "react";
import { ChevronLeft, Lock, UserRound, Users } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { JournalVisibility } from "@/lib/calendarChecks";
import { monthDayLabel, type AlbumPhoto } from "@/lib/calendarTogether";

const VIS: Record<JournalVisibility, { label: string; Icon: typeof Lock }> = {
  private: { label: "나만 보기", Icon: Lock },
  partners: { label: "친구만", Icon: UserRound },
  branch: { label: "전체 공개", Icon: Users },
};

export interface AlbumSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'YYYY-MM' */
  month: string;
  photos: readonly AlbumPhoto[];
  onPickDay: (day: string) => void;
}

const AlbumSheet = ({ open, onOpenChange, month, photos, onPickDay }: AlbumSheetProps) => {
  const [sel, setSel] = useState<AlbumPhoto | null>(null);
  useEffect(() => {
    if (!open) setSel(null);
  }, [open]);
  const vis = sel ? VIS[sel.visibility] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">나의 153 앨범 · {Number(month.slice(5, 7))}월</DrawerTitle>
          <DrawerDescription className="text-label">그날 한 줄에 올린 사진이에요</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {sel ? (
            <div>
              <img src={sel.url} alt={`${monthDayLabel(sel.day)} 사진`} className="mx-auto max-h-[56vh] w-full rounded-xl bg-muted object-contain" />
              <p className="mt-3 text-body font-bold tabular-nums text-foreground">{monthDayLabel(sel.day)}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-body leading-snug text-foreground">
                {sel.mood ? `${sel.mood} · ` : ""}
                {sel.content}
              </p>
              {vis && (
                <p className="mt-1 flex items-center gap-1 text-label text-muted-foreground">
                  <vis.Icon className="h-4 w-4" aria-hidden />
                  {vis.label}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSel(null)}
                  className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98]"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                  목록
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPickDay(sel.day);
                    onOpenChange(false);
                  }}
                  className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98]"
                >
                  그날 보기
                </button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5" aria-label="사진">
              {photos.map((ph) => (
                <li key={`${ph.day}:${ph.url}`}>
                  <button
                    type="button"
                    onClick={() => setSel(ph)}
                    aria-label={`${monthDayLabel(ph.day)} 사진 크게 보기`}
                    className="relative block aspect-square w-full overflow-hidden rounded-lg bg-muted active:scale-[0.98]"
                  >
                    <img src={ph.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/55 px-1.5 py-0.5 text-micro font-bold tabular-nums text-white">
                      {Number(ph.day.slice(8))}일
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AlbumSheet;
