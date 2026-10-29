/**
 * 153 PB (Personal Best · 내 최고 기록) — 153 체력 평가. 종목 정의 · 구간 · 시간 표시
 *   (2026-10-15 대표님 확정, 기획안 '153 체력테스트 기획안' — 처음 이름 '153 TEST')
 *   2026-10-18 이름 → '153 PB' (대표님: "153 PB (Personal Best)(내 최고 기록) 이렇게 표현하자").
 *   코드 식별자(test153 · first_test153 · test153_records)는 그대로 둔다.
 *   8라운드 × (셀트런 100m → 스테이션). 순서는 항상 같다. 타임캡 25분.
 *   스타터 = 모든 개수 절반(셀트런 거리는 그대로), 푸시업은 무릎 허용.
 *   DB: supabase/migrations/20261015220000_test153_records.sql — splits_ms 는 아래 구간 순서(16개)대로.
 */

export type Test153Division = "starter" | "open";

export const TEST153_NAME = "153 PB";
/** 이름 풀이 — 이름을 처음 보여 주는 곳에 같이 쓴다 */
export const TEST153_NAME_EN = "Personal Best";
export const TEST153_NAME_KO = "내 최고 기록";
export const TEST153_CAP_MS = 25 * 60 * 1000;

export interface Test153Station {
  name: string;
  /** 오픈 기준 개수 */
  open: number;
  unit: "회" | "세트" | "걸음";
  /** 한 번이 인정되는 기준 (코치 판정용 한 줄) */
  standard: string;
  /** 회원 안내 — 어떻게 하는지 (2026-10-18 대표님: "어떤 동작을 어떻게 하고 어떻게 평가하는지도") */
  howTo: string;
  /** 회원 안내 — 기록을 당기는 요령 한 줄 */
  tip: string;
  boxing?: boolean;
  /** 시범 영상 (2026-10-29 대표님 촬영 · public/test153/pbN.mp4 · 무음 · 누르면 재생) */
  video?: { src: string; poster: string };
}

/** 시범 영상 경로 — 종목 순서(1~8)대로 */
const pbVideo = (n: number) => ({ src: `/test153/pb${n}.mp4`, poster: `/test153/pb${n}.webp` });

