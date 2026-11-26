/**
 * 라이브보드 TV 2번 「체육관 공지사항」 탭 — 공지 한 장 (2026-11-26 대표님 「우리 런칭이벤트 했던 사이니지 모니터에 체육관 공지사항 탭하나 만들자」)
 *
 * 가치 전달 장면(AppValueReel)과 같은 틀 · 같은 글 크기 단계:
 *   왼쪽 = 1줄 상황 → 2줄 제목(둘째 줄 민트 칠) → 답 → 내용 세 줄 → 맺는 한 줄 / 오른쪽 = 그림 → QR 하나(체육관 소식은 QR 없이 그림만).
 * 공지는 15초(4장일 때) — 나타날 때 차례 페이드를 짧게(3초 안에 다 보임 · NOTICE_BEATS) · 무한 움직임 없음 · 맨 위 칸 막대가 공지 수만큼
 *   나뉘어 지금 공지가 찬다. 머리 왼쪽은 두 탭 표시(Tv2TabPills — 「체육관 공지사항」이 민트).
 * 글자 28px 이상. 넘치면 왼쪽 글 · 오른쪽 그림을 따로 한 단계씩 작게(가치 전달과 같은 방식 · 칸 높이가 바뀌거나 글꼴이 늦게 오면 0단계부터 다시).
 * 글은 src/data/gymNotices.ts — 이 파일은 그리기만.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDown, Check, CheckCircle2, Droplet, Flame, ShieldCheck } from "lucide-react";

import Tv2TabPills from "@/components/liveBoard/Tv2TabPills";
import { REEL_SIGN } from "@/lib/appValueReel";
import { NOTICE_BEATS, noticeQrUrl, type GymNotice, type GymNoticeVisual } from "@/lib/gymNotices";
import { cn } from "@/lib/utils";

type FitLevel = 0 | 1 | 2 | 3;
const nextLevel = (l: FitLevel): FitLevel => (l < 3 ? ((l + 1) as FitLevel) : l);

/** 왼쪽 글 크기 네 단계 — 가치 전달(AppValueReel FIT_LEFT)과 같은 값(두 탭이 같은 크기로 보이게) */
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

/** 오른쪽 QR 네 단계 */
const FIT_QR = [
  { qr: 120, oneLine: false },
  { qr: 108, oneLine: true },
  { qr: 100, oneLine: true },
  { qr: 92, oneLine: true },
] as const;

/** 나타날 때 페이드 한 번 — 공지 중간에 켜졌으면 지난 차례는 바로 보인다 */
const beat = (ms: number, offset: number) => ({
  animationDelay: `${Math.max(0, ms - offset)}ms`,
  animationFillMode: "both" as const,
});
// transition-none: 글 크기 단계를 바꿀 때 천천히 바뀌면 넘침을 잴 때 옛 크기를 읽는다(AppValueReel 과 같은 함정)
const FADE = "animate-in fade-in duration-500 transition-none";

/** 맨 위 공지 칸 — 지난 칸은 찼고, 지금 칸은 공지 시간 동안 찬다 */
const Segments = ({ index, total, offset, ms }: { index: number; total: number; offset: number; ms: number }) => {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const start = ms > 0 ? Math.min(1, offset / ms) : 1;
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
                transition: full ? `transform ${Math.max(0, ms - offset)}ms linear` : "none",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
};

const panel = (level: FitLevel) =>
  cn(
    "flex h-full min-h-0 flex-col justify-center rounded-3xl bg-white/[0.04] ring-1 ring-inset ring-white/10",
    level === 0 ? "p-5" : "p-4",
  );

/** 예시 표시 — 지어낸 값이 아니라 화면 모양이라는 것 */
const Sample = () => (
  <span className="shrink-0 rounded-full bg-white/10 px-3 text-[28px] font-bold leading-snug text-gray-300">예시</span>
);

