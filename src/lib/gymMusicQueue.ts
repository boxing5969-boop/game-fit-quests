/**
 * 153플레이 「복싱 음악」 — 체육관 자동재생의 순서 · 멈춤 감시 규칙 (화면 없이 시험할 수 있는 부분만)
 *
 * 2026-11-11 대표님: "체육관에 자동재생해놓을거야 광고도 없고 멈추지도 않게"
 *   · 순서: 고른 카테고리 곡을 섞어 끝까지 → 다시 섞어 끝없이. 같은 가수가 연달아 나오지 않게,
 *     다시 섞을 때 방금 들은 곡이 첫 곡이 되지 않게.
 *   · 멈춤 감시: 2초마다 플레이어 상태를 보고 '다시 재생 · 같은 곡 다시 받기 · 다음 곡 · 화면 눌러 달라'를 정한다.
 *     광고가 나오는 동안에도 상태는 '재생 중'일 수 있어서, 재생 중인데 시간이 안 가는 경우는 넉넉히(150초) 기다린다.
 */
import type { GymTrack } from "@/data/gymMusic";
import { YT_STATE } from "@/lib/youtubeIframeApi";

export type Rng = () => number;

/** 섞은 재생 순서(유튜브 id 목록) */
export function buildQueue(
  tracks: GymTrack[],
  opts: { rng?: Rng; avoidFirst?: string | null; startWith?: string | null } = {},
): string[] {
  const rng = opts.rng ?? Math.random;
  const ids = tracks.map((t) => t.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const artist = new Map(tracks.map((t) => [t.id, artistKey(t.a)]));
  const a = (id: string | undefined) => (id ? artist.get(id) : undefined);
  // 섞은 순서에서 하나씩 꺼내되, 바로 앞 곡과 같은 가수는 건너뛴다.
  // 남은 곡의 절반 이상이 한 가수면 그 가수를 먼저 놓는다(안 그러면 끝에 몰려 붙는다).
  const rest = ids.splice(0, ids.length);
  while (rest.length) {
    const last = a(ids[ids.length - 1]);
    const counts = new Map<string | undefined, number>();
    for (const id of rest) counts.set(a(id), (counts.get(a(id)) ?? 0) + 1);
    let top: string | undefined;
    let topN = 0;
    counts.forEach((n, k) => { if (k !== last && n > topN) { top = k; topN = n; } });
    let at = topN >= Math.ceil(rest.length / 2) ? rest.findIndex((id) => a(id) === top) : -1;
    if (at < 0) at = rest.findIndex((id) => a(id) !== last);
    if (at < 0) at = 0;
    ids.push(rest.splice(at, 1)[0]);
  }
  if (opts.startWith) {
    const at = ids.indexOf(opts.startWith);
    if (at > 0) ids.unshift(...ids.splice(at, 1));
  } else if (opts.avoidFirst && ids.length > 1 && ids[0] === opts.avoidFirst) {
    const k = ids.findIndex((id, idx) => idx > 0 && a(id) !== a(opts.avoidFirst ?? undefined));
    const swap = k > 0 ? k : 1;
    [ids[0], ids[swap]] = [ids[swap], ids[0]];
  }
  return ids;
}

/** 'ROSÉ & Bruno Mars' · 'Imagine Dragons' 같은 이름을 비교용으로 — 첫 이름만, 대소문자 · 띄어쓰기 무시 */
export function artistKey(name: string): string {
  return name.split(/\s*[&,]\s*|\s+(?:feat\.?|ft\.?|with|x)\s+/i)[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export type WatchAction = "none" | "resume" | "reload" | "skip" | "needTap";

export interface WatchInput {
  /** 유튜브 플레이어 상태 (YT_STATE) */
  state: number;
  /** 이 상태로 머문 시간(ms) */
  inStateMs: number;
  /** 재생 시간이 마지막으로 앞으로 간 뒤 지난 시간(ms) */
  stuckMs: number;
  /** 이 곡을 불러온 뒤 지난 시간(ms) */
  sinceLoadMs: number;
  /** 이 곡에서 '다시 재생'을 시도한 횟수 */
  resumeTries: number;
  /** 이 곡에서 '같은 곡 다시 받기'를 한 횟수 */
  reloadTries: number;
  /** 이번에 한 곡이라도 소리 나게 재생됐나 — 아니면 브라우저가 자동재생을 막았을 수 있다 */
  everPlayed: boolean;
  /** 사람이 일시정지 단추를 눌렀나 */
  userPaused: boolean;
}

/** 멈춤 감시 한 번 — 무엇을 할지 */
export function watchdogAction(w: WatchInput): WatchAction {
  if (w.userPaused) return "none";
  switch (w.state) {
    case YT_STATE.ENDED:
      // 끝나면 onStateChange 가 다음 곡으로 넘긴다 — 3초가 지나도 그대로면 감시가 넘긴다
      return w.inStateMs > 3_000 ? "skip" : "none";
    case YT_STATE.PLAYING:
      if (w.stuckMs <= 150_000) return "none";
      return w.reloadTries >= 2 ? "skip" : "reload";
    case YT_STATE.PAUSED:
      if (w.inStateMs <= 3_000) return "none";
      // 아직 한 번도 못 틀었으면 브라우저가 소리 나는 자동재생을 막은 것 — 한 번만 더 해 보고 화면을 눌러 달라고 한다
      if (!w.everPlayed) return w.resumeTries < 1 ? "resume" : "needTap";
      if (w.resumeTries < 3) return "resume";
      return w.reloadTries >= 2 ? "skip" : "reload";
    case YT_STATE.BUFFERING:
      return w.inStateMs > 45_000 ? "skip" : "none";
    default: // 시작 전(-1) · 대기(5)
      if (!w.everPlayed) {
        if (w.sinceLoadMs <= 6_000) return "none";
        return w.resumeTries < 1 ? "resume" : "needTap";
      }
      if (w.sinceLoadMs <= 10_000) return "none";
      if (w.resumeTries < 2) return "resume";
      return w.sinceLoadMs > 30_000 ? "skip" : "none";
  }
}

/** 연달아 실패한 횟수에 따라 다음 곡을 부르기 전 기다릴 시간 — 인터넷이 끊겼을 때 목록을 다 태우지 않게 */
export function retryDelayMs(consecutiveFails: number): number {
  if (consecutiveFails <= 3) return 800;
  if (consecutiveFails <= 6) return 15_000;
  if (consecutiveFails <= 9) return 30_000;
  return 60_000;
}
