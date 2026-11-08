/**
 * 📺 153 PB 라이브보드 — 실시간 측정 신호 받기 (TV 쪽) · 2026-11-08
 *   채널 `test153-live:<지점 이름>` (src/lib/pbBoard.ts). 코치 측정 화면이 5초마다 다시 보내므로
 *   TV 가 새로고침돼도 5초 안에 다시 따라잡는다. 신호에는 이름 · user_id 가 없다.
 *   demo=true 면 채널을 열지 않고 예시 측정 2개를 돌린다(미리보기 ?demo=1).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyPbLive,
  isPbLiveMsg,
  pbDemoRuns,
  pbLiveChannel,
  prunePbLive,
  removePbLive,
  type PbLiveRun,
} from "@/lib/pbBoard";

export interface Pb153Live {
  runs: PbLiveRun[];
  /** 마지막 신호를 받은 TV 시각 (0 = 아직 없음) */
  lastMsgAt: number;
  /** 공식 기록 저장 신호를 받을 때마다 +1 — 기록 보드가 다시 읽는 데 쓴다 */
  savedTick: number;
  connected: boolean;
}

export function usePb153Live(branchName: string, demo = false): Pb153Live {
  const [runs, setRuns] = useState<PbLiveRun[]>([]);
  const [lastMsgAt, setLastMsgAt] = useState(0);
  const [savedTick, setSavedTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const savedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (demo) {
      const base = Date.now();
      setRuns(pbDemoRuns(base, base));
      const t = window.setInterval(() => setRuns(pbDemoRuns(Date.now(), base)), 1000);
      return () => window.clearInterval(t);
    }
    if (!branchName) return;
    const channel = supabase
      .channel(pbLiveChannel(branchName))
      .on("broadcast", { event: "run" }, (msg) => {
        const p = msg?.payload;
        if (!isPbLiveMsg(p)) return;
        const now = Date.now();
        setRuns((prev) => applyPbLive(prev, p, now));
        setLastMsgAt(now);
        if (p.pb && !savedIds.current.has(p.id)) {
          savedIds.current.add(p.id);
          setSavedTick((n) => n + 1);
        }
      })
      .on("broadcast", { event: "clear" }, (msg) => {
        const id = (msg?.payload as { id?: unknown } | undefined)?.id;
        if (typeof id !== "string") return;
        setRuns((prev) => removePbLive(prev, id));
        setLastMsgAt(Date.now());
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchName, demo]);

  // 소식 없는 측정 내리기
  useEffect(() => {
    if (demo) return;
    const t = window.setInterval(() => setRuns((prev) => {
      const next = prunePbLive(prev, Date.now());
      return next.length === prev.length ? prev : next;
    }), 2000);
    return () => window.clearInterval(t);
  }, [demo]);

  return { runs, lastMsgAt, savedTick, connected };
}

export default usePb153Live;
