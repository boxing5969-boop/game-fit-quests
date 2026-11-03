import { describe, expect, it } from "vitest";
import { parseClaim, pickClaim, voiceTitle } from "../../supabase/functions/member-voice-receipt/logic.ts";
import { voiceNotice } from "../../supabase/functions/survey-auto-reply/logic.ts";
import { isWaiting, mergeInbox } from "@/lib/memberVoiceInbox";

describe("고객의 소리 영수증 (2026-11-03 대표님 '고객의 소리에도 답변')", () => {
  it("보낸 값 확인 — 워커와 같은 규칙", () => {
    expect(parseClaim({ slug: "abc", category: "complaint", content: "  샤워실 온수가 약해요  ", rating: 3 })).toEqual({
      slug: "abc",
      category: "complaint",
      content: "샤워실 온수가 약해요",
      rating: 3,
    });
    expect(parseClaim({ slug: "abc", category: "free", content: "좋아요" })?.rating).toBeNull();
    expect(parseClaim({ slug: "abc", category: "circuit", content: "좋아요" })).toBeNull(); // 서키트는 앱에서 안 낸다
    expect(parseClaim({ slug: "abc", category: "free", content: "a" })).toBeNull(); // 2자 미만
    expect(parseClaim({ slug: "abc", category: "free", content: "좋아요", rating: 6 })).toBeNull();
    expect(parseClaim({ slug: "", category: "free", content: "좋아요" })).toBeNull();
    expect(parseClaim(null)).toBeNull();
  });

  it("하나뿐일 때만 고른다 — 같은 별점 · 아직 영수증 없음", () => {
    const rows = [
      { id: "a", rating: 5 },
      { id: "b", rating: null },
    ];
    expect(pickClaim(rows, 5, new Set())).toEqual({ id: "a", reason: "ok" });
    expect(pickClaim(rows, null, new Set())).toEqual({ id: "b", reason: "ok" });
    expect(pickClaim(rows, 4, new Set())).toEqual({ id: null, reason: "not_found" });
    expect(pickClaim(rows, 5, new Set(["a"]))).toEqual({ id: null, reason: "not_found" }); // 이미 남긴 줄
    // 같은 글이 10분 안에 두 번(다른 사람) — 고르지 않는다(다른 회원에게 답이 가지 않게)
    expect(pickClaim([{ id: "a", rating: null }, { id: "c", rating: null }], null, new Set())).toEqual({ id: null, reason: "ambiguous" });
    expect(pickClaim([{ id: "a", rating: null }, { id: "c", rating: null }], null, new Set(["a"]))).toEqual({ id: "c", reason: "ok" });
  });

  it("제목", () => {
    expect(voiceTitle("coach_praise")).toBe("고객의 소리 · 코치 칭찬");
    expect(voiceTitle("weird")).toBe("고객의 소리 · 의견");
  });
});

describe("고객의 소리 알림 — 대표님께 하나로 묶어서", () => {
  it("1건 — 지점 · 분류 · 글 앞부분 · 앱이면 '답변하면 그 회원에게'", () => {
    const n = voiceNotice([{ category: "complaint", content: "샤워실\n온수가   약해요", branch: "선릉역점", fromApp: true }]);
    expect(n?.title).toBe("📋 고객의 소리가 왔어요");
    expect(n?.body).toBe("선릉역점 · 불편·건의 · “샤워실 온수가 약해요” · 답변하면 그 회원에게 가요");
    const qr = voiceNotice([{ category: "free", content: "굿", branch: "", fromApp: false }]);
    expect(qr?.body).toBe("자유 한마디 · “굿”");
  });

  it("여러 건 — 건수와 분류별 수", () => {
    const n = voiceNotice([
      { category: "coach_praise", content: "a", branch: "선릉역점", fromApp: true },
      { category: "coach_praise", content: "b", branch: "선릉역점", fromApp: false },
      { category: "complaint", content: "c", branch: "선릉역점", fromApp: true },
    ]);
    expect(n).toEqual({ title: "📋 고객의 소리 3건이 답변을 기다려요", body: "코치 칭찬 2 · 불편·건의 1" });
    expect(voiceNotice([])).toBeNull();
  });
});

describe("받은 설문함 — 한 목록 (2026-11-03 탭 두 개 → 하나)", () => {
  it("만족도 조사 · 고객의 소리를 최근 것부터 섞는다", () => {
    const s = (id: string, at: string) => ({ id, at, branch: null, title: "만족도 조사", anonymous: true, who: null, avg: 5, answers: [] });
    const v = (id: string, at: string) => ({
      id,
      at,
      branch: null,
      category: "free",
      rating: null,
      content: "x",
      coach: null,
      draw: false,
      who: null,
      phone: null,
      status: "new",
    });
    const merged = mergeInbox(
      [s("s1", "2026-11-03T08:40:00+00:00"), s("s2", "2026-11-01T01:00:00+00:00")],
      [v("v1", "2026-11-03T07:59:05.231988+00:00"), v("v2", "2026-11-02T20:43:08+00:00")],
    );
    expect(merged.map((m) => m.id)).toEqual(["s1", "v1", "v2", "s2"]);
    expect(merged[1].kind).toBe("voice");
  });

  it("답변 대기 = 앱에서 보냈고 답이 없음", () => {
    expect(isWaiting({ response_id: "a", reply: null, replied_at: null, read_at: null, from_app: true })).toBe(true);
    expect(isWaiting({ response_id: "a", reply: "감사합니다", replied_at: "x", read_at: null, from_app: true })).toBe(false);
    expect(isWaiting({ response_id: "a", reply: null, replied_at: null, read_at: null, from_app: false })).toBe(false); // QR 은 답해도 못 감
    expect(isWaiting(undefined)).toBe(false);
  });
});
