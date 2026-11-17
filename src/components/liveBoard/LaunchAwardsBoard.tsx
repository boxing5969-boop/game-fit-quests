/**
 * 라이브보드 TV 2번 「수상자 축하」 (2026-11-17 대표님 「적용해」 · 보고서 https://claude.ai/artifact/3Sh1bLdd7x5LwCwJAh9Jqr)
 *
 * 끝난 런칭 이벤트 자리(화면 왼쪽 2/3, 가로 약 1280px)를 한 장으로 — 돌아가지 않는다(켤 때 한 번 페이드).
 *   ① 금빛 띠: 축하합니다! 런칭 이벤트 왕좌 n명 · 1위께 153 마일리지 50,000점(같은 숫자는 여기 한 번)
 *   ② 수상자 카드 3장: 왕좌 · 받았어요(받기 전이면 '드릴 예정') · 앱 캐릭터(사진 없음) · 이름 · 기록 · 2위 · 3위
 *   ③ 증거와 내 마일리지: 40일 동안 레벨업 · 운동으로 쌓인 마일리지 → 회원님 마일리지도 쌓이고 있어요 → 오면 +300 → …
 *   ④ QR 하나: 내 마일리지 보기(내 정보의 153 마일리지 칸)
 *   맨 아래: 사람의 한마디 · 서명 「153 건강과 행복. 153복싱짐」
 *
 * 글씨는 28px 아래로 줄이지 않는다. 칸이 낮으면(아래 띠 5줄인 날) 얼굴 인식 안내 줄과 한마디 아랫줄(코치진)을 접는다.
 * 2위 · 3위는 한 줄에 한 명(이름이 길면 그 줄만 … — 2~4m 거리에서 '2위 ○○'가 한눈에).
 * 글 · 숫자는 모두 launchAwards.ts(서버 값) — 이 파일은 그리기만.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, ChevronRight, Crown, Trophy } from "lucide-react";

import CharacterSprite from "@/components/CharacterSprite";
import type { AwardCardView, AwardsView } from "@/lib/launchAwards";

/** 안쪽 높이(px, 위아래 여백 뺀 값)가 이보다 낮으면 안내 줄 · 한마디 아랫줄을 접는다.
 *  2026-11-17 1920×1080 실측: 아래 띠 4줄(오늘 다녀간 회원 · 코치 · 랭킹 · 명예의 전당) = 637px → 모두 그림,
 *  153 RECORD 띠까지 5줄 = 578px → 접음. 모두 그리면 카드 한 장 ≈ 270px(캐릭터 · 이름 · 기록 · 2위 · 3위가 들어가는 높이). */
export const AWARDS_COMPACT_BELOW = 600;

const NAME_CLASS: Record<AwardCardView["nameSize"], string> = {
  48: "text-[48px] leading-[1.05]",
  40: "text-[40px] leading-[1.08]",
  34: "text-[34px] leading-[1.12] line-clamp-2",
};

/** 2위 · 3위 한 줄 높이(28px × 1.15) + 여유 — 칸이 이만큼 남으면 다시 두 줄로 */
const OTHERS_LINE_PX = 36;