export const TEST153_STATIONS: readonly Test153Station[] = [
  {
    // 2026-10-18 대표님: "버피할 때 가슴이 바닥에 완전히 닿고 일어나서 원투 동작 — 복서 버피로 명명" (점프·박수 대신 원투)
    name: "복서 버피",
    video: pbVideo(1),
    open: 30,
    unit: "회",
    standard: "가슴이 바닥에 완전히 닿음 → 일어나서 원투 (팔 끝까지 뻗고 가드 복귀)",
    howTo:
      "선 자세에서 손을 바닥에 짚고 다리를 뒤로 뻗어 엎드려요. 가슴을 바닥에 완전히 붙였다가, 발을 당겨 일어나서 가드를 올리고 원투를 쳐요. 원투까지 쳐야 1회예요.",
    tip: "원투는 세기가 아니라 정확함으로 세요. 빨리 하고 오래 쉬기보다, 천천히라도 멈추지 않는 쪽이 빨라요.",
    boxing: true,
  },
  {
    name: "원·투·쓰리 스텝",
    video: pbVideo(2),
    open: 10,
    unit: "세트",
    standard: "1스텝·2스텝·3스텝 전진, 매번 뒷발이 시작 라인까지 복귀 = 1세트",
    howTo:
      "가드를 올리고 시작 라인에 서요. 앞으로 1스텝 나갔다가 돌아오고, 2스텝 나갔다가 돌아오고, 3스텝 나갔다가 돌아오면 1세트예요.",
    tip: "앞발이 먼저 나가고 뒷발이 따라가는 복싱 스텝으로 — 두 발이 모이거나 꼬이지 않게 해요.",
    boxing: true,
  },
  {
    name: "스쿼트",
    video: pbVideo(3),
    open: 50,
    unit: "회",
    standard: "엉덩이가 무릎보다 아래 → 무릎·엉덩이 완전히 폄",
    howTo: "발을 어깨너비로 벌리고, 엉덩이를 뒤로 빼며 무릎보다 낮게 앉았다가 끝까지 일어나요.",
    tip: "무릎이 안쪽으로 모이지 않게, 발뒤꿈치로 바닥을 밀며 일어나요.",
  },
  {
    name: "푸시업",
    video: pbVideo(4),
    open: 30,
    unit: "회",
    standard: "가슴이 매트에 → 팔 완전히 폄, 몸 일직선 (스타터 무릎 허용)",
    howTo:
      "손은 어깨너비보다 조금 넓게 짚고, 머리부터 발끝까지 일직선을 지킨 채 가슴이 매트에 닿을 때까지 내려갔다가 팔을 끝까지 펴요. 스타터는 무릎을 대고 해도 돼요.",
    tip: "한계까지 버티지 말고 힘이 남았을 때 미리 끊어 쉬어요. 끝까지 버티면 다음 개수가 무너져요.",
  },
  {
    name: "복서 스텝 콤비",
    video: pbVideo(5),
    open: 10,
    unit: "세트",
    standard: "스텝 원투 → 사이드 3번 → 원투 → 반대 사이드 3번 → 원투 = 1세트 (팔 끝까지·가드 복귀)",
    howTo: "앞으로 스텝하며 원투 → 옆으로 3번 스텝 → 원투 → 반대쪽으로 3번 스텝 → 원투까지가 1세트예요.",
    tip: "원투는 세기가 아니라 정확함으로 세요. 팔을 끝까지 뻗고, 손이 턱 옆 가드로 돌아와야 해요.",
    boxing: true,
  },
  {
    // 2026-10-18 대표님: "싯업도 복서 싯업 — 등이 완전히 닿았다가 일어나서 원투가 한 동작으로, 복서 싯업으로 명명"
    name: "복서 싯업",
    video: pbVideo(6),
    open: 40,
    unit: "회",
    standard: "등이 매트에 완전히 닿음 → 일어나서 원투 = 1회 (팔 끝까지 뻗고 가드 복귀)",
    howTo:
      "매트에 누워 등을 완전히 붙였다가, 상체를 일으켜 앉은 자세에서 가드를 올리고 원투를 쳐요. 눕기 → 일어나기 → 원투까지가 한 동작, 1회예요.",
    tip: "원투는 세기가 아니라 정확함으로 세요. 내려갈 때 등이 매트에 완전히 닿아야 1회예요.",
    boxing: true,
  },
  {
    name: "런지",
    video: pbVideo(7),
    open: 40,
    unit: "걸음",
    standard: "뒷무릎이 매트에 → 일어서며 엉덩이·무릎 폄 (양발 교대)",
    howTo:
      "한 발을 크게 앞으로 내디디며 뒷무릎이 매트에 닿을 때까지 내려갔다가, 일어서며 엉덩이와 무릎을 펴요. 양발을 번갈아 — 한 발이 1걸음이에요.",
    tip: "상체는 세우고, 앞무릎이 안쪽으로 쏠리지 않게 해요.",
  },
  {
    name: "줄넘기",
    video: pbVideo(8),
    open: 200,
    unit: "회",
    standard: "줄이 두 발 밑을 지난 횟수 (카운터 줄넘기)",
    howTo: "카운터가 달린 줄넘기로 넘어요. 줄이 걸려도 그 자리에서 바로 이어 하면 돼요 — 카운터 숫자가 다 차면 끝!",
    tip: "마지막 종목이에요. 여기서 남은 힘을 다 쓰세요.",
  },
];

/** 셀트런 100m = 10m × 10번 — 타임캡 때 남은 동작 수로는 10번으로 센다 */
export const TEST153_RUN_REPS = 10;

/** 회원 안내 — 셀트런 (매 라운드 시작, 모두 8번) */
export const TEST153_RUN_GUIDE = {
  name: "셀트런 100m",
  howTo:
    "10m 떨어진 두 라인 사이를 오가는 왕복 달리기예요. 10m를 10번(왕복 5번) 달리면 100m. 매 라운드 시작마다, 모두 8번 달려요.",
  standard: "방향을 바꿀 때마다 라인을 발로 밟기 — 10m × 10번",
  tip: "첫 셀트런을 전력으로 달리면 뒤 라운드가 무너져요. 8번 모두 비슷한 시간으로 달리는 게 기록을 당기는 지름길이에요.",
} as const;

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
