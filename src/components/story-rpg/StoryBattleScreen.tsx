/**
 * 153 스토리 RPG — 전투 화면 (단계 41).
 *
 * 풀스크린 모달 (z-[80]). 적 HP 는 챕터 진행률 기반.
 * 4개 액션 버튼은 각각 기존 페이지로 navigate 만 한다 (기존 기능 재활용).
 *
 * 보호 원칙:
 *   · 새 RPC / migration X.
 *   · 공식 시스템 / wallet 직접 update X.
 *   · 적 HP, 플레이어 HP 모두 클라이언트 시각화.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Brain, Heart, Trophy, X } from "lucide-react";
import OsamMascot from "@/components/mascot/OsamMascot";
import StoryHpBar from "./StoryHpBar";
import StoryObstacleCreature, {
  type CreatureState,
} from "./StoryObstacleCreature";
import { STORY_OBSTACLE_LABEL } from "@/data/storyRpgCopy";
import type {
  StoryChapter,
  StoryChapterProgressDetail,
} from "@/types/storyRpg";

export interface StoryBattleScreenProps {
  chapter: StoryChapter;
  progressDetail: StoryChapterProgressDetail | null;
  userPhoto?: React.ReactNode;
  onClose: () => void;
  onClaimReward: () => void;
}

const ENEMY_HP_MAX = 100;
const PLAYER_HP_MAX = 100;

const StoryBattleScreen = ({
  chapter,
  progressDetail,
  userPhoto,
  onClose,
  onClaimReward,
}: StoryBattleScreenProps) => {
  const navigate = useNavigate();

  // 적 HP 매핑: have_total / required_total → HP 감소 비율
  const enemyHp = useMemo(() => {
    const need = progressDetail?.required_total ?? 0;
    const have = progressDetail?.have_total ?? 0;
    if (need <= 0) return ENEMY_HP_MAX; // 조건 없으면 그대로
    const ratio = Math.max(0, Math.min(1, have / need));
    return Math.round(ENEMY_HP_MAX * (1 - ratio));
  }, [progressDetail]);

  const isDefeated = progressDetail?.complete === true || enemyHp <= 0;

  const [creatureState, setCreatureState] = useState<CreatureState>(
    isDefeated ? "defeated" : "idle",
  );
  const [hitFx, setHitFx] = useState(false);

  // 챕터/진행도가 바뀌면 상태 동기화
  useEffect(() => {
    setCreatureState(isDefeated ? "defeated" : "idle");
  }, [isDefeated, chapter.id]);

  // 액션 클릭 → 펀치 효과 + 외부 라우트 이동
  const handleAction = (href: string) => {
    setHitFx(true);
    setCreatureState("hurt");
    setTimeout(() => {
      setCreatureState(isDefeated ? "defeated" : "idle");
      setHitFx(false);
      navigate(href);
    }, 420);
  };

  const conditionDetail = progressDetail?.progress ?? {};
  const have = (key: string) => conditionDetail[key]?.have ?? 0;
  const need = (key: string) => conditionDetail[key]?.need ?? 0;

  const obstacleCode = chapter.obstacle_code ?? "lazy_slime";
  const obstacleLabel = STORY_OBSTACLE_LABEL[obstacleCode] ?? obstacleCode;

  const actions = [
    {
      key: "attack",
      label: "공격",
      sub: `챌린지 ${have("challenge_clear_total")}/${need("challenge_clear_total") || "∞"}`,
      icon: Trophy,
      href: "/home#engagement",
      tone: "border-rose-500/40 bg-rose-500/10 text-rose-100",
    },
    {
      key: "defense",
      label: "방어",
      sub: `일기 ${have("journal_total")}/${need("journal_total") || "∞"}`,
      icon: BookOpen,
      href: "/home#engagement",
      tone: "border-sky-500/40 bg-sky-500/10 text-sky-100",
    },
    {
      key: "tool",
      label: "도구",
      sub: `퀴즈 ${have("quiz_correct_total")}/${need("quiz_correct_total") || "∞"}`,
      icon: Brain,
      href: "/home#engagement",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    },
    {
      key: "cheer",
      label: "응원",
      sub: `세컨드 ${have("cheer_sent_total")}/${need("cheer_sent_total") || "∞"}`,
      icon: Heart,
      href: "/home#engagement",
      tone: "border-violet-500/40 bg-violet-500/10 text-violet-100",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 상단 — 라운드 제목 + 닫기 */}
        <header className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
              ⚔ ROUND {chapter.chapter_number}
            </p>
            <h2 className="mt-0.5 text-base font-black text-foreground">
              {chapter.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gray-900/60 text-gray-300 active:scale-95 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* 가운데 — 링 + 양쪽 캐릭터 */}
        <div className="relative flex flex-1 items-end justify-center overflow-hidden px-4">
          {/* 링 SVG 배경 */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <defs>
              <radialGradient id="ring-light" cx="50%" cy="35%" r="50%">
                <stop offset="0%" stopColor="rgba(251,191,36,0.18)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
            <rect width="100" height="100" fill="url(#ring-light)" />
            {/* 링 바닥 라인 */}
            <line x1="6" y1="78" x2="94" y2="78" stroke="rgba(251,191,36,0.3)" strokeWidth="0.4" />
            <line x1="6" y1="80" x2="94" y2="80" stroke="rgba(251,191,36,0.5)" strokeWidth="0.4" />
            <line x1="6" y1="82" x2="94" y2="82" stroke="rgba(251,191,36,0.3)" strokeWidth="0.4" />
            {/* 코너 포스트 4개 */}
            {[
              [8, 78],
              [92, 78],
              [8, 92],
              [92, 92],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x - 0.6}
                y={y - 4}
                width="1.2"
                height="8"
                fill="rgba(251,191,36,0.6)"
              />
            ))}
          </svg>

          {/* 플레이어 (좌) */}
          <div className="relative z-10 flex flex-col items-center gap-2 pb-6">
            <div className="flex h-[140px] w-[140px] items-center justify-center">
              {userPhoto ?? <OsamMascot size="lg" state="idle" />}
            </div>
            <div className="w-[150px]">
              <StoryHpBar
                currentHp={PLAYER_HP_MAX}
                maxHp={PLAYER_HP_MAX}
                variant="player"
                size="md"
                label="나"
              />
            </div>
          </div>

          {/* 펀치 효과 */}
          <AnimatePresence>
            {hitFx && (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/3 z-20 -translate-x-1/2 transform text-5xl"
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1.4, rotate: 10, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                💥
              </motion.div>
            )}
          </AnimatePresence>

          {/* 적 (우) */}
          <div className="relative z-10 flex flex-col items-center gap-2 pb-6">
            <div className="flex h-[140px] w-[140px] items-center justify-center">
              <StoryObstacleCreature
                code={obstacleCode}
                state={creatureState}
                size="md"
              />
            </div>
            <div className="w-[150px]">
              <StoryHpBar
                currentHp={enemyHp}
                maxHp={ENEMY_HP_MAX}
                variant="enemy"
                size="md"
                label={obstacleLabel}
              />
            </div>
          </div>
        </div>

        {/* 하단 — 4개 액션 또는 보상 받기 */}
        <div className="border-t border-white/10 bg-gray-950/80 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {isDefeated ? (
            <button
              type="button"
              onClick={onClaimReward}
              className="w-full rounded-2xl border border-amber-400/60 bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-3.5 text-sm font-black uppercase tracking-wider text-amber-950 shadow-lg shadow-amber-500/30 active:scale-[0.98]"
            >
              ✨ 보상 받기 — +{chapter.reward_quest_xp} XP / +{chapter.reward_gems} 파이트 머니
            </button>
          ) : (
            <>
              <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                액션 선택 — 어떻게 싸울까
              </p>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => handleAction(a.href)}
                      className={`flex flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${a.tone}`}
                    >
                      <span className="flex items-center gap-1.5 text-[12px] font-black">
                        <Icon className="h-3.5 w-3.5" />
                        {a.label}
                      </span>
                      <span className="text-[10px] tabular-nums opacity-80">
                        {a.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                액션을 누르면 해당 활동 페이지로 이동합니다. 활동 후 돌아오면 자동으로 진행도가 갱신됩니다.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StoryBattleScreen;
