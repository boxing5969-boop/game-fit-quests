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
      // 서버에서 역할검사하는 래퍼 RPC 경유 (grant_gems 직접 호출은 권한 회수됨)
      const { error } = await (supabase.rpc as any)("admin_grant_gems", { _user_id: userId, _amount: amount, _reason: reason });
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
      // 원자적 차감 — DB의 조건부 UPDATE(잔액 >= amount)로 처리해
      // 중복탭/연타에도 잔액 초과 사용이 불가능하다. (-1 = 잔액 부족)
      const { data, error } = await (supabase.rpc as any)("spend_gems", { _amount: amount });
      if (error) throw error;
      if (typeof data === "number" && data < 0) throw new Error("파이트 머니가 부족합니다");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
};
