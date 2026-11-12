/**
 * 🎬 영상으로 배우기 — 153 콘텐츠 카드를 칸(칩)으로 골라 보는 선반 (2026-11-13 대표님 「추천대로 진행」)
 *
 *   · 회원(audience="member"): 훈련 탭 세 칸 중 ③ — 맨 위 붕대 감기 한 줄 → 칸 칩 7개 → 카드 2열
 *       내 레벨까지의 카드가 먼저, 위 레벨은 「레벨 n부터」만(잠그지 않음 · 결정 7번) · 워밍업 칸 맨 앞에 레벨 미션 워밍업 영상
 *       튜토리얼 2일차 2단계 표시(missions-tab-control)가 칩 줄에 붙는다 — 이름을 바꾸면 tutorialCampSteps 도 같이
 *   · 코치진(audience="staff"): 전략 회의 영상 칸 맨 위 「153 콘텐츠 카드」 — 코치 칸 · 검색 · 분 표시 · 카드 시트 맨 아래 단추
 *   · 카드를 누르면 TrainingDrillSheet(카드 시트) — 같은 칸의 「다음 동작 →」
 *   · 처음엔 6장만, 「더 보기」로 칸 전체 (첫 화면 길이 — 설계 문서 「휴대폰 약 두 화면」)
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Play, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toGlobalLevel } from "@/lib/rankLabels";
import {
  MEMBER_SHELVES,
  SHELF_INFO,
  STAFF_SHELVES,
  cardMinutes,
  cardShelf,
  groupByShelf,
  hasCardVideo,
  isMemberVisible,
  levelTag,
  orderForMember,
  orderForStaff,
  searchCards,
  type Shelf,
  type TrainingCard,
} from "@/lib/trainingCards";
import { useCardPosters, useTrainingCards } from "@/services/trainingCardService";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";

export interface ShelfWarmup {
  id: string;
  title: string;
  poster: string | null;
}

interface TrainingShelfProps {
  audience?: "member" | "staff";
  /** 워밍업 칸 맨 앞 — 레벨 미션의 워밍업 영상(읽기만) */
  warmups?: ShelfWarmup[];
  onOpenWarmup?: (id: string) => void;
  /** 카드 시트 맨 아래 단추 (코치진) — close = 카드 시트 닫기 */
  sheetFooter?: (card: TrainingCard, close: () => void) => ReactNode;
}

const FIRST_COUNT = 6;
const shelfKey = (aud: string) => `153learn:shelf:${aud}`;

const readShelf = (aud: string, allowed: readonly Shelf[]): Shelf => {
  try {
    const v = window.localStorage.getItem(shelfKey(aud)) as Shelf | null;
    if (v && allowed.includes(v)) return v;
  } catch {
    /* 무시 */
  }
  return allowed[0];
};

