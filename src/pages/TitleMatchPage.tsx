/**
 * 🏆 타이틀매치 — 레벨 10 · 20 · 30 · 40 심사 동작 영상만 모아 둔 메뉴 (2026-10-01 대표님).
 *
 *   · 위 네 칸 = 화이트·블루·레드·블랙 리그의 마지막 관문. 누르면 그 리그 타이틀매치 동작 영상이 아래에 나온다.
 *   · 처음엔 '내가 도전할 타이틀매치'가 골라져 있다. 주소 ?lv=20 으로 바로 열 수도 있다 (검색·랭크업에서 씀).
 *   · 영상 = 그 리그 Lv.10 미션 영상 (hooks/useTitleMatchVideos). 코치 화면 → 미션에서 올리면 여기에 바로 나온다.
 *     아직 영상이 없는 리그는 '준비 중' — 2026-10-01 기준 화이트만 있고 블루·레드·블랙은 준비 중.
 *   · 영상을 누르면 동작 포인트와 함께 크게 재생. '따라했어요'는 내 레벨 연습과 같은 기기 저장(153_video_watched)을 쓴다.
 */
import { useCallback, useMemo, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Play, RotateCcw } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import VideoPlayer from "@/components/VideoPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { parseVideoTitle, useWatchedVideos, youtubeId, youtubeThumb } from "@/hooks/useLevelVideos";
import { useTitleMatchVideos } from "@/hooks/useTitleMatchVideos";
import { formatRankShort } from "@/lib/rankLabels";
import {
  TITLE_STAGES,
  defaultStage,
  groupByLeague,
  levelsLeft,
  previousStage,
  stageFromParam,
  stageState,
  type MemberSpot,
  type StageState,
  type TitleLeague,
  type TitleStage,
  type TitleVideo,
} from "@/lib/titleMatch";
import { cn } from "@/lib/utils";

/** 리그 색 점·막대 — 다크 화면에서 블랙 리그가 묻히지 않게 테두리 */
const LEAGUE_DOT: Record<TitleLeague, string> = {
  white: "bg-rank-white",
  blue: "bg-rank-blue",
  red: "bg-rank-red",
  black: "bg-rank-black dark:ring-1 dark:ring-white/50",
};

/** VideoPlayer 는 youtu.be·watch 주소만 embed 로 바꾼다 — shorts·embed 주소도 youtu.be 로 맞춰 넘긴다 */
const playableUrl = (url: string) => {
  const id = youtubeId(url);
  return id ? `https://youtu.be/${id}` : url;
};

const hideImg = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

const PANEL_ID = "title-match-panel";
const HEADING_ID = "title-match-heading";

// ── 위 네 칸 ────────────────────────────────────────────────

const StageTile = ({
  stage,
  count,
  loading,
  state,
  selected,
  onSelect,
}: {
  stage: TitleStage;
  count: number;
  loading: boolean;
  state: StageState | null;
  selected: boolean;
  onSelect: () => void;
}) => {
  const status = loading ? "…" : count > 0 ? `영상 ${count}` : "준비 중";
  const spoken = [
    `레벨 ${stage.level} ${stage.name} 타이틀매치`,
    loading ? "불러오는 중" : count > 0 ? `영상 ${count}개` : "영상 준비 중",
    state === "mine" ? "내 리그" : state === "passed" ? "통과" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={PANEL_ID}
      aria-label={spoken}
      onClick={onSelect}
      className={cn(
        "relative flex min-w-0 flex-col items-center rounded-2xl bg-card px-1 pb-2.5 pt-3 shadow-elev-1 transition-transform active:scale-[0.97]",
        selected ? "ring-2 ring-foreground" : "ring-1 ring-border/70",
      )}
    >
      {state === "mine" && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 text-[10px] font-black leading-4 text-primary-foreground">
          내 리그
        </span>
      )}
      {state === "passed" && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-complete">
          <Check className="h-2.5 w-2.5 text-reward-foreground" strokeWidth={3.5} />
        </span>
      )}
      <span className="text-[10.5px] font-bold text-muted-foreground">레벨</span>
      <span className="text-[26px] font-black leading-none tabular-nums text-foreground">{stage.level}</span>
      <span className="mt-1.5 flex items-center gap-1 text-[12px] font-bold text-foreground">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", LEAGUE_DOT[stage.league])} />
        {stage.name}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[10.5px] font-semibold",
          !loading && count > 0 ? "text-reward" : "text-muted-foreground",
        )}
      >
        {status}
      </span>
    </button>
  );
};

