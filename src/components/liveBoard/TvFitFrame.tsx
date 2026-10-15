/**
 * 📺 사이니지 화면 맞춤 (2026-10-15 대표님: "사이니지에 송출되는 화면이랑 앱 라이브보드 화면이 조금 달라").
 *
 * 왜: 보드는 1920×1080 에 맞춰 짜여 있고 vw·vh 를 쓴다. 앱 미리보기는 같은 주소를 1920×1080 iframe 에 넣고 줄여서
 *     보여 주는데, TV 브라우저는 창 크기가 1920×1080 이 아닐 때가 많다(사이니지 플레이어 해상도·확대·오버스캔).
 *     그러면 칸 크기·줄바꿈이 달라지고 오른쪽이 화면 밖으로 잘린다.
 * 어떻게: 창이 1920×1080 이 아니면 앱 미리보기와 똑같이 — 같은 주소(+ embed=1)를 1920×1080 iframe 으로 띄우고 창에 맞게 줄인다.
 *     창이 정확히 1920×1080 이면 지금처럼 그대로 그린다(아무것도 안 바뀐다).
 *   · ?safe=3  → 가장자리 3% 를 비워서 줄인다 (TV 가 가장자리를 잘라 먹는 '오버스캔'일 때)
 *   · ?fit=0   → 맞춤 끄기 (예전 그대로)
 *   · iframe 안(embed=1 또는 미리보기 안)에서는 항상 그대로 그린다.
 */
import { useEffect, useState, type ReactNode } from "react";

const STAGE_W = 1920;
const STAGE_H = 1080;

const readVp = () => ({ w: window.innerWidth, h: window.innerHeight });

const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const TvFitFrame = ({ children }: { children: ReactNode }) => {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || inFrame();
  const disabled = params.get("fit") === "0";
  const safePct = Math.min(10, Math.max(0, Number(params.get("safe")) || 0));
  const [vp, setVp] = useState(readVp);

  useEffect(() => {
    if (embedded || disabled) return;
    const on = () => setVp(readVp());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, [embedded, disabled]);

  const native = vp.w === STAGE_W && vp.h === STAGE_H && safePct === 0;
  if (embedded || disabled || native) return <>{children}</>;

  const availW = vp.w * (1 - (2 * safePct) / 100);
  const availH = vp.h * (1 - (2 * safePct) / 100);
  const scale = Math.min(availW / STAGE_W, availH / STAGE_H);
  const left = (vp.w - STAGE_W * scale) / 2;
  const top = (vp.h - STAGE_H * scale) / 2;

  const inner = new URLSearchParams(window.location.search);
  inner.set("embed", "1");
  const src = `${window.location.pathname}?${inner.toString()}`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <iframe
        title="라이브보드"
        src={src}
        width={STAGE_W}
        height={STAGE_H}
        className="absolute border-0"
        style={{ left, top, width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        allow="autoplay; fullscreen"
      />
    </div>
  );
};

export default TvFitFrame;
