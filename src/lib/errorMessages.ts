/**
 * Supabase / 일반 에러 메시지 → 한국어 변환 유틸리티.
 *
 * 모든 에러 토스트·인라인 메시지에서 회원에게 영어 원문이 노출되지 않도록
 * 단일 출처에서 매핑 관리.
 *
 * 사용:
 *   import { translateAuthError } from "@/lib/errorMessages";
 *   toast.error(translateAuthError(err));
 *
 * 매칭 규칙:
 *   1. 정확히 일치 (대소문자 무시)
 *   2. 부분 포함 (영어 원문에 키워드 포함 시)
 *   3. 매칭 없으면 한국어 일반 안내 fallback ("문제가 발생했습니다 ...")
 */

/** Supabase Auth / 일반 에러 메시지 매핑 (소문자 키 ↔ 한국어). */
const AUTH_ERROR_MAP: ReadonlyArray<{ match: string; ko: string }> = [
  // 로그인 자격 — Supabase Auth
  {
    match: "invalid login credentials",
    ko: "아이디 또는 비밀번호가 올바르지 않습니다.",
  },
  {
    match: "invalid email or password",
    ko: "아이디 또는 비밀번호가 올바르지 않습니다.",
  },
  {
    match: "invalid credentials",
    ko: "아이디 또는 비밀번호가 올바르지 않습니다.",
  },

  // 가입 중복
  {
    match: "user already registered",
    ko: "이미 가입된 회원입니다.",
  },
  {
    match: "email already registered",
    ko: "이미 가입된 아이디입니다.",
  },
  {
    match: "already been registered",
    ko: "이미 가입된 아이디입니다.",
  },
  {
    match: "duplicate key value",
    ko: "이미 등록된 값입니다.",
  },

  // 비밀번호 정책
  {
    match: "password is known to be weak",
    ko: "보안에 취약한 비밀번호입니다. 다른 비밀번호를 사용해주세요.",
  },
  {
    match: "weak password",
    ko: "보안에 취약한 비밀번호입니다. 다른 비밀번호를 사용해주세요.",
  },
  {
    match: "password should be at least 6 characters",
    ko: "비밀번호는 6자 이상이어야 합니다.",
  },
  {
    match: "password must be at least",
    ko: "비밀번호 길이가 너무 짧습니다.",
  },
  {
    match: "password should contain",
    ko: "비밀번호 형식이 올바르지 않습니다.",
  },

  // 이메일 인증
  {
    match: "email not confirmed",
    ko: "이메일 인증이 완료되지 않았습니다. 받은 메일의 인증 링크를 확인해주세요.",
  },
  {
    match: "email link is invalid or has expired",
    ko: "인증 링크가 만료되었거나 유효하지 않습니다.",
  },

  // 사용자 / 세션
  {
    match: "user not found",
    ko: "회원 정보를 찾을 수 없습니다.",
  },
  {
    match: "session not found",
    ko: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
  },
  {
    match: "jwt expired",
    ko: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
  },
  {
    match: "not authenticated",
    ko: "로그인이 필요합니다.",
  },
  {
    match: "not_authenticated",
    ko: "로그인이 필요합니다.",
  },
  {
    match: "not authorized",
    ko: "권한이 없습니다.",
  },

  // 레이트 리미트
  {
    match: "too many requests",
    ko: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
  {
    match: "rate limit",
    ko: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },

  // 이메일 형식
  {
    match: "unable to validate email address",
    ko: "이메일 주소 형식이 올바르지 않습니다.",
  },
  {
    match: "invalid email",
    ko: "이메일 주소 형식이 올바르지 않습니다.",
  },

  // OAuth
  {
    match: "oauth",
    ko: "소셜 로그인 처리 중 문제가 발생했습니다. 다시 시도해주세요.",
  },

  // 네트워크 / 서버
  {
    match: "network error",
    ko: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
  },
  {
    match: "failed to fetch",
    ko: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
  },
  {
    match: "networkerror",
    ko: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
  },
  {
    match: "timeout",
    ko: "응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
  },
  {
    match: "service unavailable",
    ko: "서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.",
  },
  {
    match: "internal server error",
    ko: "서버에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
];

/** 한국어 일반 fallback. */
const GENERIC_KO_FALLBACK = "문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

/**
 * 어떤 형태의 에러든 안전하게 메시지 문자열을 추출.
 *   · Error 객체 → message
 *   · Supabase AuthError 등 { message, error_description } 형태 → 우선순위로 추출
 *   · string → 그대로
 *   · 그 외 → JSON 직렬화 시도, 실패 시 빈 문자열
 */
export function extractErrorMessage(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    if (typeof e.error_description === "string") return e.error_description;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
    try {
      return JSON.stringify(e);
    } catch {
      return "";
    }
  }
  return String(err);
}

/**
 * 영어 에러 메시지 → 한국어 변환.
 *
 * 회원에게 보여줄 메시지로 사용. 이미 한국어가 들어오면 그대로 반환
 * (단, 매핑 키워드가 영어로 섞여 있으면 우선 매칭).
 */
export function translateAuthError(
  err: unknown,
  fallback: string = GENERIC_KO_FALLBACK,
): string {
  const raw = extractErrorMessage(err).trim();
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  for (const { match, ko } of AUTH_ERROR_MAP) {
    if (lower.includes(match)) return ko;
  }

  // 한국어가 이미 포함된 경우 (한글 코드포인트 존재) 원문 그대로 노출.
  // 그렇지 않으면 영어 원문을 회원에게 보여주지 말고 fallback 으로.
  const hasKorean = /[가-힣]/.test(raw);
  return hasKorean ? raw : fallback;
}

/** 일반 에러용 — translateAuthError 와 동일 매핑 사용. 의미적 별칭. */
export const translateError = translateAuthError;
