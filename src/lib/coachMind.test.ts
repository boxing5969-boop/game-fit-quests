import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoreSystem,
  buildTailorUser,
  checkCore,
  checkSummary,
  checkTailor,
  cleanCore,
  cleanMindAnswers,
  echoes,
  inventedDigits,
  keysOf,
  MIND_QUESTIONS,
  mindAllowedSpec,
  numbersIn,
  profileLines,
  retryNote,
  TAILOR_MODEL_ERROR,
  type NoteCore,
} from "../../supabase/functions/_shared/coachMind.ts";
import { answeredCount, noteCounts, requiredDone, tailorIssueKo, toggleAnswer } from "./coachMind";

// 대표님이 11/05 에 남긴 글 그대로 — 이 메모가 공통 기준이 되면 이렇게 되어야 한다(모양 예)
const MEMO =
  "아직 스트레이트도 안되어있는데 어퍼나 훅같은 동작을 지도하면 안됨 경력이나 실력별로 최소 2그룹으로 나눠지도 해야하고 " +
  "새로운 동작을 지도할때에도시범먼저 보인뒤 단계별로 보여주고 한명한명 빠르게 잡아줘야한다. 한사람당 30초를 넘기면 안된다";

const CORE: NoteCore = {
  title: "새 동작은 '할 수 있나'부터 — 시범 → 단계 → 한 명씩",
  points: [
    { head: "스트레이트가 먼저예요", body: "스트레이트가 아직이면 훅 · 어퍼 대신 스트레이트를 한 번 더 잡아 줘요." },
    { head: "최소 2그룹으로 나눠요", body: "경력 · 실력별로 최소 2그룹으로 나눠 지도해요." },
    { head: "시범 먼저, 단계별로", body: "새 동작은 시범을 먼저 보인 뒤 단계별로 보여 줘요." },
    { head: "한 사람당 30초", body: "한 명씩 빠르게 잡아 주고, 한 사람당 30초를 넘기지 않아요." },
  ],
  why: "회원이 이해하고 늘고 해냈다고 느낄 때 몰입해요.",
  checks: ["스트레이트가 안 된 회원에게 훅을 가르치지 않았나요?", "모든 회원을 한 번씩 잡아 줬나요?"],
};

const PROFILE = {
  answers: {
    energy: "people", order: "conclusion", tone: "soft", shape: ["demo", "scene"], power: ["members"], stress: "sharp", strong: ["mood"], box_years: "gt5",
  },
  mbti: "ENFP",
  mbti_source: "guess",
  note_power: "회원님들이 좋아했다는 말을 들으면 정말 힘이 나요",
  note_know: null,
};

const goodBody = {
  greeting: "김코치 코치님, 분위기 띄우는 건 코치님이 정말 잘하시죠.",
  lines: [
    "스트레이트가 아직인 회원은 훅 · 어퍼 대신 스트레이트를 한 번 더 잡아 줘요.",
    "경력 · 실력별로 최소 2그룹으로 나눠 주세요.",
    "새 동작은 시범을 먼저 보이고, 단계별로 하나씩 보여 줘요.",
    "한 명씩 빠르게, 한 사람당 30초 안에 잡아 줘요.",
  ],
  covers: [1, 2, 3, 4],
  try_today: '오늘 첫 라운드에서 "스트레이트 되는 분 오른쪽!" 하고 두 그룹으로 나눠 보기',
  closing: "회원님들이 해냈다고 웃는 모습, 코치님이 만들어 주세요.",
  error: "",
};

