/**
 * 보호자 연결 — 서버 부르기 · 훅 (2026-11-23). 규칙은 서버, 다듬기 · 글은 lib/guardian.
 * 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 꺼진 것으로 — 화면은 아무것도 안 그린다.
 * 예시 화면: `?demo=1`(보호자 화면 · 연결 화면) · `?guardiandemo=1`(설정 카드) · `?finishdemo=1`(「운동을 끝낼까요?」) — 서버를 안 부른다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_GUARDIAN_STATE,
  normalizeGuardianHome,
  normalizeGuardianState,
  type GuardianHome,
  type GuardianRelation,
  type GuardianState,
} from "@/lib/guardian";

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: RpcError }>;

const fail = (error: RpcError, fallback: string): never => {
  throw new Error(error?.message?.replace(/^.*?ERROR:\s*/, "") || fallback);
};

export const GUARDIAN_KEY = ["153guardian"] as const;

/** 예시 모드 — 이 창(탭)에서 한 번 켜면 닫을 때까지 */
export function guardianDemo(param: "demo" | "guardiandemo" | "finishdemo"): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get(param);
  const key = `153guardian:${param}`;
  try {
    if (q === "1") window.sessionStorage.setItem(key, "1");
    if (q === "0") window.sessionStorage.removeItem(key);
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return q === "1";
  }
}

export interface GuardianStateResult {
  available: boolean;
  state: GuardianState;
}

export function useMyGuardianState(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...GUARDIAN_KEY, "state", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<GuardianStateResult> => {
      const { data, error } = await rpc("my_guardian_state");
      if (error) return { available: false, state: EMPTY_GUARDIAN_STATE };
      return { available: true, state: normalizeGuardianState(data) };
    },
  });
}

export function useGuardianHome(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...GUARDIAN_KEY, "home", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async (): Promise<GuardianHome | null> => {
      const { data, error } = await rpc("guardian_home");
      if (error) {
        if (missingFn(error)) return null;
        fail(error, "기록을 불러오지 못했어요");
      }
      return normalizeGuardianHome(data);
    },
  });
}

export interface InviteMade {
  token: string;
  expiresAt: string | null;
  name: string;
  minor?: boolean | null;
}

const asInvite = (data: unknown): InviteMade => {
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    token: String(r.token ?? ""),
    expiresAt: typeof r.expires_at === "string" ? r.expires_at : null,
    name: typeof r.name === "string" ? r.name : "회원",
    minor: r.minor === true ? true : r.minor === false ? false : null,
  };
};

export async function createGuardianInvite(): Promise<InviteMade> {
  const { data, error } = await rpc("guardian_invite_create");
  if (error) fail(error, "링크를 만들지 못했어요");
  return asInvite(data);
}

export async function createGuardianInviteFor(memberId: string): Promise<InviteMade> {
  const { data, error } = await rpc("guardian_invite_create_for", { p_member: memberId });
  if (error) fail(error, "QR 을 만들지 못했어요");
  return asInvite(data);
}

export type PeekCode = "login" | "bad" | "used" | "done" | "expired" | "self" | "missing";
export type PeekResult =
  | { ok: true; name: string; branch: string | null; via: "child_invite" | "desk_qr"; linked: string | null; needsAccept: boolean }
  | { ok: false; code: PeekCode };

export async function peekGuardianInvite(token: string): Promise<PeekResult> {
  const { data, error } = await rpc("guardian_invite_peek", { p_token: token });
  if (error) {
    if (missingFn(error)) return { ok: false, code: "missing" };
    fail(error, "링크를 확인하지 못했어요");
  }
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      name: typeof r.name === "string" ? r.name : "회원",
      branch: typeof r.branch === "string" ? r.branch : null,
      via: r.via === "desk_qr" ? "desk_qr" : "child_invite",
      linked: typeof r.linked === "string" ? r.linked : null,
      needsAccept: r.needs_accept === true,
    };
  }
  const code = (["login", "bad", "used", "done", "expired", "self"] as const).find((c) => c === r.code) ?? "bad";
  return { ok: false, code };
}

export async function acceptGuardianInvite(token: string, relation: GuardianRelation): Promise<{ status: string; name: string | null }> {
  const { data, error } = await rpc("guardian_invite_accept", { p_token: token, p_relation: relation });
  if (error) fail(error, "연결하지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  return { status: String(r.status ?? "active"), name: typeof r.name === "string" ? r.name : null };
}

export interface StaffLinks {
  minor: boolean | null;
  links: GuardianState["links"];
}

export function useGuardianStaffLinks(memberId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...GUARDIAN_KEY, "staff", memberId ?? ""],
    enabled: enabled && !!memberId,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<StaffLinks | null> => {
      const { data, error } = await rpc("guardian_staff_links", { p_member: memberId });
      if (error) return null; // 함수가 없거나 권한이 없으면 칸을 안 그린다
      const st = normalizeGuardianState({ ...(data as object), on: true });
      const r = (data ?? {}) as Record<string, unknown>;
      return { minor: r.minor === true ? true : r.minor === false ? false : null, links: st.links };
    },
  });
}

/** 수락 · 끊기 — 끝나면 상태를 다시 읽는다 */
export function useGuardianActions() {
  const qc = useQueryClient();
  const changed = () => qc.invalidateQueries({ queryKey: GUARDIAN_KEY });
  const respond = useMutation({
    mutationFn: async ({ linkId, accept }: { linkId: string; accept: boolean }) => {
      const { error } = await rpc("guardian_respond", { p_link: linkId, p_accept: accept });
      if (error) fail(error, "처리하지 못했어요");
    },
    onSuccess: changed,
  });
  const unlink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await rpc("guardian_unlink", { p_link: linkId });
      if (error) fail(error, "연결을 끊지 못했어요");
    },
    onSuccess: changed,
  });
  return { respond, unlink, changed };
}
