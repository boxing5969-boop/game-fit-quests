/**
 * 창 뒤 페이지 스크롤 잠금 — 창이 여러 개 겹쳐도 마지막 창이 닫힐 때 한 번만 푼다.
 *
 * 2026-10-19 대표님: "지금운동중 회원카드 클릭후 밑으로 스크롤이 안됨"
 *   예전에는 창마다 '열 때 body overflow 값을 기억했다가 닫을 때 그 값으로 되돌리기'를 했다.
 *   '지금 운동 중' 전체화면 위에 회원 카드가 겹친 채 화면이 다시 그려지면, 전체화면이 '잠긴 상태(hidden)'를
 *   원래 값으로 잘못 기억해서 — 둘 다 닫은 뒤에도 hidden 이 남아 페이지가 아래로 안 내려갔다(새로고침 전까지).
 *   이제는 잠금 개수를 센다: 0 → 1 일 때 원래 값을 기억하고, 1 → 0 일 때만 되돌린다.
 *
 * 모든 창은 직접 document.body.style.overflow 를 만지지 말고 이 함수(또는 useModalDismiss)를 쓴다.
 */
let count = 0;
let saved = "";

/** 잠그고, 풀기 함수를 돌려준다. 풀기는 여러 번 불러도 한 번만 센다. */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;
  if (count === 0) {
    // 원래 값이 이미 hidden 이면 예전 방식이 남긴 잠금이다 — 다 닫을 때 풀리도록 '없음'으로 기억한다
    const cur = document.body.style.overflow;
    saved = cur === "hidden" ? "" : cur;
    document.body.style.overflow = "hidden";
  }
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    if (count === 0) document.body.style.overflow = saved;
  };
}

/** 테스트 전용 — 잠금 개수 */
export const __scrollLockCount = () => count;
