/**
 * 📸 프로필 사진 첫 등록 보상 — 상태 읽기 · 받기 (2026-10-14 대표님: "사진을 올리면 파이트머니 많이 보상하자").
 *
 * 서버 함수가 정본 — get_my_avatar_reward() · claim_avatar_photo_reward() (한 사람 한 번, 진짜 사진만, 지갑은 grant_gems).
 *   · 사진을 올리면 useAvatarUpload 가 바로 받는다 (홈 카드·내정보 둘 다)
 *   · 이 기능 전에 사진을 올려 둔 회원은 홈을 열 때 한 번 받는다 (useAvatarRewardAutoClaim)
 *   · 받았거나 대상이 아니면 이 기기에 적어 두고 다시 묻지 않는다
 * 지도진·관리 계정은 묻지 않는다 (서버도 0 을 준다). 쿼리키는 다른 화면 캐시와 겹치지 않게 153photo: 로 시작한다.
 */
import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import {
  parseAvatarRewardClaim,
  parseAvatarRewardState,
  rewardDoneKey,
  rewardSettled,
  rewardText,
  shouldAutoClaim,
  type AvatarRewardClaim,
} from "@/lib/avatarReward";

export const AVATAR_REWARD_KEY = "153photo:reward";

// 새 함수들은 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string) => (supabase.rpc as any)(name, {});

const readDone = (uid: string): boolean => {
  try {
    return window.localStorage.getItem(rewardDoneKey(uid)) === "1";
  } catch {
    return false;
  }
};
export const markAvatarRewardDone = (uid: string) => {
  try {
    window.localStorage.setItem(rewardDoneKey(uid), "1");
  } catch {
    /* 저장이 막혀도 다음에 한 번 더 물을 뿐 */
  }
};

/** 내 보상 상태 — 회원만, 이 기기에서 끝난 걸 알면 묻지 않는다 */
export function useAvatarRewardState() {
  const { user, role, profile } = useAuth();
  const uid = user?.id ?? null;
  const member = !!uid && !isManagerRole(role) && !isStaffProfile(profile);
  const done = uid ? readDone(uid) : true;
  const q = useQuery({
    queryKey: [AVATAR_REWARD_KEY, uid],
    enabled: member && !done,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_avatar_reward");
      if (error) throw error;
      return parseAvatarRewardState(data);
    },
  });
  useEffect(() => {
    if (uid && rewardSettled(q.data)) markAvatarRewardDone(uid);
  }, [uid, q.data]);
  return q;
}

/** 받기 — 실패해도 사진 올리기는 그대로 성공이다 (null) */
export async function claimAvatarReward(): Promise<AvatarRewardClaim | null> {
  try {
    const { data, error } = await rpc("claim_avatar_photo_reward");
    if (error) return null;
    return parseAvatarRewardClaim(data);
  } catch {
    return null;
  }
}

/** 받은 뒤 다시 읽을 것 — 보상 상태 · 지갑 */
export function useInvalidateAvatarReward() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: [AVATAR_REWARD_KEY] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
  }, [qc]);
}

/** 이 기능 전에 사진을 올려 둔 회원 — 홈을 열면 한 번 받는다 */
export function useAvatarRewardAutoClaim() {
  const { user, profile } = useAuth();
  const { data: state } = useAvatarRewardState();
  const invalidate = useInvalidateAvatarReward();
  const tried = useRef(false);
  const hasAvatar = !!profile?.avatar_url;
  const uid = user?.id ?? null;

  useEffect(() => {
    if (tried.current || !uid || !shouldAutoClaim(state, hasAvatar)) return;
    tried.current = true;
    void (async () => {
      const r = await claimAvatarReward();
      if (r?.granted) {
        toast.success(`📸 프로필 사진 보상 · ${rewardText(r.amount)}`, {
          description: "캐릭터 꾸미기에서 쓸 수 있어요",
        });
      }
      if (r && r.reason !== "no_photo") markAvatarRewardDone(uid);
      invalidate();
    })();
  }, [state, hasAvatar, uid, invalidate]);
}
