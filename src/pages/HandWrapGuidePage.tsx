/**
 * 🥊 붕대 감기 — 영상(각도 2개) · 사진으로 한 장씩 · 집 연습 미션 (2026-10-13 대표님 처음 만듦).
 *
 *   2026-10-17 대표님: "붕대 감기 버튼 손이 이상해 … 2가지 방식 모두 지워줘. 내가 직접 영상 찍어서 올려야 할 것 같아"
 *     → 그림으로 따라 하기를 지우고 영상을 맨 위로.
 *   2026-10-20 대표님: "구글 드라이브에 오늘 날짜로 붕대 감는 동영상 올렸거든 — 앱에 적용해 주고 다양한 각도로 회원님들이
 *     쉽게 보고 배울 수 있도록. 한 장 한 장 사진과 설명으로, 영상이 어려운 분들은 그림을 보고 배울 수 있게"
 *     → 대표님 영상 2개 = '옆에서' · '앞에서' 두 각도 (플레이어 안에서도 바꿔 볼 수 있고, 거울 · 0.5배속도 된다)
 *     → '사진으로 한 장씩' 10장 (components/handwrap/HandWrapStepViewer) — '이 장면 영상으로 보기'로 그 장면 초부터 영상
 *     → 같은 날 "애니메이션화 · 배경 없애 줘 · 감는 방향 상세하게" → '한 단계씩' = 배경 지운 짧은 반복 영상 + 방향 화살표
 *   2026-10-27 대표님: "화질도 많이 깨지고 … 방향이랑 속도 조절 등을 통해 좀 더 잘 따라 할 수 있게 · 한눈에 처음부터 끝까지 설명서처럼"
 *     → 큰 영상에 '내 눈으로'(앞에서 찍은 영상을 180도 = 내 손을 내려다보는 방향) · 처음 속도 0.75배
 *     → '한 단계씩' = 실제로 감는 장면(선명하게) · 속도 · 왼손/오른손(거울) · '한눈에 설명서' (HandWrapStepViewer)
 *   2026-10-27 10:01 대표님: "한눈에 9장 · 누르면 상세페이지처럼 · 사진에 방향과 어디서 시작해 어디로 · 움직이는 사진으로 · 한 단계씩"
 *     → '9단계 설명서' = 한눈에 9칸(사진 + 방향 + 짧은 글) → 누르면 상세(/handwrap?step=N): 움직이는 사진 → 끝 장면에 시작 → 끝 방향 → 반복
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 영상을 보며 직접 감는다.
 *   그리고 집에서 혼자 감아 보는 미션(HandWrapPracticeCard) — 다음 수업 때 코치님이 회원 상세에서 기록을 본다.
 *
 *   · 영상: data/handWrapGuide HANDWRAP_ANGLES (public/handwrap/) + 훈련 라이브러리 '복싱 붕대 감기'에 코치가 넣은
 *     영상이 있으면 '코치 영상' 칸으로 하나 더.
 *   · 글: data/handWrapGuide.ts — 9단계(글 · 움직이는 사진 · 방향 좌표) · 흔한 실수 · 영상 핵심 포인트.
 */
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, FlipHorizontal2, Gauge, Play, X } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import VideoPlayer, { type PlayerVariant } from "@/components/VideoPlayer";
import HandWrapPracticeCard from "@/components/handwrap/HandWrapPracticeCard";
import HandWrapStepViewer from "@/components/handwrap/HandWrapStepViewer";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useHandWrapVideo } from "@/hooks/useHandWrap";
import { strictYoutubeId } from "@/lib/videoUrl";
import {
  HANDWRAP_ANGLES,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  handWrapAngleIndex,
  type HandWrapStep,
} from "@/data/handWrapGuide";

/** VideoPlayer 는 youtu.be·watch 주소만 embed 로 바꾼다 — shorts·embed 주소도 youtu.be 로 맞춰 넘긴다 (유튜브 호스트일 때만) */
const playableUrl = (url: string) => {
  const id = strictYoutubeId(url);
  return id ? `https://youtu.be/${id}` : url;
};

/** 플레이어를 어느 각도 · 몇 초로 열지 */
type Opened = { variant: number; startAt?: number };

