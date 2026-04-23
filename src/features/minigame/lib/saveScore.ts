import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface MinigameRecordInput {
  game_type: 'speed' | 'mitt' | 'defense';
  player_name: string;
  score: number;
  avg_reaction_ms?: number | null;
  best_reaction_ms?: number | null;
  accuracy?: number | null;
  total_punches?: number | null;
  combo_peak?: number | null;
  tier?: string | null;
  xp_earned?: number;
}

async function resolveDisplayName(userId: string, fallback: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, name, email')
      .eq('user_id', userId)
      .maybeSingle();

    const nick = (data?.nickname || '').trim();
    if (nick) return nick;
    const name = (data?.name || '').trim();
    if (name) return name;
    const emailLocal = (data?.email || '').split('@')[0]?.trim();
    if (emailLocal) return emailLocal;
  } catch (e) {
    console.warn('[resolveDisplayName] profile fetch failed', e);
  }
  return fallback || '회원';
}

/** 결과 화면에 마운트되면 1회만 자동 저장 */
export function useAutoSaveScore(record: MinigameRecordInput | null) {
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current || !record) return;
    saved.current = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const displayName = await resolveDisplayName(userId, record.player_name);
      const finalRecord: MinigameRecordInput = { ...record, player_name: displayName };

      try {
        const { error } = await supabase
          .from('minigame_records')
          .insert({ user_id: userId, ...finalRecord });
        if (error) throw error;

        // 과거 동일 게임 기록 player_name 을 새 닉네임으로 백필 (있을 때만)
        void supabase
          .from('minigame_records')
          .update({ player_name: displayName })
          .eq('user_id', userId)
          .eq('game_type', finalRecord.game_type)
          .neq('player_name', displayName);

        toast.success(`🏆 ${displayName} 님 기록 저장 완료!`, { duration: 2500 });
      } catch (err: any) {
        console.error('[saveMinigameRecord]', err);
        if (err?.code === 'PGRST205') {
          toast.error('랭킹업 서버에 minigame_records 테이블이 반영되지 않았습니다.');
          return;
        }
        toast.error('기록 저장 실패: ' + (err?.message || 'unknown'));
      }
    })();
  }, [record]);
}
