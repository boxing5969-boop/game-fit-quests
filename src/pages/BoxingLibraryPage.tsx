// 153플레이 — 넷플릭스식 브라우즈 화면.
//
// 홈(히어로 + 가로 스크롤 행) / 레벨(리그·레벨별 미션 영상) / 월드(외부 큐레이션) 3개 뷰.
// 영상은 전체화면 플레이어 오버레이로 열린다.
//
// ⚠️ 월드(boxing_programs = 외부 채널 큐레이션)는 전 회원에게 열려 있고,
//    저작권 소지가 있는 영상만 DB RLS 가 걸러낸다 (UI 에서 따로 막지 않는다).
//    · official / creator (공식 채널 · 제작자 본인 채널) → visibility='public' → 전 회원
//    · reupload / archive (재업로드 · 방송 아카이브) → visibility='admin' → 관리자만
//    회원 계정에는 애초에 해당 행이 내려오지 않는다.
//
// 가치 전달: 영상마다 핵심 포인트(키포인트)를 함께 보여주고, 시청 완료 시
// 오삼이 코치가 "몸으로 완성하러 가자"고 잇는다 — 예습(영상) → 출석(3회) → 레벨업.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Star, Clock, ExternalLink, CheckCircle2, PlayCircle, Play, X, Film,
} from "lucide-react";
import { RANK_LABELS } from "@/data/sharedConstants";
import {
  useLevelVideos, useWatchedVideos, youtubeId, youtubeThumb, parseVideoTitle,
  type LevelVideo,
} from "@/hooks/useLevelVideos";

// ───────────────────────── 데이터 ─────────────────────────

interface ProgramLite {
  id: string; yt_id: string; title: string; channel: string | null; country: string | null;
  tags: string[] | null; league: string; minutes: number | null; score: number | null;
  platform: string | null; visibility: string | null; rights_tier: string | null;
}
interface ProgramFull extends ProgramLite {
  equipment: string[] | null; summary: string | null; coach_points: string[] | null; target: string | null;
}

const W_LEAGUES = ["전체", "화이트", "블루", "레드", "블랙"] as const;
const W_TIMES = ["전체", "~10분", "10~20분", "20분+"] as const;
const LEAGUE_BADGE: Record<string, string> = {
  화이트: "bg-white text-black",
  블루: "bg-blue-600 text-white",
  레드: "bg-red-600 text-white",
  블랙: "bg-black text-primary border border-primary/40",
};
const TIER_LABEL: Record<string, string> = {
  official: "공식", creator: "제작자", reupload: "재업로드", archive: "아카이브",
};

const thumbOf = (yt: string) => `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
const wideOf = (yt: string) => `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`;
// 유튜브 외 플랫폼(인스타그램 릴스)은 썸네일·임베드 경로가 다르다
const isIG = (p: { platform?: string | null }) => (p.platform ?? "youtube") === "instagram";
const igUrl = (code: string) => `https://www.instagram.com/reel/${code}/`;

/** 월드 라이브러리 전체 (RLS 가 회원/관리자에 맞는 행만 내려준다) */
const useWorldPrograms = () =>
  useQuery({
    queryKey: ["boxing-library"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ProgramLite[]> => {
      const cols =
        "id, yt_id, title, channel, country, tags, league, minutes, score, platform, visibility, rights_tier";
      const out: ProgramLite[] = [];
      for (let off = 0; off < 4000; off += 1000) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("boxing_programs").select(cols).eq("is_active", true)
          .order("score", { ascending: false }).range(off, off + 999);
        if (error) throw error;
        const page = (data || []) as ProgramLite[];
        out.push(...page);
        if (page.length < 1000) break;
      }
      return out;
    },
  });

type WatchedApi = ReturnType<typeof useWatchedVideos>;

// 카드 하나 = 레벨 미션 영상 또는 월드 프로그램
type Item = { kind: "level"; v: LevelVideo } | { kind: "world"; p: ProgramLite };

const itemId = (it: Item) => (it.kind === "level" ? `L:${it.v.id}` : `W:${it.p.id}`);
const itemThumb = (it: Item): string | null =>
  it.kind === "level"
    ? it.v.posterUrl || youtubeThumb(it.v.videoUrl)
    : isIG(it.p) ? null : thumbOf(it.p.yt_id);
