/**
 * 🧤 타이틀미션 카드 '설계 노트' 탭 — 3번 공격 · 3번 미트로 만든 이유 3편 (2026-11-05 대표님).
 *
 *   11:24 "글씨 크기 · 밸런스 UI 는 토스와 세계적 테크 기업처럼" — 상자를 줄이고 여백 · 굵기 · 크기로 나눈다.
 *   12:19 "잘 읽히는 페이지가 되도록 · 이미지와 글을 적절하게 · 가능하면 출처와 영상도"
 *     → 맨 위 실제 수업 사진 · 이야기 · 단계마다 153 입체 아이콘 · 연구 이름을 누르면 원문 · 편마다 영상
 *       (1편 = 레벨 10 미션 영상 3개, 2편 = TED 가완디 + 153 쇼츠, 3편 = TED 칙센트미하이).
 *     TED 는 표지가 강연자 얼굴 사진이라 그림 없이 글 카드로만 보여 준다(한국어 자막은 TED 페이지 링크).
 *
 *   순서: 세 편 칸 → 사진 → 작은 머리말 · 읽는 시간 → 큰 제목 한 문장 → 설명 → (숫자 두 칸) → 연구로 보면
 *   (편마다 '실험 자세히') → (153의 성장 순서) → 공부 · 세계 최고 팀 이야기 → 153 체육관에서는 → 오늘 해 볼 것 하나
 *   → (마무리 한 줄) → 출처 → 다음 편.
 *   내용은 lib/titleTeachLessons.ts 한 곳. 알림(레벨 10 이 되면 하루 한 편)은 ?why=1~3 으로 이 탭의 그 편을 연다.
 */
import { useCallback, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink, Play, Users } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { parseVideoTitle, youtubeId, youtubeThumb } from "@/hooks/useLevelVideos";
import { useTitleMatchVideos } from "@/hooks/useTitleMatchVideos";
import { icon3dSrc } from "@/lib/emoji3d/map";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { titleMissionGuideFor } from "@/lib/titleMissionGuide";
import {
  TITLE_TEACH_LESSONS,
  chantChunks,
  fillWho,
  lessonFor,
  readingMinutes,
  teachVideoEmbed,
  type TeachDay,
  type TeachVideo,
} from "@/lib/titleTeachLessons";
import { cn } from "@/lib/utils";

interface Props {
  day: TeachDay;
  onDay: (d: TeachDay) => void;
  /** 심사하는 사람 — 지점장님 · 관장님 · 코치님 */
  who: string;
  /** 지금 보는 리그 (외우는 말 덩어리 · 미션 영상을 그 리그 것으로) */
  league: string;
}

type Playing = { url: string; title: string; points: string[]; poster?: string | null };

const PANEL_ID = "title-teach-panel";

const hideImg = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = "hidden";
};

/** 바깥 링크 — 아이폰 앱은 앱 안 사파리 창, 그 밖은 새 창 */
const OutLink = ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={className}
    onClick={(e) => {
      if (!isIosApp()) return;
      e.preventDefault();
      void loadIosAppNative().then((n) => n.openInAppBrowser(href));
    }}
  >
    {children}
  </a>
);

/** 출처 이름 — 주소가 있으면 누르면 원문 */
const ByLine = ({ by, url }: { by: string; url?: string }) =>
  url ? (
    <OutLink
      href={url}
      className="inline-flex min-h-8 items-center gap-1 text-label text-muted-foreground underline decoration-border underline-offset-4"
    >
      {by}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </OutLink>
  ) : (
    <span className="inline-flex min-h-8 items-center text-label text-muted-foreground">{by}</span>
  );

const IconTile = ({ name }: { name: string }) => (
  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
    <img src={icon3dSrc(name)} alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" onError={hideImg} />
  </span>
);

const SectionTitle = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-end justify-between gap-3">
    <h5 className="text-heading font-bold tracking-tight text-foreground">{children}</h5>
    {aside}
  </div>
);

