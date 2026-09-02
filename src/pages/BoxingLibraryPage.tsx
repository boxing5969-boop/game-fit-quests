// 레벨 미션 영상 — 회원이 리그·레벨별 커리큘럼 영상(관장님이 올린 미션 영상)으로
// 다음 레벨에서 배울 동작을 예습하고, 시청 완료를 체크하며 훈련 흐름을 잇는 화면.
// 보조 탭 "월드"에서는 전 세계 큐레이션 복싱 프로그램(boxing_programs)을 즐긴다.
//
// 가치 전달: 영상마다 핵심 포인트(키포인트)를 함께 보여주고, 시청 완료 시
// 오삼이 코치가 "몸으로 완성하러 가자"고 잇는다 — 예습(영상) → 출석(3회) → 레벨업.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Search, Star, Clock, ExternalLink, CheckCircle2, PlayCircle } from "lucide-react";
import { RANK_LABELS } from "@/data/sharedConstants";
import {
  useLevelVideos, useWatchedVideos, youtubeId, youtubeThumb, parseVideoTitle,
  type LevelVideo,
} from "@/hooks/useLevelVideos";

// ───────────────────────── 월드 탭 (전 세계 큐레이션) ─────────────────────────

interface ProgramLite {
  id: string; yt_id: string; title: string; channel: string | null; country: string | null;
  tags: string[] | null; league: string; minutes: number | null; score: number | null;
}
interface ProgramFull extends ProgramLite {
  equipment: string[] | null; summary: string | null; coach_points: string[] | null; target: string | null;
}

const W_LEAGUES = ["전체", "화이트", "블루", "레드", "블랙"] as const;
const W_TIMES = ["전체", "~10분", "10~20분", "20분+"] as const;
const LEAGUE_BADGE: Record<string, string> = {
  화이트: "bg-gray-100 text-gray-900",
  블루: "bg-blue-600 text-white",
  레드: "bg-red-600 text-white",
  블랙: "bg-black text-primary border border-primary/40",
};
const thumbOf = (yt: string) => `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;

const Chips = ({ items, value, onPick }: { items: readonly string[]; value: string; onPick: (v: string) => void }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {items.map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => onPick(v)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
          value === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
        }`}
      >
        {v}
      </button>
    ))}
  </div>
);

const WorldTab = ({ myLeague }: { myLeague: string }) => {
  const [league, setLeague] = useState<string>(myLeague || "전체");
  const [tag, setTag] = useState("전체");
  const [time, setTime] = useState<string>("전체");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["boxing-library"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ProgramLite[]> => {
      const cols = "id, yt_id, title, channel, country, tags, league, minutes, score";
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

  const { data: sel } = useQuery({
    queryKey: ["boxing-library-detail", selId],
    enabled: !!selId,
    queryFn: async (): Promise<ProgramFull | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("boxing_programs").select("*").eq("id", selId!).maybeSingle();
      if (error) throw error;
      return (data as ProgramFull) ?? null;
    },
  });

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
    if (q) {
      const hay = `${p.title} ${p.channel ?? ""} ${p.country ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [programs, league, tag, time, q]);

  if (selId) {
    return (
      <div>
        <button onClick={() => setSelId(null)} className="mb-3 flex items-center gap-1.5 text-sm font-black text-primary active:opacity-70">
          <ArrowLeft className="h-4 w-4" /> 월드 목록
        </button>
        {!sel ? (
          <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl bg-black shadow-elev-1" style={{ aspectRatio: "16/9" }}>
              <iframe
                title={sel.title}
                src={`https://www.youtube-nocookie.com/embed/${sel.yt_id}?rel=0&playsinline=1`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${LEAGUE_BADGE[sel.league] ?? LEAGUE_BADGE["화이트"]}`}>{sel.league} 리그</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{sel.minutes ?? 0}분</span>
              {(sel.equipment ?? []).length > 0 && <span>· {(sel.equipment ?? []).join(", ")}</span>}
              <span className="ml-auto flex items-center gap-1 font-black text-reward"><Star className="h-3.5 w-3.5 fill-current" />{sel.score ?? 7}/10</span>
            </div>
            <h2 className="mt-2 text-lg font-black leading-snug text-foreground">{sel.title}</h2>
            <p className="text-[13px] text-muted-foreground">{sel.country} {sel.channel}</p>
            {sel.summary && (
              <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                <p className="mb-1.5 text-[11px] font-black tracking-widest text-primary">세션 구성 요약</p>
                <p className="text-[13.5px] leading-relaxed text-foreground">{sel.summary}</p>
              </div>
            )}
            {(sel.coach_points ?? []).length > 0 && (
              <div className="mt-2.5 rounded-2xl border border-primary/25 bg-card p-4">
                <p className="mb-2 text-[11px] font-black tracking-widest text-primary">관장님 코치 포인트</p>
                {(sel.coach_points ?? []).map((c, i) => (
                  <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                    <b className="text-[13px] text-primary">{i + 1}</b>
                    <span className="text-[13.5px] leading-relaxed text-foreground">{c}</span>
                  </div>
                ))}
              </div>
            )}
            {sel.target && (
              <div className="mt-2.5 rounded-2xl border border-border bg-card p-4">
                <p className="mb-1 text-[11px] font-black tracking-widest text-muted-foreground">추천 대상</p>
                <p className="text-[13.5px] leading-relaxed text-foreground">{sel.target}</p>
              </div>
            )}
            <a href={`https://www.youtube.com/watch?v=${sel.yt_id}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground active:scale-[0.98]">
              <ExternalLink className="h-4 w-4" /> 유튜브 앱에서 열기
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-2.5">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="기술, 채널, 목적으로 검색 (예: 풋워크)"
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="space-y-1.5">
        <Chips items={W_LEAGUES} value={league} onPick={setLeague} />
        <Chips items={topTags} value={tag} onPick={setTag} />
        <Chips items={W_TIMES} value={time} onPick={setTime} />
      </div>
      <p className="my-2.5 text-[12px] text-muted-foreground">{list.length.toLocaleString()}개 프로그램</p>
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm leading-relaxed text-muted-foreground">조건에 맞는 프로그램이 없어요.<br />필터를 조정해 보세요.</div>
      ) : (
        list.slice(0, 60).map((p) => (
          <button key={p.id} type="button" onClick={() => setSelId(p.id)}
            className="mb-3 w-full overflow-hidden rounded-2xl border border-border bg-card text-left active:scale-[0.99]">
            <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
              <img src={thumbOf(p.yt_id)} alt="" loading="lazy" className="h-full w-full object-cover opacity-95" />
              <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[11px] font-black ${LEAGUE_BADGE[p.league] ?? LEAGUE_BADGE["화이트"]}`}>{p.league} 리그</span>
              <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">{p.minutes ?? 0}분</span>
            </div>
            <div className="p-3.5">
              <p className="text-[14.5px] font-bold leading-snug text-foreground">{p.title}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="truncate">{p.country} {p.channel}</span>
                <span className="ml-auto flex shrink-0 items-center gap-0.5 font-black text-reward"><Star className="h-3 w-3 fill-current" />{p.score ?? 7}</span>
              </div>
            </div>
          </button>
        ))
      )}
      {list.length > 60 && (
        <p className="pb-4 text-center text-[11px] text-muted-foreground">상위 60개를 보여드렸어요 — 검색·필터로 더 좁혀보세요</p>
      )}
    </div>
  );
};

