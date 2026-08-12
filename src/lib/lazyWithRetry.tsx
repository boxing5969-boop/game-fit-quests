import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * 화면(청크) 불러오기 실패를 스스로 복구하는 lazy 래퍼.
 *
 * 왜 필요한가:
 *   이 앱은 화면마다 파일을 쪼개서(코드 스플리팅) 필요할 때 내려받는다.
 *   그래서 아래 두 상황에서 "Failed to fetch dynamically imported module" 이 난다.
 *     1) 잠깐 통신이 끊김 — 지하철, 엘리베이터, 와이파이 전환 순간
 *     2) 방금 새 버전을 배포함 — 열어둔 탭이 사라진 옛 파일을 찾음
 *   둘 다 회원 잘못이 아니고, 둘 다 다시 시도하면 해결된다.
 *
 * 복구 순서:
 *   ① 0.4초 뒤 재시도 → ② 1.2초 뒤 재시도 → ③ 그래도 안 되면 새로고침 1회
 *   ③ 은 sessionStorage 로 딱 한 번만. 안 그러면 무한 새로고침에 빠진다.
 */

const RELOAD_FLAG = "mb153:chunk-reload";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 청크를 못 받아온 에러인지 (문법 오류 같은 진짜 버그와 구분) */
export const isChunkLoadError = (e: unknown): boolean => {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported module/i.test(
    msg,
  );
};

export function lazyWithRetry<T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [400, 1200];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const mod = await factory();
        // 한 번이라도 성공하면 새로고침 기록을 지운다 —
        // 다음에 또 문제가 생겼을 때 다시 새로고침할 수 있어야 하니까.
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* 시크릿모드 등 */ }
        return mod;
      } catch (err) {
        lastError = err;
        if (!isChunkLoadError(err)) throw err; // 진짜 코드 버그면 그대로 보여준다
        if (attempt < delays.length) await sleep(delays[attempt]!);
      }
    }

    // 재시도로도 안 되면 — 새 버전이 배포됐을 가능성이 크다. 딱 한 번만 새로고침.
    let alreadyReloaded = false;
    try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1"; } catch { /* noop */ }

    if (!alreadyReloaded) {
      try { sessionStorage.setItem(RELOAD_FLAG, "1"); } catch { /* noop */ }
      // 캐시를 건너뛰고 최신 index.html 부터 다시 받게 한다.
      window.location.reload();
      // 새로고침이 도는 동안 에러 화면이 번쩍이지 않도록 영원히 대기.
      await new Promise(() => {});
    }

    throw lastError;
  });
}

export default lazyWithRetry;
