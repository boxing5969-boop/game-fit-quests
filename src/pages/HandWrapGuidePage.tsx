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
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 영상을 보며 직접 감는다.
 *   그리고 집에서 혼자 감아 보는 미션(HandWrapPracticeCard) — 다음 수업 때 코치님이 회원 상세에서 기록을 본다.
 *
 *   · 코치 영상: 훈련 라이브러리 '복싱 붕대 감기'에 코치가 넣은 영상 (있을 때만).
 *   · 글 · 그림: data/handWrapGuide.ts — 12단계 + 완성(글 · 손마다 애니메이션) · 흔한 실수 · 핵심 포인트.
 */
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Play, X } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import VideoPlayer from "@/components/VideoPlayer";
import HandWrapPracticeCard from "@/components/handwrap/HandWrapPracticeCard";
import HandWrapStepViewer from "@/components/handwrap/HandWrapStepViewer";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useHandWrapVideo } from "@/hooks/useHandWrap";
import { strictYoutubeId } from "@/lib/videoUrl";
import { HANDWRAP_KEY_POINTS, HANDWRAP_MISTAKES, HANDWRAP_NUMBERED_STEPS } from "@/data/handWrapGuide";

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

      {/* ── 12단계 설명서 — 코팅 설명서와 같은 순서의 그림 애니메이션 (2026-10-30 대표님) ── */}
      <section aria-labelledby="handwrap-steps-h" className="mt-4">
        <h2 id="handwrap-steps-h" className="px-1 text-heading text-foreground">
          {HANDWRAP_NUMBERED_STEPS}단계 설명서
        </h2>
        <p className="mt-0.5 px-1 text-label text-muted-foreground">그림을 누르면 붕대가 감기는 모습이 움직여요</p>
        <HandWrapStepViewer className="mt-2" />
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
