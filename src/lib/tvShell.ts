/**
 * 📺 TV 바깥 껍데기 — 앱을 한 번만 띄운다 (2026-11-21 대표님 「칠금동 라이브보드 … 렉 없이」).
 *
 * 보드는 1920×1080 에 맞춰 짜여 있어, 창이 1920×1080 이 아닌 TV 는 같은 주소(+ embed=1)를 1920×1080 iframe 으로 띄워 줄인다
 * (TvFitFrame · 2026-10-15). 예전엔 그 바깥 페이지도 앱 전체(화면 파일 · 로그인 · 알림 …)를 다 받아 띄운 뒤 iframe 만 그렸다 —
 * 힘이 약한 TV 에서 앱이 두 벌 돌았다. 이제 main.tsx 가 앱을 받기 전에 여기서 걸러, 바깥은 iframe 하나만 있는 빈 페이지가 된다.
 *   · 규칙은 TvFitFrame 과 같다 — ?fit=0 이면 그대로 · ?safe=N 이면 가장자리 N% 비움 · iframe 안이면 그대로.
 *   · 리모컨 키(OK · ←)가 안쪽 보드에 가도록 iframe 에 초점을 준다.
 */

const STAGE_W = 1920;
const STAGE_H = 1080;

const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/** 이 페이지가 TV 껍데기여야 하나 — /tv/<지점>… 이고 · iframe 이 아니고 · 창이 1920×1080 이 아닐 때 */
export function shouldUseTvShell(loc: Location = window.location, w = window.innerWidth, h = window.innerHeight): boolean {
  if (!/^\/tv\/[^/]+/.test(loc.pathname)) return false;
  const q = new URLSearchParams(loc.search);
  if (q.get("embed") === "1" || q.get("fit") === "0" || inFrame()) return false;
  const safe = Math.min(10, Math.max(0, Number(q.get("safe")) || 0));
  return !(w === STAGE_W && h === STAGE_H && safe === 0);
}

/** 바깥 껍데기 그리기 — React 없이 iframe 하나 */
export function mountTvShell(root: HTMLElement) {
  const q = new URLSearchParams(window.location.search);
  const safePct = Math.min(10, Math.max(0, Number(q.get("safe")) || 0));
  q.set("embed", "1");
  const src = `${window.location.pathname}?${q.toString()}`;

  document.documentElement.style.background = "#000";
  document.body.style.margin = "0";
  document.body.style.background = "#000";
  document.body.style.overflow = "hidden";

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;overflow:hidden;background:#000";
  const frame = document.createElement("iframe");
  frame.title = "라이브보드";
  frame.src = src;
  frame.width = String(STAGE_W);
  frame.height = String(STAGE_H);
  frame.setAttribute("allow", "autoplay; fullscreen");
  frame.style.cssText = `position:absolute;border:0;width:${STAGE_W}px;height:${STAGE_H}px;transform-origin:top left`;
  wrap.appendChild(frame);
  root.replaceChildren(wrap);

  const fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availW = vw * (1 - (2 * safePct) / 100);
    const availH = vh * (1 - (2 * safePct) / 100);
    const scale = Math.min(availW / STAGE_W, availH / STAGE_H);
    frame.style.left = `${(vw - STAGE_W * scale) / 2}px`;
    frame.style.top = `${(vh - STAGE_H * scale) / 2}px`;
    frame.style.transform = `scale(${scale})`;
  };
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);

  // 리모컨 키가 보드로 — 처음 · 바깥을 눌렀을 때
  const focusInner = () => {
    try {
      frame.contentWindow?.focus();
    } catch {
      /* 다른 출처면 그냥 둔다 */
    }
  };
  frame.addEventListener("load", focusInner);
  window.addEventListener("focus", focusInner);
  wrap.addEventListener("click", focusInner);
}
