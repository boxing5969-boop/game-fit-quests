/**
 * 153 QUEST v2 20단계 — 그림자 복서 진입 카드 (MyPage).
 *
 * 상태별 표시:
 *   · ready=false: "분석 준비 중" + 가입일 안내
 *   · improved=true: 성장률 강조 + 보상 받기 안내
 *   · improved=false: "꾸준함도 강함입니다" + 데이터 저장 메시지
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 클릭은 시트 열기만, 보상 처리는 시트에서
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { useShadowBoxerSnapshot } from "@/hooks/useShadowBoxer";

import ShadowBoxerSheet from "./ShadowBoxerSheet";

const ShadowBoxerCard = () => {
  const [showSheet, setShowSheet] = useState(false);
  const { data: snapshot, isLoading } = useShadowBoxerSnapshot(30);

  const ready = snapshot?.ready === true;
  const improved = snapshot?.improved === true;
  const growthRate = snapshot?.growth_rate ?? 0;

  let title: string;
  let subtitle: string;
  let badge: string | null = null;

  if (isLoading) {
    title = "그림자 복서";
    subtitle = "분석 중…";
  } else if (!ready) {
    title = "그림자 복서";
    subtitle = snapshot?.reason ?? "30일 이후 비교가 시작됩니다.";
  } else if (improved) {
    title = "어제의 나를 이겼습니다";
    subtitle = `성장률 +${growthRate}% · 이번 달 보상이 열렸습니다.`;
    badge = "+150 XP · +300 GEM";
  } else {
    title = "데이터로 저장되었습니다";
    subtitle = "꾸준함도 강함입니다. 다음 달 다시 도전.";
  }

  return (
    <>
      <section
        className="surface-card border border-border bg-card"
        aria-label="그림자 복서"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              그림자 복서 · 어제의 나
            </p>
            <h3 className="mt-0.5 text-[14.5px] font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
            {badge && (
              <p className="mt-1.5 text-[10.5px] font-bold text-reward">
                {badge}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSheet(true)}
          className="mt-3 w-full rounded-card border border-border bg-card py-2.5 text-[12.5px] font-bold text-primary transition-all active:scale-[0.99] hover:border-primary/40"
        >
          {ready
            ? improved
              ? "보상 확인 →"
              : "지표 자세히 보기 →"
            : "그림자 복서 열기 →"}
        </button>

        <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          ※ 그림자 복서는 공식 승급 조건이 아닙니다. 어제의 나와 비교하는
          보조 성장 지표입니다.
        </p>
      </section>

      <ShadowBoxerSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </>
  );
};

export default ShadowBoxerCard;
