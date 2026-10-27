/**
 * 🏢 지점 회의실 — 앱 전체 접속 신호 (2026-10-27 · 보고서 '앉기 · 나가기')
 *
 *   1. 지도진이 앱을 열면 회의실 화면을 안 열어도 '사무실 접속' 신호를 보낸다 → 사무실에서 내 캐릭터가 자리에 앉는다.
 *   2. 앱을 닫거나 폰 화면을 끄면 30초 뒤 신호를 거둔다 → 캐릭터가 일어나 문으로 나간다(잠깐 전화 받을 때 깜빡이지 않게).
 *   3. 같은 채널로 '바뀜 신호'(회의 열림 · 채팅 · 상태)를 받아 회의실 화면을 다시 읽는다.
 *   4. 회의 채팅에 쓰는 중 신호(broadcast 'typing' {u, off?}, 내용 없음)를 주고받는다 → 캐릭터 옆 '…'.
 *   5. 음성 회의(2단계)에 들어가 있나 · 마이크 · 카메라를 내 Presence 표시에 같이 싣는다(officePresence setOfficeSelfMeta).
 *
 *   채널: 비공개 'office:<지점 코드>' — 서버 정책(realtime.messages)이 그 지점 지도진 + 대표님만 들인다.
 *   회원 · 다른 지점 지도진은 office_me 가 빈 목록이라 아무것도 하지 않는다.
 */
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffProfile } from "@/lib/staffDisplay";
import { OFFICE_KEY, useOfficeMe } from "@/services/officeService";
import {
  OFFICE_LEAVE_DELAY_MS,
  clearOfficeTopic,
  getOfficeSelfMeta,
  markOfficeTyping,
  officeCallsFromPresence,
  setOfficeSender,
  setOfficeTopicState,
  setOfficeTracker,
} from "@/lib/officePresence";

/** 바뀜 신호 → 다시 읽을 것 */
const KEYS_FOR: Record<string, string[]> = {
  msg: ["messages", "list"],
  status: ["state"],
  attendees: ["state", "messages"],
  meeting: ["state", "me", "messages", "list"],
  recap: ["recap", "list"], // 3단계 — 요약 · 전략 회의실 지시 · 못 오신 분 알림
};

const OfficePresenceBridge = () => {
  const { user, profile, realRole } = useAuth();
  const qc = useQueryClient();
  // 회원에게는 묻지도 않는다 — 지도진 표시(is_staff)나 관리 권한이 있는 사람만
  const maybeStaff = !!user && (isStaffProfile(profile) || (!!realRole && realRole !== "member"));
  const { data } = useOfficeMe(maybeStaff);
  const topics = useMemo(() => (data?.offices ?? []).map((o) => o.topic).filter(Boolean), [data]);
  const topicKey = topics.join("|");
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!uid || topics.length === 0) return;
    let disposed = false;
    let tracked = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const channels: RealtimeChannel[] = [];

    const flush = () => {
      pingTimer = undefined;
      const parts = new Set<string>();
      pending.forEach((w) => (KEYS_FOR[w] ?? ["state", "me", "messages", "list"]).forEach((k) => parts.add(k)));
      pending.clear();
      parts.forEach((k) => void qc.invalidateQueries({ queryKey: [...OFFICE_KEY, k] }));
    };

    const trackAll = async () => {
      tracked = true;
      await Promise.all(
        channels.map((ch) =>
          ch.state === "joined"
            ? ch.track({ at: Date.now(), ...getOfficeSelfMeta(ch.subTopic) }).catch(() => undefined)
            : Promise.resolve(undefined),
        ),
      );
    };
    const untrackAll = async () => {
      tracked = false;
      await Promise.all(channels.map((ch) => ch.untrack().catch(() => undefined)));
    };

    (async () => {
      // 비공개 채널은 로그인 토큰으로 들어간다
      try {
        await supabase.realtime.setAuth();
      } catch {
        /* 토큰은 supabase-js 가 따로 붙인다 */
      }
      if (disposed) return;
      for (const topic of topics) {
        const ch = supabase.channel(topic, { config: { private: true, presence: { key: uid, enabled: true } } });
        ch.on("presence", { event: "sync" }, () => {
          const ps = ch.presenceState() as unknown as Record<string, ReadonlyArray<Record<string, unknown>>>;
          setOfficeTopicState(topic, { online: new Set(Object.keys(ps)), calls: officeCallsFromPresence(ps) });
        })
          .on("broadcast", { event: "changed" }, (msg) => {
            const what = (msg?.payload as { t?: string } | undefined)?.t ?? "";
            pending.add(what);
            if (!pingTimer) pingTimer = setTimeout(flush, 350);
          })
          .on("broadcast", { event: "typing" }, (msg) => {
            const p = (msg?.payload ?? {}) as { u?: unknown; off?: unknown };
            if (typeof p.u === "string" && p.u !== uid) markOfficeTyping(topic, p.u, !p.off);
          })
          .subscribe((status) => {
            setOfficeTopicState(topic, { connected: status === "SUBSCRIBED" });
            if (status === "SUBSCRIBED" && document.visibilityState !== "hidden") {
              tracked = true;
              void ch.track({ at: Date.now(), ...getOfficeSelfMeta(topic) }).catch(() => undefined);
            }
          });
        setOfficeSender(topic, (event, payload) => {
          if (ch.state === "joined") void ch.send({ type: "broadcast", event, payload }).catch(() => undefined);
        });
        // 음성 회의 들어감 · 마이크 · 카메라가 바뀌면 내 표시를 다시 싣는다
        setOfficeTracker(topic, (meta) => {
          if (tracked && ch.state === "joined") void ch.track({ at: Date.now(), ...meta }).catch(() => undefined);
        });
        channels.push(ch);
      }
    })();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // 음성 회의 중이면 자리를 지킨다 (화면을 끄고 듣고 있을 수 있다)
        if (topics.some((t) => getOfficeSelfMeta(t).call)) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => void untrackAll(), OFFICE_LEAVE_DELAY_MS);
        return;
      }
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = undefined;
      }
      if (!tracked) void trackAll();
      // 돌아오면 놓친 바뀜을 채운다
      void qc.invalidateQueries({ queryKey: OFFICE_KEY });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (hideTimer) clearTimeout(hideTimer);
      if (pingTimer) clearTimeout(pingTimer);
      channels.forEach((ch) => void supabase.removeChannel(ch));
      topics.forEach((t) => clearOfficeTopic(t));
    };
    // topics 는 topicKey 로 본다 (같은 목록이면 다시 들어가지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, topicKey, qc]);

  return null;
};

export default OfficePresenceBridge;
