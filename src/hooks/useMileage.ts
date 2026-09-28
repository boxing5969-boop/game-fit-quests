/**
 * 앱 마일리지 hooks — 내 마일리지(홈 카드) + 적립 규칙(관리자 설정).
 * 캐시 키는 "153mileage" 로 시작한다 — 다른 도메인 키와 겹치지 않게.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMileageRules,
  getMyMileage,
  setMileageRules,
  type MileageRules,
  type MyMileage,
} from "@/services/mileageService";

export const MILEAGE_KEY = ["153mileage"] as const;

export function useMyMileage(enabled = true) {
  const { user } = useAuth();
  return useQuery<MyMileage>({
    queryKey: [...MILEAGE_KEY, "me", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getMyMileage(20),
  });
}

export function useMileageRules(enabled = true) {
  return useQuery<MileageRules>({
    queryKey: [...MILEAGE_KEY, "rules"],
    enabled,
    staleTime: 60_000,
    queryFn: getMileageRules,
  });
}

/** 관리자 — 규칙 저장. 규칙·내 마일리지를 다시 읽는다. */
export function useSetMileageRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setMileageRules,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MILEAGE_KEY });
    },
  });
}
