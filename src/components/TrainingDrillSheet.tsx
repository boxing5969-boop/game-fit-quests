// 🃏 153 콘텐츠 카드 시트 — 훈련 라이브러리(training_exercises)의 어떤 동작이든 이 한 장으로 연다.
//   2026-11-13 대표님 「추천대로 진행」: 그림만 있던 드릴 설명 시트 → 카드 시트
//   위에서부터 영상(회원용 · 정사각 · 소리 없음, 없으면 그림) → 이름 · 칸 · 레벨 · 한 줄 → 🔊 설명 듣기(휴대폰 목소리)
//   → 이렇게 해요(포인트) → 이런 실수 조심 → 준비물 · 시간 → 「다음 동작 →」 하나로 끝 (감정 설계 ⑤)
//   · 코치진이 보면 「코치용 영상(목소리)」 단추가 하나 더 (코치용 영상이 붙은 카드만)
//   · 같은 시트를 훈련 탭 「영상으로 배우기」 · 레벨 자세히 › 필수 훈련 · 전략 회의 영상 칸 · 훈련 라이브러리가 같이 쓴다
//   · 회원 글에는 몸에 좋다는 효과 말(benefits)을 보여 주지 않는다 — 동작과 포인트만 (회원용 글 규칙)
// body 로 portal 한다 (2026-09-28): 상세 화면 루트의 animate-slide-up 이 끝난 뒤에도 transform 을 남겨
// 그 안의 fixed 시트가 화면이 아니라 긴 루트의 맨 아래에 붙었다 → 드릴을 눌러도 화면만 어두워지고 시트가 안 보였다.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Mic, Square, Volume2, X } from "lucide-react";
import type { TrainingExercise } from "@/hooks/useTrainingLibrary";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { isManagerRole, toGlobalLevel } from "@/lib/rankLabels";
import { strictYoutubeId } from "@/lib/videoUrl";
import {
  cardMinutes,
  cardShelf,
  cardSpeech,
  hasCoachVideo,
  levelTag,
  nextCard,
  normalizeCard,
  type TrainingCard,
} from "@/lib/trainingCards";
import { useCardPosters, useCardVideo, useTrainingCards } from "@/services/trainingCardService";
import { logCardEvent } from "@/services/shelfLayoutService";
import { pickKoreanVoice, speak, stopSpeech, type SpeakHandle } from "@/features/myboxer-visualization/mindAudio";
import VideoOverlay from "@/components/common/VideoOverlay";

interface TrainingDrillSheetProps {
  exercise: TrainingExercise | TrainingCard | null;
  onClose: () => void;
  /** 보던 목록 — 같은 칸의 다음 카드가 있으면 맨 아래 「다음 동작 →」 */
  list?: ReadonlyArray<TrainingExercise | TrainingCard>;
  /** 목록이 이미 한 칸(대표님 정리로 옮겨 온 카드도 있음) — 분류와 상관없이 바로 다음 카드 */
  listIsShelf?: boolean;
  /** 대표님이 이 카드에 합친 카드 · 영상 — 「같은 동작」으로 이어서 보기 (2026-11-14 정리 편집) */
  related?: { key: string; label: string; onOpen: () => void }[];
  /** 「다음 동작」을 누르면 그 카드로 바꾼다 (없으면 단추 없음) */
  onChange?: (next: TrainingCard) => void;
  /** 코치진 화면에서 맨 아래에 붙일 단추 (예: 「이 카드로 오늘 프로그램 만들기」) */
  footer?: (card: TrainingCard) => ReactNode;
  /** 겹 순서 — 더 높은 창(153 매뉴얼 읽기 화면 z-115) 위에서 열 때 */
  zClass?: string;
}