const itemTitle = (it: Item) =>
  it.kind === "level" ? parseVideoTitle(it.v.title).name : it.p.title;
const itemSub = (it: Item) =>
  it.kind === "level"
    ? parseVideoTitle(it.v.title).tag
    : `${it.p.country ?? ""} ${it.p.channel ?? ""}`.trim();

// ───────────────────────── 공통 조각 ─────────────────────────

/** 가로 스크롤 한 줄 (넷플릭스 row) */
const Row = ({ title, items, onPick, note }: {
  title: string; items: Item[]; onPick: (it: Item) => void; note?: string;
}) => {
  if (items.length === 0) return null;
  return (
    <section className="mb-7">
      <div className="mb-2 flex items-baseline gap-2 px-4">
        <h2 className="text-[15px] font-black text-white">{title}</h2>
        {note && <span className="text-[11px] font-bold text-white/40">{note}</span>}
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <Card key={itemId(it)} it={it} onPick={onPick} />
        ))}
      </div>
    </section>
  );
};

const Card = ({ it, onPick }: { it: Item; onPick: (it: Item) => void }) => {
  const thumb = itemThumb(it);
  const admin = it.kind === "world" && it.p.visibility === "admin";
  return (
    <button
      type="button" onClick={() => onPick(it)}
      className="w-[164px] shrink-0 text-left active:scale-[0.97] transition-transform"
    >
      <div className="relative overflow-hidden rounded-lg bg-[#1A1B1E]" style={{ aspectRatio: "16/9" }}>
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <Film className="h-7 w-7 text-primary" />
            <span className="text-[10px] font-black tracking-widest text-white/45">릴스</span>
          </div>
        )}
        {it.kind === "world" && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {isIG(it.p) ? "릴스" : `${it.p.minutes ?? 0}분`}
          </span>
        )}
        {admin && (
          <span className="absolute left-1 top-1 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-black text-white">
            관리자
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-bold leading-snug text-white/90">{itemTitle(it)}</p>
      <p className="line-clamp-1 text-[11px] text-white/40">{itemSub(it)}</p>
    </button>
  );
};

