/**
 * 153 스토리 RPG — 선택지 패널 (단계 46).
 */

import { Loader2 } from "lucide-react";
import type {
  StorySceneChoiceOption,
  StorySceneChoicePayload,
  StoryStatKey,
} from "@/types/storyRpg";

const STAT_LABEL: Record<StoryStatKey, string> = {
  hp: "체력",
  focus: "집중",
  skill: "기술",
  guard: "가드",
  grit: "투지",
  respect: "리스펙트",
};

function formatStatChanges(
  changes: StorySceneChoiceOption["stat_changes"],
): string {
  if (!changes) return "";
  const entries = Object.entries(changes) as Array<[StoryStatKey, number]>;
  return entries
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([k, v]) => `${STAT_LABEL[k] ?? k} ${v > 0 ? "+" : ""}${v}`)
    .join(" · ");
}

export interface StoryChoicePanelProps {
  payload: StorySceneChoicePayload;
  onSelect: (choiceIndex: number) => void;
  busy?: boolean;
  busyIndex?: number | null;
}

const StoryChoicePanel = ({
  payload,
  onSelect,
  busy,
  busyIndex,
}: StoryChoicePanelProps) => {
  return (
    <div className="space-y-3">
      <div>
        {payload.speaker && (
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
            {payload.speaker}
          </p>
        )}
        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
          {payload.prompt}
        </p>
      </div>
      <ul className="space-y-2">
        {payload.choices.map((c, i) => {
          const isBusy = busy && busyIndex === i;
          const stats = formatStatChanges(c.stat_changes);
          return (
            <li key={i}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(i)}
                className="group flex w-full flex-col gap-1 rounded-2xl border border-amber-500/30 bg-gray-950/80 px-4 py-3 text-left transition-all hover:border-amber-400 active:scale-[0.99] disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-foreground">
                    {c.label}
                  </span>
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />}
                </div>
                {(stats || c.hint) && (
                  <span className="text-[10px] text-amber-200/70">
                    {stats}
                    {stats && c.hint ? " · " : ""}
                    {c.hint}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default StoryChoicePanel;
