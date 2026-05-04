/**
 * 153 스토리 RPG — HomePage 진입 카드 (단계 36).
 *
 * "더 보기" 펼침 영역 안에 배치되어 첫 화면 피로감을 회피한다.
 * 클릭 시 /story-rpg 로 이동.
 */

import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import {
  STORY_RPG_MENU_LABEL,
  STORY_RPG_PAGE_SUBTITLE,
} from "@/data/storyRpgCopy";

const StoryRpgEntryCard = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/story-rpg")}
      className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-amber-500/10 p-3 text-left transition-all active:scale-[0.99] hover:border-amber-500/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white">
        <Swords className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          {STORY_RPG_MENU_LABEL}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-foreground">
          내 캐릭터로 복서의 길을 시작하세요
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {STORY_RPG_PAGE_SUBTITLE}
        </p>
      </div>
      <span className="shrink-0 text-amber-300 text-lg">→</span>
    </button>
  );
};

export default StoryRpgEntryCard;
