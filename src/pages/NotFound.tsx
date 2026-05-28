import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

/**
 * 404 — 라우터 catch-all.
 *
 * OAuth 안전망:
 *   Google/Apple/Microsoft 로그인 후 OAuth broker 가 우리 origin 으로 돌려보낼 때
 *   broker 가 잡아둔 redirect path 가 우리 라우터에 없으면 여기로 떨어진다.
 *   URL 의 query/hash 에 OAuth 흔적 (`code`, `state`, `access_token`, `error`) 이
 *   있으면 → query/hash 를 보존한 채 root (LoginPage) 로 즉시 redirect.
 *   Supabase JS 의 detectSessionInUrl 이 root 진입 시 자동으로 토큰을 파싱.
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
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash,
    );
    return OAUTH_PARAMS.some((k) => search.has(k) || hash.has(k));
  } catch {
    return false;
  }
}

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // OAuth callback 으로 잘못 도착한 케이스 — root 로 즉시 redirect
    if (hasOAuthParams()) {
      setRedirecting(true);
      // search + hash 그대로 보존 (Supabase JS 가 자동 처리)
      const dest = `/${window.location.search}${window.location.hash}`;
      // history replace — 뒤로가기 시 404 페이지로 안 돌아오게
      window.location.replace(dest);
      return;
    }

    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">로그인 처리 중…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-primary underline hover:text-primary/90"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default NotFound;
