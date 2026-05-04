/**
 * 153 스토리 RPG — 내 복서 캐릭터 패널 (단계 38).
 *
 * 기존 캐릭터 데이터(member_character_assignments + character_presets) 를 read-only 로 표시.
 * 공식 리그/레벨도 read-only 로만 표기 — member_progress 미수정.
 */

import { useAuth } from "@/contexts/AuthContext";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import CharacterSprite from "@/components/CharacterSprite";
import { STORY_ROUTE_VISUAL } from "@/data/storyRpgVisuals";
import type {
  StoryOfficialSummary,
  StoryProgress,
  StoryRoute,
} from "@/types/storyRpg";

export interface StoryCharacterPanelProps {
  official: StoryOfficialSummary | null;
  activeRoute: StoryRoute | null;
  activeProgress: StoryProgress | null;
}

const LEAGUE_ALIAS: Record<string, "white" | "blue" | "red" | "black"> = {
  white: "white",
  blue: "blue",
  red: "red",
  black: "black",
  rookie: "white",
};

const StoryCharacterPanel = ({
  official,
  activeRoute,
  activeProgress,
}: StoryCharacterPanelProps) => {
  const { user, profile } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment(user?.id);

  const presets = assignment?.character_presets as
    | { parts_json?: { style?: string; customization?: unknown } }
    | null
    | undefined;
  const partsJson = presets?.parts_json;
  const style = partsJson?.style;

  const rankRaw = (official?.current_rank ?? "").toLowerCase();
  const league = LEAGUE_ALIAS[rankRaw] ?? "white";
  const level = official?.current_level ?? 1;

  const visual = activeRoute
    ? STORY_ROUTE_VISUAL[activeRoute.route_type]
    : null;

  const completedCount = activeProgress?.completed_chapter_count ?? 0;
  const progressPct = Math.min(100, Math.round((completedCount / 6) * 100));

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/70 to-gray-900/30 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {presets ? (
            <CharacterSprite
              style={style}
              userId={user?.id}
              partsJson={partsJson as { style?: string }}
              size="md"
              league={league}
              level={level}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gray-900/60 text-3xl">
              🥊
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            내 복서
          </p>
          <p className="mt-0.5 truncate text-base font-black text-foreground">
            {profile?.nickname || profile?.name || "이름 없는 복서"}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {official?.current_rank ?? "-"} 리그 · Lv.{level}
          </p>

          {activeRoute && visual && (
            <p
              className={`mt-2 inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-bold ${visual.chip}`}
            >
              {visual.emoji} {activeRoute.title}
            </p>
          )}
        </div>
      </div>

      {activeProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>스토리 진행률</span>
            <span className="font-bold text-foreground tabular-nums">
              {completedCount}/6
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-900/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        공식 리그/레벨은 마스터로드의 훈련으로만 변경됩니다. 여기서는 표시만 됩니다.
      </p>
    </section>
  );
};

export default StoryCharacterPanel;
