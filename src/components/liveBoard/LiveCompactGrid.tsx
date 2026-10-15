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
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";

import LiveActiveMemberCard, { type LiveActiveMember } from "./LiveActiveMemberCard";

const ROTATE_INTERVAL_MS = 15_000;
/** 카드를 그리는 기본 폭 — 예전 '작은 카드' 크기 */
const BASE_W = 300;
/** 카드 폭 최대·최소 (TV 1920×1080 기준 px) */
const MAX_W = 560;
const MIN_W = 250;
const GAP = 10;
const MAX_COLS = 8;
/** 카드 높이를 아직 못 쟀을 때 쓰는 값 (기본 폭 300 일 때 작은 카드 높이) */
const FALLBACK_H = 116;

export interface LiveCompactGridProps {
  members: LiveActiveMember[];
  getElapsedMinutes: (startedAt: number) => number;
  showForceExit?: boolean;
  onForceExit?: (sessionId: string, name: string) => void;
}

interface Layout {
  cols: number;
  rows: number;
  scale: number;
  pageSize: number;
}

/** 남은 공간(w×h)에 n명을 넣는 가장 큰 배치. 최소 크기보다 작아지면 최소 크기로 한 화면씩 */
export function computeGridLayout(n: number, w: number, h: number, cardH: number): Layout {
  const baseH = cardH > 0 ? cardH : FALLBACK_H;
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rows: 1, scale: 1, pageSize: Math.max(1, n) };
  const maxScale = MAX_W / BASE_W;
  const minScale = MIN_W / BASE_W;
  let best: Layout | null = null;
  for (let cols = 1; cols <= Math.min(MAX_COLS, n); cols++) {
    const rows = Math.ceil(n / cols);
    const byW = (w - GAP * (cols - 1)) / cols / BASE_W;
    const byH = (h - GAP * (rows - 1)) / rows / baseH;
    const scale = Math.min(byW, byH, maxScale);
    // 더 크면 바꾸고, 크기가 같으면(최대 크기에 걸린 경우 등) 줄이 적은 쪽 — 가로로 넓게
    if (!best || scale > best.scale * 1.005 || (scale >= best.scale * 0.995 && rows < best.rows)) {
      best = { cols, rows, scale, pageSize: n };
    }
  }
  if (best && best.scale >= minScale) return best;
  // 최소 크기로도 다 안 들어감 → 최소 크기로 한 화면에 들어가는 만큼씩 넘긴다
  const cols = Math.max(1, Math.min(MAX_COLS, Math.floor((w + GAP) / (MIN_W + GAP))));
  const rows = Math.max(1, Math.floor((h + GAP) / (baseH * minScale + GAP)));
  return { cols, rows, scale: minScale, pageSize: Math.max(1, cols * rows) };
}

const LiveCompactGrid = ({ members, getElapsedMinutes, showForceExit, onForceExit }: LiveCompactGridProps) => {
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

  const layout = useMemo(() => computeGridLayout(totalCount, area.w, area.h, cardH), [totalCount, area.w, area.h, cardH]);
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
        <Users className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-black uppercase tracking-wider text-emerald-300">
          함께 운동 중 ({totalCount})
        </h3>
        {shouldRotate && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === pageIndex ? "w-4 bg-emerald-400" : "w-1 bg-emerald-400/30"}`}
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
              {currentPage.map((m) => (
                <div key={m.user_id} style={{ width: cellW }}>
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
