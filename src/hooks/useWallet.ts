import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useWallet = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) {
        // Wallet might not exist for old users, return default
        if (error.code === "PGRST116") {
          return { gems_balance: 0, total_earned: 0, total_spent: 0 };
        }
        throw error;
      }
      return data;
    },
  });
};

export const usePurchaseItem = () => {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("purchase_avatar_item", { _item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["owned-items"] });
    },
  });
};

export const useGrantGems = () => {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const { error } = await supabase.rpc("grant_gems", { _user_id: userId, _amount: amount, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["member-wallet"] });
    },
  });
};

export const useMemberWallet = (userId?: string) => {
  return useQuery({
    queryKey: ["member-wallet", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", userId!)
        .single();
      if (error) {
        if (error.code === "PGRST116") return { gems_balance: 0, total_earned: 0, total_spent: 0 };
        throw error;
      }
      return data;
    },
  });
};
