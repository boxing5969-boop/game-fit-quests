// 🃏 153 콘텐츠 카드 시트 — 훈련 라이브러리(training_exercises)의 어떤 동작이든 이 한 장으로 연다.
//   2026-11-13 대표님 「추천대로 진행」: 그림만 있던 드릴 설명 시트 → 카드 시트
//   위에서부터 영상(회원용, 없으면 그림) → 이름 · 칸 · 레벨 · 한 줄 → 🔊 설명 듣기
//   · 2026-11-16 대표님 「모든 영상 기존에 자연스러운 더빙 기본값으로 · 설명 듣기 들어가면 자동으로 · 버튼처럼 보이게」:
//     영상은 소리를 켠 채로(목소리 있는 영상은 더빙 그대로 · 끝나면 「다시 보기」) · 가로 영상은 가로 그대로(잘라내지 않음) ·
//     목소리 없는 영상 · 영상 없는 카드는 열면 설명 듣기가 저절로(드라이브 영상과 같은 목소리 파일, 없으면 휴대폰 목소리) ·
//     설명이 나오는 동안 영상 소리는 잠깐 끈다 · 소리를 끄면 이 창을 닫을 때까지 조용히(lib/learnAudio)
//   → 이렇게 해요(포인트) → 이런 실수 조심 → 준비물 · 시간 → 「다음 동작 →」 하나로 끝 (감정 설계 ⑤)
//   · 코치진이 보면 「코치용 영상(목소리)」 단추가 하나 더 (코치용 영상이 붙은 카드만)
//   · 같은 시트를 훈련 탭 「영상으로 배우기」 · 레벨 자세히 › 필수 훈련 · 전략 회의 영상 칸 · 훈련 라이브러리가 같이 쓴다
//   · 회원 글에는 몸에 좋다는 효과 말(benefits)을 보여 주지 않는다 — 동작과 포인트만 (회원용 글 규칙)
//   · 2026-11-15 영상으로 배우기 3단계: 제목 옆 ♥(숫자는 5명 넘을 때만) · 맨 아래 반응 칸(쉬워요/딱 좋아요/어려워요 ·
//     코치님께 의견 · 영상 없는 카드는 「영상 찍어 주세요」) — 코치진은 같은 자리에 회원 반응 숫자 · 의견에 답 (training/react)
// body 로 portal 한다 (2026-09-28): 상세 화면 루트의 animate-slide-up 이 끝난 뒤에도 transform 을 남겨
// 그 안의 fixed 시트가 화면이 아니라 긴 루트의 맨 아래에 붙었다 → 드릴을 눌러도 화면만 어두워지고 시트가 안 보였다.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Mic, Play, Plus, RotateCcw, Square, Volume2, VolumeX, X } from "lucide-react";
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
  hasMemberVideo,
  levelTag,
  nextCard,
  normalizeCard,
  type TrainingCard,
} from "@/lib/trainingCards";
import { useCardPosters, useCardVideo, useTrainingCards } from "@/services/trainingCardService";
import { logCardEvent } from "@/services/shelfLayoutService";
import { useCardSocial } from "@/services/cardReactService";
import { CardHeartButton, CardReactSection } from "@/components/training/react/CardReact";
import { pickKoreanVoice, speak, stopSpeech, type SpeakHandle } from "@/features/myboxer-visualization/mindAudio";
import {
  clampVideoRatio,
  learnSoundOn,
  playVoiceClip,
  primeLearnAudio,
  setLearnSoundOn,
  stopVoiceClip,
  videoAudioState,
} from "@/lib/learnAudio";
import { cardVoiceUrl } from "@/lib/cardVoice";
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
  /** 「내 수업에 담기」 (2026-11-14 영상으로 배우기 2단계) — 없으면 단추 없음 */
  onSaveToClass?: (card: TrainingCard) => void;
  /** 이미 내 수업에 담긴 카드인가 */
  savedToClass?: (card: TrainingCard) => boolean;
}

