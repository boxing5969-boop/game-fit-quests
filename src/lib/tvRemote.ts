/**
 * 📺 라이브보드 TV 화면 바꾸기 (2026-11-08 대표님 「라이브보드 탭에서 내가 버튼을 누르면 라이브보드 변경 가능하게해줘 모든 모드 별로」)
 *   TV 번호(slot) = TV 를 켜는 주소 끝 번호 — 1 · 2 · 3 = /tv/<지점>/1 · /2 · /3, 4 = 번호 없는 /tv/<지점>(전체 한 화면).
 *   관리자 앱 › 라이브보드(LiveBoardPickerPage)에서 TV 번호마다 화면(mode)을 고르면 그 TV 가 몇 초 안에 넘어가고
 *   다시 바꿀 때까지 그대로다(TV 를 껐다 켜도). 'home' = 그 번호의 원래 화면 — 153 PB 측정 자동 전환은 이때만.
 *   번호와 다른 화면을 보여 주는 동안은 주소에 ?tv=<번호> 를 붙여 자기 번호를 잊지 않는다(20분 새로고침에도).
 *   서버: tv_board_modes · board_tv_mode · set_tv_board_mode (supabase/migrations/20261108192720_tv_board_modes.sql)
 */

export type TvSlot = "1" | "2" | "3" | "4";
export type TvScreen = "1" | "2" | "3" | "4" | "pb1" | "pb2";
export type TvModeSetting = "home" | TvScreen;

export const TV_SLOTS: readonly TvSlot[] = ["1", "2", "3", "4"];

/** 고를 수 있는 화면 — 라이브보드 화면 버튼 순서 */
export const TV_SCREENS: readonly { id: TvScreen; label: string; short: string }[] = [
  { id: "1", label: "지금 운동 중", short: "운동 중" },
  { id: "2", label: "런칭 이벤트", short: "이벤트" },
  { id: "3", label: "회원 안내", short: "회원 안내" },
  { id: "4", label: "전체 한 화면", short: "전체" },
  { id: "pb1", label: "153 PB 코스", short: "PB 코스" },
  { id: "pb2", label: "153 PB 기록", short: "PB 기록" },
];

export const tvScreenLabel = (s: string | null | undefined): string => TV_SCREENS.find((x) => x.id === s)?.label ?? "—";

export const isTvSlot = (v: unknown): v is TvSlot => v === "1" || v === "2" || v === "3" || v === "4";
export const isTvScreen = (v: unknown): v is TvScreen => isTvSlot(v) || v === "pb1" || v === "pb2";

/** 채널 — 서버가 화면을 바꾸면 이름 없는 신호(event 'mode', payload {slot, t}) */
export const tvModeChannel = (branchName: string) => `tv-mode:${branchName}`;

/** 그 번호에서 지금 보여야 할 화면 */
export const tvDesired = (slot: TvSlot, mode: TvModeSetting | null | undefined): TvScreen =>
  !mode || mode === "home" ? slot : mode;

/** 주소 — '4' 는 번호 없는 원래 주소 */
export const tvRouteFor = (branch: string, screen: TvScreen): string => (screen === "4" ? `/tv/${branch}` : `/tv/${branch}/${screen}`);

/** 주소에 ?tv= 가 있으면 그 번호, 없으면 이 화면의 원래 번호 */
export const tvSlotFrom = (search: string, natural: TvSlot | null): TvSlot | null => {
  const t = new URLSearchParams(search).get("tv");
  return isTvSlot(t) ? t : natural;
};

/** 화면의 원래 번호 — pb1 · pb2 는 1 · 2번 TV 짝 (자동 전환과 같은 짝) */
export const tvNaturalSlot = (screen: TvScreen): TvSlot => (screen === "pb1" ? "1" : screen === "pb2" ? "2" : screen);

/** 넘어갈 때 쿼리 — 열쇠(?k=) · lite 같은 것은 그대로 · auto(자동 전환 표시)는 뺀다 · 원래 화면이 아니면 tv=<번호> */
export const tvSearchFor = (search: string, slot: TvSlot, screen: TvScreen): string => {
  const sp = new URLSearchParams(search);
  sp.delete("auto");
  if (screen === slot) sp.delete("tv");
  else sp.set("tv", slot);
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/** TV 가 알려 준 지 3분 안이면 켜져 있다고 본다 (TV 는 1분마다 알린다) */
export const TV_ONLINE_MS = 3 * 60_000;

export interface TvSlotState {
  slot: TvSlot;
  mode: TvModeSetting;
  setAt: string | null;
  setBy: string | null;
  showing: TvScreen | null;
  seenAt: string | null;
}

export const normalizeTvModes = (data: unknown): TvSlotState[] => {
  const slots = (data as { slots?: unknown } | null)?.slots;
  const rows = Array.isArray(slots) ? (slots as Record<string, unknown>[]) : [];
  return TV_SLOTS.map((slot) => {
    const r = rows.find((x) => x?.slot === slot) ?? {};
    const mode = r.mode === "home" || isTvScreen(r.mode) ? (r.mode as TvModeSetting) : "home";
    return {
      slot,
      mode,
      setAt: typeof r.set_at === "string" ? r.set_at : null,
      setBy: typeof r.set_by === "string" ? r.set_by : null,
      showing: isTvScreen(r.showing) ? r.showing : null,
      seenAt: typeof r.seen_at === "string" ? r.seen_at : null,
    };
  });
};

export const tvOnline = (s: Pick<TvSlotState, "seenAt">, now: number): boolean =>
  !!s.seenAt && now - Date.parse(s.seenAt) <= TV_ONLINE_MS;

/** 앱 화면 줄 — 켜져 있는지 · 지금 무엇을 보여 주는지 · 바꾸는 중인지 */
export const tvStatusLine = (s: TvSlotState, now: number): { online: boolean; text: string; pending: boolean } => {
  const desired = tvDesired(s.slot, s.mode);
  if (!s.seenAt) return { online: false, text: "아직 이 번호로 켠 TV가 없어요", pending: false };
  const online = tvOnline(s, now);
  if (!online) {
    const min = Math.max(1, Math.round((now - Date.parse(s.seenAt)) / 60_000));
    const ago = min < 60 ? `${min}분 전` : min < 60 * 24 ? `${Math.round(min / 60)}시간 전` : `${Math.round(min / 1440)}일 전`;
    return { online: false, text: `꺼져 있어요 · 마지막 ${ago}`, pending: false };
  }
  const pending = s.showing !== desired;
  return { online: true, text: pending ? "바꾸는 중…" : `지금 ${tvScreenLabel(s.showing)}`, pending };
};

/** 화면에 보일 TV 줄 — 1 · 2번은 늘, 3 · 4번은 켠 적이 있거나 화면을 골라 둔 것만 */
export const tvVisibleSlots = (states: TvSlotState[]): TvSlotState[] =>
  states.filter((s) => s.slot === "1" || s.slot === "2" || !!s.seenAt || s.mode !== "home");
