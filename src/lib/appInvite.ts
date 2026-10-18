/**
 * 앱 초대 공유 (2026-10-18 대표님: "가입안한회원도 … 앱에 가입할수있도록 앱 공유 링크 초대 보낼수있도록").
 *
 * 공유 창(카톡·문자 등)을 바로 띄운다 — 브라우저가 '누른 순간'에만 열어 주므로 서버 기록을 기다리지 않는다.
 * 공유 창이 없으면 문구+링크를 복사한다. 초대받은 회원은 카카오로 시작하기 → 체육관에 등록한 전화번호로 기존 계정과 합쳐진다.
 */
export type InviteShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareAppInvite(inviteeName: string, inviterName: string): Promise<InviteShareResult> {
  const url = `${window.location.origin}/`;
  const text =
    `${inviteeName}님, 153복싱짐 앱 '마이복서153'에 초대해요!\n` +
    `출석·레벨·랭킹이 벌써 쌓여 있어요.\n` +
    `① 링크 열기 ② '카카오로 시작하기' ③ 체육관에 등록한 전화번호 넣기 — 끝!\n` +
    `— ${inviterName}`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: "마이복서153 초대", text, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // 공유 창을 못 열면 복사로
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
