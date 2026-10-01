import { describe, expect, it } from "vitest";
import {
  TITLE_STAGES,
  defaultStage,
  groupByLeague,
  levelsLeft,
  previousStage,
  stageFromParam,
  stageState,
  toTitleVideos,
  type MemberSpot,
} from "./titleMatch";

const [white, blue, red, black] = TITLE_STAGES;
const spot = (rank: string, level: number, bossesCleared = 0): MemberSpot => ({ rank, level, bossesCleared });

describe("네 개의 관문", () => {
  it("레벨 10·20·30·40 = 화이트·블루·레드·블랙", () => {
    expect(TITLE_STAGES.map((s) => `${s.level}${s.name}`)).toEqual(["10화이트", "20블루", "30레드", "40블랙"]);
  });
  it("주소 ?lv= 로 고르기", () => {
    expect(stageFromParam("20")?.league).toBe("blue");
    expect(stageFromParam("40")?.league).toBe("black");
    expect(stageFromParam("15")).toBeNull();
    expect(stageFromParam("")).toBeNull();
    expect(stageFromParam(null)).toBeNull();
    expect(stageFromParam("abc")).toBeNull();
  });
  it("바로 앞 관문", () => {
    expect(previousStage(white)).toBeNull();
    expect(previousStage(red)?.league).toBe("blue");
  });
});

describe("회원 자리", () => {
  it("화이트 L3 — 화이트는 내 리그, 나머지는 앞으로", () => {
    const s = spot("white", 3);
    expect(TITLE_STAGES.map((st) => stageState(st, s))).toEqual(["mine", "ahead", "ahead", "ahead"]);
    expect(defaultStage(s).level).toBe(10);
    expect(levelsLeft(s)).toBe(7);
  });
  it("블루 L1 — 화이트는 통과", () => {
    const s = spot("blue", 1, 1);
    expect(TITLE_STAGES.map((st) => stageState(st, s))).toEqual(["passed", "mine", "ahead", "ahead"]);
    expect(defaultStage(s).level).toBe(20);
  });
  it("통과 기록이 늦게 따라와도 리그가 올라갔으면 지나온 관문", () => {
    expect(stageState(white, spot("red", 2, 0))).toBe("passed");
    expect(stageState(blue, spot("red", 2, 0))).toBe("passed");
  });
  it("레벨 10 에 머물러 있어도 통과했으면 다음 관문을 고른다", () => {
    const s = spot("white", 10, 1);
    expect(stageState(white, s)).toBe("passed");
    expect(defaultStage(s).level).toBe(20);
  });
  it("지금이 타이틀매치 — 남은 레벨 0", () => {
    expect(levelsLeft(spot("blue", 10))).toBe(0);
  });
  it("블랙 마스터 — 전부 통과, 마지막 칸", () => {
    const s = spot("black", 10, 4);
    expect(TITLE_STAGES.every((st) => stageState(st, s) === "passed")).toBe(true);
    expect(defaultStage(s).level).toBe(40);
  });
  it("회원 정보가 없거나 리그를 모르면 표시 없이 첫 칸", () => {
    expect(stageState(black, null)).toBeNull();
    expect(stageState(black, spot("gold", 3))).toBeNull();
    expect(defaultStage(null).level).toBe(10);
    expect(defaultStage(spot("gold", 3)).level).toBe(10);
  });
  it("레벨 값이 이상해도 0~9 사이", () => {
    expect(levelsLeft(spot("white", 0))).toBe(9);
    expect(levelsLeft(spot("white", 15))).toBe(0);
    expect(levelsLeft(spot("white", Number.NaN))).toBe(9);
  });
});

describe("영상 정리", () => {
  const row = (id: string, rank: string | null, level: number | null, url: string | null, extra: Record<string, unknown> = {}) => ({
    id,
    title: `[복싱/콤비] 동작 ${id}ㅣ설명`,
    description: null,
    key_point_1: " 잽 두 번 ",
    key_point_2: "",
    key_point_3: null,
    mission_videos: url === null ? [] : [{ video_url: url, poster_url: null }],
    levels: rank === null ? null : { rank_name: rank, level_number: level },
    ...extra,
  });

  it("레벨 10 · 영상 있는 것만, 받은 순서 그대로", () => {
    const v = toTitleVideos([
      row("a", "white", 10, "https://youtu.be/aaa111"),
      row("b", "white", 9, "https://youtu.be/bbb222"),
      row("c", "white", 10, null),
      row("d", "white", 10, "   "),
      row("e", "blue", 10, "https://youtu.be/eee555"),
      row("f", "white", 10, "https://youtu.be/fff666"),
      row("g", null, null, "https://youtu.be/ggg777"),
      row("h", "gold", 10, "https://youtu.be/hhh888"),
    ]);
    expect(v.map((x) => x.id)).toEqual(["a", "e", "f"]);
    expect(v[0].keyPoints).toEqual(["잽 두 번"]);
    expect(v[0].posterUrl).toBeNull();
  });
  it("영상 주소가 여러 개면 비어 있지 않은 첫 주소", () => {
    const v = toTitleVideos([
      row("a", "red", 10, null, {
        mission_videos: [
          { video_url: "", poster_url: "p0" },
          { video_url: "https://youtu.be/real01", poster_url: "p1" },
        ],
      }),
    ]);
    expect(v[0].videoUrl).toBe("https://youtu.be/real01");
    expect(v[0].posterUrl).toBe("p1");
  });
  it("실사 · 애니메이션 두 버전 — DB 가 애니를 먼저 줘도 대표는 실사(sort_order 0)", () => {
    const v = toTitleVideos([
      row("a", "white", 10, null, {
        mission_videos: [
          { video_url: "https://x/anime.mp4", poster_url: "pa", label: "애니메이션", sort_order: 1 },
          { video_url: "https://x/live.mp4", poster_url: "pl", label: null, sort_order: 0 },
        ],
      }),
    ]);
    expect(v[0].videoUrl).toBe("https://x/live.mp4");
    expect(v[0].posterUrl).toBe("pl");
    expect(v[0].variants.map((x) => x.label)).toEqual(["실사", "애니메이션"]);
  });
  it("엉뚱한 응답이면 빈 목록", () => {
    expect(toTitleVideos(null)).toEqual([]);
    expect(toTitleVideos({})).toEqual([]);
  });
  it("리그별 — 영상 없는 리그도 빈 칸", () => {
    const g = groupByLeague(toTitleVideos([row("a", "white", 10, "https://youtu.be/aaa111"), row("b", "white", 10, "https://youtu.be/bbb222")]));
    expect(g.white.map((x) => x.id)).toEqual(["a", "b"]);
    expect(g.blue).toEqual([]);
    expect(g.red).toEqual([]);
    expect(g.black).toEqual([]);
  });
});
