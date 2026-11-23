import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_GUARDIAN_STATE,
  finishPromptDue,
  finishSnoozeKey,
  guardianInviteUrl,
  guardianShareText,
  isGuardianOnlyProfile,
  isGuardianToken,
  kidTodayLine,
  levelLine,
  minutesSince,
  minutesText,
  normalizeGuardianHome,
  normalizeGuardianState,
  pbText,
  visitLine,
} from "./guardian";

const T0 = Date.parse("2026-11-23T09:00:00Z"); // 18:00 KST
const at = (min: number) => T0 + min * 60_000;
const iso = new Date(T0).toISOString();

describe("normalizeGuardianState", () => {
  it("서버 값이 비거나 이상해도 꺼진 상태로", () => {
    expect(normalizeGuardianState(null)).toEqual(EMPTY_GUARDIAN_STATE);
    expect(normalizeGuardianState("x").on).toBe(false);
  });
  it("연결 목록 · 범위 밖 숫자 다듬기", () => {
    const s = normalizeGuardianState({
      on: true,
      is_member: true,
      prompt: true,
      prompt_min: 2,
      prompt_max_min: 999,
      snooze_min: null,
      links: [
        { id: "a", relation: "mom", status: "active", via: "child_invite", name: "가", since: "2026-11-20" },
        { id: "b", relation: "uncle", status: "pending", via: "desk_qr", name: "" },
        { id: "c", relation: "dad", status: "ended" },
        { relation: "dad", status: "active" },
      ],
    });
    expect(s.promptMin).toBe(10);
    expect(s.promptMaxMin).toBe(240);
    expect(s.snoozeMin).toBe(20);
    expect(s.links.map((l) => l.id)).toEqual(["a", "b"]);
    expect(s.links[1]).toMatchObject({ relation: "guardian", via: "desk_qr", name: "보호자" });
  });
});

describe("「운동을 끝낼까요?」 띄울 때", () => {
  const st = { prompt: true, promptMin: 50, promptMaxMin: 180 };
  const today = { checked_in: true, started_at: iso, finished: false };
  it("50분 전에는 안 · 50분부터 180분 전까지", () => {
    expect(finishPromptDue(st, today, at(49), null)).toBe(false);
    expect(finishPromptDue(st, today, at(50), null)).toBe(true);
    expect(finishPromptDue(st, today, at(179), null)).toBe(true);
    expect(finishPromptDue(st, today, at(180), null)).toBe(false);
  });
  it("끝 기록이 있거나 · 출석이 없거나 · 대상이 아니면 안", () => {
    expect(finishPromptDue(st, { ...today, finished: true }, at(60), null)).toBe(false);
    expect(finishPromptDue(st, { ...today, checked_in: false }, at(60), null)).toBe(false);
    expect(finishPromptDue({ ...st, prompt: false }, today, at(60), null)).toBe(false);
    expect(finishPromptDue(st, null, at(60), null)).toBe(false);
  });
  it("「아직 하는 중」 뒤에는 그 시각까지 안 · 알림으로 열면(force) 바로", () => {
    expect(finishPromptDue(st, today, at(60), at(80))).toBe(false);
    expect(finishPromptDue(st, today, at(80), at(80))).toBe(true);
    expect(finishPromptDue(st, today, at(60), at(80), true)).toBe(true);
    expect(finishPromptDue(st, today, at(30), null, true)).toBe(false);
  });
  it("미루기 칸은 그 출석 한 건에만", () => {
    expect(finishSnoozeKey("u1", "2026-11-23T09:00:12.345Z")).toBe(finishSnoozeKey("u1", "2026-11-23T09:00:59Z"));
    expect(finishSnoozeKey("u1", "2026-11-23T09:00:00Z")).not.toBe(finishSnoozeKey("u1", "2026-11-24T09:00:00Z"));
  });
  it("흐른 분", () => {
    expect(minutesSince(iso, at(62.9))).toBe(62);
    expect(minutesSince(null, at(1))).toBeNull();
    expect(minutesSince("nope", at(1))).toBeNull();
  });
});

