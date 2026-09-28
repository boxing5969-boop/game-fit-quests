/**
 * 레벨 테스트 — 체험용 계정 · 전체 관리자 전용 (2026-09-28).
 *
 * 대표님 요청: "레벨 1·2·10·40 일 때 앱이 어떻게 열리고 어떻게 움직이는지 테스트하게".
 * 서버(set_test_level / reset_test_level / get_test_level_state)가 **자기 계정만** 바꾼다.
 *   · 바꾸는 것: 리그·레벨, 리그에 맞는 타이틀매치 통과 수, 레벨 시작 시각(지금 — 승급 진행도 0부터), 마스터 트랙(꺼짐),
 *     그 레벨과 이후 레벨의 심사 기록(지워서 새로 시작)
 *   · 안 바꾸는 것: XP · 젬 · 마일리지 · 출석
 *   · 처음 바꾸기 직전 상태를 서버가 보관 → "원래대로" 로 되돌린다
 * 체험용 계정(profiles.is_test_account)은 다른 회원이 보는 공개 순위·명예의 전당에 나오지 않는다.
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type TestRank = "white" | "blue" | "red" | "black";

export interface TestLevelPos {
  rank: TestRank;
  level: number;
  bosses: number;
  overall?: number;
  master_level?: number;
}

export interface TestLevelState {
  allowed: boolean;
  is_test_account?: boolean;
  current?: TestLevelPos;
  /** 테스트 전 원래 상태 — 한 번도 안 바꿨으면 null */
  original?: (TestLevelPos & { taken_at?: string }) | null;
}

export const TEST_RANKS: TestRank[] = ["white", "blue", "red", "black"];
export const TEST_RANK_KO: Record<TestRank, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

export interface LevelPreset {
  key: string;
  label: string;
  sub: string;
  rank: TestRank;
  level: number;
  complete?: boolean;
}

/** 자주 보는 지점 — 대표님이 말한 1·2·10·40 + 리그가 바뀌는 순간 */
export const LEVEL_PRESETS: LevelPreset[] = [
  { key: "l1", label: "레벨 1", sub: "화이트 1 · 처음 시작", rank: "white", level: 1 },
  { key: "l2", label: "레벨 2", sub: "화이트 2 · 첫 레벨업 뒤", rank: "white", level: 2 },
  { key: "l10", label: "레벨 10", sub: "화이트 10 · 첫 타이틀매치", rank: "white", level: 10 },
  { key: "l11", label: "레벨 11", sub: "블루 1 · 새 리그 시작", rank: "blue", level: 1 },
  { key: "l21", label: "레벨 21", sub: "레드 1 · 코치 승인 리그", rank: "red", level: 1 },
  { key: "l40", label: "레벨 40", sub: "블랙 10 · 마지막 타이틀매치 전", rank: "black", level: 10 },
  { key: "l40done", label: "40 완주", sub: "마지막 타이틀매치 통과 · 마스터", rank: "black", level: 10, complete: true },
];

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

const toRank = (v: unknown): TestRank => (TEST_RANKS.includes(v as TestRank) ? (v as TestRank) : "white");
const toPos = (v: unknown): TestLevelPos | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return {
    rank: toRank(o.rank),
    level: Number(o.level) || 1,
    bosses: Number(o.bosses) || 0,
    overall: o.overall == null ? undefined : Number(o.overall),
    master_level: o.master_level == null ? undefined : Number(o.master_level),
  };
};

export async function getTestLevelState(): Promise<TestLevelState> {
  const { data, error } = await sbRpc<Record<string, unknown>>("get_test_level_state");
  if (error) throw new Error(translateError(error));
  const d = data ?? {};
  const original = toPos(d.original);
  return {
    allowed: d.allowed === true,
    is_test_account: d.is_test_account === true,
    current: toPos(d.current),
    original: original
      ? { ...original, taken_at: typeof (d.original as Record<string, unknown>)?.taken_at === "string" ? String((d.original as Record<string, unknown>).taken_at) : undefined }
      : null,
  };
}

export async function setTestLevel(rank: TestRank, level: number, complete = false): Promise<void> {
  const { error } = await sbRpc<unknown>("set_test_level", { _rank: rank, _level: level, _complete: complete });
  if (error) throw new Error(translateError(error));
}

export async function resetTestLevel(): Promise<boolean> {
  const { data, error } = await sbRpc<{ restored?: boolean }>("reset_test_level");
  if (error) throw new Error(translateError(error));
  return data?.restored === true;
}

/** "블루 리그 · 레벨 3 (전체 13)" · 완주면 "블랙 리그 · 레벨 10 완주" */
export const testPosLabel = (p?: TestLevelPos | null): string => {
  if (!p) return "—";
  const overall = TEST_RANKS.indexOf(p.rank) * 10 + p.level;
  const done = p.rank === "black" && p.level === 10 && p.bosses >= 4;
  return `${TEST_RANK_KO[p.rank]} 리그 · 레벨 ${p.level}${done ? " 완주" : ""} (전체 ${overall})`;
};

/** 프리셋과 같은 상태인지 — 선택 표시용 */
export const isPresetActive = (preset: LevelPreset, p?: TestLevelPos | null): boolean => {
  if (!p) return false;
  const done = p.rank === "black" && p.level === 10 && p.bosses >= 4;
  return p.rank === preset.rank && p.level === preset.level && !!preset.complete === done;
};
