/**
 * 🔔 알림함에서 연 화면 → 뒤로가기 = 다시 알림함 (화면에 아무것도 그리지 않는다 · 2026-11-19).
 *
 *   · 뒤로가기(popstate)가 알림함 칸을 건너뛰고 더 아래로 떨어지면 → 알림함을 다시 연다.
 *     실제 브라우저는 듣는 함수 사이마다 React 가 화면을 그린다 → 라우터가 먼저 들으면 떨어진 화면(홈)이
 *     먼저 그려지고 그 화면 효과까지 돈다(한 작업 안이라 화면에 칠해지지는 않는다 · 크로미움 시험 2026-11-19).
 *     그래서 아래 '화면이 바뀔 때' 효과가 그 순간 기록을 지우지 않고 비켜 주고, 이 듣는 함수가 늦게 돌아도 옮긴다.
 *     capture 로 듣는다 — 같은 window 에서 capture 를 먼저 부르는 브라우저는 떨어진 화면을 그리기 전에 옮긴다
 *     (크롬 153 은 등록 순서대로 불렀다 — 어느 쪽이든 결과는 알림함).
 *   · 크롬처럼 알림함에 바로 떨어지면 아무것도 안 한다.
 *   · 화면이 바뀔 때마다 지금 칸의 번호를 적고, 알림함보다 더 아래로 가면(알림함에서 뒤로 · 다른 길) 기록을 지운다.
 * 규칙 · 기록은 lib/inboxReturn. App 의 Routes 앞에 하나만.
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import {
  INBOX_PATH,
  clearInboxReturn,
  historyIdx,
  lastInboxLocation,
  moveInboxReturn,
  noteInboxLocation,
  readInboxReturn,
  shouldReturnToInbox,
} from "@/lib/inboxReturn";

const InboxReturnBridge = ({ disabled = false }: { disabled?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  // 뒤로가기 — 라우터보다 먼저 부르는 브라우저도, 나중에 부르는 브라우저도 있다(위 설명)
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;
    const onPop = (e: PopStateEvent) => {
      if (e.state == null) return; // 조각(#) 이동 — 뒤로가기가 아니다
      const r = readInboxReturn();
      const next = historyIdx(e.state);
      if (!shouldReturnToInbox(r, lastInboxLocation(), next)) return;
      try {
        navRef.current(INBOX_PATH);
      } catch {
        return;
      }
      const at = historyIdx();
      if (r && at != null) moveInboxReturn(r, at);
      noteInboxLocation(at);
    };
    window.addEventListener("popstate", onPop, { capture: true });
    return () => window.removeEventListener("popstate", onPop, { capture: true });
  }, [disabled]);

  // 화면이 바뀔 때마다 — 지금 칸 번호 적기 · 다 쓴 기록 지우기
  useEffect(() => {
    if (disabled) return;
    const idx = historyIdx();
    const r = readInboxReturn();
    if (r && idx != null) {
      const atInbox = location.pathname === INBOX_PATH;
      // 알림함을 건너뛴 뒤로가기인데 아직 안 옮겼다(듣는 순서가 옛 브라우저) → 기록 · 칸 번호는 popstate 쪽이 쓴다
      if (navType === "POP" && !atInbox && shouldReturnToInbox(r, lastInboxLocation(), idx)) return;
      if (navType === "POP" ? idx < r.inbox : idx <= r.inbox && !atInbox) clearInboxReturn();
    }
    noteInboxLocation(idx);
  }, [location.key, location.pathname, navType, disabled]);

  return null;
};

export default InboxReturnBridge;
