/**
 * 🎨 프로필 카드 꾸미기 — 서버 읽기 · 저장 (2026-11-21).
 *   get_my_card_deco()  — 받은 꾸미기 · 지금 낀 것
 *   set_my_card_deco()  — 끼기(받지 않은 건 서버가 막는다)
 *   get_card_decos(ids) — 다른 회원 카드(앱)
 * 캐시 키는 153deco: 로 시작한다.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { translateError } from "@/lib/errorMessages";
import { normalizeDeco, type CardDecoStyle } from "@/lib/cardDeco";

export const DECO_KEY = "153deco";

export interface MyCardDeco {
  owned: Set<string>;
  /** 받은 날 — 새로 받은 꾸미기에 'NEW' */
  grantedAt: Record<string, string>;
  equipped: CardDecoStyle | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args ?? {});

export function parseMyCardDeco(raw: unknown): MyCardDeco {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const owned = new Set<string>();
  const grantedAt: Record<string, string> = {};
  for (const o of Array.isArray(r.owned) ? r.owned : []) {
    if (o && typeof o === "object" && typeof (o as { item_id?: unknown }).item_id === "string") {
      const id = (o as { item_id: string }).item_id;
      owned.add(id);
      const at = (o as { granted_at?: unknown }).granted_at;
      if (typeof at === "string") grantedAt[id] = at;
    }
  }
  return { owned, grantedAt, equipped: normalizeDeco(r.equipped) };
}

export function useMyCardDeco(enabled = true) {
  const { user } = useAuth();
  return useQuery<MyCardDeco>({
    queryKey: [DECO_KEY, "me", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_card_deco");
      if (error) return parseMyCardDeco(null);
      return parseMyCardDeco(data);
    },
  });
}

export function useSaveMyCardDeco() {
  const qc = useQueryClient();
  return async (style: CardDecoStyle) => {
    const { data, error } = await rpc("set_my_card_deco", {
      p_frame: style.frame ?? null,
      p_skin: style.skin ?? null,
      p_sticker: style.sticker ?? null,
      p_title: style.title ?? null,
    });
    if (error) throw new Error(translateError(error));
    const parsed = parseMyCardDeco(data);
    qc.setQueriesData({ queryKey: [DECO_KEY, "me"] }, parsed);
    void qc.invalidateQueries({ queryKey: [DECO_KEY, "others"] });
    return parsed;
  };
}

/** 다른 회원 카드의 꾸미기 — 한 사람 */
export function useCardDecoOf(userId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery<CardDecoStyle | null>({
    queryKey: [DECO_KEY, "others", userId ?? ""],
    enabled: !!user?.id && !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_card_decos", { p_user_ids: [userId] });
      if (error || !Array.isArray(data) || data.length === 0) return null;
      return normalizeDeco(data[0]);
    },
  });
}
