/**
 * 🎬 내 수업 재생 — 카드 영상이 차례로 반복되고 남은 시간 · 「다음 →」 (2026-11-14 2단계)
 *
 *   · 시작 3초 준비 → 카드마다 운동(분) · 라운드면 3분 운동 + 30초 쉬기 → 끝 「오늘 n분 했어요」
 *   · 영상 = 회원용(정사각 · 소리 없음 · 반복) · 레벨 미션은 그 영상 · 영상이 없으면 첫 장면/칸 색
 *   · 화면 꺼짐 막기 · 바뀔 때 벨 한 번(소리는 기기 설정을 따른다 — 회원님이 듣던 음악은 멈추지 않는다) · 진동(안드로이드)
 *   · 화면을 껐다 켜도 시계로 다시 센다(지난 구간은 건너뜀) · 1분 넘게 하고 닫으면 그만큼 「오늘 n분 했어요」
 *   · 본인 수업이면 끝에 재생 기록(my_class_played) — 「이 수업 n번째」 / 카드마다 이용 기록 play 한 번
 *   흰 바탕 · 글씨 6단계 이름만
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Film, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  doneText,
  formatClock,
  nextItemSegment,
  prevItemSegment,
  segmentsFor,
  workedSeconds,
  type Segment,
} from "@/lib/myClass";
import { useCardVideo } from "@/services/trainingCardService";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { logCardEvent } from "@/services/shelfLayoutService";
import { buzz, keepScreenOn, playBell } from "@/features/myboxer-visualization/mindAudio";
import { itemPoster, type MyClassFlow, type PlayingClass, type PosterOf, type ResolvedItem } from "./useMyClassFlow";

const READY_MS = 3000;

/** 지금 카드의 영상 — 카드는 회원용 영상(서명 주소), 레벨 미션은 영상 주소 그대로 */
const Media = ({ item, posterOf, paused, dim }: { item: ResolvedItem | null; posterOf: PosterOf; paused: boolean; dim?: boolean }) => {
  const card = item?.kind === "card" ? item.card : null;
  const video = useCardVideo(card, "member", !!card);
  const src = item?.kind === "card" ? video.data ?? null : item?.kind === "mission" ? item.mission.video : null;
  const poster = itemPoster(item, posterOf);
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused || dim) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, dim, src]);
  const color = item?.color ?? "#8B95A1";
  const hasMedia = !!src || !!poster;
  return (
    <div
      className={cn("relative mx-auto aspect-square w-full max-w-[46vh] overflow-hidden rounded-3xl", hasMedia && "bg-black")}
      style={hasMedia ? undefined : { backgroundColor: `${color}1A` }}
    >
      {src ? (
        <video
          ref={ref}
          key={src}
          src={src}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={cn("h-full w-full object-cover transition-opacity", dim && "opacity-40")}
        />
      ) : poster ? (
        <img src={poster} alt="" className={cn("h-full w-full object-cover", dim && "opacity-40")} />
      ) : (
        <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2", dim && "opacity-0")} style={{ color }}>
          <Film className="h-12 w-12" aria-hidden />
          <span className="text-heading font-black">{item?.label ?? ""}</span>
        </div>
      )}
    </div>
  );
};