// ── 영상 카드 ───────────────────────────────────────────────

const VideoCard = ({
  video,
  index,
  done,
  onPlay,
}: {
  video: TitleVideo;
  index: number;
  done: boolean;
  onPlay: () => void;
}) => {
  const t = parseVideoTitle(video.title);
  const thumb = video.posterUrl || youtubeThumb(video.videoUrl);
  const name = t.name || video.title;
  return (
    <li className="overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60">
      <button
        type="button"
        onClick={onPlay}
        aria-label={`동작 ${index + 1} ${name} 영상 보기`}
        className="group block w-full text-left"
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-muted">
          {thumb && <img src={thumb} alt="" loading="lazy" onError={hideImg} className="h-full w-full object-cover" />}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/15" />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-black text-white backdrop-blur-sm">
            동작 {index + 1}
          </span>
          {done && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-status-complete px-2 py-1 text-[11px] font-black text-reward-foreground">
              <Check className="h-3 w-3" strokeWidth={3.5} /> 따라했어요
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-active:scale-90">
              <Play className="ml-1 h-6 w-6 fill-white text-white" />
            </span>
          </span>
        </span>
      </button>
      <div className="px-4 pb-4 pt-3">
        {t.tag && <p className="text-[11.5px] font-bold text-primary">{t.tag}</p>}
        <h3 className="text-[16px] font-black leading-snug text-foreground">{name}</h3>
        {t.sub && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{t.sub}</p>}
        {video.keyPoints.length > 0 && (
          <ol className="mt-3 space-y-1.5 rounded-xl bg-secondary/70 p-3" aria-label="동작 포인트">
            {video.keyPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-reward/20 text-[10.5px] font-black text-reward">
                  {i + 1}
                </span>
                <span className="min-w-0 text-[13px] leading-snug text-foreground">{p}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  );
};

// ── 화면 ───────────────────────────────────────────────────

const TitleMatchPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { progress, role } = useAuth();
  const { data: videos, isLoading, isError, refetch, isRefetching } = useTitleMatchVideos();
  const { watched, toggle } = useWatchedVideos();
  const [playing, setPlaying] = useState<TitleVideo | null>(null);
  const closePlayer = useCallback(() => setPlaying(null), []);
  useModalDismiss(!!playing, closePlayer);

  const spot = useMemo<MemberSpot | null>(
    () =>
      progress
        ? {
            rank: progress.current_rank,
            level: progress.current_level || 1,
            bossesCleared: progress.bosses_cleared ?? 0,
          }
        : null,
    [progress],
  );

  // 고른 칸은 주소(?lv=)에 둔다 — 영상을 보고 와도, 새로고침해도 그대로
  const stage = stageFromParam(params.get("lv")) ?? defaultStage(spot);
  const select = (s: TitleStage) => setParams({ lv: String(s.level) }, { replace: true });

  const byLeague = useMemo(() => groupByLeague(videos ?? []), [videos]);
  const list = byLeague[stage.league];
  const state = stageState(stage, spot);
  const prev = previousStage(stage);
  const isHq = role === "super_admin";

  const statusLine =
    state === "passed"
      ? "통과했어요 · 복습용으로 언제든 다시 보세요"
      : state === "mine" && spot
        ? levelsLeft(spot) === 0
          ? "지금이 타이틀매치예요 — 아래 동작으로 심사를 받아요"
          : `지금 ${formatRankShort(spot.rank, spot.level)} · 타이틀매치까지 ${levelsLeft(spot)}레벨 남았어요`
        : state === "ahead" && prev
          ? `미리 보기 · ${prev.name} 타이틀매치를 넘으면 도전해요`
          : null;

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const markWatched = (id: string) => {
    if (!watched[id]) toggle(id);
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="타이틀매치"
          subtitle="레벨 10 · 20 · 30 · 40 심사 동작 영상"
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
      <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
        리그마다 마지막 관문이에요. 그동안 배운 동작을 모아 심사를 받고, 통과하면 다음 리그로 올라가요.
      </p>

      {/* 네 개의 관문 */}
      <div role="tablist" aria-label="타이틀매치 고르기" className="mt-5 grid grid-cols-4 gap-2">
        {TITLE_STAGES.map((s) => (
          <StageTile
            key={s.league}
            stage={s}
            count={byLeague[s.league].length}
            loading={isLoading}
            state={stageState(s, spot)}
            selected={s.league === stage.league}
            onSelect={() => select(s)}
          />
        ))}
      </div>

      {/* 고른 관문의 영상 */}
      <section id={PANEL_ID} role="tabpanel" aria-labelledby={HEADING_ID} className="mt-6">
        <div className="flex items-stretch gap-3">
          <span aria-hidden className={cn("w-1 shrink-0 rounded-full", LEAGUE_DOT[stage.league])} />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[12px] font-bold text-muted-foreground">{stage.name} 리그 마지막 관문</p>
            <h2 id={HEADING_ID} className="text-[19px] font-black leading-tight text-foreground">
              레벨 {stage.level} 타이틀매치
            </h2>
            {statusLine && (
              <p
                className={cn(
                  "mt-1 text-[12.5px] font-semibold leading-snug",
                  state === "mine" ? "text-primary" : "text-muted-foreground",
                )}
              >
                {statusLine}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <ul className="space-y-3" aria-busy="true" aria-label="영상 불러오는 중">
              {[0, 1].map((i) => (
                <li key={i} className="overflow-hidden rounded-2xl bg-card shadow-elev-1">
                  <div className="aspect-video w-full animate-pulse bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
              <p className="text-[15px] font-bold text-foreground">영상을 불러오지 못했어요</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">인터넷 연결을 확인하고 다시 시도해 주세요</p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-[13px] font-bold text-foreground active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className={cn("h-4 w-4", isRefetching && "animate-spin")} /> 다시 시도
              </button>
            </div>
          ) : list.length > 0 ? (
            <ul className="space-y-3">
              {list.map((v, i) => (
                <VideoCard key={v.id} video={v} index={i} done={!!watched[v.id]} onPlay={() => setPlaying(v)} />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-9 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Clapperboard className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="mt-3 text-[15px] font-bold text-foreground">영상 준비 중이에요</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {stage.name} 타이틀매치 동작 영상이 올라오면
                <br />
                여기에서 바로 볼 수 있어요
              </p>
              {state === "mine" && (
                <button
                  type="button"
                  onClick={() => navigate("/missions?open=practice")}
                  className="mt-4 inline-flex h-10 items-center gap-1 rounded-full bg-foreground px-4 text-[13px] font-bold text-background active:scale-95"
                >
                  지금 레벨 동작 연습하기 <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {isHq && (
                <p className="mt-4 rounded-xl bg-secondary px-3 py-2.5 text-left text-[11.5px] leading-relaxed text-muted-foreground">
                  관리자 안내 · 코치 화면 → 🎯 미션 → 추가에서 레벨을 ‘{stage.name} Lv.10’으로 고르고 영상 주소를
                  넣으면 여기에 바로 나와요
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 심사 기준·관문 직행권 — 랭크업 안내 페이지(정적, /rankup) */}
      <a
        href="/rankup"
        className="mt-6 flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-elev-1 ring-1 ring-border/60 transition-transform active:scale-[0.99]"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-foreground">심사 기준 · 관문 직행권 안내</span>
          <span className="block truncate text-[12px] text-muted-foreground">레벨이 오르는 길과 타이틀매치를 한 장으로</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      </a>

      {/* 영상 플레이어 — 동작 포인트와 함께. body 로 띄워 어떤 부모 아래서도 화면 전체를 덮는다 */}
      {playing &&
        createPortal(
          <VideoPlayer
            videoUrl={playableUrl(playing.videoUrl)}
            posterUrl={playing.posterUrl}
            variants={playing.variants.map((x) => ({ label: x.label, videoUrl: playableUrl(x.videoUrl), posterUrl: x.posterUrl }))}
            title={parseVideoTitle(playing.title).name || playing.title}
            keyPoints={playing.keyPoints}
            onClose={closePlayer}
            onStartChallenge={() => {
              markWatched(playing.id);
              closePlayer();
            }}
            challengeLabel="따라했어요 ✓"
          />,
          document.body,
        )}
    </AppPage>
  );
};

export default TitleMatchPage;
