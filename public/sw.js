/**
 * 마이복서153 — 최소 Service Worker.
 *
 * 목적: Chrome / Edge / Samsung Internet 등에서 PWA 설치 가능 조건만 충족
 *   (manifest + sw + HTTPS + start_url 가 fetch 됨).
 *
 * 정책:
 *   · 별도 캐시 전략 없음 — 항상 네트워크로 통과 (Cloudflare Pages 가 정적 캐시 담당)
 *   · 오프라인 fallback 없음 — 회원이 인터넷 끊긴 상태에서 앱 사용 시나리오 미지원
 *   · push / background sync 미사용
 *
 * 변경 시: VERSION 을 올려 강제 갱신 트리거.
 */
const VERSION = "myboxer-153-sw-v1";

self.addEventListener("install", (event) => {
  // 즉시 active — 이전 SW 가 대기 중이지 않은 첫 설치에서 빠르게 활성.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 이전 버전 SW 가 만든 캐시(있다면) 정리
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== VERSION)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // 설치 가능 조건만을 위한 placeholder — 네트워크에 그대로 위임.
  // Cloudflare Pages 의 캐시 헤더가 정적 자산을 빠르게 서빙함.
  event.respondWith(fetch(event.request));
});
