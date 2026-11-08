/**
 * 📺 153 PB 측정 → 라이브보드 TV 로 실시간 신호 보내기 (코치 측정 화면 쪽) · 2026-11-08 대표님 「다음진행 추천대로」
 *   측정 상태가 바뀔 때마다 + 측정이 화면에 있는 동안 5초마다 채널 `test153-live:<지점 이름>` 으로 보낸다.
 *   싣는 것: 시작 시각 · 끝낸 구간 시각 · 멈춘 시각 · 부문 · (저장 뒤) 개인 최고 여부 — 이름 · user_id 는 싣지 않는다.
 *   2단계(히트 · 「2단계넘어가자」): 참가자(레인)마다 신호 하나 — id `<히트 id>:<레인>`. 닉네임은 TV 가 board 함수로 따로 읽는다.
 *   빠진 참가자 · 지운 측정 · '다음 측정'이면 clear 를 보내 TV 에서 내린다.
 *   TV(/tv/:지점/1 · 2)는 달리는 측정 신호를 받으면 153 PB 화면(pb1 · pb2)으로 저절로 넘어간다.
 *   신호가 안 가도(인터넷 · 채널 오류) 측정 · 저장은 그대로 된다 — 보내기는 늘 조용히 실패한다.
 */
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pbLiveChannel, type PbLiveMsg } from "@/lib/pbBoard";

/** 보낼 측정 하나 (sentAt · v 는 여기서 붙인다) */
export type LiveItem = Omit<PbLiveMsg, "v" | "sentAt">;

const HEARTBEAT_MS = 5000;

export function useTest153LiveSender(branchName: string | null | undefined, items: LiveItem[]) {
  const channels = useRef<Map<string, RealtimeChannel>>(new Map());
  /** 지금 TV 에 올라가 있는 id → 지점 */
  const live = useRef<Map<string, string>>(new Map());
  const latest = useRef<{ branch: string; msgs: PbLiveMsg[] } | null>(null);

  const send = async (branch: string, event: "run" | "clear", payload: object) => {
    const ch = channels.current.get(branch);
    if (!ch || ch.state !== "joined") return;
    try {
      await ch.send({ type: "broadcast", event, payload });
    } catch {
      /* 보내기 실패는 측정에 영향 없음 */
    }
  };

  const channelFor = (branch: string): RealtimeChannel => {
    let ch = channels.current.get(branch);
    if (!ch) {
      ch = supabase.channel(pbLiveChannel(branch));
      ch.subscribe((status) => {
        // 붙자마자 지금 상태를 한 번 — 처음 신호를 놓치지 않게
        if (status !== "SUBSCRIBED" || latest.current?.branch !== branch) return;
        for (const m of latest.current.msgs) void send(branch, "run", m);
      });
      channels.current.set(branch, ch);
    }
    return ch;
  };

  // 상태가 바뀔 때마다
  useEffect(() => {
    const branch = (branchName ?? "").trim();
    const now = Date.now();
    const msgs: PbLiveMsg[] = branch ? items.map((it) => ({ ...it, v: 1, sentAt: now })) : [];
    const keep = new Set(msgs.map((m) => m.id));
    // 빠진 측정 · 지점이 바뀐 측정은 내린다
    for (const [id, b] of [...live.current]) {
      if (!keep.has(id) || b !== branch) {
        void send(b, "clear", { v: 1, id, clear: true, sentAt: now });
        live.current.delete(id);
      }
    }
    if (msgs.length) {
      channelFor(branch);
      latest.current = { branch, msgs };
      for (const m of msgs) {
        live.current.set(m.id, branch);
        void send(branch, "run", m);
      }
    } else {
      latest.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchName, items]);

  // 5초마다 다시 — TV 가 새로고침돼도 따라잡게
  const has = items.length > 0;
  useEffect(() => {
    if (!has) return;
    const t = window.setInterval(() => {
      const cur = latest.current;
      if (!cur) return;
      const now = Date.now();
      for (const m of cur.msgs) void send(cur.branch, "run", { ...m, sentAt: now });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has]);

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