describe("성향 카드 문항", () => {
  it("DB _coach_mind_allowed() 와 문항 · 값이 같다", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261105124544_coach_mind.sql"), "utf8");
    const m = sql.match(/_coach_mind_allowed\(\)[\s\S]*?select '([\s\S]*?)'::jsonb/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toEqual(mindAllowedSpec());
  });

  it("문항 id 는 겹치지 않고 필수는 순서 · 말투 둘", () => {
    const ids = MIND_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MIND_QUESTIONS.filter((q) => q.required).map((q) => q.id)).toEqual(["order", "tone"]);
  });

  it("아는 값만 남기고 많이 고르는 문항은 앞에서부터 max 개", () => {
    const a = cleanMindAnswers({ order: "conclusion", tone: "loud", shape: ["demo", "demo", "why", "steps"], x: "y", power: "members" });
    expect(a).toEqual({ order: "conclusion", shape: ["demo", "why"] });
  });

  it("고르기 — 하나는 다시 누르면 지우고, 여러 개는 꽉 차면 먼저 고른 것을 밀어낸다", () => {
    const q1 = MIND_QUESTIONS.find((q) => q.id === "order")!;
    const qm = MIND_QUESTIONS.find((q) => q.id === "shape")!;
    let a = toggleAnswer({}, q1, "reason");
    expect(a.order).toBe("reason");
    a = toggleAnswer(a, q1, "reason");
    expect(a.order).toBeUndefined();
    a = toggleAnswer(a, qm, "demo");
    a = toggleAnswer(a, qm, "steps");
    a = toggleAnswer(a, qm, "why");
    expect(a.shape).toEqual(["steps", "why"]);
    expect(requiredDone({ order: "reason" })).toBe(false);
    expect(requiredDone({ order: "reason", tone: "soft" })).toBe(true);
    expect(answeredCount({ order: "reason", tone: "soft", shape: ["demo"] })).toBe(3);
  });

  it("지시문 줄 — 고른 것만, MBTI 는 짐작인지 함께", () => {
    const lines = profileLines(PROFILE);
    expect(lines[0]).toBe("MBTI: ENFP (스스로 짐작)");
    expect(lines).toContain("피드백 순서: 결론 먼저 짧게");
    expect(lines).toContain("이해가 빠른 모양: 시범 · 영상으로, 실제 수업 장면 예시");
    expect(lines.some((l) => l.startsWith("힘 빠지는 말"))).toBe(false);
  });

  it("지점장님 몫(delivery) — MBTI · 나는 이런 사람 · 힘들 때 · 직접 쓴 글은 빠진다", () => {
    const lines = profileLines(PROFILE, "delivery").join("\n");
    expect(lines).toContain("피드백 순서: 결론 먼저 짧게");
    expect(lines).toContain("복싱 경력: 5년 넘게");
    expect(lines).not.toContain("ENFP");
    expect(lines).not.toContain("MBTI");
    expect(lines).not.toContain("힘이 채워지는 쪽");
    expect(lines).not.toContain("힘들 때");
    expect(lines).not.toContain(PROFILE.note_power);
  });
});

describe("공통 기준 검사", () => {
  const raw = { ...CORE, error: "" };

  it("대표님 메모의 숫자(2그룹 · 30초)만 쓰면 통과", () => {
    const c = checkCore(raw, { memo: MEMO });
    expect(c.ok).toBe(true);
  });

  it("메모에 없는 숫자(단계 번호 등)는 막는다", () => {
    const bad = { ...raw, points: [...raw.points, { head: "3단계로", body: "1단계 시범 3단계 연습" }] };
    expect(checkCore(bad, { memo: MEMO })).toMatchObject({ ok: false, reason: "digits" });
  });

  it("탓하는 말 · 빈 칸 · 너무 많은 줄을 막는다", () => {
    expect(checkCore({ ...raw, why: "코치님들 실력이 부족해서 그래요" }, { memo: MEMO })).toMatchObject({ reason: "blame" });
    expect(checkCore({ ...raw, points: [] }, { memo: MEMO })).toMatchObject({ reason: "empty" });
    const many = Array.from({ length: 8 }, () => ({ head: "한 가지", body: "행동 하나" }));
    expect(checkCore({ ...raw, points: many }, { memo: MEMO })).toMatchObject({ reason: "too_many" });
  });

  it("모델이 메모가 모자라다고 하면 그 말을 돌려준다", () => {
    const r = checkCore({ title: "", points: [], why: "", checks: [], error: "무엇을 바꾸면 좋을지 한두 줄만 더 적어 주세요" }, { memo: "음" });
    expect(r).toMatchObject({ ok: false, reason: "model_error" });
  });

  it("손으로 고친 기준 — 빈 줄은 빼고 길이는 자른다", () => {
    const c = cleanCore({ title: "제목", points: [{ head: "", body: "" }, { head: "가", body: "나".repeat(300) }], checks: ["", "질문"] });
    expect(c?.points).toHaveLength(1);
    expect(c?.points[0].body).toHaveLength(200);
    expect(c?.checks).toEqual(["질문"]);
    expect(cleanCore({ title: "", points: [{ head: "가", body: "나" }] })).toBeNull();
  });

  it("지시문에 153 기준 이름이 들어간다", () => {
    expect(buildCoreSystem([{ no: 1, title: "이름을 불러요" }])).toContain("1. 이름을 불러요");
  });
});

