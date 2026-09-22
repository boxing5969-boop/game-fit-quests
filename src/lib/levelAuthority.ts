/**
 * 승급 승인 주체 라벨 — 단일 출처 (2026-09-22).
 *
 * DB `level_gate_authority(rank, level)` 가 정본이고 `get_levelup_rules()` 가 리그별로
 * levelAuthority(1~9레벨) · titleAuthority(10레벨) 를 내려준다. 화면 문구는 전부 이 맵을 거친다 —
 * 예전엔 홈 힌트·가이드가 "코치 승인" 으로 통일해 블루(지점장)·레드·블랙(관장) 과 어긋났다.
 */

export type GateAuthority = "coach" | "manager" | "owner";

export const WHO: Record<GateAuthority, string> = {
  coach: "담당 코치님",
  manager: "지점장·관장님",
  owner: "관장님",
};

export interface RuleAuthority {
  rank: string;
  levelAuthority?: GateAuthority | string | null;
  titleAuthority?: GateAuthority | string | null;
}

export const whoLabel = (a?: string | null): string => WHO[(a ?? "coach") as GateAuthority] ?? WHO.coach;

/** 이 리그·레벨에서 승급을 승인하는 사람 (10레벨 = 타이틀매치 주체) */
export function authorityLabel(rules: RuleAuthority[] | undefined, rank: string | undefined, level: number | undefined): string {
  const r = rules?.find((x) => x.rank === rank);
  if (!r) return WHO.coach;
  return whoLabel((level ?? 1) >= 10 ? r.titleAuthority : r.levelAuthority);
}
