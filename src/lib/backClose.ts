/**
 * 뒤로가기 = 창 닫기 (2026-11-17 대표님 「훈련탭에서 영상 클릭후 뒤로가기버튼 누르면 홈화면으로 나가져서 불편해」)
 *
 * 문제: 영상 · 카드 시트 · 훈련 탭 안 화면(레벨 자세히 · 내 레벨 연습하기)은 주소가 안 바뀌는 '창'이라
 *       휴대폰 뒤로가기(안드로이드 뒤로 단추 · 아이폰 앱 밀어서 뒤로)를 누르면 창이 닫히는 대신 앞 화면(홈)으로 나갔다.
 *
 * 원리
 *   · 창이 열리면 같은 주소로 기록 한 칸을 얹는다 — 라우터 state(usr · key · idx)를 그대로 복사하고 표시 `__bc` = 창 번호.
 *   · 뒤로가기 → 그 칸이 빠지며 popstate → 내려온 칸보다 위에 열려 있던 창을 닫는다(주소가 같아 라우터는 같은 화면 그대로).
 *   · 창을 단추로 닫으면(✕ · 바깥 누르기 · 저장) → 얹었던 칸을 history.back() 으로 걷는다.
 *       같은 순간 다른 화면으로 이동했을 수 있어 한 박자 뒤(setTimeout 0)에, 지금 칸이 아직 내 칸일 때만 걷는다
 *       (안 그러면 방금 이동한 화면을 뒤로가기가 되돌린다).
 *   · 창을 닫자마자 다른 창을 열면 걷지 않고 그 칸을 새 창이 이어받는다(replaceState) — 칸이 쌓이지 않게.
 *   · 내 칸이 다른 칸 밑에 깔린 채 창이 닫히면(창 안에서 다른 화면으로 이동 · 아래 창이 먼저 닫힘) 그 칸은 '빈 칸'으로 남는다.
 *     뒤로가기로 빈 칸에 내려오면 한 번 더 뒤로 가서 건너뛴다(같은 화면이 한 번 더 보이지 않게).
 *     앞으로가기로 들어온 빈 칸은 그대로 둔다(라우터 idx · 창 번호로 방향을 본다).
 *
 * 창 번호는 열 때의 시각에서 시작해 늘어난다 — 새로고침 뒤에도 예전 칸보다 크고, 살아 있지 않은 번호는 모두 빈 칸이다.
 * androidBackExit(홈에서 '종료할까요?')와 함께 쓴다: 창을 닫는 뒤로가기에는 묻지 않도록 backCloseClaims 로 알려 준다.
 * 쓰는 곳: hooks/useBackClose · useModalDismiss(…, { back: true }) · DmSheet backClose
 */

const KEY = "__bc";

interface Layer {
  id: number;
  close: () => void;
}

interface Pos {
  idx: number | null;
  m: number | null;
}

/** 열린 창 — 번호 오름차순(맨 끝이 맨 위) */
const live: Layer[] = [];
let seq = 0;
let bound = false;
/** 단추로 닫혀 걷기를 기다리는 칸 */
let releaseId: number | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
/** 우리가 부른 history.back() 이 아직 popstate 로 안 돌아온 수 */
let selfPops = 0;
let selfTimer: ReturnType<typeof setTimeout> | null = null;
/** 지금 서 있는 칸(방향 판단용) */
let pos: Pos | null = null;
/** 마지막으로 처리한 popstate — androidBackExit 가 같은 이벤트를 물을 때 */
let lastEvent: Event | null = null;
let lastClaimed = false;

type StateObj = Record<string, unknown>;

const readState = (): StateObj | null => {
  try {
    const s = window.history.state as unknown;
    return s && typeof s === "object" ? (s as StateObj) : null;
  } catch {
    return null;
  }
};

