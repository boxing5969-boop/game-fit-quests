/**
 * 153마인드셋 기기 기록 — 계정별로 나뉘는지 (2026-10-19 검수: 가족이 폰 하나를 같이 쓰면
 * 앞사람이 인터넷 없이 남긴 기록이 다음 사람 계정에 올라갈 수 있었다)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getSession: () => getSession() },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import { fetchMindsetStats, logMindsetSession, saveMindsetProfile } from "./mindsetService";

const offline = () => {
  rpc.mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
};
const serverStats = {
  streak: 0, done_today: false, week_count: 0, total_sessions: 0, total_minutes: 0, rated: 0,
  vivid_recent: 0, vivid_first: 0, by_session: {}, recent: [], goal: null, cue: null,
};
const online = () => {
  rpc.mockImplementation(() => Promise.resolve({ data: { ...serverStats }, error: null }));
};
const signedIn = (uid: string | null) => {
  getSession.mockResolvedValue({ data: { session: uid ? { user: { id: uid } } : null } });
};
const uploads = () => rpc.mock.calls.filter((c) => c[0] === "log_mindset_session_v2");
const session = { sessionId: "pre-fight", durationSec: 200, completed: true, vividness: 4 };

beforeEach(() => {
  window.localStorage.clear();
  rpc.mockReset();
  getSession.mockReset();
});

describe("153마인드셋 기기 기록 — 계정별", () => {
  it("인터넷 없이 남긴 기록은 그 계정 통계에만 보인다", async () => {
    offline();
    signedIn("A");
    const mine = await logMindsetSession("A", session);
    expect(mine.local).toBe(true);
    expect(mine.total_sessions).toBe(1);
    const other = await fetchMindsetStats("B");
    expect(other.total_sessions).toBe(0);
  });

  it("다른 계정으로 로그인하면 앞사람이 못 올린 기록을 올리지 않는다", async () => {
    offline();
    signedIn("A");
    await logMindsetSession("A", session);
    rpc.mockReset();
    online();
    signedIn("B");
    await fetchMindsetStats("B");
    expect(uploads()).toHaveLength(0);
    // 주인이 다시 들어오면 그때 올린다
    signedIn("A");
    await fetchMindsetStats("A");
    expect(uploads()).toHaveLength(1);
    expect(uploads()[0][1]).toMatchObject({ p_session_id: "pre-fight", p_completed: true });
  });

  it("올리는 도중 계정이 바뀌면 멈춘다", async () => {
    offline();
    signedIn("A");
    await logMindsetSession("A", session);
    rpc.mockReset();
    online();
    signedIn("B"); // 화면은 A 인데 실제 로그인은 B
    await fetchMindsetStats("A");
    expect(uploads()).toHaveLength(0);
  });

  it("주인을 알 수 없는 개편 전 기록은 계정에 올리지 않는다", async () => {
    window.localStorage.setItem(
      "myboxer.visualization.records",
      JSON.stringify([{ sessionId: "old", completedAt: new Date().toISOString(), reflection: "옛 기록" }]),
    );
    online();
    signedIn("A");
    await fetchMindsetStats("A");
    expect(uploads()).toHaveLength(0);
    offline();
    expect((await fetchMindsetStats("A")).total_sessions).toBe(0);
  });

  it("목표 · 한마디는 계정마다 따로 저장된다", async () => {
    offline();
    const saved = await saveMindsetProfile("A", { goal: "다음 시합 3라운드 완주", cue: "끝까지" });
    expect(saved.synced).toBe(false);
    expect((await fetchMindsetStats("A")).goal).toBe("다음 시합 3라운드 완주");
    expect((await fetchMindsetStats("B")).goal).toBeNull();
    expect((await fetchMindsetStats("B")).cue).toBeNull();
  });

  it("서버가 거절한 기록은 기기에도 남기지 않고 이유를 그대로 알린다", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "오늘은 기록을 충분히 남겼어요. 내일 또 해요" } });
    signedIn("A");
    await expect(logMindsetSession("A", session)).rejects.toThrow("오늘은 기록을 충분히 남겼어요");
    offline();
    expect((await fetchMindsetStats("A")).total_sessions).toBe(0);
  });
});
