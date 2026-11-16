import { describe, expect, it } from "vitest";
import {
  MAX_MISSION_ROWS,
  PRACTICE_LINK,
  TITLE_MISSION_SHORT,
  missionDisplayName,
  missionGuide,
  missionRows,
  titleFlowHero,
} from "./nextLevelGuide";
import { titleMissionRules } from "./titleMatchChallenge";

// 운영 미션 제목과 같은 모양 (지어낸 id)
const WHITE_L4 = [
  { id: "m1", title: "[복싱/스텝] 사이드 방향전환 스텝ㅣ각도 만드는 좌우 풋워크" },
  { id: "m2", title: "[복싱/스텝] 원·투·쓰리 스텝ㅣ거리를 지배하는 전진 풋워크" },
];
const WHITE_L1 = Array.from({ length: 9 }, (_, i) => ({ id: `a${i + 1}`, title: `[복싱/잽] 동작 ${i + 1}ㅣ설명 ${i + 1}` }));
const WHITE_L10 = [
  { id: "t1", title: "[복싱/콤비] 잽잽 원투 연타 1번ㅣ레벨 미션 동작 ① (연타 기초)" },
  { id: "t2", title: "[복싱/콤비] 연타 2번·백스텝 카운터ㅣ몰아치고 되받아치기 ②" },
  { id: "t3", title: "[복싱/콤비] 레벨10 연타 3번 미션ㅣ최고 난도 연결 동작 ③" },
];
const BLUE_L10 = [
  { id: "b1", title: "[복싱/콤비] 콤보 드릴 18동작 · 실사ㅣ원투 훅 → 더킹 → 훅 카운터 (블루 타이틀매치)" },
  { id: "b2", title: "[복싱/콤비] 콤보 드릴 18동작 · 애니 여성ㅣ같은 동작을 애니메이션으로 (블루 타이틀매치)" },
  { id: "b3", title: "[복싱/콤비] 콤보 드릴 18동작 · 애니 소년ㅣ같은 동작을 애니메이션으로 (블루 타이틀매치)" },
];

describe("미션 이름", () => {
  it("꼬리표 · 설명을 떼고 이름만", () => {
    expect(missionDisplayName(WHITE_L4[0].title)).toBe("사이드 방향전환 스텝");
    expect(missionDisplayName(WHITE_L4[1].title)).toBe("원·투·쓰리 스텝");
    expect(missionDisplayName("꼬리표 없는 제목")).toBe("꼬리표 없는 제목");
    expect(missionDisplayName("")).toBe("");
    expect(missionDisplayName(null)).toBe("");
  });

  it("같은 동작의 다른 버전(· 실사 · 애니)은 꼬리표를 뗀다 — 가운뎃점이 든 이름은 그대로", () => {
    expect(missionDisplayName(BLUE_L10[0].title)).toBe("콤보 드릴 18동작");
    expect(missionDisplayName(BLUE_L10[1].title)).toBe("콤보 드릴 18동작");
    expect(missionDisplayName("[복싱/잽] 스텝 사이드 잽·방향전환ㅣ스텝으로 각 여는 잽")).toBe("스텝 사이드 잽·방향전환");
    expect(missionDisplayName(WHITE_L10[1].title)).toBe("연타 2번·백스텝 카운터");
  });
});

