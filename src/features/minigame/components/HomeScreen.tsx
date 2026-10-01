/**
 * ⚡ 반응속도 트레이닝 — 시작 화면 (2026-10-01 다크 아레나 개편, 이모지 → 입체 아이콘).
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Play } from 'lucide-react';
import { getProfile, getSavedPlayerName, getTodaysChallenge, isChallengeCompletedToday, PlayerProfile, DailyChallenge } from '@/features/minigame/lib/storage';
import { TIERS } from '@/features/minigame/types/game';
import { useRankupUser } from '@/features/minigame/lib/rankupAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Icon3D, { TIER_ICON } from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

interface HomeScreenProps {
  onStart: () => void;
  onRanking: () => void;
  onBack?: () => void;
}

const HomeScreen = ({ onStart, onRanking, onBack }: HomeScreenProps) => {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [completed, setCompleted] = useState(false);
  const { user: rankupUser } = useRankupUser();

  useEffect(() => {
    const name = getSavedPlayerName();
    if (name) setProfile(getProfile(name));
    setChallenge(getTodaysChallenge());
    setCompleted(isChallengeCompletedToday());
  }, []);

  const tier = profile ? TIERS.find(t => t.key === profile.highestTier) : null;
  const displayName = rankupUser?.nickname || profile?.name;
  const avatarUrl = rankupUser?.avatarUrl;
  const initial = (displayName || '?').slice(0, 1).toUpperCase();

  return (
    <div className="arena-bg arena-ropes relative flex min-h-screen flex-col items-center overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      {onBack && (
        <button
          type="button"
          onClick={() => { audio.tap(); onBack(); }}
          className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex h-9 items-center gap-1 rounded-full bg-card/80 px-3 text-[12px] font-bold text-foreground ring-1 ring-white/10 backdrop-blur-md active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> 모드 선택
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mt-10 w-full max-w-sm text-center"
      >
        <div className="relative mb-3 flex justify-center">
          <div
            aria-hidden
            className="pointer-events-none absolute top-3 h-24 w-44 rounded-full"
            style={{ background: 'radial-gradient(ellipse, hsl(43 90% 60% / 0.3), transparent 65%)' }}
          />
          <Icon3D name="bolt" size={104} float className="relative" />
        </div>
        <h1 className="font-display text-[46px] leading-none tracking-wide text-foreground">
          REACTION <span className="text-secondary">TRAINER</span>
        </h1>
        <p className="mb-5 mt-1 text-[12.5px] font-semibold text-muted-foreground">복싱 반응속도 트레이너</p>

        {/* 프로필 — 랭킹업 아바타 + 최고 등급 */}
        {(profile && tier) || rankupUser ? (
          <div className="mg-card mb-3 flex items-center gap-3 p-3 text-left">
            {avatarUrl ? (
              <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/40">
                <AvatarImage src={avatarUrl} alt={displayName || 'avatar'} />
                <AvatarFallback className="bg-primary/20 font-display text-lg text-primary">{initial}</AvatarFallback>
              </Avatar>
            ) : tier ? (
              <Icon3D name={TIER_ICON[tier.key]} size={48} />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-display text-lg text-primary">{initial}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[15px] font-black text-foreground">
                {displayName || '게스트'}
                {rankupUser && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-display text-[10px] tracking-widest text-primary">MEMBER</span>
                )}
              </div>
              {tier && (
                <div className={`flex items-center gap-1 text-[12px] font-semibold text-tier-${tier.key}`}>
                  {avatarUrl && <Icon3D name={TIER_ICON[tier.key]} size={16} />}
                  {tier.nameKo} · {tier.nameEn}
                </div>
              )}
            </div>
            {profile && (
              <div className="shrink-0 text-right">
                <div className="mg-num font-display text-xl leading-none text-secondary">
                  {profile.bestAvgReaction < 9999 ? `${profile.bestAvgReaction}ms` : '—'}
                </div>
                <div className="font-display text-[10px] tracking-widest text-muted-foreground">BEST AVG</div>
              </div>
            )}
          </div>
        ) : null}

        {/* 연속 훈련 */}
        {profile && profile.streakDays > 0 && (
          <div className="mg-card mb-3 flex items-center justify-center gap-2 px-3 py-2 text-[13px]">
            <Icon3D name="fire" size={22} />
            <span className="mg-num font-display text-lg text-secondary">{profile.streakDays}</span>
            <span className="font-semibold text-muted-foreground">일 연속 훈련</span>
          </div>
        )}

        {/* 오늘의 도전 */}
        {challenge && (
          <div className={`mg-card mb-3 flex items-center gap-3 p-3 text-left ${completed ? 'ring-1 ring-primary/40' : ''}`}>
            <Icon3D name="calendar" size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-display text-[11px] tracking-[0.25em] text-muted-foreground">TODAY'S CHALLENGE</div>
                {completed && (
                  <div className="flex items-center gap-0.5 font-display text-[11px] tracking-widest text-primary">
                    <Check className="h-3 w-3" strokeWidth={3} /> 완료
                  </div>
                )}
              </div>
              <div className="text-[13.5px] font-bold text-foreground">{challenge.descriptionKo}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">완료 시 +{challenge.bonusPoints}점 보너스</div>
            </div>
          </div>
        )}

        {/* 미트 트레이닝 연결 */}
        <div className="mg-card mb-4 flex items-center gap-3 p-3 text-left">
          <Icon3D name="mitt" size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11px] tracking-[0.25em] text-secondary">TIMING MASTER</div>
            <p className="text-[12.5px] font-semibold text-foreground/90">미트 트레이닝의 타이밍을 게임으로 먼저 익혀요</p>
            <p className="text-[11px] text-muted-foreground">게임 실력 = 미트 실력 · 매일 5분이 체육관을 바꿉니다</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { audio.tap(); onStart(); }}
            className="mg-btn-primary flex h-16 w-full items-center justify-center gap-2 rounded-2xl font-display text-[26px] tracking-widest"
          >
            <Play className="h-6 w-6 fill-current" /> START TRAINING
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { audio.tap(); onRanking(); }}
            className="mg-btn-ghost flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-[18px] tracking-widest"
          >
            <Icon3D name="trophy" size={22} /> RANKING
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
