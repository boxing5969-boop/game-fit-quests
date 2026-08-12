/**
 * 마이복서153 — 최소 Service Worker.
 *
 * 목적: Chrome / Edge / Samsung Internet 등에서 PWA 설치 가능 조건만 충족
 *   (manifest + sw + HTTPS + start_url 가 fetch 됨).
 *
 * 정책:
 *   · 별도 캐시 전략 없음 — 요청을 아예 가로채지 않는다 (Cloudflare Pages 가 정적 캐시 담당)
 *   · 오프라인 fallback 없음 — 회원이 인터넷 끊긴 상태에서 앱 사용 시나리오 미지원
 *   · push / background sync 미사용
 *
 * 변경 시: VERSION 을 올려 강제 갱신 트리거.
 */
const VERSION = "myboxer-153-sw-v2";

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

self.addEventListener("fetch", () => {
  // 일부러 비워둔다. respondWith 를 부르지 않으면 브라우저가 평소대로 직접 가져간다.
  //
  // 예전엔 여기서 event.respondWith(fetch(event.request)) 를 했는데, 그러면
  // 모든 요청이 서비스워커를 한 번 거쳐 다시 나가면서 브라우저 자체의 재시도·
  // 커넥션 재사용이 무력화된다. 통신이 아주 잠깐 끊기기만 해도 화면 파일 로딩이
  // 통째로 실패해서 "Failed to fetch dynamically imported module" 이 떴다.
  //
  // 리스너 자체는 남겨둔다 — PWA "홈 화면에 추가" 조건이 fetch 핸들러 존재 여부를
  // 보기 때문. 비어 있어도 조건은 충족된다.
});
