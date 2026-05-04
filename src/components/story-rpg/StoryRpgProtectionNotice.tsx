/**
 * 153 스토리 RPG — 공식 시스템 보호 안내 (단계 36).
 */

import { Shield } from "lucide-react";
import { STORY_RPG_PROTECTION_NOTICE } from "@/data/storyRpgCopy";

const StoryRpgProtectionNotice = () => {
  return (
    <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-3.5">
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span>{STORY_RPG_PROTECTION_NOTICE}</span>
      </p>
    </section>
  );
};

export default StoryRpgProtectionNotice;
