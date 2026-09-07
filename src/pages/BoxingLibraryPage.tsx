// 153플레이 — 153library.pages.dev 와 같은 넷플릭스형 브라우즈 화면을 앱 안에 그대로.
//
// 빌보드(히어로) → 가로 레일(행) → 카테고리 그리드 → 상세 모달.
// 원본 앱의 CSS 토큰·타일 규격(44vw / 16:9 / radius 5)·행 구성을 그대로 옮겼다.
//
// ⚠️ 월드(boxing_programs = 외부 채널 큐레이션)는 전 회원에게 열려 있고,
//    저작권 소지가 있는 영상만 DB RLS 가 걸러낸다 (UI 에서 따로 막지 않는다).
//    · official / creator → visibility='public' → 전 회원
//    · reupload / archive → visibility='admin' → 관리자만 (타일에 '비공개' 배지)
//
// 레벨 미션 영상(관장님 업로드)은 '내 레벨' 메뉴와 홈 최상단 행에 붙는다 —
// 예습(영상) → 출석(3회) → 레벨업 흐름을 잇는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RANK_LABELS } from "@/data/sharedConstants";
import {
  useLevelVideos, useWatchedVideos, youtubeId, youtubeThumb, parseVideoTitle,
  type LevelVideo,
} from "@/hooks/useLevelVideos";

// ───────────────────────── 스타일 (원본 153플레이 그대로) ─────────────────────────

