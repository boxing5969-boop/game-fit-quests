/**
 * 📲 휴대폰 알림 — 이 기기 상태 + 켜기 · 끄기 · 테스트 (2026-10-01).
 * 상태는 화면에 돌아올 때마다 다시 읽는다 (휴대폰 설정에서 알림을 끄고 돌아오는 경우).
 *
 * 🔔 알림 켜기 보상 (2026-10-15 대표님: 오삼코치 AI 1주차 — 챔피언 머니 500, 한 사람 한 번).
 *   서버가 정본 — get_my_push_reward() · claim_push_optin_reward() (시범 지점 회원만, 켜진 기기가 있어야, 지갑은 grant_gems).
 *   · 켜기에 성공하면 바로 받는다
 *   · 이미 켜 둔 회원은 이 카드가 있는 화면(홈·알림함)을 열 때 한 번 받는다
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  disablePush,
  enablePush,
  isIosUA,
  isPushServiceError,
  logPushEnableFailure,
  readPushState,
  sendTestPush,
  subscribeHelp,
  type PushFailStage,
  type PushState,
} from "@/lib/pushClient";

export type PushBusy = null | "enable" | "disable" | "test";

export const PUSH_REWARD_KEY = "153push:reward";
/** amount = 챔피언 머니, xp = 첫 켜기 XP, dailyXp = 켜 둔 동안 출석할 때마다 XP (2026-10-15) */
export type PushReward = { amount: number; xp: number; dailyXp: number; eligible: boolean; claimed: boolean };

// 새 함수들은 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string) => (supabase.rpc as any)(name, {});

const parsePushReward = (d: unknown): PushReward | null => {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  return {
    amount: Number(o.amount) || 0,
    xp: Number(o.xp) || 0,
    dailyXp: Number(o.daily_xp) || 0,
    eligible: o.eligible === true,
    claimed: o.claimed === true,
  };
};

/** 알림이 막혔을 때 다시 허용하는 길 — 기기별로 */
export function deniedHelp(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  if (isIosUA(ua, typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints || 0)) {
    return "아이폰 설정 → 알림 → 마이복서153 → '알림 허용'을 켜 주세요.";
  }
  return "휴대폰 설정 → 애플리케이션 → 마이복서153(또는 Chrome) → 알림을 허용해 주세요. 크롬에서 쓰면 주소창 옆 ⋮ → 설정 → 사이트 설정 → 알림에서 허용으로 바꿀 수 있어요.";
}

