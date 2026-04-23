// iframe 시절엔 별도 Supabase 클라이언트 + URL uid fallback 이 필요했지만
// 같은 오리진으로 편입되며 부모 앱의 AuthContext 세션을 그대로 쓴다.
// 공개 API 는 useRankupUser 하나로 축소 — 게스트 연동/로그인 패널 경로는 전부 제거.
import { useAuth } from '@/contexts/AuthContext';

export interface RankupUser {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  source: 'login';
}

export function useRankupUser(): { user: RankupUser | null; loading: boolean } {
  const { user, profile, loading } = useAuth();
  if (loading) return { user: null, loading: true };
  if (!user) return { user: null, loading: false };
  const nickname =
    profile?.nickname?.trim() ||
    profile?.name?.trim() ||
    user.email?.split('@')[0] ||
    '회원';
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      nickname,
      avatarUrl: profile?.avatar_url ?? null,
      source: 'login',
    },
    loading: false,
  };
}
