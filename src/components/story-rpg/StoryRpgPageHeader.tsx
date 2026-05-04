/**
 * 153 스토리 RPG 페이지 헤더 (단계 36).
 */

import { ArrowLeft, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  STORY_RPG_MENU_LABEL,
  STORY_RPG_PAGE_SUBTITLE,
  STORY_RPG_PAGE_TITLE,
} from "@/data/storyRpgCopy";

const StoryRpgPageHeader = () => {
  const navigate = useNavigate();
  return (
    <header className="flex items-start gap-3 px-4 pt-4 pb-2">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gray-900/50 text-gray-300 transition-colors active:scale-95 hover:border-white/20 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          <Swords className="h-3 w-3" />
          {STORY_RPG_MENU_LABEL}
        </p>
        <h1 className="mt-1 text-2xl font-black text-foreground">
          {STORY_RPG_PAGE_TITLE}
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {STORY_RPG_PAGE_SUBTITLE}
        </p>
      </div>
    </header>
  );
};

export default StoryRpgPageHeader;