export function usePushNotifications() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<PushBusy>(null);
  const qc = useQueryClient();

  // 알림 켜기 보상 상태 — 대상이 아니면 서버가 eligible=false · 금액 0 으로 답한다
  const rewardQ = useQuery({
    queryKey: [PUSH_REWARD_KEY, uid],
    enabled: !!uid,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_push_reward");
      if (error) throw error;
      return parsePushReward(data);
    },
  });
  const reward = rewardQ.data ?? null;
  const rewardClaimable = !!reward && reward.eligible && !reward.claimed;

  /** 보상 받기 — 서버가 한 번만 준다. 실패해도 알림 켜기는 그대로 성공이다 */
  const claimReward = useCallback(async () => {
    try {
      const { data, error } = await rpc("claim_push_optin_reward");
      const r = !error && data && typeof data === "object" ? (data as { granted?: boolean; amount?: number; xp?: number }) : null;
      if (r?.granted) {
        const xp = Number(r.xp || 0);
        toast.success(`🔔 알림 켜기 보상 · 챔피언 머니 +${Number(r.amount || 0).toLocaleString("ko-KR")}${xp > 0 ? ` · XP +${xp}` : ""}`, {
          description: "알림을 켜 두면 체육관 출석할 때마다 XP를 더 받아요 — 랭킹에 도움이 돼요",
        });
      }
    } catch {
      /* 다음에 이 화면을 열 때 다시 */
    }
    void qc.invalidateQueries({ queryKey: [PUSH_REWARD_KEY] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
  }, [qc]);

  // 이미 켜 둔 회원 — 화면을 열 때 한 번 받는다
  const autoClaimed = useRef(false);
  useEffect(() => {
    if (autoClaimed.current || state?.kind !== "on" || !rewardClaimable) return;
    autoClaimed.current = true;
    void claimReward();
  }, [state, rewardClaimable, claimReward]);

  const refresh = useCallback(async () => {
    try {
      setState(await readPushState(uid));
    } catch {
      setState({ kind: "unsupported", why: "no-push" });
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  /** ⚠️ 버튼 onClick 에서 바로 부른다 — 권한 묻기 앞에 await 가 끼면 아이폰은 권한 창을 띄우지 않는다 */
  const enable = useCallback(() => {
    if (!uid || busy) return;
    setBusy("enable");
    void enablePush(uid)
      .then(async (r) => {
        // 이 프로젝트는 strictNullChecks 가 꺼져 있어 r.ok 로는 좁혀지지 않는다 → 'reason' 유무로 나눈다
        const reason = "reason" in r ? r.reason : null;
        if (!reason) {
          toast.success("휴대폰 알림을 켰어요 🔔", {
            description: "공지 · 출석 · 수업 소식을 휴대폰으로 바로 알려 드릴게요.",
          });
          if (rewardClaimable) {
            autoClaimed.current = true;
            await claimReward();
          }
        } else if (reason === "denied") {
          toast.error("알림이 막혀 있어요", { description: deniedHelp(), duration: 9000 });
        } else if (reason === "dismissed") {
          toast("알림 창에서 '허용'을 누르면 켜져요");
        } else if (reason === "unsupported" || reason === "unsupported_endpoint") {
          toast.error("이 브라우저는 휴대폰 알림을 지원하지 않아요", {
            description: "안드로이드는 크롬, 아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요.",
          });
        } else {
          // 2026-10-18 오류 신고: 무조건 "인터넷 연결 확인"이라 와이파이 문제로 오해 → 막힌 곳에 따라 안내를 나누고 기록한다
          const f = r as { stage?: PushFailStage; detail?: string };
          const stage = f.stage ?? "unknown";
          const detail = f.detail ?? "";
          void logPushEnableFailure(stage, detail);
          const offline = typeof navigator !== "undefined" && navigator.onLine === false;
          const netErr = /fetch|network|timeout|timed out/i.test(detail);
          if (offline || (stage !== "subscribe" && netErr)) {
            toast.error("알림을 켜지 못했어요", { description: "인터넷이 잠깐 끊긴 것 같아요. 연결을 확인하고 다시 눌러 주세요." });
          } else if (stage === "subscribe" && isPushServiceError(detail)) {
            // 2026-10-19: 등록 단계 AbortError·'push service' = 알림 서버에 닿지 못함 — 브라우저가 막은 게 아니다
            toast.error("알림을 켜지 못했어요", { description: "알림 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요." });
          } else if (stage === "subscribe") {
            toast.error("이 브라우저가 알림 등록을 막았어요", { description: subscribeHelp(), duration: 9000 });
          } else {
            toast.error("알림을 켜지 못했어요", { description: "잠시 후 다시 눌러 주세요. 계속 안 되면 오류 신고로 알려 주세요." });
          }
        }
        await refresh();
      })
      .finally(() => setBusy(null));
  }, [uid, busy, refresh, rewardClaimable, claimReward]);

  const disable = useCallback(() => {
    if (busy) return;
    setBusy("disable");
    void disablePush()
      .then(async (ok) => {
        if (ok) toast("이 기기의 휴대폰 알림을 껐어요", { description: "알림함(🔔)에는 그대로 쌓여요." });
        else toast.error("서버에 반영하지 못했어요", { description: "이 기기는 껐어요. 잠시 후 다시 시도하면 정리돼요." });
        await refresh();
      })
      .finally(() => setBusy(null));
  }, [busy, refresh]);

  const test = useCallback(() => {
    if (busy) return;
    setBusy("test");
    void sendTestPush()
      .then((r) => {
        const reason = "reason" in r ? r.reason : null;
        if (!reason) {
          toast.success("테스트 알림을 보냈어요", {
            description: "몇 초 안에 휴대폰에 떠요. 안 오면 휴대폰 설정에서 마이복서153 알림이 켜져 있는지 확인해 주세요.",
            duration: 7000,
          });
        } else if (reason === "too_soon") {
          toast("방금 보냈어요 — 30초 뒤에 다시 눌러 주세요");
        } else if (reason === "no_subscription") {
          toast.error("켜진 기기가 없어요", { description: "먼저 '알림 켜기'를 눌러 주세요." });
        } else {
          toast.error("테스트 알림을 보내지 못했어요", { description: "잠시 후 다시 눌러 주세요." });
        }
      })
      .finally(() => setBusy(null));
  }, [busy]);

  return { state, busy, enable, disable, test, refresh, signedIn: !!uid, reward, rewardClaimable };
}
