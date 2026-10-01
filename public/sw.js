/**
 * 마이복서153 — Service Worker.
 *
 * 목적:
 *   1) Chrome / Edge / Samsung Internet 등에서 PWA 설치 가능 조건 충족
 *      (manifest + sw + HTTPS + start_url 가 fetch 됨).
 *   2) 📲 휴대폰 알림(웹 푸시) 받기 · 누르면 그 화면 열기 (2026-10-01 대표님).
 *      서버(push-send)가 보낸 알림을 휴대폰 알림으로 띄우고, 누르면 앱의 그 화면으로 간다.
 *
 * 정책:
 *   · 별도 캐시 전략 없음 — 요청을 아예 가로채지 않는다 (Cloudflare Pages 가 정적 캐시 담당)
 *   · 오프라인 fallback 없음 — 회원이 인터넷 끊긴 상태에서 앱 사용 시나리오 미지원
 *   · 받은 푸시는 언제나 알림으로 보여준다 (아이폰은 조용히 받기만 하면 구독을 끊어 버린다)
 *   · 알림을 눌렀을 때 여는 주소는 앱 안의 경로(/로 시작)만 — 바깥 주소는 알림함으로 바꾼다
 *
 * 변경 시: VERSION 을 올려 강제 갱신 트리거.
 */
const VERSION = "myboxer-153-sw-v3";

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

// ─────────────────────────────────────────────────────────────
// 📲 휴대폰 알림
// ─────────────────────────────────────────────────────────────

/** 앱 안의 경로만 연다 (src/lib/notifications.ts isSafeAppLink 와 같은 규칙) */
function safeAppPath(url) {
  return typeof url === "string" && url.length <= 300 && /^\/([^/\\\s][^\\\s]*)?$/.test(url) ? url : "/notifications";
}

function clip(text, max) {
  const t = typeof text === "string" ? text.trim() : "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  if (!data || typeof data !== "object") data = {};
  const title = clip(data.title, 80) || "마이복서153";
  const options = {
    body: clip(data.body, 240),
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    lang: "ko",
    // 같은 알림이 두 번 와도 한 장으로 (알림 id)
    tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
    data: { url: safeAppPath(data.url) },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // 열려 있는 앱 화면에 '새 알림' 신호 → 알림함 숫자를 바로 새로 센다
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) w.postMessage({ type: "153:push" });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeAppPath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = wins.find((w) => {
        try {
          return new URL(w.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (app) {
        // 이미 열린 앱이 있으면 그 화면을 앞으로 가져와 경로만 바꾼다 (새로고침 없이)
        try {
          await app.focus();
        } catch {
          /* 포커스를 못 줘도 이동은 시도 */
        }
        app.postMessage({ type: "153:navigate", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// 브라우저가 구독을 새로 바꾼 경우 — 같은 서버 키로 다시 구독해 둔다.
// 서버에는 다음에 앱을 열 때 새 주소가 등록된다 (src/lib/pushClient.ts syncPushSubscription).
self.addEventListener("pushsubscriptionchange", (event) => {
  const key =
    event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(() => {}),
  );
});
