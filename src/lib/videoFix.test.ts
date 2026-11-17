import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIX_CATS,
  fixCounts,
  fixDraftError,
  fixesForCard,
  fixLine,
  fmtSec,
  parseSecInput,
  parseVideoFixList,
  type VideoFixDraft,
} from "@/lib/videoFix";

const SQL = readFileSync("supabase/migrations/20261117112356_training_video_fix.sql", "utf8");

const fixRow = (o: Record<string, unknown> = {}) => ({
  id: "f1",
  card_id: "c1",
  card_name: "어퍼컷",
  video_path: "member/a.mp4",
  at_sec: "4.26",
  from_sec: null,
  to_sec: null,
  motion: "훅",
  cat: "motion",
  body: "이 영상은 훅이에요",
  held: true,
  held_video_path: "member/a.mp4",
  held_poster_path: "member/poster-a.webp",
  state: "requested",
  reply: "",
  by_name: "대표님",
  created_at: "2026-11-17T02:00:00Z",
  done_at: null,
  ...o,
});

describe("영상 고쳐 주세요 — 목록 읽기", () => {
  it("can_edit 이 아니면 빈 목록", () => {
    expect(parseVideoFixList({ can_edit: false })).toEqual({ canEdit: false, fixes: [], candidates: [] });
    expect(parseVideoFixList(null).canEdit).toBe(false);
  });

  it("모양이 틀린 줄은 버리고 숫자 · 빈 값을 다듬는다", () => {
    const d = parseVideoFixList({
      can_edit: true,
      fixes: [fixRow(), fixRow({ id: "", cat: "motion" }), fixRow({ id: "f3", cat: "x" }), fixRow({ id: "f4", state: "lost" })],
      candidates: [
        { id: "v1", card_id: "c1", card_name: "어퍼컷", video_path: "member/n.mp4", poster_path: null, note: "다시", fix_ids: ["f1", 3], state: "review" },
        { id: "v2", card_id: "c1", video_path: "", state: "review" },
      ],
    });
    expect(d.canEdit).toBe(true);
    expect(d.fixes).toHaveLength(1);
    expect(d.fixes[0]).toMatchObject({ atSec: 4.26, held: true, heldVideoPath: "member/a.mp4", cat: "motion", state: "requested" });
    expect(d.candidates).toEqual([
      expect.objectContaining({ id: "v1", fixIds: ["f1"], posterPath: null, state: "review", decidedNote: "" }),
    ]);
  });

  it("카드 하나 — 열린 요청 · 숨긴 영상 · 확인할 새 영상 · 숫자", () => {
    const d = parseVideoFixList({
      can_edit: true,
      fixes: [
        fixRow(),
        fixRow({ id: "f2", held: false, held_video_path: null, state: "doing", cat: "cut", from_sec: 5, to_sec: 12, motion: "" }),
        fixRow({ id: "f3", held: false, state: "done", reply: "고쳤어요" }),
        fixRow({ id: "f4", card_id: "c2", held: false, state: "requested" }),
        fixRow({ id: "f5", held: false, state: "canceled" }),
      ],
      candidates: [
        { id: "v1", card_id: "c1", video_path: "member/n.mp4", state: "review", fix_ids: [] },
        { id: "v2", card_id: "c1", video_path: "member/o.mp4", state: "approved", fix_ids: [] },
      ],
    });
    const c1 = fixesForCard(d, "c1");
    expect(c1.open.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(c1.held?.id).toBe("f1");
    expect(c1.review.map((c) => c.id)).toEqual(["v1"]);
    expect(c1.done.map((f) => f.id)).toEqual(["f3"]);
    expect(fixesForCard(d, null).open).toEqual([]);
    expect(fixCounts(d)).toEqual({ open: 3, review: 1 });
    expect(fixCounts(null)).toEqual({ open: 0, review: 0 });
  });
});

describe("영상 고쳐 주세요 — 보내기 검사 (서버와 같은 말)", () => {
  const base: VideoFixDraft = { cat: "motion", motion: "훅", body: "", atSec: 4, fromSec: null, toSec: null };
  it("되는 것 · 안 되는 것", () => {
    expect(fixDraftError(base)).toBeNull();
    expect(fixDraftError({ ...base, cat: null })).toBe("고칠 곳 종류가 맞지 않아요");
    expect(fixDraftError({ ...base, motion: "  ", body: "  " })).toBe("무엇을 고칠지 한 줄 써 주세요");
    expect(fixDraftError({ ...base, body: "가".repeat(301) })).toBe("300자까지 써 주세요");
    expect(fixDraftError({ ...base, motion: "훅".repeat(21) })).toBe("동작 이름이 너무 길어요");
    expect(fixDraftError({ ...base, atSec: -1 })).toBe("시간이 맞지 않아요");
    expect(fixDraftError({ ...base, fromSec: Number.NaN })).toBe("시간이 맞지 않아요");
    expect(fixDraftError({ ...base, cat: "cut", fromSec: 8, toSec: 5 })).toBe("구간이 맞지 않아요");
    expect(fixDraftError({ ...base, cat: "cut", motion: "", body: "옆에서 찍은 부분만", fromSec: 5, toSec: 12 })).toBeNull();
  });

  it("검사 말 · 칸 이름이 마이그레이션 글과 같다", () => {
    for (const msg of [
      "고칠 곳 종류가 맞지 않아요",
      "무엇을 고칠지 한 줄 써 주세요",
      "300자까지 써 주세요",
      "동작 이름이 너무 길어요",
      "시간이 맞지 않아요",
      "구간이 맞지 않아요",
    ]) {
      expect(SQL).toContain(msg);
    }
    for (const c of FIX_CATS) expect(SQL).toContain(`'${c.id}'`);
  });
});

describe("시간 글", () => {
  it("fmtSec · parseSecInput", () => {
    expect(fmtSec(4.9)).toBe("0:04");
    expect(fmtSec(65)).toBe("1:05");
    expect(fmtSec(null)).toBe("");
    expect(parseSecInput("1:05")).toBe(65);
    expect(parseSecInput("65")).toBe(65);
    expect(parseSecInput("1분 5초")).toBe(65);
    expect(parseSecInput("12초")).toBe(12);
    expect(parseSecInput("")).toBeNull();
    expect(Number.isNaN(parseSecInput("abc"))).toBe(true);
  });

  it("요청 한 줄 — 시각 · 실제 동작 · 글 / 구간", () => {
    expect(fixLine({ atSec: 4.2, fromSec: null, toSec: null, motion: "훅", cat: "motion", body: "이 영상은 훅이에요" })).toBe(
      "0:04 · 실제 동작 훅 · 이 영상은 훅이에요",
    );
    expect(fixLine({ atSec: 3, fromSec: 5, toSec: null, motion: "", cat: "cut", body: "옆에서  찍은 부분" })).toBe("0:05~끝 · 이 구간만 써요 · 옆에서 찍은 부분");
  });
});
