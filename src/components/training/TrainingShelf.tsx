/**
 * 🎬 영상으로 배우기 — 153 콘텐츠 카드를 칸(칩)으로 골라 보는 선반 (2026-11-13 대표님 「추천대로 진행」)
 *
 *   · 회원(audience="member"): 훈련 탭 세 칸 중 ③ — 맨 위 붕대 감기 한 줄 → 칸 칩 → 카드 2열
 *       내 레벨까지의 카드가 먼저, 위 레벨은 「레벨 n부터」(잠그지 않음 · 결정 7번) · 워밍업 칸 맨 앞에 레벨 미션 워밍업 영상
 *       튜토리얼 2일차 2단계 표시(missions-tab-control)가 칩 줄에 붙는다 — 이름을 바꾸면 tutorialCampSteps 도 같이
 *   · 코치진(audience="staff"): 전략 회의 영상 칸 맨 위 「153 콘텐츠 카드」 — 코치 칸 · 검색 · 분 표시 · 카드 시트 맨 아래 단추
 *   · 카드를 누르면 TrainingDrillSheet(카드 시트) — 같은 칸의 「다음 동작 →」
 *   · 처음엔 6장만, 「더 보기」로 칸 전체 (첫 화면 길이 — 설계 문서 「휴대폰 약 두 화면」)
 *
 *   2026-11-14 대표님 「추천대로진행하자」 — 정리 편집 1단계 (lib/shelfLayout · services/shelfLayoutService)
 *   · 대표님 정리(전 지점 한 벌)를 따른다: 칸 순서 · 이름 · 칸마다 순서 · 회원에게 숨김(코치진은 맨 뒤 흐리게) ·
 *     맨 앞 고정(「추천」) · 합치기(남는 카드 시트에 「같은 동작」) · 묶음(폴더 — 누르면 그 줄 아래에 펼침)
 *   · 회원: 내 리그 위 카드는 칸마다 「다음 리그에서 배울 동작 n개」로 접힌다(결정 3번 · 대표님이 끌 수 있음)
 *   · 대표님 · 운영진(회원 화면에서만): 「편집」 또는 카드 길게 누르기 → 아이폰처럼 흔들림 · 끌어서 순서 ·
 *     다른 카드 위에 잠깐 = 합치기 · 묶기 · − = 회원에게 숨기기 · 카드 누르기 = 칸 옮기기 · 고정 … (shelfEdit/)
 *   · 보이지 않는 이용 기록: 영상으로 배우기를 본 날 · 칸 칩 · 묶음 · 레벨 미션 영상 열기(카드는 카드 시트가 남긴다)
 *
 *   2026-11-14 대표님 「다음 2단계진행」 — 내 수업 (training/myClass · lib/myClass · services/myClassService)
 *   · 담기: 타일 오른쪽 아래 + · 카드 시트 「내 수업에 담기」 · 길게 누르기(대표님 편집 계정은 길게 누르기 = 편집 그대로)
 *   · 칩 맨 앞 「내 수업」(담은 게 있을 때만 — 코치진은 회원님이 보여 준 수업이 있어도) → 카드 칸 대신 내 수업 목록
 *   · 주소 ?shelf=mine(&class=<id>) — 알림에서 들어오면 그 수업 편집 창(회원) · 보기 창(코치진)
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, ChevronUp, Minus, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toGlobalLevel } from "@/lib/rankLabels";
import { cn } from "@/lib/utils";
import {
  MEMBER_SHELVES,
  STAFF_SHELVES,
  cardMinutes,
  cardShelf,
  hasCardVideo,
  hasMemberVideo,
  isMemberVisible,
  levelTag,
  normalizeShelf,
  searchCards,
  type Shelf,
  type TrainingCard,
} from "@/lib/trainingCards";
import {
  EMPTY_LAYOUT,
  addToFolder,
  arrangeShelves,
  cardKey,
  countHiddenTiles,
  findOverlaps,
  flattenLeaves,
  folderKey,
  isFolderKey,
  isLeafKey,
  leafName,
  mergedFrom,
  missionKey,
  removeFromFolder,
  setFoldUpper,
  setFolderItems,
  setHidden,
  setShelfItems,
  type ShelfFolderTile,
  type ShelfLeaf,
  type ShelfMission,
  type ShelfTile,
  type TileKey,
} from "@/lib/shelfLayout";
import { useCardPosters, useTrainingCards } from "@/services/trainingCardService";
import { logCardEvent, useCardBrief, useShelfLayout } from "@/services/shelfLayoutService";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import { DRAG_ROOT, useMenuDrag, type MenuDrop } from "@/components/home/menuEdit/useMenuDrag";
import { FadeTag, FolderThumb, Thumb } from "@/components/training/ShelfTiles";
import { useShelfEditor } from "@/components/training/shelfEdit/useShelfEditor";
import { ShelfEditBar, ShelfEditSheets, type EditSheet } from "@/components/training/shelfEdit/ShelfEditUi";
import MyClassPanel from "@/components/training/myClass/MyClassPanel";
import MyClassLayer from "@/components/training/myClass/MyClassLayer";
import { primeAudio, useMyClassFlow } from "@/components/training/myClass/useMyClassFlow";
import { toPlanBlocks, type ClassItem } from "@/lib/myClass";
import { buzz } from "@/features/myboxer-visualization/mindAudio";
import type { ProgramBlock } from "@/services/strategyService";

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
  /** 코치진 — 회원님이 보여 준 수업을 볼 지점 (전략 회의의 지점) */
  branch?: string | null;
  /** 코치진 — 내 수업 편집 창 「이 수업으로 수업안 만들기」 → 전략 회의 「내 수업 짜기」 */
  onClassToPlan?: (plan: { title: string; blocks: ProgramBlock[] }) => void;
}

