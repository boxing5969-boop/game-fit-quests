/**
 * 153 스토리 RPG — 씬 플레이어 (단계 46, 핵심).
 *
 * scene_type 별 분기 + 타자기 효과 + 씬 전환 페이드.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import StoryChoicePanel from "./StoryChoicePanel";
import CharacterPortrait from "./visuals/portraits/CharacterPortrait";
import {
  resolvePortrait,
  SPEAKER_DEFAULT_EMOTION,
  type PortraitEmotion,
} from "./visuals/portraits/portraitData";
import type {
  StoryScene,
  StorySceneChoicePayload,
  StorySceneDialoguePayload,
  StorySceneNodeMovePayload,
} from "@/types/storyRpg";

const TYPE_INTERVAL_MS = 30;

export interface StoryScenePlayerProps {
  scene: StoryScene;
  onAdvance: (nextSceneIndex: number) => void;
  onChoice: (choiceIndex: number) => void;
  onBattleStart: (enemyCode: string) => void;
  onEnding: (endingCode: string) => void;
  busy?: boolean;
}

function useTypewriter(text: string, intervalMs = TYPE_INTERVAL_MS) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    setLength(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLength(i);
      if (i >= text.length) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [text, intervalMs]);
  const complete = length >= text.length;
  const skip = () => setLength(text.length);
  return { typed: text.slice(0, length), complete, skip };
}

const StoryScenePlayer = ({
  scene,
  onAdvance,
  onChoice,
  onBattleStart,
  onEnding,
  busy,
}: StoryScenePlayerProps) => {
  const triggeredRef = useRef<string | null>(null);

  useEffect(() => {
    triggeredRef.current = null;
  }, [scene.id]);

  // ── battle: intro_line 1초 후 자동 트리거 ──
  useEffect(() => {
    if (scene.scene_type !== "battle") return;
    const battlePayload = scene.payload as { enemy_code: string };
    if (triggeredRef.current === scene.id) return;
    triggeredRef.current = scene.id;
    const timer = setTimeout(() => {
      onBattleStart(battlePayload.enemy_code);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, scene.scene_type]);

  // ── ending: 즉시 onEnding 호출 (StoryEndingCutscene 가 인계받음) ──
  useEffect(() => {
    if (scene.scene_type !== "ending") return;
    const endingPayload = scene.payload as { ending_code: string };
    if (triggeredRef.current === scene.id) return;
    triggeredRef.current = scene.id;
    onEnding(endingPayload.ending_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, scene.scene_type]);

  // ── node_move: transition_message 페이드 후 자동 진행 ──
  if (scene.scene_type === "node_move") {
    return (
      <NodeMoveScene
        payload={scene.payload as StorySceneNodeMovePayload}
        onComplete={() => onAdvance(scene.next_scene_index ?? 0)}
      />
    );
  }

  // ── choice ──
  if (scene.scene_type === "choice") {
    const choicePayload = scene.payload as StorySceneChoicePayload;
    return (
      <StoryChoicePanel
        payload={choicePayload}
        onSelect={onChoice}
        busy={busy}
      />
    );
  }

  // ── battle 진입 대기 중 ──
  if (scene.scene_type === "battle") {
    const battlePayload = scene.payload as {
      enemy_code: string;
      intro_line?: string;
    };
    return (
      <div className="space-y-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-300">
          ⚔ 전투 시작
        </p>
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
          {battlePayload.intro_line ?? "적이 등장합니다..."}
        </p>
      </div>
    );
  }

  // ── ending 인계 중 ──
  if (scene.scene_type === "ending") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
          ✨ 엔딩
        </p>
        <p className="text-[12px] text-muted-foreground">
          마지막 라운드를 준비합니다...
        </p>
      </div>
    );
  }

  // ── dialogue (기본) ──
  const dialoguePayload = scene.payload as StorySceneDialoguePayload;
  return (
    <DialogueScene
      payload={dialoguePayload}
      onAdvance={() => onAdvance(scene.next_scene_index ?? -1)}
      canAdvance={scene.next_scene_index !== null && scene.next_scene_index >= 0}
    />
  );
};

// ──────────────────────────────────────────────────────────────────
// DialogueScene — Stage 47A 비주얼 오버홀
//   · 좌측 1/3: CharacterPortrait (입 모양 동기화)
//   · 우측 2/3: 텍스트 박스 (retro 프레임 보더)
// ──────────────────────────────────────────────────────────────────
function DialogueScene({
  payload,
  onAdvance,
  canAdvance,
}: {
  payload: StorySceneDialoguePayload;
  onAdvance: () => void;
  canAdvance: boolean;
}) {
  const { typed, complete, skip } = useTypewriter(payload.body);

  const handleTap = () => {
    if (!complete) skip();
    else if (canAdvance) onAdvance();
  };

  // speaker → portrait key + emotion fallback
  const portraitKey = resolvePortrait(payload.speaker);
  const emotion: PortraitEmotion =
    (payload as { portrait_emotion?: PortraitEmotion }).portrait_emotion ??
    SPEAKER_DEFAULT_EMOTION[portraitKey] ??
    "default";

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full cursor-pointer text-left"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <CharacterPortrait
            portraitKey={portraitKey}
            emotion={emotion}
            talking={!complete}
            size="md"
          />
        </div>
        <div className="flex-1 min-w-0 rounded-2xl border border-amber-500/30 bg-gray-950/85 p-3 shadow-[0_0_0_1px_rgba(253,184,92,0.15)_inset]">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
            {payload.speaker}
          </p>
          <p className="mt-2 min-h-[3.5em] whitespace-pre-line text-[13px] leading-relaxed text-foreground">
            {typed}
            {!complete && (
              <motion.span
                className="ml-0.5 inline-block h-3 w-0.5 align-middle bg-amber-300"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </p>
        </div>
      </div>
      {complete && canAdvance && (
        <motion.p
          className="mt-3 text-center text-[10px] font-bold tracking-wider text-amber-300/70"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          ▼ 탭하여 다음
        </motion.p>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// NodeMoveScene
// ──────────────────────────────────────────────────────────────────
function NodeMoveScene({
  payload,
  onComplete,
}: {
  payload: StorySceneNodeMovePayload;
  onComplete: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1200);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center gap-2 py-8 text-center"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/70">
        이동 중
      </p>
      <p className="text-base font-bold text-foreground">
        {payload.transition_message ?? payload.to_node_code}
      </p>
    </motion.div>
  );
}

export default StoryScenePlayer;