describe("미션 줄", () => {
  it("순서 그대로 · 따라 한 미션은 뒤로 · 표시만 한다(숫자 없음)", () => {
    expect(missionRows(WHITE_L4, {})).toEqual({
      rows: [
        { id: "m1", name: "사이드 방향전환 스텝", done: false },
        { id: "m2", name: "원·투·쓰리 스텝", done: false },
      ],
      total: 2,
    });
    const one = missionRows(WHITE_L4, { m1: true });
    expect(one.rows.map((r) => [r.id, r.done])).toEqual([
      ["m2", false],
      ["m1", true],
    ]);
  });

  it("세 줄까지 — 아직 안 따라 한 것부터 채운다", () => {
    const r = missionRows(WHITE_L1, { a1: true, a2: true });
    expect(r.total).toBe(9);
    expect(r.rows).toHaveLength(MAX_MISSION_ROWS);
    expect(r.rows.map((x) => x.id)).toEqual(["a3", "a4", "a5"]);
    // 거의 다 따라 했으면 남은 것 + 따라 한 것
    const watched = Object.fromEntries(WHITE_L1.slice(0, 8).map((v) => [v.id, true]));
    expect(missionRows(WHITE_L1, watched).rows.map((x) => [x.id, x.done])).toEqual([
      ["a9", false],
      ["a1", true],
      ["a2", true],
    ]);
  });

  it("같은 동작의 다른 버전은 한 줄 — 하나라도 따라 했으면 따라 한 것", () => {
    expect(missionRows(BLUE_L10, {})).toEqual({ rows: [{ id: "b1", name: "콤보 드릴 18동작", done: false }], total: 1 });
    expect(missionRows(BLUE_L10, { b3: true }).rows[0]).toEqual({ id: "b1", name: "콤보 드릴 18동작", done: true });
  });

  it("이름만 같은 다른 미션은 따로 센다 (훈련 탭 '오늘의 영상' 수와 같게)", () => {
    const same = [
      { id: "s1", title: "[복싱/잽] 4스텝 잽ㅣ앞으로 나갈 때 잽을 동시에 (1일차)" },
      { id: "s2", title: "[복싱/잽] 4스텝 잽ㅣ리듬 스텝 위에서 옆 각도로 찌르는 잽" },
    ];
    expect(missionRows(same, { s1: true })).toEqual({
      rows: [
        { id: "s2", name: "4스텝 잽", done: false },
        { id: "s1", name: "4스텝 잽", done: true },
      ],
      total: 2,
    });
  });

  it("id · 이름이 없는 줄은 버린다", () => {
    expect(missionRows([{ id: "", title: "[복싱/잽] 잽" }, { id: "x", title: "[복싱/잽]" }], {})).toEqual({ rows: [], total: 0 });
  });
});

describe("홈 「미션」 칸", () => {
  it("레벨 1~9 — 이 레벨의 미션 영상 · 연습 화면으로", () => {
    const g = missionGuide({ league: "white", level: 4, videos: WHITE_L4, watched: {}, titleFlow: false });
    expect(g).toEqual({
      heading: "레벨 4 미션",
      steps: [],
      rows: [
        { id: "m1", name: "사이드 방향전환 스텝", done: false },
        { id: "m2", name: "원·투·쓰리 스텝", done: false },
      ],
      total: 2,
      link: { label: "미션 연습하러 가기", to: PRACTICE_LINK },
    });
  });

  it("미션이 세 개를 넘으면 「미션 n개 모두 보기」", () => {
    const g = missionGuide({ league: "white", level: 1, videos: WHITE_L1, watched: {}, titleFlow: false });
    expect(g?.rows).toHaveLength(3);
    expect(g?.link).toEqual({ label: "미션 9개 모두 보기", to: PRACTICE_LINK });
  });

  it("레벨 숫자는 리그를 이은 숫자 (블루 3 = 레벨 13) · 영상이 없으면 목표 한 줄", () => {
    const g = missionGuide({
      league: "blue",
      level: 3,
      videos: [],
      watched: {},
      fallback: { title: "스트레이트 회전 입문", goal: "스트레이트의 회전력과 체중 이동을 배운다" },
      titleFlow: false,
    });
    expect(g?.heading).toBe("레벨 13 미션");
    expect(g?.steps).toEqual(["스트레이트의 회전력과 체중 이동을 배운다"]);
    expect(g?.rows).toEqual([]);
    expect(g?.link.label).toBe("미션 연습하러 가기");
    // 목표 글이 없으면 제목으로
    expect(
      missionGuide({ league: "red", level: 2, videos: [], watched: {}, fallback: { title: "타이밍 감각", goal: " " }, titleFlow: false })?.steps,
    ).toEqual(["타이밍 감각"]);
  });

  it("영상이 있으면 영상만 — 레벨 데이터 글과 섞지 않는다", () => {
    const g = missionGuide({
      league: "white",
      level: 4,
      videos: WHITE_L4,
      watched: {},
      fallback: { title: "인앤아웃 잽 + 카운터 연결", goal: "인앤아웃 잽과 카운터를 연결한다" },
      titleFlow: false,
    });
    expect(g?.steps).toEqual([]);
    expect(g?.rows).toHaveLength(2);
  });

  it("보일 것이 없으면 칸을 그리지 않는다", () => {
    expect(missionGuide({ league: "black", level: 5, videos: [], watched: {}, titleFlow: false })).toBeNull();
    expect(missionGuide({ league: "red", level: 10, videos: [], watched: {}, fallback: null, titleFlow: false })).toBeNull();
  });

  it("레벨 10 · 신청 흐름 — 타이틀미션 두 줄 + 타이틀매치 동작 · 타이틀매치 화면으로", () => {
    const g = missionGuide({ league: "white", level: 10, videos: WHITE_L10, watched: { t1: true }, titleFlow: true });
    expect(g?.heading).toBe("타이틀미션");
    expect(g?.steps).toEqual([...TITLE_MISSION_SHORT]);
    expect(g?.rows.map((r) => [r.name, r.done])).toEqual([
      ["연타 2번·백스텝 카운터", false],
      ["레벨10 연타 3번 미션", false],
      ["잽잽 원투 연타 1번", true],
    ]);
    expect(g?.link).toEqual({ label: "타이틀미션 자세히 보기", to: "/title-match?lv=10" });
    // 영상이 없어도 타이틀미션 두 줄은 보인다
    expect(missionGuide({ league: "white", level: 10, videos: [], watched: {}, titleFlow: true })?.steps).toHaveLength(2);
  });

  it("레벨 10 · 신청 흐름이 아닌 지점 · 리그 — 타이틀매치 동작 · 연습 화면으로", () => {
    const g = missionGuide({ league: "blue", level: 10, videos: BLUE_L10, watched: {}, titleFlow: false });
    expect(g).toEqual({
      heading: "타이틀매치 동작",
      steps: [],
      rows: [{ id: "b1", name: "콤보 드릴 18동작", done: false }],
      total: 1,
      link: { label: "타이틀매치 동작 연습하기", to: PRACTICE_LINK },
    });
  });

  it("타이틀미션 두 줄은 심사 기준과 같은 말 (기준이 바뀌면 같이 고친다)", () => {
    const rules = titleMissionRules();
    expect(rules[0]).toContain("3번 연속 성공");
    expect(TITLE_MISSION_SHORT[0]).toContain("3번 연속 성공");
    expect(rules[1]).toContain("미트로 3번 받아주기");
    expect(TITLE_MISSION_SHORT[1]).toContain("미트로 3번 받아주기");
  });
});

