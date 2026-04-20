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

export const useSpendGems = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (amount: number) => {
      if (!user?.id) throw new Error("로그인 필요");
      const { data: wallet, error: fetchError } = await supabase
        .from("user_wallets")
        .select("gems_balance")
        .eq("user_id", user.id)
        .single();
      if (fetchError) throw fetchError;
      if (!wallet) throw new Error("지갑 없음");
      if (wallet.gems_balance < amount) throw new Error("젬이 부족합니다 💎");
      const { error } = await supabase
        .from("user_wallets")
        .update({ gems_balance: wallet.gems_balance - amount })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
};
