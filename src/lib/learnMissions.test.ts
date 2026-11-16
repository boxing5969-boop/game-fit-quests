import { describe, expect, it } from "vitest";
import { learnVideos, missionAbsLevel, missionShelf, missionTagWord, titleMatches, type LearnMissionSource } from "./learnMissions";

const yt = (id: string) => [{ video_url: `https://youtu.be/${id}`, poster_url: null, label: null, sort_order: 0 }];
const m = (
  id: string,
  title: string,
  rank: string,
  level: number,
  video: string | null,
  extra: Partial<LearnMissionSource> = {},
): LearnMissionSource => ({
  id,
  title,
  category: "level",
  is_active: true,
  sort_order: 10,
  levels: { rank_name: rank, level_number: level },
  mission_videos: video ? yt(video) : [],
  ...extra,
});

describe("영상으로 배우기 — 레벨 미션 영상", () => {
  it("리그 · 레벨 → 이은 레벨", () => {
    expect(missionAbsLevel("white", 1)).toBe(1);
    expect(missionAbsLevel("white", 10)).toBe(10);
    expect(missionAbsLevel("blue", 10)).toBe(20);
    expect(missionAbsLevel("black", 3)).toBe(33);
    expect(missionAbsLevel("purple", 1)).toBeNull();
    expect(missionAbsLevel("white", 0)).toBeNull();
  });

  it("꼬리표로 칸을 정한다 — 기초는 스텝 이야기면 스텝", () => {
    expect(missionTagWord("[복싱/스텝] 제자리 스텝ㅣ…")).toBe("스텝");
    expect(missionShelf("[복싱/스텝] 4스텝")).toBe("step");
    expect(missionShelf("[복싱/잽] 4스텝 잽ㅣ앞으로 나갈 때")).toBe("basics");
    expect(missionShelf("[복싱/기초] 십자스텝 완벽 가이드ㅣ풋워크 기본기")).toBe("step");
    expect(missionShelf("[복싱/기초] 가드 만들기")).toBe("basics");
    expect(missionShelf("[복싱/줄넘기] 무릎 올리며 대쉬")).toBe("fitness");
    expect(missionShelf("[복싱/체력] 좌우 번갈아 뛰기")).toBe("fitness");
    expect(missionShelf("[복싱/방어] 방어 잽·거리 조절")).toBe("defense");
    expect(missionShelf("[복싱/콤비] 스텝 원투")).toBe("skill");
    expect(missionShelf("[복싱/기술] 피벗")).toBe("skill");
    expect(missionShelf("꼬리표 없는 미션")).toBe("skill");
  });

  it("워밍업 영상은 예전 모양(레벨 · 칸 없음) 맨 앞 · 레벨 미션은 레벨 순", () => {
    const list = learnVideos([
      m("l8", "[복싱/콤비] 스텝 원투쓰리", "white", 8, "c8"),
      m("w1", "[복싱/줄넘기] 좌우 리듬", "white", 1, "w1", { category: "warmup", sort_order: 10 }),
      m("l1", "[복싱/스텝] 제자리 스텝ㅣ바운스 (1일차)", "white", 1, "s1", { sort_order: 1 }),
      m("l3", "[복싱/기초] 십자스텝 완벽 가이드", "white", 3, "x3"),
    ]);
    expect(list.map((v) => v.id)).toEqual(["w1", "l1", "l3", "l8"]);
    expect(list[0].level).toBeUndefined();
    expect(list[0].shelf).toBeUndefined();
    expect(list[1]).toMatchObject({ level: 1, shelf: "step" });
    expect(list[3]).toMatchObject({ level: 8, shelf: "skill" });
  });

  it("같은 영상을 다시 쓴 레벨 7 미션은 낮은 레벨 하나만 · 꺼진 미션 · 영상 없는 미션은 빼기", () => {
    const list = learnVideos([
      m("l7", "[복싱/잽] 걷는 사이드 잽·방향전환ㅣ걸으며 각도", "white", 7, "3zYLlWfyY2k"),
      m("l1", "[복싱/잽] 걷기 스텝 잽ㅣ걸으며 각도 만드는 잽", "white", 1, "3zYLlWfyY2k"),
      m("off", "[복싱/잽] 4스텝 잽 · 애니 여성ㅣ같은 동작", "white", 1, "anim", { is_active: false }),
      m("none", "[복싱/잽] 영상 없음", "white", 2, null),
    ]);
    expect(list.map((v) => v.id)).toEqual(["l1"]);
  });

  it("· 실사 / · 애니 ○○ 는 한 칸 — 버전 이름과 미션 id 를 함께", () => {
    const list = learnVideos([
      m("real", "[복싱/콤비] 콤보 드릴 18동작 · 실사ㅣ원투 훅 → 더킹 → 훅 카운터 (블루 타이틀매치)", "blue", 10, "r", { sort_order: 10 }),
      m("girl", "[복싱/콤비] 콤보 드릴 18동작 · 애니 여성ㅣ같은 동작을 애니메이션으로 (블루 타이틀매치)", "blue", 10, "g", { sort_order: 20 }),
      m("boy", "[복싱/콤비] 콤보 드릴 18동작 · 애니 소년ㅣ같은 동작을 애니메이션으로 (블루 타이틀매치)", "blue", 10, "b", { sort_order: 30 }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: "real",
      level: 20,
      shelf: "skill",
      memberIds: ["real", "girl", "boy"],
      variantLabels: ["실사", "애니 여성", "애니 소년"],
      title: "[복싱/콤비] 콤보 드릴 18동작ㅣ원투 훅 → 더킹 → 훅 카운터 (블루 타이틀매치)",
    });
  });

  it("가운뎃점이 이름 안에 있는 미션(잽·방향전환)은 버전으로 묶지 않는다", () => {
    const list = learnVideos([
      m("a", "[복싱/잽] 걷는 사이드 잽·방향전환ㅣ걸으며", "white", 7, "a1"),
      m("b", "[복싱/방어] 방어 잽·거리 조절ㅣ잽으로", "white", 5, "b1"),
    ]);
    expect(list.map((v) => v.memberIds.length)).toEqual([1, 1]);
  });

  it("찾기 — 꼬리표 · 띄어쓰기 · 기호를 빼고 낱말마다", () => {
    expect(titleMatches("[복싱/스텝] 제자리 스텝ㅣ거울 앞 대각선", "제자리스텝")).toBe(true);
    expect(titleMatches("[복싱/스텝] 제자리 스텝ㅣ거울 앞 대각선", "거울 대각선")).toBe(true);
    expect(titleMatches("[복싱/스텝] 제자리 스텝ㅣ거울 앞 대각선", "복싱")).toBe(false);
    expect(titleMatches("[복싱/콤비] 스텝 원투·원투", "원투원투")).toBe(true);
    expect(titleMatches("아무거나", "   ")).toBe(false);
  });
});