const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const TrainingDrillSheet = ({
  exercise,
  onClose,
  list,
  listIsShelf,
  related,
  onChange,
  footer,
  zClass = "z-[90]",
  onSaveToClass,
  savedToClass,
}: TrainingDrillSheetProps) => {
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
  // 반응 · 의견 (2026-11-15 3단계) — 서버에 함수가 없거나(옛 DB) 못 읽으면 칸을 그리지 않는다
  const reactItem = card ? `c:${card.id}` : null;
  const socialQ = useCardSocial(reactItem, !!card && !!user, staffViewer);
  const social = socialQ.data?.available ? socialQ.data.social : null;
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
  const speakingRef = useRef(false);
  const stop = useCallback(() => {
    runRef.current += 1;
    handleRef.current?.cancel();
    handleRef.current = null;
    stopSpeech();
    stopVoiceClip();
    speakingRef.current = false;
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
  // 🔈 소리 (2026-11-16) — 켠 채로가 기본 · 휴대폰이 막으면 소리 없이 틀고 「소리 켜기」 · 영상에 목소리가 있나
  const [soundOn, setSoundOn] = useState<boolean>(learnSoundOn);
  const [blocked, setBlocked] = useState(false);
  const [hasAudio, setHasAudioState] = useState<boolean | null>(null);
  const hasAudioRef = useRef<boolean | null>(null);
  const setHasAudio = (v: boolean | null) => {
    hasAudioRef.current = v;
    setHasAudioState(v);
  };
  const [ratio, setRatio] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const autoDoneRef = useRef<string | null>(null);
  useEffect(() => {
    setCoachOpen(false);
    setSlow(false);
    setBlocked(false);
    setHasAudio(null);
    setRatio(null);
    setEnded(false);
    autoDoneRef.current = null;
    scrollRef.current?.scrollTo({ top: 0 });
    return stop;
  }, [cardId, stop]);
  // 카드를 누른 순간(같은 누르기 안)에 소리를 깨워 둔다 — 아이폰이 자동 설명을 막지 않게
  useLayoutEffect(() => {
    if (cardId) primeLearnAudio();
  }, [cardId]);

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

  const url = video.data ?? null;
  const isStorageVideo = !!url && !!card?.video_path;
  const yt = url && !card?.video_path ? strictYoutubeId(url) : null;
  const poster = card ? posterOf(card) : null;

  // 🔊 설명 듣기 — 목소리 파일(드라이브 영상과 같은 목소리)이 있으면 그것, 없거나 못 틀면 휴대폰 목소리로 문장마다
  const cardRef = useRef(card);
  cardRef.current = card;
  const startNarration = useCallback(() => {
    const c = cardRef.current;
    if (!c) return;
    const lines = cardSpeech(c);
    if (!lines.length) return;
    const run = ++runRef.current;
    const finish = () => {
      if (runRef.current !== run) return;
      speakingRef.current = false;
      setSpeaking(false);
    };
    speakingRef.current = true;
    setSpeaking(true);
    void (async () => {
      const clip = cardVoiceUrl(c);
      if (clip) {
        const h = playVoiceClip(clip);
        handleRef.current = { done: h.done.then(() => undefined), cancel: h.cancel };
        const end = await h.done;
        if (runRef.current !== run) return;
        // 끝 · 멈춤 · 휴대폰이 막음(누르면 다시) → 여기서 끝, 파일이 없으면 휴대폰 목소리로
        if (end !== "failed") return finish();
      }
      if (!hasSpeech()) return finish();
      for (const line of lines) {
        if (runRef.current !== run) return;
        const h = speak(line, { enabled: true, voice: voiceRef.current, rate: 0.95 });
        handleRef.current = h;
        await h.done;
      }
      finish();
    })();
  }, []);

  // ▶ 영상 — 소리를 켠 채로 틀어 보고, 휴대폰이 막으면 소리 없이 틀고 「소리 켜기」
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url || !isStorageVideo) return;
    let gone = false;
    v.muted = !soundRef.current || speakingRef.current;
    v.play().catch((e: unknown) => {
      if (gone || (e as { name?: string } | null)?.name !== "NotAllowedError" || v.muted) return;
      setBlocked(true);
      v.muted = true;
      void v.play().catch(() => undefined);
    });
    return () => {
      gone = true;
    };
  }, [url, isStorageVideo]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !soundOn || blocked || speaking;
  }, [soundOn, blocked, speaking, url]);
  // 그림 비율을 먼저 알면 영상이 오기 전부터 그 모양으로 (가로 영상이 정사각으로 잘리지 않게)
  useEffect(() => {
    if (!poster) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio((r) => r ?? clampVideoRatio(img.naturalWidth / img.naturalHeight));
    };
    img.src = poster;
  }, [poster]);

  // 🔊 들어가면 설명 듣기 — 목소리 없는 영상 · 영상 없는 카드만(목소리 있는 영상은 더빙이 설명) · 소리를 꺼 둔 회원님은 안 함
  const hasVideoPath = !!card?.video_path;
  const videoLoading = video.isLoading;
  useEffect(() => {
    if (!cardId || autoDoneRef.current === cardId || !soundOn) return;
    const decide = (narrate: boolean) => {
      if (autoDoneRef.current === cardId) return;
      autoDoneRef.current = cardId;
      if (narrate) startNarration();
    };
    if (yt || (url && !isStorageVideo)) return decide(false); // 유튜브 · 링크 영상은 그 영상 소리로
    if (isStorageVideo) {
      if (hasAudio !== null) return decide(!hasAudio);
      // 영상이 늦게 오면 잠깐 기다렸다가 — 설명이 나오는 동안은 영상 소리를 끄니 겹치지 않는다
      const t = window.setTimeout(() => decide(hasAudioRef.current !== true), 2500);
      return () => window.clearTimeout(t);
    }
    if (hasVideoPath && videoLoading) return; // 영상 주소를 받는 중
    const t = window.setTimeout(() => decide(true), 450);
    return () => window.clearTimeout(t);
  }, [cardId, soundOn, hasAudio, isStorageVideo, url, yt, hasVideoPath, videoLoading, startNarration]);

  if (!card) return null;

  const shelf = cardShelf(card);
  const tag = levelTag(card, myLevel);
  const next =
    list && onChange ? nextCard(list.map((x) => normalizeCard(x as unknown as Record<string, unknown>)), card, { anyShelf: !!listIsShelf }) : null;
  const nextFull = next ? cardsQ.data?.find((c) => c.id === next.id) ?? next : null;
  const minutesKnown = card.minutes != null && Number(card.minutes) > 0;

  const listen = () => {
    autoDoneRef.current = card.id;
    if (speaking) {
      stop();
      return;
    }
    startNarration();
  };
  const canListen = hasSpeech() || !!cardVoiceUrl(card);

  // 소리 켜기 · 끄기 — 누른 순간 바로(아이폰은 누르기 안에서만 소리를 켤 수 있다)
  const toggleSound = () => {
    const v = videoRef.current;
    if (blocked || !soundOn) {
      setLearnSoundOn(true);
      setSoundOn(true);
      setBlocked(false);
      if (v) {
        v.muted = speakingRef.current;
        void v.play().catch(() => undefined);
      }
      return;
    }
    setLearnSoundOn(false);
    setSoundOn(false);
    if (v) v.muted = true;
    if (speakingRef.current) stop();
  };
  const onVideoMeta = (v: HTMLVideoElement) => {
    if (v.videoWidth && v.videoHeight) setRatio(clampVideoRatio(v.videoWidth / v.videoHeight));
    if (hasAudioRef.current === null) {
      const a = videoAudioState(v);
      if (a !== null) setHasAudio(a);
    }
  };
  const detectAudio = (v: HTMLVideoElement) => {
    if (hasAudioRef.current !== null || v.currentTime < 0.6) return;
    setHasAudio(videoAudioState(v, true) ?? false);
  };
  const replay = () => {
    const v = videoRef.current;
    setEnded(false);
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  };
  const showSoundHint = blocked && hasAudio !== false;

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

        {/* 영상 — 회원용(소리 켜고 · 가로는 가로 그대로 · 목소리 없는 영상은 반복) → 유튜브 링크 → 그림. 없으면 자리만 감춤 */}
        {isStorageVideo ? (
          <div className="relative w-full overflow-hidden rounded-t-3xl bg-black" style={{ aspectRatio: String(ratio ?? 1) }}>
            <video
              ref={videoRef}
              key={url}
              src={url}
              poster={poster ?? undefined}
              muted={!soundOn || blocked || speaking}
              loop={hasAudio !== true}
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => onVideoMeta(e.currentTarget)}
              onPlaying={(e) => {
                setEnded(false);
                onVideoPlaying();
                if (e.currentTarget.muted && !blocked && soundOn && !speakingRef.current) e.currentTarget.muted = false;
              }}
              onTimeUpdate={(e) => {
                onVideoTime(e.currentTarget);
                detectAudio(e.currentTarget);
              }}
              onEnded={() => {
                onLoopDone();
                setEnded(true);
              }}
              onClick={(e) => {
                const v = e.currentTarget;
                if (v.paused) void v.play();
                else v.pause();
              }}
              className="h-full w-full object-cover"
            />
            {/* 끝난 더빙 영상 — 다시 보기 */}
            {ended && (
              <button type="button" onClick={replay} className="absolute inset-0 flex items-center justify-center bg-black/35">
                <span className="flex h-12 items-center gap-2 rounded-full bg-background px-5 text-body font-bold text-foreground shadow-elev-1">
                  <RotateCcw className="h-4 w-4" aria-hidden /> 다시 보기
                </span>
              </button>
            )}
            {/* 소리 — 휴대폰이 막았으면 크게 「소리 켜기」, 아니면 작은 켜기 · 끄기 */}
            {showSoundHint ? (
              <button
                type="button"
                onClick={toggleSound}
                className="absolute bottom-3 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 px-5 text-body font-bold text-white shadow-elev-1 active:scale-95"
              >
                <Volume2 className="h-5 w-5" aria-hidden /> 소리 켜기
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundOn ? "소리 끄기" : "소리 켜기"}
                aria-pressed={soundOn}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white active:scale-90"
              >
                {soundOn ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
              </button>
            )}
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

          <div className="mt-2 flex items-start gap-3">
            <h3 className="min-w-0 flex-1 text-title font-black text-foreground">{card.name}</h3>
            {social && reactItem && social.viewer === "member" && <CardHeartButton item={reactItem} social={social} />}
          </div>
          {card.summary && <p className="mt-1 text-body font-bold text-primary">{card.summary}</p>}

          {/* 🔊 설명 듣기 · 🎙 코치용 영상 — 설명 듣기는 누르고 싶게 생긴 진짜 단추(차콜 바탕 · 민트 재생 동그라미 · 두 줄) */}
          <div className="mt-4 flex gap-2">
            {canListen && (
              <button
                type="button"
                onClick={listen}
                aria-pressed={speaking}
                aria-label={speaking ? "설명 멈추기" : "설명 듣기"}
                className="flex h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-foreground px-4 text-left text-background shadow-elev-1 ring-1 ring-black/5 transition-all active:scale-[0.97]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {speaking ? (
                    <Square className="h-4 w-4 fill-current" aria-hidden />
                  ) : (
                    <Play className="h-5 w-5 translate-x-px fill-current" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-black">{speaking ? "설명 듣는 중" : "설명 듣기"}</span>
                  <span className="block truncate text-label text-background/75">{speaking ? "누르면 멈춰요" : "눌러서 들어요"}</span>
                </span>
                {speaking ? (
                  <span className="flex h-5 shrink-0 items-end gap-0.5" aria-hidden>
                    {[0, 160, 320].map((d) => (
                      <span key={d} className="w-1 rounded-full bg-primary motion-safe:animate-pulse" style={{ height: d === 160 ? 18 : 12, animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                ) : (
                  <Volume2 className="h-5 w-5 shrink-0 text-background/75" aria-hidden />
                )}
              </button>
            )}
            {staffViewer && hasCoachVideo(card) && (
              <button
                type="button"
                onClick={() => setCoachOpen(true)}
                className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary/10 text-body font-bold text-primary transition-all active:scale-[0.98]"
              >
                <Mic className="h-4 w-4" /> 코치용 영상
              </button>
            )}
          </div>

          {/* 내 수업에 담기 — 담긴 카드면 ✓ (눌러서 다른 수업에도) */}
          {onSaveToClass && (
            <button
              type="button"
              onClick={() => onSaveToClass(card)}
              className={`mt-2 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-body font-bold transition-all active:scale-[0.98] ${
                savedToClass?.(card) ? "bg-primary/10 text-primary" : "border border-border bg-card text-foreground"
              }`}
            >
              {savedToClass?.(card) ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> 내 수업에 있어요 · 다른 수업에도
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={3} aria-hidden /> 내 수업에 담기
                </>
              )}
            </button>
          )}

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

          {/* 반응 · 의견 — 회원님: 쉬워요/어려워요 · 코치님께 의견 · 영상 찍어 주세요 / 코치진: 회원 반응 · 의견에 답 */}
          {social && reactItem && <CardReactSection item={reactItem} social={social} noVideo={!hasMemberVideo(card)} />}

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