const CSS = `
.p153{--mint:#45E0CE;--gold:#E6B94D;--bg:#141414;--card:#1F1F1F;--line:#2E2E2E;
  --txt:#FFFFFF;--sub:#B3B3B3;--dim:#8C8C8C;--ink2:#E5E5E5;
  background:var(--bg);color:var(--txt);min-height:100vh;padding-bottom:84px;
  font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif;overflow-x:hidden}
.p153 *{box-sizing:border-box}
.p153 button{font-family:inherit}

/* 상단 내비 */
.p153 .nav{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:7px;padding:12px;
  background:linear-gradient(180deg,rgba(0,0,0,.85),rgba(0,0,0,.15));transition:background .25s ease}
.p153 .nav.solid{background:var(--bg);box-shadow:0 1px 0 var(--line)}
.p153 .navMenu{display:flex;gap:2px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none}
.p153 .navMenu::-webkit-scrollbar{display:none}
.p153 .navMenu button{background:none;border:none;color:var(--sub);font-size:13px;font-weight:700;
  padding:7px 5px;border-radius:8px;cursor:pointer;white-space:nowrap}
.p153 .navMenu button.on{color:var(--txt);font-weight:900}
.p153 .nav .ico{flex:none;background:none;border:none;cursor:pointer;padding:4px 3px;line-height:1;color:var(--txt)}
.p153 .navPad{height:8px}

/* 빌보드 */
.p153 .bb{position:relative;margin:-56px 0 0;min-height:56vh;display:flex;align-items:flex-end;overflow:hidden}
.p153 .bb .bg{position:absolute;inset:0;background-size:cover;background-position:center 22%;transform:scale(1.02)}
.p153 .bb .sh{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 30%,rgba(0,0,0,.75) 78%,var(--bg) 100%)}
.p153 .bb .sh2{position:absolute;inset:0;
  background:linear-gradient(90deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,.25) 45%,transparent 75%)}
.p153 .bb .in{position:relative;z-index:2;padding:0 16px 22px;max-width:660px}
.p153 .bbTag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:900;
  letter-spacing:2px;color:var(--mint);margin-bottom:10px}
.p153 .bbT{font-size:27px;font-weight:900;line-height:1.2;letter-spacing:-.6px;margin-bottom:10px;
  text-shadow:0 2px 14px rgba(0,0,0,.45)}
.p153 .bbP{font-size:13.5px;line-height:1.6;color:var(--ink2);margin-bottom:16px;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.p153 .bbB{display:flex;gap:9px;flex-wrap:wrap}
.p153 .bbB button{border:none;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:900;
  cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.p153 .bplay{background:var(--mint);color:#04211E}
.p153 .binfo{background:rgba(120,124,128,.55);color:#fff}

/* 가로 행 */
.p153 .rows{padding-bottom:20px}
.p153 .row{margin:0 0 26px;position:relative}
.p153 .rowH{display:flex;align-items:baseline;gap:10px;padding:0 16px 9px}
.p153 .rowH h3{font-size:16.5px;font-weight:900;letter-spacing:-.3px;display:flex;align-items:center;gap:7px;min-width:0}
.p153 .rowH .more{background:none;border:none;color:var(--mint);font-size:12.5px;font-weight:800;
  cursor:pointer;padding:2px 4px;white-space:nowrap}
.p153 .rail{display:flex;gap:8px;overflow-x:auto;padding:0 16px 6px;scroll-snap-type:x proximity;
  scroll-padding-left:16px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.p153 .rail::-webkit-scrollbar{display:none}

/* 타일 */
.p153 .tile{flex:0 0 auto;width:44vw;max-width:230px;scroll-snap-align:start;cursor:pointer;
  background:none;border:none;padding:0;text-align:left;color:inherit}
.p153 .tile .th{position:relative;aspect-ratio:16/9;border-radius:5px;overflow:hidden;background:#000}
.p153 .tile .th img{width:100%;height:100%;object-fit:cover;display:block}
.p153 .tile .ig{display:flex;align-items:center;justify-content:center;gap:5px;height:100%;color:#fff;
  font-weight:900;letter-spacing:2px;font-size:11px;background:linear-gradient(135deg,#FEDA75,#F58529,#DD2A7B,#8134AF)}
.p153 .tile .dur{position:absolute;right:5px;bottom:5px;background:rgba(0,0,0,.8);color:#fff;
  border-radius:4px;padding:2px 6px;font-size:10.5px;font-weight:800}
.p153 .tile .lgb{position:absolute;left:5px;top:5px;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:900}
.p153 .tile .pg{position:absolute;left:0;bottom:0;height:3px;background:var(--mint)}
.p153 .tile .tt{font-size:12.5px;font-weight:700;line-height:1.35;margin-top:7px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.p153 .tile .tm{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--dim);margin-top:3px;
  white-space:nowrap;overflow:hidden}
.p153 .tile .tm .chn{overflow:hidden;text-overflow:ellipsis}
.p153 .hidb{position:absolute;left:5px;bottom:5px;display:inline-flex;align-items:center;gap:3px;
  background:rgba(0,0,0,.82);color:#FFB4A2;border:1px solid rgba(255,180,162,.5);border-radius:5px;
  padding:2px 6px;font-size:9.5px;font-weight:900}
.p153 .sv{position:absolute;right:5px;top:5px;width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.55);
  background:rgba(0,0,0,.6);color:#fff;font-size:14px;font-weight:900;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;padding:0}
.p153 .sv.on{background:var(--mint);border-color:var(--mint);color:#04211E}

/* 그리드 */
.p153 .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 8px;padding:0 16px}
.p153 .grid .tile{width:auto;max-width:none}
.p153 .moreBtn{display:block;margin:22px auto 0;background:var(--card);border:1px solid var(--line);
  color:var(--txt);border-radius:10px;padding:13px 30px;font-size:14px;font-weight:900;cursor:pointer}

/* 카테고리 */
.p153 .catHead{padding:8px 16px 4px}
.p153 .catHead h1{display:flex;align-items:center;gap:9px;font-size:26px;font-weight:900;letter-spacing:-.5px}
.p153 .catHead .cs{font-size:13px;color:var(--sub);margin-top:5px}
.p153 .catBar{display:flex;gap:7px;align-items:center;padding:12px 16px 6px;overflow-x:auto;scrollbar-width:none}
.p153 .catBar::-webkit-scrollbar{display:none}
.p153 .seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:9px;overflow:hidden;flex:none}
.p153 .seg button{background:none;border:none;color:var(--sub);font-size:12.5px;font-weight:800;
  padding:9px 13px;cursor:pointer;white-space:nowrap}
.p153 .seg button.on{background:var(--mint);color:#04211E}

/* 검색 */
.p153 .sBox{padding:6px 16px 10px}
.p153 .sInput{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;
  padding:14px 16px;color:var(--txt);font-size:16px;font-family:inherit;outline:none}
.p153 .sInput:focus{border-color:var(--mint)}
.p153 .sInput::placeholder{color:var(--dim)}
.p153 .sMeta{font-size:12.5px;color:var(--sub);padding:4px 16px 12px}
.p153 .sugg{display:flex;gap:6px;flex-wrap:wrap;padding:2px 16px 14px}
.p153 .sugg button{background:var(--card);border:1px solid var(--line);color:var(--sub);border-radius:999px;
  padding:7px 13px;font-size:12.5px;font-weight:800;cursor:pointer}
.p153 .emptyS{text-align:center;color:var(--dim);padding:56px 20px;font-size:14px;line-height:1.8}

/* 상세 모달 */
.p153modal{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.82);overflow-y:auto;
  -webkit-overflow-scrolling:touch;padding:0 0 60px;
  --mint:#45E0CE;--gold:#E6B94D;--bg:#141414;--card:#1F1F1F;--line:#2E2E2E;
  --txt:#FFFFFF;--sub:#B3B3B3;--dim:#8C8C8C;--ink2:#E5E5E5;
  font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif}
.p153modal button{font-family:inherit}
.p153modal .mdBox{background:var(--bg);color:var(--txt);max-width:920px;margin:0 auto;
  border-radius:0 0 10px 10px;overflow:hidden;position:relative;min-height:100%}
.p153modal .mdX{position:fixed;top:12px;left:12px;z-index:110;width:38px;height:38px;border-radius:50%;
  border:none;background:rgba(0,0,0,.72);color:#fff;font-size:19px;cursor:pointer}
.p153modal .mdVid{position:relative;aspect-ratio:16/9;background:#000}
.p153modal .mdVid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.p153modal .mdVid.igr{aspect-ratio:9/16;max-width:340px;margin:0 auto}
.p153modal .mdIn{padding:18px 18px 28px}
.p153modal .mdT{font-size:20px;font-weight:900;line-height:1.35;letter-spacing:-.4px}
.p153modal .mdM{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 4px;font-size:12.5px;color:var(--sub)}
.p153modal .mdM .bdg{border-radius:5px;padding:3px 9px;font-size:11.5px;font-weight:900}
.p153modal .mdM .st{color:var(--gold);font-weight:900;display:inline-flex;align-items:center;gap:3px}
.p153modal .mdCh{display:flex;align-items:center;gap:6px;font-size:13.5px;color:var(--sub);margin-top:2px}
.p153modal .mdA{display:flex;gap:8px;margin:14px 0 4px;flex-wrap:wrap}
.p153modal .mdA a,.p153modal .mdA button{border:none;border-radius:8px;padding:11px 17px;font-size:13.5px;
  font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.p153modal .mdA .p1{background:var(--mint);color:#04211E}
.p153modal .mdA .p2{background:var(--card);color:var(--txt);border:1px solid var(--line)}
.p153modal .mdSec{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:13px}
.p153modal .mdSec .lb{color:var(--mint);font-size:11.5px;font-weight:900;letter-spacing:1.5px;margin-bottom:9px}
.p153modal .mdSec p{font-size:14px;line-height:1.7;color:var(--ink2)}
.p153modal .cpr{display:flex;gap:10px;margin-bottom:10px}
.p153modal .cpr:last-child{margin-bottom:0}
.p153modal .cpr b{color:var(--mint);font-size:13.5px;flex:none}
.p153modal .cpr span{font-size:13.5px;line-height:1.6;color:var(--ink2)}
.p153modal .mdTags{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
.p153modal .mdTags span{background:var(--card);border:1px solid var(--line);color:var(--sub);
  border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:800}
.p153modal .mdWarn{background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.4);color:#E5484D;
  border-radius:10px;padding:11px 13px;font-size:12.5px;font-weight:800;line-height:1.5;margin-top:10px}
@media(min-width:900px){
  .p153 .bb{min-height:64vh}
  .p153 .bbT{font-size:40px}
  .p153 .tile{width:22vw;max-width:270px}
  .p153 .grid{grid-template-columns:repeat(4,1fr)}
  .p153modal .mdBox{margin:34px auto;border-radius:10px;min-height:0}
}
`;

