/**
 * 📺 153 PB 측정 → 라이브보드 TV 로 실시간 신호 보내기 (코치 측정 화면 쪽) · 2026-11-08 대표님 「다음진행 추천대로」
 *   측정 상태가 바뀔 때마다 + 측정이 화면에 있는 동안 5초마다 채널 `test153-live:<지점 이름>` 으로 보낸다.
 *   싣는 것: 시작 시각 · 끝낸 구간 시각 · 멈춘 시각 · 부문 · (저장 뒤) 개인 최고 여부 — 이름 · user_id 는 싣지 않는다.
 *   측정을 지우거나 '다음 회원'으로 넘어가면 clear 를 보내 TV 에서 내린다.
 *   TV(/tv/:지점/1 · 2)는 달리는 측정 신호를 받으면 153 PB 화면(pb1 · pb2)으로 저절로 넘어간다.
 *   신호가 안 가도(인터넷 · 채널 오류) 측정 · 저장은 그대로 된다 — 보내기는 늘 조용히 실패한다.
 */
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pbLiveChannel, type PbLiveMsg } from "@/lib/pbBoard";
import type { Test153Division } from "@/lib/test153";

interface RunLike {
  division: Test153Division;
  startAt: number;
  marks: number[];
  stoppedAt?: number;
}

interface SavedLike {
  is_pb: boolean;
  prev_pb_ms: number | null;
  score_ms: number;
}

const HEARTBEAT_MS = 5000;

export function useTest153LiveSender(branchName: string | null | undefined, run: RunLike | null, saved: SavedLike | null) {
  const channels = useRef<Map<string, RealtimeChannel>>(new Map());
  const last = useRef<{ id: string; branch: string } | null>(null);
  const latest = useRef<{ branch: string; msg: PbLiveMsg } | null>(null);

  const channelFor = (branch: string): RealtimeChannel => {
    let ch = channels.current.get(branch);
    if (!ch) {
      ch = supabase.channel(pbLiveChannel(branch));
      ch.subscribe((status) => {
        // 붙자마자 지금 상태를 한 번 — 처음 신호를 놓치지 않게
        if (status === "SUBSCRIBED" && latest.current?.branch === branch) void send(branch, "run", latest.current.msg);
      });
      channels.current.set(branch, ch);
    }
    return ch;
  };

  const send = async (branch: string, event: "run" | "clear", payload: object) => {
    const ch = channels.current.get(branch);
    if (!ch || ch.state !== "joined") return;
    try {
      await ch.send({ type: "broadcast", event, payload });
    } catch {
      /* 보내기 실패는 측정에 영향 없음 */
    }
  };

  // 상태가 바뀔 때마다
  useEffect(() => {
    const branch = (branchName ?? "").trim();
    if (run && branch) {
      const msg: PbLiveMsg = {
        v: 1,
        id: String(run.startAt),
        division: run.division,
        startAt: run.startAt,
        marks: run.marks,
        stoppedAt: run.stoppedAt ?? null,
        sentAt: Date.now(),
        pb: saved ? { isPb: saved.is_pb, prevMs: saved.prev_pb_ms, scoreMs: saved.score_ms } : null,
      };
      // 다른 지점 회원으로 바뀌었으면 앞 측정은 내린다
      if (last.current && (last.current.id !== msg.id || last.current.branch !== branch)) {
        void send(last.current.branch, "clear", { v: 1, id: last.current.id, clear: true, sentAt: Date.now() });
      }
      last.current = { id: msg.id, branch };
      latest.current = { branch, msg };
      channelFor(branch);
      void send(branch, "run", msg);
    } else if (!run && last.current) {
      const { id, branch: b } = last.current;
      void send(b, "clear", { v: 1, id, clear: true, sentAt: Date.now() });
      last.current = null;
      latest.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchName, run, saved]);

  // 5초마다 다시 — TV 가 새로고침돼도 따라잡게
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => {
      const cur = latest.current;
      if (!cur) return;
      void send(cur.branch, "run", { ...cur.msg, sentAt: Date.now() });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!run]);

  // 화면을 떠날 때 채널 닫기 (측정은 이 기기에 남아 있어 다시 들어오면 이어서 보낸다)
  useEffect(() => {
    const map = channels.current;
    return () => {
      map.forEach((ch) => void supabase.removeChannel(ch));
      map.clear();
    };
  }, []);
}

export default useTest153LiveSender;
