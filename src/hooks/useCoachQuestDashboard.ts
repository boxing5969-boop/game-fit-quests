/**
 * 153 QUEST v2 22단계 — 코치 대시보드 hook.
 *
 * 보호 원칙 (§3 + §11):
 *   · 클라이언트 권한 체크는 가드만 — RPC 내부에서도 권한 검증 (§11-⑮)
 *   · 표시 전용 — 어떤 mutation 도 wallet/공식 XP 수정 0
 *   · 민감정보 화이트리스트 — RPC 가 phone/email/birth_date 미반환
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCoachQuestDashboard,
  EMPTY_COACH_QUEST_DASHBOARD,
  type CoachQuestDashboard,
} from "@/services/boxingEngagementService";

export const COACH_QUEST_DASHBOARD_KEY = ["coach-quest-dashboard"] as const;

/**
 * 코치/관장만 호출 가능. 일반 회원이 호출하면 RPC 가 'insufficient permissions' 던짐.
 *
 * @param branchName super_admin 만 다른 branch 지정 가능. branch_manager 는 인자 무시.
 */
export function useCoachQuestDashboard(
  branchName?: string | null,
  enabled = true,
) {
  const { user, role } = useAuth();
  const allowed =
    role === "super_admin" ||
    role === "branch_manager" ||
    role === "coach" ||
    role === "admin"; // legacy admin 도 화면에서는 표시 시도 (RPC 가 거부)

  return useQuery<CoachQuestDashboard>({
    queryKey: [
      ...COACH_QUEST_DASHBOARD_KEY,
      branchName ?? "default",
      user?.id ?? "anon",
    ],
    enabled: enabled && !!user?.id && allowed,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getCoachQuestDashboard(branchName);
      } catch {
        return EMPTY_COACH_QUEST_DASHBOARD;
      }
    },
  });
}