const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const TrainingDrillSheet = ({ exercise, onClose, list, listIsShelf, related, onChange, footer, zClass = "z-[90]" }: TrainingDrillSheetProps) => {
  const { role, profile, progress, user } = useAuth();
  const staffViewer = isManagerRole(role) || !!(profile as { is_staff?: boolean } | null)?.is_staff;
  const myLevel = progress ? toGlobalLevel(progress.current_rank, progress.current_level) : 1;
  const cardsQ = useTrainingCards(!!exercise);

  // 레벨 자세히의 필수 훈련처럼 영상 칸 없이 넘어온 카드는 전체 카드 목록에서 같은 id 를 찾아 채운다
  const card: TrainingCard | null = useMemo(() => {
    if (!exercise) return null;
    const full = cardsQ.data?.find((c) => c.id === exercise.id);
    return full ?? normalizeCard(exercise as unknown as Record<string, unknown>);
  }, [exercise, cardsQ.data]);

  useModalDismiss(!!card, onClose);

  const video = useCardVideo(card, "member", !!card);
  const posterOf = useCardPosters(card ? [card] : []);
  const [coachOpen, setCoachOpen] = useState(false);
  const coachVideo = useCardVideo(card, "coach", !!card && coachOpen);
  const [slow, setSlow] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 🔊 설명 듣기 — 문장마다 이어 읽기 · 다시 누르면 멈춤 · 카드가 바뀌거나 닫으면 멈춤
  const [speaking, setSpeaking] = useState(false);
  const runRef = useRef(0);
  const handleRef = useRef<SpeakHandle | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const stop = useCallback(() => {
    runRef.current += 1;
    handleRef.current?.cancel();
    handleRef.current = null;
    stopSpeech();
    setSpeaking(false);
  }, []);
  useEffect(() => {
    if (!card || !hasSpeech()) return;
    // 아이폰은 누른 순간에 말을 시작해야 해서 목소리를 미리 골라 둔다
    void pickKoreanVoice().then((v) => {
      voiceRef.current = v;
    });
  }, [card]);
  const cardId = card?.id;
  useEffect(() => {
    setCoachOpen(false);
    setSlow(false);
    scrollRef.current?.scrollTo({ top: 0 });
    return stop;
  }, [cardId, stop]);

  // 보이지 않는 이용 기록 (2026-11-14 · 결정 8번 1년 보관) — 연 것 · 영상이 돈 것 · 끝까지 · 다시 본 것.
  // 회원용 영상은 반복 재생이라 'ended' 가 안 온다 → 시간이 처음으로 돌아가면 한 바퀴. 한 번 열 때 종류마다 한 번만.
  const seenRef = useRef<{ id: string | null; play: boolean; loops: number; last: number }>({ id: null, play: false, loops: 0, last: 0 });
  const userId = user?.id;
  useEffect(() => {
    seenRef.current = { id: cardId ?? null, play: false, loops: 0, last: 0 };
    if (cardId && userId) logCardEvent(`c:${cardId}`, "open");
  }, [cardId, userId]);
  const onVideoPlaying = () => {
    const s = seenRef.current;
    if (!s.id || !userId || s.play) return;
    s.play = true;
    logCardEvent(`c:${s.id}`, "play");
  };
  const onLoopDone = () => {
    const s = seenRef.current;
    if (!s.id || !userId) return;
    s.loops += 1;
    if (s.loops === 1) logCardEvent(`c:${s.id}`, "complete");
    if (s.loops === 2) logCardEvent(`c:${s.id}`, "replay");
  };
  const onVideoTime = (v: HTMLVideoElement) => {
    const s = seenRef.current;
    const d = v.duration;
    if (Number.isFinite(d) && d > 0 && v.currentTime + 0.5 < s.last && s.last > d * 0.8) onLoopDone();
    s.last = v.currentTime;
  };
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, video.data]);

  if (!card) return null;

  const shelf = cardShelf(card);
  const tag = levelTag(card, myLevel);
  const next =
    list && onChange ? nextCard(list.map((x) => normalizeCard(x as unknown as Record<string, unknown>)), card, { anyShelf: !!listIsShelf }) : null;
  const nextFull = next ? cardsQ.data?.find((c) => c.id === next.id) ?? next : null;
  const poster = posterOf(card);
  const url = video.data ?? null;
  const yt = url && !card.video_path ? strictYoutubeId(url) : null;
  const isStorageVideo = !!url && !!card.video_path;
  const minutesKnown = card.minutes != null && Number(card.minutes) > 0;

  const listen = () => {
    if (speaking) {
      stop();
      return;
    }
    const lines = cardSpeech(card);
    if (!lines.length) return;
    const run = ++runRef.current;
    setSpeaking(true);
    void (async () => {
      for (const line of lines) {
        if (runRef.current !== run) return;
        const h = speak(line, { enabled: true, voice: voiceRef.current, rate: 0.95 });
        handleRef.current = h;
        await h.done;
      }
      if (runRef.current === run) setSpeaking(false);
    })();
  };

  // 코치용 영상 창은 시트 바깥(형제)에 둔다 — 안에 두면 그 창을 닫는 누르기가 시트까지 닫는다(React 이벤트는 portal 을 건너 올라온다)
  return createPortal(
    <>
    <div className={cn("fixed inset-0 flex items-end justify-center bg-black/60", zClass)} onClick={onClose}>
      <div
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 — 영상 위에 떠 있어도 보이게 흰 동그라미 */}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-elev-1 active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 영상 — 회원용(정사각 · 소리 없음 · 반복) → 유튜브 링크 → 그림. 없으면 자리만 감춤 */}
        {isStorageVideo ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-t-3xl bg-black">
            <video
              ref={videoRef}
              key={url}
              src={url}
              poster={poster ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlaying={onVideoPlaying}
              onTimeUpdate={(e) => onVideoTime(e.currentTarget)}
              onClick={(e) => {
                const v = e.currentTarget;
                if (v.paused) void v.play();
                else v.pause();
              }}
              className="h-full w-full object-cover"
            />
          </div>
        ) : yt ? (
          <div className="aspect-video w-full overflow-hidden rounded-t-3xl bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${yt}?rel=0&playsinline=1`}
              title={card.name}
              className="h-full w-full"
              allow="encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : url ? (
          <video src={url} controls playsInline onPlaying={onVideoPlaying} onEnded={onLoopDone} className="aspect-video w-full rounded-t-3xl bg-black" />
        ) : poster ? (
          <img
            src={poster}
            alt={`${card.name} 동작 그림`}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="w-full rounded-t-3xl border-b border-border bg-card"
          />
        ) : (
          <div className="h-12" />
        )}

        <div className="px-5 pt-4">
          {/* 칸 · 레벨 · 난이도 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2.5 py-1 text-label font-bold"
              style={{ color: shelf.color, backgroundColor: `${shelf.color}1A` }}
            >
              {shelf.label}
            </span>
            {tag && (
              <span className={`rounded-full px-2.5 py-1 text-label font-bold ${tag.upcoming ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {tag.text}
              </span>
            )}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-label font-bold text-muted-foreground">{card.difficulty}</span>
            {/* 천천히 — 영상 위에 두면 영상 속 포인트 카드를 가려서 칩 줄 끝에 */}
            {isStorageVideo && (
              <button
                type="button"
                onClick={() => setSlow((s) => !s)}
                aria-pressed={slow}
                className={`ml-auto rounded-full px-3 py-1 text-label font-bold active:scale-95 ${
                  slow ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
                }`}
              >
                {slow ? "천천히 켬" : "천천히"}
              </button>
            )}
          </div>

          <h3 className="mt-2 text-title font-black text-foreground">{card.name}</h3>
          {card.summary && <p className="mt-1 text-body font-bold text-primary">{card.summary}</p>}

          {/* 🔊 설명 듣기 · 🎙 코치용 영상 */}
          <div className="mt-4 flex gap-2">
            {hasSpeech() && (
              <button
                type="button"
                onClick={listen}
                aria-pressed={speaking}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-body font-bold transition-all active:scale-[0.98] ${
                  speaking ? "bg-foreground text-background" : "bg-secondary text-foreground"
                }`}
              >
                {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-5 w-5" />}
                {speaking ? "멈추기" : "설명 듣기"}
              </button>
            )}
            {staffViewer && hasCoachVideo(card) && (
              <button
                type="button"
                onClick={() => setCoachOpen(true)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary/10 text-body font-bold text-primary transition-all active:scale-[0.98]"
              >
                <Mic className="h-4 w-4" /> 코치용 영상
              </button>
            )}
          </div>

          {card.description && <p className="mt-4 text-body leading-relaxed text-muted-foreground">{card.description}</p>}

          {/* 이렇게 해요 — 번호 포인트 */}
          {card.cues.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-body font-black text-foreground">👣 이렇게 해요</p>
              <ol className="space-y-2">
                {card.cues.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-label font-black text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-body text-foreground">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 이런 실수 조심! */}
          {card.mistakes.length > 0 && (
            <div className="mt-3 rounded-2xl border border-status-pending/30 bg-status-pending/5 p-4">
              <p className="mb-2 text-body font-black text-status-pending">⚠️ 이런 실수 조심!</p>
              <ul className="space-y-1.5">
                {card.mistakes.map((m, i) => (
                  <li key={i} className="text-body text-foreground">
                    · {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 준비물 · 시간 — 새 칸이 있는 카드만 (마이그레이션 뒤) */}
          {(card.equipment || minutesKnown) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {minutesKnown && (
                <span className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">⏱ {cardMinutes(card)}분</span>
              )}
              {card.equipment && <span className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">🧰 {card.equipment}</span>}
            </div>
          )}

          {footer?.(card)}

          {/* 같은 동작 — 대표님이 이 카드에 합친 카드 · 영상 (다른 영상 · 다른 설명) */}
          {related && related.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-label font-bold text-muted-foreground">같은 동작 · 다른 영상</p>
              <div className="flex flex-wrap gap-1.5">
                {related.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={r.onOpen}
                    className="max-w-full truncate rounded-full border border-border bg-card px-3.5 py-2 text-label font-bold text-foreground active:scale-95"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 다음 동작 → (같은 칸) */}
          {nextFull && onChange && (
            <button
              type="button"
              onClick={() => onChange(nextFull)}
              className="mt-5 flex h-14 w-full items-center justify-between rounded-2xl border border-border bg-card px-5 text-left transition-all active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block text-label text-muted-foreground">다음 동작</span>
                <span className="block truncate text-body font-bold text-foreground">{nextFull.name}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
    <VideoOverlay
      video={coachOpen && coachVideo.data ? { url: coachVideo.data, title: `${card.name} · 코치용` } : null}
      onClose={() => setCoachOpen(false)}
    />
    </>,
    document.body,
  );
};

export default TrainingDrillSheet;
