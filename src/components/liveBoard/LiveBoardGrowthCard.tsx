/**
 * 🌱 라이브보드 2번 화면 오른쪽 칸 — 「오늘의 1분」 (2026-11-17 대표님 「다음진행」 · 오늘의 1분 성장 2단계 · 선릉역점부터)
 *   보고서 「2단계. 체육관으로」: 앱 카드는 평일 하루 17명, 체육관에는 43명 — 같은 글을 TV 로도 만나게.
 *   · 그날 글의 코너 · 제목 · 한 줄 · 오늘 하나. 사이니지에는 퀴즈를 올리지 않는다(같은 날 대표님 「사이니지에 퀴즈는 올리지마」)
 *     — 화요일 O/X 날도 문제 · O · X · '정답' 없이 같은 모양(코너는 「복싱 상식」), 문제는 앱 홈 카드에만.
 *   · 날짜는 쓰지 않는다 — 바로 위 TV 머리에 날짜 · 시각이 있다(같은 숫자는 한 화면에 한 번).
 *   · 번들에 든 글로만 그린다(서버를 부르지 않는다 — 통신이 끊겨도 나온다). 글자는 28px 이상 · 움직임은 나타날 때 페이드 한 번.
 *   · 자리는 LiveBoardSideSlot — 플리스 사전예약이 열린 동안은 플리스 안내만(11/17 13시 대표님 「폴리스집업 그대로」), 끝나면 이 칸이 이어받는다.
 *   글 · 계산은 src/lib/growthStage2.ts (tvGrowthOf).
 */
import { Sprout } from "lucide-react";
import type { TvGrowth } from "@/lib/growthStage2";
import { cn } from "@/lib/utils";

const LiveBoardGrowthCard = ({ model }: { model: TvGrowth }) => {
  // 긴 제목은 한 단계 작게 — 다섯 줄 안에 들어오게 (지금 달 파일 제목은 18자 안)
  const long = [...model.headline].length > 26;
  return (
    <aside
      aria-label="오늘의 1분 성장"
      className="flex min-h-0 w-full flex-col border-l border-gray-800/60 bg-gradient-to-b from-gray-900 via-gray-900/90 to-black px-8 pb-7 pt-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
          <Sprout className="h-7 w-7" aria-hidden />
        </span>
        <span className="text-[28px] font-black leading-none text-emerald-300">오늘의 1분 성장</span>
        {model.corner && (
          <span className="ml-auto shrink-0 rounded-full bg-white px-4 py-1.5 text-[28px] font-black leading-none text-gray-900">{model.corner}</span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
        {/* 줄 간격은 크기 뒤에 — cn(tailwind-merge)은 뒤에 오는 글씨 크기가 앞의 leading 을 지운다 */}
        <h2 className={cn("break-keep font-black text-white", long ? "text-[56px]" : "text-[68px]", "leading-[1.2]")}>{model.headline}</h2>
        {model.sub && <p className="mt-6 break-keep text-[34px] font-bold leading-snug text-gray-300">{model.sub}</p>}
      </div>

      {model.actionTitle && (
        <div className="rounded-3xl bg-white/[0.06] px-6 py-5 ring-1 ring-inset ring-white/10">
          <p className="text-[28px] font-black leading-none text-emerald-300">오늘 하나</p>
          <p className="mt-3 break-keep text-[40px] font-black leading-tight text-white">{model.actionTitle}</p>
          {model.actionBody && (
            <p className="mt-2 break-keep text-[28px] font-bold leading-snug text-gray-300">{model.actionBody}</p>
          )}
        </div>
      )}

      <p className="mt-6 rounded-2xl bg-emerald-400/15 px-4 py-3.5 text-center text-[32px] font-black leading-tight text-emerald-200">{model.foot}</p>
    </aside>
  );
};

export default LiveBoardGrowthCard;
