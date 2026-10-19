/**
 * 153마인드셋 기록 — DB 함수 (supabase/migrations/20261019010000_mindset_sessions.sql · 20261019160000_mindset_review_fixes.sql)
 *   계정에 남겨서 연속 일수 · 이번 주 · 선명도 변화를 본다.
 *   예전 키(myboxer.visualization.records)에도 계속 적는다 — 홈 '오늘의 포커스' 카드가 오늘 했는지 이 키로 본다.
 *
 * 2026-10-19 검수 반영
 *   · 인터넷이 끊겨 기기에만 남은 기록은 '못 올림'으로 표시해 두고 다음에 앱을 열 때 계정에 올린다
 *     (기록마다 번호(cid)를 붙여 서버가 같은 기록을 두 번 넣지 않는다 — log_mindset_session_v2)
 *   · 기기 기록 · 목표 · 한마디는 계정별 — 가족이 폰 하나를 같이 써도 남의 기록이 내 계정에 올라가지 않게.
 *     주인을 알 수 없는 개편 전 기기 기록은 계정에 올리지 않는다
 *   · 서버가 거절한 이유(예: 하루 30번)는 그대로 보여 준다 — 인터넷 탓으로 돌리지 않는다
 *   · 목표 · 한마디는 계정 값이 기준. 기기에서 못 올린 수정만 다음에 올린다
 *   · 잠깐 해 보고 나온 기록(대본 60% 미만이면서 3분 미만)은 이번 주 · 연속에 세지 않는다 (서버와 같은 기준)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const LOCAL_KEY = "myboxer.visualization.records";
const GOAL_KEY = "myboxer.mindset.goal";
const CUE_KEY = "myboxer.mindset.cue";
/** 기기에서 바꿨는데 계정에 못 올렸으면 '1' */
const PROFILE_DIRTY_KEY = "myboxer.mindset.profile.dirty";
/** 계정마다 따로 — myboxer.mindset.goal:<uid> */
const userKey = (k: string, uid: string) => `${k}:${uid}`;

export interface MindsetRecent {
  session_id: string;
  created_at: string;
  duration_sec: number;
  /** 대본 60% 이상 갔는지 */
  completed?: boolean;
  vividness: number | null;
  control: number | null;
  mood_before: number | null;
  mood_after: number | null;
  note: string | null;
}

export interface MindsetStats {
  streak: number;
  done_today: boolean;
  week_count: number;
  total_sessions: number;
  total_minutes: number;
  rated: number;
  vivid_recent: number;
  vivid_first: number;
  by_session: Record<string, number>;
  recent: MindsetRecent[];
  goal: string | null;
  /** 나의 한마디 (큐 워드) */
  cue: string | null;
  /** 계정에서 못 가져와서 이 기기 기록으로 계산했다 */
  local?: boolean;
}

export interface MindsetLogInput {
  sessionId: string;
  durationSec: number;
  completed: boolean;
  moodBefore?: number | null;
  moodAfter?: number | null;
  vividness?: number | null;
  control?: number | null;
  note?: string | null;
  closing?: string;
}

interface LocalRecord {
  sessionId: string;
  completedAt: string;
  durationSec?: number;
  completed?: boolean;
  vividness?: number | null;
  control?: number | null;
  moodBefore?: number | null;
  moodAfter?: number | null;
  reflection?: string;
  declaration?: string;
  promises?: string[];
  /** 기기에서 만든 기록 번호 — 계정에 두 번 올라가지 않게 */
  cid?: string;
  /** 아직 계정에 못 올린 기록 */
  pending?: boolean;
  /** 기록한 계정 — 이 계정 것만 올리고 센다 */
  uid?: string;
}

const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const newCid = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* 아래로 */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

function readLocal(): LocalRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as LocalRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: LocalRecord[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* 저장이 안 되는 기기 */
  }
}

function appendLocal(r: LocalRecord) {
  const list = readLocal();
  list.unshift(r);
  writeLocal(list);
}

function patchLocal(cid: string, patch: Partial<LocalRecord> | null) {
  const list = readLocal();
  const i = list.findIndex((r) => r.cid === cid);
  if (i < 0) return;
  if (patch) list[i] = { ...list[i], ...patch };
  else list.splice(i, 1);
  writeLocal(list);
}