/** 카드 — 칸이 모자라면(이름이 두 줄인 날 · 아래 띠가 많은 날) 2위 · 3위를 한 줄로 합치고, 칸이 넉넉해지면 다시 나눈다 */
const AwardCard = ({ card }: { card: AwardCardView }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [tight, setTight] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    const body = bodyRef.current;
    if (!el || !body) return;
    const check = () => {
      const cs = getComputedStyle(el);
      const avail =
        el.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
      const need = body.offsetHeight;
      setTight((t) =>
        t ? (need + OTHERS_LINE_PX <= avail ? false : true) : need > avail + 1,
      );
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  const others =
    tight && card.others.length > 1 ? [card.others.join(" · ")] : card.others;

  return (
    <div
      ref={ref}
      data-award={card.category}
      data-tight={tight ? "1" : undefined}
      className="flex min-h-0 flex-col justify-center overflow-hidden rounded-2xl border border-yellow-600/40 bg-gradient-to-b from-yellow-950/50 via-gray-900/80 to-gray-900/90 px-5 py-3 [justify-content:safe_center]"
    >
      <div ref={bodyRef} className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Crown className="h-8 w-8 flex-shrink-0 text-yellow-400" />
            <span className="truncate text-[32px] font-black leading-none text-yellow-300">
              {card.throne}
            </span>
          </div>
          {card.paid ? (
            <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3.5 py-1.5 text-[28px] font-black leading-none text-emerald-200">
              <Check className="h-6 w-6" strokeWidth={3} />
              {card.chip}
            </span>
          ) : (
            <span className="flex-shrink-0 rounded-full border border-yellow-500/50 px-3.5 py-1.5 text-[28px] font-bold leading-none text-yellow-100/90">
              {card.chip}
            </span>
          )}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-4">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center">
            {card.character?.parts ? (
              <CharacterSprite
                partsJson={card.character.parts as never}
                size="md"
                animate={false}
                league={card.character.league ?? undefined}
                level={card.character.level ?? undefined}
                auraMode="compact"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-500/60 bg-yellow-500/15">
                <Trophy className="h-10 w-10 text-yellow-300" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`font-black text-white [overflow-wrap:anywhere] ${NAME_CLASS[card.nameSize]}`}
            >
              {card.name}
            </p>
            <p className="text-[30px] font-bold leading-[1.15] tabular-nums text-gray-200">
              {card.record}
            </p>
          </div>
        </div>

        {others.length > 0 && (
          <div className="mt-2">
            {others.map((line) => (
              <p
                key={line}
                className="truncate text-[28px] font-bold leading-[1.15] text-gray-400"
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface Props {
  view: AwardsView;
}

const LaunchAwardsBoard = ({ view }: Props) => {
  const ref = useRef<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.height < AWARDS_COMPACT_BELOW),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-label="런칭 이벤트 수상자 축하"
      className="flex h-full min-h-0 flex-col gap-3 px-6 py-3 animate-in fade-in duration-700"
    >
      {/* ① 금빛 띠 */}
      <div className="flex flex-shrink-0 items-center justify-between gap-6 rounded-2xl border border-yellow-400/60 bg-gradient-to-r from-yellow-500/30 via-yellow-500/10 to-yellow-500/5 px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <Trophy className="h-12 w-12 flex-shrink-0 text-yellow-300" />
          <h2 className="truncate text-[48px] font-black leading-none text-white">
            {view.title}
          </h2>
        </div>
        <p className="flex-shrink-0 text-[28px] font-black text-yellow-200">
          {view.prizeLine}
        </p>
      </div>

      {/* ② 수상자 카드 */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${view.cards.length === 1 ? "grid-cols-1" : view.cards.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {view.cards.map((c) => (
          <AwardCard key={c.category} card={c} />
        ))}
      </div>

      {/* ③ 증거 → 내 마일리지 · ④ QR */}
      {view.band ? (
        <div className="flex flex-shrink-0 items-center gap-6 rounded-2xl border border-primary/40 bg-gray-900/80 px-6 py-3">
          <div className="min-w-0 flex-1">
            {view.evidence && (
              <p className="truncate text-[28px] font-bold leading-tight text-gray-300">
                {view.evidence}
              </p>
            )}
            <p className="mt-1 truncate text-[40px] font-black leading-tight text-white">
              {view.band.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              {view.band.steps.map((s, i) => (
                <span key={s} className="flex items-center gap-2.5">
                  {i > 0 && (
                    <ChevronRight
                      className="h-7 w-7 flex-shrink-0 text-primary"
                      strokeWidth={3}
                    />
                  )}
                  <span className="rounded-xl border border-primary/50 bg-primary/10 px-4 py-1.5 text-[30px] font-black leading-tight text-white">
                    {s}
                  </span>
                </span>
              ))}
            </div>
            {!compact && (
              <p className="mt-1.5 truncate text-[28px] font-bold leading-tight text-gray-400">
                {view.band.note}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 rounded-2xl bg-white p-2.5">
            <QRCodeSVG value={view.qrUrl} size={120} level="M" marginSize={0} />
            <p className="pr-1 text-[28px] font-black leading-tight text-gray-900">
              {view.qrCaption[0]}
              <br />
              {view.qrCaption[1]}
            </p>
          </div>
        </div>
      ) : (
        view.evidence && (
          <p className="flex-shrink-0 truncate text-center text-[28px] font-bold text-gray-300">
            {view.evidence}
          </p>
        )
      )}

      {/* 사람의 한마디 · 서명 */}
      <div className="flex flex-shrink-0 items-center justify-between gap-6">
        <p className="min-w-0 flex-1 text-[28px] font-bold leading-tight text-gray-200 line-clamp-2">
          {view.quote}
        </p>
        <div className="flex-shrink-0 text-right">
          {!compact && (
            <p className="text-[28px] font-bold leading-tight text-gray-400">
              {view.byline}
            </p>
          )}
          <p className="text-[28px] font-black leading-tight text-yellow-300">
            {view.signature}
          </p>
        </div>
      </div>
    </section>
  );
};

export default LaunchAwardsBoard;