// ───────────────────────── 데이터 ─────────────────────────

interface ProgramLite {
  id: string; yt_id: string; title: string; channel: string | null; country: string | null;
  tags: string[] | null; league: string; minutes: number | null; score: number | null;
  platform: string | null; visibility: string | null; rights_tier: string | null; created_at: string | null;
}
interface ProgramFull extends ProgramLite {
  equipment: string[] | null; summary: string | null; coach_points: string[] | null; target: string | null;
}

const LEAGUES: Record<string, { bg: string; fg: string }> = {
  화이트: { bg: "#F4F4F2", fg: "#111" },
  블루: { bg: "#2B6CB0", fg: "#fff" },
  레드: { bg: "#C53030", fg: "#fff" },
  블랙: { bg: "#111", fg: "#45E0CE" },
};
const CN: Record<string, string> = {
  "🇰🇷": "한국", "🇺🇸": "미국", "🇬🇧": "영국", "🇯🇵": "일본", "🇲🇽": "멕시코", "🇵🇭": "필리핀",
  "🇷🇺": "러시아", "🇺🇦": "우크라이나", "🇨🇺": "쿠바", "🇦🇷": "아르헨티나", "🇹🇭": "태국",
  "🇰🇿": "카자흐스탄", "🇮🇪": "아일랜드", "🇩🇪": "독일", "🇨🇦": "캐나다", "🇦🇺": "호주",
};
const TIER_LABEL: Record<string, string> = {
  official: "공식", creator: "제작자", reupload: "재업로드", archive: "아카이브",
};
const cn = (c: string | null) => (c ? CN[c] ?? "기타" : "기타");

const thumbOf = (yt: string) => `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
const wideOf = (yt: string) => `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`;
const isIG = (p: { platform?: string | null }) => (p.platform ?? "youtube") === "instagram";
const igUrl = (code: string) => `https://www.instagram.com/reel/${code}/`;
const hasT = (p: ProgramLite, t: string) => (p.tags ?? []).includes(t);
const isMeta = (p: ProgramLite) => hasT(p, "명경기") || hasT(p, "다큐");
/** 제목 앞의 [명경기] 같은 말머리를 뗀다 (원본 앱과 동일) */
const cleanT = (s: string) =>
  s.replace(/^\[[^\]]+\]\s*/, "").replace(/\s*\([^()]*(공식|만뷰|천뷰|분)[^()]*\)\s*$/, "").trim();

