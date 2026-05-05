/**
 * 153 스토리 RPG — 턴제 전투 엔진 (단계 46).
 *
 * 게임 로직 (데미지 계산) 은 클라이언트가 담당하고, RPC submit_player_command 는
 * 결과 (음수 hp delta) 만 검증하여 적용한다.
 *
 * 보호 원칙:
 *   · wallet 직접 update 0건 — 보상은 RPC 안 grant_gems 가 처리.
 *   · ChatAssistant 호출 0건.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Loader2,
  Package,
  Shield,
  Sparkles,
  Swords,
  Wind,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStartBattle,
  useSubmitBattleCommand,
  useMyPlayerStats,
  useClaimCard,
} from "@/hooks/useStoryRpg";
import StoryHpBar from "./StoryHpBar";
import StoryObstacleCreature, {
  type CreatureState,
} from "./StoryObstacleCreature";
import StoryInventoryPanel from "./StoryInventoryPanel";
import OsamMascot from "@/components/mascot/OsamMascot";
import type {
  BattleActionLogEntry,
  BattleCommand,
  StoryEnemy,
} from "@/types/storyRpg";

export interface StoryBattleEngineProps {
  enemyCode: string;
  chapterId: string | null;
  onVictory: (rewards: {
    story_xp: number;
    ring_coins: number;
    card_code: string | null;
  }) => void;
  onDefeat: () => void;
  onClose?: () => void;
}

interface DamagePopup {
  id: number;
  text: string;
  variant: "normal" | "weakness" | "critical" | "miss";
}

const StoryBattleEngine = ({
  enemyCode,
  chapterId,
  onVictory,
  onDefeat,
  onClose,
}: StoryBattleEngineProps) => {
  const startBattle = useStartBattle();
  const submitCommand = useSubmitBattleCommand();
  const claimCard = useClaimCard();
  const { data: playerStats } = useMyPlayerStats();

  const [enemy, setEnemy] = useState<StoryEnemy | null>(null);
  const [enemyHp, setEnemyHp] = useState<number | null>(null);
  const [enemyMaxHp, setEnemyMaxHp] = useState<number | null>(null);
  const [creatureState, setCreatureState] = useState<CreatureState>("idle");
  const [actionLog, setActionLog] = useState<BattleActionLogEntry[]>([]);
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [osamUsed, setOsamUsed] = useState(false);
  const popupSeq = useRef(0);
  const startedRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);

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
          setActionLog([
            { actor: "osam", line: `${res.enemy.name} 등장!` },
          ]);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "전투 시작 실패");
          onClose?.();
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyCode, chapterId]);

  // 자동 스크롤
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionLog.length]);

  const pushLog = (entry: BattleActionLogEntry) => {
    setActionLog((arr) => [...arr.slice(-12), entry]);
  };

  const pushPopup = (text: string, variant: DamagePopup["variant"] = "normal") => {
    popupSeq.current += 1;
    const id = popupSeq.current;
    setPopups((arr) => [...arr, { id, text, variant }]);
    setTimeout(() => {
      setPopups((arr) => arr.filter((p) => p.id !== id));
    }, 700);
  };

  // ── 데미지/회피 계산 (클라이언트) ─────────────────────────────
  const computeOutcome = (command: BattleCommand) => {
    if (!enemy || !playerStats) {
      return { enemyDelta: 0, playerDelta: 0, log: [] as BattleActionLogEntry[], variant: "normal" as const };
    }

    const skill = playerStats.skill;
    const guard = playerStats.guard;
    const grit = playerStats.grit;
    const respect = playerStats.respect;
    const enemyAtk = enemy.attack;
    const enemyDef = enemy.defense;
    const weak = enemy.weakness ?? {};

    let enemyDelta = 0;
    let playerDelta = 0;
    let variant: DamagePopup["variant"] = "normal";
    const log: BattleActionLogEntry[] = [];

    // 명령별 처리
    switch (command) {
      case "jab": {
        let dmg = Math.max(1, Math.round(skill * 1.0 - enemyDef * 0.5));
        if (weak.jab) {
          const mult = typeof weak.jab === "number" ? weak.jab : 1.5;
          dmg = Math.round(dmg * mult);
          variant = "weakness";
        }
        enemyDelta = -dmg;
        log.push({ actor: "player", line: `잽! ${dmg} 피해`, damage: dmg });
        break;
      }
      case "guard": {
        log.push({ actor: "player", line: "가드 자세를 잡았어요." });
        // 적 공격 50% 감소
        const incoming = Math.max(0, Math.round(enemyAtk * 0.5 - guard * 0.5));
        playerDelta = -incoming;
        if (incoming > 0) {
          log.push({ actor: "enemy", line: `${enemy.name} 공격 — ${incoming} 피해`, damage: incoming });
        } else {
          log.push({ actor: "enemy", line: `${enemy.name} 의 공격을 모두 막았어요.` });
        }
        return { enemyDelta, playerDelta, log, variant };
      }
      case "footwork": {
        // 회피 60% (grit 보너스)
        const evade = 0.5 + Math.min(0.4, grit * 0.005);
        const evaded = Math.random() < evade;
        let dmg = Math.max(1, Math.round(skill * 0.6 - enemyDef * 0.5));
        if (weak.footwork) {
          dmg = Math.round(dmg * 1.3);
          variant = "weakness";
        }
        enemyDelta = -dmg;
        log.push({ actor: "player", line: `풋워크! ${dmg} 피해`, damage: dmg });
        if (evaded) {
          log.push({ actor: "enemy", line: `${enemy.name} 의 공격을 회피!` });
        } else {
          const incoming = Math.max(0, Math.round(enemyAtk * 0.7));
          playerDelta = -incoming;
          log.push({ actor: "enemy", line: `${enemy.name} 공격 — ${incoming} 피해`, damage: incoming });
        }
        return { enemyDelta, playerDelta, log, variant };
      }
      case "counter": {
        let dmg = Math.max(1, Math.round(skill * 2.5 - enemyDef * 0.5));
        if (weak.counter) {
          dmg = Math.round(dmg * 1.5);
          variant = "weakness";
        }
        // grit / respect 합산 보너스
        const respectGrit = (typeof weak.respect_grit_combined_threshold === "number"
          ? weak.respect_grit_combined_threshold
          : 0);
        if (respectGrit > 0 && respect + grit >= respectGrit) {
          dmg = Math.round(dmg * 1.5);
          variant = "critical";
        }
        enemyDelta = -dmg;
        log.push({ actor: "player", line: `카운터! ${dmg} 피해`, damage: dmg });
        // 카운터 성공 시 적 공격 무효
        log.push({ actor: "enemy", line: `${enemy.name} 의 공격이 무력화됨.` });
        return { enemyDelta, playerDelta, log, variant };
      }
      case "osam_advice": {
        log.push({
          actor: "osam",
          line: `${enemy.name}: ${enemy.pattern_code} 패턴. 약점 — ${
            Object.keys(enemy.weakness).join(", ") || "없음"
          }`,
        });
        return { enemyDelta: 0, playerDelta: 0, log, variant };
      }
      case "use_card": {
        log.push({ actor: "player", line: "카드를 꺼내 듭니다." });
        return { enemyDelta: 0, playerDelta: 0, log, variant };
      }
    }

    // 기본 적 반격 (jab 후)
    if (command === "jab") {
      const incoming = Math.max(0, Math.round(enemyAtk - guard * 0.3));
      playerDelta = -incoming;
      if (incoming > 0) {
        log.push({ actor: "enemy", line: `${enemy.name} 공격 — ${incoming} 피해`, damage: incoming });
      }
    }

    return { enemyDelta, playerDelta, log, variant };
  };

  // ── 명령 실행 ──────────────────────────────────────────────────
  const handleCommand = (command: BattleCommand) => {
    if (!enemy || enemyHp === null || enemyMaxHp === null) return;
    if (submitCommand.isPending) return;

    const { enemyDelta, playerDelta, log, variant } = computeOutcome(command);

    // 클라이언트 측 즉시 시각효과
    log.forEach(pushLog);
    if (enemyDelta < 0) {
      pushPopup(`-${Math.abs(enemyDelta)}`, variant);
      setCreatureState("hurt");
      setTimeout(() => setCreatureState("idle"), 250);
    }

    submitCommand.mutate(
      {
        command,
        targetData: {
          enemy_hp_delta: enemyDelta,
          player_hp_delta: playerDelta,
        },
      },
      {
        onSuccess: (res) => {
          setEnemyHp(res.enemy_hp);
          if (command === "osam_advice") setOsamUsed(true);
          if (res.status === "victory") {
            setCreatureState("defeated");
            // 카드 보상 자동 인벤토리 추가
            if (res.reward_card_code) {
              claimCard.mutate({
                cardCode: res.reward_card_code,
                source: "enemy_drop",
              });
            }
            setTimeout(() => {
              onVictory({
                story_xp: res.reward_story_xp ?? 0,
                ring_coins: res.reward_ring_coins ?? 0,
                card_code: res.reward_card_code ?? null,
              });
            }, 900);
          } else if (res.status === "defeat") {
            setTimeout(() => onDefeat(), 600);
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "명령 실패");
        },
      },
    );
  };

  const handleUseCard = (cardCode: string) => {
    setShowInventory(false);
    pushLog({ actor: "player", line: `카드 사용: ${cardCode}` });
    submitCommand.mutate(
      {
        command: "use_card",
        targetData: { card_code: cardCode, enemy_hp_delta: 0, player_hp_delta: 0 },
      },
      {
        onSuccess: (res) => setEnemyHp(res.enemy_hp),
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
      {/* 적 + HP */}
      <div className="relative flex flex-col items-center gap-2">
        <div className="relative h-[140px] w-[140px]">
          <StoryObstacleCreature
            code={enemy.code}
            state={creatureState}
            size="md"
          />
          <AnimatePresence>
            {popups.map((p) => (
              <motion.span
                key={p.id}
                initial={{ y: 0, opacity: 1, scale: 0.9 }}
                animate={{ y: -40, opacity: 1, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className={`absolute left-1/2 top-2 -translate-x-1/2 transform text-base font-black ${
                  p.variant === "weakness"
                    ? "text-yellow-300"
                    : p.variant === "critical"
                      ? "text-rose-400"
                      : p.variant === "miss"
                        ? "text-zinc-300"
                        : "text-white"
                }`}
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="text-[12px] font-black text-rose-200">
          {enemy.name}
          {enemy.is_boss && (
            <span className="ml-1.5 rounded-full bg-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-100">
              BOSS
            </span>
          )}
        </p>
        <div className="w-full max-w-[220px]">
          <StoryHpBar
            currentHp={enemyHp}
            maxHp={enemyMaxHp}
            variant="enemy"
            size="md"
          />
        </div>
      </div>

      {/* 액션 로그 */}
      <div
        ref={logRef}
        className="h-[120px] overflow-y-auto rounded-2xl border border-white/10 bg-gray-950/80 p-2 text-[11px]"
      >
        {actionLog.map((entry, i) => (
          <p
            key={i}
            className={`leading-snug ${
              entry.actor === "player"
                ? "text-emerald-300"
                : entry.actor === "enemy"
                  ? "text-rose-300"
                  : "text-amber-200"
            }`}
          >
            {entry.actor === "player" ? "▶ " : entry.actor === "enemy" ? "◀ " : "★ "}
            {entry.line}
          </p>
        ))}
      </div>

      {/* 플레이어 + HP/Focus */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gray-900/40 p-3">
        <OsamMascot size="sm" state="idle" />
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

      {/* 5개 액션 + 인벤토리 */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          icon={<Swords className="h-3.5 w-3.5" />}
          label="잽"
          sub="기술 × 1.0 · 집중 -1"
          tone="border-rose-500/40 bg-rose-500/10 text-rose-100"
          disabled={focusInsufficient.jab || submitCommand.isPending}
          onClick={() => handleCommand("jab")}
        />
        <ActionButton
          icon={<Shield className="h-3.5 w-3.5" />}
          label="가드"
          sub="피해 50% 감소"
          tone="border-zinc-400/40 bg-zinc-500/10 text-zinc-100"
          disabled={submitCommand.isPending}
          onClick={() => handleCommand("guard")}
        />
        <ActionButton
          icon={<Wind className="h-3.5 w-3.5" />}
          label="풋워크"
          sub="회피 + 약공격"
          tone="border-sky-500/40 bg-sky-500/10 text-sky-100"
          disabled={focusInsufficient.footwork || submitCommand.isPending}
          onClick={() => handleCommand("footwork")}
        />
        <ActionButton
          icon={<Zap className="h-3.5 w-3.5" />}
          label="카운터"
          sub="기술 × 2.5 · 집중 -2"
          tone="border-violet-500/40 bg-violet-500/10 text-violet-100"
          disabled={focusInsufficient.counter || submitCommand.isPending}
          onClick={() => handleCommand("counter")}
        />
        <ActionButton
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="오삼이 조언"
          sub={osamUsed ? "사용 완료" : "전투당 1회"}
          tone="border-amber-500/40 bg-amber-500/10 text-amber-100"
          disabled={osamUsed || submitCommand.isPending}
          onClick={() => handleCommand("osam_advice")}
        />
        <ActionButton
          icon={<Package className="h-3.5 w-3.5" />}
          label="카드"
          sub="인벤토리"
          tone="border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          disabled={submitCommand.isPending}
          onClick={() => setShowInventory((v) => !v)}
        />
      </div>

      {showInventory && (
        <StoryInventoryPanel
          mode="battle"
          onUseCard={handleUseCard}
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

// 미사용 import 가드
void Sparkles;
