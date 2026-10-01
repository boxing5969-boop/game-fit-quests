/**
 * 🔔 내 알림 — 목록 · 안 읽은 수 · 읽음 처리 (2026-10-01).
 *
 * 본사 계정은 RLS 상 모든 회원의 알림이 보이므로, 늘 user_id = 나 로 걸러 읽는다 (안 그러면 남의 알림이 섞인다).
 * 읽음 처리는 서버 함수 mark_notifications_read — 서버 시각으로, 내 알림만.
 * 쿼리키는 "153notif" 로 시작 (다른 화면 캐시와 겹치지 않게).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeNotification, type AppNotification } from "@/lib/notifications";

export const NOTIF_KEY = ["153notif"] as const;
const PAGE = 30;
const COLS = "id, title, body, link, read_at, created_at";

// notifications.link · mark_notifications_read 는 생성된 타입보다 새것이라 느슨한 클라이언트로 부른다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useUnreadNotificationCount(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NOTIF_KEY, "unread", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async (): Promise<number> => {
      const { count, error } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMyNotifications() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...NOTIF_KEY, "list", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 15_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<AppNotification[]> => {
      let q = db
        .from("notifications")
        .select(COLS)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown[]).map(normalizeNotification).filter((n): n is AppNotification => !!n);
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].createdAt : undefined),
  });
}

/** 읽음 처리 — ids 가 없으면 내 알림 전부 */
export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | null): Promise<number> => {
      const { data, error } = await db.rpc("mark_notifications_read", { p_ids: ids && ids.length ? ids : null });
      if (error) throw error;
      return typeof data === "number" ? data : 0;
    },
    onSuccess: (_n, ids) => {
      const uid = user?.id ?? "anon";
      if (!ids) qc.setQueryData([...NOTIF_KEY, "unread", uid], 0);
      else void qc.invalidateQueries({ queryKey: [...NOTIF_KEY, "unread", uid] });
    },
  });
}
