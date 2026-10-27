/**
 * 글씨 크기 — 작게 · 보통 · 크게 (2026-10-28 대표님 "위보고한 기준대로 전면 리디자인하자" · UX 보고서 결정 4번 '글씨 크게 보기' 2단계)
 *
 * 회원 화면 글씨는 153 글씨 6단계(text-micro … text-display)가 모두 rem 이라, 앱 바탕 글씨 크기(html font-size) 하나로
 * 앱 전체가 같은 비율로 커지고 작아진다 (여백 · 단추도 rem 이라 함께 — 카카오톡 '글자 크기'처럼).
 *   · 기기마다 저장(localStorage) — 휴대폰을 바꾸면 다시 고른다
 *   · 퍼센트로 정해 휴대폰 · 브라우저의 기본 글씨 설정을 그대로 따른다 (보통 = 100%)
 *   · 체육관 TV · 키오스크 화면(isSignageRoute)은 바꾸지 않는다 — 회원 폰 설정과 상관없이 늘 같은 크기
 */
import { isSignageRoute } from "@/lib/displayMode";

export type TextScale = "sm" | "md" | "lg";

const KEY = "153.textScale";

/** 바탕 글씨 크기 — 보통 16px 기준 작게 15 · 크게 18 */
export const TEXT_SCALE_PERCENT: Record<TextScale, string> = { sm: "93.75%", md: "100%", lg: "112.5%" };

export const TEXT_SCALE_OPTIONS: { value: TextScale; label: string }[] = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
];

export function readTextScale(): TextScale {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "sm" || v === "lg" ? v : "md";
  } catch {
    return "md";
  }
}

/** html 글씨 크기에 반영 — 보통이면 비워 둔다(브라우저 기본) */
export function applyTextScale(scale: TextScale, pathname: string = window.location.pathname): void {
  const root = document.documentElement;
  if (scale === "md" || isSignageRoute(pathname)) root.style.removeProperty("font-size");
  else root.style.fontSize = TEXT_SCALE_PERCENT[scale];
}

export function saveTextScale(scale: TextScale): void {
  try {
    if (scale === "md") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, scale);
  } catch {
    /* 저장 못 해도 이번 화면에는 바로 반영한다 */
  }
  applyTextScale(scale);
}
