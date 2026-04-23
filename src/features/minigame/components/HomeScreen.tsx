import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getProfile, getSavedPlayerName, getTodaysChallenge, isChallengeCompletedToday, PlayerProfile, DailyChallenge } from '@/features/minigame/lib/storage';
import { TIERS } from '@/features/minigame/types/game';
import { useRankupUser } from '@/features/minigame/lib/rankupAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pt-16 pb-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center relative z-10 w-full max-w-sm"
      >
        <div className="text-6xl mb-3">🥊</div>
        <h1 className="font-display text-5xl sm:text-7xl tracking-wider text-foreground mb-1">
          BOXING
        </h1>
        <h2 className="font-display text-2xl sm:text-4xl tracking-widest text-primary mb-1">
          REACTION TRAINER
        </h2>
        <p className="text-muted-foreground text-sm mb-6">복싱 반응속도 트레이너</p>

        {/* Profile preview — 랭킹업 캐릭터(아바타) 우선 표시 */}
        {(profile && tier) || rankupUser ? (
          <div className="bg-card border border-border rounded-xl p-3 mb-4 flex items-center gap-3">
            {avatarUrl ? (
              <Avatar className="w-12 h-12 ring-2 ring-secondary/50 shrink-0">
                <AvatarImage src={avatarUrl} alt={displayName || 'avatar'} />
                <AvatarFallback className="bg-primary/20 text-primary font-display text-lg">
                  {initial}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="text-3xl shrink-0">{tier?.emoji || '👤'}</div>
            )}
            <div className="flex-1 text-left min-w-0">
              <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                {displayName || '게스트'}
                {rankupUser && (
                  <span className="text-[8px] font-display tracking-widest text-secondary bg-secondary/15 px-1.5 py-0.5 rounded">
                    랭킹업
                  </span>
                )}
              </div>
              {tier && (
                <div className={`text-xs text-tier-${tier.key}`}>{tier.nameKo} · {tier.nameEn}</div>
              )}
            </div>
            {profile && (
              <div className="text-right shrink-0">
                <div className="font-display text-lg text-secondary leading-none">
                  {profile.bestAvgReaction < 9999 ? `${profile.bestAvgReaction}ms` : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">PB AVG</div>
              </div>
            )}
          </div>
        ) : null}

        {/* Streak */}
        {profile && profile.streakDays > 0 && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-2 mb-4 text-center text-sm">
            🔥 <span className="font-display text-secondary text-lg">{profile.streakDays}</span>
            <span className="text-muted-foreground"> 일 연속 훈련</span>
          </div>
        )}

        {/* Daily challenge */}
        {challenge && (
          <div className={`rounded-xl p-3 mb-4 text-left border ${
            completed ? 'bg-secondary/10 border-secondary/30' : 'bg-card border-border'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                📅 오늘의 도전
              </div>
              {completed && (
                <div className="text-[10px] font-display text-secondary">✓ 완료</div>
              )}
            </div>
            <div className="text-sm text-foreground">{challenge.descriptionKo}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              완료 시 +{challenge.bonusPoints}점 보너스
            </div>
          </div>
        )}

        {/* Mitt Training Banner */}
        <div className="bg-card border border-primary/20 rounded-xl p-3 mb-4 text-center w-full">
          <div className="text-xs font-display tracking-widest text-secondary mb-1">
            ⚡ 타이밍 마스터 챌린지
          </div>
          <p className="text-xs text-foreground/80">
            미트 트레이닝의 타이밍을 게임으로 먼저 익히세요.
          </p>
          <p className="text-xs text-muted-foreground">
            게임 실력 = 미트 실력 · 매일 5분이 체육관을 바꿉니다 🥊
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="punch-btn bg-primary text-primary-foreground py-4 text-lg font-display tracking-widest"
          >
            🥊 START TRAINING
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRanking}
            className="punch-btn bg-muted text-foreground py-3 font-display tracking-widest"
          >
            🏆 RANKING
          </motion.button>
          {onBack && (
            <button onClick={onBack} className="w-full text-muted-foreground text-sm py-2 mt-2">
              ← 모드 선택으로
            </button>
          )}
        </div>
      </motion.div>

      <div className="absolute bottom-4 flex gap-6 text-2xl opacity-20">
        <span>👊</span><span>🤜</span><span>🥊</span><span>⬆️</span>
      </div>
    </div>
  );
};

export default HomeScreen;
