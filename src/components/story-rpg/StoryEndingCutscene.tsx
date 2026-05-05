/**
 * 153 스토리 RPG — 엔딩 컷씬 (단계 46).
 *
 * cutscene_blocks 순차 렌더 + 보상 카드 + completeEnding RPC 호출.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Loader2 } from "lucide-react";
import OsamMascot from "@/components/mascot/OsamMascot";
import { useCompleteEnding } from "@/hooks/useStoryRpg";
import type {
  EndingCompleteResult,
  StoryEndingCutsceneBlock,
  StorySceneEndingPayload,
} from "@/types/storyRpg";

const BLOCK_INTERVAL_MS = 3500;

export interface StoryEndingCutsceneProps {
  payload: StorySceneEndingPayload;
  routeId: string;
  onClaimed: (result: EndingCompleteResult) => void;
  onClose?: () => void;
}

const StoryEndingCutscene = ({
  payload,
  routeId,
  onClaimed,
  onClose,
}: StoryEndingCutsceneProps) => {
  const [blockIndex, setBlockIndex] = useState(0);
  const blocks = payload.cutscene_blocks ?? [];
  const totalBlocks = blocks.length;
  const allShown = blockIndex >= totalBlocks - 1;
  const completeEnding = useCompleteEnding();

  // 자동 진행
  useEffect(() => {
    if (allShown) return;
    const t = setTimeout(() => setBlockIndex((i) => i + 1), BLOCK_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [blockIndex, allShown]);

  // 컨페티 (보상 화면 진입 시)
  useEffect(() => {
    if (!allShown) return;
    const fire = (x: number, delay: number) =>
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x, y: 0.5 },
          colors: ["#fbbf24", "#fde047", "#f97316", "#fb7185"],
        });
      }, delay);
    fire(0.2, 0);
    fire(0.8, 200);
    fire(0.5, 450);
  }, [allShown]);

  const reward = payload.reward_summary ?? {};
  const block = blocks[Math.min(blockIndex, totalBlocks - 1)];

  const handleClaim = () => {
    completeEnding.mutate(
      { routeId, endingCode: payload.ending_code },
      {
        onSuccess: (res) => onClaimed(res),
      },
    );
  };

  return (
    <div className="relative">
      {/* cutscene 블록 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={blockIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5 }}
          className="min-h-[140px] rounded-2xl border border-amber-500/30 bg-gray-950/80 p-4"
        >
          <CutsceneBlock block={block} />
        </motion.div>
      </AnimatePresence>

      {/* 진행 바 */}
      <div className="mt-2 flex justify-center gap-1">
        {blocks.map((_, i) => (
          <span
            key={i}
            className={`h-1 w-4 rounded-full transition-colors ${
              i <= blockIndex ? "bg-amber-300" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* 보상 카드 (모든 block 표시 후) */}
      {allShown && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 space-y-3 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent p-4"
        >
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
              엔딩
            </p>
            <h2 className="mt-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-rose-300 bg-clip-text text-2xl font-black text-transparent">
              {payload.title}
            </h2>
            {payload.subtitle && (
              <p className="mt-0.5 text-[12px] text-amber-100/80">
                {payload.subtitle}
              </p>
            )}
          </div>

          <ul className="grid gap-1.5 text-[12px]">
            {typeof reward.story_xp === "number" && reward.story_xp > 0 && (
              <RewardRow label="STORY XP" value={`+${reward.story_xp}`} tone="amber" />
            )}
            {typeof reward.ring_coins === "number" && reward.ring_coins > 0 && (
              <RewardRow label="링 코인" value={`+${reward.ring_coins}`} tone="rose" />
            )}
            {typeof reward.real_gems_first_time === "number" &&
              reward.real_gems_first_time > 0 && (
                <RewardRow
                  label="파이트 머니 (최초 1회)"
                  value={`+${reward.real_gems_first_time}`}
                  tone="emerald"
                />
              )}
            {reward.title && <RewardRow label="🏆 칭호" value={reward.title} tone="yellow" />}
            {reward.card_code && (
              <RewardRow label="🎴 카드" value={reward.card_code} tone="violet" />
            )}
            {reward.badge_code && (
              <RewardRow label="🥇 배지" value={reward.badge_code} tone="zinc" />
            )}
          </ul>

          <button
            type="button"
            onClick={handleClaim}
            disabled={completeEnding.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-pill border border-amber-400/60 bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-amber-950 active:scale-[0.98] disabled:opacity-60"
          >
            {completeEnding.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            보상 받기
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
            >
              나중에 받기
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};

function RewardRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "rose" | "emerald" | "yellow" | "violet" | "zinc";
}) {
  const map: Record<typeof tone, string> = {
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    rose: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    yellow: "border-yellow-400/40 bg-yellow-500/10 text-yellow-100",
    violet: "border-violet-400/40 bg-violet-500/10 text-violet-100",
    zinc: "border-zinc-400/40 bg-zinc-500/10 text-zinc-100",
  };
  return (
    <li
      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${map[tone]}`}
    >
      <span className="text-[11px] font-bold opacity-80">{label}</span>
      <span className="text-[13px] font-black tabular-nums">{value}</span>
    </li>
  );
}

function CutsceneBlock({ block }: { block?: StoryEndingCutsceneBlock }) {
  if (!block) return null;
  const text = block.body ?? block.text ?? "";
  const speaker = block.speaker;
  const type = block.type;

  if (type === "narration") {
    return (
      <p className="text-center text-[13px] leading-relaxed text-foreground">
        {text}
      </p>
    );
  }
  if (type === "credits") {
    return (
      <p className="text-center text-[11px] leading-relaxed text-amber-200/70">
        {text}
      </p>
    );
  }
  if (type === "dialogue" || type === "image_caption" || type === "image") {
    return (
      <div className="flex items-start gap-3">
        <OsamMascot size="sm" state="idle" />
        <div className="flex-1">
          {speaker && (
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
              {speaker}
            </p>
          )}
          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-foreground">
            {text}
          </p>
        </div>
      </div>
    );
  }
  return <p className="text-center text-[12px]">{text}</p>;
}

export default StoryEndingCutscene;