/** 히어로 배너 — 오늘 볼 영상 한 편 */
const Hero = ({ it, label, onPlay }: { it: Item; label: string; onPlay: (it: Item) => void }) => {
  const wide = it.kind === "world" && !isIG(it.p) ? wideOf(it.p.yt_id) : itemThumb(it);
  return (
    <div className="relative mb-6 overflow-hidden">
      <div className="relative" style={{ aspectRatio: "4/3" }}>
        {wide ? (
          <img
            src={wide} alt="" className="h-full w-full object-cover"
            onError={(e) => {
              const f = itemThumb(it);
              if (f && e.currentTarget.src !== f) e.currentTarget.src = f;
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1A1B1E] to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-1">
        <p className="mb-1 text-[11px] font-black tracking-[3px] text-primary">{label}</p>
        <h2 className="text-[21px] font-black leading-tight text-white">{itemTitle(it)}</h2>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/55">{itemSub(it)}</p>
        <button
          type="button" onClick={() => onPlay(it)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-3 text-[14px] font-black text-primary-foreground active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" /> 지금 보기
        </button>
      </div>
    </div>
  );
};

// ───────────────────────── 플레이어 (전체화면 오버레이) ─────────────────────────

const Player = ({ it, onClose, isAdmin, watchedApi }: {
  it: Item; onClose: () => void; isAdmin: boolean; watchedApi: WatchedApi;
}) => {
  const { watched, toggle } = watchedApi;

  const { data: full } = useQuery({
    queryKey: ["boxing-library-detail", it.kind === "world" ? it.p.id : null],
    enabled: it.kind === "world",
    queryFn: async (): Promise<ProgramFull | null> => {
      if (it.kind !== "world") return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("boxing_programs").select("*").eq("id", it.p.id).maybeSingle();
      if (error) throw error;
      return (data as ProgramFull) ?? null;
    },
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const ig = it.kind === "world" && isIG(it.p);
  const ytId = it.kind === "level" ? youtubeId(it.v.videoUrl) : it.p.yt_id;
  const isWatched = it.kind === "level" && !!watched[it.v.id];

  const markWatched = () => {
    if (it.kind !== "level") return;
    const was = !!watched[it.v.id];
    toggle(it.v.id);
    if (!was) toast.success("오삼이: 눈으로 익혔으면 이제 몸으로! 체육관에서 바로 해봐요 🥊");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
      <button
        type="button" onClick={onClose}
        className="fixed right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white active:scale-95"
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>

      {ig ? (
        <div className="mx-auto max-w-[400px] px-3 pt-14">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <iframe
              title={itemTitle(it)}
              src={`https://www.instagram.com/reel/${ytId}/embed/captioned`}
              className="h-[540px] w-full border-0" scrolling="no" allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
          {ytId ? (
            <iframe
              title={itemTitle(it)}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/50">영상 주소를 읽을 수 없어요</div>
          )}
        </div>
      )}

      <div className="mx-auto max-w-md px-4 pb-24 pt-4">
        <h1 className="text-[19px] font-black leading-snug text-white">{itemTitle(it)}</h1>

        {it.kind === "world" ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/50">
              <span className={`rounded px-2 py-0.5 text-[11px] font-black ${LEAGUE_BADGE[it.p.league] ?? LEAGUE_BADGE["화이트"]}`}>{it.p.league} 리그</span>
              {!isIG(it.p) && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{it.p.minutes ?? 0}분</span>}
              <span className="flex items-center gap-1 font-black text-reward"><Star className="h-3.5 w-3.5 fill-current" />{it.p.score ?? 7}/10</span>
              {isAdmin && it.p.visibility === "admin" && (
                <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-black text-destructive">
                  관리자 전용 · {TIER_LABEL[it.p.rights_tier ?? ""] ?? "미분류"}
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-white/45">{it.p.country} {it.p.channel}</p>
            {full?.summary && (
              <div className="mt-3 rounded-xl bg-[#141518] p-4">
                <p className="mb-1.5 text-[11px] font-black tracking-widest text-primary">세션 구성 요약</p>
                <p className="text-[13.5px] leading-relaxed text-white/85">{full.summary}</p>
              </div>
            )}
            {(full?.coach_points ?? []).length > 0 && (
              <div className="mt-2.5 rounded-xl border border-primary/25 bg-[#141518] p-4">
                <p className="mb-2 text-[11px] font-black tracking-widest text-primary">관장님 코치 포인트</p>
                {(full?.coach_points ?? []).map((c, i) => (
                  <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                    <b className="text-[13px] text-primary">{i + 1}</b>
                    <span className="text-[13.5px] leading-relaxed text-white/85">{c}</span>
                  </div>
                ))}
              </div>
            )}
            {full?.target && (
              <div className="mt-2.5 rounded-xl bg-[#141518] p-4">
                <p className="mb-1 text-[11px] font-black tracking-widest text-white/40">추천 대상</p>
                <p className="text-[13.5px] leading-relaxed text-white/85">{full.target}</p>
              </div>
            )}
            <a
              href={isIG(it.p) ? igUrl(it.p.yt_id) : `https://www.youtube.com/watch?v=${it.p.yt_id}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/15 py-3 text-sm font-bold text-white/80 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" /> {isIG(it.p) ? "인스타그램에서 열기" : "유튜브 앱에서 열기"}
            </a>
          </>
        ) : (
          <>
            {parseVideoTitle(it.v.title).sub && (
              <p className="mt-1 text-[13px] text-white/50">{parseVideoTitle(it.v.title).sub}</p>
            )}
            {it.v.description && (
              <div className="mt-3 rounded-xl bg-[#141518] p-4">
                <p className="mb-1.5 text-[11px] font-black tracking-widest text-primary">이 동작을 왜 하나요</p>
                <p className="text-[13.5px] leading-relaxed text-white/85">{it.v.description}</p>
              </div>
            )}
            {it.v.keyPoints.length > 0 && (
              <div className="mt-2.5 rounded-xl border border-primary/25 bg-[#141518] p-4">
                <p className="mb-2 text-[11px] font-black tracking-widest text-primary">핵심 포인트</p>
                {it.v.keyPoints.map((k, i) => (
                  <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                    <b className="text-[13px] text-primary">{i + 1}</b>
                    <span className="text-[13.5px] leading-relaxed text-white/85">{k}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button" onClick={markWatched}
              className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3.5 text-sm font-black active:scale-[0.98] ${
                isWatched ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> {isWatched ? "시청 완료" : "다 봤어요"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ───────────────────────── 레벨 브라우저 ─────────────────────────

const LEAGUE_KEYS = ["white", "blue", "red", "black"] as const;

const LevelBrowser = ({ initLeague, initLevel, myLeague, myLevel, onPick, watchedApi }: {
  initLeague: string; initLevel: number; myLeague: string; myLevel: number;
  onPick: (it: Item) => void; watchedApi: WatchedApi;
}) => {
  const [league, setLeague] = useState<string>(initLeague);
  const [level, setLevel] = useState<number>(initLevel);
  const { data: videos = [], isLoading } = useLevelVideos(league, level);
  const { watched, countFor } = watchedApi;
  const done = countFor(videos.map((v) => v.id));

  return (
    <div className="px-4">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LEAGUE_KEYS.map((k) => (
          <button
            key={k} type="button" onClick={() => { setLeague(k); setLevel(1); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-black transition-colors ${
              league === k ? "bg-primary text-primary-foreground" : "bg-[#1A1B1E] text-white/50"
            }`}
          >
            {RANK_LABELS[k] ?? k}
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const isNow = league === myLeague && n === myLevel;
          const isNext = league === myLeague && n === myLevel + 1;
          return (
            <button
              key={n} type="button" onClick={() => setLevel(n)}
              className={`relative shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-black transition-colors ${
                level === n ? "bg-white text-black" : "bg-[#1A1B1E] text-white/50"
              }`}
            >
              L{n}
              {(isNow || isNext) && (
                <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 rounded px-1 text-[8.5px] font-black ${
                  isNow ? "bg-primary text-primary-foreground" : "bg-reward text-black"
                }`}>
                  {isNow ? "지금" : "다음"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-white/40">불러오는 중…</div>
      ) : videos.length === 0 ? (
        <div className="py-16 text-center text-sm leading-relaxed text-white/40">
          이 레벨 영상은 준비 중이에요.<br />관장님이 올리면 바로 여기에 뜹니다.
        </div>
      ) : (
        <>
          <p className="mb-2.5 text-[12px] text-white/40">
            {videos.length}편 · 시청 완료 <b className="text-primary">{done}</b>/{videos.length}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {videos.map((v) => {
              const t = parseVideoTitle(v.title);
              const thumb = v.posterUrl || youtubeThumb(v.videoUrl);
              return (
                <button
                  key={v.id} type="button" onClick={() => onPick({ kind: "level", v })}
                  className="text-left active:scale-[0.97] transition-transform"
                >
                  <div className="relative overflow-hidden rounded-lg bg-[#1A1B1E]" style={{ aspectRatio: "16/9" }}>
                    {thumb
                      ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center"><PlayCircle className="h-7 w-7 text-primary" /></div>}
                    {watched[v.id] && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] font-bold leading-snug text-white/90">{t.name}</p>
                  {t.tag && <p className="text-[11px] text-white/40">{t.tag}</p>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ───────────────────────── 월드 브라우저 ─────────────────────────

const Chips = ({ items, value, onPick }: { items: readonly string[]; value: string; onPick: (v: string) => void }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {items.map((v) => (
      <button
        key={v} type="button" onClick={() => onPick(v)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
          value === v ? "bg-primary text-primary-foreground" : "bg-[#1A1B1E] text-white/50"
        }`}
      >
        {v}
      </button>
    ))}
  </div>
);

const WorldBrowser = ({ myLeague, isAdmin, onPick }: {
  myLeague: string; isAdmin: boolean; onPick: (it: Item) => void;
}) => {
  const { data: programs = [], isLoading } = useWorldPrograms();
  const [league, setLeague] = useState<string>(myLeague || "전체");
  const [tag, setTag] = useState("전체");
  const [time, setTime] = useState<string>("전체");

  const topTags = useMemo(() => {
    const cnt = new Map<string, number>();
    for (const p of programs) for (const t of p.tags ?? []) cnt.set(t, (cnt.get(t) ?? 0) + 1);
    return ["전체", ...[...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)];
  }, [programs]);

  const list = useMemo(() => programs.filter((p) => {
    if (league !== "전체" && p.league !== league) return false;
    if (tag !== "전체" && !(p.tags ?? []).includes(tag)) return false;
    const m = p.minutes ?? 0;
    if (time === "~10분" && m > 10) return false;
    if (time === "10~20분" && (m <= 10 || m > 20)) return false;
    if (time === "20분+" && m <= 20) return false;
    return true;
  }), [programs, league, tag, time]);

  return (
    <div className="px-4">
      <div className="space-y-1.5">
        <Chips items={W_LEAGUES} value={league} onPick={setLeague} />
        <Chips items={topTags} value={tag} onPick={setTag} />
        <Chips items={W_TIMES} value={time} onPick={setTime} />
      </div>
      <p className="my-2.5 text-[12px] text-white/40">
        {list.length.toLocaleString()}개 프로그램
        {isAdmin && list.some((p) => p.visibility === "admin") &&
          ` · 관리자 전용 ${list.filter((p) => p.visibility === "admin").length}개 포함`}
      </p>
      {isLoading ? (
        <div className="py-16 text-center text-sm text-white/40">불러오는 중…</div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm leading-relaxed text-white/40">조건에 맞는 프로그램이 없어요.<br />필터를 조정해 보세요.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {list.slice(0, 80).map((p) => (
            <Card key={p.id} it={{ kind: "world", p }} onPick={onPick} />
          ))}
        </div>
      )}
      {list.length > 80 && (
        <p className="py-4 text-center text-[11px] text-white/35">상위 80개를 보여드렸어요 — 검색·필터로 더 좁혀보세요</p>
      )}
    </div>
  );
};

// ───────────────────────── 페이지 ─────────────────────────

const BoxingLibraryPage = () => {
  const navigate = useNavigate();
  const { progress, role } = useAuth();
  const [params] = useSearchParams();
  // 월드 탭은 전 회원 공개. 저작권 소지 영상은 DB(RLS)에서 걸러지므로 UI 로 막지 않는다.
  // isAdmin 은 "관리자 전용" 표시 배지 용도로만 쓴다.
  const isAdmin = role === "admin" || role === "super_admin";

  const myLeague = (progress?.current_rank as string) ?? "white";
  const myLevel = progress?.current_level ?? 1;
  const initLevel = Math.min(10, Math.max(1, Number(params.get("lv")) || myLevel));
  const myLeagueLabel = RANK_LABELS[myLeague] ?? "전체";

  const [view, setView] = useState<"home" | "level" | "world">(
    params.get("tab") === "world" ? "world" : params.get("tab") === "level" ? "level" : "home",
  );
  const [open, setOpen] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  const watchedApi = useWatchedVideos();
  const { data: programs = [] } = useWorldPrograms();
  const { data: nowVideos = [] } = useLevelVideos(myLeague, initLevel);
  const { data: nextVideos = [] } = useLevelVideos(myLeague, Math.min(10, initLevel + 1));

  // 홈 행 구성
  const rows = useMemo(() => {
    const w = (f: (p: ProgramLite) => boolean, n = 20) =>
      programs.filter(f).slice(0, n).map((p) => ({ kind: "world", p } as Item));
    const tagCount = new Map<string, number>();
    for (const p of programs) for (const t of p.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);

    const out: { title: string; note?: string; items: Item[] }[] = [
      {
        title: `지금 내 레벨 · ${myLeagueLabel} L${initLevel}`,
        note: "관장님 영상",
        items: nowVideos.map((v) => ({ kind: "level", v } as Item)),
      },
      {
        title: `다음 레벨 미리보기 · L${Math.min(10, initLevel + 1)}`,
        note: "예습",
        items: initLevel < 10 ? nextVideos.map((v) => ({ kind: "level", v } as Item)) : [],
      },
      { title: `${myLeagueLabel} 리그 추천`, items: w((p) => p.league === myLeagueLabel) },
      { title: "10분 안에 끝내는 훈련", items: w((p) => !isIG(p) && (p.minutes ?? 99) > 0 && (p.minutes ?? 99) <= 10) },
      ...topTags.map((t) => ({ title: t, items: w((p) => (p.tags ?? []).includes(t)) })),
      { title: "릴스로 보는 한 컷", note: "인스타그램", items: w((p) => isIG(p)) },
      { title: "평점 9점 이상", items: w((p) => (p.score ?? 0) >= 9) },
    ];
    if (isAdmin) {
      out.push({
        title: "관리자 전용 · 권리 확인 필요",
        note: "회원에게는 안 보임",
        items: w((p) => p.visibility === "admin", 30),
      });
    }
    return out.filter((r) => r.items.length > 0);
  }, [programs, nowVideos, nextVideos, myLeagueLabel, initLevel, isAdmin]);

  const hero: Item | null = useMemo(() => {
    if (nowVideos.length > 0) return { kind: "level", v: nowVideos[0] };
    if (nextVideos.length > 0) return { kind: "level", v: nextVideos[0] };
    const p = programs.find((x) => x.league === myLeagueLabel && !isIG(x)) ?? programs.find((x) => !isIG(x));
    return p ? { kind: "world", p } : null;
  }, [nowVideos, nextVideos, programs, myLeagueLabel]);

  const heroLabel = nowVideos.length > 0
    ? `오늘 볼 영상 · ${myLeagueLabel} L${initLevel}`
    : "153플레이 추천";

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 1) return [] as Item[];
    const lv = [...nowVideos, ...nextVideos]
      .filter((v) => v.title.toLowerCase().includes(k))
      .map((v) => ({ kind: "level", v } as Item));
    const wd = programs
      .filter((p) => `${p.title} ${p.channel ?? ""} ${p.country ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(k))
      .slice(0, 60)
      .map((p) => ({ kind: "world", p } as Item));
    return [...lv, ...wd];
  }, [q, programs, nowVideos, nextVideos]);

  const TABS = [["home", "홈"], ["level", "레벨 미션"], ["world", "월드"]] as const;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* 상단 바 */}
      <header className="sticky top-0 z-30 bg-black/92 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pb-1 pt-3">
          <button onClick={() => navigate(-1)} className="-ml-1 p-1 text-white/70 active:opacity-60" aria-label="뒤로">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-[15px] font-black tracking-[2px] text-primary">153 PLAY</p>
          <button
            onClick={() => { setSearching((s) => !s); setQ(""); }}
            className="ml-auto p-1 text-white/70 active:opacity-60" aria-label="검색"
          >
            {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>
        {searching ? (
          <div className="mx-auto max-w-md px-4 pb-2.5">
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="기술, 채널, 목적으로 검색 (예: 풋워크)"
              className="w-full rounded-lg bg-[#1A1B1E] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
            />
          </div>
        ) : (
          <div className="mx-auto flex max-w-md gap-4 px-4 pb-2">
            {TABS.map(([k, label]) => (
              <button
                key={k} type="button" onClick={() => setView(k)}
                className={`relative pb-1 text-[13.5px] font-black transition-colors ${
                  view === k ? "text-white" : "text-white/40"
                }`}
              >
                {label}
                {view === k && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-md">
        {searching ? (
          q.trim().length === 0 ? (
            <p className="py-20 text-center text-sm text-white/35">보고 싶은 훈련을 검색해 보세요</p>
          ) : results.length === 0 ? (
            <p className="py-20 text-center text-sm text-white/35">"{q}" 결과가 없어요</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 px-4 pt-3">
              {results.map((it) => <Card key={itemId(it)} it={it} onPick={setOpen} />)}
            </div>
          )
        ) : view === "home" ? (
          <>
            {hero && <Hero it={hero} label={heroLabel} onPlay={setOpen} />}
            {rows.map((r) => (
              <Row key={r.title} title={r.title} note={r.note} items={r.items} onPick={setOpen} />
            ))}
            {rows.length === 0 && !hero && (
              <p className="py-24 text-center text-sm text-white/35">영상을 불러오는 중이에요…</p>
            )}
          </>
        ) : view === "level" ? (
          <div className="pt-3">
            <LevelBrowser
              initLeague={myLeague} initLevel={initLevel}
              myLeague={myLeague} myLevel={myLevel} onPick={setOpen}
              watchedApi={watchedApi}
            />
          </div>
        ) : (
          <div className="pt-3">
            <WorldBrowser myLeague={myLeagueLabel} isAdmin={isAdmin} onPick={setOpen} />
          </div>
        )}
      </div>

      {open && (
        <Player it={open} isAdmin={isAdmin} watchedApi={watchedApi} onClose={() => setOpen(null)} />
      )}
    </div>
  );
};

export default BoxingLibraryPage;
