/**
 * 라이브보드 TV 2번 「수상자 축하」 한 줄 (2026-11-18 대표님 「현재 시상식 있잖아 그건 한줄로 작게 만들어주고」)
 *   11/17 「수상자 축하」 한 장(LaunchAwardsBoard)을 맨 위 금색 한 줄로 접었다 — 그 자리는 「마이복서153 가치 전달」(AppValueReel).
 *   [트로피] 런칭 이벤트 1위 · 출석왕 ○○ · 앱 활동왕 ○○ · 좋아요왕 ○○ … 1위께 153 마일리지 50,000점 · 받았어요
 *   이름이 먼저 — 오른쪽 혜택 글은 들어가는 것 중 가장 긴 글(긴 글 → 짧은 글 → 없음), 그래도 길면 이름 끝을 … 으로. 글자는 28px.
 *   글은 src/lib/appValueReel.ts(awardsStripOf) — 숫자 · 이름은 서버(board_launch_awards) 값 그대로.
 */
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";

import type { AwardsStrip } from "@/lib/appValueReel";

const PRIZE = "shrink-0 whitespace-nowrap text-[28px] font-black leading-none";

const LaunchAwardsStrip = ({ strip }: { strip: AwardsStrip }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const namesRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef<HTMLSpanElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  /** 보이는 혜택 글 번호 — -1 = 없음 */
  const [pick, setPick] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const names = namesRef.current;
    const measure = measureRef.current;
    if (!box || !names || !measure) return;
    const check = () => {
      // 혜택 글이 없을 때 이름 칸이 쓰는 너비 = 지금 이름 칸 + 지금 혜택 글(+ 사이 간격)
      const shown = shownRef.current;
      const room = names.clientWidth + (shown ? shown.offsetWidth + 16 : 0) - names.scrollWidth;
      const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth + 16);
      const next = widths.findIndex((w) => w <= room);
      setPick(next);
    };
    check();
    let alive = true;
    // 글꼴이 늦게 오면 너비가 바뀐다 — 한 번 더 잰다
    document.fonts?.ready?.then(() => alive && check()).catch(() => {});
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    ro?.observe(box);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [strip]);

  const prize = pick >= 0 ? strip.prizes[pick] : null;
  return (
    <div
      ref={boxRef}
      role="note"
      aria-label="런칭 이벤트 1위 축하"
      className="relative flex h-[54px] shrink-0 items-center gap-4 overflow-hidden rounded-2xl border border-yellow-400/50 bg-gradient-to-r from-yellow-500/25 via-yellow-500/10 to-yellow-500/[0.03] px-5 animate-in fade-in duration-700"
    >
      <Trophy className="h-8 w-8 shrink-0 text-yellow-300" />
      <span className="shrink-0 text-[28px] font-black leading-none text-yellow-200">{strip.label}</span>
      <span ref={namesRef} className="min-w-0 flex-1 truncate text-[28px] font-bold leading-none text-white">
        {strip.winners.map((w, i) => (
          <Fragment key={`${w.throne}-${i}`}>
            {i > 0 && <span className="px-2 text-yellow-300/70">·</span>}
            <span className="text-yellow-100/80">{w.throne}</span> <span className="font-black">{w.name}</span>
          </Fragment>
        ))}
      </span>
      {prize && (
        <span ref={shownRef} className={`${PRIZE} text-yellow-200`}>
          {prize}
        </span>
      )}
      {/* 너비 재기용 — 보이지 않는다 */}
      <span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex">
        {strip.prizes.map((p) => (
          <span key={p} className={PRIZE}>
            {p}
          </span>
        ))}
      </span>
    </div>
  );
};

export default LaunchAwardsStrip;
