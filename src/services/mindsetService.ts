/**
 * 153마인드셋 기록 — DB 함수 (supabase/migrations/20261019010000_mindset_sessions.sql)
 *   계정에 남겨서 연속 일수 · 이번 주 · 선명도 변화를 본다. 오프라인이거나 실패하면 이 기기에만 남긴다(예전 방식).
 *   예전 키(myboxer.visualization.records)에도 계속 적는다 — 홈 '오늘의 포커스' 카드가 오늘 했는지 이 키로 본다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const LOCAL_KEY = "myboxer.visualization.records";
const GOAL_KEY = "myboxer.mindset.goal";
const CUE_KEY = "myboxer.mindset.cue";

export interface MindsetRecent {
  session_id: string;
  created_at: string;
  duration_sec: number;
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
  vividness?: number | null;
  moodBefore?: number | null;
  moodAfter?: number | null;
  reflection?: string;
  declaration?: string;
  promises?: string[];
}

const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function readLocal(): LocalRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as LocalRecord[]) : [];
  } catch {
    return [];
  }
}

function appendLocal(r: LocalRecord) {
  try {
    const list = readLocal();
    list.unshift(r);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* 저장이 안 되는 기기 */
  }
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
export const readLocalGoal = () => readKey(GOAL_KEY);
export const readLocalCue = () => readKey(CUE_KEY);

/** 이 기기 기록만으로 계산 (계정이 안 될 때) */
function localStats(): MindsetStats {
  const list = readLocal();
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
  const rated = list.filter((r) => typeof r.vividness === "number");
  const avg = (xs: LocalRecord[]) => (xs.length ? Math.round((xs.reduce((s, r) => s + (r.vividness ?? 0), 0) / xs.length) * 10) / 10 : 0);
  return {
    streak,
    done_today: days.has(today),
    week_count: list.filter((r) => kstDay(r.completedAt) >= ws).length,
    total_sessions: list.length,
    total_minutes: Math.floor(list.reduce((s, r) => s + (r.durationSec ?? 180), 0) / 60),
    rated: rated.length,
    vivid_recent: avg(rated.slice(0, 5)),
    vivid_first: avg(rated.slice(-5)),
    by_session: by,
    recent: list.slice(0, 12).map((r) => ({
      session_id: r.sessionId,
      created_at: r.completedAt,
      duration_sec: r.durationSec ?? 180,
      vividness: r.vividness ?? null,
      control: null,
      mood_before: r.moodBefore ?? null,
      mood_after: r.moodAfter ?? null,
      note: r.reflection || null,
    })),
    goal: readLocalGoal(),
    cue: readLocalCue(),
    local: true,
  };
}

export async function fetchMindsetStats(): Promise<MindsetStats> {
  try {
    const { data, error } = await sb.rpc("get_my_mindset_stats");
    if (error) throw error;
    const st = data as MindsetStats;
    // 계정에 없고 이 기기에만 있으면 기기 것을 쓴다 (예전에 적어 둔 것)
    if (st.goal) writeKey(GOAL_KEY, st.goal);
    else st.goal = readLocalGoal();
    if (st.cue) writeKey(CUE_KEY, st.cue);
    else st.cue = readLocalCue();
    return st;
  } catch {
    return localStats();
  }
}

export async function logMindsetSession(input: MindsetLogInput): Promise<MindsetStats> {
  appendLocal({
    sessionId: input.sessionId,
    completedAt: new Date().toISOString(),
    durationSec: input.durationSec,
    vividness: input.vividness ?? null,
    moodBefore: input.moodBefore ?? null,
    moodAfter: input.moodAfter ?? null,
    reflection: (input.note ?? "").trim(),
    declaration: input.closing,
    promises: [],
  });
  try {
    const { data, error } = await sb.rpc("log_mindset_session", {
      p_session_id: input.sessionId,
      p_duration_sec: Math.round(input.durationSec),
      p_completed: input.completed,
      p_mood_before: input.moodBefore ?? null,
      p_mood_after: input.moodAfter ?? null,
      p_vividness: input.vividness ?? null,
      p_control: input.control ?? null,
      p_note: input.note?.trim() || null,
    });
    if (error) throw error;
    return data as MindsetStats;
  } catch {
    return localStats();
  }
}

/** 내 목표 한 문장(60자) + 나의 한마디(20자) */
export async function saveMindsetProfile(input: { goal: string; cue: string }): Promise<{ goal: string | null; cue: string | null }> {
  const goal = input.goal.trim().slice(0, 60) || null;
  const cue = input.cue.trim().slice(0, 20) || null;
  writeKey(GOAL_KEY, goal);
  writeKey(CUE_KEY, cue);
  try {
    const { data, error } = await sb.rpc("set_mindset_profile", { p_goal: goal ?? "", p_cue: cue ?? "" });
    if (error) throw error;
    return data as { goal: string | null; cue: string | null };
  } catch {
    return { goal, cue };
  }
}

export const MINDSET_KEY = ["mindset"] as const;

export function useMindsetStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...MINDSET_KEY, "stats", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: fetchMindsetStats,
  });
}

export function useLogMindsetSession() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: logMindsetSession,
    onSuccess: (stats) => qc.setQueryData([...MINDSET_KEY, "stats", user?.id ?? "anon"], stats),
  });
}

export function useSaveMindsetProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveMindsetProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: MINDSET_KEY }),
  });
}
