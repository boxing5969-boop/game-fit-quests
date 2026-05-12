/**
 * 7일 스타터 캠프 — 글로벌 튜토리얼 오버라이드 부팅 hook.
 *
 * 앱 마운트 시 1회 fetch → setGlobalTutorialOverrides 로 module-level 캐시 주입.
 * 인증 불필요 (GRANT EXECUTE TO anon, authenticated) — splash 전이라도 OK.
 *
 * 보호 원칙: 공식 1~40 / wallet 변경 0. 실패 시 base + local 만 사용.
 */

import { useEffect } from "react";
import { setGlobalTutorialOverrides } from "@/features/tutorial-camp/tutorialCampSteps";
import { fetchTutorialGlobalOverrides } from "@/services/tutorialGlobalOverridesService";

let inFlight = false;

export function useTutorialGlobalOverridesBoot(): void {
  useEffect(() => {
    if (inFlight) return;
    inFlight = true;

    fetchTutorialGlobalOverrides()
      .then((row) => {
        if (!row) return;
        setGlobalTutorialOverrides({
          step_overrides: row.step_overrides,
          step_order: row.step_order,
          custom_steps: row.custom_steps,
        });
      })
      .catch(() => {
        // 네트워크/RPC 실패 — 조용히 무시. base + local 만 사용.
      })
      .finally(() => {
        inFlight = false;
      });
  }, []);
}