/** 오른쪽 그림 — 공지마다 다른 틀(샤워실 · 성향 막대 · 타이머 · 수강권 이어짐) */
const NoticeVisual = ({ visual, level }: { visual: GymNoticeVisual; level: FitLevel }) => {
  switch (visual.kind) {
    case "shower":
      // 물방울 + 불꽃 = 따뜻한 물 (샤워기 아이콘은 사선이 '금지' 표시처럼 보여서 쓰지 않는다 · 2026-11-26 화면 확인)
      return (
        <div className={cn(panel(level), "items-center text-center")}>
          <span
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-inset ring-primary/50",
              level < 2 ? "h-40 w-40" : "h-32 w-32",
            )}
          >
            <Droplet className={cn("fill-primary/25 text-primary", level < 2 ? "h-24 w-24" : "h-20 w-20")} strokeWidth={1.75} />
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full bg-primary ring-4 ring-gray-900",
                level < 2 ? "-bottom-1 -right-1 h-14 w-14" : "-bottom-1 -right-1 h-12 w-12",
              )}
            >
              <Flame className={cn("text-gray-950", level < 2 ? "h-8 w-8" : "h-7 w-7")} strokeWidth={2.5} />
            </span>
          </span>
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 text-[32px] font-black leading-snug text-gray-950",
              level < 2 ? "mt-6" : "mt-4",
            )}
          >
            <Check className="h-8 w-8 shrink-0" strokeWidth={3} />
            {visual.status}
          </p>
        </div>
      );
    case "style":
      return (
        <div className={panel(level)}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[30px] font-black leading-snug text-white">{visual.title}</p>
            <Sample />
          </div>
          <div className={level === 0 ? "mt-4 space-y-3" : "mt-3 space-y-2"}>
            {(level === 3 ? visual.bars.slice(0, 2) : visual.bars).map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-[180px] shrink-0 truncate text-[28px] font-bold leading-snug text-gray-200">{b.label}</span>
                <span className="h-4 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(5, b.value))}%` }} />
                </span>
              </div>
            ))}
          </div>
          {level < 2 && <p className="mt-3 truncate text-[28px] font-bold leading-snug text-gray-400">{visual.foot}</p>}
        </div>
      );
    case "timer":
      return (
        <div className={cn(panel(level), "items-center text-center")}>
          <p className="text-[28px] font-bold leading-snug text-gray-300">{visual.preset}</p>
          <p
            className={cn(
              "font-black leading-none tabular-nums text-primary",
              level === 0 ? "mt-1 text-[104px]" : level === 1 ? "text-[92px]" : "text-[80px]",
            )}
          >
            {visual.clock}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[30px] font-black leading-snug text-white">{visual.round}</span>
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: visual.rounds }, (_, i) => (
                <span key={i} className={cn("h-3.5 w-3.5 rounded-full", i === 0 ? "bg-primary" : "bg-white/20")} />
              ))}
            </span>
          </div>
          {level < 3 && <p className="mt-1 text-[28px] font-bold leading-snug text-gray-400">{visual.sub}</p>}
        </div>
      );
    case "brand":
      // 제휴 브랜드(BOXRAW) — 어두운 TV 위에 흰 판 + 공식 로고(검정) · 알약 · 지점 한 줄
      return (
        <div className={cn(panel(level), "items-center text-center")}>
          <span className={cn("flex w-full items-center justify-center rounded-2xl bg-white", level < 2 ? "px-10 py-8" : "px-8 py-6")}>
            <img src={visual.logo} alt={visual.logoAlt} className="h-auto w-full max-w-[300px]" />
          </span>
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 text-[30px] font-black leading-snug text-gray-950",
              level < 2 ? "mt-5" : "mt-3",
            )}
          >
            <ShieldCheck className="h-8 w-8 shrink-0" strokeWidth={2.5} />
            {visual.badge}
          </p>
          {level < 3 && <p className="mt-2 text-[28px] font-bold leading-snug text-gray-300">{visual.sub}</p>}
        </div>
      );
    case "pass":
      return (
        <div className={panel(level)}>
          <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-inset ring-white/10">
            <span className="shrink-0 text-[30px] font-black leading-snug text-gray-200">{visual.nowLabel}</span>
            <span className="truncate text-[28px] font-bold leading-snug text-gray-400">{visual.nowSub}</span>
          </div>
          <ArrowDown
            className={cn("mx-auto shrink-0 text-primary", level < 2 ? "my-2 h-9 w-9" : "my-1 h-7 w-7")}
            strokeWidth={3}
            aria-hidden
          />
          <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-primary/10 px-4 py-2 ring-2 ring-inset ring-primary/60">
            <span className="shrink-0 text-[30px] font-black leading-snug text-white">{visual.nextLabel}</span>
            <span className="truncate text-[28px] font-bold leading-snug text-primary">{visual.nextSub}</span>
          </div>
        </div>
      );
  }
};

interface Props {
  notice: GymNotice;
  /** 이번 1분 안의 몇 번째 공지 · 모두 몇 장 */
  index: number;
  total: number;
  /** 이 공지가 시작한 시각(ms) · 한 장 길이(ms) */
  startedAt: number;
  ms: number;
}

