/**
 * 앱 안 화면끼리 주고받는 작은 신호 (2026-09-23).
 *
 * 아이디·비밀번호 변경 창(CredentialChangePrompt)은 App 에 한 번만 떠 있고 "나중에" 를 누르면 그 세션 동안 닫힌다.
 * 닉네임 좋아요처럼 "처음 받은 아이디·비밀번호를 바꿔야 쓸 수 있는" 화면에서 다시 열 때 이 신호를 보낸다.
 */
export const OPEN_CREDENTIAL_CHANGE_EVENT = "153:open-credential-change";

export const openCredentialChange = (): void => {
  try {
    window.dispatchEvent(new Event(OPEN_CREDENTIAL_CHANGE_EVENT));
  } catch {
    /* SSR·구형 브라우저 — 무시 */
  }
};
