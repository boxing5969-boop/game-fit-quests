import { describe, expect, it } from "vitest";
import {
  buildSummaryPrompt,
  cleanSummaryLines,
  kstHHMM,
  parseSummaryJson,
  talkCount,
  type Minutes,
} from "../../supabase/functions/office-summary/summary";

const minutes = (messages: Minutes["messages"]): Minutes => ({
  meeting: {
    title: "11월 신규 회원 맞이",
    agenda: ["첫 수업 인사", "붕대 감아 드리기"],
    opened_at: "2026-10-27T07:16:00Z",
    attendees: [
      { name: "이용희", title: "대표" },
      { name: "재현", title: "코치" },
    ],
  },
  messages,
});

const at = (min: number) => new Date(Date.UTC(2026, 9, 27, 7, 16 + min)).toISOString();

describe("오삼코치 3줄 요약 — 프롬프트", () => {
  it("시스템 줄은 빼고 시각 · 이름 · 정한 것을 붙인다", () => {
    const m = minutes([
      { kind: "system", body: "이용희 대표님이 회의를 열었어요", created_at: at(0), author: { name: "이용희", title: "대표" } },
      { kind: "chat", body: "첫 수업 때\n붕대를  직접 감아 드리면 좋겠어요", created_at: at(1), author: { name: "재현", title: "코치" } },
      { kind: "decision", body: "첫 수업 회원은 코치가 붕대를 감아 드린다", created_at: at(3), author: { name: "이용희", title: "대표" } },
    ]);
    expect(talkCount(m)).toBe(2);
    const p = buildSummaryPrompt(m);
    expect(p).toContain("[회의] 11월 신규 회원 맞이");
    expect(p).toContain("[안건] 1. 첫 수업 인사 / 2. 붕대 감아 드리기");
    expect(p).toContain("[참석] 2명 — 이용희 대표, 재현 코치");
    expect(p).toContain("[정한 것]\n1. 첫 수업 회원은 코치가 붕대를 감아 드린다");
    expect(p).toContain("16:17 재현 코치: 첫 수업 때 붕대를 직접 감아 드리면 좋겠어요");
    expect(p).toContain("16:19 이용희 대표 [정한 것]:");
    expect(p).not.toContain("회의를 열었어요");
  });

  it("길면 앞부분을 덜어 내고 덜어 냈다고 적는다", () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({
      kind: "chat",
      body: `${i}번째 이야기 `.repeat(5),
      created_at: at(i),
      author: { name: "재현", title: "코치" },
    }));
    const p = buildSummaryPrompt(minutes(msgs), 600);
    expect(p).toMatch(/앞부분 \d+줄은 길어서 뺐어요/);
    expect(p).toContain("49번째 이야기");
    expect(p).not.toContain(" 0번째 이야기");
  });

  it("한국 시각으로 적는다", () => {
    expect(kstHHMM("2026-10-27T15:05:00Z")).toBe("00:05");
    expect(kstHHMM("엉뚱한 값")).toBe("");
  });
});

describe("오삼코치 3줄 요약 — 답 검사", () => {
  it("이모지 · 기호 · 앞 번호를 빼고 빈 줄은 버린다", () => {
    expect(
      cleanSummaryLines({
        line1: "1. 신규 회원 첫 수업 맞이를 **이야기**했어요 🥊",
        line2: "  ",
        line3: "- 붕대는 코치가 감아 드리기로 했어요",
      }),
    ).toEqual(["신규 회원 첫 수업 맞이를 이야기했어요", "붕대는 코치가 감아 드리기로 했어요"]);
  });

  it("숫자로 시작하는 문장은 그대로 둔다", () => {
    expect(cleanSummaryLines({ line1: "3명이 수업 뒤 1분 인사를 맡기로 했어요", line2: "", line3: "" })).toEqual([
      "3명이 수업 뒤 1분 인사를 맡기로 했어요",
    ]);
  });

  it("한 줄은 100자까지", () => {
    const [line] = cleanSummaryLines({ line1: "가".repeat(150), line2: "", line3: "" });
    expect(Array.from(line).length).toBe(100);
    expect(line.endsWith("…")).toBe(true);
  });

  it("모양이 틀리면 빈 목록", () => {
    expect(cleanSummaryLines(null)).toEqual([]);
    expect(cleanSummaryLines({ line1: 3 })).toEqual([]);
    expect(parseSummaryJson('앞말 {"line1":"가","line2":"","line3":""} 뒷말')).toEqual({ line1: "가", line2: "", line3: "" });
    expect(parseSummaryJson("JSON 아님")).toBeNull();
  });
});
