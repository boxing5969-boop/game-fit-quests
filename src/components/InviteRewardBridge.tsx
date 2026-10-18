/**
 * 초대 보상 확인 (2026-10-18 대표님: "초대하면 챔피언머니 1000원 보상하자").
 *
 * 앱을 열 때 한 번(세션마다) claim_invite_reward 를 부른다. 내가 초대받아 처음 들어온 회원이면
 * 서버가 '처음 초대한 1명'에게 챔피언 머니 1,000과 알림을 준다. 초대받은 나에게는 환영 한 줄.
 * 카카오로 들어와 기존 계정과 합친 직후에도 한 번 더 부른다 (LinkAccountPrompt → runInviteClaim).
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { claimInviteReward } from "@/services/boxingEngagementService";

export const runInviteClaim = async (): Promise<void> => {
  try {
    const r = await claimInviteReward();
    if (r.inviter) toast.success(`${r.inviter}님이 초대해 주셨어요. 마이복서153에 오신 걸 환영해요!`);
  } catch {
    /* 다음에 다시 */
  }
};

const InviteRewardBridge = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    const key = `invite-claim:${user.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장소를 못 쓰면 그냥 한 번 부른다 */
    }
    void runInviteClaim();
  }, [user?.id]);
  return null;
};

export default InviteRewardBridge;
