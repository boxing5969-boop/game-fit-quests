// 🥊 내 레벨 연습하기 — 훈련 탭 '오늘의 코스' 3번 (2026-09-28, '50분 수업하기'를 대체).
//
// 대표님 기획: "레벨 1부터 레벨 10까지는 레벨 10 타이틀매치 동작을 완벽하게 만드는 과정"
//   · 맨 위 🏆 목표 — 이 리그 레벨 10 타이틀매치 영상 + 1~10 여정(지금 위치)
//   · 그 아래 이번 레벨 동작 — 관장님이 올린 레벨 영상(missions + mission_videos)과 동작 포인트(key_point 1~3)
//   · 지나온 레벨 번호를 누르면 그 레벨 동작을 복습한다 (앞 레벨은 잠금)
//   · 영상이 아직 없는 리그(블루·레드·블랙)는 앱 레벨 데이터(allLevelsData — 레벨 지도·코스 카드와 같은
//     제목)의 동작 포인트 글로 대신한다. 교육 그림(curriculumImages)은 다른 원고 기준이라 제목과 어긋나는
//     레벨이 있어(예: 블루 2 '잽 마스터리' 글 ↔ '1-2-3 콤비' 그림) 여기엔 붙이지 않는다.
//   · 영상이 있는 레벨은 영상 기준으로만 보여준다 — 커리큘럼 글과 올린 영상의 레벨 배치가 달라서
//     둘을 섞으면 "레벨 3 = 카운터" 글 옆에 십자스텝 영상이 붙는다.
//   · 맨 위 🔥 워밍업 — 레벨과 상관없는 몸풀기 참고 영상(줄넘기 등, missions.category='warmup'). 따라했어요·진행에 안 들어간다.
// 따라했어요 체크는 영상 마스터·오늘의 영상과 같은 기기 저장(153_video_watched)을 공유한다.
// "오늘 연습 완료"는 levelPractice 가 기기에 KST 날짜로 남기고, 코스 3번이 그걸 보고 완료 표시한다.
import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CheckCircle2, Play, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getLevelById } from "@/data/allLevelsData";
import { RANK_LABELS, RANK_ORDER, formatRank } from "@/lib/rankLabels";
import VideoPlayer from "@/components/VideoPlayer";
import {
  useLevelVideos, useWarmupVideos, useWatchedVideos, parseVideoTitle, youtubeId, youtubeThumb,
  type LevelVideo,
} from "@/hooks/useLevelVideos";
import { hasPracticedToday, markPracticedToday } from "@/lib/levelPractice";

/** 각 리그의 타이틀매치 레벨 */
const TITLE_LEVEL = 10;
const LEVELS = Array.from({ length: TITLE_LEVEL }, (_, i) => i + 1);
const NEXT_STAGE: Record<string, string> = {
  white: "블루 리그", blue: "레드 리그", red: "블랙 리그", black: "마스터",
};

/** VideoPlayer 는 youtu.be·watch 주소만 embed 로 바꾼다 — shorts·embed 주소도 youtu.be 로 맞춰 넘긴다 */
const playableUrl = (url: string) => {
  const id = youtubeId(url);
  return id ? `https://youtu.be/${id}` : url;
};

/** 플레이어의 '실사 | 애니메이션' 칸 — 버전마다 같은 주소 정리 */
const playerVariants = (v: LevelVideo) =>
  v.variants.map((x) => ({ label: x.label, videoUrl: playableUrl(x.videoUrl), posterUrl: x.posterUrl }));

const hideImg = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

/** 번호 달린 동작 포인트 목록 */
const PointList = ({ points }: { points: string[] }) =>
  points.length === 0 ? null : (
    <ol className="mt-2.5 space-y-1.5">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5 text-[12px] leading-snug text-foreground">{p}</span>
        </li>
      ))}
    </ol>
  );

interface Props {
  league: string;
  /** 이 화면을 연 레벨 (보통 회원의 지금 레벨) */
  levelNumber: number;
  onBack: () => void;
}

