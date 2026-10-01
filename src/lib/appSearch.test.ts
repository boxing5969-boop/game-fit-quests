import { describe, expect, it, beforeEach } from "vitest";
import {
  FEATURES,
  groupHits,
  includesWord,
  isChosungOnly,
  lessonEntry,
  loadRecent,
  normalize,
  pushRecent,
  queryTokens,
  clearRecent,
  scoreEntry,
  searchEntries,
  splitVideoTitle,
  toChosung,
  videoEntry,
  visibleFor,
  type SearchEntry,
} from "./appSearch";

const titleVideo = videoEntry({
  id: "m10a", title: "[복싱/콤비] 잽잽 원투 연타 1번ㅣ레벨 미션 동작 ① (연타 기초)", keyPoints: ["잽 두 번 후 원투"],
  videoUrl: "https://youtu.be/abc123def", category: "level", rank: "white", level: 10,
});
const level1Video = videoEntry({
  id: "m1", title: "[복싱/잽] 4스텝 잽ㅣ리듬 스텝 위에서 옆 각도로 찌르는 잽", keyPoints: ["리듬 스텝 위에서 옆으로 잽"],
  videoUrl: "https://youtu.be/xyz987abc", category: "level", rank: "white", level: 1,
});
const warmupVideo = videoEntry({
  id: "w1", title: "[복싱/줄넘기] 좌우 리듬ㅣ왼발 2번·오른발 2번 줄넘기", keyPoints: [],
  videoUrl: "https://youtu.be/rope12345", category: "warmup", rank: "white", level: 1,
});
const day1 = lessonEntry({ dayNo: 1, level: 1, title: "첫 수업 · 스텝·가드·잽·뒷손 카운터", goal: "", stepNames: ["제자리 스텝", "4스텝 잽", "뒷손 카운터"], levelLabel: "화이트 L1" });
const day6 = lessonEntry({ dayNo: 6, level: 2, title: "원투 배우기 + 샌드백 5라운드", goal: "", stepNames: ["원투", "샌드백"], levelLabel: "화이트 L2" });

const ALL: SearchEntry[] = [...FEATURES, titleVideo, level1Video, warmupVideo, day1, day6];
const ids = (q: string) => searchEntries(ALL, q).map((h) => h.entry.id);

describe("글자 다듬기", () => {
  it("띄어쓰기·기호·대소문자 무시", () => {
    expect(normalize(" 타이틀 매치-미션! ")).toBe("타이틀매치미션");
    expect(normalize("DM 보내기")).toBe("dm보내기");
  });
  it("초성", () => {
    expect(toChosung("타이틀매치")).toBe("ㅌㅇㅌㅁㅊ");
    expect(isChosungOnly("ㅌㅇㅌ")).toBe(true);
    expect(isChosungOnly("타ㅇ")).toBe(false);
  });
  it("숫자 경계", () => {
    expect(includesWord("레벨10미션", "레벨10")).toBe(true);
    expect(includesWord("레벨10미션", "레벨1")).toBe(false);
    expect(includesWord("레벨1", "레벨1")).toBe(true);
    expect(includesWord("10일차", "1")).toBe(false);
  });
  it("영상 제목 나누기", () => {
    expect(splitVideoTitle("[복싱/잽] 백스텝 잽ㅣ잽 치고 빠졌다가 다시 찌르기")).toEqual({ tag: "잽", name: "백스텝 잽", sub: "잽 치고 빠졌다가 다시 찌르기" });
  });
});

describe("대표님 예시 — 타이틀매치 미션", () => {
  it.each(["타이틀매치미션", "타이틀매치 미션", "타이틀 매치 미션", "타이틀매치", "타이틀매치 미션 영상", "ㅌㅇㅌㅁㅊ"])("'%s' → 타이틀매치 영상이 영상 묶음 맨 위", (q) => {
    const hits = searchEntries(ALL, q);
    const videos = hits.filter((h) => h.entry.group === "video");
    expect(videos[0]?.entry.id).toBe("v:m10a");
    // 레벨 1 영상·워밍업 영상은 딸려 나오지 않는다
    expect(videos.map((h) => h.entry.id)).not.toContain("v:m1");
    expect(videos.map((h) => h.entry.id)).not.toContain("v:w1");
  });
  it("타이틀매치 바로가기도 같이 나온다", () => {
    expect(ids("타이틀매치미션")).toContain("f:title-match");
  });
  it("타이틀매치 바로가기는 타이틀매치 메뉴로 간다", () => {
    const e = FEATURES.find((x) => x.id === "f:title-match")!;
    expect(e.action).toEqual({ kind: "route", to: "/title-match" });
    expect(e.glyph).toBe("titlematch");
  });
  it.each(["블루 타이틀매치", "레벨 20", "레벨40", "타이틀매치 영상"])("'%s' → 타이틀매치 메뉴가 바로가기 맨 위", (q) => {
    const features = searchEntries(ALL, q).filter((h) => h.entry.group === "feature");
    expect(features[0]?.entry.id).toBe("f:title-match");
  });
  it("레벨 2 는 레벨 20 관련어에 걸리지 않는다", () => {
    expect(ids("레벨 2")).not.toContain("f:title-match");
  });
  it("영상 묶음이 먼저 보일 만큼 점수가 높다", () => {
    const groups = groupHits(searchEntries(ALL, "타이틀매치미션"));
    expect(groups.map((g) => g.group).slice(0, 2)).toEqual(expect.arrayContaining(["video", "feature"]));
    expect(groups[0].hits[0].score).toBeGreaterThanOrEqual(60);
  });
});

