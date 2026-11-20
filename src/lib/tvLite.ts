/**
 * 📺 TV 가볍게 (2026-11-21 대표님 「사이니지가 렉이 심하면 안 되니까 · 칠금동 라이브보드는 1개 모니터로 쓰고 있는데 렉이 너무 심해서
 * 최소 사양으로 렉 없이 이용할 수 있게」).
 *
 * 가볍게 켜지면 <html class="tv-lite"> — index.css 가 도는 빛 · 반짝임 · 흐림(blur) · 유리 효과(backdrop) · 화면 전환 움직임을 끄고,
 * 화면 부품은 useTvLite() 로 움직이는 카드(framer-motion layout)를 그냥 칸으로 그린다. 글 · 숫자 · 카드 모양은 그대로.
 * 이름 띠(오늘 다녀간 회원)만 계속 흐른다 — 모두가 자기 이름을 한 번은 보게(가장 싼 움직임 · 가림 효과 없이).
 *
 * 정하는 순서 (먼저 걸리는 것):
 *   1) 주소 ?lite=1 · ?lite=0 — 그 TV(기기)에 기억된다. ?lite=auto 면 기억을 지운다.
 *   2) 관리자 앱 › 라이브보드 › TV 줄의 「가볍게」(서버 tv_board_lite → board_tv_mode 의 lite) — 켬 · 끔 · 자동
 *   3) 자동 — 기기 힘이 약하면(코어 4개 이하 · 메모리 3GB 이하 · 웹OS · 타이젠 · 안드로이드 TV 셋톱) 켠다.
 * 칠금점 4번 TV(모니터 1대)는 서버에 처음부터 「켬」.
 */
import { useEffect, useState } from "react";

const FORCE_KEY = "153tv:lite-force"; // "1" | "0" — 이 기기에서 주소로 정한 것
const SERVER_KEY = "153tv:lite-server"; // "1" | "0" — 서버(관리자 앱)에서 마지막으로 받은 값 · 없으면 자동
const EVENT = "153tv-lite";

const safeGet = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* 저장이 막힌 TV — 이번 화면에서만 */
  }
};

const asBool = (v: string | null): boolean | null => (v === "1" ? true : v === "0" ? false : null);

/** 주소의 ?lite= 를 이 기기에 기억한다(처음 한 번). 돌려주는 값 = 주소가 정한 것(없으면 null) */
export function captureLiteFromUrl(search: string = typeof window !== "undefined" ? window.location.search : ""): boolean | null {
  const v = new URLSearchParams(search).get("lite");
  if (v === "1" || v === "true" || v === "on") {
    safeSet(FORCE_KEY, "1");
    return true;
  }
  if (v === "0" || v === "false" || v === "off") {
    safeSet(FORCE_KEY, "0");
    return false;
  }
  if (v === "auto") safeSet(FORCE_KEY, null);
  return null;
}

/** 기기 힘이 약한가 — 사이니지 · TV 브라우저는 대부분 여기에 걸린다 */
export function isWeakDevice(nav: Pick<Navigator, "userAgent" | "hardwareConcurrency"> & { deviceMemory?: number } =
  typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : ({ userAgent: "", hardwareConcurrency: 8 } as Navigator)): boolean {
  const ua = nav.userAgent || "";
  if (/web0s|webos|tizen|smart-?tv|smarttv|hbbtv|netcast|bravia|aft[a-z]|android tv|googletv|crkey/i.test(ua)) return true;
  const cores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : 8;
  const mem = typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 8;
  return cores <= 4 || mem <= 3;
}

/** 지금 가볍게인가 — 주소(기기 기억) › 서버 › 자동 */
export function resolveTvLite(): boolean {
  const force = asBool(safeGet(FORCE_KEY));
  if (force !== null) return force;
  const server = asBool(safeGet(SERVER_KEY));
  if (server !== null) return server;
  return isWeakDevice();
}

/** <html class="tv-lite"> 를 맞추고 화면 부품에 알린다 */
export function applyTvLite(): boolean {
  const on = resolveTvLite();
  if (typeof document !== "undefined") {
    const el = document.documentElement;
    if (el.classList.contains("tv-lite") !== on) {
      el.classList.toggle("tv-lite", on);
      window.dispatchEvent(new Event(EVENT));
    }
  }
  return on;
}

/** 서버(board_tv_mode)가 준 lite — true · false · null(자동) */
export function setServerTvLite(v: unknown) {
  const next = v === true ? "1" : v === false ? "0" : null;
  if (safeGet(SERVER_KEY) === next) return;
  safeSet(SERVER_KEY, next);
  applyTvLite();
}

/** TV 화면을 떠날 때(앱 안에서 다른 화면으로) — 앱 화면은 늘 보통 */
export function clearTvLiteClass() {
  if (typeof document === "undefined") return;
  if (document.documentElement.classList.contains("tv-lite")) {
    document.documentElement.classList.remove("tv-lite");
    window.dispatchEvent(new Event(EVENT));
  }
}

/** 화면 부품용 — 가볍게면 true (바뀌면 다시 그린다) */
export function useTvLite(): boolean {
  const [on, setOn] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("tv-lite"));
  useEffect(() => {
    const sync = () => setOn(document.documentElement.classList.contains("tv-lite"));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return on;
}