const HandWrapGuidePage = () => {
  const navigate = useNavigate();
  const [opened, setOpened] = useState<Opened | null>(null);
  const closePlayer = useCallback(() => setOpened(null), []);
  useModalDismiss(!!opened, closePlayer);
  const coach = useHandWrapVideo();

  // 각도 2개 + (있으면) 코치가 훈련 라이브러리에 넣은 영상
  const variants = useMemo<PlayerVariant[]>(() => {
    const list: PlayerVariant[] = HANDWRAP_ANGLES.map((a) => ({
      label: a.label,
      videoUrl: a.videoUrl,
      posterUrl: a.posterUrl,
      rotate180: a.rotate180,
    }));
    const extra = coach.data?.url;
    if (extra && !HANDWRAP_ANGLES.some((a) => extra.endsWith(a.videoUrl))) {
      list.push({ label: "코치 영상", videoUrl: playableUrl(extra), posterUrl: coach.data?.poster ?? null });
    }
    return list;
  }, [coach.data]);

  const watchStep = (step: HandWrapStep) => setOpened({ variant: handWrapAngleIndex(step.video.angle), startAt: step.video.at });

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="붕대 감기"
          sticky
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
        />
      }
    >
      {/* 설명은 한 줄씩 (2026-10-28 리디자인 — 회색 설명 줄은 칸마다 한 줄) */}
      <p className="px-1 text-label text-muted-foreground">
        첫날엔 코치님이 한 손을 감아 드려요 · 다른 손은 보면서 직접 감아 봐요
      </p>

      {/* ── 영상 — 두 각도 ── */}
      <section aria-labelledby="handwrap-video-h" className="mt-4">
        {/* '내 눈으로'가 가장 쉽다는 말은 영상 칸의 '추천' · 한 줄 설명이 한다 */}
        <h2 id="handwrap-video-h" className="px-1 text-heading text-foreground">
          영상으로 보기
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {HANDWRAP_ANGLES.map((a, i) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setOpened({ variant: i })}
              aria-label={`붕대 감기 영상 ${a.label} 보기`}
              className={`group block overflow-hidden rounded-2xl bg-card text-left shadow-elev-1 ring-1 ring-border/60 ${
                i === 0 ? "col-span-2" : ""
              }`}
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={a.posterUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover ${a.rotate180 ? "rotate-180" : ""}`}
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-active:scale-90">
                    <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                  </span>
                </span>
                <span className="absolute bottom-1.5 right-2 rounded bg-black/55 px-1.5 text-micro font-bold tabular-nums text-white">
                  0:{String(a.seconds).padStart(2, "0")}
                </span>
              </span>
              <span className="block px-3 py-2.5">
                <span className="block text-label font-black text-foreground">
                  {a.label} 보기
                  {i === 0 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-px text-micro font-black text-primary">추천</span>}
                </span>
                <span className="block truncate text-label text-muted-foreground">{a.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-muted-foreground">
            <FlipHorizontal2 className="h-3.5 w-3.5" /> 거울 — 좌우를 뒤집어 거울 보듯
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> 처음엔 0.75배 · 0.5배까지 천천히
          </span>
        </div>
      </section>

      {/* ── 9단계 설명서 — 한눈에 9칸 → 누르면 움직이는 사진 + 방향 + 자세한 설명 (2026-10-27 대표님) ── */}
      <section aria-labelledby="handwrap-steps-h" className="mt-7">
        {/* 점 색은 아래 표시(시작 · 끝 · 붕대 길)가, 오른손은 '오른손 (거울)' 단추가 말한다 */}
        <h2 id="handwrap-steps-h" className="px-1 text-heading text-foreground">
          9단계 설명서
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">사진을 누르면 감는 모습이 움직여요</p>
        <HandWrapStepViewer onWatch={watchStep} className="mt-2" />
      </section>

      {/* ── 집 연습 미션 ── */}
      <section aria-labelledby="handwrap-home-h" className="mt-7">
        <h2 id="handwrap-home-h" className="px-1 text-heading text-foreground">
          집에서 혼자 감아 보기
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">감아 본 날 눌러요 · 코치님 앞에서 혼자 감으면 끝!</p>
        <HandWrapPracticeCard variant="page" className="mt-2" />
      </section>

      {/* ── 흔한 실수 ── */}
      <section aria-labelledby="handwrap-mistakes-h" className="mt-7">
        <h2 id="handwrap-mistakes-h" className="px-1 text-heading text-foreground">
          이것만 조심해요
        </h2>
        <ul className="mt-2 space-y-2">
          {HANDWRAP_MISTAKES.map((m) => (
            <li key={m.wrong} className="rounded-2xl bg-card px-4 py-3 shadow-elev-1 ring-1 ring-border/60">
              <p className="flex items-start gap-2 text-label font-bold leading-snug text-foreground">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={2.6} />
                {m.wrong}
              </p>
              <p className="mt-1 flex items-start gap-2 text-label leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
                {m.fix}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 px-1 text-label leading-relaxed text-muted-foreground">
        감은 뒤 손이 저리거나 손목·손가락이 계속 아프면 운동을 멈추고 코치님께 말해 주세요.
      </p>

      {/* 영상 플레이어 — body 로 띄워 어떤 부모 아래서도 화면 전체를 덮는다 */}
      {opened &&
        createPortal(
          <VideoPlayer
            key={`${opened.variant}-${opened.startAt ?? 0}`}
            videoUrl={variants[0].videoUrl}
            posterUrl={variants[0].posterUrl}
            variants={variants}
            initialVariant={opened.variant}
            startAt={opened.startAt}
            mirrorable
            initialSpeed={0.75}
            title="153 붕대 감기"
            keyPoints={[...HANDWRAP_KEY_POINTS]}
            onClose={closePlayer}
          />,
          document.body,
        )}
    </AppPage>
  );
};

export default HandWrapGuidePage;