describe("코치님마다 맞춘 글 검사", () => {
  it("모든 기준 · 숫자를 담으면 통과", () => {
    const r = checkTailor(goodBody, { core: CORE, profile: PROFILE });
    expect(r.ok).toBe(true);
  });

  it("빠진 기준은 글로 본다 — covers 를 다 적어도 숫자 없는 기준을 빼면 막는다", () => {
    const noDemo = { ...goodBody, lines: goodBody.lines.filter((l) => !l.includes("시범")) };
    expect(checkTailor(noDemo, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "coverage", message: "「시범 먼저, 단계별로」" });
    // covers 를 빠뜨려도 글에 다 있으면 통과(모델이 적은 번호보다 글이 먼저)
    expect(checkTailor({ ...goodBody, covers: [1, 2] }, { core: CORE, profile: PROFILE }).ok).toBe(true);
    const noThirty = { ...goodBody, lines: goodBody.lines.map((l) => l.replace("30초", "짧게")) };
    expect(checkTailor(noThirty, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "dropped", message: "30" });
  });

  it("'두 그룹' · '삼십 초'처럼 말로 쓴 수도 기준의 숫자로 센다", () => {
    const words = { ...goodBody, lines: goodBody.lines.map((l) => l.replace("최소 2그룹", "최소 두 그룹").replace("30초", "삼십 초")) };
    expect(checkTailor(words, { core: CORE, profile: PROFILE }).ok).toBe(true);
    expect([...numbersIn("두 그룹 · 한 명씩 · 삼십 초 · 열두 명 · 십 분")].sort()).toEqual(["1", "10", "12", "2", "30"]);
  });

  it("꼬리표 — 소문자 · 한글 줄임말 · 한 글자 꼬리표도 막는다", () => {
    for (const greeting of ["enfp 코치님, 오늘도 힘내요.", "엔프피 코치님답게 가 볼까요?", "F라서 마음이 먼저 와닿으시죠?", "인팁 코치님 반가워요."]) {
      expect(checkTailor({ ...goodBody, greeting }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "label" });
    }
  });

  it("카드 답을 말로 옮기면 막는다", () => {
    const talk = { ...goodBody, greeting: "김코치 코치님, 결론부터 듣는 걸 좋아하신다고 해서 짧게 갈게요." };
    expect(checkTailor(talk, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "card" });
    expect(checkTailor({ ...goodBody, closing: "카드에 적어 주신 대로 회원님 웃음을 만들어 주세요." }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "card" });
  });

  it("공통 기준에 있는 낱말(부족 · 유형)은 탓하는 말 · 꼬리표로 보지 않는다", () => {
    const core: NoteCore = { ...CORE, points: [...CORE.points, { head: "펀치 유형 나누기", body: "시간이 부족하면 펀치 유형을 하나만 골라요." }] };
    const body = { ...goodBody, lines: [...goodBody.lines, "시간이 부족한 날은 펀치 유형을 하나만 골라 집중해요."] };
    expect(checkTailor(body, { core, profile: PROFILE }).ok).toBe(true);
    expect(checkTailor({ ...body, closing: "코치님 지도가 부족해 보여요." }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "blame" });
  });

  it("카드의 숫자(경력)는 못 쓰고 · 코치님 이름의 숫자는 된다", () => {
    expect(checkTailor({ ...goodBody, closing: "5년 넘게 해 오신 경험으로 다듬어 주세요." }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "digits", message: "5" });
    const named = { ...goodBody, greeting: "코치2 코치님, 분위기 띄우는 건 코치님이 정말 잘하시죠." };
    expect(checkTailor(named, { core: CORE, profile: PROFILE, allow: "코치2 코치" }).ok).toBe(true);
  });

  it("모델 error 글은 돌려주지 않고 정해 둔 말만", () => {
    const r = checkTailor({ greeting: "", lines: [], covers: [], try_today: "", closing: "", error: "ENFP 이고 힘들 때 예민해지는 분이라 어려워요" }, { core: CORE });
    expect(r).toMatchObject({ ok: false, reason: "model_error", message: TAILOR_MODEL_ERROR });
  });

  it("MBTI · 성향 같은 꼬리표를 막는다", () => {
    expect(checkTailor({ ...goodBody, greeting: "ENFP 코치님답게 분위기를 띄워 주세요." }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "label" });
    expect(checkTailor({ ...goodBody, closing: "코치님 성향에 맞게 해 보세요." }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "label" });
  });

  it("기준에 없는 숫자 · 코치님 글을 그대로 옮긴 것을 막는다", () => {
    expect(checkTailor({ ...goodBody, try_today: "오늘 회원 12명을 두 그룹으로" }, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "digits" });
    const echo = { ...goodBody, closing: "회원님들이 좋아했다는 말을 들으면 정말 힘이 나요" };
    expect(checkTailor(echo, { core: CORE, profile: PROFILE })).toMatchObject({ reason: "echo" });
  });

  it("앞 번호는 떼어 낸다", () => {
    const r = checkTailor({ ...goodBody, lines: goodBody.lines.map((l) => `- ${l}`) }, { core: CORE, profile: PROFILE });
    expect(r.ok && r.body.lines[0].startsWith("스트레이트")).toBe(true);
  });

  it("지시문에 공통 기준 · 카드 · 기준 수가 들어간다", () => {
    const u = buildTailorUser({ name: "김코치", title: "코치" }, CORE, PROFILE, { one_line: "결론부터 짧게", do: ["시범 장면으로"], avoid: [] });
    expect(u).toContain("4. 한 사람당 30초");
    expect(u).toContain("피드백 순서: 결론 먼저 짧게");
    expect(u).toContain("한 줄: 결론부터 짧게");
    expect(u).toContain("공통 기준은 4개예요");
  });

  it("지점장님 몫 지시문 — 전하는 법 답만, 전달 설명서 · MBTI · 직접 쓴 글은 없다", () => {
    const u = buildTailorUser({ name: "김코치", title: "코치" }, CORE, PROFILE, { one_line: "결론부터 짧게", do: [], avoid: [] }, "delivery");
    expect(u).toContain("전하는 법 답만");
    expect(u).toContain("피드백 순서: 결론 먼저 짧게");
    expect(u).not.toContain("ENFP");
    expect(u).not.toContain("전달 설명서");
    expect(u).not.toContain(PROFILE.note_power);
    expect(u).not.toContain("힘들 때");
  });

  it("손으로 고친 글 — 같은 검사 · 보낸 분께 보일 말", () => {
    const edited = { ...goodBody, lines: goodBody.lines.filter((l) => !l.includes("30초")) };
    const c = checkTailor(edited, { core: CORE });
    expect(c.ok).toBe(false);
    if ("reason" in c) expect(tailorIssueKo(c)).toBe("기준의 숫자가 빠졌어요 — 30");
  });
});

