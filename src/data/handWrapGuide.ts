/**
 * 🥊 붕대 감기 가이드 — 153 표준 12단계 · 흔한 실수 · 영상 포인트.
 *
 *   2026-10-13: 처음 만듦 (그림 8단계).
 *   2026-10-15 대표님: "손 모양이 너무 AI 티가 나" → 그린 손 대신 실제 사진 + 감는 방향 화살표.
 *     153 표준 = 손목은 처음 2바퀴 → 그다음 손목을 지날 때마다 1바퀴 → 마지막은 손목에서 찍찍이(벨크로) 마무리.
 *     '엄지 잡아 주기' · '정권 한 번 더' 는 뺐다 (대표님 확정). 손목 합계 = 2 + 1 × 5 = 7바퀴.
 *     사진 = 대표님이 올린 단계 사진(12컷 + 완성)을 잘라 쓴 것 (src/assets/handwrap). 153 코치님 사진으로 바꾸면 화살표 좌표도 맞춘다.
 *   2026-10-15 대표님: "사진 화질이 안 좋아 — 애니메이션화해서 화질 좋게" → 같은 사진을 보고 다시 그린 고화질 그림(1080px)으로 교체,
 *     화살표 좌표도 새 그림에 맞춤. 완성 화면 = 주먹(step14) + 다 감은 손(step13).
 *
 *   2026-10-16 대표님: "화질이랑 이미지 다 좋은데 우리 방법이랑 달라" + 보내 준 영상('복싱 3.7m 붕대 감는 방법')이 153 방법과 같다
 *     → 그 영상 순서대로 12단계를 다시 쓰고 그림을 같은 그림체로 새로 그림(Higgsfield). 주먹 패드부터 만든다:
 *       검지·중지로 끝 잡기 → 손가락 벌려 감기(남자 2~3·여자 3~4바퀴) → 빼서 한 번 접기 → 주먹 위에 → 끝 라인 2번 고정 → 손목 1바퀴
 *       → 새끼·검지·중지 쪽으로 들어가 엄지 사이로 나오기(지날 때마다 손목 1바퀴) → 남은 붕대는 손목에 → 벨크로 → 손바닥 정리.
 *     예전 '엄지 고리 · 손목 처음 2바퀴 · 손가락 사이 통과'는 뺐다. 완성 화면 = 주먹(step14) + 다 감은 손(step13).
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 이 화면을 보며 직접 감는다.
 *   그다음 '집에서 혼자 감아 보기' 미션 — 목표 일수·보상 숫자는 DB 함수가 정본이다
 *   (handwrap_practice_goal · handwrap_practice_reward → get_my_handwrap_practice 가 돌려준다). 여기에 숫자를 적지 않는다.
 *
 *   영상 = 훈련 라이브러리 '준비' 칸의 '복싱 붕대 감기' 항목 영상 URL (코치·관장이 수정 → 영상 URL, 유튜브 주소도 된다).
 */
import step01 from "@/assets/handwrap/step01.webp";
import step02 from "@/assets/handwrap/step02.webp";
import step03 from "@/assets/handwrap/step03.webp";
import step04 from "@/assets/handwrap/step04.webp";
import step05 from "@/assets/handwrap/step05.webp";
import step06 from "@/assets/handwrap/step06.webp";
import step07 from "@/assets/handwrap/step07.webp";
import step08 from "@/assets/handwrap/step08.webp";
import step09 from "@/assets/handwrap/step09.webp";
import step10 from "@/assets/handwrap/step10.webp";
import step11 from "@/assets/handwrap/step11.webp";
import step12 from "@/assets/handwrap/step12.webp";
import step13 from "@/assets/handwrap/step13.webp";
import step14 from "@/assets/handwrap/step14.webp";

/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

/**
 * 그림 속 감기는 손 — 1인칭으로 내려다본 오른손(엄지가 왼쪽, 롤은 왼손이 잡음).
 * 화면에서 다른 손을 고르면 사진과 화살표를 함께 좌우로 뒤집어 보여 준다. 그림을 왼손 사진으로 바꾸면 이것도 "left".
 */
