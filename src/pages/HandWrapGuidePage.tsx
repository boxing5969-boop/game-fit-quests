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
 *   2026-10-30 대표님: 코팅 설명서 사진 "이사진이랑 동일하게 붕대 감기 탭에 고화질 애니메이션으로 제작해서 넣어줘"
 *     → 맨 위가 '12단계 설명서'(그림 애니메이션 · 오른손/왼손) — 9단계와 대표님 10-20 영상 칸('영상으로 보기')은 내렸다.
 *       훈련 라이브러리에 코치가 넣은 영상이 있으면 '코치 영상 보기' 단추만 남는다.
 *   2026-11-12 대표님: "붕대 감는 거 연습하는 거 내가 찍어 논 영상 있잖아 — 영상도 나오게 해 주고 현재 있는 메뉴얼도 있게 해 주고,
 *     회원님들이 최대한 쉽게 붕대 감는 것을 학습할 수 있도록 글과 영상 이미지 활용해서 디자인해 줘"
 *     → 배우는 순서대로 다시 짰다: ① 영상으로 먼저 보기(전체 44초 · 내 눈으로/옆에서 · 순서는 3 · 3 · 3)
 *       → ② 12단계 설명서(한눈에 그림 그대로 — 칸을 누르면 그 단계만 '실제 영상 | 그림'으로 반복) → ③ 다 감았으면 확인(실제 사진 + 다섯 가지)
 *       → ④ 집에서 혼자 감아 보기 → 이것만 조심해요.
 *     → 영상은 10-20 원본(1080p)에서 손 쪽으로 다시 잘라 만든 더 선명한 판 (public/handwrap/real). 감는 손을 고르면 영상 · 사진 · 그림이 함께 바뀐다.
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 영상을 보며 직접 감는다.
 *   그리고 집에서 혼자 감아 보는 미션(HandWrapPracticeCard) — 다음 수업 때 코치님이 회원 상세에서 기록을 본다.
 *
 *   · 코치 영상: 훈련 라이브러리 '복싱 붕대 감기'에 코치가 넣은 영상 (있을 때만).
 *   · 글 · 그림 · 영상 주소: data/handWrapGuide.ts — 12단계 + 완성(글 · 손마다 애니메이션 · 실제 영상) · 큰 흐름 · 전체 영상 · 완성 확인 · 흔한 실수 · 핵심 포인트.
 *   · 단계 상세(주소 ?step=N)는 이 화면이 쥔다 (hooks/useHandWrapStepNav) — 전체 영상 칸 · 12단계 한눈에가 같은 상세를 연다.
 */
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Play, X } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import VideoPlayer from "@/components/VideoPlayer";
import HandWrapDoneCheck from "@/components/handwrap/HandWrapDoneCheck";
import HandWrapFullVideo from "@/components/handwrap/HandWrapFullVideo";
import HandWrapPracticeCard from "@/components/handwrap/HandWrapPracticeCard";
import HandWrapStepDetail from "@/components/handwrap/HandWrapStepDetail";
import HandWrapStepViewer from "@/components/handwrap/HandWrapStepViewer";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useHandWrapVideo } from "@/hooks/useHandWrap";
import { useHandWrapStepNav } from "@/hooks/useHandWrapStepNav";
import { strictYoutubeId } from "@/lib/videoUrl";
import { HANDWRAP_KEY_POINTS, HANDWRAP_MISTAKES, HANDWRAP_NUMBERED_STEPS, HANDWRAP_STEPS, handWrapStepLabel } from "@/data/handWrapGuide";

/** VideoPlayer 는 youtu.be·watch 주소만 embed 로 바꾼다 — shorts·embed 주소도 youtu.be 로 맞춰 넘긴다 (유튜브 호스트일 때만) */
const playableUrl = (url: string) => {
  const id = strictYoutubeId(url);
  return id ? `https://youtu.be/${id}` : url;
};

const HandWrapGuidePage = () => {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const closePlayer = useCallback(() => setOpened(false), []);
  useModalDismiss(opened, closePlayer);
  const coach = useHandWrapVideo();
  const coachUrl = coach.data?.url ? playableUrl(coach.data.url) : null;
  const stepNav = useHandWrapStepNav();

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

      {/* ── ① 영상으로 먼저 보기 — 전체 44초 + 순서는 3 · 3 · 3 (2026-11-12 대표님) ── */}
      <section aria-labelledby="handwrap-video-h" className="mt-4">
        <h2 id="handwrap-video-h" className="px-1 text-heading text-foreground">
          영상으로 먼저 보기
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">처음부터 끝까지 한 번 보면 순서가 잡혀요</p>
        <HandWrapFullVideo className="mt-2" onOpenStep={stepNav.open} covered={stepNav.openIdx != null} />
      </section>

      {/* ── ② 12단계 설명서 — 코팅 설명서와 같은 순서 (2026-10-30 대표님) · 칸을 누르면 실제 영상 | 그림 (2026-11-12) ── */}
      <section aria-labelledby="handwrap-steps-h" className="mt-7">
        <h2 id="handwrap-steps-h" className="px-1 text-heading text-foreground">
          {HANDWRAP_NUMBERED_STEPS}단계 설명서
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">칸을 누르면 그 단계만 영상 · 그림으로 반복해요</p>
        <HandWrapStepViewer className="mt-2" onOpen={stepNav.open} />
        {coachUrl && (
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-card text-label font-bold text-primary shadow-elev-1 ring-1 ring-primary/40 transition-transform active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 코치 영상 보기
          </button>
        )}
      </section>

      {/* ── ③ 다 감았으면 확인 — 실제 사진 + 다섯 가지 (2026-11-12) ── */}
      <section aria-labelledby="handwrap-check-h" className="mt-7">
        <h2 id="handwrap-check-h" className="px-1 text-heading text-foreground">
          다 감았으면 확인해요
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">내 손과 사진을 견줘 보고 하나씩 눌러요</p>
        <HandWrapDoneCheck className="mt-2" />
      </section>

      {/* ── ④ 집 연습 미션 ── */}
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
              {/* 바르게 하는 모습 — 그 단계 영상으로 (2026-11-12) */}
              {m.step != null && (
                <button
                  type="button"
                  onClick={() => stepNav.open(m.step as number)}
                  aria-label={`${handWrapStepLabel(m.step)} ${HANDWRAP_STEPS[m.step].title} 영상 보기`}
                  className="ml-6 mt-1.5 inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-foreground transition-transform active:scale-95"
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden /> {handWrapStepLabel(m.step)} 보기
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 px-1 text-label leading-relaxed text-muted-foreground">
        감은 뒤 손이 저리거나 손목·손가락이 계속 아프면 운동을 멈추고 코치님께 말해 주세요.
      </p>

      {/* 한 단계씩 따라 하기 — 주소 ?step=N · body 로 띄운다 */}
      {stepNav.openIdx != null &&
        createPortal(
          <HandWrapStepDetail idx={stepNav.openIdx} onGo={stepNav.go} onClose={stepNav.close} />,
          document.body,
        )}

      {/* 코치 영상 플레이어 — body 로 띄워 어떤 부모 아래서도 화면 전체를 덮는다 */}
      {opened &&
        coachUrl &&
        createPortal(
          <VideoPlayer
            videoUrl={coachUrl}
            posterUrl={coach.data?.poster ?? null}
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
