/**
 * 153 TEST (153 체력테스트) — 종목 정의 · 구간 · 시간 표시 (2026-10-15 대표님 확정, 기획안 '153 체력테스트 기획안')
 *   8라운드 × (셀트런 100m → 스테이션). 순서는 항상 같다. 타임캡 25분.
 *   스타터 = 모든 개수 절반(셀트런 거리는 그대로), 푸시업은 무릎 허용.
 *   DB: supabase/migrations/20261015220000_test153_records.sql — splits_ms 는 아래 구간 순서(16개)대로.
 */

export type Test153Division = "starter" | "open";

export const TEST153_NAME = "153 TEST";
export const TEST153_CAP_MS = 25 * 60 * 1000;

export interface Test153Station {
  name: string;
  /** 오픈 기준 개수 */
  open: number;
  unit: "회" | "세트" | "걸음";
  /** 한 번이 인정되는 기준 (코치 판정용 한 줄) */
  standard: string;
  boxing?: boolean;
}

export const TEST153_STATIONS: readonly Test153Station[] = [
  { name: "버피", open: 30, unit: "회", standard: "가슴·허벅지가 바닥 → 일어나 점프하며 머리 위 박수" },
  {
    name: "원·투·쓰리 스텝",
    open: 10,
    unit: "세트",
    standard: "1스텝·2스텝·3스텝 전진, 매번 뒷발이 시작 라인까지 복귀 = 1세트",
    boxing: true,
  },
  { name: "스쿼트", open: 50, unit: "회", standard: "엉덩이가 무릎보다 아래 → 무릎·엉덩이 완전히 폄" },
  { name: "푸시업", open: 30, unit: "회", standard: "가슴이 매트에 → 팔 완전히 폄, 몸 일직선 (스타터 무릎 허용)" },
  {
    name: "복서 스텝 콤비",
    open: 10,
    unit: "세트",
    standard: "스텝 원투 → 사이드 3번 → 원투 → 반대 사이드 3번 → 원투 = 1세트 (팔 끝까지·가드 복귀)",
    boxing: true,
  },
  { name: "싯업", open: 40, unit: "회", standard: "어깨가 매트에 → 두 손이 발끝 라인을 넘음" },
  { name: "런지", open: 40, unit: "걸음", standard: "뒷무릎이 매트에 → 일어서며 엉덩이·무릎 폄 (양발 교대)" },
  { name: "줄넘기", open: 200, unit: "회", standard: "줄이 두 발 밑을 지난 횟수 (카운터 줄넘기)" },
];

/** 셀트런 100m = 10m × 10번 — 타임캡 때 남은 동작 수로는 10번으로 센다 */
export const TEST153_RUN_REPS = 10;

export const stationReps = (s: Test153Station, d: Test153Division) => (d === "starter" ? Math.ceil(s.open / 2) : s.open);

export interface Test153Segment {
  index: number;
  round: number;
  kind: "run" | "station";
  label: string;
  short: string;
  reps: number;
  standard: string;
  boxing?: boolean;
}

/** 16구간: 셀트런1, 스테이션1, … 셀트런8, 스테이션8 */
export const buildSegments = (d: Test153Division): Test153Segment[] =>
  TEST153_STATIONS.flatMap((s, i) => [
    {
      index: i * 2,
      round: i + 1,
      kind: "run" as const,
      label: "셀트런 100m",
      short: `런${i + 1}`,
      reps: TEST153_RUN_REPS,
      standard: "10m 라인을 밟고 돌아오기 × 10번",
    },
    {
      index: i * 2 + 1,
      round: i + 1,
      kind: "station" as const,
      label: `${s.name} ${stationReps(s, d)}${s.unit}`,
      short: s.name,
      reps: stationReps(s, d),
      standard: s.standard,
      boxing: s.boxing,
    },
  ]);

export const DIVISION_LABEL: Record<Test153Division, string> = { starter: "스타터", open: "오픈" };

/** 12:34.5 */
export const fmtMs = (ms: number, tenths = true) => {
  const safe = Math.max(0, Math.floor(ms));
  const m = Math.floor(safe / 60000);
  const s = Math.floor((safe % 60000) / 1000);
  const t = Math.floor((safe % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}${tenths ? `.${t}` : ""}`;
};

/** 점수 표시 — 완주면 시간, 타임캡이면 '25:00 + 남은 N개' */
export const fmtScore = (r: { finished: boolean; score_ms: number; remaining_reps?: number | null }) =>
  r.finished ? fmtMs(r.score_ms) : `캡 + ${r.remaining_reps ?? Math.round((r.score_ms - TEST153_CAP_MS) / 1000)}개`;

export const TEST153_AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대+"] as const;
