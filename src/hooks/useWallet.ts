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
    // amount 만 넘기는 기존 호출부 호환 + reason 명시 가능한 객체 형태 모두 허용.
    mutationFn: async (input: number | { amount: number; reason?: string }) => {
      if (!user?.id) throw new Error("로그인 필요");
      const amount = typeof input === "number" ? input : input.amount;
      const reason = typeof input === "number" ? "링젬 차감" : (input.reason ?? "링젬 차감");
      // 서버측 spend_gems RPC 가 atomic 잔액 체크 + wallet_transactions 로그까지 처리.
      // 잔액 부족 시 RAISE EXCEPTION '파이트 머니가 부족합니다' 가 error.message 로 전파.
      const { error } = await supabase.rpc("spend_gems", {
        _user_id: user.id,
        _amount: amount,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["member-wallet"] });
    },
  });
};
