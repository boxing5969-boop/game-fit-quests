/**
 * 로그인 뒤 원래 가려던 곳으로 (2026-09-28).
 *
 * 라이브보드 QR 을 폰 기본 카메라로 찍으면 https://myboxer153.com/qr-checkin?b=..&t=.. 가 브라우저로 열린다.
 * 그 브라우저에 로그인이 안 돼 있으면 로그인 화면으로 가는데, 예전엔 로그인하고 나면 홈으로만 가서
 * 출석이 안 됐다("QR 인식이 안 된다"로 보였다). 로그인 전 주소를 이 탭(sessionStorage)에 잠깐 적어 두고,
 * 로그인이 끝나면 그 주소로 보낸다.
 *
 * 안전: 허용 목록(/qr-checkin)만, 10분 안에만. 다른 주소는 적지도 읽지도 않는다(열린 리다이렉트 방지).
 */
const KEY = "153_post_login_redirect";
const TTL_MS = 10 * 60_000;
const ALLOWED = [/^\/qr-checkin(\?[^#]*)?$/];

const allowed = (path: string) => ALLOWED.some((re) => re.test(path));

/** 로그인 화면으로 보내기 전에 호출 — 허용된 주소만 적는다 */
export function rememberPostLoginPath(pathWithSearch: string): void {
  if (!allowed(pathWithSearch)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ p: pathWithSearch, at: Date.now() }));
  } catch {
    /* 저장소가 막힌 브라우저 — 예전처럼 홈으로 간다 */
  }
}

/**
 * 로그인 직후 갈 곳 — 읽기만 한다(지우지 않는다). 없거나 오래됐거나 허용 밖이면 null.
 * 비밀번호 로그인(LoginPage)과 소셜 로그인 복귀("/" → RoleBasedRedirect)가 서로 먼저 읽어도 같은 곳으로 가도록
 * 지우는 건 도착한 화면(QrCheckinPage)이 clearPostLoginPath() 로 한다.
 */
export function peekPostLoginPath(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { p?: unknown; at?: unknown };
    if (typeof v.p !== "string" || typeof v.at !== "number" || Date.now() - v.at > TTL_MS || !allowed(v.p)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return v.p;
  } catch {
    return null;
  }
}

/** 원래 가려던 화면에 도착했으면 지운다 */
export function clearPostLoginPath(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
