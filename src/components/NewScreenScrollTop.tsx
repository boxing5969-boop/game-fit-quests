/**
 * 새 화면은 맨 위부터 (2026-11-19 선릉역점 회원 오류 신고 · 대표님 「이거진행」)
 *
 * 문제: 앱은 창(window) 하나로 스크롤하고 화면을 바꿀 때 주소만 바꾼다(SPA).
 *       그래서 새 화면이 앞 화면의 스크롤 위치에서 열렸다 — 홈 「오늘 우리 체육관」을 누르면
 *       커뮤니티가 홈에서 내려가 있던 만큼(피드가 짧으면 맨 밑) 내려간 채로 보였다.
 *       몇몇 화면(지점 안내 · 설문 · 153플레이 · 훈련 탭)은 화면마다 따로 맨 위로 올리고 있었다.
 *
 * 원리
 *   · 새 화면으로 갈 때(PUSH · REPLACE — 링크 · 단추 · 메뉴 · 하단 탭 · 알림)에 **경로가 바뀌면** 맨 위로.
 *   · 뒤로 가기 · 앞으로 가기(POP)는 손대지 않는다 — 브라우저가 보던 자리를 돌려준다.
 *   · 같은 화면에서 주소 뒷부분(?tab= · ?learn= · 알림 링크 정리)만 바뀌는 것은 그대로 — 탭 · 시트가 튀지 않게.
 *   · #조각이 있는 주소 · navigate(…, { state: KEEP_SCROLL_STATE }) (lib/newScreenScroll) 는 그대로.
 *   · App 의 Routes 보다 **앞에** 둔다 — 같은 순간 화면이 하는 스크롤(알림 링크로 그 칸까지 내려가기 등)이
 *     이것 다음에 돌아서 덮이지 않는다(React 는 앞 형제의 효과를 먼저 돌린다).
 * 시험: NewScreenScrollTop.test.tsx
 */
import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { keepsScroll } from "@/lib/newScreenScroll";

const NewScreenScrollTop = ({ disabled = false }: { disabled?: boolean }) => {
  const { pathname, hash, state } = useLocation();
  const navType = useNavigationType();
  const prev = useRef(pathname);

  useLayoutEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    if (disabled) return;
    if (navType === "POP") return;
    if (hash) return;
    if (keepsScroll(state)) return;
    try {
      window.scrollTo(0, 0);
    } catch {
      /* 옛 브라우저 · 시험 환경 — 못 올려도 화면은 그대로 쓸 수 있다 */
    }
  }, [pathname, hash, state, navType, disabled]);

  return null;
};

export default NewScreenScrollTop;