const TrainingShelf = ({ audience = "member", warmups = [], onOpenWarmup, sheetFooter }: TrainingShelfProps) => {
  const staff = audience === "staff";
  const navigate = useNavigate();
  const { progress } = useAuth();
  const myLevel = progress ? toGlobalLevel(progress.current_rank, progress.current_level) : 1;
  const cardsQ = useTrainingCards();
  const allowed = staff ? STAFF_SHELVES : MEMBER_SHELVES;
  const [params, setParams] = useSearchParams();
  const [shelf, setShelfState] = useState<Shelf>(() => {
    const fromUrl = params.get("shelf") as Shelf | null;
    return fromUrl && allowed.includes(fromUrl) ? fromUrl : readShelf(audience, allowed);
  });
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<TrainingCard | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const setShelf = (s: Shelf) => {
    setShelfState(s);
    setExpanded(false);
    try {
      window.localStorage.setItem(shelfKey(audience), s);
    } catch {
      /* 무시 */
    }
  };

  // 기능 검색 · 옛 훈련 라이브러리 주소 → /missions?learn=1 (&shelf=step) 이면 이 칸으로 내려온다
  const learnParam = params.get("learn");
  useEffect(() => {
    if (staff || learnParam !== "1") return;
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    const next = new URLSearchParams(params);
    next.delete("learn");
    next.delete("shelf");
    setParams(next, { replace: true });
    return () => window.clearTimeout(t);
  }, [learnParam, params, setParams, staff]);

  const visible = useMemo(
    () => (cardsQ.data ?? []).filter((c) => (staff ? c.is_active !== false : isMemberVisible(c))),
    [cardsQ.data, staff],
  );
  const groups = useMemo(() => groupByShelf(visible), [visible]);
  const shelves = allowed.filter((s) => (groups[s]?.length ?? 0) > 0 || (s === "warmup" && warmups.length > 0));
  const current: Shelf = shelves.includes(shelf) ? shelf : shelves[0] ?? allowed[0];

  const searching = staff && query.trim().length > 0;
  const list = useMemo(() => {
    if (searching) return searchCards(visible, query);
    const g = groups[current] ?? [];
    return staff ? orderForStaff(g) : orderForMember(g, myLevel);
  }, [searching, visible, query, groups, current, staff, myLevel]);
  const posterOf = useCardPosters(list);

  const showWarmups = !searching && current === "warmup" && warmups.length > 0 && !!onOpenWarmup;
  const total = list.length + (showWarmups ? warmups.length : 0);
  const cut = expanded || searching ? Infinity : FIRST_COUNT;
  const warmupShown = showWarmups ? warmups.slice(0, cut) : [];
  const cardsShown = list.slice(0, Math.max(0, cut - warmupShown.length));
  const hidden = total - warmupShown.length - cardsShown.length;

  // 카드도 워밍업 영상도 없으면(옛 DB · 표 없음) 회원 화면에서는 칸째 숨긴다
  if (!cardsQ.isLoading && visible.length === 0 && warmups.length === 0 && !staff) return null;

  return (
    <section ref={sectionRef} aria-label={staff ? "153 콘텐츠 카드" : "영상으로 배우기"} className="scroll-mt-20 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-heading font-black text-foreground">{staff ? "153 콘텐츠 카드" : "영상으로 배우기"}</h2>
        {staff && visible.length > 0 && <span className="text-label font-bold text-muted-foreground">{visible.length}장</span>}
      </div>

      {/* 붕대 감기 — 수업 전 준비는 칩이 아니라 맨 위 한 줄 */}
      {!staff && (
        <button
          type="button"
          onClick={() => navigate("/handwrap")}
          className="flex h-14 w-full items-center justify-between rounded-2xl border border-border bg-card px-5 text-left transition-all active:scale-[0.99]"
        >
          <span className="text-body font-bold text-foreground">🩹 붕대 감기 배우기</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}

      {staff && (
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="동작 이름 · 준비물로 찾기"
            aria-label="카드 찾기"
            className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="찾기 지우기" className="text-muted-foreground active:scale-90">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}

      {/* 칸 칩 — 회원 튜토리얼 2일차 2단계가 이 줄을 가리킨다 */}
      {!searching && shelves.length > 0 && (
        <div
          data-tour={staff ? undefined : "missions-tab-control"}
          role="tablist"
          aria-label="칸 고르기"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {shelves.map((s) => {
            const on = s === current;
            const info = SHELF_INFO[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setShelf(s)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-label font-bold transition-all active:scale-95 ${
                  on ? "border-transparent text-white" : "border-border bg-card text-foreground"
                }`}
                style={on ? { backgroundColor: info.color } : undefined}
              >
                {info.label}
              </button>
            );
          })}
        </div>
      )}

      {cardsQ.isLoading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">
          {searching ? "찾는 카드가 없어요" : "아직 카드가 없어요"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {warmupShown.map((w) => (
            <button
              key={`w-${w.id}`}
              type="button"
              onClick={() => onOpenWarmup?.(w.id)}
              className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-elev-1 transition-all active:scale-[0.98]"
            >
              <Thumb src={w.poster} color={SHELF_INFO.warmup.color} label="워밍업" video />
              <div className="p-3">
                <p className="line-clamp-2 text-body font-bold leading-snug text-foreground">{w.title}</p>
                <p className="mt-0.5 text-label text-muted-foreground">워밍업 영상</p>
              </div>
            </button>
          ))}
          {cardsShown.map((c) => {
            const tag = staff ? null : levelTag(c, myLevel);
            const info = cardShelf(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpen(c)}
                className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-elev-1 transition-all active:scale-[0.98]"
              >
                <Thumb src={posterOf(c)} color={info.color} label={info.label} video={hasCardVideo(c)} />
                <div className="p-3">
                  <p className="line-clamp-2 text-body font-bold leading-snug text-foreground">{c.name}</p>
                  <p className={`mt-0.5 text-label ${tag?.upcoming ? "text-muted-foreground" : staff ? "text-muted-foreground" : "font-bold text-primary"}`}>
                    {staff
                      ? `${searching ? `${info.label} · ` : ""}${cardMinutes(c)}분${c.level_min ? ` · 레벨 ${c.level_min}` : ""}`
                      : tag?.text ?? info.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-12 w-full items-center justify-center gap-1 rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.99]"
        >
          {SHELF_INFO[current].label} 더 보기 · {hidden}장 <ChevronDown className="h-4 w-4" />
        </button>
      )}

      <TrainingDrillSheet
        exercise={open}
        list={list}
        onChange={setOpen}
        onClose={() => setOpen(null)}
        footer={sheetFooter ? (c) => sheetFooter(c, () => setOpen(null)) : undefined}
      />
    </section>
  );
};

/** 타일 그림 — 첫 장면 · 그림, 없으면 칸 색 바탕에 칸 이름 */
const Thumb = ({ src, color, label, video }: { src: string | null; color: string; label: string; video?: boolean }) => (
  <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: `${color}14` }}>
    {src ? (
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
    ) : (
      <span className="absolute inset-0 flex items-center justify-center text-heading font-black" style={{ color }}>
        {label}
      </span>
    )}
    {video && (
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-micro font-bold text-white">
        <Play className="h-3 w-3 fill-white" /> 영상
      </span>
    )}
  </div>
);

export default TrainingShelf;
