import { describe, expect, it } from "vitest";
import {
  MATCH_CODE_RE,
  clockOf,
  filmBadge,
  filmBlockLine,
  matchLengthSec,
  seqLabel,
  thumbOf,
  youtubeIdOf,
} from "./sparringVideo";

describe("youtubeIdOf — DB sparvid_attach_video 와 같은 규칙", () => {
  it("여러 모양의 주소에서 11자 id", () => {
    expect(youtubeIdOf("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://studio.youtube.com/video/dQw4w9WgXcQ/edit")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("  dQw4w9WgXcQ ")).toBe("dQw4w9WgXcQ");
  });
  it("못 읽으면 null", () => {
    expect(youtubeIdOf("")).toBeNull();
    expect(youtubeIdOf(null)).toBeNull();
    expect(youtubeIdOf("https://example.com/abc")).toBeNull();
    expect(youtubeIdOf("short")).toBeNull();
  });
});

describe("경기 번호 · 시각 · 길이", () => {
  it("경기 번호 모양 = 노트북 파일 이름", () => {
    expect(MATCH_CODE_RE.test("sunreung-261125-07")).toBe(true);
    expect(MATCH_CODE_RE.test("b1a2b3c-261125-123")).toBe(true);
    expect(MATCH_CODE_RE.test("선릉-261125-07")).toBe(false);
    expect(MATCH_CODE_RE.test("sunreung-2611-07")).toBe(false);
  });
  it("영상 시각", () => {
    expect(clockOf(83.5)).toBe("1:23");
    expect(clockOf(5)).toBe("0:05");
    expect(clockOf(3725)).toBe("1:02:05");
    expect(clockOf(null)).toBe("");
    expect(clockOf(-1)).toBe("");
  });
  it("경기 길이 = 라운드 × 시간 + 사이 쉬는 시간", () => {
    expect(matchLengthSec(3, 120, 60)).toBe(480);
    expect(matchLengthSec(1, 180, 60)).toBe(180);
    expect(matchLengthSec(0, 180, 60)).toBe(0);
  });
  it("번호 표시", () => {
    expect(seqLabel(7)).toBe("#07");
    expect(seqLabel(12)).toBe("#12");
    expect(seqLabel(null)).toBe("");
  });
});

describe("촬영 표시", () => {
  it("까닭 한 줄", () => {
    expect(filmBlockLine({ a: null, b: "영상 동의 없음" }, "김", "이")).toBe("이 영상 동의 없음");
    expect(filmBlockLine({ a: "동의서 없음", b: "14세 미만" }, "김", "이")).toBe("김 동의서 없음 · 이 14세 미만");
    expect(filmBlockLine(null, "김", "이")).toBe("");
  });
  it("배지", () => {
    expect(filmBadge(null)).toEqual({ label: "🎥 촬영 가능", ok: true });
    expect(filmBadge("영상 동의 없음")).toEqual({ label: "영상 동의 없음", ok: false });
  });
  it("썸네일은 유튜브만", () => {
    expect(thumbOf("youtube", "dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
    expect(thumbOf("r2", "a/b.mp4")).toBeNull();
  });
});
