/**
 * 🏢 지점 회의실 사무실 그림 위 자리 좌표 (2026-10-27 · 지점 회의실 1단계)
 *
 *   그림: public/assets/office/office-153.webp (1080×1350 · 4:5, ElevenLabs gpt-image-2.5 로 그림 — Higgsfield 크레딧 부족)
 *   좌표는 그림 위 % (x = 왼쪽에서, y = 위에서). 그림을 바꾸면 이 표도 그림을 보고 다시 맞춘다.
 *
 *   책상 자리 앵커 = 의자 가운데 x · 책상 윗면 시작 y. 캐릭터는 앵커 위로 그리고 아래(clip 밖)는 잘라
 *   책상 뒤에 앉은 것처럼 보인다(모니터가 캐릭터 앞에 남는다). 회의실 앞줄은 잘라서 탁자 뒤, 뒷줄(그림 아래)은 통째로.
 */

export interface OfficeSpot {
  /** 앵커 x (%) */
  x: number;
  /** 앵커 y (%) — 캐릭터 보이는 부분의 아래쪽 끝 */
  y: number;
  /** 캐릭터 너비 (그림 너비의 %) */
  w: number;
  /** 캐릭터 그림에서 보이는 위쪽 비율 (1 = 통째로) */
  clip: number;
}

export interface OfficeDesk extends OfficeSpot {
  /** 책상 이름표 자리 (%) */
  tag: { x: number; y: number };
}

export const OFFICE_ART = {
  src: "/assets/office/office-153.webp",
  srcSmall: "/assets/office/office-153-sm.webp",
  /** 가로:세로 */
  ratio: 4 / 5,
} as const;

/** 그림에서 보이는 영역 (% — x · y 는 왼쪽 위, w · h 는 너비 · 높이). 작게 잡으면 그만큼 크게 보인다 */
export interface OfficeView {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 사무실 전체 */
export const OFFICE_VIEW_ALL: OfficeView = { x: 0, y: 0, w: 100, h: 100 };
/** 회의실만 크게 (회의 화면 — 2026-10-27 대표님 "회의실 화면을 보면서 채팅 · 말풍선으로 대화") — 1.25배, 앞줄 머리 위로 말풍선 두세 개 자리 */
export const OFFICE_VIEW_MEETING: OfficeView = { x: 10, y: 52, w: 80, h: 42 };

/** 보이는 영역의 가로:세로 (그림 1080×1350 기준) */
export const officeViewAspect = (v: OfficeView) => (v.w * 1080) / (v.h * 1350);

/** 문 (들어오고 나가는 곳 — 발판) */
export const OFFICE_DOOR = { x: 6, y: 39.5 } as const;

/** 회의실 위 '회의 중' 표시 자리 */
export const OFFICE_MEETING_LABEL = { x: 50, y: 66 } as const;

const DESK_W = 12.5;
const DESK_CLIP = 0.62;

/** 자리 이름(서버 office_seats.seat) → 책상 */
export const OFFICE_DESKS: Record<string, OfficeDesk> = {
  // 대표 책상 — 대표님 전용
  boss: { x: 50, y: 15, w: 14.5, clip: DESK_CLIP, tag: { x: 50, y: 21.6 } },
  // 지점장 책상 — 첫 줄 가운데
  mgr: { x: 50, y: 27.3, w: DESK_W, clip: DESK_CLIP, tag: { x: 50, y: 31.9 } },
  // 코치 책상 8 — 첫 줄 왼쪽 · 오른쪽, 둘째 줄, 셋째 줄
  c1: { x: 29.5, y: 27.3, w: DESK_W, clip: DESK_CLIP, tag: { x: 29.5, y: 31.9 } },
  c2: { x: 70.6, y: 27.3, w: DESK_W, clip: DESK_CLIP, tag: { x: 70.6, y: 31.9 } },
  c3: { x: 28.9, y: 40, w: DESK_W, clip: DESK_CLIP, tag: { x: 28.9, y: 44.5 } },
  c4: { x: 50, y: 40, w: DESK_W, clip: DESK_CLIP, tag: { x: 50, y: 44.5 } },
  c5: { x: 71.6, y: 40, w: DESK_W, clip: DESK_CLIP, tag: { x: 71.6, y: 44.5 } },
  c6: { x: 28.2, y: 53, w: DESK_W, clip: DESK_CLIP, tag: { x: 28.2, y: 57.6 } },
  c7: { x: 50, y: 53, w: DESK_W, clip: DESK_CLIP, tag: { x: 50, y: 57.6 } },
  c8: { x: 71.8, y: 53, w: DESK_W, clip: DESK_CLIP, tag: { x: 71.8, y: 57.6 } },
  // 자리가 모자랄 때 — 오른쪽 벽 · 문 옆에 선다
  x1: { x: 87, y: 38, w: 10.5, clip: 1, tag: { x: 87, y: 39.6 } },
  x2: { x: 87, y: 50, w: 10.5, clip: 1, tag: { x: 87, y: 51.6 } },
  x3: { x: 87, y: 62, w: 10.5, clip: 1, tag: { x: 87, y: 63.6 } },
  x4: { x: 13, y: 62, w: 10.5, clip: 1, tag: { x: 13, y: 63.6 } },
};

/** 자리가 없는 사람(12명 넘음)이 서는 곳 — 문 옆 */
export const OFFICE_STANDING: OfficeSpot = { x: 13, y: 50, w: 10.5, clip: 1 };

const MEET_W = 11;
/** 회의 탁자 자리 — 들어온 순서대로: 앞줄 가운데부터 바깥으로, 다음 뒷줄 */
export const OFFICE_MEETING_SEATS: OfficeSpot[] = [
  { x: 50.2, y: 77.5, w: MEET_W, clip: DESK_CLIP },
  { x: 41.5, y: 77.5, w: MEET_W, clip: DESK_CLIP },
  { x: 58.9, y: 77.5, w: MEET_W, clip: DESK_CLIP },
  { x: 32.5, y: 77.5, w: MEET_W, clip: DESK_CLIP },
  { x: 67.8, y: 77.5, w: MEET_W, clip: DESK_CLIP },
  { x: 50.2, y: 92, w: MEET_W, clip: 1 },
  { x: 41.2, y: 92, w: MEET_W, clip: 1 },
  { x: 58.9, y: 92, w: MEET_W, clip: 1 },
  { x: 32.2, y: 92, w: MEET_W, clip: 1 },
  { x: 67.8, y: 92, w: MEET_W, clip: 1 },
];

/** 탁자 자리가 다 차면 — 회의실 빈 바닥에 선다 */
export const OFFICE_MEETING_OVERFLOW: OfficeSpot[] = [
  { x: 20, y: 90, w: 10, clip: 1 },
  { x: 80, y: 90, w: 10, clip: 1 },
  { x: 20, y: 80, w: 10, clip: 1 },
  { x: 80, y: 80, w: 10, clip: 1 },
];

export const meetingSpot = (index: number): OfficeSpot =>
  OFFICE_MEETING_SEATS[index] ?? OFFICE_MEETING_OVERFLOW[(index - OFFICE_MEETING_SEATS.length) % OFFICE_MEETING_OVERFLOW.length];

export const deskSpot = (seat: string | null | undefined): OfficeSpot => (seat && OFFICE_DESKS[seat]) || OFFICE_STANDING;
