/**
 * 메시지(DM) hooks — 캐시 키는 전부 ["dm", ...] 로 시작한다 (다른 기능 키와 안 겹치게).
 *
 * 실시간 연결 대신 짧게 다시 읽는다 (탭이 가려지면 멈춘다 — React Query 기본):
 *   · 대화방 4초 · 받은함 15초 · 배지 60초(+ 앱으로 돌아오면 바로)
 * 보내기·수락·차단·신고 뒤에는 관련 목록·배지를 바로 다시 읽는다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDmPeer,
  getDmReport,
  getDmSettings,
  getDmSummary,
  getDmThread,
  hideDmThread,
  listDmReports,
  listDmThreads,
  reportDm,
  resolveDmReport,
  respondDm,
  searchDmPeople,
  sendDm,
  setDmAllowRequests,
  setDmBlock,
  type DmAdminAction,
  type DmBox,
  type DmReportReason,
} from "@/services/dmService";

export const DM_KEY = ["dm"] as const;

/** 배지 — 메뉴 타일·머리글 아이콘 */
export function useDmSummary(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...DM_KEY, "summary", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: getDmSummary,
  });
}

export function useDmThreads(box: DmBox) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...DM_KEY, "threads", box, user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: () => listDmThreads(box),
  });
}

/** 대화방 — 최신 40개. 4초마다 새로 읽고, 읽으면 서버가 읽음 처리한다 */
export function useDmThread(threadId: string | null | undefined) {
  return useQuery({
    queryKey: [...DM_KEY, "thread", threadId ?? "none"],
    enabled: !!threadId,
    staleTime: 0,
    // 처음부터 열 수 없는 대화(권한 없음 등)는 계속 두드리지 않는다. 한 번 열린 대화는 잠깐 실패해도 계속 다시 읽는다
    refetchInterval: (query) => (query.state.data !== undefined || query.state.status !== "error" ? 4_000 : false),
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: () => getDmThread(threadId!),
  });
}

/** 한 사람과 대화 가능한지 — 라이센스 카드 '메시지' 버튼, /messages/to/:userId */
export function useDmPeer(userId: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...DM_KEY, "peer", userId ?? "none", user?.id ?? "anon"],
    enabled: enabled && !!userId && !!user?.id && userId !== user?.id,
    staleTime: 15_000,
    retry: false,
    queryFn: () => getDmPeer(userId!),
  });
}

export function useDmPeople(search: string, enabled = true) {
  const { user } = useAuth();
  const q = search.trim();
  return useQuery({
    queryKey: [...DM_KEY, "people", q, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => searchDmPeople(q),
  });
}

export function useDmSettings(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...DM_KEY, "settings", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 10_000,
    queryFn: getDmSettings,
  });
}

/** 보내기·수락·차단 뒤 — 받은함·배지·해당 대화를 다시 읽는다 */
function useDmRefresh() {
  const qc = useQueryClient();
  return (threadId?: string | null) => {
    void qc.invalidateQueries({ queryKey: [...DM_KEY, "threads"] });
    void qc.invalidateQueries({ queryKey: [...DM_KEY, "summary"] });
    void qc.invalidateQueries({ queryKey: [...DM_KEY, "peer"] });
    if (threadId) void qc.invalidateQueries({ queryKey: [...DM_KEY, "thread", threadId] });
  };
}

export function useSendDm() {
  const refresh = useDmRefresh();
  return useMutation({
    mutationFn: sendDm,
    onSuccess: (res) => refresh(res.thread_id),
  });
}

export function useRespondDm() {
  const refresh = useDmRefresh();
  return useMutation({
    mutationFn: (v: { threadId: string; action: "accept" | "decline" }) => respondDm(v.threadId, v.action),
    onSuccess: (_res, v) => refresh(v.threadId),
  });
}

export function useHideDmThread() {
  const refresh = useDmRefresh();
  return useMutation({
    mutationFn: (threadId: string) => hideDmThread(threadId),
    onSuccess: (_res, threadId) => refresh(threadId),
  });
}

export function useDmBlock() {
  const qc = useQueryClient();
  const refresh = useDmRefresh();
  return useMutation({
    mutationFn: (v: { userId: string; block: boolean; threadId?: string | null }) => setDmBlock(v.userId, v.block),
    onSuccess: (_res, v) => {
      refresh(v.threadId);
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "settings"] });
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "people"] });
    },
  });
}

export function useSetDmAllowRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allow: boolean) => setDmAllowRequests(allow),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...DM_KEY, "settings"] }),
  });
}

export function useReportDm() {
  const qc = useQueryClient();
  const refresh = useDmRefresh();
  return useMutation({
    mutationFn: (v: { threadId: string; reason: DmReportReason; detail?: string; block: boolean }) => reportDm(v),
    onSuccess: (_res, v) => {
      refresh(v.threadId);
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "settings"] });
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "admin"] });
    },
  });
}

// ── 본사 — 신고 확인 ─────────────────────────────────────────
export function useDmReports(status: "open" | "resolved" | "all", enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...DM_KEY, "admin", "reports", status, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 10_000,
    refetchInterval: 60_000,
    queryFn: () => listDmReports(status),
  });
}

export function useDmReport(reportId: string | null) {
  return useQuery({
    queryKey: [...DM_KEY, "admin", "report", reportId ?? "none"],
    enabled: !!reportId,
    staleTime: 10_000,
    retry: false,
    queryFn: () => getDmReport(reportId!),
  });
}

export function useResolveDmReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { reportId: string; action: DmAdminAction; note?: string }) =>
      resolveDmReport(v.reportId, v.action, v.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "admin"] });
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "summary"] });
    },
  });
}
