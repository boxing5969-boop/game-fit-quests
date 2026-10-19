/**
 * 🤖 AI 에 개인 정보를 보내기 전 동의 (2026-10-19 — App Store 심사 5.1.2(i):
 *    개인 정보를 외부 AI 에 보낼 때는 어디로 가는지 알리고, 보내기 전에 분명히 동의를 받아야 한다).
 *
 * 쓰는 곳: 오삼코치 AI 답(ChatAssistant) · 식단 사진 칼로리 분석(useMealCalories).
 * 아이폰 앱(App Store)에서만 묻는다 — 웹·안드로이드는 개인정보처리방침의 국외 이전 안내 그대로 (기존 화면 유지).
 * 한 번 동의하면 그 계정·그 기기에서는 다시 묻지 않는다. 안 하면 그 기능만 쓰지 않는다(앱 사용법 답은 그대로).
 */
import { isIosApp } from "@/lib/iosApp";

const KEY = (uid: string) => `153ai:consent:${uid}`;

export const AI_CONSENT_TEXT =
  "AI 코치에게 물어보면 답을 만들기 위해 아래 정보가 AI 회사로 전송돼요.\n\n" +
  "· 보내는 것: 질문·식단 사진, 레벨·훈련 기록 같은 운동 정보\n" +
  "· 보내지 않는 것: 이름·전화번호·생년월일·결제 정보\n" +
  "· 받는 곳: Anthropic, Groq, Google (미국)\n\n" +
  "동의하고 AI 코치를 쓸까요? (설정 › 개인정보처리방침에서 자세히 볼 수 있어요)";

export function hasAiConsent(uid: string | null | undefined): boolean {
  if (!uid) return false;
  try {
    return window.localStorage.getItem(KEY(uid)) === "1";
  } catch {
    return false;
  }
}

/** 동의가 필요하면 물어본다 — 써도 되면 true */
export function ensureAiConsent(uid: string | null | undefined): boolean {
  if (!isIosApp()) return true;
  if (!uid) return false;
  if (hasAiConsent(uid)) return true;
  const ok = window.confirm(AI_CONSENT_TEXT);
  if (ok) {
    try {
      window.localStorage.setItem(KEY(uid), "1");
    } catch {
      /* 저장이 안 되면 다음에 한 번 더 묻는다 */
    }
  }
  return ok;
}
