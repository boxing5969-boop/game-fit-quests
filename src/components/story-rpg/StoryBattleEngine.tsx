/**
 * 153 스토리 RPG — 턴제 전투 엔진 (Stage 47B 비주얼 오버홀).
 *
 * BattleArena (배경 + 적 + 플레이어) + AttackAnimation + DamagePopup + HitEffect +
 * VictoryFanfare / DefeatScreen 합성.
 *
 * 게임 로직: submit_player_command RPC (Stage 47B 패치) 가 서버에서 데미지 계산.
 * 클라이언트는 명령 전송 + 응답에 따라 비주얼 트리거만.
 *
 * 보호 원칙:
 *   · wallet 직접 update 0건 — 보상은 RPC 안 grant_gems / inventory upsert.
 *   · ChatAssistant 호출 0건.
 *   · localStorage / sessionStorage 0건.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Loader2,
  Package,
  Shield,
  Swords,
  Wind,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStartBattle,
  useSubmitBattleCommand,
  useMyPlayerStats,
} from "@/hooks/useStoryRpg";
import StoryHpBar from "./StoryHpBar";
import StoryInventoryPanel from "./StoryInventoryPanel";
import BattleArena, {
  ARENA_LAYOUT,
  type DamagePopupItem,
  type HitEffectItem,
} from "./visuals/battle/BattleArena";
import AttackAnimation, {
  type AttackCommand,
} from "./visuals/battle/AttackAnimation";
import CardUseEffect from "./visuals/battle/CardUseEffect";
import VictoryFanfare from "./visuals/battle/VictoryFanfare";
import DefeatScreen from "./visuals/battle/DefeatScreen";
import { resolveEnemyVariant } from "./visuals/battle/enemyVariants";
import type { PlayerPose, PlayerRouteColor } from "./visuals/battle/PlayerBoxer";
import type { EnemyPose } from "./visuals/battle/EnemySvg";
import type {
  BattleCommand,
  StoryEnemy,
} from "@/types/storyRpg";

export interface StoryBattleEngineProps {
  enemyCode: string;
  chapterId: string | null;
  routeCode?: string | null;
  onVictory: (rewards: {
    story_xp: number;
    ring_coins: number;
    card_code: string | null;
  }) => void;
  onDefeat: () => void;
  onClose?: () => void;
}

interface BattleResultLike {
  success?: boolean;
  status?: "ongoing" | "victory" | "defeat";
  player_hp?: number;
  enemy_hp?: number;
  focus_remaining?: number;
  player_focus?: number;
  player_dmg?: number;
  enemy_dmg?: number;
  reward_story_xp?: number;
  reward_ring_coins?: number;
  reward_card_code?: string | null;
  reason?: string;
}

const POSE_RESET_MS = 600;
const POPUP_LIFE_MS = 700;
const HIT_EFFECT_LIFE_MS = 400;

function resolveRouteColor(code?: string | null): PlayerRouteColor {
  if (code === "pro_path") return "pro";
  if (code === "champion_road") return "champion";
  return "master";
}

const StoryBattleEngine = ({
  enemyCode,
  chapterId,
  routeCode,
  onVictory,
  onDefeat,
  onClose,
}: StoryBattleEngineProps) => {
  const startBattle = useStartBattle();
  const submitCommand = useSubmitBattleCommand();
  const { data: playerStats } = useMyPlayerStats();

  const [enemy, setEnemy] = useState<StoryEnemy | null>(null);
  const [enemyHp, setEnemyHp] = useState<number | null>(null);
  const [enemyMaxHp, setEnemyMaxHp] = useState<number | null>(null);
  const [playerPose, setPlayerPose] = useState<PlayerPose>("idle");
  const [enemyPose, setEnemyPose] = useState<EnemyPose>("idle");
  const [shakeKey, setShakeKey] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState<"soft" | "medium" | "hard">("medium");
  const [flashKey, setFlashKey] = useState(0);
  const [flashColor, setFlashColor] = useState<"white" | "red" | "amber">("white");
  const [damagePopups, setDamagePopups] = useState<DamagePopupItem[]>([]);
  const [hitEffects, setHitEffects] = useState<HitEffectItem[]>([]);
  const [activeAttack, setActiveAttack] = useState<AttackCommand | null>(null);
  const [osamLine, setOsamLine] = useState<string | undefined>(undefined);
  const [showInventory, setShowInventory] = useState(false);
  const [osamUsed, setOsamUsed] = useState(false);
  const [pendingCard, setPendingCard] = useState<{ code: string; name: string } | null>(null);
  const [outcome, setOutcome] = useState<"none" | "victory" | "defeat">("none");
  const [pendingRewards, setPendingRewards] = useState<{
    story_xp: number;
    ring_coins: number;
    card_code: string | null;
  } | null>(null);
  const popupSeq = useRef(0);
  const startedRef = useRef(false);
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeColor = resolveRouteColor(routeCode);
  const enemyVariant = useMemo(() => resolveEnemyVariant(enemyCode), [enemyCode]);

  // ── 마운트 시 startBattle ─────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startBattle.mutate(
      { enemyCode, chapterId },
      {
        onSuccess: (res) => {
          setEnemy(res.enemy);
          setEnemyHp(res.battle_state.enemy_hp);
          setEnemyMaxHp(res.battle_state.enemy_max_hp);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "전투 시작 실패");
          onClose?.();
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyCode, chapterId]);

  useEffect(() => {
    return () => {
      if (poseTimerRef.current) clearTimeout(poseTimerRef.current);
    };
  }, []);

  const pushPopup = (
    item: Omit<DamagePopupItem, "id">,
  ) => {
    popupSeq.current += 1;
    const id = popupSeq.current;
    setDamagePopups((arr) => [...arr, { id, ...item }]);
    setTimeout(() => {
      setDamagePopups((arr) => arr.filter((p) => p.id !== id));
    }, POPUP_LIFE_MS);
  };

  const pushHit = (item: Omit<HitEffectItem, "id">) => {
    popupSeq.current += 1;
    const id = popupSeq.current;
    setHitEffects((arr) => [...arr, { id, ...item }]);
    setTimeout(() => {
      setHitEffects((arr) => arr.filter((h) => h.id !== id));
    }, HIT_EFFECT_LIFE_MS);
  };

  const triggerPlayerPose = (pose: PlayerPose, durationMs = POSE_RESET_MS) => {
    setPlayerPose(pose);
    if (poseTimerRef.current) clearTimeout(poseTimerRef.current);
    poseTimerRef.current = setTimeout(() => setPlayerPose("idle"), durationMs);
  };

  const triggerEnemyPose = (pose: EnemyPose, durationMs = POSE_RESET_MS) => {
    setEnemyPose(pose);
    setTimeout(() => {
      setEnemyPose((cur) => (cur === pose ? "idle" : cur));
    }, durationMs);
  };

  // ── 명령 실행 ──────────────────────────────────────────────────
  const handleCommand = (command: BattleCommand) => {
    if (!enemy || enemyHp === null || enemyMaxHp === null) return;
    if (submitCommand.isPending || activeAttack !== null) return;
    if (outcome !== "none") return;

    // 시각효과: 공격 모션 트리거
    if (command !== "use_card") {
      const animCommand =
        command === "jab" || command === "guard" || command === "footwork" ||
        command === "counter" || command === "osam_advice"
          ? command
          : null;
      if (animCommand) setActiveAttack(animCommand);
      if (animCommand === "jab" || animCommand === "counter") {
        triggerPlayerPose(animCommand);
      } else if (animCommand === "guard") {
        triggerPlayerPose("guard", 700);
      } else if (animCommand === "footwork") {
        triggerPlayerPose("footwork", 600);
      }
    }

    submitCommand.mutate(
      {
        command,
        targetData: { enemy_hp_delta: 0, player_hp_delta: 0 },
      },
      {
        onSuccess: (res) => {
          const result = res as BattleResultLike;
          setEnemyHp(result.enemy_hp ?? enemyHp);

          if (command === "osam_advice") {
            setOsamUsed(true);
            const adviceLine = enemy.weakness && Object.keys(enemy.weakness).length > 0
              ? `약점: ${Object.keys(enemy.weakness).join(", ")}`
              : "깊게 숨을 쉬어요.";
            setOsamLine(adviceLine);
          }

          // 적 피해 → popup + hit + enemy hurt pose
          const playerDmg = result.player_dmg ?? 0;
          if (playerDmg > 0) {
            const isWeak = !!enemy.weakness?.[command];
            const isCrit = command === "counter";
            const variant = isCrit ? "crit" : isWeak ? "weakness" : "normal";
            const kind = isCrit ? "crit" : isWeak ? "weakness" : "normal";
            // 잠시 후 데미지 (공격 모션 도달 시점에 맞춤)
            const delay = command === "counter" ? 400 : command === "jab" ? 200 : 250;
            setTimeout(() => {
              pushPopup({
                x: ARENA_LAYOUT.enemy.x,
                y: ARENA_LAYOUT.enemy.y - 20,
                value: playerDmg,
                variant,
              });
              pushHit({
                x: ARENA_LAYOUT.enemy.x,
                y: ARENA_LAYOUT.enemy.y,
                kind,
              });
              triggerEnemyPose("hurt");
              setShakeIntensity(isCrit ? "hard" : isWeak ? "medium" : "soft");
              setShakeKey((k) => k + 1);
              setFlashColor(isCrit ? "red" : isWeak ? "amber" : "white");
              setFlashKey((k) => k + 1);
            }, delay);
          }

          // 플레이어 피해 → popup + camera shake + hurt pose
          const enemyDmg = result.enemy_dmg ?? 0;
          if (enemyDmg > 0) {
            setTimeout(() => {
              pushPopup({
                x: ARENA_LAYOUT.player.x,
                y: ARENA_LAYOUT.player.y - 80,
                value: enemyDmg,
                variant: "normal",
              });
              triggerPlayerPose("hurt", 500);
              setShakeIntensity("medium");
              setShakeKey((k) => k + 1);
            }, 700);
          }

          // 승/패 처리
          if (result.status === "victory") {
            setOutcome("victory");
            setPendingRewards({
              story_xp: result.reward_story_xp ?? 0,
              ring_coins: result.reward_ring_coins ?? 0,
              card_code: result.reward_card_code ?? null,
            });
            setTimeout(() => triggerEnemyPose("defeated", 1000), 600);
          } else if (result.status === "defeat") {
            setTimeout(() => setOutcome("defeat"), 900);
          }

          // RPC level 거부 (focus 부족 등) — reason 표시
          if (result.success === false || (typeof result.success === "undefined" && result.reason)) {
            toast.error(result.reason ?? "명령 실패");
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "명령 실패");
        },
      },
    );
  };

  const handleUseCard = (cardCode: string, cardName?: string) => {
    setShowInventory(false);
    // 카드 cosmetic 연출 → 끝나면 use_card RPC
    setPendingCard({ code: cardCode, name: cardName ?? cardCode });
  };

  const handleCardEffectComplete = () => {
    const card = pendingCard;
    setPendingCard(null);
    if (!card) return;
    submitCommand.mutate(
      {
        command: "use_card",
        targetData: { card_code: card.code, enemy_hp_delta: 0, player_hp_delta: 0 },
      },
      {
        onSuccess: (res) => {
          const r = res as BattleResultLike;
          setEnemyHp(r.enemy_hp ?? enemyHp);
          const dmg = r.player_dmg ?? 0;
          if (dmg > 0) {
            pushPopup({
              x: ARENA_LAYOUT.enemy.x,
              y: ARENA_LAYOUT.enemy.y - 20,
              value: dmg,
              variant: "weakness",
            });
            pushHit({
              x: ARENA_LAYOUT.enemy.x,
              y: ARENA_LAYOUT.enemy.y,
              kind: "weakness",
            });
            triggerEnemyPose("hurt");
            setShakeIntensity("hard");
            setShakeKey((k) => k + 1);
            setFlashColor("amber");
            setFlashKey((k) => k + 1);
          }
          if (r.status === "victory") {
            setOutcome("victory");
            setPendingRewards({
              story_xp: r.reward_story_xp ?? 0,
              ring_coins: r.reward_ring_coins ?? 0,
              card_code: r.reward_card_code ?? null,
            });
          } else if (r.status === "defeat") {
            setOutcome("defeat");
          }
        },
      },
    );
  };

  const focusValue = playerStats?.focus ?? 0;
  const focusInsufficient = useMemo(
    () => ({
      counter: focusValue < 2,
      jab: focusValue < 1,
      footwork: focusValue < 1,
    }),
    [focusValue],
  );

  if (!enemy || enemyHp === null || enemyMaxHp === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
        <p className="text-[12px] text-muted-foreground">전투 준비 중…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Battle Arena (배경 + 적 + 플레이어 + 효과) */}
      <div className="relative">
        <BattleArena
          enemyVariant={enemyVariant}
          enemyName={enemy.name}
          isBoss={enemy.is_boss}
          enemyPose={enemyPose}
          playerPose={playerPose}
          routeColor={routeColor}
          backgroundTheme="gym_ring"
          mood="tense"
          shakeKey={shakeKey}
          shakeIntensity={shakeIntensity}
          flashKey={flashKey}
          flashColor={flashColor}
          damagePopups={damagePopups}
          hitEffects={hitEffects}
          overlayChildren={
            <>
              <AttackAnimation
                command={activeAttack}
                playerXY={{
                  x: ARENA_LAYOUT.player.x + 10,
                  y: ARENA_LAYOUT.player.y - 80,
                }}
                enemyXY={ARENA_LAYOUT.enemy}
                osamLine={osamLine}
                onComplete={() => setActiveAttack(null)}
              />
              {pendingCard && (
                <CardUseEffect
                  card={pendingCard}
                  onComplete={handleCardEffectComplete}
                />
              )}
              {outcome === "victory" && pendingRewards && (
                <VictoryFanfare
                  rewards={pendingRewards}
                  routeColor={routeColor}
                  onComplete={() => onVictory(pendingRewards)}
                />
              )}
              {outcome === "defeat" && (
                <DefeatScreen
                  routeColor={routeColor}
                  onRetry={() => {
                    setOutcome("none");
                    startedRef.current = false;
                    setEnemy(null);
                    setEnemyHp(null);
                    setEnemyMaxHp(null);
                    setOsamUsed(false);
                    // useEffect 가 재마운트 시 startBattle 다시 호출
                    startBattle.mutate(
                      { enemyCode, chapterId },
                      {
                        onSuccess: (res) => {
                          setEnemy(res.enemy);
                          setEnemyHp(res.battle_state.enemy_hp);
                          setEnemyMaxHp(res.battle_state.enemy_max_hp);
                          startedRef.current = true;
                        },
                      },
                    );
                  }}
                  onWorldMap={onDefeat}
                />
              )}
            </>
          }
        />
      </div>

      {/* HP 바 (적 + 플레이어) */}
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
            <span className="text-rose-200">{enemy.name}</span>
            <span className="text-rose-300/70 tabular-nums">
              {enemyHp} / {enemyMaxHp}
            </span>
          </div>
          <StoryHpBar
            currentHp={enemyHp}
            maxHp={enemyMaxHp}
            variant="enemy"
            size="md"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-gray-900/40 p-2">
          <div className="flex-1 space-y-1.5">
            <StoryHpBar
              currentHp={playerStats?.hp ?? 0}
              maxHp={playerStats?.hp_max ?? 100}
              variant="player"
              size="sm"
              label="HP"
            />
            <StoryHpBar
              currentHp={focusValue}
              maxHp={playerStats?.focus_max ?? 30}
              variant="player"
              size="sm"
              label="집중"
            />
          </div>
        </div>
      </div>

      {/* 6개 액션 버튼 */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          icon={<Swords className="h-3.5 w-3.5" />}
          label="잽"
          sub="기술 × 1.0 · 집중 -1"
          tone="border-rose-500/40 bg-rose-500/10 text-rose-100"
          disabled={focusInsufficient.jab || submitCommand.isPending || outcome !== "none"}
          onClick={() => handleCommand("jab")}
        />
        <ActionButton
          icon={<Shield className="h-3.5 w-3.5" />}
          label="가드"
          sub="피해 -50% · 집중 +2"
          tone="border-zinc-400/40 bg-zinc-500/10 text-zinc-100"
          disabled={submitCommand.isPending || outcome !== "none"}
          onClick={() => handleCommand("guard")}
        />
        <ActionButton
          icon={<Wind className="h-3.5 w-3.5" />}
          label="풋워크"
          sub="약공격 + 집중 +1"
          tone="border-sky-500/40 bg-sky-500/10 text-sky-100"
          disabled={submitCommand.isPending || outcome !== "none"}
          onClick={() => handleCommand("footwork")}
        />
        <ActionButton
          icon={<Zap className="h-3.5 w-3.5" />}
          label="카운터"
          sub="기술 × 2.5 · 집중 -2"
          tone="border-violet-500/40 bg-violet-500/10 text-violet-100"
          disabled={focusInsufficient.counter || submitCommand.isPending || outcome !== "none"}
          onClick={() => handleCommand("counter")}
        />
        <ActionButton
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="오삼이 조언"
          sub={osamUsed ? "사용 완료" : "전투당 1회 · 집중 +5"}
          tone="border-amber-500/40 bg-amber-500/10 text-amber-100"
          disabled={osamUsed || submitCommand.isPending || outcome !== "none"}
          onClick={() => handleCommand("osam_advice")}
        />
        <ActionButton
          icon={<Package className="h-3.5 w-3.5" />}
          label="카드"
          sub="인벤토리"
          tone="border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          disabled={submitCommand.isPending || outcome !== "none"}
          onClick={() => setShowInventory((v) => !v)}
        />
      </div>

      {showInventory && (
        <StoryInventoryPanel
          mode="battle"
          onUseCard={(code) => handleUseCard(code, code)}
          onClose={() => setShowInventory(false)}
        />
      )}
    </div>
  );
};

function ActionButton({
  icon,
  label,
  sub,
  tone,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-black">
        {icon}
        {label}
      </span>
      <span className="text-[9px] opacity-80">{sub}</span>
    </button>
  );
}

export default StoryBattleEngine;