const PlayDot = ({ size = "md" }: { size?: "sm" | "md" }) => (
  <span
    aria-hidden
    className={cn(
      "flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm",
      size === "sm" ? "h-8 w-8" : "h-10 w-10",
    )}
  >
    <Play className={cn("ml-0.5", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} fill="currentColor" />
  </span>
);

/** TED 강연 — 얼굴 사진 표지 없이 글 카드 */
const TalkCard = ({ v, onPlay }: { v: TeachVideo; onPlay: () => void }) => (
  <div className="mt-5 overflow-hidden rounded-2xl bg-foreground text-background">
    <button type="button" onClick={onPlay} className="flex w-full items-center gap-4 p-4 text-left transition-opacity active:opacity-90">
      <span className="min-w-0 flex-1">
        <span className="block text-micro font-bold text-background/70">
          TED 강연{v.length ? ` · ${v.length}` : ""}
        </span>
        <span className="mt-1 block text-body font-bold leading-snug">{v.title}</span>
        <span className="mt-1 block text-label text-background/75">{v.by}</span>
      </span>
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
      </span>
    </button>
    {v.koUrl && (
      <OutLink
        href={v.koUrl}
        className="flex h-11 items-center justify-between border-t border-background/15 px-4 text-label font-bold text-background/85"
      >
        TED에서 한국어 자막으로 보기
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
      </OutLink>
    )}
  </div>
);

/** 153 쇼츠 — 세로 표지 + 글 */
const ShortCard = ({ v, onPlay }: { v: TeachVideo; onPlay: () => void }) => (
  <button
    type="button"
    onClick={onPlay}
    className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-secondary/70 p-3 text-left transition-transform active:scale-[0.99]"
  >
    <span className="relative block w-[84px] shrink-0 overflow-hidden rounded-xl bg-muted">
      {v.poster && (
        <img src={v.poster} alt="" width={84} height={149} className="aspect-[9/16] w-full object-cover" loading="lazy" decoding="async" onError={hideImg} />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <PlayDot />
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-micro font-bold text-primary">153 쇼츠</span>
      <span className="mt-1 block text-body font-bold leading-snug text-foreground">{v.title}</span>
      <span className="mt-1 block text-label text-muted-foreground">{v.by}</span>
    </span>
  </button>
);

const TitleTeachTab = ({ day, onDay, who, league }: Props) => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openDetail, setOpenDetail] = useState<ReadonlySet<number>>(() => new Set());
  const [showSources, setShowSources] = useState(false);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const closePlayer = useCallback(() => setPlaying(null), []);
  useModalDismiss(!!playing, closePlayer);

  const lesson = lessonFor(day);
  const minutes = readingMinutes(lesson);
  const chunks = chantChunks(titleMissionGuideFor(league)?.chant ?? "");
  const prev = day > 1 ? ((day - 1) as TeachDay) : null;
  const next = day < 3 ? ((day + 1) as TeachDay) : null;

  // 1편 — 그 리그 레벨 10 미션 영상 (타이틀매치 화면과 같은 캐시)
  const { data: titleVideos } = useTitleMatchVideos();
  const missionVideos = lesson.titleVideo
    ? (titleVideos ?? []).filter((v) => v.league === league && youtubeId(v.videoUrl)).slice(0, 3)
    : [];

  const videosAt = (place: TeachVideo["place"]) => (lesson.videos ?? []).filter((v) => v.place === place);
  const playTeachVideo = (v: TeachVideo) =>
    setPlaying({ url: teachVideoEmbed(v), title: v.title, points: [...(v.points ?? [])], poster: v.poster ?? null });

  const renderVideos = (place: TeachVideo["place"]) =>
    videosAt(place).map((v) =>
      v.kind === "ted" ? (
        <TalkCard key={v.id} v={v} onPlay={() => playTeachVideo(v)} />
      ) : (
        <ShortCard key={v.id} v={v} onPlay={() => playTeachVideo(v)} />
      ),
    );

  const pick = (d: TeachDay, scroll = false) => {
    setOpenDetail(new Set());
    setShowSources(false);
    onDay(d);
    // 아래 '다음 편'으로 넘기면 새 편의 사진부터 보이게
    if (scroll) requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const toggleDetail = (i: number) =>
    setOpenDetail((cur) => {
      const nextSet = new Set(cur);
      if (nextSet.has(i)) nextSet.delete(i);
      else nextSet.add(i);
      return nextSet;
    });

  return (
    <div ref={rootRef} className="scroll-mt-20 px-5 pt-4">
      {/* 세 편 */}
      <div role="tablist" aria-label="설계 노트 고르기" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
        {TITLE_TEACH_LESSONS.map((l) => (
          <button
            key={l.day}
            type="button"
            role="tab"
            aria-selected={l.day === day}
            aria-controls={PANEL_ID}
            onClick={() => pick(l.day)}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-label font-bold transition-colors",
              l.day === day ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-micro font-bold",
                l.day === day ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {l.day}
            </span>
            <span className="truncate">{l.tab}</span>
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-live="polite">
        {/* 사진 — 153복싱짐 실제 수업 */}
        <figure className="relative mt-4 overflow-hidden rounded-2xl bg-muted">
          <img
            key={lesson.hero.src}
            src={lesson.hero.src}
            alt={lesson.hero.alt}
            width={720}
            height={450}
            className="aspect-[16/10] w-full object-cover"
            decoding="async"
            onError={hideImg}
          />
          <figcaption className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/55 px-3 py-1 text-micro font-bold text-white backdrop-blur-sm">
            {lesson.hero.caption}
          </figcaption>
        </figure>

        {/* 머리 — 작은 머리말 · 읽는 시간 · 큰 제목 한 문장 · 설명 */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-label font-bold text-primary">{lesson.kicker}</p>
          <p className="flex shrink-0 items-center gap-1 text-label text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            읽는 데 {minutes}분
          </p>
        </div>
        <h4 className="mt-1.5 text-title font-bold leading-snug tracking-tight text-foreground">{lesson.title}</h4>
        <p className="mt-3 text-body leading-relaxed text-muted-foreground">{lesson.lead}</p>

        {/* 숫자로 보기 (3편) */}
        {lesson.stats && (
          <section className="mt-8">
            <SectionTitle>{lesson.stats.title}</SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {lesson.stats.items.map((s) => (
                <div key={s.value} className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-label leading-snug text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-title font-bold tabular-nums tracking-tight text-foreground">{s.value}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-background" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(2, s.pct))}%` }} />
                  </div>
                  <p className="mt-2 text-micro tabular-nums text-muted-foreground">{s.calc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-body font-bold leading-snug text-foreground">{lesson.stats.note}</p>
          </section>
        )}

        {/* 연구로 보면 */}
        <section className="mt-10">
          <SectionTitle aside={<span className="text-label text-muted-foreground">연구 {lesson.research.length}개</span>}>
            연구로 보면
          </SectionTitle>
          <ol className="mt-2 divide-y divide-border/70">
            {lesson.research.map((r, i) => {
              const open = openDetail.has(i);
              return (
                <li key={i} className="flex gap-3 py-4">
                  <span aria-hidden className="w-5 shrink-0 text-body font-bold tabular-nums leading-relaxed text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body leading-relaxed text-foreground">{r.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4">
                      <ByLine by={r.by} url={r.url} />
                      {r.detail && (
                        <button
                          type="button"
                          onClick={() => toggleDetail(i)}
                          aria-expanded={open}
                          className="inline-flex min-h-8 items-center gap-0.5 text-label font-bold text-primary"
                        >
                          실험 자세히
                          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
                        </button>
                      )}
                    </div>
                    {open && r.detail && (
                      <p className="mt-2 rounded-xl bg-secondary/70 px-4 py-3 text-label leading-relaxed text-muted-foreground">
                        {r.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 153의 성장 순서 (3편) */}
        {lesson.steps && (
          <section className="mt-8">
            <SectionTitle>{lesson.steps.title}</SectionTitle>
            <ol className="mt-4">
              {lesson.steps.items.map((s, i, all) => (
                <li key={s.label} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <IconTile name={s.icon} />
                    {i < all.length - 1 && <span aria-hidden className="my-1.5 w-0.5 flex-1 rounded-full bg-border" />}
                  </div>
                  <div className={cn("min-w-0 flex-1 pt-1", i < all.length - 1 && "pb-5")}>
                    <p className="text-body font-bold leading-snug text-foreground">{s.label}</p>
                    <p className="mt-1 text-body leading-relaxed text-foreground">{s.text}</p>
                    {s.by && <ByLine by={s.by} url={s.url} />}
                  </div>
                </li>
              ))}
            </ol>
            {renderVideos("steps")}
          </section>
        )}

        {/* 공부 · 세계 최고 팀 이야기 */}
        {lesson.stories && (
          <section className="mt-8">
            <SectionTitle>{lesson.stories.title}</SectionTitle>
            <ul className="mt-4 space-y-6">
              {lesson.stories.items.map((s) => (
                <li key={s.who} className="flex gap-3.5">
                  <IconTile name={s.icon} />
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-body font-bold leading-snug text-foreground">{s.who}</p>
                    <p className="mt-1 text-body leading-relaxed text-foreground">{s.text}</p>
                    {s.by && <ByLine by={s.by} url={s.url} />}
                  </div>
                </li>
              ))}
            </ul>
            {renderVideos("stories")}
          </section>
        )}

        {/* 153 체육관에서는 */}
        <section className="mt-10">
          <SectionTitle>153 체육관에서는</SectionTitle>
          {day === 1 && chunks.length > 0 && (
            <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="9동작 외우는 말">
              {chunks.map((c, i) => (
                <li key={i} className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">
                  {c}
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-4 space-y-3">
            {lesson.gym.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-body leading-relaxed text-foreground">
                <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>

          {/* 1편 — 레벨 10 미션 영상 (미트를 대 줄 자리를 먼저 보기) */}
          {missionVideos.length > 0 && (
            <div className="mt-6">
              <p className="text-label font-bold text-muted-foreground">9동작 시범 영상 · 누르면 재생</p>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {missionVideos.map((v, i) => {
                  const id = youtubeId(v.videoUrl);
                  const name = parseVideoTitle(v.title).name || v.title;
                  return (
                    <li key={v.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPlaying({
                            url: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
                            title: name,
                            points: v.keyPoints,
                            poster: v.posterUrl,
                          })
                        }
                        className="block w-full text-left transition-transform active:scale-[0.98]"
                      >
                        <span className="relative block overflow-hidden rounded-xl bg-muted">
                          <img
                            src={v.posterUrl ?? youtubeThumb(v.videoUrl) ?? ""}
                            alt=""
                            className="aspect-[3/4] w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={hideImg}
                          />
                          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-micro font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <PlayDot size="sm" />
                          </span>
                        </span>
                        <span className="mt-1.5 line-clamp-2 block text-label font-bold leading-snug text-foreground">{name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {renderVideos("gym")}
        </section>

        {/* 오늘 해 볼 것 — 하나 */}
        <div className="mt-8 rounded-2xl bg-primary/10 p-5">
          <p className="text-label font-bold text-primary">오늘 해 볼 것</p>
          <p className="mt-1 text-heading font-bold leading-snug text-foreground">{fillWho(lesson.action.text, who)}</p>
          {lesson.action.kind === "partner" && (
            <button
              type="button"
              onClick={() => navigate("/myboxer/community?together=1")}
              className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <Users className="h-4 w-4" aria-hidden /> 오늘 같이 해요에서 파트너 찾기
            </button>
          )}
        </div>

        {/* 마무리 한 줄 (3편) */}
        {lesson.closing && (
          <div className="mt-10 text-center">
            <p className="text-title font-bold tracking-tight text-foreground">{lesson.closing.line}</p>
            <p className="mt-1.5 text-label font-bold text-muted-foreground">{lesson.closing.sub}</p>
          </div>
        )}

        {/* 출처 — 누르면 원문 */}
        <section className="mt-8 border-t border-border/70">
          <button
            type="button"
            onClick={() => setShowSources((v) => !v)}
            aria-expanded={showSources}
            className="flex h-12 w-full items-center justify-between text-label font-bold text-muted-foreground"
          >
            연구 · 기사 출처 {lesson.sources.length}개
            <ChevronDown className={cn("h-4 w-4 transition-transform", showSources && "rotate-180")} aria-hidden />
          </button>
          {showSources && (
            <ol className="space-y-3 pb-2">
              {lesson.sources.map((s, i) => (
                <li key={i} className="flex gap-2 text-label leading-snug text-muted-foreground">
                  <span aria-hidden className="w-4 shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  {s.url ? (
                    <OutLink href={s.url} className="min-w-0 break-words underline decoration-border underline-offset-4">
                      {s.label}
                    </OutLink>
                  ) : (
                    <span className="min-w-0 break-words">{s.label}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 다음 편 · 앞 편 */}
        {next && (
          <button
            type="button"
            onClick={() => pick(next, true)}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-secondary/70 px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-label font-bold text-primary">
                다음 · {next}편 {lessonFor(next).tab}
              </span>
              <span className="mt-0.5 block truncate text-body font-bold text-foreground">{lessonFor(next).title}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
        {prev && (
          <button
            type="button"
            onClick={() => pick(prev, true)}
            className="mt-2 inline-flex h-10 items-center gap-0.5 rounded-full pr-2 text-label font-bold text-muted-foreground active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> {prev}편 {lessonFor(prev).tab}
          </button>
        )}
      </div>

      {/* 영상 창 — body 로 띄워 어떤 부모 아래서도 화면 전체를 덮는다 */}
      {playing &&
        createPortal(
          <VideoPlayer
            videoUrl={playing.url}
            posterUrl={playing.poster}
            title={playing.title}
            keyPoints={playing.points}
            onClose={closePlayer}
          />,
          document.body,
        )}
    </div>
  );
};

export default TitleTeachTab;
