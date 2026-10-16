/**
 * 붕대 감기 단계 사진 + 감는 방향 화살표 (2026-10-15 대표님: "손 모양이 너무 AI 티가 나 — 사진 기준으로, 방향과 애니메이션 잘").
 *
 *   · 사진 위에 SVG(viewBox 0 0 120 98)를 겹친다 — 사진과 같은 비율이라 좌표가 그대로 맞는다.
 *   · 단계가 바뀌면: 사진이 살짝 커지며 나타나고 → 화살표가 시작점에서 끝까지 그려지고 →
 *     빛나는 점이 감는 길을 따라 계속 흐른다. 시작점(흰 점)·들어갈 곳(원)은 숨 쉬듯 깜빡인다.
 *   · 다른 손 = 사진과 화살표를 함께 좌우로 뒤집는다 (그림은 오른손 — data/handWrapGuide.ts HANDWRAP_PHOTO_HAND).
 *   · '움직임 줄이기'를 켠 폰에서는 멈춘 화살표만 보인다.
 */
import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WrapArrow } from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

const ORANGE = "#FF7A1A";

interface Props {
  photo: string;
  arrow?: WrapArrow | null;
  /** 그림과 다른 손 — 좌우 반전 */
  mirrored?: boolean;
  /** 큰 화면은 true, 한눈에 보기 썸네일은 false (멈춘 화살표) */
  animate?: boolean;
  /** 바뀔 때 다시 그리기 위한 키 (단계 번호) */
  stepKey?: string | number;
  alt: string;
  className?: string;
}

const HandWrapPhoto = ({ photo, arrow, mirrored, animate = true, stepKey, alt, className }: Props) => {
  const reduce = useReducedMotion();
  const live = animate && !reduce;
  const uid = useId().replace(/:/g, "");
  const markerId = `hw-arrow-${uid}`;
  const pathId = `hw-path-${uid}`;
  const hasTarget = !!arrow?.tr && arrow.tx != null && arrow.ty != null;

  return (
    <div className={cn("relative aspect-[120/98] w-full overflow-hidden bg-[#EEF4F2]", className)}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={stepKey ?? photo}
          className="absolute inset-0"
          initial={live ? { opacity: 0, scale: 1.04 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={live ? { opacity: 0 } : undefined}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* 다른 손 = 사진·화살표 함께 뒤집기 (움직임은 바깥 motion.div 가 맡는다) */}
          <div className="absolute inset-0" style={mirrored ? { transform: "scaleX(-1)" } : undefined}>
          <img src={photo} alt={alt} draggable={false} className="h-full w-full select-none object-cover" />

          {arrow && (
            <svg
              viewBox="0 0 120 98"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <defs>
                <marker id={markerId} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill={ORANGE} stroke="#FFFFFF" strokeWidth="1.2" />
                </marker>
              </defs>

              {/* 들어갈 곳 — 숨 쉬는 원 */}
              {hasTarget && (
                <g>
                  {live && (
                    <motion.circle
                      cx={arrow.tx}
                      cy={arrow.ty}
                      r={arrow.tr}
                      fill="none"
                      stroke={ORANGE}
                      strokeWidth={1.2}
                      initial={{ opacity: 0.9, scale: 1 }}
                      animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.7, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    />
                  )}
                  <circle cx={arrow.tx} cy={arrow.ty} r={arrow.tr} fill="rgba(255,122,26,0.18)" stroke="#FFFFFF" strokeWidth={1.4} strokeDasharray="2.5 2" />
                </g>
              )}

              {/* 감는 길 — 흰 테두리 + 주황 선, 시작점에서 끝까지 그려진다 */}
              <path id={pathId} d={arrow.d} fill="none" stroke="none" />
              <motion.path
                d={arrow.d}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={4.6}
                strokeLinecap="round"
                initial={live ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.85, ease: "easeInOut", delay: 0.15 }}
              />
              <motion.path
                d={arrow.d}
                fill="none"
                stroke={ORANGE}
                strokeWidth={2.6}
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
                initial={live ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.85, ease: "easeInOut", delay: 0.15 }}
              />

              {/* 감는 방향으로 흐르는 빛 */}
              {live && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
                  <circle r={2.4} fill="#FFFFFF" opacity={0.95}>
                    <animateMotion dur="1.6s" repeatCount="indefinite" begin="1s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                  <circle r={4.4} fill={ORANGE} opacity={0.35}>
                    <animateMotion dur="1.6s" repeatCount="indefinite" begin="1s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </motion.g>
              )}

              {/* 시작점 */}
              {live && (
                <motion.circle
                  cx={arrow.sx}
                  cy={arrow.sy}
                  r={3.2}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  animate={{ opacity: [0.9, 0, 0.9], scale: [1, 2, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              )}
              <circle cx={arrow.sx} cy={arrow.sy} r={3.2} fill="#FFFFFF" stroke={ORANGE} strokeWidth={1.4} />
            </svg>
          )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default HandWrapPhoto;
