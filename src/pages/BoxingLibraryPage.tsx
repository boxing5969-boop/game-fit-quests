// 월드 복싱 라이브러리 — 전 세계에서 검증된 복싱 프로그램(boxing_programs)을
// 마이복서153 안에서 리그별로 즐긴다. 관장님이 큐레이션한 유튜브 영상 1,500여 개.
//
// 연결: 회원의 현재 리그를 기본 필터로 잡아 "지금 내 수준의 영상"부터 보여주고,
//       레벨 카드의 "다음 레벨 미리보기"에서도 이 화면으로 들어온다.
// 데이터: 같은 Supabase 의 boxing_programs (anon 읽기) — 별도 서버 없음.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Star, Clock, ExternalLink } from "lucide-react";
import { RANK_LABELS } from "@/data/sharedConstants";

interface ProgramLite {
  id: string;
  yt_id: string;
  title: string;
  channel: string | null;
  country: string | null;
  tags: string[] | null;
  league: string;
  minutes: number | null;
  score: number | null;
}

interface ProgramFull extends ProgramLite {
  equipment: string[] | null;
  summary: string | null;
  coach_points: string[] | null;
  target: string | null;
}

const LEAGUES = ["전체", "화이트", "블루", "레드", "블랙"] as const;
const TIMES = ["전체", "~10분", "10~20분", "20분+"] as const;

const LEAGUE_BADGE: Record<string, string> = {
  화이트: "bg-gray-100 text-gray-900",
  블루: "bg-blue-600 text-white",
  레드: "bg-red-600 text-white",
  블랙: "bg-black text-primary border border-primary/40",
};

const thumb = (yt: string) => `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;

const Chips = ({ items, value, onPick }: { items: readonly string[]; value: string; onPick: (v: string) => void }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {items.map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => onPick(v)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
          value === v
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        {v}
      </button>
    ))}
  </div>
);

const BoxingLibraryPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const [params] = useSearchParams();

  // 기본 리그 = URL ?lg= > 내 리그 > 전체
  const myLeague = RANK_LABELS[progress?.current_rank ?? ""] ?? "전체";
  const [league, setLeague] = useState<string>(params.get("lg") || myLeague || "전체");
  const [tag, setTag] = useState("전체");
  const [time, setTime] = useState<string>("전체");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["boxing-library"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ProgramLite[]> => {
      // PostgREST 는 1000행씩 — 전체(1,500여 개)를 두 페이지로 받는다. 목록 컬럼만 (요약·코치포인트는 상세에서).
      const cols = "id, yt_id, title, channel, country, tags, league, minutes, score";
      const out: ProgramLite[] = [];
      for (let off = 0; off < 4000; off += 1000) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("boxing_programs").select(cols)
          .eq("is_active", true)
          .order("score", { ascending: false })
          .range(off, off + 999);
        if (error) throw error;
        const page = (data || []) as ProgramLite[];
        out.push(...page);
        if (page.length < 1000) break;
      }
      return out;
    },
  });

  // 상세 — 열 때 한 건만 무겁게
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

  const list = useMemo(() => {
    return programs.filter((p) => {
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
    });
  }, [programs, league, tag, time, q]);

  // ── 상세 화면 ──
  if (selId) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="mx-auto max-w-md px-4 pt-4">
          <button onClick={() => setSelId(null)} className="mb-3 flex items-center gap-1.5 text-sm font-black text-primary active:opacity-70">
            <ArrowLeft className="h-4 w-4" /> 라이브러리
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
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${LEAGUE_BADGE[sel.league] ?? LEAGUE_BADGE["화이트"]}`}>
                  {sel.league} 리그
                </span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{sel.minutes ?? 0}분</span>
                {(sel.equipment ?? []).length > 0 && <span>· {(sel.equipment ?? []).join(", ")}</span>}
                <span className="ml-auto flex items-center gap-1 font-black text-reward"><Star className="h-3.5 w-3.5 fill-current" />{sel.score ?? 7}/10</span>
              </div>
              <h1 className="mt-2 text-lg font-black leading-snug text-foreground">{sel.title}</h1>
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
              <a
                href={`https://www.youtube.com/watch?v=${sel.yt_id}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" /> 유튜브 앱에서 열기
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 목록 화면 ──
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1.5 text-sm font-black text-primary active:opacity-70">
          <ArrowLeft className="h-4 w-4" /> 홈
        </button>
        <p className="text-[11px] font-black tracking-[3px] text-primary">153 BOXING</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">
          월드 복싱 <span className="text-primary">라이브러리</span>
        </h1>
        <p className="mb-3 mt-0.5 text-[12.5px] text-muted-foreground">
          전 세계 검증된 복싱 프로그램 {programs.length.toLocaleString()}개 · 내 리그에 맞게 골라 보세요
        </p>

        <div className="relative mb-2.5">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="기술, 채널, 목적으로 검색 (예: 풋워크)"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="space-y-1.5">
          <Chips items={LEAGUES.map((l) => (l === "전체" ? l : `${l}`))} value={league} onPick={setLeague} />
          <Chips items={topTags} value={tag} onPick={setTag} />
          <Chips items={TIMES} value={time} onPick={setTime} />
        </div>
        <p className="my-2.5 text-[12px] text-muted-foreground">{list.length.toLocaleString()}개 프로그램</p>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-sm leading-relaxed text-muted-foreground">
            조건에 맞는 프로그램이 없어요.<br />필터를 조정해 보세요.
          </div>
        ) : (
          list.slice(0, 60).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelId(p.id)}
              className="mb-3 w-full overflow-hidden rounded-2xl border border-border bg-card text-left active:scale-[0.99]"
            >
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                <img src={thumb(p.yt_id)} alt="" loading="lazy" className="h-full w-full object-cover opacity-95" />
                <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[11px] font-black ${LEAGUE_BADGE[p.league] ?? LEAGUE_BADGE["화이트"]}`}>
                  {p.league} 리그
                </span>
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">
                  {p.minutes ?? 0}분
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-[14.5px] font-bold leading-snug text-foreground">{p.title}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span className="truncate">{p.country} {p.channel}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 font-black text-reward">
                    <Star className="h-3 w-3 fill-current" />{p.score ?? 7}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
        {list.length > 60 && (
          <p className="pb-4 text-center text-[11px] text-muted-foreground">
            상위 60개를 보여드렸어요 — 검색·필터로 더 좁혀보세요
          </p>
        )}
      </div>
    </div>
  );
};

export default BoxingLibraryPage;
