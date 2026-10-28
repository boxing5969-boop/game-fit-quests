/**
 * 153 — 라이브보드 하단 컴팩트 그리드 (Cinematic).
 *
 * 스포트라이트 무대 아래, 운동 중인 회원 전체를 라이센스 카드로 한눈에.
 *
 * 자동 크기 (2026-10-16 대표님: "사람이 없으면 크게 채우고, 많으면 작게 — 빈 공간 최소화, 최대·최소 크기는 정해서")
 *   · 남은 화면(아래 띠 위까지)을 재서, 인원이 다 들어가는 가장 큰 카드 크기와 칸×줄을 고른다.
 *   · 카드 폭 최대 MAX_W(560px) — 사람이 적어도 이보다 크게는 안 키우고 가운데로 모은다.
 *   · 카드 폭 최소 MIN_W(250px) — 이보다 작아져야 하면 그 크기로 한 화면(최대 7칸×6줄=42명 정도)씩 15초마다 넘긴다.
 *   · 카드는 기본 크기(BASE_W)로 그린 뒤 같은 비율로 키우고 줄인다(zoom) — 사진·캐릭터·닉네임·리그·메달이 함께 커진다.
 *   · 화면 크기가 바뀌거나 사람이 들어오고 나가면 다시 계산한다.
 *   기획안: claude.ai 문서 '라이브보드 카드 자동 크기 기획안'
 *
 * 떠 있는 카드 피하기 (2026-10-28 리디자인 3단계 — TV 글씨를 키우며 1번 화면 우하단 QR 카드가 커졌다)
 *   · avoid(선택자)로 준 떠 있는 카드(1번 화면 QR 출석 카드)가 카드 자리 오른쪽 아래를 덮으면, 그 구석에 걸리는 칸은 비운다.
 *   · 비운 칸만큼 자리가 줄어든 것으로 계산해 카드 크기 · 칸 × 줄을 고른다 (예전엔 사람이 많으면 QR 카드 뒤에 회원 카드가 숨었다).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";

import LiveActiveMemberCard, { type LiveActiveMember } from "./LiveActiveMemberCard";
import { BASE_W, GAP, computeGridLayout, type Reserve } from "@/lib/liveGridLayout";

const ROTATE_INTERVAL_MS = 15_000;

export interface LiveCompactGridProps {
  members: LiveActiveMember[];
  getElapsedMinutes: (startedAt: number) => number;
  showForceExit?: boolean;
  onForceExit?: (sessionId: string, name: string) => void;
  /** 피할 떠 있는 카드 (CSS 선택자) — 1번 화면 QR 출석 카드 */
  avoid?: string;
}

const LiveCompactGrid = ({ members, getElapsedMinutes, showForceExit, onForceExit, avoid }: LiveCompactGridProps) => {
  const totalCount = members.length;
  const hasMembers = totalCount > 0;

  // 남은 공간과 카드 기본 높이를 잰다
  const areaRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [cardH, setCardH] = useState(0);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = probeRef.current;
    if (!el) return;
    const measure = () => {
      const hh = el.offsetHeight;
      if (hh > 0) setCardH((prev) => (Math.abs(prev - hh) > 1 ? hh : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasMembers]);

  // 떠 있는 카드가 카드 자리 오른쪽 아래를 얼마나 덮나 — 카드가 늦게 뜨거나 크기가 바뀌어도 따라가게 2초마다 다시 잰다
  const [reserve, setReserve] = useState<Reserve | null>(null);
  useLayoutEffect(() => {
    if (!avoid) return;
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(avoid);
      const a = el.getBoundingClientRect();
      const t = target?.getBoundingClientRect();
      const w = t ? Math.round(a.right - t.left + GAP) : 0;
      const h = t ? Math.round(a.bottom - t.top + GAP) : 0;
      setReserve((prev) => {
        if (w <= GAP || h <= GAP) return prev ? null : prev;
        return prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2 ? prev : { w, h };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const timer = window.setInterval(measure, 2000);
    return () => {
      ro.disconnect();
      window.clearInterval(timer);
    };
  }, [avoid]);

  const layout = useMemo(
    () => computeGridLayout(totalCount, area.w, area.h, cardH, reserve),
    [totalCount, area.w, area.h, cardH, reserve],
  );
  // 이 쪽에 들어갈 칸 — 비워 둘 칸은 건너뛴다
  const freeCells = useMemo(() => {
    const blocked = new Set(layout.blocked);
    const out: { r: number; c: number }[] = [];
    for (let i = 0; i < layout.cols * layout.rows; i++) if (!blocked.has(i)) out.push({ r: Math.floor(i / layout.cols), c: i % layout.cols });
    return out;
  }, [layout]);
  const totalPages = Math.max(1, Math.ceil(totalCount / layout.pageSize));
  const shouldRotate = totalPages > 1;

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      setPageIndex((p) => (p + 1) % totalPages);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [totalPages]);

  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);

  const currentPage = shouldRotate
    ? members.slice(pageIndex * layout.pageSize, (pageIndex + 1) * layout.pageSize)
    : members;

  if (totalCount === 0) return null;

  const cellW = Math.floor(BASE_W * layout.scale);
  // 카드가 크면(예전 '중간' 카드 이상) 지점장 퇴장 버튼도 보인다
  const big = layout.scale >= 1.4;

  return (
    <div className="mt-2 flex min-h-0 w-full flex-1 flex-col">
      {/* 헤더 */}
      <div className="mb-2 flex flex-shrink-0 items-center gap-2">
        <Users className="h-6 w-6 text-emerald-400" />
        <h3 className="text-tv-label font-black text-emerald-300">
          함께 운동 중
        </h3>
        {shouldRotate && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${i === pageIndex ? "w-6 bg-emerald-400" : "w-2 bg-emerald-400/30"}`}
              />
            ))}
          </div>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
      </div>

      {/* 카드 자리 — 아래 띠 위까지 늘어난다. 카드는 이 안에 절대 위치라 자리 크기에 영향을 주지 않는다 */}
      <div ref={areaRef} className="relative min-h-[160px] flex-1">
        {/* 카드 기본 높이 재기용 (안 보임) */}
        <div ref={probeRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0" style={{ width: BASE_W }}>
          <LiveActiveMemberCard member={members[0]} size="compact" elapsedMinutes={0} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 flex items-start justify-center"
          >
            <div
              className="grid"
              style={{ gap: GAP, gridTemplateColumns: `repeat(${layout.cols}, ${cellW}px)` }}
            >
              {currentPage.map((m, i) => (
                <div
                  key={m.user_id}
                  style={{
                    width: cellW,
                    // 비워 둘 칸이 있을 때만 자리를 정해 준다 (없으면 예전처럼 차례로)
                    ...(layout.blocked.length && freeCells[i] ? { gridRowStart: freeCells[i].r + 1, gridColumnStart: freeCells[i].c + 1 } : {}),
                  }}
                >
                  <div style={{ width: BASE_W, zoom: layout.scale } as React.CSSProperties}>
                    <LiveActiveMemberCard
                      member={m}
                      size="compact"
                      exitOnCompact
                      elapsedMinutes={getElapsedMinutes(m.startedAt)}
                      showForceExit={showForceExit && big}
                      onForceExit={onForceExit ? () => onForceExit(m.id, m.name) : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveCompactGrid;
