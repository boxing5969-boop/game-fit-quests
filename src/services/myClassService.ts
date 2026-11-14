/**
 * 🎬 내 수업 · 코치 한마디 — 서버 함수 부르기 (2026-11-14 영상으로 배우기 2단계)
 *
 *   · useMyClasses — 내 수업 목록(본인만 · 재생 기록 · 새 한마디 수). 열쇠 ["my-class", "mine", 회원]
 *   · useMyClassActions — 담기 · 저장 · 지우기 · 다 했어요 · 한마디 읽음 → 목록 다시 읽기
 *   · useSharedClasses — 코치진: 회원님이 보여 준 수업(그 지점) · 한마디 남기기 · 지우기
 *   · useClassMissions — 담긴 레벨 미션 영상의 제목 · 영상 주소(재생 화면 · 코치님 보기)
 *   · 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) available:false — 화면은 담기 단추를 숨긴다
 *   · 예시 모드(?demo=1): 서버를 부르지 않고 이 창(sessionStorage)에만 — 미리보기 주소에서도 눌러 볼 수 있다
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_CLASSES,
  MAX_ITEMS,
  clampN,
  cleanName,
  normalizeItems,
  parseItems,
  parseMyClass,
  parseSharedClass,
  type ClassItem,
  type MyClass,
  type SharedClass,
} from "@/lib/myClass";
import { MISSION_VIDEO_EMBED, primaryMissionVideo, type MissionVideoRow } from "@/lib/missionVideos";
import { isTrainingDemo } from "@/services/trainingCardService";
import { SAMPLE_TRAINING_CARDS } from "@/lib/trainingCardsSample";

export const MY_CLASS_KEY = ["my-class"] as const;

export interface MyClassState {
  /** 서버에 내 수업 함수가 있나 (예시 모드면 true) */
  available: boolean;
  demo: boolean;
  /** 코치진(대표님 포함) — 보여드리기 없음 */
  staff: boolean;
  classes: MyClass[];
}

export interface SharedClassState {
  available: boolean;
  branch: string | null;
  classes: SharedClass[];
}

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);

/* ───────── 예시 모드 (이 창에만) ───────── */

const DEMO_MINE = "153myclass:demo:mine";
const DEMO_NOTES = "153myclass:demo:notes";

interface DemoRow {
  id: string;
  name: string;
  items: ClassItem[];
  shared: boolean;
  shared_at: string | null;
  updated_at: string;
  created_at: string;
  plays: number;
  minutes_total: number;
  last_played_at: string | null;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;

function readDemo(): DemoRow[] {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(DEMO_MINE) ?? "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
function writeDemo(rows: DemoRow[]) {
  try {
    window.sessionStorage.setItem(DEMO_MINE, JSON.stringify(rows));
  } catch {
    /* 무시 */
  }
}
type DemoNote = { id: string; class_id: string; body: string; at: string };
function readDemoNotes(): DemoNote[] {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(DEMO_NOTES) ?? "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
function writeDemoNotes(rows: DemoNote[]) {
  try {
    window.sessionStorage.setItem(DEMO_NOTES, JSON.stringify(rows));
  } catch {
    /* 무시 */
  }
}

const SAMPLE_IDS = SAMPLE_TRAINING_CARDS.map((c) => c.id);
const DEMO_NOW = () => new Date().toISOString();
/** 코치님 화면 예시 — 지어낸 회원 두 명이 보여 준 수업 */
function demoShared(): SharedClass[] {
  const pick = (i: number) => `c:${SAMPLE_IDS[i % Math.max(1, SAMPLE_IDS.length)]}`;
  const notes = readDemoNotes();
  const base = [
    { id: "d0000000-0000-4000-8000-0000000000a1", name: "퇴근 20분 기본기", owner: "예시 회원 A", items: [pick(0), pick(1), pick(4)] },
    { id: "d0000000-0000-4000-8000-0000000000a2", name: "샌드백 3라운드", owner: "예시 회원 B", items: [pick(2), pick(5)] },
  ];
  return base.map((b, i) => ({
    id: b.id,
    name: b.name,
    items: parseItems(b.items.map((k, j) => ({ k, u: i === 1 && j === 1 ? "r" : "m", n: i === 1 && j === 1 ? 3 : 5, note: j === 0 ? "천천히 정확하게" : "" }))),
    sharedAt: DEMO_NOW(),
    updatedAt: DEMO_NOW(),
    notes: notes
      .filter((n) => n.class_id === b.id)
      .map((n) => ({ id: n.id, body: n.body, at: n.at, by: { name: "예시 코치", title: "코치", avatarUrl: null }, mine: true })),
    owner: { userId: `demo-${i}`, name: b.owner, avatarUrl: null },
  }));
}

function demoState(staff: boolean): MyClassState {
  const notes = readDemoNotes();
  return {
    available: true,
    demo: true,
    staff,
    classes: readDemo()
      .map((r) =>
        parseMyClass({
          ...r,
          notes: notes
            .filter((n) => n.class_id === r.id)
            .map((n) => ({ id: n.id, body: n.body, at: n.at, by: { name: "예시 코치", title: "코치" }, mine: false })),
          new_notes: 0,
        }),
      )
      .filter((c): c is MyClass => !!c),
  };
}

/* ───────── 내 수업 ───────── */

export const myClassKey = (userId: string | null | undefined) => [...MY_CLASS_KEY, "mine", userId ?? "-", isTrainingDemo() ? "demo" : "db"] as const;

/** 내 수업 목록 — staffHint: 예시 모드에서 코치진 화면인지(서버가 없으니 화면이 알려 준다) */
export function useMyClasses(userId: string | null | undefined, enabled = true, staffHint = false) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: myClassKey(userId),
    enabled: enabled && (!!userId || demo),
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<MyClassState> => {
      if (demo) return demoState(staffHint);
      const { data, error } = await rpc("my_classes");
      if (error) {
        if (missingFn(error)) return { available: false, demo: false, staff: false, classes: [] };
        throw new Error(error.message ?? "내 수업을 불러오지 못했어요");
      }
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        available: true,
        demo: false,
        staff: r.staff === true,
        classes: (Array.isArray(r.classes) ? r.classes : []).map(parseMyClass).filter((c): c is MyClass => !!c),
      };
    },
  });
}

