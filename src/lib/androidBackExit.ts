/**
 * 안드로이드 뒤로가기 — 홈에서 앱이 그냥 꺼지는 것을 막는다.
 *
 * 문제: 홈 화면에서 네비게이션바 뒤로가기를 누르면 아무 확인 없이 앱이 종료된다.
 *       회원이 실수로 나가면 다시 켜서 로그인 상태를 확인해야 하고, 하던 걸 잃는다.
 *
 * 원리
 *   진입:  [E0 home] → sentinel 하나를 얹는다 → [E0, E1(marker)]  현재=E1
 *   판정:  뒤로가기로 떨어진 항목이
 *            · marker 가 있으면        → 하위 화면에서 홈으로 돌아온 것. 묻지 않는다.
 *            · marker 가 없고 **홈 경로**면 → 더 갈 곳이 없다. 종료를 묻는다.
 *            · 그 외(하위 경로)          → 평범한 뒤로가기. 라우터에 맡긴다.
 *
 * ⚠️ marker 유무만으로 판정하면 안 된다.
 *    react-router 가 push 한 하위 화면 항목도 우리 marker 가 없어서
 *    2단계 깊이에서 뒤로가기 한 번에 "종료할까요?"가 뜬다(시뮬레이션으로 재현함).
 *    그래서 **경로까지** 같이 본다.
 */
const MARKER = "__abx";

let armed = false;
let bound = false;
let askFn: (() => void) | null = null;
let homeSet = new Set<string>(["/"]);

const norm = (p: string): string => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
const atHome = (): boolean => {
  try { return homeSet.has(norm(window.location.pathname)); } catch { return false; }
};

function arm(): void {
  try {
    const s = window.history.state as Record<string, unknown> | null;
    if (s && s[MARKER]) { armed = true; return; }   // 이미 sentinel 위에 있다
    window.history.pushState({ ...(s ?? {}), [MARKER]: Date.now() }, "", window.location.href);
    armed = true;
  } catch {
    /* 무시 — 못 쌓아도 앱 동작에는 지장 없다 */
  }
}

function onPop(): void {
  const s = window.history.state as Record<string, unknown> | null;
  if (s && s[MARKER]) return;      // 홈으로 돌아온 것 — 묻지 않는다
  if (!atHome()) return;           // 하위 화면 이동 — 라우터가 처리
  if (!askFn) return;
  try { askFn(); } catch { /* 무시 */ }
  arm();                            // 다시 무장 — 안 하면 다음 뒤로가기에 그대로 꺼진다
}

/**
 * 앱 루트에서 한 번만 호출한다.
 * @param onAsk     종료 확인 팝업을 여는 함수
 * @param homePaths 홈으로 볼 경로들(기본 "/"). 로그인 후 첫 화면이 따로 있으면 같이 넣는다.
 */
export function initBackExit(onAsk: () => void, homePaths: string[] = ["/"]): void {
  if (typeof window === "undefined") return;
  askFn = onAsk;
  homeSet = new Set(homePaths.map(norm));
  if (!bound) {
    bound = true;
    window.addEventListener("popstate", onPop);
    // PWA 재개·bfcache 복원 시 sentinel 이 사라졌을 수 있어 재무장
    window.addEventListener("pageshow", () => { armed = false; arm(); });
  }
  if (!armed) arm();
}

/**
 * 실제 종료.
 * 우리가 얹은 sentinel 때문에 back 한 번으로는 못 나가므로,
 * ① window.close()(설치형 PWA 일부에서 즉시 닫힘) → ② 안 되면 sentinel+진입항목을 지나쳐 뒤로.
 */
export function exitApp(): void {
  window.removeEventListener("popstate", onPop);
  try { window.close(); } catch { /* 무시 */ }
  window.setTimeout(() => {
    try { window.history.go(-2); } catch { /* 무시 */ }
    // 브라우저 탭이라 안 닫혔으면 원상 복구(앱이 먹통처럼 보이면 안 된다)
    window.setTimeout(() => {
      window.addEventListener("popstate", onPop);
      armed = false; arm();
    }, 700);
  }, 40);
}
