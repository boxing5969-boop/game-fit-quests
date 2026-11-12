/**
 * 🎞️ 붕대 감기 12단계 설명서 — 한눈에 12칸 + 완성 → 누르면 상세(실제 영상 | 그림 + 자세한 설명) → 한 단계씩 따라 하기.
 *
 *   2026-10-27 대표님: "한눈에 처음부터 끝까지 설명서처럼 · 누르면 상세페이지처럼 · 움직이는 사진으로 · 한 단계씩" (9단계 · 실제 영상 장면)
 *   2026-10-30 대표님: 코팅 설명서 사진 "이사진이랑 동일하게 붕대 감기 탭에 고화질 애니메이션으로 제작해서 넣어줘"
 *     → 설명서와 같은 12단계 + 완성. 단계마다 깨끗한 그림 손에 붕대가 차례로 감기는 애니메이션.
 *       시작(초록 점) · 끝(주황 점) · 바퀴 수 · 손바닥 쪽 길(남색 점선) · '손가락 사이로 넣어요' 같은 표시는 그림 안에 들어 있다.
 *     → 손마다 따로 만든 그림(오른손 기본 · 왼손) — 거울로 뒤집지 않는다(글자가 바르게).
 *   2026-11-12 대표님: "내가 찍어 논 영상도 나오게 · 현재 있는 메뉴얼도 있게" → 한눈에 보기는 그림 그대로(순서가 한눈에 읽힌다),
 *     칸을 누르면 그 단계를 실제 영상 · 그림으로 바꿔 보는 상세(HandWrapStepDetail)가 열린다.
 *     상세 열고 닫기(주소 ?step=N)는 화면(HandWrapGuidePage)이 쥔다 — 전체 영상 칸에서도 같은 상세를 연다.
 *
 *   한눈에: 3칸 × 4줄 + 완성(넓게) — 끝 장면 작은 그림(손 쪽으로 정사각형) + 번호 · 제목 · 짧은 설명.
 *   글 · 그림 주소는 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { Play } from "lucide-react";
import { HANDWRAP_NUMBERED_STEPS, HANDWRAP_STEPS, handWrapStepLabel, mirrorArrows } from "@/data/handWrapGuide";
import { setHandWrapHand, useHandWrapPrefs } from "@/hooks/useHandWrapPrefs";
import { cn } from "@/lib/utils";
import { HandChips, Legend } from "./HandWrapParts";

interface Props {
  /** 칸을 누르면 그 단계 상세를 연다 (0부터) */
  onOpen: (i: number) => void;
  className?: string;
}

const HandWrapStepViewer = ({ onOpen, className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const { hand } = useHandWrapPrefs();
  const txt = (t: string) => (hand === "left" ? mirrorArrows(t) : t);

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      <div className="border-b border-border/60 px-3 py-2.5">
        <HandChips hand={hand} setHand={setHandWrapHand} />
      </div>

      {/* 한눈에 12칸 + 완성 */}
      <ol className="grid grid-cols-3 gap-x-2 gap-y-3.5 px-3 pb-2 pt-3" aria-label={`붕대 감기 ${HANDWRAP_NUMBERED_STEPS}단계 — 누르면 자세히`}>
        {steps.map((s, i) => (
          <li key={s.media.right.clip} className={cn("min-w-0", s.final && "col-span-3")}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`${handWrapStepLabel(i)} ${s.title} — 자세히 보기`}
              className={cn("group block w-full text-left", s.final && "flex items-center gap-3 rounded-2xl bg-secondary/60 p-2")}
            >
              <span
                className={cn(
                  "relative block aspect-square overflow-hidden rounded-xl bg-[#EAF0F3] ring-1 ring-border/70 transition-transform group-active:scale-[0.97]",
                  s.final && "w-[38%] shrink-0",
                )}
              >
                <img src={s.media[hand].thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span
                  className={cn(
                    "absolute left-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-label font-black tabular-nums shadow",
                    s.final ? "bg-[#F97316] text-white" : "bg-primary text-primary-foreground",
                  )}
                >
                  {s.final ? "완성" : i + 1}
                </span>
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55">
                  <Play className="ml-px h-2.5 w-2.5 fill-white text-white" aria-hidden />
                </span>
              </span>
              <span className={cn("block min-w-0", s.final ? "flex-1" : "mt-1.5")}>
                <span className="block text-label font-black leading-snug text-foreground">{s.title}</span>
                {/* 짧은 글은 두 줄까지 — 나머지는 누르면 상세에 */}
                <span className="mt-0.5 line-clamp-2 text-label leading-snug text-muted-foreground">{txt(s.short)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-label font-black text-background transition-transform active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden /> 1단계부터 한 단계씩 따라 하기
        </button>
        <Legend className="mt-2 justify-center" />
      </div>
    </div>
  );
};

export default HandWrapStepViewer;
