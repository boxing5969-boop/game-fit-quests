/**
 * 153 스토리 RPG — 캐릭터 포트레이트 (Stage 47A).
 *
 * 8 캐릭터 × 3+ 감정. 모두 inline SVG. 외부 이미지 / 외부 IP 0.
 *
 * 마이복서153 자체 IP:
 *   · 오삼이 = 빨간 글러브 머리 마스코트
 *   · 강 관장 / 박 선배 / 민지 / 도훈 / 김 코치 / 한 챔피언 = 자체 캐릭터
 *   · 플레이어 = 회원 본인 (route 별 컬러)
 */

import { useEffect, useRef, useState } from "react";
import {
  PORTRAIT_PALETTE,
  SPEAKER_DEFAULT_EMOTION,
  type PortraitEmotion,
  type PortraitKey,
} from "./portraitData";
import { useMouthOpen } from "./MouthSync";

export interface CharacterPortraitProps {
  portraitKey: PortraitKey;
  emotion?: PortraitEmotion;
  talking?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_PX: Record<NonNullable<CharacterPortraitProps["size"]>, number> = {
  sm: 80,
  md: 130,
  lg: 200,
};

function useBlink(): boolean {
  const [closed, setClosed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const wait = 3500 + Math.random() * 2000;
      timer.current = setTimeout(() => {
        if (cancelled) return;
        setClosed(true);
        timer.current = setTimeout(() => {
          if (cancelled) return;
          setClosed(false);
          loop();
        }, 130);
      }, wait);
    };
    loop();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return closed;
}

const CharacterPortrait = ({
  portraitKey,
  emotion,
  talking = false,
  size = "md",
  className = "",
}: CharacterPortraitProps) => {
  const px = SIZE_PX[size];
  const finalEmotion: PortraitEmotion =
    emotion ?? SPEAKER_DEFAULT_EMOTION[portraitKey] ?? "default";
  const palette = PORTRAIT_PALETTE[portraitKey];
  const mouthOpen = useMouthOpen(talking);
  const blinkClosed = useBlink();

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{ width: px, height: px * 1.2, background: palette.bg }}
    >
      <svg
        viewBox="0 0 200 240"
        width={px}
        height={px * 1.2}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={`bg-${portraitKey}`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor={palette.bg} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
          </radialGradient>
        </defs>
        <rect width="200" height="240" fill={`url(#bg-${portraitKey})`} />

        {portraitKey === "osam" ? (
          <OsamFace
            palette={palette}
            emotion={finalEmotion}
            mouthOpen={mouthOpen}
            blinkClosed={blinkClosed}
          />
        ) : (
          <HumanFace
            portraitKey={portraitKey}
            palette={palette}
            emotion={finalEmotion}
            mouthOpen={mouthOpen}
            blinkClosed={blinkClosed}
          />
        )}
      </svg>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// 오삼이 — 빨간 글러브 머리 마스코트
// ──────────────────────────────────────────────────────────────────
function OsamFace({
  palette,
  emotion,
  mouthOpen,
  blinkClosed,
}: {
  palette: typeof PORTRAIT_PALETTE["osam"];
  emotion: PortraitEmotion;
  mouthOpen: boolean;
  blinkClosed: boolean;
}) {
  const isHappy = emotion === "happy";
  const isConcerned = emotion === "concerned";

  return (
    <g>
      {/* 글러브 머리 */}
      <ellipse cx="100" cy="115" rx="74" ry="80" fill={palette.hair} />
      <ellipse cx="100" cy="115" rx="74" ry="80" fill="none" stroke="#7a0e1a" strokeWidth="3" />
      {/* 글러브 끈 */}
      <path d="M 70 165 Q 100 175 130 165" stroke="#fef3c7" strokeWidth="3" fill="none" />
      <circle cx="100" cy="170" r="3" fill="#fef3c7" />

      {/* 눈썹 — 감정별 (오삼이는 글러브 머리지만 양 눈 위에 표현 가능) */}
      <g style={{ transition: "opacity 200ms" }}>
        {emotion === "angry" ? (
          <>
            <path d="M 65 92 L 90 86" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
            <path d="M 135 92 L 110 86" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          </>
        ) : emotion === "concerned" || emotion === "serious" ? (
          <>
            <path d="M 70 90 L 90 95" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
            <path d="M 130 95 L 110 90" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : isHappy ? (
          <>
            <path d="M 67 92 Q 77 86 87 92" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 113 92 Q 123 86 133 92" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : null}
      </g>

      {/* 눈 */}
      <g style={{ transform: blinkClosed ? "scaleY(0.05)" : "scaleY(1)", transformOrigin: "100px 110px", transition: "transform 80ms" }}>
        {isHappy ? (
          <>
            <path d="M 65 110 Q 75 100 85 110" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 115 110 Q 125 100 135 110" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="75" cy="110" rx="6" ry="8" fill="#1a1a1a" />
            <ellipse cx="125" cy="110" rx="6" ry="8" fill="#1a1a1a" />
            <circle cx="73" cy="107" r="2" fill="#fff" />
            <circle cx="123" cy="107" r="2" fill="#fff" />
          </>
        )}
      </g>

      {/* 입 */}
      {isConcerned ? (
        <ellipse cx="100" cy="138" rx={mouthOpen ? "5" : "4"} ry={mouthOpen ? "5" : "3"} fill="#1a1a1a" />
      ) : isHappy ? (
        <path
          d={
            mouthOpen
              ? "M 80 130 Q 100 152 120 130 L 120 138 Q 100 155 80 138 Z"
              : "M 80 132 Q 100 145 120 132"
          }
          fill={mouthOpen ? "#5c0a14" : "none"}
          stroke="#1a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={
            mouthOpen
              ? "M 88 134 L 112 134 L 110 142 L 90 142 Z"
              : "M 88 138 L 112 138"
          }
          fill={mouthOpen ? "#5c0a14" : "none"}
          stroke="#1a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {/* 글러브 머리 오른쪽 그림자 */}
      <ellipse cx="155" cy="135" rx="22" ry="50" fill="#000" opacity="0.18" />

      {/* 광택 */}
      <ellipse cx="80" cy="80" rx="12" ry="10" fill="#fff" opacity="0.18" />
    </g>
  );
}

// ──────────────────────────────────────────────────────────────────
// 사람 NPC 공통 — portraitKey 별 색/머리 차이
// ──────────────────────────────────────────────────────────────────
function HumanFace({
  portraitKey,
  palette,
  emotion,
  mouthOpen,
  blinkClosed,
}: {
  portraitKey: PortraitKey;
  palette: PortraitPaletteShape;
  emotion: PortraitEmotion;
  mouthOpen: boolean;
  blinkClosed: boolean;
}) {
  const browAngry = emotion === "angry" || emotion === "serious" || emotion === "focused";
  const browWorry = emotion === "concerned" || emotion === "hurt";
  const isHappy = emotion === "happy" || emotion === "warm";
  const isSmug = emotion === "smug";

  return (
    <g>
      {/* 어깨 / 옷 */}
      <path d="M 20 240 L 20 195 Q 100 170 180 195 L 180 240 Z" fill={palette.outfit} />
      <path d="M 60 195 L 100 175 L 140 195" stroke={palette.accent} strokeWidth="2" fill="none" />
      {/* 어깨 그림자 (오른쪽) */}
      <path d="M 165 200 Q 175 210 178 235 L 180 240 L 150 240 Q 158 220 162 205 Z" fill="#000" opacity="0.18" />

      {/* 머리 (실루엣) */}
      <PortraitHair portraitKey={portraitKey} palette={palette} />

      {/* 얼굴 */}
      <ellipse cx="100" cy="105" rx="48" ry="58" fill={palette.skin} />
      <ellipse cx="100" cy="105" rx="48" ry="58" fill="none" stroke="#000" strokeOpacity="0.15" strokeWidth="2" />
      {/* 얼굴 오른쪽 그림자 (얼굴 외곽 가까이만 — 눈/입 덮지 않음) */}
      <ellipse cx="145" cy="120" rx="10" ry="40" fill="#000" opacity="0.18" />

      {/* 눈썹 — 감정별 (200ms transition) */}
      <g style={{ transition: "opacity 200ms" }}>
        {emotion === "angry" ? (
          <>
            <path d="M 63 90 L 90 84" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
            <path d="M 137 90 L 110 84" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          </>
        ) : browAngry ? (
          <>
            <path d="M 65 88 L 88 95" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
            <path d="M 135 88 L 112 95" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : browWorry ? (
          <>
            <path d="M 65 92 Q 76 86 88 92" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 112 92 Q 124 86 135 92" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : isHappy ? (
          <>
            <path d="M 65 90 Q 76 84 88 90" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 112 90 Q 124 84 135 90" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M 65 88 L 88 88" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
            <path d="M 112 88 L 135 88" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
          </>
        )}
      </g>

      {/* 눈 */}
      <g
        style={{
          transform: blinkClosed ? "scaleY(0.05)" : "scaleY(1)",
          transformOrigin: "100px 105px",
          transition: "transform 80ms",
        }}
      >
        {isHappy ? (
          <>
            <path d="M 70 105 Q 78 98 86 105" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 114 105 Q 122 98 130 105" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : isSmug ? (
          <>
            <path d="M 68 108 L 88 102" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 112 102 L 132 108" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="78" cy="105" rx="2" ry="3" fill="#1a1a1a" />
            <ellipse cx="122" cy="105" rx="2" ry="3" fill="#1a1a1a" />
          </>
        ) : (
          <>
            <ellipse cx="78" cy="105" rx="4" ry="6" fill="#1a1a1a" />
            <ellipse cx="122" cy="105" rx="4" ry="6" fill="#1a1a1a" />
            <circle cx="76" cy="103" r="1.5" fill="#fff" />
            <circle cx="120" cy="103" r="1.5" fill="#fff" />
          </>
        )}
      </g>

      {/* 코 */}
      <path d="M 100 110 L 96 128 L 104 128 Z" fill="#000" fillOpacity="0.08" />

      {/* 입 */}
      {emotion === "concerned" || emotion === "hurt" ? (
        <path
          d={mouthOpen ? "M 88 142 Q 100 132 112 142" : "M 88 142 Q 100 138 112 142"}
          fill="none"
          stroke="#7a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : isHappy ? (
        <path
          d={
            mouthOpen
              ? "M 82 138 Q 100 158 118 138 L 118 144 Q 100 160 82 144 Z"
              : "M 82 140 Q 100 152 118 140"
          }
          fill={mouthOpen ? "#5c1a1a" : "none"}
          stroke="#7a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : isSmug ? (
        <path
          d={
            mouthOpen
              ? "M 82 142 Q 100 152 118 138"
              : "M 82 144 Q 100 148 118 138"
          }
          fill="none"
          stroke="#7a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={
            mouthOpen
              ? "M 88 140 L 112 140 L 110 148 L 90 148 Z"
              : "M 88 144 L 112 144"
          }
          fill={mouthOpen ? "#5c1a1a" : "none"}
          stroke="#7a1a1a"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {/* 챔피언 벨트 (한 챔피언만) */}
      {portraitKey === "han_champion" && (
        <>
          <rect x="35" y="208" width="130" height="14" fill="#fdb85c" rx="4" />
          <circle cx="100" cy="215" r="6" fill="#a40e1a" stroke="#fdb85c" strokeWidth="2" />
          <text x="96" y="218" fontSize="6" fontWeight="bold" fill="#fdb85c">CH</text>
        </>
      )}
    </g>
  );
}

type PortraitPaletteShape = (typeof PORTRAIT_PALETTE)[PortraitKey];

// ──────────────────────────────────────────────────────────────────
// 캐릭터별 머리 실루엣
// ──────────────────────────────────────────────────────────────────
function PortraitHair({
  portraitKey,
  palette,
}: {
  portraitKey: PortraitKey;
  palette: PortraitPaletteShape;
}) {
  switch (portraitKey) {
    case "gwan":
      // 짧은 회색 — 마스터 글러브 어깨
      return (
        <>
          <path d="M 50 80 Q 100 38 150 80 L 150 100 Q 100 70 50 100 Z" fill={palette.hair} />
          <path d="M 70 70 Q 100 55 130 70" stroke="#000" strokeOpacity="0.2" strokeWidth="1" fill="none" />
        </>
      );
    case "park_senior":
      // 길게 묶음 + 헤드밴드
      return (
        <>
          <path d="M 48 75 Q 100 30 152 75 L 152 110 Q 130 88 100 88 Q 70 88 48 110 Z" fill={palette.hair} />
          <rect x="55" y="80" width="90" height="6" fill={palette.accent} rx="2" />
          {/* 묶은 꼬리 */}
          <path d="M 145 105 Q 165 145 152 200 L 138 200 Q 138 150 132 110" fill={palette.hair} />
        </>
      );
    case "minji":
      // 단발
      return (
        <>
          <path d="M 50 75 Q 100 35 150 75 L 152 130 Q 140 105 130 110 Q 130 145 105 138 Q 80 145 70 110 Q 60 105 48 130 Z" fill={palette.hair} />
        </>
      );
    case "dohun":
      // 짧은 머리 + 스파이키
      return (
        <>
          <path d="M 50 90 Q 60 50 80 70 L 90 45 L 102 70 L 115 50 L 130 70 L 140 45 L 152 90 L 150 100 Q 100 75 50 100 Z" fill={palette.hair} />
        </>
      );
    case "kim_coach":
      // 중년 — 머리 갈라짐 + 안경
      return (
        <>
          <path d="M 52 80 Q 100 45 148 80 L 148 100 Q 100 78 52 100 Z" fill={palette.hair} />
          <rect x="62" y="100" width="32" height="14" rx="6" fill="none" stroke="#1a1a1a" strokeWidth="2" />
          <rect x="106" y="100" width="32" height="14" rx="6" fill="none" stroke="#1a1a1a" strokeWidth="2" />
          <line x1="94" y1="107" x2="106" y2="107" stroke="#1a1a1a" strokeWidth="2" />
        </>
      );
    case "han_champion":
      // 긴 머리 + 헤어밴드
      return (
        <>
          <path d="M 42 90 Q 100 25 158 90 L 158 165 Q 130 110 100 105 Q 70 110 42 165 Z" fill={palette.hair} />
          <rect x="50" y="78" width="100" height="5" fill={palette.accent} rx="2" />
        </>
      );
    case "player":
      // 회원 본인 — 헤드 + 글러브
      return (
        <>
          <path d="M 52 80 Q 100 42 148 80 L 148 105 Q 100 80 52 105 Z" fill={palette.hair} />
          {/* 한쪽 글러브 (어깨 위로) */}
          <ellipse cx="40" cy="200" rx="22" ry="20" fill={palette.outfit} />
        </>
      );
    default:
      return <path d="M 50 80 Q 100 40 150 80 L 150 100 Q 100 70 50 100 Z" fill={palette.hair} />;
  }
}

export default CharacterPortrait;
