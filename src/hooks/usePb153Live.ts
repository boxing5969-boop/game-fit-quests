/**
 * 📺 153 PB 라이브보드 — 실시간 측정 신호 받기 (TV 쪽) · 2026-11-08
 *   채널 `test153-live:<지점 이름>` (src/lib/pbBoard.ts). 코치 측정 화면이 5초마다 다시 보내므로
 *   TV 가 새로고침돼도 5초 안에 다시 따라잡는다. 신호에는 이름 · user_id 가 없다.
 *   2단계(히트 · 「2단계넘어가자」): 신호에 히트 id 가 있으면 board_test153_live(지점, TV 열쇠)로
 *   닉네임 · 리그 · 지난번의 나(고스트)를 읽어 people 로 준다 — 처음 보는 히트 · 참가자가 생길 때만(5초에 한 번까지).
 *   demo=true 면 채널을 열지 않고 예시 히트 3명을 돌린다(미리보기 ?demo=1).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readBoardKey } from "@/lib/boardKey";
import {
  PB_DEMO_PEOPLE,
  applyPbLive,
  isPbLiveMsg,
  normalizePbLive,
  pbDemoRuns,
  pbLiveChannel,
  prunePbLive,
  removePbLive,
  type PbLiveRun,
  type PbPeople,
} from "@/lib/pbBoard";

export interface Pb153Live {
  runs: PbLiveRun[];
  /** 히트 참가자 닉네임 · 지난번의 나 (key = 신호 id) */
  people: PbPeople;
  /** 마지막 신호를 받은 TV 시각 (0 = 아직 없음) */
  lastMsgAt: number;
  /** 공식 기록 저장 신호를 받을 때마다 +1 — 기록 보드가 다시 읽는 데 쓴다 */
  savedTick: number;
  connected: boolean;
}

const PEOPLE_RETRY_MS = 5000;

export function usePb153Live(branchName: string, demo = false): Pb153Live {
  const [runs, setRuns] = useState<PbLiveRun[]>([]);
  const [people, setPeople] = useState<PbPeople>(demo ? PB_DEMO_PEOPLE : {});
  const [lastMsgAt, setLastMsgAt] = useState(0);
  const [savedTick, setSavedTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const savedIds = useRef<Set<string>>(new Set());
  const lastPeopleFetch = useRef(0);

  useEffect(() => {
    if (demo) {
      const base = Date.now();
      setRuns(pbDemoRuns(base, base));
      setPeople(PB_DEMO_PEOPLE);
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

  // 히트 참가자 — 모르는 참가자가 보이면 board_test153_live 로 (TV 열쇠 · 닉네임만)
  //   답은 늦게 와도 그대로 합친다(참가자 신호가 연달아 와서 이 효과가 다시 돌아도 버리지 않게) — 5초에 한 번까지
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fetchPeople = useCallback(async () => {
    if (!branchName || Date.now() - lastPeopleFetch.current < PEOPLE_RETRY_MS) return;
    lastPeopleFetch.current = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("board_test153_live", {
        p_branch: branchName,
        p_key: readBoardKey(branchName),
      });
      if (!mounted.current || error || !data) return;
      const got = normalizePbLive(data);
      if (Object.keys(got).length) setPeople((prev) => ({ ...prev, ...got }));
    } catch {
      /* 다음 차례에 다시 */
    }
  }, [branchName]);
  const missing = !demo && runs.some((r) => r.heat && !people[r.id]);
  const runsKey = runs.map((r) => r.id).join(",");
  useEffect(() => {
    if (!missing) return;
    void fetchPeople();
    // 서버에 히트가 아직 안 올라왔을 수 있다(측정 기기가 막 시작 · 인터넷이 잠깐 끊김) — 5초 뒤 한 번 더, 그 뒤 15초마다
    const t1 = window.setTimeout(() => void fetchPeople(), PEOPLE_RETRY_MS + 200);
    const t2 = window.setInterval(() => void fetchPeople(), 15_000);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(t2);
    };
  }, [missing, runsKey, fetchPeople]);

  return { runs, people, lastMsgAt, savedTick, connected };
}

export default usePb153Live;