const GymNoticeBoard = ({ notice, index, total, startedAt, ms }: Props) => {
  const [offset] = useState(() => Math.min(ms, Math.max(0, Date.now() - startedAt)));
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const [leftLevel, setLeftLevel] = useState<FitLevel>(0);
  const [rightLevel, setRightLevel] = useState<FitLevel>(0);
  const [measure, setMeasure] = useState(0);

  // 칸 높이가 바뀌거나 글꼴이 오면 0단계부터 다시 (가치 전달과 같은 방식)
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
    const timers = [1_200, 3_500].map((t) => window.setTimeout(restart, t));
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

  // 그린 뒤 넘치면 그쪽만 한 단계 작게(3단계가 끝) — 1px 넘침도 넘침
  useLayoutEffect(() => {
    const over = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight;
    if (leftLevel < 3 && over(leftRef.current)) setLeftLevel(nextLevel);
    if (rightLevel < 3 && over(visualRef.current)) setRightLevel(nextLevel);
  }, [leftLevel, rightLevel, measure]);

  const f = FIT_LEFT[leftLevel];
  const q = FIT_QR[rightLevel];
  return (
    <article
      aria-label={`체육관 공지 · ${notice.tag}`}
      data-notice={notice.id}
      data-fit={`${leftLevel}-${rightLevel}`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900/95 to-black px-7 pb-4 pt-3 animate-in fade-in duration-500"
    >
      <Segments index={index} total={total} offset={offset} ms={ms} />

      <header className="mt-2.5 flex items-center justify-between gap-6">
        <Tv2TabPills active="notice" tag={notice.tag} />
        <span className="min-w-0 truncate text-[28px] font-bold leading-none text-gray-400">{REEL_SIGN}</span>
      </header>

      <div ref={bodyRef} className="mt-3 flex min-h-0 flex-1 gap-8">
        {/* 왼쪽: 상황 → 제목 → 답 → 내용 → 맺는 한 줄 */}
        <div ref={leftRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* 줄 높이는 글 크기 뒤에 — cn(tailwind-merge)은 뒤에 오는 글 크기가 앞의 leading 을 지운다 */}
          <p className={cn("break-keep font-bold text-gray-300", f.kicker, "leading-tight")}>{notice.kicker}</p>
          <h2 className={cn("break-keep font-black text-white", f.hook)}>
            <span className="block">{notice.hook[0]}</span>
            <span className="block">
              <span className="rounded-xl bg-primary px-3 text-gray-950 [box-decoration-break:clone]">{notice.hook[1]}</span>
            </span>
          </h2>
          <p
            className={cn("break-keep font-black text-primary", FADE, f.answer, "leading-tight")}
            style={beat(NOTICE_BEATS.answer, offset)}
          >
            {notice.answer}
          </p>
          <ul className={f.proofs}>
            {notice.proofs.map((p, i) => (
              <li
                key={p}
                className={cn("flex items-center gap-3", FADE)}
                style={beat(NOTICE_BEATS.proofs[Math.min(i, NOTICE_BEATS.proofs.length - 1)], offset)}
              >
                <CheckCircle2 className={cn("shrink-0 text-primary", f.icon)} />
                <span className={cn("min-w-0 truncate font-bold text-gray-100", f.proof)}>{p}</span>
              </li>
            ))}
          </ul>
          <div className={cn("mt-auto", f.ease, FADE)} style={beat(NOTICE_BEATS.ease, offset)}>
            <p
              className={cn(
                "inline-flex max-w-full items-center gap-3 rounded-2xl bg-white/[0.07] px-4 ring-1 ring-inset ring-white/10",
                f.pill,
              )}
            >
              <ShieldCheck className="h-8 w-8 shrink-0 text-primary" />
              <span className="truncate text-[28px] font-bold leading-snug text-gray-100">{notice.ease}</span>
            </p>
          </div>
        </div>

        {/* 오른쪽: 그림 → QR 하나(있을 때만) */}
        <div className="flex w-[440px] shrink-0 flex-col gap-3">
          <div
            ref={visualRef}
            className={cn("min-h-0 flex-1 overflow-hidden", FADE)}
            style={beat(NOTICE_BEATS.visual, offset)}
          >
            <NoticeVisual visual={notice.visual} level={rightLevel} />
          </div>
          {notice.qr && (
            <div
              className={cn("flex shrink-0 items-center gap-4 rounded-2xl bg-white p-3", FADE)}
              style={beat(NOTICE_BEATS.qr, offset)}
            >
              <QRCodeSVG value={noticeQrUrl(notice.qr.path)} size={q.qr} level="M" marginSize={0} />
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[30px] font-black leading-tight text-gray-900">
                  {q.oneLine ? (
                    `${notice.qr.caption[0]} ${notice.qr.caption[1]}`
                  ) : (
                    <>
                      {notice.qr.caption[0]}
                      <br />
                      {notice.qr.caption[1]}
                    </>
                  )}
                </p>
                <p className="mt-1 text-[28px] font-bold leading-tight text-gray-500">카메라로 찍어요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default GymNoticeBoard;
