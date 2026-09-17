import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SIGNAGE_SLIDES,
  SLIDE_MS,
  FADE_MS,
  SIGNAGE_BG,
} from "@/lib/signagePlaylist";

/**
 * 사이니지 3번 화면 — /tv/{지점}/3
 *
 * 1번·2번은 실시간 보드다(지금 운동 중 · 오늘 방문 명단 · 명예의 전당).
 * 3번은 "제도를 설명하는" 화면이라 실시간 데이터를 전혀 쓰지 않는다.
 * Supabase 도, 소켓도 보지 않는다 — 통신이 끊기거나 DB 가 멈춘 날에도
 * TV 는 계속 돌아야 하기 때문이다. 이미지는 앱과 함께 배포된 정적 파일이다.
 *
 * 지점 코드는 주소 형식을 1·2번과 맞추기 위해 받기만 하고 쓰지 않는다
 * (안내 내용은 전 지점 공통). /tv/s/3, /tv/j/3 … 전부 같은 화면이 나온다.
 *
 * 조작 (직원이 TV 앞에서 확인할 때):
 *   화면 누르기 / → : 다음 장     ← : 이전 장     스페이스 : 일시정지
 */

/** 한 바퀴를 다 돈 뒤, 이 시간이 지났으면 새로고침해서 새로 배포한 이미지를 받는다. */
const RELOAD_MS = 60 * 60_000;

/** 이미지가 전부 안 뜰 때 쓰는 글자색 — 카드 팔레트와 같은 값 */
const FALLBACK_INK = "#11161A";
const FALLBACK_INK2 = "#5A666C";

const SignageBoardPage = () => {
  // 계속 증가하는 카운터. 읽을 때 나머지로 위치를 구하기 때문에
  // 목록이 줄어들어도(깨진 이미지 제외) 인덱스가 어긋나지 않는다.
  const [step, setStep] = useState(0);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const [paused, setPaused] = useState(false);
  const openedAt = useRef(Date.now());

  const alive = useMemo(
    () => SIGNAGE_SLIDES.filter((s) => !broken[s.src]),
    [broken],
  );
  const current = alive.length > 0 ? alive[step % alive.length] : null;

  const go = useCallback((delta: number) => {
    setStep((v) => {
      const n = v + delta;
      return n < 0 ? n + 1_000_000 : n % 1_000_000;
    });
  }, []);

  // 다음 장으로 넘기기
  useEffect(() => {
    if (paused || alive.length < 2) return;
    const wait = current?.ms ?? SLIDE_MS;
    const t = setTimeout(() => {
      // 새로고침은 한 바퀴가 끝나는 순간에만 — 회원이 카드를 읽는 중간을 끊지 않는다.
      const next = step + 1;
      if (next % alive.length === 0 && Date.now() - openedAt.current > RELOAD_MS) {
        window.location.reload();
        return;
      }
      setStep(next % 1_000_000);
    }, wait);
    return () => clearTimeout(t);
  }, [step, paused, alive.length, current?.ms]);

  // 리모컨·키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // 화면이 저절로 꺼지지 않게 잡아둔다 (라이브보드와 같은 방식).
  useEffect(() => {
    type WakeLockSentinelLike = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* 배터리 절약 모드 등 — 못 잡아도 화면은 그대로 나온다 */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ background: SIGNAGE_BG, cursor: "none" }}
      onPointerDown={() => go(1)}
    >
      {/*
        여덟 장을 모두 올려두고 투명도만 바꾼다.
        넘길 때마다 새로 불러오면 TV 에서 첫 프레임이 깜빡인다 —
        한 번 받아두면 그 뒤로는 겹쳐 지는 것만 보인다(총 1MB 미만).
      */}
      {SIGNAGE_SLIDES.map((s) => (
        <img
          key={s.src}
          src={s.src}
          alt={s.alt}
          draggable={false}
          onError={() => setBroken((b) => ({ ...b, [s.src]: true }))}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            opacity: s.src === current?.src ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}

      {alive.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-16 text-center">
          <p className="text-6xl font-black" style={{ color: FALLBACK_INK }}>
            153복싱짐
          </p>
          <p className="text-3xl font-bold" style={{ color: FALLBACK_INK2 }}>
            안내 화면을 불러오지 못했습니다
          </p>
        </div>
      )}

      {paused && (
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full px-6 py-2.5 text-xl font-black"
          style={{ background: "rgba(17,22,26,.72)", color: "#F3F6F5" }}
        >
          일시정지 · 스페이스바로 다시 재생
        </div>
      )}
    </div>
  );
};

export default SignageBoardPage;
