/**
 * 7일 스타터 캠프 — dev panel 접근 조건 (단계 46).
 *
 * 일반 회원에게 노출되지 않도록 다음 조건 중 하나일 때만 통과:
 *   1. hostname === localhost / 127.0.0.1 / *.local
 *   2. URL query ?tutorialDev=1 (한 번 통과하면 localStorage 토글 ON)
 *   3. localStorage `myboxer.tutorialCamp.dev.enabled` === "true"
 *   4. (단계 64-C) 관리자 계정 — role 이 admin / super_admin / branch_manager
 *
 * BottomNav / 메뉴 0 변경. role 은 호출자가 전달 (AuthContext) — 본 모듈은
 * Supabase 직접 조회 0.
 */

const DEV_TOGGLE_KEY = "myboxer.tutorialCamp.dev.enabled";
const PREVIEW_PROFILE_KEY = "myboxer.tutorialCamp.dev.previewProfileId";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function readQueryToggle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("tutorialDev") === "1";
  } catch {
    return false;
  }
}

function readStorageToggle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEV_TOGGLE_KEY) === "true";
  } catch {
    return false;
  }
}

/** 관리자 계정 role 인지 — admin / super_admin / branch_manager */
export function isAdminPreviewRole(
  role: string | null | undefined,
): boolean {
  return (
    role === "admin" ||
    role === "super_admin" ||
    role === "branch_manager"
  );
}

/**
 * dev panel 노출 여부 결정.
 * 한 번 query 로 통과하면 localStorage 토글을 ON 으로 저장 — 페이지 이동 후에도 유지.
 *
 * @param role  AuthContext 의 role — 관리자면 자동 통과 (단계 64-C).
 */
export function shouldShowDevPanel(
  role?: string | null,
): boolean {
  if (typeof window === "undefined") return false;

  if (isLocalhost()) return true;

  if (readQueryToggle()) {
    try {
      window.localStorage.setItem(DEV_TOGGLE_KEY, "true");
    } catch {
      // ignore — query 만으로도 본 호출에서는 true 반환
    }
    return true;
  }

  if (isAdminPreviewRole(role)) return true;

  return readStorageToggle();
}

/** dev 토글 직접 ON */
export function enableDevToggle(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_TOGGLE_KEY, "true");
  } catch {
    // ignore
  }
}

/** dev 토글 OFF + previewProfileId 정리 */
export function disableDevToggle(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEV_TOGGLE_KEY);
    window.localStorage.removeItem(PREVIEW_PROFILE_KEY);
  } catch {
    // ignore
  }
}

/** previewProfileId — cosmetic 라벨. 서버 user_id 와 무관. */
export function getPreviewProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PREVIEW_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPreviewProfileId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = id.trim();
    if (trimmed) {
      window.localStorage.setItem(PREVIEW_PROFILE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(PREVIEW_PROFILE_KEY);
    }
  } catch {
    // ignore
  }
}

/** clipboard 복사 — secure context 미지원 시 textarea fallback */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  // 1. 모던 API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough
  }
  // 2. 레거시 textarea fallback
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-1000px";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
