/**
 * 7일 스타터 캠프 — 튜토리얼 글로벌 오버라이드 RPC 래퍼.
 *
 * 관리자가 publish 한 step_overrides / step_order / custom_steps 를
 * 모든 회원이 fetch 해서 일관된 튜토리얼을 보게 한다.
 *
 * 보호 원칙: 공식 1~40 / wallet / XP 변경 0.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TutorialCampStep } from "@/features/tutorial-camp/tutorialCampSteps";
import type { TutorialStepOverridePartial } from "@/features/tutorial-camp/tutorialCampSteps";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

export interface TutorialGlobalOverridesPayload {
  step_overrides: Record<string, TutorialStepOverridePartial>;
  step_order: Record<string, number[]>;
  custom_steps: Record<string, TutorialCampStep[]>;
}

export interface TutorialGlobalOverridesRow
  extends TutorialGlobalOverridesPayload {
  updated_at: string;
}

export async function fetchTutorialGlobalOverrides(): Promise<TutorialGlobalOverridesRow | null> {
  const { data, error } = await sbRpc<TutorialGlobalOverridesRow[]>(
    "get_tutorial_global_overrides",
  );
  if (error) {
    // 마이그레이션 미반영 / 네트워크 오류 — 조용히 null (앱은 base + local 만 사용).
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    step_overrides: (row.step_overrides ?? {}) as Record<
      string,
      TutorialStepOverridePartial
    >,
    step_order: (row.step_order ?? {}) as Record<string, number[]>,
    custom_steps: (row.custom_steps ?? {}) as Record<string, TutorialCampStep[]>,
    updated_at: row.updated_at,
  };
}

export interface PublishResult {
  success: boolean;
  updated_at: string;
  message: string;
}

export async function publishTutorialGlobalOverrides(
  payload: TutorialGlobalOverridesPayload,
): Promise<PublishResult> {
  const { data, error } = await sbRpc<PublishResult[]>(
    "publish_tutorial_global_overrides",
    { p_payload: payload },
  );
  if (error) {
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.success !== true) {
    throw new Error("전체 회원 반영에 실패했습니다.");
  }
  return row;
}
