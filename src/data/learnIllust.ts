// 🎨 영상으로 배우기 — 레벨 미션 영상 · 153 PB 시범 영상의 2컷 동작 그림 (2026-11-18 대표님
//   「영상으로 배우기탭에 이렇게 그림으로 2개 이미지로 설명해줘 모든 영상에 … 모든 동작은 영상 밑에 이미지 소개글」)
//   · 동작 카드는 DB(training_exercises.image_url)에 그림이 있다. 레벨 미션(missions)에는 그림 칸이 없어 여기 한 곳에 둔다
//   · 열쇠 = 미션 id 또는 153 PB 타일 id(pbExtraId) — 같은 영상을 쓰는 미션(레벨 7 = 레벨 1 영상 다시 쓰기)과
//     같은 동작의 다른 버전(실사 · 애니)은 모두 같은 그림
//   · 그림 파일 = public/assets/learn-illust/<이름>.webp (카드 그림과 같은 폴더 · 같은 모양 1200×896 · 「스트레이트(원투)」 그림 기준)
//     미션 그림 = m-<미션 id> · 153 PB 그림 = pb-<종목 번호> · 카드 그림 = <카드 id>
//   · 같은 동작의 카드 그림이 있으면 그 그림을 같이 쓴다 (새로 그리지 않는다)
//   · 여기 없는 영상은 예전 그대로 — 그림 자리 없이 영상 · 설명만
//     (153 레슨(유튜브 · 릴스 강의)은 한 동작이 아니라 그림을 붙이지 않는다)
//   플레이어(VideoPlayer)는 영상 바로 아래 · 설명 바로 위에 그린다.
import { pbExtraId } from "@/lib/learnExtras";

const file = (name: string) => `/assets/learn-illust/${name}.webp`;
const mission = (id: string) => file(`m-${id}`);

/** 153 PB 종목 번호(1~8) → 타일 id — LEARN_ILLUST 의 열쇠 */
export const pbIllustKey = (n: number): string => pbExtraId(n);

/** 같은 동작이라 카드 그림을 같이 쓰는 것 */
const CARD = {
  /** 제자리 스텝 */
  stepInPlace: "2d305d98-107b-4a6a-a1cd-43c7f7fd7598",
  /** 십자 스텝 */
  crossStep: "1530c4d0-0001-4a00-8000-000000001112",
  /** 원투 · 훅 콤비네이션 */
  oneTwoHook: "1530c4d0-001b-4a00-8000-000000001116",
  /** 사이드 스텝 */
  sideStep: "9e48a0d6-aafd-4fc9-805f-b1232c9db2de",
  /** 잽 · 스트레이트 */
  jabStraight: "1530c4d0-0019-4a00-8000-000000001116",
  /** 원투 · 훅 · 더킹 */
  oneTwoHookDuck: "1530c4d0-0012-4a00-8000-000000001116",
} as const;

/** 2차 그림 — 한 그림을 여러 미션이 같이 쓰는 것 */
const SIDE_JAB = mission("66b9474a-59c7-4233-bb80-1242a091a4cc");
const BACK_STEP_JAB = mission("7592a1ce-b90b-462f-a247-7ad9a7c7bc60");
const ONE_TWO_THREE_STEP = mission("5cbfdc5c-299b-4ec8-b3ea-bc9df819f45d");