export interface AddResult {
  id: string;
  name: string;
  count: number;
  added: boolean;
  created: boolean;
}

async function addToClass(classId: string | null, key: string, minutes: number, name?: string): Promise<AddResult> {
  if (isTrainingDemo()) {
    const rows = readDemo();
    const now = DEMO_NOW();
    if (!classId) {
      if (rows.length >= MAX_CLASSES) throw new Error("내 수업은 20개까지 만들 수 있어요");
      const row: DemoRow = {
        id: newId(),
        name: cleanName(name) || "내 수업",
        items: [{ k: key, u: "m", n: clampN("m", minutes), note: "" }],
        shared: false,
        shared_at: null,
        updated_at: now,
        created_at: now,
        plays: 0,
        minutes_total: 0,
        last_played_at: null,
      };
      writeDemo([row, ...rows]);
      return { id: row.id, name: row.name, count: 1, added: true, created: true };
    }
    const row = rows.find((r) => r.id === classId);
    if (!row) throw new Error("그 수업을 찾지 못했어요");
    if (row.items.some((x) => x.k === key)) return { id: row.id, name: row.name, count: row.items.length, added: false, created: false };
    if (row.items.length >= MAX_ITEMS) throw new Error("한 수업에 12장까지 담을 수 있어요");
    row.items = [...row.items, { k: key, u: "m", n: clampN("m", minutes), note: "" }];
    row.updated_at = now;
    writeDemo(rows);
    return { id: row.id, name: row.name, count: row.items.length, added: true, created: false };
  }
  const { data, error } = await rpc("my_class_add", { p_id: classId, p_item: key, p_min: Math.round(minutes), p_name: name ?? null });
  if (error) throw new Error(error.message ?? "담지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    count: Number(r.count) || 0,
    added: r.added === true,
    created: r.created === true,
  };
}

export interface SaveInput {
  id: string | null;
  name: string;
  items: ClassItem[];
  /** null = 그대로 */
  shared: boolean | null;
}
export interface SaveResult {
  id: string;
  created: boolean;
  shared: boolean;
  notified: number;
}

