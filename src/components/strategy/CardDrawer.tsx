/**
 * 🃏 카드 서랍 — 전략 회의 세 칸(오늘 프로그램 · 수업 기록 · 영상)이 같이 쓰는 고르기 시트 (2026-11-13 대표님 「추천대로 진행」)
 *
 *   맨 위 검색 · 칩(워밍업 · 기본기 · 스텝 · 기술 · 방어 · 드릴 · 체력 · 쿨다운 · 코치 · 레벨 미션 · 우리 지점 — 11/13 8칸) → 목록(첫 장면 · 이름 · 분)
 *   · 153 카드 = 훈련 라이브러리(training_exercises) · 레벨 미션 = missions(읽기만) · 우리 지점 = 전략 회의 영상(strategy_videos)
 *   · 153플레이(boxing_programs)는 넣지 않는다 — 다른 크리에이터 영상이라 153 방식과 다를 수 있다 (결정 4번)
 *   · 고르면 onPick 하나 — 받는 쪽(오늘 프로그램 블록 · 수업 기록 칩)이 이름 · 분 · 블록 종류를 채운다
 *   · 쓰는 쪽 시트(DmSheet)의 형제로 그린다 — 시트 안에 넣으면 움직이는 시트(transform) 기준으로 붙어 화면 밖으로 밀린다
 */
