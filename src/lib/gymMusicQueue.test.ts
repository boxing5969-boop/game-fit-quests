import { describe, expect, it } from "vitest";
import type { GymTrack } from "@/data/gymMusic";
import { GYM_MUSIC, GYM_MUSIC_CATS, gymMixLength } from "@/data/gymMusic";
import { artistKey, buildQueue, retryDelayMs, watchdogAction, type WatchInput } from "./gymMusicQueue";
import { YT_STATE } from "./youtubeIframeApi";

/** 시험용 고정 난수 */
const seeded = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const T = (id: string, a: string): GymTrack => ({ id, t: id, a, c: "pop", m: 60 });

describe("153플레이 복싱 음악 목록", () => {
  it("모두 30분 이상인 모음집 · 유튜브 id 형식 · 겹치는 것 없음", () => {
    expect(GYM_MUSIC.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(GYM_MUSIC.map((t) => t.id));
    expect(ids.size).toBe(GYM_MUSIC.length);
    for (const t of GYM_MUSIC) {
      expect(t.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(t.t.trim()).not.toBe("");
      expect(t.a.trim()).not.toBe("");
      expect(Number.isInteger(t.m) && t.m >= 30).toBe(true);
    }
  });

  it("길이 글 — 분 · 시간", () => {
    expect(gymMixLength(59)).toBe("59분");
    expect(gymMixLength(60)).toBe("1시간");
    expect(gymMixLength(95)).toBe("1시간 35분");
    expect(gymMixLength(180)).toBe("3시간");
  });

  it("모든 곡이 정해진 카테고리에 들어 있고, 카테고리마다 곡이 있다", () => {
    const keys = new Set(GYM_MUSIC_CATS.map((c) => c.key));
    for (const t of GYM_MUSIC) expect(keys.has(t.c)).toBe(true);
    for (const c of GYM_MUSIC_CATS) expect(GYM_MUSIC.filter((t) => t.c === c.key).length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildQueue — 섞기", () => {
  it("모든 곡이 한 번씩 들어간다", () => {
    const q = buildQueue(GYM_MUSIC, { rng: seeded(7) });
    expect(q).toHaveLength(GYM_MUSIC.length);
    expect(new Set(q).size).toBe(GYM_MUSIC.length);
  });

  it("같은 가수가 연달아 나오지 않게 떼어 놓는다(가능할 때)", () => {
    const list = [
      T("a1", "BTS"), T("a2", "BTS"), T("a3", "BTS"),
      T("b1", "Queen"), T("b2", "Queen"), T("c1", "Avicii"), T("c2", "Avicii"), T("d1", "PSY"), T("e1", "AC/DC"),
    ];
    for (let s = 1; s < 200; s++) {
      const q = buildQueue(list, { rng: seeded(s) });
      expect(new Set(q).size).toBe(list.length);
      const artists = q.map((id) => list.find((t) => t.id === id)!.a);
      const pairs = artists.slice(1).filter((a, i) => a === artists[i]).length;
      expect(pairs).toBe(0);
    }
  });

  it("실제 곡 목록도 같은 가수가 붙지 않는다", () => {
    for (let s = 1; s < 50; s++) {
      const q = buildQueue(GYM_MUSIC, { rng: seeded(s) });
      const art = q.map((id) => artistKey(GYM_MUSIC.find((t) => t.id === id)!.a));
      expect(art.slice(1).filter((x, i) => x === art[i]).length).toBe(0);
    }
  });

  it("startWith 곡이 맨 앞", () => {
    const q = buildQueue(GYM_MUSIC, { rng: seeded(3), startWith: GYM_MUSIC[42].id });
    expect(q[0]).toBe(GYM_MUSIC[42].id);
  });

  it("다시 섞을 때 방금 들은 곡(avoidFirst)이 첫 곡이 되지 않는다", () => {
    const list = [T("x", "A"), T("y", "B"), T("z", "C")];
    for (let s = 1; s < 40; s++) {
      const q = buildQueue(list, { rng: seeded(s), avoidFirst: "x" });
      expect(q[0]).not.toBe("x");
      expect(new Set(q).size).toBe(3);
    }
  });

  it("artistKey — 함께한 가수는 앞 이름만", () => {
    expect(artistKey("ROSÉ & Bruno Mars")).toBe(artistKey("ROSÉ"));
    expect(artistKey("Martin Garrix")).toBe("martingarrix");
    expect(artistKey("Dimitri Vegas & Like Mike, Martin Garrix")).toBe("dimitrivegas");
  });
});

describe("watchdogAction — 멈춤 감시", () => {
  const base: WatchInput = {
    state: YT_STATE.PLAYING, inStateMs: 0, stuckMs: 0, sinceLoadMs: 0,
    resumeTries: 0, reloadTries: 0, everPlayed: true, userPaused: false,
  };

  it("사람이 일시정지했으면 아무것도 안 한다", () => {
    expect(watchdogAction({ ...base, state: YT_STATE.PAUSED, inStateMs: 60_000, userPaused: true })).toBe("none");
  });

  it("저절로 멈추면 3초 뒤 다시 재생, 세 번 넘게 안 되면 같은 곡 다시 받기 → 그래도 안 되면 다음 곡", () => {
    const p = { ...base, state: YT_STATE.PAUSED };
    expect(watchdogAction({ ...p, inStateMs: 2_000 })).toBe("none");
    expect(watchdogAction({ ...p, inStateMs: 4_000 })).toBe("resume");
    expect(watchdogAction({ ...p, inStateMs: 4_000, resumeTries: 3 })).toBe("reload");
    expect(watchdogAction({ ...p, inStateMs: 4_000, resumeTries: 3, reloadTries: 2 })).toBe("skip");
  });

  it("한 곡도 소리 나게 못 틀었는데 멈춰 있으면 — 브라우저 자동재생 막힘 → 한 번 더 해 보고 화면 눌러 달라", () => {
    const cold = { ...base, everPlayed: false };
    expect(watchdogAction({ ...cold, state: YT_STATE.UNSTARTED, sinceLoadMs: 5_000 })).toBe("none");
    expect(watchdogAction({ ...cold, state: YT_STATE.UNSTARTED, sinceLoadMs: 7_000 })).toBe("resume");
    expect(watchdogAction({ ...cold, state: YT_STATE.UNSTARTED, sinceLoadMs: 9_000, resumeTries: 1 })).toBe("needTap");
    expect(watchdogAction({ ...cold, state: YT_STATE.PAUSED, inStateMs: 4_000 })).toBe("resume");
    expect(watchdogAction({ ...cold, state: YT_STATE.PAUSED, inStateMs: 9_000, resumeTries: 1 })).toBe("needTap");
  });

  it("재생 중인데 시간이 안 가도 광고일 수 있어 150초까지는 기다린다", () => {
    expect(watchdogAction({ ...base, stuckMs: 120_000 })).toBe("none");
    expect(watchdogAction({ ...base, stuckMs: 151_000 })).toBe("reload");
    expect(watchdogAction({ ...base, stuckMs: 151_000, reloadTries: 2 })).toBe("skip");
  });

  it("버퍼링 45초 넘으면 다음 곡 · 시작 전 30초 넘으면 다음 곡(이미 한 곡 이상 틀었을 때)", () => {
    expect(watchdogAction({ ...base, state: YT_STATE.BUFFERING, inStateMs: 30_000 })).toBe("none");
    expect(watchdogAction({ ...base, state: YT_STATE.BUFFERING, inStateMs: 46_000 })).toBe("skip");
    expect(watchdogAction({ ...base, state: YT_STATE.UNSTARTED, sinceLoadMs: 12_000 })).toBe("resume");
    expect(watchdogAction({ ...base, state: YT_STATE.CUED, sinceLoadMs: 31_000, resumeTries: 2 })).toBe("skip");
  });

  it("곡이 끝났는데 3초 넘게 그대로면 다음 곡", () => {
    expect(watchdogAction({ ...base, state: YT_STATE.ENDED, inStateMs: 1_000 })).toBe("none");
    expect(watchdogAction({ ...base, state: YT_STATE.ENDED, inStateMs: 4_000 })).toBe("skip");
  });
});

describe("retryDelayMs — 연달아 실패하면 천천히", () => {
  it("인터넷이 끊기면 목록을 다 태우지 않게 점점 길게 기다린다", () => {
    expect(retryDelayMs(1)).toBeLessThan(2_000);
    expect(retryDelayMs(5)).toBe(15_000);
    expect(retryDelayMs(8)).toBe(30_000);
    expect(retryDelayMs(20)).toBe(60_000);
  });
});