// ───────────────────────── 레벨 미션 영상 탭 (기본) ─────────────────────────

const LEAGUE_KEYS = ["white", "blue", "red", "black"] as const;

const LevelTab = ({ initLeague, initLevel, myLeague, myLevel }: {
  initLeague: string; initLevel: number; myLeague: string; myLevel: number;
}) => {
  const [league, setLeague] = useState<string>(initLeague);
  const [level, setLevel] = useState<number>(initLevel);
  const [sel, setSel] = useState<LevelVideo | null>(null);
  const { data: videos = [], isLoading } = useLevelVideos(league, level);
  const { watched, toggle, countFor } = useWatchedVideos();

  const doneCount = countFor(videos.map((v) => v.id));

  const markWatched = (v: LevelVideo) => {
    const was = !!watched[v.id];
    toggle(v.id);
    if (!was) {
      toast.success("오삼이: 눈으로 익혔으면 이제 몸으로! 체육관에서 바로 해봐요 🥊");
    }
  };

  // ── 상세(플레이어) ──
  if (sel) {
    const yid = youtubeId(sel.videoUrl);
    const t = parseVideoTitle(sel.title);
    const isWatched = !!watched[sel.id];
    return (
      <div>
        <button onClick={() => setSel(null)} className="mb-3 flex items-center gap-1.5 text-sm font-black text-primary active:opacity-70">
          <ArrowLeft className="h-4 w-4" /> 영상 목록
        </button>
        <div className="overflow-hidden rounded-2xl bg-black shadow-elev-1" style={{ aspectRatio: "16/9" }}>
          {yid ? (
            <iframe
              title={sel.title}
              src={`https://www.youtube-nocookie.com/embed/${yid}?rel=0&playsinline=1`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <a href={sel.videoUrl} target="_blank" rel="noopener noreferrer" className="flex h-full items-center justify-center text-sm font-bold text-white">영상 열기</a>
          )}
        </div>
        {t.tag && <p className="mt-3 text-[11px] font-black tracking-widest text-primary">{t.tag}</p>}
        <h2 className="mt-1 text-lg font-black leading-snug text-foreground">{t.name}</h2>
        {t.sub && <p className="text-[13px] text-muted-foreground">{t.sub}</p>}
        {sel.description && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-4">
            <p className="mb-1.5 text-[11px] font-black tracking-widest text-primary">이 동작의 목적</p>
            <p className="text-[13.5px] leading-relaxed text-foreground">{sel.description}</p>
          </div>
        )}
        {sel.keyPoints.length > 0 && (
          <div className="mt-2.5 rounded-2xl border border-primary/25 bg-card p-4">
            <p className="mb-2 text-[11px] font-black tracking-widest text-primary">핵심 포인트</p>
            {sel.keyPoints.map((k, i) => (
              <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                <b className="text-[13px] text-primary">{i + 1}</b>
                <span className="text-[13.5px] leading-relaxed text-foreground">{k}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => markWatched(sel)}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-black active:scale-[0.98] ${
            isWatched ? "bg-status-complete/15 text-status-complete" : "bg-primary text-primary-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> {isWatched ? "시청 완료! (해제하려면 다시 탭)" : "시청 완료 체크"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          예습했으면 체육관에서 몸으로 완성 — 출석 3회면 자동 레벨업입니다.
        </p>
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div>
      <Chips
        items={LEAGUE_KEYS.map((k) => RANK_LABELS[k] ?? k)}
        value={RANK_LABELS[league] ?? league}
        onPick={(label) => {
          const key = LEAGUE_KEYS.find((k) => (RANK_LABELS[k] ?? k) === label) ?? "white";
          setLeague(key); setSel(null);
        }}
      />
      <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => {
          const isMe = league === myLeague && lv === myLevel;
          const isNext = league === myLeague && lv === myLevel + 1;
          return (
            <button
              key={lv} type="button"
              onClick={() => { setLevel(lv); setSel(null); }}
              className={`relative shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-black transition-colors ${
                level === lv ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              L{lv}
              {(isMe || isNext) && (
                <span className={`absolute -right-1 -top-1.5 rounded-full px-1 text-[8px] font-black ${isMe ? "bg-status-complete text-white" : "bg-reward text-black"}`}>
                  {isMe ? "지금" : "다음"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {videos.length > 0 && (
        <p className="my-2.5 text-[12px] text-muted-foreground">
          {RANK_LABELS[league] ?? league} 리그 · 레벨 {level} — 영상 {doneCount}/{videos.length} 시청
        </p>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : videos.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted-foreground">
          이 레벨의 미션 영상이 아직 준비 중이에요.<br />월드 탭에서 같은 리그 영상을 먼저 봐도 좋아요.
        </div>
      ) : (
        videos.map((v) => {
          const t = parseVideoTitle(v.title);
          const th = v.posterUrl || youtubeThumb(v.videoUrl);
          const isWatched = !!watched[v.id];
          return (
            <button key={v.id} type="button" onClick={() => setSel(v)}
              className="mb-3 w-full overflow-hidden rounded-2xl border border-border bg-card text-left active:scale-[0.99]">
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                {th ? <img src={th} alt="" loading="lazy" className="h-full w-full object-cover opacity-95" /> : (
                  <div className="flex h-full items-center justify-center"><PlayCircle className="h-10 w-10 text-white/60" /></div>
                )}
                {t.tag && <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-black text-primary">{t.tag}</span>}
                {isWatched && (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-status-complete px-2 py-0.5 text-[11px] font-black text-white">
                    <CheckCircle2 className="h-3 w-3" /> 시청 완료
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-[14.5px] font-bold leading-snug text-foreground">{t.name}</p>
                {v.keyPoints[0] && <p className="mt-1 truncate text-[12px] text-muted-foreground">핵심: {v.keyPoints[0]}</p>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

// ───────────────────────── 페이지 셸 ─────────────────────────

const BoxingLibraryPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const [params] = useSearchParams();

  const myLeague = (progress?.current_rank as string) ?? "white";
  const myLevel = progress?.current_level ?? 1;
  const initLevel = Math.min(10, Math.max(1, Number(params.get("lv")) || myLevel));
  const [tab, setTab] = useState<"level" | "world">(params.get("tab") === "world" ? "world" : "level");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1.5 text-sm font-black text-primary active:opacity-70">
          <ArrowLeft className="h-4 w-4" /> 뒤로
        </button>
        <p className="text-[11px] font-black tracking-[3px] text-primary">153 BOXING</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">레벨 미션 <span className="text-primary">영상</span></h1>
        <p className="mb-3 mt-0.5 text-[12.5px] text-muted-foreground">
          다음 레벨에서 배울 동작을 영상으로 예습하세요 — 출석 3회면 자동 레벨업
        </p>

        <div className="mb-3 flex rounded-xl border border-border bg-card p-1">
          {([["level", "레벨 미션 영상"], ["world", "월드 라이브러리"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`flex-1 rounded-lg py-2 text-[12.5px] font-black transition-colors ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "level" ? (
          <LevelTab initLeague={myLeague} initLevel={initLevel} myLeague={myLeague} myLevel={myLevel} />
        ) : (
          <WorldTab myLeague={RANK_LABELS[myLeague] ?? "전체"} />
        )}
      </div>
    </div>
  );
};

export default BoxingLibraryPage;
