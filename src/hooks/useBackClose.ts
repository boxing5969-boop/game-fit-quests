/**
 * 뒤로가기 = 창 닫기 — open 인 동안 휴대폰 뒤로가기(안드로이드 단추 · 아이폰 앱 밀기)가 이 창을 닫는다.
 * 원리 · 주의는 lib/backClose 에. 창을 단추로 닫으면 얹었던 기록 칸도 저절로 걷는다.
 *
 * 2026-11-17 대표님 「훈련탭에서 영상 클릭후 뒤로가기버튼 누르면 홈화면으로 나가져서 불편해」
 *
 * 쓰는 법: 창이 보일 때 true — 늘 그려 두는 창은 useBackClose(!!item, close),
 *   보일 때만 그려지는 창은 그 안에서 useBackClose(true, onClose).
 *   onClose 는 화면마다 매번 새로 만들어져도 된다(ref 로 든다). 기록 칸은 open 이 바뀔 때만 얹고 걷는다.
 *
 * 쓰던 글이 있는 창도 손해가 없다 — 예전엔 뒤로가기가 화면째 떠나서 글이 사라졌고, 이제는 창만 닫힌다.
 * 종료 확인 창처럼 뒤로가기로 열리는 창에는 쓰지 않는다.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { closeBackLayer, openBackLayer } from "@/lib/backClose";

export function useBackClose(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // 칸은 그리기 직후(useLayoutEffect)에 얹는다 — 안쪽 화면이 열리며 맨 위로 올리기(scrollTo) 전에 얹어야
  // 브라우저가 지금 스크롤 자리를 바닥 칸에 기억해 두고, 뒤로가기로 돌아올 때 그 자리로 되돌려 준다
  useLayoutEffect(() => {
    if (!open) return;
    let alive = true;
    let id = 0;
    const onBack = () => {
      id = 0;
      closeRef.current();
      // 닫기를 불러도 창이 그대로인 경우(내 수업 재생 → 끝 화면 등) — 한 박자 뒤에도 열려 있으면 칸을 다시 얹는다
      setTimeout(() => {
        if (alive && id === 0) id = openBackLayer(onBack);
      }, 0);
    };
    id = openBackLayer(onBack);
    return () => {
      alive = false;
      closeBackLayer(id);
    };
  }, [open]);
}