const FIRST_COUNT = 6;
const COLS = 2;
const shelfKey = (aud: string) => `153learn:shelf:${aud}`;
const MINE = "mine";
const readMine = (aud: string): boolean => {
  try {
    return window.localStorage.getItem(shelfKey(aud)) === MINE;
  } catch {
    return false;
  }
};
const FOLDER_PREFIX = "fold:";
const LAYOUT_SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.7 } as const;

const readShelf = (aud: string, allowed: readonly Shelf[]): Shelf => {
  try {
    const v = normalizeShelf(window.localStorage.getItem(shelfKey(aud)), allowed);
    if (v) return v;
  } catch {
    /* 무시 */
  }
  return allowed[0];
};

/** 끌기 미리보기 순서대로 다시 늘어놓기 (미리보기에 없는 칸은 뒤에) */
function arrange<T extends { key: string }>(list: readonly T[], order: readonly string[] | null): T[] {
  if (!order) return [...list];
  const by = new Map(list.map((e) => [e.key, e]));
  const out: T[] = [];
  for (const k of order) {
    const e = by.get(k);
    if (e) {
      out.push(e);
      by.delete(k);
    }
  }
  return [...out, ...by.values()];
}

interface OpenCard {
  card: TrainingCard;
  list: TrainingCard[];
}

