/**
 * 153 QUEST — 홈 진입 카드: 오삼이 오늘의 브리핑.
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 미수정 (읽기만)
 *   · ChatAssistant/스트리밍 호출 0건 — 정적 메시지만 사용
 *   · 새 AI 챗박스 미생성
 */

import { useMemo } from "react";
import type { Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { RANK_LABELS } from "@/data/sharedConstants";
import {
  pickOsamiMessageBySeed,
  type OsamiPersona,
} from "@/data/osamiEngagementMessages";
import { useBoxingEngagementSummary } from "@/hooks/useBoxingEngagement";

const PERSONA_LABEL: Record<OsamiPersona, string> = {
  white: "자상한 관장님",
  blue: "엄한 트레이너",
  red: "코너맨",
  black: "동료 챔피언",
};

function todayKstSeed(): string {
  // KST 기준 YYYY-MM-DD 일자 시드 → 하루 안에서 메시지가 안정적으로 고정됨.
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

const OsamiDailyBriefingCard = () => {
  const { progress, profile } = useAuth();
  const { data: summary } = useBoxingEngagementSummary();

  const rank = (progress?.current_rank ?? "white") as Enums<"rank_name">;
  const persona: OsamiPersona = rank as OsamiPersona;
  const seed = `${profile?.id ?? "anon"}:${todayKstSeed()}`;

  const briefingMessage = useMemo(
    () => pickOsamiMessageBySeed(persona, "daily_briefing", seed),
    [persona, seed],
  );
  const openMessage = useMemo(
    () => pickOsamiMessageBySeed(persona, "app_open", seed),
    [persona, seed],
  );

  const questXp = summary?.quest_xp ?? 0;
  const respect = summary?.respect_points ?? 0;

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="오삼이 오늘의 브리핑"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-2xl">
          🥊
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오삼 코치 · 오늘의 브리핑
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-foreground">
            {RANK_LABELS[rank]} 리그 · Lv.{progress?.current_level ?? 1}
            <span className="ml-2 text-[11px] font-medium text-muted-foreground">
              {PERSONA_LABEL[persona]}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[13px] font-medium leading-relaxed text-foreground">
          {openMessage}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {briefingMessage}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            QUEST XP
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {questXp.toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            RP
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {respect.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        <p>· 공식 훈련 리스트는 그대로 유지됩니다.</p>
        <p>· 보조 퀘스트는 재미와 습관을 위한 추가 미션입니다.</p>
        <p>· 공식 레벨업은 기존 코치 승인 기준으로 진행됩니다.</p>
      </div>
    </section>
  );
};

export default OsamiDailyBriefingCard;