describe("자주 찾는 말", () => {
  it("마일리지 → 마일리지 바로가기가 1등", () => {
    expect(ids("마일리지")[0]).toBe("f:mileage");
  });
  it("비번 → 아이디·비밀번호 바꾸기", () => {
    expect(ids("비번")[0]).toBe("f:credentials");
  });
  it("닉네임 → 닉네임 바꾸기가 1등", () => {
    expect(ids("닉네임")[0]).toBe("f:nickname");
  });
  it("알림 · 공지 → 알림함", () => {
    expect(ids("알림")[0]).toBe("f:notifications");
    expect(ids("공지")[0]).toBe("f:notifications");
  });
  it("출석왕 → 153 챌린지", () => {
    expect(ids("출석왕")[0]).toBe("f:challenge");
  });
  it("1일차 → 1일차 수업 (10일차·레벨10 은 아님)", () => {
    const r = ids("1일차");
    expect(r[0]).toBe("l:1");
    expect(r).not.toContain("l:6");
  });
  it("원투 → 6일차 수업", () => {
    expect(ids("원투")).toContain("l:6");
  });
  it("줄넘기 → 워밍업 영상", () => {
    expect(ids("줄넘기")).toContain("v:w1");
  });
  it("숫자 낱말은 옆 낱말에 붙는다", () => {
    expect(queryTokens("레벨 1")).toEqual(["레벨1"]);
    expect(queryTokens("1 일차 수업")).toEqual(["1일차", "수업"]);
    expect(queryTokens("잽 영상")).toEqual(["잽", "영상"]);
  });
  it("레벨 1 은 레벨 10 영상을 끌고 오지 않는다", () => {
    const r = ids("레벨 1");
    expect(r).not.toContain("v:m10a");
  });
  it("아무 말도 없으면 결과 없음", () => {
    expect(searchEntries(ALL, "   ")).toEqual([]);
    expect(scoreEntry(FEATURES[0], "")).toBe(0);
  });
  it("엉뚱한 말이면 결과 없음", () => {
    expect(ids("qqqq")).toEqual([]);
  });
});

describe("누가 볼 수 있나", () => {
  const coach = FEATURES.find((e) => e.id === "f:coach")!;
  const diet = FEATURES.find((e) => e.id === "f:diet")!;
  const dm = FEATURES.find((e) => e.id === "f:messages")!;
  it("지도진 전용은 회원에게 숨김", () => {
    expect(visibleFor(coach, { staff: false, diet: true, dm: true })).toBe(false);
    expect(visibleFor(coach, { staff: true, diet: false, dm: true })).toBe(true);
  });
  it("다이어트·메시지는 켜진 회원에게만", () => {
    expect(visibleFor(diet, { staff: false, diet: false, dm: true })).toBe(false);
    expect(visibleFor(dm, { staff: false, diet: false, dm: false })).toBe(false);
  });
  it("앱 경로는 모두 / 로 시작", () => {
    for (const e of FEATURES) {
      if (e.action.kind === "route") expect(e.action.to.startsWith("/")).toBe(true);
    }
    expect(new Set(FEATURES.map((e) => e.id)).size).toBe(FEATURES.length);
  });
});

describe("묶음당 개수 제한", () => {
  it("영상이 많아도 묶음마다 limit 까지만", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      videoEntry({ id: `x${i}`, title: `[복싱/잽] 잽 연습 ${i}`, keyPoints: [], videoUrl: "https://youtu.be/aaaaaa", category: "level", rank: "white", level: 1 }),
    );
    const hits = searchEntries(many, "잽", 5);
    expect(hits.length).toBe(5);
  });
});

describe("최근 검색", () => {
  beforeEach(() => clearRecent());
  it("앞에 쌓이고 같은 말은 한 번만", () => {
    pushRecent("마일리지");
    pushRecent("타이틀매치");
    pushRecent(" 마일리지 ");
    expect(loadRecent()).toEqual(["마일리지", "타이틀매치"]);
  });
  it("빈 말은 저장 안 함", () => {
    pushRecent("   ");
    expect(loadRecent()).toEqual([]);
  });
});