const readKey = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k) || null;
  } catch {
    return null;
  }
};
const writeKey = (k: string, v: string | null) => {
  try {
    if (v) window.localStorage.setItem(k, v);
    else window.localStorage.removeItem(k);
  } catch {
    /* 무시 */
  }
};
const readLocalGoal = (uid: string) => readKey(userKey(GOAL_KEY, uid));
const readLocalCue = (uid: string) => readKey(userKey(CUE_KEY, uid));

/** 이번 주 · 연속에 세는 기록 — 대본 60% 이상 갔거나 3분 넘게 했을 때 (예전 기록은 끝까지 한 것만 남았으니 센다) */
const counts = (r: LocalRecord) => r.completed !== false || (r.durationSec ?? 0) >= 180;

/** 서버가 '이건 안 돼요'라고 거절한 것 (다시 보내도 같다) — 인터넷 문제와 구별 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isRefusal = (e: any): boolean => {
  const code = String(e?.code ?? "");
  return code === "P0001" || code.startsWith("22") || code.startsWith("23");
};

/** 이 기기에 남은 '내 계정' 기록만으로 계산 (계정에서 못 가져올 때) */
function localStats(uid: string): MindsetStats {
  const all = readLocal().filter((r) => r.uid === uid);
  const list = all.filter(counts);
  const days = new Set(list.map((r) => kstDay(r.completedAt)));
  const today = kstDay(new Date().toISOString());
  let streak = 0;
  const d = new Date(`${today}T00:00:00Z`);
  if (!days.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10)) && streak < 400) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 월=0
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - dow);
  const ws = weekStart.toISOString().slice(0, 10);
  const by: Record<string, number> = {};
  list.forEach((r) => (by[r.sessionId] = (by[r.sessionId] ?? 0) + 1));
  // 또렷함 — 처음 3번 평균과 최근 3번 평균 (6번 쌓인 뒤부터)
  const rated = all.filter((r) => typeof r.vividness === "number"); // 최근 것이 앞
  const avg = (xs: LocalRecord[]) => (xs.length ? Math.round((xs.reduce((s, r) => s + (r.vividness ?? 0), 0) / xs.length) * 10) / 10 : 0);
  const trendOk = rated.length >= 6;
  return {
    streak,
    done_today: days.has(today),
    week_count: list.filter((r) => kstDay(r.completedAt) >= ws).length,
    total_sessions: list.length,
    total_minutes: Math.floor(list.reduce((s, r) => s + (r.durationSec ?? 180), 0) / 60),
    rated: rated.length,
    vivid_recent: trendOk ? avg(rated.slice(0, 3)) : 0,
    vivid_first: trendOk ? avg(rated.slice(-3)) : 0,
    by_session: by,
    recent: all.slice(0, 12).map((r) => ({
      session_id: r.sessionId,
      created_at: r.completedAt,
      duration_sec: r.durationSec ?? 180,
      completed: r.completed !== false,
      vividness: r.vividness ?? null,
      control: r.control ?? null,
      mood_before: r.moodBefore ?? null,
      mood_after: r.moodAfter ?? null,
      note: r.reflection || null,
    })),
    goal: readLocalGoal(uid),
    cue: readLocalCue(uid),
    local: true,
  };
}

const v2Payload = (r: LocalRecord) => ({
  p_client_id: r.cid,
  p_at: r.completedAt,
  p_session_id: r.sessionId,
  p_duration_sec: Math.round(r.durationSec ?? 180),
  p_completed: r.completed !== false,
  p_mood_before: r.moodBefore ?? null,
  p_mood_after: r.moodAfter ?? null,
  p_vividness: r.vividness ?? null,
  p_control: r.control ?? null,
  p_note: r.reflection?.trim() || null,
});

/** 지금 로그인한 계정 */
async function sessionUid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

