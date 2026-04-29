/**
 * 153 QUEST — 나만의 복싱 전당: 계급별 스토리 라벨.
 *
 * 자체 제작 스토리. 실존 인물/저작물 미사용. boxingQuestNarratives 와 정렬.
 */

import { RANK_LABELS } from "@/data/sharedConstants";

const STORY: Record<string, { archetype: string; tagline: string }> = {
  white: {
    archetype: "체육관 문을 처음 연 신인",
    tagline: "첫 라운드의 정직함이 챔피언의 시작입니다.",
  },
  blue: {
    archetype: "기본기를 몸에 붙이는 선수",
    tagline: "정확함이 빠른 기록보다 오래 갑니다.",
  },
  red: {
    archetype: "어제의 나와 싸우는 도전자",
    tagline: "기록을 깨는 상대는 어제의 자신입니다.",
  },
  black: {
    archetype: "후배에게 길을 보여주는 챔피언",
    tagline: "남기는 한 줄이 누군가의 시작이 됩니다.",
  },
};

export interface LeagueStoryBadgeProps {
  rank: string;
  level?: number | null;
}

const LeagueStoryBadge = ({ rank, level }: LeagueStoryBadgeProps) => {
  const s = STORY[rank] ?? STORY.white;
  const rankLabel = RANK_LABELS[rank as keyof typeof RANK_LABELS] ?? "";

  return (
    <div className="rounded-card border border-primary/15 bg-primary/5 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
        {rankLabel} 리그{level != null ? ` · Lv.${level}` : ""}
      </p>
      <p className="mt-1 text-[13px] font-bold text-foreground">
        {s.archetype}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        {s.tagline}
      </p>
    </div>
  );
};

export default LeagueStoryBadge;
