/**
 * 153OS 앱 통로 훅 — 공지사항 · 우리 지점(소개 · 코치 · 후기) · 1:1 문의 (2026-11-02)
 *
 * 모두 Edge Function os-app-content 한 곳을 op 로 부른다(153OS 키는 서버에만).
 * 답 모양: { ok: true, data, message } | { ok: false, status, code, message }
 *   code NOT_REGISTERED = 이 앱 계정이 153OS 회원과 아직 안 이어짐(화면은 안내만 · 다시 묻지 않는다)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { InquiryCategory, OsBranchInfo, OsInquiry, OsInquiryThread, OsNotice, OsReviews } from "@/lib/osContent";

export class OsContentError extends Error {
  code: string;
  status: number | null;
  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = "OsContentError";
    this.code = code;
    this.status = status;
  }
}

/** 153OS 회원과 아직 안 이어진 계정 */
export const isNotRegistered = (e: unknown): boolean => e instanceof OsContentError && e.code === "NOT_REGISTERED";

type OsAnswer<T> = { ok: true; data: T; message: string | null } | { ok: false; status?: number; code: string; message: string };

/**
 * invoke 오류 → 화면 말 (2026-11-03 검수 — 예전엔 모두 '인터넷 연결'이었다).
 *   함수까지 못 감(오프라인 · 연결 끊김) → NETWORK · 로그인 만료(게이트웨이 401) → NOT_AUTHENTICATED ·
 *   함수가 ok:false 모양으로 답했으면 그 말 · 그 밖(함수 5xx · 중계 오류) → OS_UNAVAILABLE
 */
async function invokeError(error: unknown): Promise<OsContentError> {
  if (error instanceof FunctionsFetchError) return new OsContentError("NETWORK", "인터넷 연결을 확인하고 다시 시도해 주세요");
  if (error instanceof FunctionsHttpError) {
    const res = error.context instanceof Response ? error.context : null;
    const status = res?.status ?? null;
    const j = res ? ((await res.json().catch(() => null)) as { ok?: unknown; code?: unknown; message?: unknown } | null) : null;
    if (j && j.ok === false && typeof j.code === "string") {
      return new OsContentError(j.code, typeof j.message === "string" && j.message ? j.message : "잠시 뒤 다시 시도해 주세요", status);
    }
    if (status === 401) return new OsContentError("NOT_AUTHENTICATED", "다시 로그인해 주세요", 401);
    return new OsContentError("OS_UNAVAILABLE", "잠시 뒤 다시 시도해 주세요", status);
  }
  return new OsContentError("OS_UNAVAILABLE", "잠시 뒤 다시 시도해 주세요");
}

export async function callOs<T>(op: string, args: Record<string, unknown> = {}): Promise<{ data: T; message: string | null }> {
  const { data, error } = await supabase.functions.invoke("os-app-content", { body: { op, ...args } });
  if (error) throw await invokeError(error);
  const a = data as OsAnswer<T> | null;
  if (!a || typeof a !== "object") throw new OsContentError("BAD_RESPONSE", "잠시 뒤 다시 시도해 주세요");
  if (a.ok !== true) {
    const f = a as { code?: string; message?: string; status?: number };
    throw new OsContentError(f.code || "ERROR", f.message || "잠시 뒤 다시 시도해 주세요", f.status ?? null);
  }
  return { data: a.data, message: a.message };
}

const retryUnlessFinal = (count: number, e: unknown) =>
  count < 1 && !(e instanceof OsContentError && ["NOT_REGISTERED", "NOT_FOUND", "INVALID_REQUEST", "NOT_AUTHENTICATED"].includes(e.code));

const useUid = () => useAuth().user?.id ?? null;

// ── 공지 ───────────────────────────────────────────────────────
export function useOsNotices() {
  const uid = useUid();
  return useQuery({
    queryKey: ["os", uid, "notices"],
    enabled: !!uid,
    staleTime: 60_000,
    retry: retryUnlessFinal,
    queryFn: async () => (await callOs<OsNotice[]>("notices")).data ?? [],
  });
}

export function useOsNotice(id: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: ["os", uid, "notice", id],
    enabled: !!uid && !!id,
    staleTime: 60_000,
    retry: retryUnlessFinal,
    queryFn: async () => (await callOs<OsNotice>("notice", { id })).data,
  });
}

// ── 지점 · 코치 · 후기 ─────────────────────────────────────────
export function useOsBranch() {
  const uid = useUid();
  return useQuery({
    queryKey: ["os", uid, "branch"],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    retry: retryUnlessFinal,
    queryFn: async () => (await callOs<OsBranchInfo>("branch")).data,
  });
}

export function useOsReviews(enabled = true) {
  const uid = useUid();
  return useQuery({
    queryKey: ["os", uid, "reviews"],
    enabled: !!uid && enabled,
    staleTime: 60_000,
    retry: retryUnlessFinal,
    queryFn: async () => (await callOs<OsReviews>("reviews")).data ?? { mine: null, rows: [] },
  });
}

export function useSaveOsReview() {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: (v: { rating: number; body: string; coach_staff_id: string | null }) =>
      callOs<{ id: string; updated: boolean }>("review_save", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["os", uid, "reviews"] });
      qc.invalidateQueries({ queryKey: ["os", uid, "branch"] });
    },
  });
}

export function useDeleteOsReview() {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: () => callOs<{ done: boolean }>("review_delete"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["os", uid, "reviews"] });
      qc.invalidateQueries({ queryKey: ["os", uid, "branch"] });
    },
  });
}

// ── 1:1 문의 ───────────────────────────────────────────────────
export function useOsInquiries() {
  const uid = useUid();
  return useQuery({
    queryKey: ["os", uid, "inquiries"],
    enabled: !!uid,
    staleTime: 30_000,
    retry: retryUnlessFinal,
    queryFn: async () => (await callOs<OsInquiry[]>("inquiries")).data ?? [],
  });
}

export function useOsInquiry(id: string | undefined) {
  const uid = useUid();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["os", uid, "inquiry", id],
    enabled: !!uid && !!id,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: retryUnlessFinal,
    queryFn: async () => {
      const t = (await callOs<OsInquiryThread>("inquiry", { id })).data;
      // 열면 153OS 가 '새 답장' 표시를 지운다(돌려준 값은 지우기 전) → 목록도 다시 읽는다
      if (t?.inquiry?.unread_by_member) qc.invalidateQueries({ queryKey: ["os", uid, "inquiries"] });
      return t;
    },
  });
}

export function useCreateOsInquiry() {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: (v: { category: InquiryCategory; title: string; body: string }) => callOs<{ id: string }>("inquiry_new", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os", uid, "inquiries"] }),
  });
}

export function useReplyOsInquiry(id: string | undefined) {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: (body: string) => callOs<{ id: string }>("inquiry_reply", { id, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["os", uid, "inquiry", id] });
      qc.invalidateQueries({ queryKey: ["os", uid, "inquiries"] });
    },
  });
}
