/**
 * 라이브보드 TV 2번 「마이복서153 가치 전달」 (2026-11-18 대표님 「마이복서153 가치전달하는 영상을 돌리자 1분 간격으로 …
 * 너의 최고성능 프롬프트로 설득력있게 작성해줘」)
 *
 * 1분마다 장면 하나 — 영상처럼 차례로 나타난다(나타날 때 페이드 한 번씩 · 그 뒤엔 그대로 · 무한 움직임 없음):
 *   0초 훅(1줄 상황 + 2줄 빈칸 질문 — 2줄째 민트 칠, 153 쇼츠 프레임) → 2.5초 답 → 3.5초 그림 → 4.5 · 5.5 · 6.5초 증거 세 줄 →
 *   8초 의심 해소 → 9.5초 QR. 맨 위 막대가 장면 수만큼 칸으로 나뉘어 지금 장면이 1분 동안 찬다(인스타 스토리처럼).
 * 장면은 시계로 고른다(분 % 장면 수) — TV 를 껐다 켜도 · 20분 새로고침에도 이어서, 중간에 켜면 그 장면의 그 자리부터.
 * 숫자는 board_app_pulse(TV 열쇠 · 지난 28일 합계) — 함수가 없거나 못 읽으면 숫자 없이 같은 장면(글은 src/lib/appValueReel.ts).
 * 글자는 28px 이상. 칸 높이에 맞춰 네 단계 중 넘치지 않는 가장 큰 것 — 왼쪽 글(FIT_LEFT)과 오른쪽 그림 · QR(FIT_RIGHT)을 따로 잰다.
 *   칸 높이가 바뀌면(153 RECORD 띠가 생기고 사라질 때 · 글꼴이 늦게 올 때) 0단계부터 다시 잰다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { readBoardKey } from "@/lib/boardKey";
import { kstToday } from "@/lib/attendanceCheer";
import {
  REEL_SIGN,
  SCENE_BEATS,
  SCENE_MS,
  buildReel,
  normalizePulse,
  sceneIndexAt,
  type AppPulse,
  type MileageRules,
  type ValueScene,
} from "@/lib/appValueReel";
import { AppValueVisual, type FitLevel } from "@/components/liveBoard/AppValueVisuals";
import { cn } from "@/lib/utils";

/** 왼쪽 글 크기 네 단계 — 칸에 넘치지 않는 가장 큰 단계를 쓴다(모두 28px 이상) */
const FIT_LEFT = [
  {
    kicker: "text-[32px]",
    hook: "mt-1.5 text-[60px] leading-[1.12]",
    answer: "mt-2.5 text-[40px]",
    proofs: "mt-2.5 space-y-1.5",
    proof: "text-[30px] leading-snug",
    icon: "h-8 w-8",
    ease: "pt-2.5",
    pill: "py-2",
  },
  {
    kicker: "text-[30px]",
    hook: "mt-1.5 text-[52px] leading-[1.12]",
    answer: "mt-2.5 text-[35px]",
    proofs: "mt-2.5 space-y-1",
    proof: "text-[29px] leading-snug",
    icon: "h-7 w-7",
    ease: "pt-2.5",
    pill: "py-2",
  },
  {
    kicker: "text-[28px]",
    hook: "mt-1 text-[48px] leading-[1.12]",
    answer: "mt-2 text-[34px]",
    proofs: "mt-2 space-y-1",
    proof: "text-[28px] leading-snug",
    icon: "h-7 w-7",
    ease: "pt-2",
    pill: "py-1.5",
  },
  {
    kicker: "text-[28px]",
    hook: "mt-1 text-[44px] leading-[1.1]",
    answer: "mt-1.5 text-[32px]",
    proofs: "mt-1.5 space-y-0.5",
    proof: "text-[28px] leading-tight",
    icon: "h-7 w-7",
    ease: "pt-1.5",
    pill: "py-1.5",
  },
] as const;

/** 오른쪽(그림 · QR) 네 단계 — 왼쪽과 따로 잰다(장면마다 그림 높이가 달라도 왼쪽 글 크기는 같게) */
const FIT_RIGHT = [
  { qr: 120, qrOneLine: false },
  { qr: 108, qrOneLine: true },
  { qr: 100, qrOneLine: true },
  { qr: 92, qrOneLine: true },
] as const;

const nextLevel = (l: FitLevel): FitLevel => (l < 3 ? ((l + 1) as FitLevel) : l);

async function fetchAppPulse(branchName: string): Promise<AppPulse | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("board_app_pulse", {
      p_branch: branchName,
      p_key: readBoardKey(branchName),
    });
    if (error) return null;
    return normalizePulse(data);
  } catch {
    return null;
  }
}

