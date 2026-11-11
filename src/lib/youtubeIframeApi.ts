/**
 * 유튜브 IFrame Player API 불러오기 — 한 번만 받고 같은 약속(Promise)을 나눠 쓴다.
 *
 * 2026-11-11 153플레이 「복싱 음악」 체육관 자동재생에서 처음 씀.
 *   · 받기에 실패하면(인터넷 끊김) 약속을 지워서, 다음에 부르면 다시 받는다.
 *   · 15초 안에 준비가 안 되면 실패로 본다 — 부르는 쪽이 잠시 뒤 다시 부른다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type YTNamespace = any;

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(timeoutMs = 15_000): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<YTNamespace>((resolve, reject) => {
    let done = false;
    const finish = (ok: boolean, err?: Error) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (ok) resolve(window.YT);
      else {
        loading = null;
        reject(err ?? new Error("youtube api load failed"));
      }
    };
    const timer = window.setTimeout(() => finish(!!window.YT?.Player, new Error("youtube api timeout")), timeoutMs);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch { /* 다른 곳의 콜백 오류는 무시 */ }
      finish(true);
    };

    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      s.remove();
      finish(false, new Error("youtube api script error"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** 유튜브 플레이어 상태 번호 (YT.PlayerState) */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;