let flushing: Promise<void> | null = null;
/** 이 계정이 못 올린 기록을 오래된 것부터 계정에 올린다 (인터넷이 안 되면 다음에) */
function flushPending(uid: string): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const pend = readLocal()
      .filter((r) => r.pending && r.cid && r.uid === uid)
      .reverse();
    for (const r of pend) {
      // 올리는 도중에 다른 계정으로 바뀌면 멈춘다 — 남의 계정에 올라가지 않게
      if ((await sessionUid()) !== uid) break;
      try {
        const { error } = await sb.rpc("log_mindset_session_v2", v2Payload(r));
        if (!error || isRefusal(error)) patchLocal(r.cid!, { pending: false });
        else break;
      } catch {
        break;
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** 목표 · 한마디 맞추기 — 계정 값이 기준, 이 기기에서 못 올린 이 계정의 수정만 올린다 */
async function reconcileProfile(uid: string, st: MindsetStats): Promise<void> {
  const dirty = readKey(userKey(PROFILE_DIRTY_KEY, uid)) === "1";
  const lg = readLocalGoal(uid);
  const lc = readLocalCue(uid);
  if (dirty) {
    try {
      const { data, error } = await sb.rpc("set_mindset_profile", { p_goal: lg ?? "", p_cue: lc ?? "" });
      if (error) throw error;
      const saved = (data ?? {}) as { goal?: string | null; cue?: string | null };
      st.goal = saved.goal ?? null;
      st.cue = saved.cue ?? null;
      writeKey(userKey(PROFILE_DIRTY_KEY, uid), null);
    } catch {
      // 아직 못 올림 — 화면은 기기 값으로
      st.goal = lg;
      st.cue = lc;
      return;
    }
  }
  writeKey(userKey(GOAL_KEY, uid), st.goal);
  writeKey(userKey(CUE_KEY, uid), st.cue);
}

export async function fetchMindsetStats(uid: string): Promise<MindsetStats> {
  try {
    await flushPending(uid).catch(() => undefined);
    const { data, error } = await sb.rpc("get_my_mindset_stats");
    if (error) throw error;
    const st = data as MindsetStats;
    await reconcileProfile(uid, st);
    return st;
  } catch {
    return localStats(uid);
  }
}

export async function logMindsetSession(uid: string, input: MindsetLogInput): Promise<MindsetStats> {
  const rec: LocalRecord = {
    sessionId: input.sessionId,
    completedAt: new Date().toISOString(),
    durationSec: Math.round(input.durationSec),
    completed: input.completed,
    vividness: input.vividness ?? null,
    control: input.control ?? null,
    moodBefore: input.moodBefore ?? null,
    moodAfter: input.moodAfter ?? null,
    reflection: (input.note ?? "").trim(),
    declaration: input.closing,
    promises: [],
    cid: newCid(),
    pending: true,
    uid,
  };
  appendLocal(rec);
  let error: unknown = null;
  let data: unknown = null;
  try {
    const res = await sb.rpc("log_mindset_session_v2", v2Payload(rec));
    error = res.error;
    data = res.data;
  } catch (e) {
    error = e;
  }
  if (!error) {
    patchLocal(rec.cid!, { pending: false });
    void flushPending(uid);
    return data as MindsetStats;
  }
  if (isRefusal(error)) {
    // 서버가 받지 않은 기록은 기기에도 남기지 않는다 — 이유는 화면에 그대로
    patchLocal(rec.cid!, null);
    throw new Error((error as { message?: string }).message || "기록을 남기지 못했어요");
  }
  // 인터넷 문제 — 기기에 남겨 두고 다음에 올린다
  return localStats(uid);
}

/** 내 목표 한 문장(60자) + 나의 한마디(20자) — synced=false 면 이 기기에만 저장됐다 */
export async function saveMindsetProfile(
  uid: string,
  input: { goal: string; cue: string },
): Promise<{ goal: string | null; cue: string | null; synced: boolean }> {
  const goal = input.goal.trim().slice(0, 60) || null;
  const cue = input.cue.trim().slice(0, 20) || null;
  writeKey(userKey(GOAL_KEY, uid), goal);
  writeKey(userKey(CUE_KEY, uid), cue);
  try {
    const { data, error } = await sb.rpc("set_mindset_profile", { p_goal: goal ?? "", p_cue: cue ?? "" });
    if (error) throw error;
    writeKey(userKey(PROFILE_DIRTY_KEY, uid), null);
    const saved = (data ?? {}) as { goal?: string | null; cue?: string | null };
    return { goal: saved.goal ?? goal, cue: saved.cue ?? cue, synced: true };
  } catch {
    writeKey(userKey(PROFILE_DIRTY_KEY, uid), "1");
    return { goal, cue, synced: false };
  }
}

export const MINDSET_KEY = ["mindset"] as const;

export function useMindsetStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...MINDSET_KEY, "stats", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => fetchMindsetStats(user!.id),
  });
}

export function useLogMindsetSession() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: MindsetLogInput) => logMindsetSession(user?.id ?? "anon", input),
    onSuccess: (stats) => qc.setQueryData([...MINDSET_KEY, "stats", user?.id ?? "anon"], stats),
  });
}

export function useSaveMindsetProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { goal: string; cue: string }) => saveMindsetProfile(user?.id ?? "anon", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MINDSET_KEY }),
  });
}
