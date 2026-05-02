/**
 * 153 QUEST v1.5 17단계 — 복서 스타일 진단 카드 (MyPage).
 *
 * 보호 원칙 (§11-⑦):
 *   · 점수 계산은 useBoxerStyleDiagnosis (boxerStyleRules.ts) — 공식 데이터 미주입
 *   · 본 카드의 표시용 컨텍스트(현재 리그·레벨)는 별도로 useAuth() 에서 읽음
 *   · member_progress / total_xp / current_level 은 점수 함수에 절대 전달 안 됨
 */

import { Compass } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useBoxerStyleDiagnosis } from "@/hooks/useBoxerStyleDiagnosis";
import { BOXER_STYLE_METADATA } from "@/data/boxerStyleRules";
import { RANK_LABELS } from "@/data/sharedConstants";
import type { Enums } from "@/integrations/supabase/types";

const BoxerStyleDiagnosisCard = () => {
  const { progress } = useAuth();
  const { diagnosis, isLoading } = useBoxerStyleDiagnosis();

  const meta = diagnosis
    ? BOXER_STYLE_METADATA[diagnosis.primaryStyle]
    : BOXER_STYLE_METADATA.rookie_under_analysis;

  const secondaryMeta =
    diagnosis?.secondaryStyle &&
    BOXER_STYLE_METADATA[diagnosis.secondaryStyle];

  // 표시 전용 — 점수 계산에 사용되지 않음
  const rank = (progress?.current_rank ?? "white") as Enums<"rank_name">;
  const level = progress?.current_level ?? 1;

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="복서 스타일 진단"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            나는 어떤 복서?
          </p>
          <h3 className="mt-0.5 text-[15px] font-bold text-foreground">
            {meta.emoji} {meta.label}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {meta.shortDescription}
          </p>
        </div>
      </div>

      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[12.5px] leading-relaxed text-foreground">
          {isLoading ? "분석 중…" : diagnosis?.reason ?? "데이터를 모으고 있습니다."}
        </p>
        {diagnosis && diagnosis.confidence > 0 && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            확신도 {diagnosis.confidence}%
            {secondaryMeta &&
              ` · 서브 스타일 ${secondaryMeta.emoji} ${secondaryMeta.label}`}
          </p>
        )}
      </div>

      {diagnosis?.nextSuggestion && (
        <div className="mt-2 rounded-card border border-border bg-background/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            다음 한 걸음
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
            {diagnosis.nextSuggestion}
          </p>
        </div>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 복서 스타일은 QUEST 활동 데이터로 분석한 보조 표시입니다. 공식 리그
        / 공식 레벨 ({RANK_LABELS[rank]} Lv.{level}) 와는 분리됩니다.
      </p>
    </section>
  );
};

export default BoxerStyleDiagnosisCard;