/** 미션 id · 153 PB 타일 id → 그림 */
export const LEARN_ILLUST: Readonly<Record<string, string>> = {
  // ── 화이트 리그 레벨 미션 ──
  // L1 제자리 스텝(거울 앞 대각선 위아래 바운스) = 카드 「제자리 스텝」
  "171fa9f5-226e-4781-aaf8-170b95bcb8be": file(CARD.stepInPlace),
  // L1 4스텝(4&1 — 제자리 넷 + 대각선 나갔다 제자리)
  "e97792cb-6c3d-499d-a09a-6276c0bce30e": mission("e97792cb-6c3d-499d-a09a-6276c0bce30e"),
  // L1 가드 · 잽 팔 동작(입 높이 가드 · 예비 동작 없는 직선 잽)
  "5f531dcf-a94a-443d-b5c9-e7e647241428": mission("5f531dcf-a94a-443d-b5c9-e7e647241428"),
  // L1 4스텝 잽(앞으로 나갈 때 잽을 동시에)
  "0eed6641-ed3d-48d9-897a-b62d64f04353": mission("0eed6641-ed3d-48d9-897a-b62d64f04353"),
  // L1 제자리 스텝 잽(앞발 · 앞손 동시에 · 몸은 제자리)
  "1fcdba15-fcaf-4158-ac43-5b1aa1c8684c": mission("1fcdba15-fcaf-4158-ac43-5b1aa1c8684c"),
  // L1 전진 스텝 잽(앞발 나가는 순간 잽 → 뒷발 복귀)
  "e04828b3-8dd7-4945-84e2-1e4aea82b949": mission("e04828b3-8dd7-4945-84e2-1e4aea82b949"),
  // L1 백스텝 잽 · L7 잽 · 백스텝 · 잽(같은 영상)
  "7592a1ce-b90b-462f-a247-7ad9a7c7bc60": BACK_STEP_JAB,
  "2a5bd8e1-0446-4517-9d60-83de94244210": BACK_STEP_JAB,
  // L1 옆 각도 4스텝 잽 · 걷기 스텝 잽 · L7 스텝 사이드 잽 · 걷는 사이드 잽(같은 동작 — 사이드 잽 · 방향 전환)
  "66b9474a-59c7-4233-bb80-1242a091a4cc": SIDE_JAB,
  "a7bdf0f2-4924-4df3-a782-b19125397d50": SIDE_JAB,
  "f05615e2-47bb-41d4-b94a-654189309a40": SIDE_JAB,
  "fd810419-872f-471f-b210-55282ac5395c": SIDE_JAB,
  // L3 십자스텝(앞·뒤·좌·우) = 카드 「십자 스텝」
  "37567036-f753-4fda-9145-a01a3a33d106": file(CARD.crossStep),
  // L3 앞뒤 스텝 리듬(전진 = 앞발 먼저 · 후진 = 뒷발 먼저)
  "16cad35b-9ee9-46f5-8611-c7b1ef4face6": mission("16cad35b-9ee9-46f5-8611-c7b1ef4face6"),
  // 사이드 방향전환 스텝
  "b6e8671b-04a5-4744-ac63-af60ffe27c17": mission("b6e8671b-04a5-4744-ac63-af60ffe27c17"),
  // 원·투·쓰리 스텝(한 걸음 · 두 걸음 · 세 걸음 나갔다 출발선으로) = 153 PB 2번과 같은 동작
  "5cbfdc5c-299b-4ec8-b3ea-bc9df819f45d": ONE_TWO_THREE_STEP,
  // 체력 — 무릎 올리며 대쉬(하이니 줄넘기) · 좌우 번갈아 뛰기
  "8d348108-82cb-49d7-b5a2-4b3f15be9e2a": mission("8d348108-82cb-49d7-b5a2-4b3f15be9e2a"),
  "0895f947-6b31-4f02-8e05-1cf6d33dcd12": mission("0895f947-6b31-4f02-8e05-1cf6d33dcd12"),
  // 체력 — 4스텝 옆으로 뛰기 = 카드 「사이드 스텝」
  "160f633b-66ed-4157-b2c0-8cfaf7e1731b": file(CARD.sideStep),
  // 방어 잽 · 거리 조절 · 뒷발 밀며 전진 잽
  "fbfdc71f-7b0f-4d17-8138-e9b6c2ac17cc": mission("fbfdc71f-7b0f-4d17-8138-e9b6c2ac17cc"),
  "7ff5e5c1-c487-41ab-aefb-a51277bc6837": mission("7ff5e5c1-c487-41ab-aefb-a51277bc6837"),
  // 전진 더블 잽 · 후진 더블 잽 · 인앤아웃 더블 잽
  "453ecf41-a56d-4621-964e-31222cd4fa54": mission("453ecf41-a56d-4621-964e-31222cd4fa54"),
  "87339773-84d4-416b-9c5f-9793b3b3aa46": mission("87339773-84d4-416b-9c5f-9793b3b3aa46"),
  "c8a1dc29-1abe-425a-b27b-a2fcd3a98e98": mission("c8a1dc29-1abe-425a-b27b-a2fcd3a98e98"),
  // 콤비 — 스텝 원투 · 원투 = 카드 「잽 · 스트레이트」
  "3b7c641c-c7a1-43a9-a4c8-36b50521dc3f": file(CARD.jabStraight),
  // L8 스텝 원투쓰리 · 걷는 스텝 원투쓰리 · 걷는 원투쓰리(원투로 세우고 앞손 훅) = 카드 「원투 · 훅 콤비네이션」
  "c745e1af-6af4-4648-a1f9-ba1dbc5b81f6": file(CARD.oneTwoHook),
  "74b8e937-e94f-47eb-97f3-31094b4bdb36": file(CARD.oneTwoHook),
  "4b7ce5a4-bcee-4d9c-903e-8325b664017e": file(CARD.oneTwoHook),
  // L10 연타 1번(잽잽 원투) · 2번(백스텝 카운터) · 3번(백스텝 카운터 → 피벗 → 원투)
  "35d98449-fe20-48c5-b3de-7b55203f8c6b": mission("35d98449-fe20-48c5-b3de-7b55203f8c6b"),
  "5b5e34a1-0c08-4c53-8392-dfb7db561194": mission("5b5e34a1-0c08-4c53-8392-dfb7db561194"),
  "d4a7d56c-bce7-4cbe-a848-540e50541f10": mission("d4a7d56c-bce7-4cbe-a848-540e50541f10"),
  // 기술 — 들어오면 돌려버리기(피벗) · 돌리고 훅(상대와 둘이)
  "4d3fef12-5032-4c8c-9713-4fcbe006be07": mission("4d3fef12-5032-4c8c-9713-4fcbe006be07"),
  "17daa0c2-46c0-473c-9625-e6e53c172b01": mission("17daa0c2-46c0-473c-9625-e6e53c172b01"),

  // ── 블루 리그 ──
  // 콤보 드릴 18동작(원투 훅 → 더킹 → 훅 카운터) 실사 · 애니 여성 · 애니 소년 = 카드 「원투 · 훅 · 더킹」
  "b1d7c0a2-3f4e-4c5b-9a6d-7e8f90a1b2c3": file(CARD.oneTwoHookDuck),
  "c2e8d1b3-4a5f-4d6c-8b7e-8f9a01b2c3d4": file(CARD.oneTwoHookDuck),
  "d3f9e2c4-5b6a-4e7d-9c8f-9a0b12c3d4e5": file(CARD.oneTwoHookDuck),

  // ── 레벨 미션 워밍업 영상 ──
  // 좌우 리듬 줄넘기 · 왼발 · 오른발 털기 · 트위스트 줄넘기 · 사다리 스텝 9가지
  "9b97e872-8fef-4181-8070-6d15fa060a0a": mission("9b97e872-8fef-4181-8070-6d15fa060a0a"),
  "48f36c7a-d6e7-48cd-99e1-647c4ce834b2": mission("48f36c7a-d6e7-48cd-99e1-647c4ce834b2"),
  "be6e44ce-e019-492d-a2d5-dcf5f8d601f4": mission("be6e44ce-e019-492d-a2d5-dcf5f8d601f4"),
  "3b2a9fb4-933d-473b-af62-4676dd496ec3": mission("3b2a9fb4-933d-473b-af62-4676dd496ec3"),

  // ── 153 PB 종목 시범(체력 칸) — 맨손 + 남색 붕대 ──
  [pbIllustKey(1)]: file("pb-1"), // 복서 버피 — 가슴이 매트에 → 일어나 원투
  [pbIllustKey(2)]: ONE_TWO_THREE_STEP, // 원·투·쓰리 스텝 = 레벨 미션 「원·투·쓰리 스텝」 그림
  [pbIllustKey(3)]: file("pb-3"), // 스쿼트 — 엉덩이가 무릎보다 아래
  [pbIllustKey(4)]: file("pb-4"), // 푸시업 — 머리부터 발끝까지 한 줄 · 가슴이 매트에
  [pbIllustKey(5)]: file("pb-5"), // 복서 스텝 콤비 — 전진 원투 → 옆으로 세 걸음
  [pbIllustKey(6)]: file("pb-6"), // 복서 싯업 — 등이 매트에 → 앉아서 원투
  [pbIllustKey(7)]: file("pb-7"), // 런지 — 뒷무릎이 매트에
  [pbIllustKey(8)]: file("pb-8"), // 줄넘기 — 줄이 두 발 밑으로
};

/** 이 영상(미션 · 153 PB)의 동작 그림 — 여러 id(같은 동작의 다른 버전)를 주면 처음 맞는 것 · 없으면 null */
export function learnIllustOf(ids: ReadonlyArray<string | null | undefined>): string | null {
  for (const id of ids) {
    const key = (id ?? "").trim().toLowerCase();
    if (key && LEARN_ILLUST[key]) return LEARN_ILLUST[key];
  }
  return null;
}
