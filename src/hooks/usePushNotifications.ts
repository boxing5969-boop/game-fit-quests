/**
 * 📲 휴대폰 알림 — 이 기기 상태 + 켜기 · 끄기 · 테스트 (2026-10-01).
 * 상태는 화면에 돌아올 때마다 다시 읽는다 (휴대폰 설정에서 알림을 끄고 돌아오는 경우).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  disablePush,
  enablePush,
  isIosUA,
  readPushState,
  sendTestPush,
  type PushState,
} from "@/lib/pushClient";

export type PushBusy = null | "enable" | "disable" | "test";

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
        } else if (reason === "denied") {
          toast.error("알림이 막혀 있어요", { description: deniedHelp(), duration: 9000 });
        } else if (reason === "dismissed") {
          toast("알림 창에서 '허용'을 누르면 켜져요");
        } else if (reason === "unsupported" || reason === "unsupported_endpoint") {
          toast.error("이 브라우저는 휴대폰 알림을 지원하지 않아요", {
            description: "안드로이드는 크롬, 아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요.",
          });
        } else {
          toast.error("알림을 켜지 못했어요", { description: "인터넷 연결을 확인하고 잠시 후 다시 눌러 주세요." });
        }
        await refresh();
      })
      .finally(() => setBusy(null));
  }, [uid, busy, refresh]);

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

  return { state, busy, enable, disable, test, refresh, signedIn: !!uid };
}