async function saveClass(input: SaveInput): Promise<SaveResult> {
  const items = normalizeItems(input.items);
  if (isTrainingDemo()) {
    const rows = readDemo();
    const now = DEMO_NOW();
    if (!input.id) {
      if (rows.length >= MAX_CLASSES) throw new Error("내 수업은 20개까지 만들 수 있어요");
      const row: DemoRow = {
        id: newId(),
        name: cleanName(input.name) || "내 수업",
        items,
        shared: !!input.shared,
        shared_at: input.shared ? now : null,
        updated_at: now,
        created_at: now,
        plays: 0,
        minutes_total: 0,
        last_played_at: null,
      };
      writeDemo([row, ...rows]);
      return { id: row.id, created: true, shared: row.shared, notified: 0 };
    }
    const row = rows.find((r) => r.id === input.id);
    if (!row) throw new Error("그 수업을 찾지 못했어요");
    const wasShared = row.shared;
    row.name = cleanName(input.name) || row.name;
    row.items = items;
    if (input.shared !== null) {
      row.shared = input.shared;
      row.shared_at = input.shared ? row.shared_at ?? now : null;
    }
    row.updated_at = now;
    writeDemo(rows);
    return { id: row.id, created: false, shared: row.shared, notified: row.shared && !wasShared ? 2 : 0 };
  }
  const { data, error } = await rpc("my_class_save", { p_id: input.id, p_name: cleanName(input.name), p_items: items, p_shared: input.shared });
  if (error) throw new Error(error.message ?? "저장하지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  return { id: String(r.id ?? input.id ?? ""), created: r.created === true, shared: r.shared === true, notified: Number(r.notified) || 0 };
}

async function removeClass(id: string): Promise<boolean> {
  if (isTrainingDemo()) {
    writeDemo(readDemo().filter((r) => r.id !== id));
    return true;
  }
  const { data, error } = await rpc("my_class_remove", { p_id: id });
  if (error) throw new Error(error.message ?? "지우지 못했어요");
  return data === true;
}

export interface PlayedResult {
  plays: number;
  minutesTotal: number;
  counted: boolean;
}

async function markPlayed(id: string, minutes: number): Promise<PlayedResult> {
  const m = Math.max(1, Math.min(360, Math.round(minutes)));
  if (isTrainingDemo()) {
    const rows = readDemo();
    const row = rows.find((r) => r.id === id);
    if (!row) return { plays: 0, minutesTotal: 0, counted: false };
    row.plays += 1;
    row.minutes_total += m;
    row.last_played_at = DEMO_NOW();
    writeDemo(rows);
    return { plays: row.plays, minutesTotal: row.minutes_total, counted: true };
  }
  const { data, error } = await rpc("my_class_played", { p_id: id, p_minutes: m });
  if (error) throw new Error(error.message ?? "기록하지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  return { plays: Number(r.plays) || 0, minutesTotal: Number(r.minutes_total) || 0, counted: r.counted === true };
}

async function seenNotes(id: string): Promise<void> {
  if (isTrainingDemo()) return;
  await rpc("my_class_notes_seen", { p_id: id });
}

/** 담기 · 저장 · 지우기 · 다 했어요 · 한마디 읽음 — 끝나면 내 수업(과 코치님 목록)을 다시 읽는다 */
export function useMyClassActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: MY_CLASS_KEY });
  return {
    add: async (classId: string | null, key: string, minutes: number, name?: string) => {
      const r = await addToClass(classId, key, minutes, name);
      await refresh();
      return r;
    },
    save: async (input: SaveInput) => {
      const r = await saveClass(input);
      await refresh();
      return r;
    },
    remove: async (id: string) => {
      const r = await removeClass(id);
      await refresh();
      return r;
    },
    played: async (id: string, minutes: number) => {
      const r = await markPlayed(id, minutes);
      void refresh();
      return r;
    },
    seen: async (id: string) => {
      await seenNotes(id).catch(() => undefined);
      void refresh();
    },
  };
}

/* ───────── 코치님 — 회원님이 보여 준 수업 ───────── */

export function useSharedClasses(branch: string | null | undefined, enabled: boolean) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...MY_CLASS_KEY, "shared", branch ?? "-", demo ? "demo" : "db"],
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<SharedClassState> => {
      if (demo) return { available: true, branch: branch ?? null, classes: demoShared() };
      const { data, error } = await rpc("class_shared_list", { p_branch: branch ?? null });
      if (error) {
        // 함수가 없거나(적용 전) 코치진이 아니면 조용히 — 화면은 칸을 안 그린다
        return { available: false, branch: null, classes: [] };
      }
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        available: true,
        branch: typeof r.branch === "string" ? r.branch : null,
        classes: (Array.isArray(r.classes) ? r.classes : []).map(parseSharedClass).filter((c): c is SharedClass => !!c),
      };
    },
  });
}

export function useClassNoteActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: MY_CLASS_KEY });
  return {
    add: async (classId: string, body: string) => {
      const text = body.trim();
      if (isTrainingDemo()) {
        writeDemoNotes([...readDemoNotes(), { id: newId(), class_id: classId, body: text, at: DEMO_NOW() }]);
      } else {
        const { error } = await rpc("class_note_add", { p_class: classId, p_body: text });
        if (error) throw new Error(error.message ?? "한마디를 남기지 못했어요");
      }
      await refresh();
    },
    remove: async (noteId: string) => {
      if (isTrainingDemo()) {
        writeDemoNotes(readDemoNotes().filter((n) => n.id !== noteId));
      } else {
        const { error } = await rpc("class_note_remove", { p_note: noteId });
        if (error) throw new Error(error.message ?? "지우지 못했어요");
      }
      await refresh();
    },
  };
}

/* ───────── 담긴 레벨 미션 영상 ───────── */

export interface ClassMission {
  id: string;
  title: string;
  poster: string | null;
  video: string | null;
}

/** 담긴 레벨 미션(m:) — 제목 · 첫 장면 · 대표 영상 주소. ids 가 비면 부르지 않는다 */
export function useClassMissions(ids: readonly string[], enabled = true) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: [...MY_CLASS_KEY, "missions", sorted.join(",")],
    enabled: enabled && sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, ClassMission>> => {
      const db = supabase as unknown as {
        from: (t: string) => { select: (c: string) => { in: (col: string, v: string[]) => Promise<{ data: unknown; error: RpcError }> } };
      };
      const { data, error } = await db.from("missions").select(`id, title, ${MISSION_VIDEO_EMBED}`).in("id", sorted);
      if (error) return new Map();
      const out = new Map<string, ClassMission>();
      for (const m of (data ?? []) as { id: string; title: string; mission_videos?: MissionVideoRow[] | null }[]) {
        const v = primaryMissionVideo(m.mission_videos);
        out.set(m.id, { id: m.id, title: m.title, poster: v?.poster_url ?? null, video: v?.video_url ?? null });
      }
      return out;
    },
  });
}
