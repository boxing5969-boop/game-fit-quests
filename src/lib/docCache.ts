/**
 * 뒤로가기 흰 화면 막기 — 화면 주소의 HTML 사본을 지금 배포 것으로 바꿔 둔다.
 * (2026-11-13 대표님 「마이복서153안에 옷확인하고 뒤로가기 누르면 흰색화면뜨고 마이복서 153으로 이동이안되」)
 *
 * 원인
 *   앱 밖 페이지(굿즈 상세 /goods/fleece · 결제선생 · 다른 사이트)로 나갔다가 뒤로가면, 브라우저는 돌아갈 주소
 *   (예: /home)의 HTML 을 캐시에서 **검증 없이** 꺼낸다 — Cloudflare 가 max-age=0 · must-revalidate 를
 *   보내도 그렇다(크로미움 · 삼성 인터넷, 2026-11-13 플레이라이트 CDP 로 확인: fromDiskCache=true).
 *   앱은 '/' 로 열려 화면 안에서 /home 으로 옮겨 가므로 /home 사본은 며칠 전 것일 수 있고, 그 사본이 부르는
 *   /assets/ 파일은 지금 배포에 없다(없는 파일은 index.html 로 답함) → 화면 파일을 못 받아 하얗게 멈춘다.
 *
 * 고침
 *   화면(주소)을 옮길 때마다 그 주소를 fetch(…, { cache: "reload" }) 로 한 번 받아 두면, 뒤로가기가 꺼내는
 *   그 캐시 칸이 지금 배포의 HTML 로 바뀐다(같은 칸을 덮는 것 확인 — 응답 date 가 fetch 때 것).
 *   앱 밖으로 나가기 직전에는 받아 둔 뒤 나간다(leaveApp). 그래도 그 사이에 배포가 끼면
 *   index.html 의 복구 스크립트가 화면 파일을 못 받은 순간 한 번 새로 받는다.
 */
import { isSignageRoute } from "@/lib/displayMode";

const refreshed = new Set<string>();
const pending = new Set<string>();

const currentPath = (): string => {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return "/";
  }
};

/** 받지 않는 주소 — TV · 키오스크(앱 밖으로 나가지 않는다) · 앱 주소가 아닌 것 */
const skipPath = (path: string): boolean => {
  if (!path.startsWith("/") || path.startsWith("//")) return true;
  const pathname = path.split(/[?#]/)[0] || "/";
  return isSignageRoute(pathname);
};

/**
 * 이 주소의 HTML 을 캐시를 건너뛰고 새로 받아 브라우저 캐시 칸을 지금 배포 것으로 바꾼다.
 * 실패해도(인터넷 끊김 · 시간 초과) 조용히 끝난다 — 화면에는 아무 영향이 없다.
 */
export function refreshDocCache(path: string = currentPath(), timeoutMs = 1500): Promise<void> {
  if (typeof window === "undefined" || typeof fetch !== "function" || skipPath(path)) {
    return Promise.resolve();
  }
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = window.setTimeout(() => ctrl?.abort(), timeoutMs);
  return fetch(path, { cache: "reload", credentials: "same-origin", signal: ctrl?.signal })
    // 끝까지 받아야 캐시에 온전히 남는다
    .then((res) => res.text().then(() => res.ok))
    .then((ok) => {
      if (ok) refreshed.add(path);
    })
    .catch(() => {})
    .finally(() => window.clearTimeout(timer));
}

/** 화면을 옮길 때 — 그 주소를 이 페이지를 연 동안 한 번만, 바쁘지 않을 때 받아 둔다 */
export function rememberDocCache(path: string = currentPath()): void {
  if (typeof window === "undefined" || skipPath(path)) return;
  if (refreshed.has(path) || pending.has(path)) return;
  pending.add(path);
  const run = () => {
    void refreshDocCache(path, 4000).finally(() => pending.delete(path));
  };
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
}

/**
 * 같은 탭에서 앱 밖(정적 페이지 등)으로 나간다 — 지금 주소의 HTML 사본을 먼저 새로 받아 둔다.
 * 그래야 거기서 뒤로가기를 눌렀을 때 지금 배포의 화면으로 돌아온다. 기다리는 건 길어야 1.5초.
 */
export async function leaveApp(url: string): Promise<void> {
  await refreshDocCache(currentPath(), 1500);
  window.location.assign(url);
}

/** 시험용 — 받아 둔 기록 지우기 */
export function resetDocCacheForTest(): void {
  refreshed.clear();
  pending.clear();
}