describe("타이틀매치 신청 흐름 — 홈 카드 주인공 줄", () => {
  const opts = { attemptsLeft: 2, retryAt: "2026-11-22T15:00:00.000Z", reviewer: "지점장님" };

  it("신청할 수 있을 때만 신청 단추", () => {
    expect(titleFlowHero("ready", opts)).toEqual({ hero: "타이틀매치만 남았어요", note: null, tone: "reward", canRequest: true });
    for (const p of ["requested", "challenging", "locked", "cleared", "not_title", null, undefined] as const) {
      expect(titleFlowHero(p, opts).canRequest).toBe(false);
    }
  });

  it("단계를 아직 모르면 늘 맞는 말만", () => {
    expect(titleFlowHero(undefined, opts).hero).toBe("타이틀매치만 남았어요");
    expect(titleFlowHero("not_title", opts).hero).toBe("타이틀매치만 남았어요");
  });

  it("신청함 · 도전 중 · 다시 신청하는 날", () => {
    expect(titleFlowHero("requested", opts)).toMatchObject({ hero: "심사를 기다려요", note: "지점장님이 심사 날짜를 잡아 드려요", tone: "pending" });
    expect(titleFlowHero("challenging", opts).hero).toBe("도전 중 · 남은 기회 2번");
    // 한국 날짜 — 11/22 15:00 UTC = 11/23 00:00 KST
    expect(titleFlowHero("locked", opts).hero).toBe("11월 23일부터 다시 신청해요");
    expect(titleFlowHero("locked", { ...opts, retryAt: null }).hero).toBe("곧 다시 신청할 수 있어요");
  });

  it("못한 것은 말하지 않는다 — 실패 · 불합격 · 탈락 같은 말 없음", () => {
    for (const p of ["ready", "requested", "challenging", "locked", "cleared"] as const) {
      const h = titleFlowHero(p, opts);
      expect(`${h.hero} ${h.note ?? ""}`).not.toMatch(/실패|불합격|탈락|떨어|아쉽/);
    }
  });
});