describe("전달 설명서 검사", () => {
  const s = {
    one_line: "결론부터 짧게, 시범 장면을 붙여 주면 바로 알아들어요",
    do: ["결론을 첫 줄에", "시범 · 수업 장면으로", "잘한 것 한 줄 먼저"],
    avoid: ["다른 코치와 비교하지 않기"],
    power_line: "회원님들이 코치님 수업을 정말 좋아해요",
    order: ["잘한 것 한 줄", "결론", "시범 장면", "오늘 해 볼 것"],
  };
  it("통과 · 빈 칸 · 그대로 옮기기", () => {
    expect(checkSummary(s, PROFILE).ok).toBe(true);
    expect(checkSummary({ ...s, do: [] }, PROFILE)).toMatchObject({ reason: "empty" });
    expect(checkSummary({ ...s, power_line: PROFILE.note_power }, PROFILE)).toMatchObject({ reason: "echo" });
  });
});

describe("도구", () => {
  it("숫자 · 그대로 옮기기 · 다시 쓰기 안내", () => {
    expect(inventedDigits("30초 2그룹", MEMO)).toBe(false);
    expect(inventedDigits("12명", MEMO)).toBe(true);
    expect(echoes("가나다", ["짧은 글"])).toBe(false);
    expect(retryNote("coverage")).toContain("covers");
    expect(retryNote("coverage", "「시범 먼저」")).toContain("걸린 곳: 「시범 먼저」");
    expect(retryNote("없는 이유")).toBe("");
    // 기준에도 있는 대목은 그대로 옮긴 것으로 보지 않는다
    expect(echoes("회원님들이 좋아했다는 말을 들으면 정말 힘이 나요", ["회원님들이 좋아했다는 말을 들으면 정말 힘이 나요"], 15, "회원님들이 좋아했다는 말을 들으면 정말 힘이 나요")).toBe(false);
    expect(keysOf("최소 2그룹으로 나눠요")).toEqual(["최소", "그룹", "나눠"]);
  });

  it("확인 현황 세기", () => {
    // 한마디는 reply_at 으로 — 다른 지시권자에게는 글(reply)이 오지 않아도 수는 맞다
    const n = noteCounts([
      { seen_at: "x", acked_at: "x", reply_at: "x" },
      { seen_at: "x", acked_at: null, reply_at: null },
      { seen_at: null, acked_at: null, reply_at: null },
    ]);
    expect(n).toEqual({ total: 3, seen: 2, acked: 1, replies: 1 });
  });
});