export const HANDWRAP_PHOTO_HAND: "left" | "right" = "right";

/**
 * 그림 위 화살표 — 좌표계는 viewBox 0 0 120 98 (그림 가로:세로 = 120:98, 가운데 맞춤으로 덮는다).
 * d = 감는 길(끝에 화살촉), (sx, sy) = 시작점, (tx, ty, tr) = 붕대가 들어갈·나올 곳(없으면 tr 0).
 */
export interface WrapArrow {
  d: string;
  sx: number;
  sy: number;
  tx?: number;
  ty?: number;
  tr?: number;
}

export interface HandWrapStep {
  title: string;
  body: string;
  /** 그림 아래 칩 (예: 손목 1바퀴) */
  chip?: string;
  photo: string;
  /** 감는 방향 — 감지 않는 단계(접기 등)는 없음 */
  arrow?: WrapArrow;
}

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "붕대 끝 잡기",
    body: "손바닥을 내 쪽으로 펴고, 붕대 끝을 검지와 중지 사이에 끼워 잡아요.",
    photo: step01,
    arrow: { d: "M46 62 Q54 46 61 32", sx: 46, sy: 62, tx: 62, ty: 28, tr: 5 },
  },
  {
    title: "손가락 벌려 감기",
    body: "나머지 손가락을 넓게 벌리고 네 손가락을 함께 감아요. 손가락을 넓게 벌려야 패드가 주먹을 다 덮을 만큼 커져요.",
    chip: "남자 2~3바퀴 · 여자 3~4바퀴",
    photo: step02,
    arrow: { d: "M38 48 Q62 42 86 36 Q92 28 84 22", sx: 38, sy: 48 },
  },
  {
    title: "조심해서 빼기",
    body: "감은 고리가 풀리지 않게 손가락 끝 쪽으로 조심해서 빼요.",
    photo: step03,
    arrow: { d: "M52 36 Q50 24 48 13", sx: 52, sy: 36 },
  },
  {
    title: "한 번 접어 패드 만들기",
    body: "뺀 고리를 납작하게 눌러 펴고, 두 손가락 정도 남기고 한 번 접어 두툼한 주먹 패드를 만들어요.",
    photo: step04,
  },
  {
    title: "주먹 위에 올리기",
    body: "엄지로 패드를 잡고 주먹 마디(정권) 위에 올려요. 패드가 주먹보다 커서 마디를 다 덮어야 해요.",
    chip: "패드는 주먹보다 크게",
    photo: step05,
    arrow: { d: "M58 72 Q60 60 62 49", sx: 58, sy: 72, tx: 63, ty: 42, tr: 8 },
  },
  {
    title: "끝 라인 2번 감아 고정",
    body: "패드가 밀리지 않게, 패드 위아래 끝 라인을 따라 손을 깔끔하게 2번 감아요.",
    chip: "2바퀴로 고정",
    photo: step06,
    arrow: { d: "M30 66 Q60 58 88 52 Q94 44 86 36", sx: 30, sy: 66 },
  },
  {
    title: "손목 1바퀴",
    body: "손등을 비스듬히 내려가 손목을 한 바퀴 감아요.",
    chip: "손목 1바퀴",
    photo: step07,
    arrow: { d: "M62 50 Q74 56 84 64 Q90 73 80 78 Q66 80 58 72", sx: 62, sy: 50 },
  },
  {
    title: "새끼손가락 쪽 → 엄지 사이",
    body: "손목에서 손등을 비스듬히 올라가 새끼손가락 쪽으로 들어가고, 손바닥을 돌아 엄지와 검지 사이로 나와요. 그다음 손목을 한 바퀴 감아요.",
    chip: "손목 1바퀴",
    photo: step08,
    arrow: { d: "M64 62 Q78 50 90 40", sx: 64, sy: 62, tx: 52, ty: 43, tr: 5 },
  },
  {
    title: "검지 쪽 → 엄지 사이",
    body: "같은 방법으로 이번엔 검지 쪽으로 들어가 엄지와 검지 사이로 나와요. 손등에 X자가 생겨요. 그다음 손목 한 바퀴.",
    chip: "손목 1바퀴",
    photo: step09,
    arrow: { d: "M84 62 Q70 50 56 38", sx: 84, sy: 62, tx: 47, ty: 44, tr: 5 },
  },
  {
    title: "중지 쪽 → 엄지 사이",
    body: "마지막으로 중지 쪽으로 들어가 엄지와 검지 사이로 나와요. 그다음 손목 한 바퀴.",
    chip: "손목 1바퀴",
    photo: step10,
    arrow: { d: "M66 74 Q66 54 66 34", sx: 66, sy: 74, tx: 48, ty: 44, tr: 5 },
  },
  {
    title: "남은 붕대는 손목에",
    body: "남은 붕대는 손목에 전부 감아요. 손목이 단단하게 잡혀요.",
    photo: step11,
    arrow: { d: "M58 66 Q76 60 92 66 Q96 76 86 82 Q72 86 58 78", sx: 58, sy: 66 },
  },
  {
    title: "벨크로 붙이고 손바닥 정리",
    body: "벨크로(찍찍이)를 손목 바깥쪽(손등 쪽)에 꾹 눌러 붙이고, 손바닥 쪽 주름을 펴서 정리해요.",
    chip: "벨크로 마무리",
    photo: step12,
    arrow: { d: "M58 78 Q64 73 69 70", sx: 58, sy: 78, tx: 73, ty: 68, tr: 6 },
  },
];