const TrainingShelf = ({ audience = "member", warmups = [], onOpenWarmup, sheetFooter, branch, onClassToPlan }: TrainingShelfProps) => {
  const staff = audience === "staff";
  const navigate = useNavigate();
  const { progress, role, user } = useAuth();
  const myLevel = progress ? toGlobalLevel(progress.current_rank, progress.current_level) : 1;
  const cardsQ = useTrainingCards();
  const layoutQ = useShelfLayout();
  const editor = useShelfEditor(layoutQ.data);
  const clientAdmin = role === "admin" || role === "super_admin";
  const st = layoutQ.data;
  const canEdit = !staff && clientAdmin && !!st && (st.available ? st.canEdit : st.demo);
  const editing = canEdit && editor.editing;
  const layout = editor.draft ?? st?.layout ?? EMPTY_LAYOUT;
  const allowed = staff ? STAFF_SHELVES : MEMBER_SHELVES;
  const [params, setParams] = useSearchParams();
  const [shelf, setShelfState] = useState<Shelf>(() => {
    return normalizeShelf(params.get("shelf"), allowed) ?? readShelf(audience, allowed);
  });
  const [mine, setMineState] = useState<boolean>(() => params.get("shelf") === MINE || readMine(audience));
  const [expanded, setExpanded] = useState(false);
  const [upperOpen, setUpperOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OpenCard | null>(null);
  const [sheet, setSheet] = useState<EditSheet>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const setShelf = (s: Shelf, byTap = false) => {
    setShelfState(s);
    setMineState(false);
    setExpanded(false);
    setUpperOpen(false);
    setOpenFolder(null);
    try {
      window.localStorage.setItem(shelfKey(audience), s);
    } catch {
      /* 무시 */
    }
    if (byTap && !staff && !editing && user) logCardEvent(`s:${s}`, "open", { daily: true });
  };
  const openMine = () => {
    setMineState(true);
    setOpenFolder(null);
    try {
      window.localStorage.setItem(shelfKey(audience), MINE);
    } catch {
      /* 무시 */
    }
    if (!staff && user) logCardEvent(`s:${MINE}`, "open", { daily: true });
  };

  // 기능 검색 · 옛 훈련 라이브러리 주소 → /missions?learn=1 (&shelf=step) 이면 이 칸으로 내려온다.
  // 주소를 지우면 이 효과가 다시 돌므로 내려가기는 따로 기억해 둔다(예전엔 지우는 순간 내려가기 예약까지 취소됐다).
  const learnParam = params.get("learn");
  const [scrollWanted, setScrollWanted] = useState(() => !staff && learnParam === "1");
  useEffect(() => {
    if (staff || learnParam !== "1") return;
    const fromUrl = normalizeShelf(params.get("shelf"), allowed);
    if (fromUrl) setShelf(fromUrl);
    else if (params.get("shelf") === MINE) setMineState(true);
    setScrollWanted(true);
    const next = new URLSearchParams(params);
    next.delete("learn");
    next.delete("shelf");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnParam, params, setParams, staff]);
  // 위 칸(오늘 할 것 · 내 레벨)이 늦게 그려지며 밀어내도 이 칸에 닿도록, 카드를 읽은 뒤 몇 번 더 맞춘다
  useEffect(() => {
    if (!scrollWanted || cardsQ.isLoading) return;
    const go = () => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timers = [200, 900, 1700].map((ms) => window.setTimeout(go, ms));
    const done = window.setTimeout(() => setScrollWanted(false), 1800);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(done);
    };
  }, [scrollWanted, cardsQ.isLoading]);

  const visible = useMemo(
    () => (cardsQ.data ?? []).filter((c) => (staff ? c.is_active !== false : isMemberVisible(c))),
    [cardsQ.data, staff],
  );
  const missions: ShelfMission[] = useMemo(
    () => (onOpenWarmup ? warmups.map((w) => ({ id: w.id, title: w.title, poster: w.poster })) : []),
    [warmups, onOpenWarmup],
  );
  const arranged = useMemo(
    () => arrangeShelves(visible, missions, layout, { audience, myLevel, editing }),
    [visible, missions, layout, audience, myLevel, editing],
  );
  const shelfIds = arranged.map((s) => s.id);
  const current: Shelf = shelfIds.includes(shelf) ? shelf : shelfIds[0] ?? allowed[0];
  const cur = arranged.find((s) => s.id === current) ?? null;
  const posterOf = useCardPosters(visible);

  // ── 내 수업 (2단계) ──
  const flow = useMyClassFlow({
    audience,
    userId: user?.id ?? null,
    cards: cardsQ.data ?? [],
    missions,
    branch,
    paused: editing,
  });
  const mineChip = flow.available && !editing && (flow.classes.length > 0 || (staff && flow.shared.length > 0));
  const showMine = mine && mineChip;
  // 알림에서 ?shelf=mine&class=<id> — 내 수업이면 편집 창, 코치진이 보는 회원 수업이면 보기 창
  const classParam = params.get("class");
  useEffect(() => {
    if (!classParam || !flow.ready) return;
    if (flow.available) {
      if (flow.classes.some((c) => c.id === classParam)) flow.openEditor(classParam);
      else if (staff && flow.shared.some((c) => c.id === classParam)) flow.openShared(classParam);
      setMineState(true);
    }
    const next = new URLSearchParams(params);
    next.delete("class");
    next.delete("learn");
    if (next.get("shelf") === MINE) next.delete("shelf");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classParam, flow.ready, flow.available]);

  // 길게 누르기 = 담기 (대표님 편집 계정은 길게 누르기가 편집이라 + 단추 · 카드 시트로)
  const holdOn = flow.available && !canEdit;
  const holdRef = useRef<{ timer: number | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const holdEnd = () => {
    const h = holdRef.current;
    if (h.timer) window.clearTimeout(h.timer);
    h.timer = null;
  };
  const holdStart = (ev: React.PointerEvent, leaf: ShelfLeaf) => {
    const h = holdRef.current;
    holdEnd();
    h.fired = false;
    h.x = ev.clientX;
    h.y = ev.clientY;
    h.timer = window.setTimeout(() => {
      h.timer = null;
      h.fired = true;
      buzz(15);
      void flow.save(leaf);
    }, 450);
  };
  const holdMove = (ev: React.PointerEvent) => {
    const h = holdRef.current;
    if (h.timer && (Math.abs(ev.clientX - h.x) > 10 || Math.abs(ev.clientY - h.y) > 10)) holdEnd();
  };
  const holdConsume = () => {
    const h = holdRef.current;
    if (!h.fired) return false;
    h.fired = false;
    return true;
  };

  // 코치님 「이 수업으로 수업안 만들기」 — 내 수업 항목 → 수업안 블록
  const cardById = useMemo(() => new Map((cardsQ.data ?? []).map((c) => [c.id, c])), [cardsQ.data]);
  const toPlan = onClassToPlan
    ? (c: { name: string; items: ClassItem[] }) => {
        const blocks = toPlanBlocks(c.items, {
          card: (id) => cardById.get(id),
          mission: (id) => {
            const r = flow.resolve(missionKey(id));
            return r?.kind === "mission" ? { id, title: r.mission.title } : undefined;
          },
        });
        if (!blocks.length) {
          toast.error("수업안에 넣을 카드가 없어요");
          return;
        }
        flow.closeEditor();
        onClassToPlan({ title: c.name, blocks });
      }
    : undefined;

  // 모든 잎 (key → 잎) — 「같은 동작」 · 편집 창 · 끄는 그림
  const leafByKey = useMemo(() => {
    const m = new Map<TileKey, ShelfLeaf>();
    for (const s of arranged) for (const t of [...s.tiles, ...s.upper]) for (const x of t.kind === "folder" ? t.tiles : [t]) m.set(x.key, x);
    return m;
  }, [arranged]);

  const overlaps = useMemo(() => (editing ? findOverlaps(arranged, layout) : []), [editing, arranged, layout]);
  const hiddenCount = useMemo(() => (editing ? countHiddenTiles(arranged) : 0), [editing, arranged]);
  const allKeys = useMemo(() => [...leafByKey.keys(), ...arranged.flatMap((s) => s.tiles.filter((t) => t.kind === "folder").map((t) => t.key))], [leafByKey, arranged]);
  const briefQ = useCardBrief(editing, allKeys);
  const brief = briefQ.data ?? null;

  const searching = staff && query.trim().length > 0;
  const searchList = useMemo(() => (searching ? searchCards(visible, query) : []), [searching, visible, query]);
  const hiddenSet = useMemo(() => new Set(layout.hidden ?? []), [layout.hidden]);

  // 「영상으로 배우기」를 본 날 — 하루 한 번 (회원 화면 · 보이게 된 때)
  useEffect(() => {
    if (staff || editing || !user || !sectionRef.current || typeof IntersectionObserver === "undefined") return;
    const el = sectionRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          logCardEvent("shelf", "shelf", { daily: true });
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [staff, editing, user, cardsQ.isLoading]);

  // ── 끌기 (대표님 편집) ──
  const tiles = cur?.tiles ?? [];
  const folderTile = (id: string | null) => (id ? (tiles.find((t) => t.kind === "folder" && t.id === id) as ShelfFolderTile | undefined) ?? null : null);
  const openFolderTile = folderTile(openFolder);
  const nameOf = (k: TileKey) => {
    const leaf = leafByKey.get(k);
    if (leaf) return leafName(leaf);
    const f = tiles.find((t) => t.key === k);
    return f?.kind === "folder" ? f.name : "카드";
  };

  const onDrop = (d: MenuDrop) => {
    if (!cur) return;
    if (d.kind === "reorder") {
      if (d.container === DRAG_ROOT) editor.apply(setShelfItems(layout, cur.id, d.order), `순서 · ${cur.label}`);
      else if (d.container.startsWith(FOLDER_PREFIX)) editor.apply(setFolderItems(layout, d.container.slice(FOLDER_PREFIX.length), d.order), "묶음 안 순서");
      return;
    }
    if (d.kind === "toRoot") {
      editor.apply(removeFromFolder(layout, cur.id, tiles.map((t) => t.key), d.id, d.beforeId), `묶음에서 빼기 · ${nameOf(d.id)}`);
      return;
    }
    // 다른 카드 위에 놓기 — 묶음이면 넣기, 카드면 합치기 · 묶기 고르기
    if (isFolderKey(d.target)) {
      const next = addToFolder(layout, cur.id, tiles.map((t) => t.key), d.target.slice(2), d.id);
      if (next === layout) {
        toast.error("이 묶음에는 더 넣을 수 없어요");
        return;
      }
      editor.apply(next, `묶음에 넣기 · ${nameOf(d.id)}`);
      toast.success(`‘${nameOf(d.id)}’을(를) ‘${nameOf(d.target)}’ 묶음에 넣었어요`);
      return;
    }
    setSheet({ kind: "merge", dragged: d.id, target: d.target });
  };

  const drag = useMenuDrag({
    editing,
    onLongPress: () => {
      if (canEdit) editor.start();
    },
    onStart: (_id, container) => {
      if (container === DRAG_ROOT) setOpenFolder(null);
    },
    orderOf: (container) => {
      if (container === DRAG_ROOT) return tiles.map((t) => t.key);
      const f = folderTile(container.startsWith(FOLDER_PREFIX) ? container.slice(FOLDER_PREFIX.length) : null);
      return f ? f.tiles.map((t) => t.key) : [];
    },
    canMerge: (dragId, targetId) => isLeafKey(dragId) && dragId !== targetId && (isLeafKey(targetId) || isFolderKey(targetId)),
    onDrop,
  });

  const hide = (key: TileKey, on: boolean) => {
    const prev = layout;
    editor.apply(setHidden(layout, key, on), `${on ? "숨김" : "다시 보임"} · ${nameOf(key)}`);
    if (on)
      toast(`‘${nameOf(key)}’ — 회원님께 숨겼어요`, {
        description: "코치님 화면엔 흐리게 남아요",
        duration: 5000,
        action: { label: "되돌리기", onClick: () => editor.apply(prev, `다시 보임 · ${nameOf(key)}`) },
      });
  };

  // 카드 시트 · 레벨 미션 열기
  const cardsIn = (list: readonly ShelfTile[]) =>
    flattenLeaves(list)
      .filter((x): x is Extract<ShelfLeaf, { kind: "card" }> => x.kind === "card" && !x.hidden && !x.mergedInto)
      .map((x) => x.card);
  const openMission = (id: string) => {
    if (user && !staff) logCardEvent(missionKey(id), "open");
    onOpenWarmup?.(id);
  };
  const openLeaf = (leaf: ShelfLeaf, list: TrainingCard[]) => {
    if (leaf.kind === "mission") openMission(leaf.mission.id);
    else setOpen({ card: leaf.card, list: list.some((c) => c.id === leaf.card.id) ? list : [leaf.card] });
  };
  const openKey = (key: TileKey) => {
    const leaf = leafByKey.get(key);
    if (leaf) openLeaf(leaf, cardsIn(tiles));
  };

  const related = useMemo(() => {
    if (!open) return [];
    // 합친 카드는 회원 화면 타일에 없다 — 보이는 카드 · 미션 전부에서 찾는다
    const find = (k: TileKey): ShelfLeaf | null => {
      const hit = leafByKey.get(k);
      if (hit) return hit;
      const base = { key: k, hidden: false, pinned: false, mergedInto: null };
      if (k.startsWith("c:")) {
        const c = visible.find((x) => x.id === k.slice(2));
        return c ? { ...base, kind: "card", card: c } : null;
      }
      const m = missions.find((x) => x.id === k.slice(2));
      return m ? { ...base, kind: "mission", mission: m } : null;
    };
    return mergedFrom(layout, cardKey(open.card.id))
      .map(find)
      .filter((x): x is ShelfLeaf => !!x)
      .map((x) => ({
        key: x.key,
        label: leafName(x),
        onOpen: () => {
          if (x.kind === "mission") {
            setOpen(null);
            openMission(x.mission.id);
          } else setOpen({ card: x.card, list: [x.card] });
        },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layout, leafByKey, visible, missions]);

  const onTileClick = (t: ShelfTile, list: TrainingCard[]) => {
    if (drag.consumeClick()) return;
    if (holdConsume()) return;
    if (t.kind === "folder") {
      const next = openFolder === t.id ? null : t.id;
      setOpenFolder(next);
      if (next && !editing && !staff && user) logCardEvent(folderKey(t.id), "open", { daily: true });
      return;
    }
    if (editing) {
      setSheet({ kind: "item", key: t.key });
      return;
    }
    openLeaf(t, list);
  };

  // 카드도 워밍업 영상도 없으면(옛 DB · 표 없음) 회원 화면에서는 칸째 숨긴다
  if (!cardsQ.isLoading && visible.length === 0 && missions.length === 0 && !staff) return null;

  // ── 타일 하나 ──
  const tileLabel = (t: ShelfTile): { sub: string; strong: boolean } => {
    if (t.kind === "folder") return { sub: `카드 ${t.tiles.length}장`, strong: false };
    if (t.kind === "mission") return { sub: "워밍업 영상", strong: false };
    const c = t.card;
    const info = cardShelf(c);
    if (editing) {
      if (t.mergedInto) return { sub: `합침 · ${nameOf(t.mergedInto)}`, strong: false };
      return { sub: `${c.level_min ? `레벨 ${c.level_min} · ` : ""}${cardMinutes(c)}분`, strong: false };
    }
    if (staff) {
      const base = `${searching ? `${info.label} · ` : ""}${cardMinutes(c)}분${c.level_min ? ` · 레벨 ${c.level_min}` : ""}`;
      if (t.mergedInto) return { sub: `합친 카드 · ${base}`, strong: false };
      if (t.hidden) return { sub: `회원에게 숨김 · ${base}`, strong: false };
      return { sub: base, strong: false };
    }
    const tag = levelTag(c, myLevel);
    return { sub: tag?.text ?? info.label, strong: !!tag && !tag.upcoming };
  };

  const renderTile = (t: ShelfTile, container: string, idx: number, list: TrainingCard[]) => {
    const dragging = drag.view.dragId === t.key;
    const merge = drag.view.mergeTarget === t.key;
    const faded = (editing || staff) && (t.hidden || !!t.mergedInto);
    const count = editing ? brief?.items.get(t.key)?.users ?? null : null;
    const isOpenFolder = t.kind === "folder" && openFolder === t.id;
    const { sub, strong } = tileLabel(t);
    const title = t.kind === "folder" ? t.name : leafName(t);
    let thumb: ReactNode;
    if (t.kind === "folder") {
      thumb = (
        <FolderThumb
          pinned={t.pinned}
          count={count}
          items={t.tiles.map((x) => ({
            src: x.kind === "card" ? posterOf(x.card) : x.mission.poster,
            color: x.kind === "card" ? cardShelf(x.card).color : cur?.color ?? "#FF8A3D",
            label: leafName(x),
          }))}
        />
      );
    } else if (t.kind === "mission") {
      thumb = (
        <Thumb src={t.mission.poster} color={cur?.color ?? "#FF8A3D"} label="워밍업" video pinned={t.pinned} count={count} editing={editing}>
          {editing && t.hidden && <FadeTag text="회원님께 숨김" />}
        </Thumb>
      );
    } else {
      const info = cardShelf(t.card);
      thumb = (
        <Thumb
          src={posterOf(t.card)}
          color={info.color}
          label={info.label}
          video={staff || editing ? hasCardVideo(t.card) : hasMemberVideo(t.card)}
          pinned={t.pinned}
          count={count}
          editing={editing}
        >
          {editing && (t.hidden || t.mergedInto) && <FadeTag text={t.mergedInto ? "합침" : "회원님께 숨김"} />}
        </Thumb>
      );
    }
    return (
      <motion.div
        key={`${container}:${t.key}`}
        ref={canEdit ? drag.registerSlot(t.key, container) : undefined}
        layout={editing ? "position" : false}
        transition={LAYOUT_SPRING}
        className={cn("relative min-w-0", dragging && "opacity-0")}
      >
        <button
          type="button"
          onPointerDown={
            canEdit ? (ev) => drag.onPointerDown(ev, t.key, container) : holdOn && t.kind !== "folder" ? (ev) => holdStart(ev, t) : undefined
          }
          onPointerMove={holdOn ? holdMove : undefined}
          onPointerUp={holdOn ? holdEnd : undefined}
          onPointerCancel={holdOn ? holdEnd : undefined}
          onPointerLeave={holdOn ? holdEnd : undefined}
          onClick={() => onTileClick(t, list)}
          onContextMenu={canEdit || holdOn ? (ev) => ev.preventDefault() : undefined}
          aria-expanded={t.kind === "folder" ? isOpenFolder : undefined}
          aria-label={editing ? `${title} — 끌어서 옮기기, 누르면 고치기` : undefined}
          className={cn(
            "block w-full select-none overflow-hidden rounded-2xl border bg-card text-left shadow-elev-1 transition-all [-webkit-touch-callout:none]",
            !editing && "active:scale-[0.98]",
            isOpenFolder ? "border-primary ring-2 ring-primary/40" : "border-border",
            merge && "scale-[1.04] ring-2 ring-primary ring-offset-2 ring-offset-background",
            faded && "opacity-50",
          )}
        >
          <span
            className={cn("block", editing && !dragging && "animate-menu-jiggle motion-reduce:animate-none")}
            style={editing && idx % 2 === 1 ? { animationDelay: "-0.14s" } : undefined}
          >
            <span data-slot-icon className={cn("block", editing && "touch-none")}>
              {thumb}
            </span>
            <span className="block p-3">
              <span className="line-clamp-2 block text-body font-bold leading-snug text-foreground">{title}</span>
              <span className={cn("mt-0.5 block truncate text-label", strong ? "font-bold text-primary" : "text-muted-foreground")}>{sub}</span>
            </span>
          </span>
        </button>
        {flow.available && !editing && t.kind !== "folder" && (
          <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
            <button
              type="button"
              data-no-drag
              onClick={(ev) => {
                ev.stopPropagation();
                void flow.save(t);
              }}
              aria-label={flow.savedKeys.has(t.key) ? `${title} — 내 수업에 담겨 있어요 · 다른 수업에도 담기` : `${title} 내 수업에 담기`}
              className={cn(
                "pointer-events-auto absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-elev-1 transition-transform active:scale-90",
                flow.savedKeys.has(t.key) ? "bg-primary text-primary-foreground" : "bg-white/95 text-foreground",
              )}
            >
              {flow.savedKeys.has(t.key) ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Plus className="h-4 w-4" strokeWidth={3} aria-hidden />}
            </button>
          </div>
        )}
        {editing && !dragging && (
          <button
            type="button"
            data-no-drag
            onClick={() => hide(t.key, !t.hidden)}
            aria-label={t.hidden ? `${title} 다시 보이기` : `${title} 회원님께 숨기기`}
            className={cn(
              "absolute -left-1.5 -top-1.5 z-[1] flex h-7 w-7 items-center justify-center rounded-full shadow-elev-1 transition-transform active:scale-90",
              t.hidden ? "bg-primary text-primary-foreground" : "bg-foreground/85 text-background",
            )}
          >
            {t.hidden ? <Plus className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Minus className="h-4 w-4" strokeWidth={3} aria-hidden />}
          </button>
        )}
      </motion.div>
    );
  };

  // ── 펼친 묶음 (그 줄 바로 아래) ──
  const folderPanel = (f: ShelfFolderTile) => {
    const container = `${FOLDER_PREFIX}${f.id}`;
    const inner = arrange(f.tiles, drag.view.container === container ? drag.view.order : null);
    const list = cardsIn(f.tiles);
    return (
      <motion.div
        key={`panel-${f.id}`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="col-span-2 rounded-2xl bg-secondary/70 ring-1 ring-border/60"
      >
        <div ref={editing ? drag.setPanel : undefined} className="p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="min-w-0 truncate text-label font-bold text-muted-foreground">
              {f.name} · {f.tiles.length}장
            </p>
            {editing ? (
              <button type="button" onClick={() => setSheet({ kind: "item", key: f.key })} className="shrink-0 text-label font-bold text-primary">
                이름 · 정리
              </button>
            ) : (
              <button type="button" onClick={() => setOpenFolder(null)} aria-label="묶음 닫기" className="shrink-0 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">{inner.map((x, i) => renderTile(x, container, i, list))}</div>
          {editing && <p className="mt-2 px-1 text-label text-muted-foreground">이 상자 밖으로 끌어 놓으면 묶음에서 빠져요</p>}
        </div>
      </motion.div>
    );
  };

  /** 타일들을 2열로 — 펼친 묶음은 그 줄 바로 아래 */
  const grid = (list: readonly ShelfTile[], container: string, cardList: TrainingCard[]) => {
    const rows: ShelfTile[][] = [];
    for (let i = 0; i < list.length; i += COLS) rows.push(list.slice(i, i + COLS) as ShelfTile[]);
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((row, r) => (
          <Fragment key={`row-${r}`}>
            {row.map((t, i) => renderTile(t, container, r * COLS + i, cardList))}
            {openFolderTile && row.some((t) => t.key === openFolderTile.key) && folderPanel(openFolderTile)}
          </Fragment>
        ))}
      </div>
    );
  };

  // ── 보이는 목록 ──
  const rootTiles = arrange(tiles, drag.view.container === DRAG_ROOT ? drag.view.order : null);
  const cut = expanded || searching || editing ? Infinity : FIRST_COUNT;
  const shownTiles = rootTiles.slice(0, cut);
  const more = rootTiles.length - shownTiles.length;
  const upper = cur?.upper ?? [];
  const mainCards = cardsIn([...tiles, ...(upperOpen ? upper : [])]);
  const dragTile = drag.view.dragId
    ? tiles.find((t) => t.key === drag.view.dragId) ?? (openFolderTile?.tiles.find((t) => t.key === drag.view.dragId) as ShelfTile | undefined) ?? null
    : null;

  return (
    <section ref={sectionRef} aria-label={staff ? "153 콘텐츠 카드" : "영상으로 배우기"} className="scroll-mt-20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">{staff ? "153 콘텐츠 카드" : editing ? "영상으로 배우기 · 정리" : "영상으로 배우기"}</h2>
        {staff && visible.length > 0 && <span className="text-label font-bold text-muted-foreground">{visible.length}장</span>}
        {canEdit && !editing && (
          <button
            type="button"
            onClick={editor.start}
            className="flex h-9 shrink-0 items-center rounded-full border border-border bg-card px-3.5 text-label font-bold text-foreground active:scale-95"
          >
            편집
          </button>
        )}
        {editing && (
          <button
            type="button"
            onClick={() => {
              setOpenFolder(null);
              void editor.finish();
            }}
            className="flex h-9 shrink-0 items-center rounded-full bg-foreground px-4 text-label font-bold text-background active:scale-95"
          >
            완료
          </button>
        )}
      </div>

      {editing && (
        <ShelfEditBar
          status={editor.status}
          demo={!!st?.demo}
          canUndo={editor.canUndo}
          onUndo={editor.undo}
          onRetry={() => void editor.retry()}
          onOpen={(kind) => setSheet({ kind } as EditSheet)}
          hiddenCount={hiddenCount}
          overlapCount={overlaps.length}
          foldUpper={layout.foldUpper !== false}
          onToggleFold={() => {
            const on = layout.foldUpper !== false;
            editor.apply(setFoldUpper(layout, !on), on ? "위 리그 펼치기" : "위 리그 접기");
          }}
          brief={brief}
        />
      )}

      {/* 붕대 감기 — 수업 전 준비는 칩이 아니라 맨 위 한 줄 */}
      {!staff && !editing && (
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
      {!searching && arranged.length > 0 && (
        <div
          data-tour={staff ? undefined : "missions-tab-control"}
          role="tablist"
          aria-label="칸 고르기"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {mineChip && (
            <button
              type="button"
              role="tab"
              aria-selected={showMine}
              onClick={openMine}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-label font-bold transition-all active:scale-95",
                showMine ? "border-transparent bg-foreground text-background" : "border-foreground/30 bg-card text-foreground",
              )}
            >
              내 수업
              {flow.classes.some((c) => c.newNotes > 0) && <span aria-label="새 한마디" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
            </button>
          )}
          {arranged.map((s) => {
            const on = !showMine && s.id === current;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setShelf(s.id, true)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-label font-bold transition-all active:scale-95",
                  on ? "border-transparent text-white" : "border-border bg-card text-foreground",
                )}
                style={on ? { backgroundColor: s.color } : undefined}
              >
                {s.label}
                {editing && <span className={cn("ml-1", on ? "text-white/80" : "text-muted-foreground")}>{s.tiles.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {cardsQ.isLoading || layoutQ.isLoading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : showMine && !searching ? (
        <MyClassPanel
          flow={flow}
          posterOf={posterOf}
          onStart={(id) => {
            const c = flow.classes.find((x) => x.id === id);
            if (!c) return;
            primeAudio();
            flow.openPlayer({ id: c.id, name: c.name, items: c.items, mine: true });
          }}
        />
      ) : searching ? (
        searchList.length === 0 ? (
          <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">찾는 카드가 없어요</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {searchList.map((c, i) => {
              const k = cardKey(c.id);
              const leaf: ShelfLeaf = leafByKey.get(k) ?? { kind: "card", key: k, card: c, hidden: hiddenSet.has(k), pinned: false, mergedInto: null };
              return renderTile(leaf, "search", i, searchList);
            })}
          </div>
        )
      ) : rootTiles.length === 0 && upper.length === 0 ? (
        <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">
          {editing ? "이 칸은 비어 있어요 — 카드를 눌러 「칸 옮기기」로 넣어요" : "아직 카드가 없어요"}
        </p>
      ) : (
        grid(shownTiles, DRAG_ROOT, mainCards)
      )}

      {!searching && !showMine && more > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-12 w-full items-center justify-center gap-1 rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.99]"
        >
          {cur?.label} 더 보기 · {more}장 <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* 위 리그 — 칸마다 한 줄로 접힘 (결정 3번) */}
      {!searching && !editing && !showMine && upper.length > 0 && (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setUpperOpen((v) => !v)}
            aria-expanded={upperOpen}
            className="flex h-12 w-full items-center justify-between rounded-2xl border border-dashed border-border px-4 text-left active:scale-[0.99]"
          >
            <span className="text-body font-bold text-muted-foreground">다음 리그에서 배울 동작 {upper.length}개</span>
            {upperOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </button>
          {upperOpen && grid(upper, "upper", mainCards)}
        </div>
      )}

      <TrainingDrillSheet
        exercise={open?.card ?? null}
        list={open?.list}
        listIsShelf
        related={related}
        onChange={(c) => setOpen((o) => (o ? { ...o, card: c } : { card: c, list: [c] }))}
        onClose={() => setOpen(null)}
        footer={sheetFooter ? (c) => sheetFooter(c, () => setOpen(null)) : undefined}
        onSaveToClass={
          flow.available
            ? (c) => void flow.save(leafByKey.get(cardKey(c.id)) ?? { kind: "card", key: cardKey(c.id), card: c, hidden: false, pinned: false, mergedInto: null })
            : undefined
        }
        savedToClass={(c) => flow.savedKeys.has(cardKey(c.id))}
      />

      <MyClassLayer flow={flow} posterOf={posterOf} sections={arranged} onToPlan={toPlan} />

      {canEdit && (
        <ShelfEditSheets
          sheet={editing ? sheet : null}
          onClose={() => setSheet(null)}
          layout={layout}
          arranged={editing ? arranged : []}
          overlaps={overlaps}
          brief={brief}
          apply={editor.apply}
          restore={editor.restore}
          version={st?.version ?? 0}
          onOpenCard={openKey}
        />
      )}

      {dragTile &&
        drag.view.size &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={drag.ghostRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[200] will-change-transform"
            style={{ width: drag.view.size.w }}
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-3">
              {dragTile.kind === "folder" ? (
                <FolderThumb
                  items={dragTile.tiles.map((x) => ({
                    src: x.kind === "card" ? posterOf(x.card) : x.mission.poster,
                    color: x.kind === "card" ? cardShelf(x.card).color : "#FF8A3D",
                    label: leafName(x),
                  }))}
                />
              ) : dragTile.kind === "mission" ? (
                <Thumb src={dragTile.mission.poster} color={cur?.color ?? "#FF8A3D"} label="워밍업" video />
              ) : (
                <Thumb src={posterOf(dragTile.card)} color={cardShelf(dragTile.card).color} label={cardShelf(dragTile.card).label} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
};

export default TrainingShelf;
