/**
 * 🥊 복싱 타이머 입구 — 훈련 탭 「오늘 할 것」 맨 아래 한 줄 (2026-11-22 · 화면은 BoxingTimerSheet)
 *   주소 `/missions?timer=1`(전체 메뉴 · 기능 검색 · 앱 업데이트 링크)로 들어오면 바로 열고 주소에서 지운다.
 *   `?timer=spar` = 코치 「스파링 기록」 칸으로 연다(밤 11시 「오늘의 스파링」 알림 · 2026-11-25 스파링 영상 1차).
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, ChevronRight } from "lucide-react";
import { unlockLoud } from "@/lib/loudBell";
import BoxingTimerSheet from "./BoxingTimerSheet";

const BoxingTimerEntry = () => {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [startMode, setStartMode] = useState<"timer" | "spar">("timer");
  const wantRaw = params.get("timer");
  const want = wantRaw === "1" || wantRaw === "spar";

  useEffect(() => {
    if (!want) return;
    setStartMode(wantRaw === "spar" ? "spar" : "timer");
    setOpen(true);
    const next = new URLSearchParams(params);
    next.delete("timer");
    setParams(next, { replace: true });
  }, [want, wantRaw, params, setParams]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          unlockLoud();
          setStartMode("timer");
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">복싱 타이머</span>
          <span className="block truncate text-label text-muted-foreground">자율 운동 · 라운드와 쉬는 시간을 큰 공 소리로</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>
      <BoxingTimerSheet open={open} startMode={startMode} onClose={() => setOpen(false)} />
    </>
  );
};

export default BoxingTimerEntry;
