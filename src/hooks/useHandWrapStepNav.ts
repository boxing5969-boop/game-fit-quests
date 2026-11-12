/**
 * 🥊 붕대 감기 — 단계 상세 열고 닫기 (주소 ?step=N, 1부터 · 마지막 = 완성).
 *
 *   이 화면에서 눌러 연 상세는 '뒤로 가기'로 닫히고, 닫기(X)도 뒤로 가기와 같다(기록에 남은 한 칸을 거둔다).
 *   주소로 바로 들어온 상세(알림 · 공유 링크)는 닫을 때 주소에서 step 만 지운다.
 *   2026-11-12: 전체 영상 · 12단계 한눈에 · 완성 확인이 같은 상세를 열 수 있게 HandWrapStepViewer 에서 꺼냈다.
 */
import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HANDWRAP_STEPS, handWrapStepParam } from "@/data/handWrapGuide";

export interface HandWrapStepNav {
  /** 열린 단계 (0부터) — 닫혀 있으면 null */
  openIdx: number | null;
  open: (i: number) => void;
  go: (i: number) => void;
  close: () => void;
}

const withStep = (i: number | null) => (prev: URLSearchParams) => {
  const next = new URLSearchParams(prev);
  if (i == null) next.delete("step");
  else next.set("step", String(i + 1));
  return next;
};

export function useHandWrapStepNav(): HandWrapStepNav {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openIdx = handWrapStepParam(params.get("step"));
  /** 이 화면에서 눌러 연 상세면 닫을 때 뒤로 가기 */
  const pushedRef = useRef(false);

  const open = useCallback(
    (i: number) => {
      pushedRef.current = true;
      setParams(withStep(Math.min(HANDWRAP_STEPS.length - 1, Math.max(0, i))));
    },
    [setParams],
  );
  const go = useCallback(
    (i: number) => setParams(withStep(Math.min(HANDWRAP_STEPS.length - 1, Math.max(0, i))), { replace: true }),
    [setParams],
  );
  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      navigate(-1);
      return;
    }
    setParams(withStep(null), { replace: true });
  }, [navigate, setParams]);

  // 뒤로 가기로 닫혔으면 다음엔 다시 '눌러 연 것'부터
  useEffect(() => {
    if (openIdx == null) pushedRef.current = false;
  }, [openIdx]);

  return { openIdx, open, go, close };
}
