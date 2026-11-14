/**
 * 🎬 내 수업 흐름 — 「영상으로 배우기」(TrainingShelf)가 쓰는 상태 한 곳 (2026-11-14 2단계)
 *
 *   · 담기(save) — 수업이 없으면 바로 「내 수업 1」을 만들어 담고, 있으면 「어느 수업에 담을까요?」 창
 *   · 창 — 고르기(chooser) · 편집(editor) · 카드 더 담기(picker) · 재생(player) · 코치님 보기(shared)
 *   · 항목 풀이(resolve) — c:<카드> → 카드 · m:<미션> → 레벨 미션 영상(제목 · 첫 장면 · 영상 주소)
 *   · 서버에 함수가 없으면 available=false → 화면은 담기 단추 · 내 수업 칩을 그리지 않는다
 */
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { cardMinutes, cardShelf, hasCardVideo, hasMemberVideo, type TrainingCard } from "@/lib/trainingCards";
import type { ShelfLeaf, ShelfMission, TileKey } from "@/lib/shelfLayout";
import {
  MAX_CLASSES,
  MISSION_MINUTES,
  defaultClassName,
  missionTitle,
  savedKeySet,
  type ClassItem,
  type MyClass,
  type SharedClass,
} from "@/lib/myClass";
import { useClassMissions, useMyClassActions, useMyClasses, useSharedClasses, type ClassMission } from "@/services/myClassService";
import { playBell, resumeAudio } from "@/features/myboxer-visualization/mindAudio";

/** 「시작」을 누른 순간에 부른다 — 아이폰 · 사파리는 손가락으로 누를 때만 소리(벨)를 연다.
 *  기기 소리 설정은 그대로(회원님이 듣던 음악을 멈추지 않게 '재생' 모드로 바꾸지 않는다) */
export function primeAudio(): void {
  playBell(0);
  resumeAudio();
}

/** 재생 화면에 넘기는 수업 — 편집 중인 항목 그대로 (mine = 본인 수업이면 끝날 때 기록) */
export interface PlayingClass {
  id: string;
  name: string;
  items: ClassItem[];
  mine: boolean;
}

export type ResolvedItem =
  | { kind: "card"; key: TileKey; name: string; color: string; label: string; card: TrainingCard; hasVideo: boolean }
  | { kind: "mission"; key: TileKey; name: string; color: string; label: string; mission: ClassMission; hasVideo: boolean };

export type PosterOf = (card: TrainingCard) => string | null;

/** 항목 첫 장면 — 카드는 서명 주소(없으면 그림) · 레벨 미션은 영상 첫 장면 */
export const itemPoster = (r: ResolvedItem | null, posterOf: PosterOf): string | null =>
  !r ? null : r.kind === "card" ? posterOf(r.card) : r.mission.poster;

/** 레벨 미션(워밍업 영상) 타일 색 — 워밍업 칸 색과 같게 */
export const MISSION_COLOR = "#FF8A3D";

interface FlowArgs {
  audience: "member" | "staff";
  userId: string | null;
  /** 켜진 카드 전부 — 담긴 카드 찾기 */
  cards: readonly TrainingCard[];
  /** 워밍업 칸의 레벨 미션 영상(회원 화면) */
  missions: readonly ShelfMission[];
  /** 코치진 — 회원님이 보여 준 수업을 볼 지점 */
  branch?: string | null;
  /** 대표님 편집 중이면 끈다 */
  paused?: boolean;
}