describe("링크 · 계정", () => {
  it("토큰은 32자리 소문자 16진수만", () => {
    expect(isGuardianToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isGuardianToken("0123456789ABCDEF0123456789abcdef")).toBe(false);
    expect(isGuardianToken("abc")).toBe(false);
    expect(guardianInviteUrl("0123456789abcdef0123456789abcdef")).toBe("https://myboxer153.com/guardian/join?t=0123456789abcdef0123456789abcdef");
  });
  it("보호자만 쓰는 계정 = 승인 전 + guardian 표시", () => {
    expect(isGuardianOnlyProfile({ account_kind: "guardian", is_approved: false })).toBe(true);
    expect(isGuardianOnlyProfile({ account_kind: "guardian", is_approved: true })).toBe(false);
    expect(isGuardianOnlyProfile({ account_kind: null, is_approved: false })).toBe(false);
    expect(isGuardianOnlyProfile(null)).toBe(false);
  });
  it("보내는 글 — 서명 · 줄표 없음 · '국가대표' 없음", () => {
    const t = guardianShareText("민준");
    expect(t.endsWith("153 건강과 행복. 153복싱짐")).toBe(true);
    expect(t).not.toMatch(/[—–]/);
    expect(t).not.toContain("국가대표");
  });
});

describe("보호자 화면 글", () => {
  it("오늘 — 기록 없음 · 운동 중 · 끝 · 끝 기록 없이 오래", () => {
    expect(kidTodayLine({ in: null, inAt: null, out: null, min: null }, at(10)).headline).toBe("오늘 기록은 아직 없어요");
    const live = kidTodayLine({ in: "18:00", inAt: iso, out: null, min: null }, at(92));
    expect(live).toEqual({ headline: "18:00 도착", sub: "운동 중 · 1시간 32분째", live: true });
    expect(kidTodayLine({ in: "18:00", inAt: iso, out: "19:06", min: 66 }, at(200)).sub).toBe("18:00에 와서 1시간 6분 운동했어요");
    expect(kidTodayLine({ in: "18:00", inAt: iso, out: null, min: null }, at(300)).live).toBe(false);
  });
  it("최근 · 레벨 · PB · 시간 글자", () => {
    expect(visitLine({ day: "2026-11-20", in: "18:42", out: "19:40", min: 58 })).toBe("11/20(금) 18:42 ~ 19:40 · 58분");
    expect(visitLine({ day: "2026-11-23", in: "18:42", out: null, min: null })).toBe("11/23(월) 18:42 도착");
    expect(levelLine({ rank: "white", level: 7, need: 2 })).toEqual({ title: "화이트 리그 · 레벨 7", sub: "2번 더 오면 레벨 8" });
    expect(levelLine({ rank: "white", level: 7, need: 0 })?.sub).toBe("다음 출석 때 레벨이 올라가요");
    expect(levelLine(null)).toBeNull();
    expect(pbText(1_300_400)).toBe("21:40");
    expect(pbText(0)).toBeNull();
    expect(minutesText(60)).toBe("1시간");
    expect(minutesText(45)).toBe("45분");
  });
  it("guardian_home 다듬기 — 빈 칸 · 이상한 줄은 버린다", () => {
    const h = normalizeGuardianHome({
      guardian_account: true,
      kids: [
        {
          link_id: "l1",
          member_id: "m1",
          relation: "dad",
          name: "가",
          today: { in: "18:00", in_at: iso },
          month: { days: 2, minutes: 130, dates: ["2026-11-01", 3] },
          total: { days: 9, minutes: 600, first: "2026-09-01" },
          recent: [{ day: "2026-11-20", in: "18:00", out: null }, { day: 1 }],
          level: { rank: "blue", level: 3, need: null },
          notes: [{ day: "2026-11-20", body: "좋아요" }, { body: 3 }],
          pb: { best_ms: 1000, count: 1 },
        },
        { link_id: "", member_id: "m2" },
      ],
    });
    expect(h.guardianAccount).toBe(true);
    expect(h.kids).toHaveLength(1);
    expect(h.kids[0].month.dates).toEqual(["2026-11-01"]);
    expect(h.kids[0].recent).toHaveLength(1);
    expect(h.kids[0].notes).toEqual([{ day: "2026-11-20", body: "좋아요", who: "코치님" }]);
  });
});

describe("회원 · 보호자 화면 낱말 (잘한 것과 다음 한 걸음만 · AI 티 없이)", () => {
  const files = [
    "src/lib/guardian.ts",
    "src/pages/GuardianPage.tsx",
    "src/pages/GuardianJoinPage.tsx",
    "src/components/guardian/GuardianLinkCard.tsx",
    "src/components/guardian/GuardianHomeCard.tsx",
    "src/components/guardian/WorkoutFinishPrompt.tsx",
  ];
  // 화면에 나오는 한글 따옴표 글만 본다(주석 제외)
  const shown = (src: string) =>
    src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n")
      .match(/["`>][^"`<>]*[가-힣][^"`<>]*["`<]/g) ?? [];
  for (const f of files) {
    it(f, () => {
      const text = shown(readFileSync(f, "utf8")).join("\n");
      expect(text).not.toMatch(/빠진|밀린|게으|못 왔|안 왔|국가대표/);
      expect(text).not.toMatch(/[—–]/);
    });
  }
});
