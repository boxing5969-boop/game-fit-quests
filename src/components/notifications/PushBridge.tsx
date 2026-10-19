/**
 * 📲 휴대폰 알림 ↔ 앱 화면 연결 (화면에 아무것도 그리지 않는다 · 2026-10-01).
 *
 *   · 로그인한 상태로 앱을 열면 → 이 기기 구독을 하루 한 번 서버에 알린다 (다른 사람이 켠 구독이면 지운다)
 *   · 휴대폰 알림을 눌렀는데 앱이 이미 열려 있으면 → 서비스워커가 보낸 경로로 이동 (새로고침 없이)
 *   · 앱이 열려 있을 때 알림이 오면 → 알림함 숫자를 바로 새로 센다
 *   · 로그아웃되면 → 이 기기 구독을 지운다 (다음 사람이 이 폰으로 로그인해도 앞사람 알림이 오지 않게)
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NOTIF_KEY } from "@/hooks/useNotifications";
import { isSafeAppLink } from "@/lib/notifications";
import { forgetPushOnThisDevice, syncPushSubscription } from "@/lib/pushClient";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";

const PushBridge = () => {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    void syncPushSubscription(uid).catch(() => {
      /* 다음에 앱을 열 때 다시 */
    });
  }, [uid]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: unknown; url?: unknown } | null;
      if (!d || typeof d !== "object") return;
      if (d.type === "153:navigate" && isSafeAppLink(d.url)) navigate(d.url);
      if (d.type === "153:push") void qc.invalidateQueries({ queryKey: NOTIF_KEY });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate, qc]);

  // 아이폰 앱(App Store): 알림을 누르면 그 화면으로 · 앱이 열려 있을 때 오면 알림함 숫자 새로 (2026-10-19)
  useEffect(() => {
    if (!isIosApp()) return;
    let off: (() => void) | null = null;
    let alive = true;
    void loadIosAppNative().then((m) => {
      if (!alive) return;
      off = m.listenPush(
        (path) => navigate(path),
        () => void qc.invalidateQueries({ queryKey: NOTIF_KEY }),
      );
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [navigate, qc]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void forgetPushOnThisDevice().catch(() => {});
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
};

export default PushBridge;