/** 월드 라이브러리 전체 (RLS 가 회원/관리자에 맞는 행만 내려준다) */
const useWorldPrograms = () =>
  useQuery({
    queryKey: ["boxing-library"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ProgramLite[]> => {
      const cols = "id, yt_id, title, channel, country, tags, league, minutes, score, " +
        "platform, visibility, rights_tier, created_at";
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

/** 보관함 — 기기 로컬 저장 */
const SAVE_KEY = "153_play_saved";
const loadSaved = (): Record<string, true> => {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch { return {}; }
};
const useSaved = () => {
  const [saved, setSaved] = useState<Record<string, true>>(loadSaved);
  const toggle = useCallback((id: string) => {
    setSaved((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  }, []);
  return useMemo(() => ({ saved, toggle }), [saved, toggle]);
};

// 타일 하나 = 레벨 미션 영상 또는 월드 프로그램
type Item = { kind: "level"; v: LevelVideo } | { kind: "world"; p: ProgramLite };
const W = (p: ProgramLite): Item => ({ kind: "world", p });
const L = (v: LevelVideo): Item => ({ kind: "level", v });
const itemId = (it: Item) => (it.kind === "level" ? `L:${it.v.id}` : `W:${it.p.id}`);

type SavedApi = ReturnType<typeof useSaved>;
type WatchedApi = ReturnType<typeof useWatchedVideos>;

// ───────────────────────── 타일 · 행 ─────────────────────────

const Tile = ({ it, onPick, savedApi, watchedApi }: {
  it: Item; onPick: (it: Item) => void; savedApi: SavedApi; watchedApi: WatchedApi;
}) => {
  const key = itemId(it);
  const isSaved = !!savedApi.saved[key];

  if (it.kind === "level") {
    const t = parseVideoTitle(it.v.title);
    const th = it.v.posterUrl || youtubeThumb(it.v.videoUrl);
    const done = !!watchedApi.watched[it.v.id];
    return (
      <button type="button" className="tile" onClick={() => onPick(it)}>
        <div className="th">
          {th ? <img loading="lazy" src={th} alt="" /> : <div className="ig">153</div>}
          <span className="lgb" style={{ background: "#111", color: "#45E0CE" }}>미션</span>
          <span className={`sv${isSaved ? " on" : ""}`} role="presentation"
            onClick={(e) => { e.stopPropagation(); savedApi.toggle(key); }}>
            {isSaved ? "✓" : "+"}
          </span>
          {done && <i className="pg" style={{ width: "100%" }} />}
        </div>
        <div className="tt">{t.name}</div>
        <div className="tm"><span className="chn">153복싱짐{t.tag ? ` · ${t.tag}` : ""}</span></div>
      </button>
    );
  }

  const p = it.p;
  const lg = LEAGUES[p.league] ?? LEAGUES["화이트"];
  const badge = hasT(p, "명경기") ? { t: "명경기", bg: "#111", fg: "#FFD166" }
    : hasT(p, "다큐") ? { t: "다큐", bg: "#3A2E5A", fg: "#D9CBFF" }
    : hasT(p, "레슨") ? { t: "레슨", bg: lg.bg, fg: lg.fg }
    : hasT(p, "코치교육") ? { t: "코치", bg: "#111", fg: "#45E0CE" }
    : { t: p.league, bg: lg.bg, fg: lg.fg };
  return (
    <button type="button" className="tile" onClick={() => onPick(it)}>
      <div className="th">
        {isIG(p)
          ? <div className="ig">REELS ▶</div>
          : <img loading="lazy" src={thumbOf(p.yt_id)} alt=""
              onError={(e) => {
                const f = `https://img.youtube.com/vi/${p.yt_id}/mqdefault.jpg`;
                if (e.currentTarget.src !== f) e.currentTarget.src = f;
              }} />}
        <span className="lgb" style={{ background: badge.bg, color: badge.fg }}>{badge.t}</span>
        <span className={`sv${isSaved ? " on" : ""}`} role="presentation"
          onClick={(e) => { e.stopPropagation(); savedApi.toggle(key); }}>
          {isSaved ? "✓" : "+"}
        </span>
        {!isIG(p) && !!p.minutes && <span className="dur">{p.minutes}분</span>}
        {p.visibility === "admin" && <span className="hidb">👁 비공개</span>}
      </div>
      <div className="tt">{cleanT(p.title)}</div>
      <div className="tm">
        <span>{p.country}</span>
        <span className="chn">{p.channel}</span>
        <span>· ★{p.score ?? 7}</span>
      </div>
    </button>
  );
};

const Rail = ({ title, items, moreKey, onPick, onMore, savedApi, watchedApi }: {
  title: string; items: Item[]; moreKey?: string;
  onPick: (it: Item) => void; onMore: (k: string) => void;
  savedApi: SavedApi; watchedApi: WatchedApi;
}) => {
  if (items.length === 0) return null;
  return (
    <div className="row">
      <div className="rowH">
        <h3>{title}</h3>
        {moreKey && <button className="more" onClick={() => onMore(moreKey)}>모두 보기 ›</button>}
      </div>
      <div className="rail">
        {items.map((it) => (
          <Tile key={itemId(it)} it={it} onPick={onPick} savedApi={savedApi} watchedApi={watchedApi} />
        ))}
      </div>
    </div>
  );
};

// ───────────────────────── 상세 모달 ─────────────────────────

const Modal = ({ it, autoplay, onClose, isAdmin, watchedApi }: {
  it: Item; autoplay: boolean; onClose: () => void; isAdmin: boolean; watchedApi: WatchedApi;
}) => {
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const ig = it.kind === "world" && isIG(it.p);
  const ytId = it.kind === "level" ? youtubeId(it.v.videoUrl) : it.p.yt_id;
  const ap = autoplay ? "&autoplay=1" : "";

  return (
    <div className="p153modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="mdX" onClick={onClose} aria-label="닫기">✕</button>
      <div className="mdBox">
        <div className={`mdVid${ig ? " igr" : ""}`}>
          {ig ? (
            <iframe title={cleanT(it.kind === "world" ? it.p.title : "")}
              src={`https://www.instagram.com/reel/${ytId}/embed/captioned`}
              scrolling="no" allowFullScreen />
          ) : ytId ? (
            <iframe
              title={it.kind === "level" ? parseVideoTitle(it.v.title).name : cleanT(it.p.title)}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1${ap}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen />
          ) : null}
        </div>

        <div className="mdIn">
          {it.kind === "world" ? (
            <WorldBody p={it.p} full={full ?? null} isAdmin={isAdmin} />
          ) : (
            <LevelBody v={it.v} watchedApi={watchedApi} />
          )}
        </div>
      </div>
    </div>
  );
};

const WorldBody = ({ p, full, isAdmin }: { p: ProgramLite; full: ProgramFull | null; isAdmin: boolean }) => {
  const lg = LEAGUES[p.league] ?? LEAGUES["화이트"];
  return (
    <>
      <div className="mdT">{cleanT(p.title)}</div>
      <div className="mdM">
        <span className="bdg" style={{ background: lg.bg, color: lg.fg }}>{p.league} 리그</span>
        {!isIG(p) && !!p.minutes && <span>{p.minutes}분</span>}
        <span className="st">★ {p.score ?? 7}/10</span>
        {isIG(p) && <span>인스타그램 릴스</span>}
      </div>
      <div className="mdCh">{p.country} {cn(p.country)} · {p.channel}</div>
      {isAdmin && p.visibility === "admin" && (
        <div className="mdWarn">
          관리자 전용 · {TIER_LABEL[p.rights_tier ?? ""] ?? "미분류"} — 회원 계정에는 보이지 않습니다.
        </div>
      )}
      <div className="mdA">
        <a className="p1" href={isIG(p) ? igUrl(p.yt_id) : `https://www.youtube.com/watch?v=${p.yt_id}`}
          target="_blank" rel="noopener noreferrer">
          {isIG(p) ? "인스타그램에서 열기" : "유튜브 앱에서 열기"}
        </a>
      </div>
      {full?.summary && (
        <div className="mdSec"><div className="lb">세션 구성 요약</div><p>{full.summary}</p></div>
      )}
      {(full?.coach_points ?? []).length > 0 && (
        <div className="mdSec">
          <div className="lb">관장님 코치 포인트</div>
          {(full?.coach_points ?? []).map((c, i) => (
            <div className="cpr" key={i}><b>{i + 1}</b><span>{c}</span></div>
          ))}
        </div>
      )}
      {full?.target && (
        <div className="mdSec"><div className="lb">추천 대상</div><p>{full.target}</p></div>
      )}
      {(p.tags ?? []).length > 0 && (
        <div className="mdTags">{(p.tags ?? []).map((t) => <span key={t}>{t}</span>)}</div>
      )}
    </>
  );
};

const LevelBody = ({ v, watchedApi }: { v: LevelVideo; watchedApi: WatchedApi }) => {
  const t = parseVideoTitle(v.title);
  const done = !!watchedApi.watched[v.id];
  const mark = () => {
    const was = done;
    watchedApi.toggle(v.id);
    if (!was) toast.success("오삼이: 눈으로 익혔으면 이제 몸으로! 체육관에서 바로 해봐요 🥊");
  };
  return (
    <>
      <div className="mdT">{t.name}</div>
      <div className="mdM">
        <span className="bdg" style={{ background: "#111", color: "#45E0CE" }}>레벨 미션</span>
        {t.tag && <span>{t.tag}</span>}
      </div>
      <div className="mdCh">🇰🇷 153복싱짐 · 관장님 직접 촬영</div>
      {t.sub && <div className="mdSec"><div className="lb">한 줄 요약</div><p>{t.sub}</p></div>}
      {v.description && (
        <div className="mdSec"><div className="lb">이 동작을 왜 하나요</div><p>{v.description}</p></div>
      )}
      {v.keyPoints.length > 0 && (
        <div className="mdSec">
          <div className="lb">핵심 포인트</div>
          {v.keyPoints.map((k, i) => <div className="cpr" key={i}><b>{i + 1}</b><span>{k}</span></div>)}
        </div>
      )}
      <div className="mdA" style={{ marginTop: 16 }}>
        <button className={done ? "p2" : "p1"} onClick={mark}>
          {done ? "✓ 시청 완료" : "다 봤어요"}
        </button>
      </div>
    </>
  );
};

// ───────────────────────── 페이지 ─────────────────────────

type CatKey = "home" | "mylv" | "lgd" | "docu" | "lsn" | "lib" | "saved";
const NAV: [CatKey, string][] = [
  ["home", "홈"], ["mylv", "내 레벨"], ["lgd", "명경기"],
  ["docu", "다큐"], ["lsn", "레슨"], ["lib", "훈련"], ["saved", "보관함"],
];
const CAT_META: Record<Exclude<CatKey, "home" | "mylv">, { t: string; sub: string }> = {
  lgd: { t: "명경기", sub: "세계 타이틀전 · 레전드 매치" },
  docu: { t: "다큐", sub: "복싱 다큐멘터리 · 선수 이야기" },
  lsn: { t: "레슨", sub: "영상으로 배우는 기술" },
  lib: { t: "훈련", sub: "따라 하는 훈련 라이브러리" },
  saved: { t: "보관함", sub: "내가 담아둔 영상" },
};
const SUGGEST = ["잽", "풋워크", "디펜스", "미트", "줄넘기", "콤비네이션", "홍수환", "이노우에"];
const W_LEAGUES = ["전체", "화이트", "블루", "레드", "블랙"];
const W_TIMES = ["전체", "~10분", "10~20분", "20분+"];
const LEAGUE_KEYS = ["white", "blue", "red", "black"] as const;
const PAGE = 60;

const shuf = <T,>(l: T[], seed: number) => {
  const a = l.slice(); let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const BoxingLibraryPage = () => {
  const { progress, role } = useAuth();
  const [params] = useSearchParams();
  // 월드 탭은 전 회원 공개. 저작권 소지 영상은 DB(RLS)에서 걸러지므로 UI 로 막지 않는다.
  // isAdmin 은 '관리자 전용' 표시 용도로만 쓴다.
  const isAdmin = role === "admin" || role === "super_admin";

  const myLeague = (progress?.current_rank as string) ?? "white";
  const myLevel = progress?.current_level ?? 1;
  const initLevel = Math.min(10, Math.max(1, Number(params.get("lv")) || myLevel));
  const myLeagueLabel = RANK_LABELS[myLeague] ?? "화이트";

  const [cat, setCat] = useState<CatKey>(
    (NAV.find(([k]) => k === params.get("tab"))?.[0] as CatKey) ?? "home",
  );
  const [searchOn, setSearchOn] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ it: Item; ap: boolean } | null>(null);
  const [solid, setSolid] = useState(false);
  const [lim, setLim] = useState(PAGE);
  const [fLeague, setFLeague] = useState("전체");
  const [fTime, setFTime] = useState("전체");
  const [lvLeague, setLvLeague] = useState<string>(myLeague);
  const [lvLevel, setLvLevel] = useState<number>(initLevel);
  const topRef = useRef<HTMLDivElement>(null);

  const savedApi = useSaved();
  const watchedApi = useWatchedVideos();
  const { data: programs = [], isLoading } = useWorldPrograms();
  const { data: nowVideos = [] } = useLevelVideos(myLeague, initLevel);
  const { data: nextVideos = [] } = useLevelVideos(myLeague, Math.min(10, initLevel + 1));
  const { data: lvVideos = [] } = useLevelVideos(lvLeague, lvLevel);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const goCat = (k: string) => {
    setCat(k as CatKey); setSearchOn(false); setLim(PAGE);
    setFLeague("전체"); setFTime("전체");
    window.scrollTo({ top: 0 });
  };

  const libList = useMemo(() => programs.filter((p) => !isMeta(p)), [programs]);
  const byTag = useCallback((t: string) => programs.filter((p) => hasT(p, t)), [programs]);

  // ── 빌보드 ──
  const bb = useMemo(() => {
    const pool = programs.filter((p) => !isIG(p) && (p.score ?? 0) >= 9 && isMeta(p));
    const p2 = pool.length ? pool : programs.filter((p) => !isIG(p));
    if (!p2.length) return null;
    return p2[Math.floor(Date.now() / 864e5) % p2.length];
  }, [programs]);

  // ── 홈 행 ──
  const rows = useMemo(() => {
    const top = (l: ProgramLite[], n = 24) => l.slice(0, n).map(W);
    const out: { t: string; items: Item[]; more?: string }[] = [
      { t: `지금 내 레벨 · ${myLeagueLabel} L${initLevel}`, items: nowVideos.map(L), more: "mylv" },
      { t: `다음 레벨 미리보기 · L${Math.min(10, initLevel + 1)}`,
        items: initLevel < 10 ? nextVideos.map(L) : [], more: "mylv" },
      { t: "레전드 매치 — 세계 타이틀전", items: top(byTag("명경기")), more: "lgd" },
      { t: "한국 복싱 서사", items: top(programs.filter((p) => p.country === "🇰🇷" && hasT(p, "명경기"))), more: "lgd" },
      { t: "복싱 다큐멘터리", items: top(byTag("다큐")), more: "docu" },
      { t: "영상으로 배우는 복싱", items: top(byTag("레슨")), more: "lsn" },
      { t: "오늘의 훈련 — 라이브러리",
        items: top(shuf(libList, Math.floor(Date.now() / 864e5) + 7)), more: "lib" },
      { t: "여자 복싱", items: top(byTag("여자복싱")) },
      { t: `${myLeagueLabel} 리그 — 지금 내 단계`,
        items: top(programs.filter((p) => p.league === myLeagueLabel && !isMeta(p))), more: "lib" },
      { t: "코치 교육 — 지도자용", items: top(byTag("코치교육")) },
      { t: "복싱 분석 — 기술 해부", items: top(byTag("분석")) },
      { t: "10분 이하 — 짧고 굵게",
        items: top(shuf(libList.filter((p) => (p.minutes ?? 0) > 0 && (p.minutes ?? 0) <= 10), 3)), more: "lib" },
      { t: "릴스로 보는 한 컷", items: top(programs.filter(isIG)) },
      { t: "최근 추가된 영상",
        items: top(programs.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))) },
    ];
    (["🇺🇸", "🇲🇽", "🇯🇵", "🇬🇧", "🇵🇭", "🇺🇦"]).forEach((c) => {
      const l = programs.filter((p) => p.country === c && isMeta(p));
      if (l.length >= 6) out.push({ t: `${c} ${cn(c)} 복싱`, items: top(l) });
    });
    const sv = programs.filter((p) => savedApi.saved[`W:${p.id}`]);
    if (sv.length) out.unshift({ t: "보관함에 담은 영상", items: top(sv), more: "saved" });
    if (isAdmin) {
      const ad = programs.filter((p) => p.visibility === "admin");
      if (ad.length) out.push({ t: "관리자 전용 · 권리 확인 필요", items: top(ad, 30) });
    }
    return out.filter((r) => r.items.length > 0);
  }, [programs, libList, byTag, nowVideos, nextVideos, myLeagueLabel, initLevel, isAdmin, savedApi.saved]);

  // ── 카테고리 목록 ──
  const catList = useMemo(() => {
    let l: ProgramLite[] =
      cat === "lgd" ? byTag("명경기")
      : cat === "docu" ? byTag("다큐")
      : cat === "lsn" ? byTag("레슨")
      : cat === "lib" ? libList
      : cat === "saved" ? programs.filter((p) => savedApi.saved[`W:${p.id}`])
      : [];
    if (fLeague !== "전체") l = l.filter((p) => p.league === fLeague);
    if (fTime !== "전체") l = l.filter((p) => {
      const m = p.minutes ?? 0;
      return fTime === "~10분" ? m > 0 && m <= 10 : fTime === "10~20분" ? m > 10 && m <= 20 : m > 20;
    });
    return l;
  }, [cat, byTag, libList, programs, savedApi.saved, fLeague, fTime]);

  // ── 검색 ──
  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [] as Item[];
    const lv = [...nowVideos, ...nextVideos, ...lvVideos]
      .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
      .filter((v) => v.title.toLowerCase().includes(k)).map(L);
    const wd = programs.filter((p) =>
      `${p.title} ${p.channel ?? ""} ${cn(p.country)} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(k),
    ).slice(0, 120).map(W);
    return [...lv, ...wd];
  }, [q, programs, nowVideos, nextVideos, lvVideos]);

  const pick = (it: Item) => setOpen({ it, ap: false });
  const gridOf = (items: Item[]) => (
    <div className="grid">
      {items.map((it) => (
        <Tile key={itemId(it)} it={it} onPick={pick} savedApi={savedApi} watchedApi={watchedApi} />
      ))}
    </div>
  );

  return (
    <div className="p153" ref={topRef}>
      <style>{CSS}</style>

      {/* 상단 내비 */}
      <div className={`nav${solid || cat !== "home" || searchOn ? " solid" : ""}`}>
        <div className="navMenu">
          {NAV.map(([k, label]) => (
            <button key={k} className={!searchOn && cat === k ? "on" : ""} onClick={() => goCat(k)}>
              {label}
            </button>
          ))}
        </div>
        <button className="ico" aria-label="검색"
          onClick={() => { setSearchOn((s) => !s); setQ(""); window.scrollTo({ top: 0 }); }}>
          {searchOn ? "✕" : "🔍"}
        </button>
      </div>

      {/* 검색 */}
      {searchOn ? (
        <>
          <div className="sBox">
            <input className="sInput" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="제목·선수·채널·기술로 검색 (예: 홍수환, 잽, 줄넘기)" />
          </div>
          {!q && (
            <div className="sugg">
              {SUGGEST.map((s) => <button key={s} onClick={() => setQ(s)}>{s}</button>)}
            </div>
          )}
          {q && <div className="sMeta">{results.length.toLocaleString()}편</div>}
          {q && results.length === 0
            ? <div className="emptyS">"{q}" 검색 결과가 없어요.<br />다른 기술 이름이나 선수 이름으로 찾아보세요.</div>
            : gridOf(results.slice(0, lim))}
          {q && results.length > lim && (
            <button className="moreBtn" onClick={() => setLim((n) => n + PAGE)}>더 보기</button>
          )}
        </>
      ) : cat === "home" ? (
        <>
          {/* 빌보드 */}
          {bb && (
            <section className="bb">
              <div className="bg" style={{
                backgroundImage: `url(${wideOf(bb.yt_id)}), url(${thumbOf(bb.yt_id)})`,
              }} />
              <div className="sh" /><div className="sh2" />
              <div className="in">
                <div className="bbTag">
                  {hasT(bb, "명경기") ? "오늘의 명경기" : hasT(bb, "다큐") ? "오늘의 다큐" : "오늘의 추천"}
                </div>
                <h2 className="bbT">{cleanT(bb.title)}</h2>
                <p className="bbP">{bb.country} {cn(bb.country)} · {bb.channel} · {bb.league} 리그{bb.minutes ? ` · ${bb.minutes}분` : ""}</p>
                <div className="bbB">
                  <button className="bplay" onClick={() => setOpen({ it: W(bb), ap: true })}>▶ 재생</button>
                  <button className="binfo" onClick={() => setOpen({ it: W(bb), ap: false })}>ⓘ 상세 정보</button>
                </div>
              </div>
            </section>
          )}
          {isLoading && !bb && <div className="emptyS">153플레이를 불러오는 중…</div>}
          <div className="rows">
            {rows.map((r) => (
              <Rail key={r.t} title={r.t} items={r.items} moreKey={r.more}
                onPick={pick} onMore={goCat} savedApi={savedApi} watchedApi={watchedApi} />
            ))}
          </div>
        </>
      ) : cat === "mylv" ? (
        <>
          <div className="navPad" />
          <div className="catHead">
            <h1>내 레벨</h1>
            <div className="cs">관장님이 직접 올린 레벨 미션 영상 — 다음 레벨을 미리 예습하세요</div>
          </div>
          <div className="catBar">
            <div className="seg">
              {LEAGUE_KEYS.map((k) => (
                <button key={k} className={lvLeague === k ? "on" : ""}
                  onClick={() => { setLvLeague(k); setLvLevel(1); }}>{RANK_LABELS[k] ?? k}</button>
              ))}
            </div>
          </div>
          <div className="catBar">
            <div className="seg">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} className={lvLevel === n ? "on" : ""} onClick={() => setLvLevel(n)}>
                  L{n}{lvLeague === myLeague && n === myLevel ? " ·지금" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="sMeta">
            {lvVideos.length
              ? `${lvVideos.length}편 · 시청 완료 ${watchedApi.countFor(lvVideos.map((v) => v.id))}편`
              : "이 레벨 영상은 준비 중이에요 — 관장님이 올리면 바로 여기에 뜹니다."}
          </div>
          {gridOf(lvVideos.map(L))}
        </>
      ) : (
        <>
          <div className="navPad" />
          <div className="catHead">
            <h1>{CAT_META[cat].t}</h1>
            <div className="cs">{CAT_META[cat].sub} · {catList.length.toLocaleString()}편</div>
          </div>
          <div className="catBar">
            <div className="seg">
              {W_LEAGUES.map((v) => (
                <button key={v} className={fLeague === v ? "on" : ""}
                  onClick={() => { setFLeague(v); setLim(PAGE); }}>{v}</button>
              ))}
            </div>
            <div className="seg">
              {W_TIMES.map((v) => (
                <button key={v} className={fTime === v ? "on" : ""}
                  onClick={() => { setFTime(v); setLim(PAGE); }}>{v}</button>
              ))}
            </div>
          </div>
          {catList.length === 0
            ? <div className="emptyS">
                {cat === "saved"
                  ? <>보관함이 비어 있어요.<br />타일 오른쪽 위 <b>+</b> 를 누르면 여기에 담깁니다.</>
                  : <>조건에 맞는 영상이 없어요.<br />필터를 조정해 보세요.</>}
              </div>
            : gridOf(catList.slice(0, lim).map(W))}
          {catList.length > lim && (
            <button className="moreBtn" onClick={() => setLim((n) => n + PAGE)}>
              더 보기 ({(catList.length - lim).toLocaleString()}편 남음)
            </button>
          )}
        </>
      )}

      {open && (
        <Modal it={open.it} autoplay={open.ap} isAdmin={isAdmin}
          watchedApi={watchedApi} onClose={() => setOpen(null)} />
      )}
    </div>
  );
};

export default BoxingLibraryPage;
