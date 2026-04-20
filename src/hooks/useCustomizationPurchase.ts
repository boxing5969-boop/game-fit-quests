import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OwnedItem {
  category: string;
  item_key: string;
}

export function useOwnedCustomizations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["owned-customizations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_owned_customizations")
        .select("category, item_key")
        .eq("user_id", user!.id);
      if (error) {
        if (error.code === "42P01") return [] as OwnedItem[];
        throw error;
      }
      return ((data || []) as unknown) as OwnedItem[];
    },
  });
}

export function useOwnedSet() {
  const { data } = useOwnedCustomizations();
  return useMemo(() => {
    const set = new Set<string>();
    if (data) {
      for (const item of data) {
        set.add(`${item.category}:${item.item_key}`);
      }
    }
    return set;
  }, [data]);
}

/**
 * Server-side RPC can return these logical failures in the `error` field:
 *   • not_authenticated    — no session (should be filtered client-side)
 *   • hof_required         — item needs Hall-of-Fame status
 *                             (carries `category`, `item_key`)
 *   • level_locked         — user level below requiredLevel
 *                             (carries `required_level`, `current_level`)
 *   • insufficient_gems    — wallet shortfall (carries `current`)
 * Anything else surfaces as a generic "구매 실패" fallback.
 */
export function usePurchaseCustomization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, itemKey, price }: { category: string; itemKey: string; price: number }) => {
      const { data, error } = await supabase.rpc("purchase_customization" as any, {
        p_category: category,
        p_item_key: itemKey,
        p_price: price,
      });
      if (error) throw error;
      const result = data as {
        success: boolean;
        error?: string;
        required_level?: number;
        current_level?: number;
        current?: number;
        remaining_gems?: number;
        already_owned?: boolean;
        category?: string;
        item_key?: string;
      };
      if (!result?.success) {
        if (result?.error === "hof_required") {
          throw new Error("명예의 전당 입성 후 구매할 수 있습니다");
        }
        if (result?.error === "insufficient_gems") throw new Error("파이트 머니가 부족합니다");
        if (result?.error === "level_locked") {
          throw new Error(
            `Lv.${result.required_level} 달성 시 해금됩니다 🔒 (현재 Lv.${result.current_level ?? 0})`,
          );
        }
        if (result?.error === "not_authenticated") throw new Error("로그인이 필요합니다");
        throw new Error(result?.error || "구매 실패");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owned-customizations"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
