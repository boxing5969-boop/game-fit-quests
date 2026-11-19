import { beforeEach, describe, expect, it } from "vitest";
import {
  INBOX_PATH,
  INBOX_RETURN_TTL_MS,
  clearInboxReturn,
  historyIdx,
  inboxFresh,
  inboxReturnClaims,
  markInboxOpened,
  moveInboxReturn,
  noteInboxLocation,
  openWithInboxBelow,
  readInboxReturn,
  readInboxSeen,
  rememberInboxOpen,
  shouldReturnToInbox,
  writeInboxSeen,
} from "@/lib/inboxReturn";

const NOW = Date.parse("2026-11-19T10:00:00+09:00");

beforeEach(() => {
  sessionStorage.clear();
  noteInboxLocation(null);
});

describe("알림함 돌아가기 기록", () => {
  it("알림을 열 때 알림함 칸 · 그 위 칸 · 보던 자리를 적는다", () => {
    rememberInboxOpen(4, 812.6, NOW);
    expect(readInboxReturn(NOW)).toEqual({ inbox: 4, target: 5, at: NOW, scrollY: 813 });
  });

  it("30분이 지나면 기록이 없다 · 지운다", () => {
    rememberInboxOpen(4, 0, NOW);
    expect(readInboxReturn(NOW + INBOX_RETURN_TTL_MS - 1)).not.toBeNull();
    expect(readInboxReturn(NOW + INBOX_RETURN_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem("153inbox:return")).toBeNull();
  });

  it("칸 번호가 없으면 적지 않는다 · 망가진 값은 없는 것으로", () => {
    rememberInboxOpen(null, 0, NOW);
    expect(readInboxReturn(NOW)).toBeNull();
    sessionStorage.setItem("153inbox:return", "{nope");
    expect(readInboxReturn(NOW)).toBeNull();
    sessionStorage.setItem("153inbox:return", JSON.stringify({ inbox: 3, target: 3, at: NOW }));
    expect(readInboxReturn(NOW)).toBeNull();
  });

  it("알림함으로 다시 열면 새 칸으로 옮긴다 (보던 자리 그대로)", () => {
    rememberInboxOpen(2, 300, NOW);
    const r = readInboxReturn(NOW)!;
    moveInboxReturn(r, 1, NOW + 1000);
    expect(readInboxReturn(NOW + 1000)).toEqual({ inbox: 1, target: 2, at: NOW + 1000, scrollY: 300 });
    clearInboxReturn();
    expect(readInboxReturn(NOW)).toBeNull();
  });
});

describe("알림함으로 돌려보낼까", () => {
  const r = { inbox: 1, target: 2, at: NOW, scrollY: 0 };

  it("크롬 — 연 알림에서 뒤로 → 알림함 칸에 바로 떨어지면 아무것도 안 한다", () => {
    expect(shouldReturnToInbox(r, 2, 1)).toBe(false);
  });

  it("알림함을 건너뛰고 첫 화면(더 아래 칸)에 떨어지면 알림함으로", () => {
    expect(shouldReturnToInbox(r, 2, 0)).toBe(true);
  });

  it("연 알림에서 더 들어간 화면에서 건너뛰어도 알림함으로", () => {
    expect(shouldReturnToInbox(r, 5, 0)).toBe(true);
  });

  it("알림함에서 뒤로(홈) · 앞으로 가기 · 기록 없음 · 칸 번호 없음은 그대로", () => {
    expect(shouldReturnToInbox(r, 1, 0)).toBe(false);
    expect(shouldReturnToInbox(r, 0, 1)).toBe(false);
    expect(shouldReturnToInbox(null, 2, 0)).toBe(false);
    expect(shouldReturnToInbox(r, null, 0)).toBe(false);
    expect(shouldReturnToInbox(r, 2, null)).toBe(false);
  });

  it("종료 확인(androidBackExit)이 먼저 물어볼 때 — 바로 앞 화면 번호와 떨어진 칸으로 판단", () => {
    rememberInboxOpen(1, 0);
    noteInboxLocation(2);
    expect(inboxReturnClaims({ idx: 0 })).toBe(true);
    expect(inboxReturnClaims({ idx: 1 })).toBe(false);
    expect(inboxReturnClaims(null)).toBe(false);
    noteInboxLocation(1);
    expect(inboxReturnClaims({ idx: 0 })).toBe(false);
  });

  it("라우터 state 의 idx 만 칸 번호로 본다", () => {
    expect(historyIdx({ usr: null, key: "a", idx: 3 })).toBe(3);
    expect(historyIdx({ idx: "3" })).toBeNull();
    expect(historyIdx(null)).toBeNull();
  });
});

describe("휴대폰 알림을 눌러 연 화면 — 아래에 알림함", () => {
  const fakeNav = () => {
    const calls: string[] = [];
    const nav = (to: string) => {
      calls.push(to);
      const idx = (historyIdx() ?? 0) + 1;
      window.history.pushState({ usr: null, key: String(idx), idx }, "", to);
    };
    return { calls, nav };
  };

  it("다른 화면이면 알림함을 깔고 그 위에 연다 · 알림함 칸을 적는다", () => {
    window.history.replaceState({ usr: null, key: "h", idx: 0 }, "", "/home");
    const { calls, nav } = fakeNav();
    openWithInboxBelow(nav, "/mypage?cheers=1", "/home");
    expect(calls).toEqual([INBOX_PATH, "/mypage?cheers=1"]);
    const r = readInboxReturn()!;
    expect(r.inbox).toBe(1);
    expect(r.target).toBe(2);
    expect(r.scrollY).toBe(0);
  });

  it("이미 알림함이면 그 위에 바로 · 링크가 알림함이면 알림함만", () => {
    window.history.replaceState({ usr: null, key: "n", idx: 3 }, "", INBOX_PATH);
    const a = fakeNav();
    openWithInboxBelow(a.nav, "/membership", INBOX_PATH);
    expect(a.calls).toEqual(["/membership"]);
    expect(readInboxReturn()!.inbox).toBe(3);
    sessionStorage.clear();
    const b = fakeNav();
    openWithInboxBelow(b.nav, INBOX_PATH, "/home");
    expect(b.calls).toEqual([INBOX_PATH]);
    expect(readInboxReturn()).toBeNull();
  });
});

describe("본 것 — 돌아와도 아직 안 연 새 알림 표시", () => {
  it("처음 열면 지금 안 읽은 것이 새 알림", () => {
    const { fresh, seen } = inboxFresh(null, ["a", "b", "c"], NOW);
    expect([...fresh]).toEqual(["a", "b", "c"]);
    expect(seen).toEqual({ fresh: ["a", "b", "c"], opened: [], at: NOW });
  });

  it("하나 열고 돌아오면(서버는 다 읽음) 그때의 새 알림 − 연 것 · 그 사이 새로 온 것은 더한다", () => {
    const first = inboxFresh(null, ["a", "b", "c"], NOW).seen;
    const after = markInboxOpened(first, "b", NOW + 1000);
    const back = inboxFresh(after, ["d"], NOW + 2000);
    expect([...back.fresh].sort()).toEqual(["a", "c", "d"]);
    expect(back.seen.opened).toEqual(["b"]);
  });

  it("계정마다 · 30분 · 망가진 값", () => {
    writeInboxSeen("u1", { fresh: ["a"], opened: [], at: NOW });
    expect(readInboxSeen("u1", NOW)?.fresh).toEqual(["a"]);
    expect(readInboxSeen("u2", NOW)).toBeNull();
    expect(readInboxSeen("u1", NOW + INBOX_RETURN_TTL_MS + 1)).toBeNull();
    expect(readInboxSeen(null, NOW)).toBeNull();
    sessionStorage.setItem("153inbox:seen:u3", JSON.stringify({ fresh: [1, "x", "x"], opened: "no", at: NOW }));
    expect(readInboxSeen("u3", NOW)).toEqual({ fresh: ["x"], opened: [], at: NOW });
  });
});