const PlayerBody = ({ playing, flow, posterOf }: { playing: PlayingClass; flow: MyClassFlow; posterOf: PosterOf }) => {
  // 시작할 때의 순서 · 카드로 고정 (재생 중 목록이 바뀌어도 흔들리지 않게)
  const [segs] = useState<Segment[]>(() => segmentsFor(playing.items, (k) => !!flow.resolve(k)));
  const resolved = useMemo(() => playing.items.map((x) => flow.resolve(x.k)), [playing.items, flow]);
  const itemCount = useMemo(() => new Set(segs.map((s) => s.item)).size, [segs]);
  const totalSec = useMemo(() => segs.reduce((s, x) => s + x.sec, 0), [segs]);

  const [phase, setPhase] = useState<"ready" | "run" | "done">("ready");
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const readyEnd = useRef(Date.now() + READY_MS);
  const segStart = useRef(0);
  const pausedElapsed = useRef(0);
  const played = useRef(new Set<number>());
  const [result, setResult] = useState<{ seconds: number; plays: number | null } | null>(null);

  useEffect(() => {
    void keepScreenOn(true);
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => {
      window.clearInterval(t);
      void keepScreenOn(false);
    };
  }, []);

  const elapsed = phase !== "run" ? 0 : running ? (now - segStart.current) / 1000 : pausedElapsed.current;
  const seg = segs[idx] ?? null;

  const enterSegment = (i: number, at: number) => {
    setIdx(i);
    segStart.current = at;
    pausedElapsed.current = 0;
    const s = segs[i];
    if (!s) return;
    if (s.kind === "work") {
      playBell(1);
      buzz(120);
      if (!played.current.has(s.item)) {
        played.current.add(s.item);
        const r = resolved[s.item];
        if (r) logCardEvent(r.key, "play");
      }
    } else buzz([60, 80, 60]);
  };

  const finish = (seconds: number) => {
    setPhase("done");
    setRunning(false);
    playBell(3);
    buzz([200, 100, 200]);
    const minutes = Math.max(1, Math.round(seconds / 60));
    setResult({ seconds, plays: null });
    if (playing.mine) {
      void flow.actions
        .played(playing.id, minutes)
        .then((r) => setResult({ seconds, plays: r.plays }))
        .catch(() => undefined);
    }
  };

  // 시계 — 준비 3초 → 구간마다 (화면을 껐다 켜면 지난 구간은 건너뛴다)
  useEffect(() => {
    if (phase === "ready") {
      if (now >= readyEnd.current) {
        setPhase("run");
        enterSegment(0, now);
      }
      return;
    }
    if (phase !== "run" || !running || !seg) return;
    let i = idx;
    let start = segStart.current;
    while (i < segs.length && (now - start) / 1000 >= segs[i].sec) {
      start += segs[i].sec * 1000;
      i++;
    }
    if (i === idx) return;
    if (i >= segs.length) finish(workedSeconds(segs, segs.length, 0));
    else enterSegment(i, start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const togglePause = () => {
    if (phase !== "run") return;
    if (running) {
      pausedElapsed.current = (Date.now() - segStart.current) / 1000;
      setRunning(false);
    } else {
      segStart.current = Date.now() - pausedElapsed.current * 1000;
      setRunning(true);
    }
  };
  const jump = (i: number) => {
    if (i < 0) {
      finish(workedSeconds(segs, idx, elapsed));
      return;
    }
    enterSegment(i, Date.now());
    if (!running) setRunning(true);
  };
  const close = () => {
    const worked = phase === "run" ? workedSeconds(segs, idx, elapsed) : 0;
    if (phase === "run" && worked >= 60) finish(worked);
    else flow.closePlayer();
  };
  // 뒤 화면 스크롤 잠금 · Esc
  useModalDismiss(true, close);

  const item = seg ? resolved[seg.item] : resolved[segs[0]?.item ?? 0] ?? null;
  const nextSeg = seg ? segs.slice(idx + 1).find((s) => s.item !== seg.item) : null;
  const nextItem = nextSeg ? resolved[nextSeg.item] : null;
  const restNext = seg?.kind === "rest" ? resolved[seg.item] : null;
  const remaining = seg ? Math.max(0, seg.sec - elapsed) : 0;
  const doneSec = segs.slice(0, idx).reduce((s, x) => s + x.sec, 0) + Math.min(seg?.sec ?? 0, elapsed);
  const pct = totalSec > 0 ? Math.min(100, (doneSec / totalSec) * 100) : 0;
  const order = seg ? [...new Set(segs.map((s) => s.item))].indexOf(seg.item) + 1 : 1;
  const note = seg ? playing.items[seg.item]?.note : "";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${playing.name} 재생`} className="fixed inset-0 z-[115] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button type="button" onClick={close} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-90">
          <X className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-body font-bold text-foreground">{playing.name}</p>
        <span className="w-10 shrink-0 text-right text-label font-bold text-muted-foreground">
          {phase === "done" ? "" : `${order}/${itemCount}`}
        </span>
      </div>

      {phase === "done" && result ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-display" aria-hidden>
            🥊
          </p>
          <p className="mt-3 text-display font-black text-foreground">{doneText(result.seconds)}</p>
          {result.plays != null && result.plays > 0 && <p className="mt-2 text-body text-muted-foreground">‘{playing.name}’ {result.plays}번째예요</p>}
          <button
            type="button"
            onClick={flow.closePlayer}
            className="mt-8 h-14 w-full max-w-xs rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99]"
          >
            닫기
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="relative">
            <Media item={seg?.kind === "rest" ? restNext : item} posterOf={posterOf} paused={!running} dim={phase === "ready" || seg?.kind === "rest"} />
            {(phase === "ready" || seg?.kind === "rest") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="rounded-full bg-background/90 px-4 py-1.5 text-body font-black text-foreground shadow-elev-1">
                  {phase === "ready" ? "준비" : "쉬어요"}
                </span>
                {phase === "ready" && (
                  <span className="mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-foreground/85 text-display font-black text-background">
                    {Math.max(1, Math.ceil((readyEnd.current - now) / 1000))}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 min-h-0 flex-1">
            <p className="truncate text-label font-bold" style={{ color: item?.color }}>
              {item?.label ?? ""}
              {seg && seg.rounds > 1 ? ` · 라운드 ${seg.round}/${seg.rounds}` : ""}
            </p>
            <p className="mt-0.5 line-clamp-2 text-title font-black text-foreground">{item?.name ?? ""}</p>
            {note && <p className="mt-1 truncate text-body text-muted-foreground">{note}</p>}
            <p className="mt-3 text-display font-black tabular-nums text-foreground" aria-live="off">
              {phase === "ready" ? formatClock(seg?.sec ?? segs[0]?.sec ?? 0) : formatClock(remaining)}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 truncate text-label text-muted-foreground">{nextItem ? `다음 · ${nextItem.name}` : "마지막 카드예요"}</p>
          </div>

          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => phase === "run" && jump(prevItemSegment(segs, idx, elapsed))}
              disabled={phase !== "run"}
              aria-label="이전 카드"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-foreground active:scale-90 disabled:opacity-40"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={togglePause}
              disabled={phase !== "run"}
              aria-label={running ? "멈추기" : "계속하기"}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-foreground text-background shadow-elev-2 active:scale-90 disabled:opacity-60"
            >
              {running ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => phase === "run" && jump(nextItemSegment(segs, idx))}
              disabled={phase !== "run"}
              className="flex h-14 items-center gap-1 rounded-full bg-secondary px-5 text-body font-bold text-foreground active:scale-95 disabled:opacity-40"
            >
              {nextItemSegment(segs, idx) < 0 ? "끝내기" : "다음"} <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MyClassPlayer = ({ flow, posterOf }: { flow: MyClassFlow; posterOf: PosterOf }) => {
  const p = flow.playing;
  if (!p || typeof document === "undefined") return null;
  return createPortal(<PlayerBody key={`${p.id}-${p.items.length}`} playing={p} flow={flow} posterOf={posterOf} />, document.body);
};

export default MyClassPlayer;
