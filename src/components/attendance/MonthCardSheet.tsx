/**
 * 🖼 이번 달 운동 카드 시트 (2026-11-13 대표님 「시작하자」 · 운동 달력 2-4단계 — 보고서 '이번 달 운동 카드')
 *   도장 달력 + 그 달 운동 시간 + 코치 한마디 + 153 로고 · 지점 이름을 인스타 스토리 크기 이미지로 — 회원이 하는 153 홍보.
 *   무엇을 그릴지 = lib/calendarTogether monthCardModel · 그리기 · 저장 = lib/monthCardImage (이 시트와 같이 누를 때만 받는 조각).
 *   그 달 코치 한마디 · 기념일 · 쌍도장은 그 달 get_my_calendar 로(달력과 같은 캐시) — 없으면 도장 · 시간만으로 만든다.
 *   이미지는 기기에서 만들고 서버로 보내지 않는다.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { monthWeeks } from "@/lib/attendanceCalendar";
import { monthLabel, type AttendanceHistory } from "@/lib/attendanceHistory";
import { calendarRange } from "@/lib/calendarChecks";
import { withAnnivMoments } from "@/lib/calendarMarks";
import { dayMoments } from "@/lib/calendarMoments";
import { monthCardModel } from "@/lib/calendarTogether";
import { isIosApp } from "@/lib/iosApp";
import { canShareImage, renderMonthCard, shareOrSaveImage } from "@/lib/monthCardImage";
import { useMyCalendar } from "@/services/calendarCheckService";

export interface MonthCardSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'YYYY-MM' */
  month: string;
  data: AttendanceHistory;
  today: string;
}

const MonthCardSheet = ({ open, onOpenChange, month, data, today }: MonthCardSheetProps) => {
  const { profile } = useAuth();
  const range = useMemo(() => calendarRange(monthWeeks(month).flat().map((c) => c.day)), [month]);
  const calQ = useMyCalendar(range?.from ?? null, range?.to ?? null, open);
  const cal = calQ.data?.on ? calQ.data : null;
  const waiting = open && calQ.isLoading;
  const byDay = useMemo(() => new Set(data.list.map((d) => d.day)), [data.list]);
  const moments = useMemo(() => {
    const base = dayMoments(data, today);
    return cal ? withAnnivMoments(base, cal.anniv, (d) => byDay.has(d)) : base;
  }, [data, today, cal, byDay]);
  const p = profile as { nickname?: string | null; name?: string | null; branch_name?: string | null } | null;
  const name = (p?.nickname || p?.name || "").trim() || null;
  const model = useMemo(
    () => monthCardModel({ month, data, moments, notes: cal?.notes ?? [], partner: cal?.partner ?? null, name, branch: p?.branch_name ?? null }),
    [month, data, moments, cal, name, p?.branch_name],
  );
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !model || waiting) return;
    let alive = true;
    let url: string | null = null;
    setImg(null);
    setError(null);
    renderMonthCard(model)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImg({ url, blob });
      })
      .catch((e) => alive && setError((e as Error).message || "카드를 만들지 못했어요"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, model, waiting]);

  const shareable = !!img && !!model && canShareImage(img.blob, model.fileName);
  // 아이폰 앱 안 화면은 공유 창이 없을 수 있다 — 그때는 길게 눌러 저장
  const longPressOnly = !shareable && isIosApp();
  const onSave = async () => {
    if (!img || !model) return;
    setBusy(true);
    try {
      const r = await shareOrSaveImage(img.blob, model.fileName, `${monthLabel(month)} 153 운동 카드`);
      if (r === "downloaded") toast.success("카드 이미지를 저장했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{Number(month.slice(5, 7))}월 운동 카드</DrawerTitle>
          <DrawerDescription className="text-label">153 로고 · 지점 이름이 들어간 이미지예요 · 스토리에 올려 보세요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {!model ? (
            <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-body font-bold text-foreground">이 달은 운동한 날이 있을 때 카드가 만들어져요</p>
          ) : img ? (
            <img
              src={img.url}
              alt={`${monthLabel(month)} 운동 카드 — ${model.minutesText} 운동`}
              className="mx-auto aspect-[9/16] max-h-[58vh] w-auto rounded-2xl border border-border shadow-elev-1"
            />
          ) : (
            <div className="mx-auto flex aspect-[9/16] max-h-[58vh] w-[min(100%,20rem)] items-center justify-center rounded-2xl border border-border bg-muted/60">
              <span className="text-label font-bold text-muted-foreground">{error ?? "카드를 만드는 중…"}</span>
            </div>
          )}
          {model && img && !longPressOnly && (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <Share2 className="h-5 w-5" aria-hidden />
              {shareable ? "저장 · 공유하기" : "이미지 저장"}
            </button>
          )}
          {model && img && (
            <p className="text-center text-label text-muted-foreground">
              {longPressOnly
                ? "이미지를 길게 누르면 사진에 저장돼요"
                : shareable
                  ? "공유 창에서 인스타그램 스토리 · 사진 저장을 고를 수 있어요"
                  : "이미지 파일로 내려받아요"}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MonthCardSheet;
