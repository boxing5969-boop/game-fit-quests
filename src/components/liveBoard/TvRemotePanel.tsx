/**
 * 📺 관리자 앱 › 라이브보드 — 「TV 화면 바꾸기」 (2026-11-08 대표님 「라이브보드 탭에서 내가 버튼을 누르면 라이브보드 변경 가능하게해줘 모든 모드 별로」)
 *   TV 번호(= TV 주소 끝 번호, 번호 없으면 4)마다 화면 6개 버튼: 지금 운동 중 · 런칭 이벤트 · 회원 안내 · 전체 한 화면 · 153 PB 코스 · 153 PB 기록.
 *   누르면 set_tv_board_mode → 그 TV 가 몇 초 안에 넘어가고(useTvRemote) 다시 바꿀 때까지 그대로.
 *   그 번호의 원래 화면 = '기본' — 153 PB 측정 자동 전환은 기본일 때만.
 *   TV 가 1분마다 알려 주는 '지금 화면'으로 켜짐 · 바꾸는 중을 보여 준다(5초마다 다시 읽음 — 이 화면을 연 동안만).
 *   그 지점 운영진만(get_board_tv_key 와 같은 기준) — 서버가 거르면 이 칸을 숨긴다.
 */
import { useCallback, useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/errorMessages";
import { fetchTvModes, setTvMode } from "@/services/tvBoardService";
import {
  TV_SCREENS,
  tvDesired,
  tvScreenLabel,
  tvStatusLine,
  tvVisibleSlots,
  type TvScreen,
  type TvSlot,
  type TvSlotState,
} from "@/lib/tvRemote";

const POLL_MS = 5000;

const TvRemotePanel = ({ branchCode }: { branchCode: string }) => {
  const [states, setStates] = useState<TvSlotState[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setStates(await fetchTvModes(branchCode));
      setHidden(false);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      // 운영진이 아니거나(42501) 서버에 아직 함수가 없으면(PGRST202) 칸을 숨긴다
      if (code === "42501" || code === "PGRST202" || code === "42883") setHidden(true);
    }
  }, [branchCode]);

  useEffect(() => {
    setStates(null);
    setShowAll(false);
    void load();
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const choose = async (slot: TvSlot, screen: TvScreen) => {
    const key = `${slot}:${screen}`;
    if (busy) return;
    setBusy(key);
    try {
      setStates(await setTvMode(branchCode, slot, screen === slot ? "home" : screen));
      setNow(Date.now());
      toast.success(`TV ${slot} → ${tvScreenLabel(screen)} · 몇 초 안에 바뀌어요`);
    } catch (e) {
      toast.error(translateError(e, "바꾸지 못했어요. 다시 눌러 주세요"));
    } finally {
      setBusy(null);
    }
  };

  if (hidden || !states) return null;
  const visible = showAll ? states : tvVisibleSlots(states);
  const more = states.length - visible.length;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
        <Tv className="h-4 w-4 text-primary" />
        TV 화면 바꾸기
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
        누르면 몇 초 안에 그 TV가 바뀌고, 다시 바꿀 때까지 그대로예요 · TV 번호 = TV 주소 끝 번호(번호 없으면 4)
      </p>

      <div className="mt-3 space-y-2.5">
        {visible.map((s) => {
          const desired = tvDesired(s.slot, s.mode);
          const status = tvStatusLine(s, now);
          return (
            <div key={s.slot} className="rounded-xl bg-muted p-2.5">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 text-[12px] font-black text-background">TV {s.slot}</span>
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", status.online ? "bg-primary" : "bg-muted-foreground/40")}
                  aria-hidden="true"
                />
                <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", status.pending ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {status.text}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`TV ${s.slot} 화면`}>
                {TV_SCREENS.map((sc) => {
                  const selected = desired === sc.id;
                  const home = sc.id === s.slot;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!!busy}
                      onClick={() => !selected && void choose(s.slot, sc.id)}
                      className={cn(
                        "min-h-[44px] rounded-lg px-1.5 py-1.5 text-[12.5px] font-bold leading-tight transition-transform active:scale-[0.97] disabled:opacity-60",
                        selected ? "bg-foreground text-background" : "bg-card text-foreground ring-1 ring-black/[0.06] dark:ring-white/[0.08]",
                        busy === `${s.slot}:${sc.id}` && "animate-pulse",
                      )}
                    >
                      {sc.label}
                      {home && <span className="block text-[10.5px] font-semibold opacity-70">기본</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                {/* 153 PB 자동 전환은 1 · 2번 TV 의 기본 화면에서만 (usePb153AutoSwitch) */}
                {desired === s.slot
                  ? s.slot === "1" || s.slot === "2"
                    ? "기본 — 153 PB 측정이 시작되면 저절로 PB 화면"
                    : "기본 — 이 번호의 원래 화면"
                  : s.slot === "1" || s.slot === "2"
                    ? "고정 — 153 PB 측정 때도 이 화면 그대로"
                    : "고정 — 다시 바꿀 때까지 이 화면"}
                {s.setBy && s.setAt && desired !== s.slot ? ` · ${s.setBy}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {more > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 h-10 w-full rounded-xl text-[13px] font-bold text-muted-foreground active:scale-[0.98]"
        >
          다른 번호 TV {more}대 더 보기
        </button>
      )}
    </div>
  );
};

export default TvRemotePanel;
