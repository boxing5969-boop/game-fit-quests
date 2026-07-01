import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

/**
 * 404 — 라우터 catch-all + 자동 복귀.
 *
 * 정책: 어떤 미매칭 경로든 막다른 404 화면을 보여주지 않고 즉시 복귀시킨다.
 *   1) URL 에 OAuth 흔적(code/state/access_token 등)이 있으면 → root(LoginPage)로
 *      query/hash 를 보존한 채 replace (Supabase detectSessionInUrl 이 토큰 파싱).
 *   2) 그 외 알 수 없는 경로(결제 왕복·오래된 링크 등) → root("/")로 replace.
 *      root 는 로그인 상태면 역할별 홈으로, 아니면 로그인으로 보낸다.
 *   replace 를 쓰므로 뒤로가기로 404 로 다시 돌아오지 않는다.
 */
const OAUTH_PARAMS = [
  "code",
  "state",
  "access_token",
  "refresh_token",
  "provider_token",
  "id_token",
  "error",
  "error_code",
  "error_description",
] as const;

function hasOAuthParams(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
    );
    return OAUTH_PARAMS.some((k) => search.has(k) || hash.has(k));
  } catch {
    return false;
  }
}

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasOAuthParams()) {
      // OAuth callback 이 잘못 도착 — query/hash 보존한 채 root 로
      window.location.replace(`/${window.location.search}${window.location.hash}`);
      return;
    }
    console.error("404: 미존재 경로 접근 →", location.pathname, "→ 홈으로 자동 복귀");
    navigate("/", { replace: true });
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <p className="text-sm text-muted-foreground">이동 중…</p>
    </div>
  );
};

export default NotFound;