const markerOf = (s: StateObj | null): number | null => {
  const v = s?.[KEY];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const idxOf = (s: StateObj | null): number | null => {
  const v = s?.idx;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const posOf = (s: StateObj | null): Pos => ({ idx: idxOf(s), m: markerOf(s) });

const isLive = (m: number): boolean => live.some((l) => l.id === m);

/** 앞 칸 → 뒤 칸이 뒤로 간 것인가. 모르면 뒤로로 본다(휴대폰은 거의 늘 뒤로). */
function isBackward(prev: Pos | null, next: Pos): boolean {
  if (!prev || prev.idx === null || next.idx === null) return true;
  if (next.idx !== prev.idx) return next.idx < prev.idx;
  // 같은 화면 안 — 창 칸은 그 화면 칸 위에 쌓인다(표시 없음 = 맨 아래)
  return (next.m ?? -1) <= (prev.m ?? -1);
}

/** 이 칸에 내려오면 창이 닫히거나(위에 열린 창) 빈 칸을 건너뛰는가 — 바꾸지 않고 보기만 */
function wouldClaim(next: Pos): boolean {
  if (next.m !== null && !isLive(next.m)) return true;
  return live.some((l) => next.m === null || l.id > next.m);
}

function goBack(): void {
  selfPops += 1;
  if (selfTimer) clearTimeout(selfTimer);
  selfTimer = setTimeout(() => {
    selfPops = 0;
    selfTimer = null;
  }, 1500);
  try {
    window.history.back();
  } catch {
    selfPops = Math.max(0, selfPops - 1);
  }
}

function takeSelfPop(): boolean {
  if (selfPops <= 0) return false;
  selfPops -= 1;
  return true;
}

function clearRelease(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  releaseId = null;
}

function scheduleRelease(id: number): void {
  clearRelease();
  releaseId = id;
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    const rid = releaseId;
    releaseId = null;
    if (rid === null) return;
    const s = readState();
    // 그사이 다른 화면으로 이동했거나(새 칸) 이미 뒤로 갔으면 걷지 않는다 — 남은 칸은 나중 뒤로가기가 건너뛴다
    if (markerOf(s) !== rid) {
      pos = posOf(s);
      return;
    }
    goBack();
  }, 0);
}

function onPop(e: Event): void {
  const s = readState();
  const next = posOf(s);
  const self = takeSelfPop();
  const backward = self || isBackward(pos, next);
  pos = next;
  lastEvent = e;
  // 우리가 부른 뒤로가기(칸 걷기 · 빈 칸 건너뛰기)도 우리 몫이다
  lastClaimed = self || wouldClaim(next);

  // 1) 내려온 칸보다 위에 열려 있던 창을 닫는다 (맨 위부터)
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i];
    if (next.m !== null && l.id <= next.m) break;
    live.splice(i, 1);
    try {
      l.close();
    } catch {
      /* 창 하나가 실패해도 나머지는 닫는다 */
    }
  }

  // 2) 빈 칸에 뒤로 내려왔으면 한 번 더 뒤로
  if (next.m !== null && !isLive(next.m) && backward) goBack();
}

function bind(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  pos = posOf(readState());
  window.addEventListener("popstate", onPop);
}

/**
 * 창을 열 때 — 같은 주소로 기록 한 칸을 얹고 창 번호를 돌려준다(못 얹으면 0).
 * @param close 뒤로가기로 닫힐 때 부를 함수
 */
export function openBackLayer(close: () => void): number {
  if (typeof window === "undefined" || !window.history) return 0;
  // 액자(iframe) 안의 앱은 부모 창 방문 기록에 섞이므로 칸을 얹지 않는다 (androidBackExit 와 같은 까닭)
  try {
    if (window.self !== window.top) return 0;
  } catch {
    return 0;
  }
  bind();
  if (seq === 0) seq = Date.now();
  seq += 1;
  const id = seq;
  const s = readState();
  const next = { ...(s ?? {}), [KEY]: id };
  try {
    if (releaseId !== null && markerOf(s) === releaseId) {
      // 방금 단추로 닫힌 창의 칸 — 걷지 않고 새 창이 이어받는다
      clearRelease();
      window.history.replaceState(next, "", window.location.href);
    } else {
      window.history.pushState(next, "", window.location.href);
    }
  } catch {
    return 0;
  }
  live.push({ id, close });
  pos = { idx: idxOf(s), m: id };
  return id;
}

/**
 * 창이 단추로 닫히거나 화면에서 사라질 때 — 뒤로가기로 이미 닫힌 창이면 아무것도 안 한다.
 */
export function closeBackLayer(id: number): void {
  if (!id) return;
  const i = live.findIndex((l) => l.id === id);
  if (i < 0) return;
  live.splice(i, 1);
  const s = readState();
  if (markerOf(s) === id) scheduleRelease(id);
  else pos = posOf(s); // 내 칸이 다른 칸 밑에 깔렸거나 바뀌었다 — 빈 칸은 나중 뒤로가기가 건너뛴다
}

/**
 * 이 popstate 가 창을 닫거나 빈 칸을 건너뛰는 뒤로가기인가 — androidBackExit 가 '종료할까요?'를 묻기 전에 본다.
 * 어느 쪽 popstate 손잡이가 먼저 돌든 같은 답을 준다.
 */
export function backCloseClaims(e: Event): boolean {
  if (e === lastEvent) return lastClaimed;
  if (!bound) return false;
  return selfPops > 0 || wouldClaim(posOf(readState()));
}

/** 시험 전용 — 열린 창 수 */
export const __backCloseLiveCount = (): number => live.length;

/** 시험 전용 — 모듈 상태를 처음으로 */
export function __resetBackClose(): void {
  live.length = 0;
  clearRelease();
  selfPops = 0;
  if (selfTimer) clearTimeout(selfTimer);
  selfTimer = null;
  lastEvent = null;
  lastClaimed = false;
  pos = bound ? posOf(readState()) : null;
}
