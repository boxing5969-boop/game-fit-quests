/**
 * 153 마인드셋 — HomePage 진입 카드 (단계 36).
 *
 * 홈의 '더 보기' 영역에 배치. 클릭 시 /story-rpg 로 이동.
 *
 * 64-I: 회원 노출 라벨을 '153 스토리 RPG' → '153 마인드셋' 으로 통일.
 *   브랜드 가이드: RPG / 몬스터 / 전투 / 보스 / 판타지 / 레벨업 등 표현은
 *   회원에게 노출하지 않음. 내부 코드/페이지 라우트(/story-rpg) 는 유지.
 */

import { useNavigate } from "react-router-dom";
import { Brain } from "lucide-react";

const StoryRpgEntryCard = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/story-rpg")}
      className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-amber-500/10 p-3 text-left transition-all active:scale-[0.99] hover:border-amber-500/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white">
        <Brain className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          153 마인드셋
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-foreground">
          오늘의 한 줄과 작은 마음 다짐을 챙기세요
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          매일 짧게 — 자세, 태도, 호흡, 회복을 마음으로 먼저 다집니다
        </p>
      </div>
      <span className="shrink-0 text-amber-300 text-lg">→</span>
    </button>
  );
};

export default StoryRpgEntryCard;