import { useMemo, useState } from "react";
import { Film, Play, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import {
  SHELF_INFO,
  STAFF_SHELVES,
  cardMinutes,
  cardShelf,
  groupByShelf,
  hasCardVideo,
  orderForStaff,
  searchCards,
  type Shelf,
  type TrainingCard,
} from "@/lib/trainingCards";
import { useCardPosters, useTrainingCards } from "@/services/trainingCardService";
import type { StrategyVideo } from "@/services/strategyService";

/** 서랍에 보이는 레벨 미션 — useMissions 줄에서 필요한 것만 */
export interface DrawerMission {
  id: string;
  title: string;
  /** 예: 화이트 3 · 워밍업 영상 */
  label: string;
  poster: string | null;
  hasVideo: boolean;
}

export type DrawerPick =
  | { kind: "card"; card: TrainingCard }
  | { kind: "mission"; mission: DrawerMission }
  | { kind: "video"; video: StrategyVideo };

type Tab = Shelf | "mission" | "ours";

const RANK_KO: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

/** useMissions() 줄 → 서랍 줄 (레벨 순 · 워밍업 영상은 맨 앞) */
export function missionsForDrawer(
  rows: ReadonlyArray<{
    id: string;
    title: string;
    category?: string | null;
    levels?: { rank_name?: string | null; level_number?: number | null } | null;
    mission_videos?: ReadonlyArray<{ video_url: string | null; poster_url: string | null; sort_order?: number | null }> | null;
  }> | null | undefined,
): DrawerMission[] {
  const rankIdx = (r?: string | null) => Math.max(0, ["white", "blue", "red", "black"].indexOf(r ?? "white"));
  return [...(rows ?? [])]
    .map((m) => {
      const warm = m.category === "warmup";
      const vids = [...(m.mission_videos ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const first = vids.find((v) => v.video_url) ?? null;
      const lv = m.levels?.level_number ?? 0;
      return {
        sortKey: warm ? -1 : rankIdx(m.levels?.rank_name) * 10 + lv,
        row: {
          id: m.id,
          title: m.title,
          label: warm ? "워밍업 영상" : `${RANK_KO[m.levels?.rank_name ?? "white"] ?? ""} ${lv} · 레벨 미션`.trim(),
          poster: first?.poster_url ?? null,
          hasVideo: !!first,
        } satisfies DrawerMission,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((x) => x.row);
}

const norm = (s: string) => s.toLowerCase().replace(/[\s·\-_/()]+/g, "");

export const CardDrawer = ({
  open,
  onClose,
  onPick,
  videos = [],
  missions = [],
  cardsOnly = false,
  pickedIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: DrawerPick) => void;
  /** 우리 지점 영상 (전략 회의 영상 칸) */
  videos?: StrategyVideo[];
  missions?: DrawerMission[];
  /** 수업 기록 — 153 카드만 고른다 */
  cardsOnly?: boolean;
  /** 이미 고른 카드 (수업 기록 칩) — ✓ 표시 */
  pickedIds?: string[];
}) => {
  const cardsQ = useTrainingCards(open);
  const cards = useMemo(() => (cardsQ.data ?? []).filter((c) => c.is_active !== false && c.category !== "준비"), [cardsQ.data]);
  const groups = useMemo(() => groupByShelf(cards), [cards]);
  const shelves = STAFF_SHELVES.filter((s) => (groups[s]?.length ?? 0) > 0);
  const tabs: Tab[] = [...shelves, ...(cardsOnly || missions.length === 0 ? [] : (["mission"] as Tab[])), ...(cardsOnly ? [] : (["ours"] as Tab[]))];
  const [tab, setTab] = useState<Tab>("warmup");
  const [query, setQuery] = useState("");
  const current: Tab = tabs.includes(tab) ? tab : tabs[0] ?? "warmup";
  const q = query.trim();

  const cardList = useMemo(() => {
    if (q) return searchCards(cards, q);
    if (current === "mission" || current === "ours") return [];
    return orderForStaff(groups[current] ?? []);
  }, [q, cards, current, groups]);
  const missionList = useMemo(() => {
    if (cardsOnly) return [];
    if (q) return missions.filter((m) => norm(`${m.title}${m.label}`).includes(norm(q)));
    return current === "mission" ? missions : [];
  }, [cardsOnly, q, missions, current]);
  const videoList = useMemo(() => {
    if (cardsOnly) return [];
    if (q) return videos.filter((v) => norm(v.title).includes(norm(q)));
    return current === "ours" ? videos : [];
  }, [cardsOnly, q, videos, current]);
  const posterOf = useCardPosters(cardList);
  const picked = new Set(pickedIds);
  const empty = cardList.length + missionList.length + videoList.length === 0;

  const tabLabel = (t: Tab) => (t === "mission" ? "레벨 미션" : t === "ours" ? "우리 지점" : SHELF_INFO[t].label);

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="카드 고르기"
      subtitle={cardsOnly ? "오늘 가르친 153 카드를 골라요" : "153 카드 · 레벨 미션 · 우리 지점 영상 — 고르면 이름과 분이 채워져요"}
    >
      <label className="sticky top-0 z-10 flex h-11 items-center gap-2 rounded-2xl border border-border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="동작 이름으로 찾기"
          aria-label="카드 찾기"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="찾기 지우기" className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {!q && (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const on = t === current;
            const color = t === "mission" ? "#191F28" : t === "ours" ? "#6B7684" : SHELF_INFO[t].color;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold active:scale-95",
                  on ? "border-transparent text-white" : "border-border bg-background text-foreground",
                )}
                style={on ? { backgroundColor: color } : undefined}
              >
                {tabLabel(t)}
              </button>
            );
          })}
        </div>
      )}

      {cardsQ.isLoading ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : empty ? (
        <div className="mt-6 rounded-2xl bg-secondary px-4 py-8 text-center">
          <Film className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-[14px] font-bold text-foreground">
            {q ? "찾는 카드가 없어요" : current === "ours" ? "아직 올린 우리 지점 영상이 없어요" : "아직 카드가 없어요"}
          </p>
          {current === "ours" && !q && <p className="mt-1 text-[12.5px] text-muted-foreground">'영상' 탭에서 드릴 영상을 올리면 여기서 고를 수 있어요.</p>}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {cardList.map((c) => {
            const info = cardShelf(c);
            const src = posterOf(c);
            return (
              <li key={c.id}>
                <Row
                  thumb={src}
                  color={info.color}
                  title={c.name}
                  sub={`${info.label} · ${cardMinutes(c)}분${c.level_min ? ` · 레벨 ${c.level_min}` : ""}`}
                  video={hasCardVideo(c)}
                  picked={picked.has(c.id)}
                  onClick={() => onPick({ kind: "card", card: c })}
                />
              </li>
            );
          })}
          {missionList.map((m) => (
            <li key={`m-${m.id}`}>
              <Row thumb={m.poster} color="#191F28" title={m.title} sub={m.label} video={m.hasVideo} onClick={() => onPick({ kind: "mission", mission: m })} />
            </li>
          ))}
          {videoList.map((v) => (
            <li key={`v-${v.id}`}>
              <Row
                thumb={null}
                color="#6B7684"
                title={v.title}
                sub={`우리 지점${v.minutes ? ` · ${v.minutes}분` : ""}`}
                video
                onClick={() => onPick({ kind: "video", video: v })}
              />
            </li>
          ))}
        </ul>
      )}
    </DmSheet>
  );
};

const Row = ({
  thumb,
  color,
  title,
  sub,
  video,
  picked,
  onClick,
}: {
  thumb: string | null;
  color: string;
  title: string;
  sub: string;
  video?: boolean;
  picked?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-2xl border p-2 text-left active:scale-[0.99]",
      picked ? "border-primary bg-primary/5" : "border-border bg-background",
    )}
  >
    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: `${color}1A` }}>
      {thumb ? (
        <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          <Film className="h-5 w-5" />
        </span>
      )}
      {video && (
        <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
          <Play className="h-3 w-3 fill-white text-white" />
        </span>
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14.5px] font-bold text-foreground">{title}</span>
      <span className="block truncate text-[12.5px] text-muted-foreground">{sub}</span>
    </span>
    {picked && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-black text-primary-foreground">고름</span>}
  </button>
);

export default CardDrawer;