const MyLevelPractice = ({ league, levelNumber, onBack }: Props) => {
  const { user, progress } = useAuth();
  const [viewLevel, setViewLevel] = useState(levelNumber);
  const [playing, setPlaying] = useState<LevelVideo | null>(null);
  // 워밍업 영상은 보기만 한다(따라했어요 없음) — 레벨 영상 플레이어와 따로 연다
  const [warmupPlaying, setWarmupPlaying] = useState<LevelVideo | null>(null);
  const [doneToday, setDoneToday] = useState(() => hasPracticedToday(user?.id));
  const { watched, toggle, countFor } = useWatchedVideos();
  const { data: levelVideos = [], isLoading: levelLoading } = useLevelVideos(league, viewLevel);
  const { data: titleVideos = [], isLoading: titleLoading } = useLevelVideos(league, TITLE_LEVEL);
  const { data: warmupVideos = [] } = useWarmupVideos();

  // 코스 카드에서 눌러 들어오면 화면 맨 위(목표)부터 보이게
  useEffect(() => {
    try { window.scrollTo({ top: 0 }); } catch { /* 무시 */ }
  }, []);

  const ranks = RANK_ORDER as readonly string[];
  const leagueLabel = RANK_LABELS[league] || league;
  const leagueIdx = Math.max(0, ranks.indexOf(league));

  // 여정은 회원의 실제 위치 기준 — 상세 화면에서 지난 레벨로 들어와도 "지금 레벨"은 진짜 지금 레벨.
  // 1~10 = 이 리그 안, 11 이상 = 이 리그 타이틀매치 통과.
  const memberRankIdx = progress ? ranks.indexOf(progress.current_rank) : -1;
  const rawHere = progress && memberRankIdx >= 0
    ? (memberRankIdx - leagueIdx) * 10 + (progress.current_level || 1)
    : levelNumber;
  // 레벨 10 에 머물러 있어도 이 리그 타이틀매치를 이미 통과했으면(블랙 마스터 등) 통과로 본다
  const clearedHere = (progress?.bosses_cleared ?? 0) >= leagueIdx + 1;
  const hereLevel = rawHere === TITLE_LEVEL && clearedHere ? TITLE_LEVEL + 1 : rawHere;
  const stateOf = (n: number): "done" | "current" | "locked" =>
    n < hereLevel ? "done" : n === hereLevel ? "current" : "locked";
  // 앞 레벨은 잠금 — 단, 이 화면을 연 레벨은 항상 볼 수 있다
  const canView = (n: number) => stateOf(n) !== "locked" || n === levelNumber;

  const journeyLine =
    hereLevel > TITLE_LEVEL
      ? `${leagueLabel} 타이틀매치 통과! 지나온 레벨을 눌러 복습할 수 있어요`
      : hereLevel === TITLE_LEVEL
        ? `지금이 타이틀매치예요 — 통과하면 ${NEXT_STAGE[league] ?? "다음 단계"}!`
        : hereLevel >= 1
          ? `지금 레벨 ${hereLevel} · 타이틀매치까지 ${TITLE_LEVEL - hereLevel}레벨 남았어요`
          : `${leagueLabel} 리그 미리 보기`;

  const isTitleView = viewLevel === TITLE_LEVEL;
  const isReview = viewLevel !== levelNumber;
  const viewUl = getLevelById(league, viewLevel);
  const goalUl = getLevelById(league, TITLE_LEVEL);
  const goalPoints = (goalUl?.learningModules ?? []).flatMap((m) => m.keyPoints).slice(0, 4);
  const doneCount = countFor(levelVideos.map((v) => v.id));

  // 플레이어의 "따라했어요"는 체크만 한다(이미 체크된 걸 해제하지 않게)
  const markWatched = (id: string) => {
    if (!watched[id]) toggle(id);
  };

  const finish = () => {
    if (!doneToday) {
      markPracticedToday(user?.id);
      setDoneToday(true);
      toast.success("오늘 연습 완료! 🥊 이 동작이 모여 타이틀매치가 돼요");
    }
    onBack();
  };

  return (
    <div className="animate-slide-up space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 오늘의 코스로
      </button>

      <div>
        <h2 className="text-lg font-black text-foreground">🥊 내 레벨 연습하기</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{formatRank(league, levelNumber)}</p>
      </div>

      {/* ── 🔥 워밍업 — 연습 전 몸풀기 참고 영상 (레벨과 상관없음) ── */}
      {warmupVideos.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-3.5 shadow-elev-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-black text-foreground">🔥 워밍업</p>
            <span className="text-[10px] font-bold text-muted-foreground">연습 전 몸풀기 · 참고용</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {warmupVideos.map((v) => {
              const t = parseVideoTitle(v.title);
              const thumb = v.posterUrl || youtubeThumb(v.videoUrl);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setWarmupPlaying(v)}
                  aria-label={`워밍업 ${t.name} 영상 보기`}
                  className="min-w-0 text-left transition-transform active:scale-[0.97]"
                >
                  <span className="relative block aspect-video overflow-hidden rounded-xl bg-muted">
                    {thumb && (
                      <img src={thumb} alt="" loading="lazy" onError={hideImg} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-white text-white" />
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[11px] font-bold leading-tight text-foreground">{t.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 🏆 최종 목표: 레벨 10 타이틀매치 영상 → 1~10 여정 ── */}
      <section className="rounded-3xl border-2 border-reward/40 bg-card p-4 shadow-elev-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-reward/15">
            <Trophy className="h-5 w-5 text-reward" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-wide text-reward">최종 목표 · 레벨 {TITLE_LEVEL}</p>
            <p className="text-base font-black leading-snug text-foreground">{leagueLabel} 타이틀매치</p>
          </div>
        </div>

        {/* 타이틀매치 영상 — 지금 보는 게 레벨 10 이면 아래 목록과 겹치므로 여기선 생략 */}
        {isTitleView ? (
          <p className="mt-3 rounded-2xl bg-reward/10 py-2.5 text-center text-[12px] font-bold text-reward">
            아래가 바로 타이틀매치 동작이에요 👇
          </p>
        ) : titleLoading ? (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">타이틀매치 영상 불러오는 중...</p>
        ) : titleVideos.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {titleVideos.map((v, i) => {
              const t = parseVideoTitle(v.title);
              const thumb = v.posterUrl || youtubeThumb(v.videoUrl);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setPlaying(v)}
                  aria-label={`타이틀매치 동작 ${i + 1} ${t.name} 영상 보기`}
                  className="min-w-0 text-left transition-transform active:scale-[0.97]"
                >
                  <span className="relative block aspect-video overflow-hidden rounded-xl border border-reward/30 bg-muted">
                    {thumb && (
                      <img src={thumb} alt="" loading="lazy" onError={hideImg} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-white text-white" />
                      </span>
                    </span>
                    {watched[v.id] && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-complete">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[10px] font-black text-reward">동작 {i + 1}</span>
                  <span className="line-clamp-2 block text-[11px] font-bold leading-tight text-foreground">{t.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-reward/5 p-3">
            <p className="text-[11px] font-black text-foreground">타이틀매치에서 보여줄 것</p>
            <PointList points={goalPoints} />
            <p className="mt-2 text-[10px] text-muted-foreground">🎬 타이틀매치 영상은 준비 중이에요</p>
          </div>
        )}

        <p className="mt-3.5 text-[13px] font-black leading-snug text-foreground">
          레벨 1~10은 이 동작을 완벽하게 만드는 과정이에요
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          레벨마다 익힌 동작이 모여 타이틀매치에서 하나로 완성돼요
        </p>

        {/* 1~10 여정 — 지나온 레벨·지금 레벨은 눌러서 그 레벨 동작을 본다 */}
        <div className="mt-3 grid grid-cols-10 gap-1" aria-label={`${leagueLabel} 리그 레벨 여정`}>
          {LEVELS.map((n) => {
            const st = stateOf(n);
            const isGoal = n === TITLE_LEVEL;
            const isView = n === viewLevel;
            const tone = isGoal
              ? st === "locked"
                ? "border border-reward/50 bg-reward/10 text-reward"
                : "bg-reward text-reward-foreground"
              : st === "done"
                ? "bg-status-complete/15 text-status-complete"
                : st === "current"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground";
            return (
              <button
                key={n}
                type="button"
                disabled={!canView(n)}
                onClick={() => setViewLevel(n)}
                aria-pressed={isView}
                aria-label={`레벨 ${n}${isGoal ? " 타이틀매치" : ""}${st === "current" ? " (지금 레벨)" : st === "locked" ? " (잠김)" : ""}`}
                className={`number-font flex aspect-square w-full items-center justify-center rounded-full text-[11px] font-black transition-all active:scale-90 disabled:active:scale-100 ${tone} ${
                  isView ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-card" : ""
                }`}
              >
                {isGoal ? "🏆" : n}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-center text-[12px] font-bold text-foreground">{journeyLine}</p>
        {hereLevel > 1 && hereLevel <= TITLE_LEVEL && (
          <p className="mt-0.5 text-center text-[10px] text-muted-foreground">지나온 레벨을 누르면 복습할 수 있어요</p>
        )}
      </section>

      {/* ── 이번 레벨 동작 (복습 중이면 그 레벨) ── */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-foreground">
              {isTitleView ? `🏆 ${leagueLabel} 타이틀매치 동작` : `🥊 레벨 ${viewLevel} 동작`}
              {isReview && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[10px] font-bold text-secondary-foreground">
                  복습
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {levelLoading || levelVideos.length > 0 ? "영상을 보고 동작 포인트대로 따라해요" : "동작 포인트대로 따라해요"}
            </p>
          </div>
          {levelVideos.length > 0 && (
            <span className="number-font shrink-0 rounded-full bg-status-complete/10 px-2 py-0.5 text-[11px] font-black text-status-complete">
              {doneCount}/{levelVideos.length} 따라함
            </span>
          )}
        </div>
        {isReview && (
          <button
            type="button"
            onClick={() => setViewLevel(levelNumber)}
            className="text-[12px] font-bold text-primary active:scale-95"
          >
            ← 레벨 {levelNumber} 동작으로 돌아가기
          </button>
        )}

        {levelLoading ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">동작 불러오는 중...</p>
          </div>
        ) : levelVideos.length > 0 ? (
          levelVideos.map((v, i) => {
            const t = parseVideoTitle(v.title);
            const thumb = v.posterUrl || youtubeThumb(v.videoUrl);
            const isDone = !!watched[v.id];
            return (
              <div
                key={v.id}
                className={`rounded-2xl border bg-card p-3 shadow-elev-1 transition-colors ${
                  isDone ? "border-status-complete/40" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPlaying(v)}
                  className="flex w-full items-center gap-3 text-left active:scale-[0.99]"
                >
                  <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {thumb && (
                      <img src={thumb} alt="" loading="lazy" onError={hideImg} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                        <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black text-primary">
                      동작 {i + 1}{t.tag ? ` · ${t.tag}` : ""}
                    </span>
                    <span className="line-clamp-2 block text-[13px] font-black leading-snug text-foreground">{t.name}</span>
                    {t.sub && <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground">{t.sub}</span>}
                    {v.variants.length > 1 && (
                      <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-bold text-secondary-foreground">
                        🎬 {v.variants.map((x) => x.label).join(" · ")}
                      </span>
                    )}
                  </span>
                </button>
                <PointList points={v.keyPoints} />
                <button
                  type="button"
                  onClick={() => toggle(v.id)}
                  className={`mt-2.5 w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 ${
                    isDone
                      ? "bg-status-complete/10 text-status-complete"
                      : "border border-primary/40 text-primary"
                  }`}
                >
                  {isDone ? "✓ 따라했어요 (해제)" : "따라했어요 체크"}
                </button>
              </div>
            );
          })
        ) : (
          <>
            <div className="rounded-2xl border border-dashed border-border bg-card p-3.5">
              <p className="text-[12px] font-black text-foreground">🎬 이 레벨 영상은 준비 중이에요</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                아래 동작 포인트로 먼저 연습해요{viewUl ? ` · ${viewUl.title}` : ""}
              </p>
            </div>
            {(viewUl?.learningModules ?? []).map((mod) => (
              <div key={mod.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-elev-1">
                <p className="text-[13px] font-black text-foreground">{mod.title}</p>
                <PointList points={mod.keyPoints} />
                {mod.coachCues && mod.coachCues.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {mod.coachCues.map((c, i) => (
                      <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        🗣 {c}
                      </span>
                    ))}
                  </div>
                )}
                {mod.commonMistakes && mod.commonMistakes.length > 0 && (
                  <p className="mt-2 text-[11px] leading-snug text-status-pending">
                    ⚠️ 조심: {mod.commonMistakes.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </section>

      {/* ── 오늘 연습 완료 → 오늘의 코스 3번 완료 ── */}
      <div className="space-y-1.5 pt-1">
        <button
          type="button"
          onClick={finish}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black transition-all active:scale-[0.98] ${
            doneToday
              ? "bg-status-complete/10 text-status-complete"
              : "bg-primary text-primary-foreground shadow-elev-1"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {doneToday ? "오늘 연습 완료 · 코스로 돌아가기" : "오늘 연습 완료"}
        </button>
        {!doneToday && (
          <p className="text-center text-[11px] text-muted-foreground">연습을 마치면 눌러주세요 — 오늘의 코스 3번이 완료돼요</p>
        )}
      </div>

      {/* 영상 플레이어 — 동작 포인트와 함께. body 로 portal 한다:
          이 화면 루트의 animate-slide-up 은 끝난 뒤에도 transform 을 남겨(fill-mode both) 그 안의 fixed 가
          화면이 아니라 루트 기준으로 붙는다 → 아래로 스크롤한 뒤 누르면 플레이어가 화면 밖에 뜬다. */}
      {playing && createPortal(
        <VideoPlayer
          videoUrl={playableUrl(playing.videoUrl)}
          posterUrl={playing.posterUrl}
          variants={playerVariants(playing)}
          title={parseVideoTitle(playing.title).name}
          keyPoints={playing.keyPoints}
          onClose={() => setPlaying(null)}
          onStartChallenge={() => {
            markWatched(playing.id);
            setPlaying(null);
          }}
          challengeLabel="따라했어요 ✓"
        />,
        document.body,
      )}

      {/* 워밍업 플레이어 — 보기만 (따라했어요 버튼 없음) */}
      {warmupPlaying && createPortal(
        <VideoPlayer
          videoUrl={playableUrl(warmupPlaying.videoUrl)}
          posterUrl={warmupPlaying.posterUrl}
          variants={playerVariants(warmupPlaying)}
          title={parseVideoTitle(warmupPlaying.title).name}
          keyPoints={warmupPlaying.keyPoints}
          onClose={() => setWarmupPlaying(null)}
        />,
        document.body,
      )}
    </div>
  );
};

export default MyLevelPractice;
