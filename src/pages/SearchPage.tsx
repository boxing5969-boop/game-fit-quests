/**
 * 🔍 기능 검색 (2026-10-01 대표님: "타이틀매치미션이라고 검색하면 타이틀매치 영상을 빠르게 확인할 수 있게").
 *
 * 한 칸에 치면 바로가기 · 영상 · 수업이 함께 나온다. 영상은 누르면 이 화면 위에서 바로 재생.
 * 띄어쓰기·초성("ㅌㅇㅌ")도 알아듣는다 — 규칙은 lib/appSearch.ts.
 * 검색어는 주소(?q=)에 남겨서, 결과를 열었다가 뒤로 오면 그대로 이어서 볼 수 있다.
 * 엔터(검색)를 누르면 맨 위 결과를 연다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink, Play, Search, X } from "lucide-react";
import GlyphTile from "@/components/icons/GlyphTile";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import { useAppSearchEntries } from "@/hooks/useAppSearch";
import { openCredentialChange } from "@/lib/appEvents";
import {
  GROUP_LABEL,
  SUGGESTED_QUERIES,
  clearRecent,
  groupHits,
  loadRecent,
  pushRecent,
  searchEntries,
  type SearchEntry,
} from "@/lib/appSearch";
import { cn } from "@/lib/utils";

const Chip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-full bg-card px-3.5 py-2 text-[13.5px] font-semibold text-foreground shadow-elev-1 ring-1 ring-border/60 active:scale-95"
  >
    {label}
  </button>
);

const FeatureRow = ({ e, onOpen }: { e: SearchEntry; onOpen: () => void }) => (
  <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/70">
    {e.glyph ? <GlyphTile name={e.glyph} size={40} /> : <span className="h-10 w-10 shrink-0 rounded-xl bg-secondary" />}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-bold text-foreground">{e.title}</span>
      {e.subtitle && <span className="block truncate text-[12.5px] text-muted-foreground">{e.subtitle}</span>}
    </span>
    {e.action.kind === "href" ? (
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/70" />
    ) : (
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    )}
  </button>
);

const VideoRow = ({ e, onOpen }: { e: SearchEntry; onOpen: () => void }) => (
  <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/70">
    <span className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
      {e.thumb && <img src={e.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center bg-black/15">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
          <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
        </span>
      </span>
    </span>
    <span className="min-w-0 flex-1">
      {e.badge && (
        <span className="mb-0.5 inline-flex rounded-md bg-reward/20 px-1.5 py-[1px] text-[10.5px] font-black text-reward">{e.badge}</span>
      )}
      <span className="line-clamp-2 block text-[14.5px] font-bold leading-snug text-foreground">{e.title}</span>
      {e.subtitle && <span className="block truncate text-[12px] text-muted-foreground">{e.subtitle}</span>}
    </span>
  </button>
);

const LessonRow = ({ e, onOpen }: { e: SearchEntry; onOpen: () => void }) => {
  const [dayPart, ...rest] = e.title.split(" · ");
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/70">
      <span className="flex h-10 w-[52px] shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[14px] font-black tabular-nums text-primary">
        {dayPart}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-foreground">{rest.join(" · ") || e.title}</span>
        {e.subtitle && <span className="block truncate text-[12.5px] text-muted-foreground">{e.subtitle}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
};

const SearchPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(() => params.get("q") ?? "");
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [video, setVideo] = useState<OverlayVideo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { entries, loadingContent } = useAppSearchEntries();

  // 들어오자마자 입력 칸에 커서
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // 검색어를 주소에 남긴다 (결과를 열었다가 뒤로 와도 그대로)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const cur = params.get("q") ?? "";
      const next = text.trim();
      if (cur === next) return;
      setParams(next ? { q: next } : {}, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, params, setParams]);

  const hits = useMemo(() => searchEntries(entries, text, 8), [entries, text]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const hasQuery = text.trim().length > 0;

  const closeVideo = useCallback(() => setVideo(null), []);

  const open = (e: SearchEntry) => {
    setRecent(pushRecent(text));
    const a = e.action;
    if (a.kind === "video") setVideo({ url: a.url, title: a.title });
    else if (a.kind === "route") navigate(a.to);
    else if (a.kind === "href") window.location.assign(a.href);
    else if (a.kind === "credentials") openCredentialChange();
  };

  const goBack = () => {
    // 검색 화면으로 바로 들어온 경우(새 창·주소 직접 입력)에는 홈으로.
    // history.length 는 앱 밖 기록까지 세서 믿을 수 없다 — 라우터가 붙이는 idx 로 앱 안 이전 화면이 있는지 본다
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg bg-background pb-10 text-foreground">
      <div className="sticky top-[env(safe-area-inset-top)] z-20 bg-background/95 px-3 pb-3 pt-2.5 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-secondary"
            aria-label="뒤로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <form
            role="search"
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-secondary px-3.5"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (hits[0]) open(hits[0].entry);
            }}
          >
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2.4} />
            <input
              ref={inputRef}
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder="기능·영상 찾기 (예: 타이틀매치)"
              enterKeyHint="search"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="기능·영상 검색"
            />
            {text && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  inputRef.current?.focus();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-foreground/25 active:scale-90"
                aria-label="검색어 지우기"
              >
                <X className="h-3.5 w-3.5 text-foreground" strokeWidth={2.6} />
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="px-4">
        {!hasQuery ? (
          <>
            <section aria-label="이렇게 찾아보세요" className="pt-2">
              <h2 className="mb-2.5 px-1 text-[13px] font-bold text-muted-foreground">이렇게 찾아보세요</h2>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((s) => (
                  <Chip key={s} label={s} onClick={() => setText(s)} />
                ))}
              </div>
            </section>
            {recent.length > 0 && (
              <section aria-label="최근 검색" className="mt-6">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-bold text-muted-foreground">최근 검색</h2>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecent();
                      setRecent([]);
                    }}
                    className="text-[12.5px] font-semibold text-muted-foreground active:opacity-60"
                  >
                    모두 지우기
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((s) => (
                    <Chip key={s} label={s} onClick={() => setText(s)} />
                  ))}
                </div>
              </section>
            )}
            <p className="mt-8 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
              띄어쓰기 없이 쳐도, 초성(ㅌㅇㅌ)만 쳐도 찾아요. 영상은 누르면 바로 재생돼요.
            </p>
          </>
        ) : groups.length === 0 ? (
          <div className="pt-10 text-center">
            <p className="text-[15px] font-bold text-foreground">‘{text.trim()}’ 결과가 없어요</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {loadingContent ? "영상·수업을 불러오는 중이에요. 잠시 후 다시 보여 드릴게요." : "다른 말로 찾아보세요"}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUERIES.slice(0, 5).map((s) => (
                <Chip key={s} label={s} onClick={() => setText(s)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {groups.map(({ group, hits: gh }) => (
              <section key={group} aria-label={GROUP_LABEL[group]}>
                <h2 className="mb-2 px-1 text-[13px] font-bold text-muted-foreground">
                  {GROUP_LABEL[group]} <span className="font-semibold">{gh.length}</span>
                </h2>
                <ul className={cn("divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1")}>
                  {gh.map(({ entry }) => (
                    <li key={entry.id}>
                      {group === "video" ? (
                        <VideoRow e={entry} onOpen={() => open(entry)} />
                      ) : group === "lesson" ? (
                        <LessonRow e={entry} onOpen={() => open(entry)} />
                      ) : (
                        <FeatureRow e={entry} onOpen={() => open(entry)} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {loadingContent && <p className="px-1 text-[12px] text-muted-foreground">영상·수업을 불러오는 중이에요…</p>}
          </div>
        )}
      </div>

      <VideoOverlay video={video} onClose={closeVideo} />
    </div>
  );
};

export default SearchPage;