export function useMyClassFlow({ audience, userId, cards, missions, branch, paused }: FlowArgs) {
  const staffView = audience === "staff";
  const q = useMyClasses(userId, !paused, staffView);
  const state = q.data;
  const available = !!state?.available;
  const classes = useMemo(() => state?.classes ?? [], [state?.classes]);
  const sharedQ = useSharedClasses(branch, staffView && available && !paused);
  const shared = useMemo(() => (staffView ? sharedQ.data?.classes ?? [] : []), [staffView, sharedQ.data?.classes]);
  const actions = useMyClassActions();

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const missionIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of [...classes, ...shared]) for (const x of c.items) if (x.k.startsWith("m:")) s.add(x.k.slice(2));
    return [...s];
  }, [classes, shared]);
  const missionsQ = useClassMissions(missionIds, available);

  const resolve = useCallback(
    (k: TileKey): ResolvedItem | null => {
      const id = k.slice(2);
      if (k.startsWith("c:")) {
        const card = cardById.get(id);
        if (!card) return null;
        const info = cardShelf(card);
        return {
          kind: "card",
          key: k,
          name: card.name,
          color: info.color,
          label: info.label,
          card,
          hasVideo: staffView ? hasCardVideo(card) : hasMemberVideo(card),
        };
      }
      const fetched = missionsQ.data?.get(id) ?? null;
      const local = missions.find((m) => m.id === id) ?? null;
      if (!fetched && !local) return null;
      const mission: ClassMission = {
        id,
        title: missionTitle(fetched?.title ?? local?.title ?? "워밍업 영상"),
        poster: fetched?.poster ?? local?.poster ?? null,
        video: fetched?.video ?? null,
      };
      return { kind: "mission", key: k, name: mission.title, color: MISSION_COLOR, label: "워밍업 영상", mission, hasVideo: !!mission.video };
    },
    [cardById, missionsQ.data, missions, staffView],
  );

  const savedKeys = useMemo(() => savedKeySet(classes), [classes]);

  // ── 창 ──
  const [chooser, setChooser] = useState<{ key: TileKey; name: string; minutes: number } | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PlayingClass | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const minutesOf = (leaf: ShelfLeaf) => (leaf.kind === "card" ? cardMinutes(leaf.card) : MISSION_MINUTES);
  const nameOf = (leaf: ShelfLeaf) => (leaf.kind === "card" ? leaf.card.name : missionTitle(leaf.mission.title));

  /** 담기 — 처음이면 바로 만들고, 수업이 있으면 고르기 창 */
  const save = useCallback(
    async (leaf: ShelfLeaf) => {
      if (!available || busy) return;
      if (classes.length === 0) {
        setBusy(true);
        try {
          const name = defaultClassName(classes);
          const r = await actions.add(null, leaf.key, minutesOf(leaf), name);
          toast.success(`‘${r.name}’에 담았어요`, {
            description: "칸 맨 앞 「내 수업」에서 이름 · 순서를 고치고 시작해요",
            action: { label: "열기", onClick: () => setEditorId(r.id) },
          });
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
        return;
      }
      setChooser({ key: leaf.key, name: nameOf(leaf), minutes: minutesOf(leaf) });
    },
    [available, busy, classes, actions],
  );

  /** 고르기 창에서 — classId null = 새 수업 */
  const pick = useCallback(
    async (classId: string | null) => {
      if (!chooser) return;
      setBusy(true);
      try {
        const r = await actions.add(classId, chooser.key, chooser.minutes, classId ? undefined : defaultClassName(classes));
        if (r.added) toast.success(`‘${r.name}’에 담았어요`);
        else toast(`‘${r.name}’에 이미 있어요`);
        setChooser(null);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [chooser, actions, classes],
  );

  /** 새 수업 — 빈 수업을 만들고 편집 창 → 카드 고르기 */
  const createEmpty = useCallback(async () => {
    if (!available || busy) return;
    if (classes.length >= MAX_CLASSES) {
      toast.error(`내 수업은 ${MAX_CLASSES}개까지 만들 수 있어요`);
      return;
    }
    setBusy(true);
    try {
      const r = await actions.save({ id: null, name: defaultClassName(classes), items: [], shared: false });
      setEditorId(r.id);
      setPickerId(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [available, busy, classes, actions]);

  const byId = (id: string | null): MyClass | null => (id ? classes.find((c) => c.id === id) ?? null : null);
  const sharedById = (id: string | null): SharedClass | null => (id ? shared.find((c) => c.id === id) ?? null : null);

  return {
    staffView,
    available,
    /** 서버가 본 코치진(대표님 포함) */
    staff: !!state?.staff || staffView,
    demo: !!state?.demo,
    ready: !q.isLoading && (!staffView || !sharedQ.isLoading),
    classes,
    shared,
    sharedAvailable: !!sharedQ.data?.available,
    savedKeys,
    resolve,
    actions,
    busy,
    save,
    pick,
    createEmpty,
    chooser,
    closeChooser: () => setChooser(null),
    editor: byId(editorId),
    /** 새 수업을 만든 바로 뒤 — 편집 창이 카드 고르기부터 연다 */
    editorStartsWithPicker: !!editorId && pickerId === editorId,
    openEditor: (id: string) => {
      setPickerId(null);
      setEditorId(id);
    },
    closeEditor: () => {
      setEditorId(null);
      setPickerId(null);
    },
    playing,
    openPlayer: (p: PlayingClass) => setPlaying(p),
    closePlayer: () => setPlaying(null),
    sharedOpen: sharedById(sharedId),
    openShared: (id: string) => setSharedId(id),
    closeShared: () => setSharedId(null),
  };
}

export type MyClassFlow = ReturnType<typeof useMyClassFlow>;
