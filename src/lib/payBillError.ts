/**
 * 결제 링크 만들기(payssam-create-bill) 오류 → 화면 말 (2026-11-20).
 *   서버는 막을 때 4xx 와 함께 {error: "…", code?: "…"} 를 준다. supabase-js 는 2xx 가 아니면 본문을 error.context 에 두고
 *   message 는 늘 영어('Edge Function returned a non-2xx status code')라, 예전 화면은 회원에게 그 영어를 보여 줬다.
 *   이제 서버가 쓴 말(마일리지 한도 · 시작일 범위 · 데스크 결제 지점 …)을 그대로 보여 준다.
 */
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

export interface PayBillError {
  message: string;
  /** 서버가 붙인 까닭 — "START_DATE" = 시작일이 고를 수 있는 날을 벗어남(남은 기간이 그사이 바뀜) */
  code: string | null;
}

const FALLBACK = "결제 링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.";

export async function payBillError(error: unknown): Promise<PayBillError> {
  if (error instanceof FunctionsFetchError) return { message: "인터넷 연결을 확인하고 다시 시도해 주세요.", code: null };
  if (error instanceof FunctionsHttpError) {
    const res = error.context instanceof Response ? error.context : null;
    const j = res ? ((await res.clone().json().catch(() => null)) as { error?: unknown; code?: unknown } | null) : null;
    const message = j && typeof j.error === "string" && j.error.trim() ? j.error.trim() : null;
    const code = j && typeof j.code === "string" && j.code ? j.code : null;
    if (message) return { message, code };
    if (res?.status === 401) return { message: "다시 로그인해 주세요.", code: null };
  }
  return { message: FALLBACK, code: null };
}