/** 나타날 때 페이드 한 번 — 장면 중간에 켜졌으면 지난 차례는 바로 보인다 */
const beat = (ms: number, offset: number) => ({
  animationDelay: `${Math.max(0, ms - offset)}ms`,
  animationFillMode: "both" as const,
});
// transition-none: duration-700 은 transition-duration 도 함께 정한다 — 그러면 글 크기 단계를 바꿀 때 글자 · 여백이 0.7초 동안
// 천천히 바뀌어 넘치는지 잴 때 옛 크기를 읽는다(2026-11-18 화면 시험에서 찾음). 나타날 때 페이드만 남긴다.
const FADE = "animate-in fade-in duration-700 transition-none";

/** 맨 위 장면 칸 — 지난 칸은 찼고, 지금 칸은 1분 동안 찬다 */
const Segments = ({ index, total, offset }: { index: number; total: number; offset: number }) => {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const start = Math.min(1, offset / SCENE_MS);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          {i < index && <span className="block h-full w-full bg-primary/60" />}
          {i === index && (
            <span
              className="block h-full w-full origin-left bg-primary"
              style={{
                transform: `scaleX(${full ? 1 : start})`,
                transition: full ? `transform ${Math.max(0, SCENE_MS - offset)}ms linear` : "none",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
};

const SceneView = ({
  scene,
  startedAt,
  index,
  total,
}: {
  scene: ValueScene;
  startedAt: number;
  index: number;
  total: number;
}) => {
  const [offset] = useState(() => Math.min(SCENE_MS, Math.max(0, Date.now() - startedAt)));
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const [leftLevel, setLeftLevel] = useState<FitLevel>(0);
  const [rightLevel, setRightLevel] = useState<FitLevel>(0);
  const [measure, setMeasure] = useState(0);

  // 칸 높이가 바뀌거나 글꼴이 오면(웹 글꼴은 글자 묶음마다 늦게 온다) 0단계부터 다시
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let last = el.clientHeight;
    let alive = true;
    const restart = () => {
      if (!alive) return;
      setLeftLevel(0);
      setRightLevel(0);
      setMeasure((m) => m + 1);
    };
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    fonts?.ready?.then(restart).catch(() => {});
    fonts?.addEventListener?.("loadingdone", restart);
    // 글꼴 · 아래 띠가 늦게 자리 잡는 TV 도 있어 처음 몇 초 안에 두 번 더(다시 재는 동안은 그리기 전이라 보이지 않는다)
    const timers = [1_200, 3_500].map((ms) => window.setTimeout(restart, ms));
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const h = el.clientHeight;
            if (Math.abs(h - last) > 2) {
              last = h;
              restart();
            }
          });
    ro?.observe(el);
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      fonts?.removeEventListener?.("loadingdone", restart);
      ro?.disconnect();
    };
  }, []);

  // 그린 뒤 넘치면 그쪽만 한 단계 작게(3단계가 끝)
  useLayoutEffect(() => {
    // 1px 넘침도 넘침(둥근 테두리 아래가 잘린다)
    const over = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight;
    if (leftLevel < 3 && over(leftRef.current)) setLeftLevel(nextLevel);
    if (rightLevel < 3 && over(visualRef.current)) setRightLevel(nextLevel);
  }, [leftLevel, rightLevel, measure]);

  const f = FIT_LEFT[leftLevel];
  const r = FIT_RIGHT[rightLevel];
  return (
    <article
      aria-label={`마이복서153 · ${scene.tag}`}
      data-scene={scene.id}
      data-fit={`${leftLevel}-${rightLevel}`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900/95 to-black px-7 pb-4 pt-3 animate-in fade-in duration-500"
    >
      <Segments index={index} total={total} offset={offset} />

      <header className="mt-2.5 flex items-center justify-between gap-6">
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[28px] font-black leading-none text-primary">마이복서153</span>
          <span className="rounded-full bg-white/10 px-4 py-1 text-[28px] font-black leading-none text-white">
            {scene.tag}
          </span>
        </div>
        <span className="min-w-0 truncate text-[28px] font-bold leading-none text-gray-400">{REEL_SIGN}</span>
      </header>

      <div ref={bodyRef} className="mt-3 flex min-h-0 flex-1 gap-8">
        {/* 왼쪽: 훅 → 답 → 증거 → 의심 해소 */}
        <div ref={leftRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* 줄 높이는 글 크기 뒤에 — cn(tailwind-merge)은 뒤에 오는 글 크기가 앞의 leading 을 지운다 */}
          <p className={cn("break-keep font-bold text-gray-300", f.kicker, "leading-tight")}>{scene.kicker}</p>
          <h2 className={cn("break-keep font-black text-white", f.hook)}>
            {scene.hook.map((line, i) =>
              i === scene.hook.length - 1 && scene.hook.length > 1 ? (
                <span key={i} className="block">
                  <span className="rounded-xl bg-primary px-3 text-gray-950 [box-decoration-break:clone]">{line}</span>
                </span>
              ) : (
                <span key={i} className="block">
                  {line}
                </span>
              ),
            )}
          </h2>
          <p
            className={cn("break-keep font-black text-primary", FADE, f.answer, "leading-tight")}
            style={beat(SCENE_BEATS.answer, offset)}
          >
            {scene.answer}
          </p>
          <ul className={f.proofs}>
            {scene.proofs.map((p, i) => (
              <li
                key={p}
                className={cn("flex items-center gap-3", FADE)}
                style={beat(SCENE_BEATS.proofs[Math.min(i, SCENE_BEATS.proofs.length - 1)], offset)}
              >
                <CheckCircle2 className={cn("shrink-0 text-primary", f.icon)} />
                <span className={cn("min-w-0 truncate font-bold text-gray-100", f.proof)}>{p}</span>
              </li>
            ))}
          </ul>
          <div className={cn("mt-auto", f.ease, FADE)} style={beat(SCENE_BEATS.ease, offset)}>
            <p
              className={cn(
                "inline-flex max-w-full items-center gap-3 rounded-2xl bg-white/[0.07] px-4 ring-1 ring-inset ring-white/10",
                f.pill,
              )}
            >
              <ShieldCheck className="h-8 w-8 shrink-0 text-primary" />
              <span className="truncate text-[28px] font-bold leading-snug text-gray-100">{scene.ease}</span>
            </p>
          </div>
        </div>

        {/* 오른쪽: 그림 → QR 하나 */}
        <div className="flex w-[440px] shrink-0 flex-col gap-3">
          <div ref={visualRef} className={cn("min-h-0 flex-1 overflow-hidden", FADE)} style={beat(SCENE_BEATS.visual, offset)}>
            <AppValueVisual visual={scene.visual} level={rightLevel} />
          </div>
          <div
            className={cn("flex shrink-0 items-center gap-4 rounded-2xl bg-white p-3", FADE)}
            style={beat(SCENE_BEATS.qr, offset)}
          >
            <QRCodeSVG value={scene.qr.url} size={r.qr} level="M" marginSize={0} />
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[30px] font-black leading-tight text-gray-900">
                {r.qrOneLine ? (
                  `${scene.qr.caption[0]} ${scene.qr.caption[1]}`
                ) : (
                  <>
                    {scene.qr.caption[0]}
                    <br />
                    {scene.qr.caption[1]}
                  </>
                )}
              </p>
              <p className="mt-1 text-[28px] font-bold leading-tight text-gray-500">카메라로 찍어요</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

interface Props {
  branchName: string;
  /** 수상자 축하가 읽은 마일리지 규칙 — board_app_pulse 가 없을 때 예비 */
  awardsRules?: MileageRules | null;
}

const AppValueReel = ({ branchName, awardsRules = null }: Props) => {
  const { data: pulse, isPending } = useQuery({
    queryKey: ["153tv", "app-pulse", branchName],
    queryFn: () => fetchAppPulse(branchName),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
    enabled: !!branchName,
  });

  // 1분이 바뀌는 순간마다 다시 그린다(시계 기준)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t = 0;
    const schedule = () => {
      const wait = SCENE_MS - (Date.now() % SCENE_MS) + 40;
      t = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, wait);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, []);

  const today = kstToday(now);
  const scenes = useMemo(
    () => buildReel({ branch: branchName, pulse: pulse ?? null, awardsRules, today }),
    [branchName, pulse, awardsRules, today],
  );

  // 숫자를 읽는 동안은 비워 둔다(장면 수가 바뀌며 바로 다른 장면으로 넘어가지 않게) — 못 읽으면 숫자 없이
  if (isPending && !!branchName) return null;
  if (!scenes.length) return null;

  const index = sceneIndexAt(now, scenes.length);
  const scene = scenes[index];
  const startedAt = now - (now % SCENE_MS);
  return (
    <SceneView key={`${scene.id}:${startedAt}`} scene={scene} startedAt={startedAt} index={index} total={scenes.length} />
  );
};

export default AppValueReel;