/** 한눈에 요약 줄 (예전 이름 그대로 — 화면이 이 이름으로 읽는다) */
export const HANDWRAP_WRIST_TOTAL = "주먹 패드 → 2바퀴 고정 → 새끼·검지·중지 쪽 (지날 때마다 손목 1바퀴) → 벨크로";

/** 다 감은 뒤(완성 화면) */
export const HANDWRAP_DONE = {
  title: "완성!",
  body: "주먹을 꽉 쥐었다 펴 보세요. 마디가 푹신하고 손목이 단단하면 잘 감긴 거예요. 너무 느슨하거나 너무 꽉 감지 않게 여러 번 연습해요 — 손끝이 저리거나 하얘지면 풀고 다시 감아요.",
  photos: [step14, step13] as const,
} as const;

export interface HandWrapMistake {
  wrong: string;
  fix: string;
}

export const HANDWRAP_MISTAKES: readonly HandWrapMistake[] = [
  { wrong: "손가락을 오므리고 감아요", fix: "손가락을 넓게 벌리고 감아야 패드가 커져서 주먹 마디를 다 덮어요." },
  { wrong: "패드를 올리고 바로 손목으로 가요", fix: "패드 위아래 끝 라인을 2번 감아 고정해야 칠 때 패드가 밀리지 않아요." },
  { wrong: "있는 힘껏 세게 감아요", fix: "손끝이 저리거나 하얘지면 바로 풀고 다시 — 너무 느슨하지도, 너무 꽉 조이지도 않게." },
  { wrong: "벨크로를 손목 안쪽(손바닥 쪽)에 붙여요", fix: "벨크로는 손목 바깥쪽(손등 쪽)에 붙여야 장갑 안에서 쓸리지 않아요." },
  { wrong: "붕대가 꼬이거나 주름진 채로 감아요", fix: "붕대를 평평하게 펴면서 감고, 마지막에 손바닥 쪽도 펴서 정리해요." },
];

/** 영상 플레이어 아래 '핵심 포인트' */
export const HANDWRAP_KEY_POINTS: readonly string[] = [
  "검지·중지로 끝 잡기 → 손가락 벌려 감기(남자 2~3 · 여자 3~4바퀴) → 빼서 한 번 접기",
  "패드를 주먹 위에 → 끝 라인 2번 감아 고정 → 손목 1바퀴",
  "새끼 → 검지 → 중지 쪽으로 들어가 엄지 사이로 나오기, 지날 때마다 손목 1바퀴",
  "남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 손바닥 정리",
];
