import type { SVGProps } from "react";

/**
 * BoxingGloveIcon — lucide 스타일(24x24, stroke 2, round caps) 복싱 글러브 선형 아이콘.
 * lucide-react 에 기본 제공이 없어 사내 아이콘 1개 추가.
 *
 * 사용처: BottomNav 훈련 탭. lucide 아이콘들(Home·Award·Trophy·Map)과
 * 시각 톤 통일을 위해 viewBox/stroke/linecap 을 동일 규격으로 맞춤.
 *
 * lucide 컴포넌트와 호환되는 prop 시그니처 — `size`·`strokeWidth` 수용.
 */
export interface BoxingGloveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: number | string;
  strokeWidth?: number | string;
}

export const BoxingGloveIcon = ({
  size = 24,
  strokeWidth = 2,
  ...props
}: BoxingGloveIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {/* 글러브 본체 — 주먹 쪽이 상단, 손목 쪽이 하단 */}
    <path d="M7 7a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v4a6 6 0 0 1-6 6h-1a4 4 0 0 1-4-4V7Z" />
    {/* 엄지 — 좌측 별도 돌출 */}
    <path d="M7 9c-1.6 0-3 1.3-3 3s1.4 3 3 3" />
    {/* 손목 밴드 — 하단 구분선 */}
    <path d="M9 17v2a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-2" />
    {/* 관절 라인 — 주먹 강조 */}
    <path d="M14 8v5" />
  </svg>
);

export default BoxingGloveIcon;
