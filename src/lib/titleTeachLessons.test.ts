import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TEACH_SERIES_TITLE,
  TITLE_TEACH_LESSONS,
  chantChunks,
  fillWho,
  lessonFor,
  readingMinutes,
  teachDayFromParam,
  teachVideoEmbed,
  titleTeachLink,
} from "./titleTeachLessons";
import { icon3dSrc } from "./emoji3d/map";
import { titleMatchLink } from "./titleMatchChallenge";
import { titleMissionGuideFor } from "./titleMissionGuide";

// 대표님 11:24 "부정어를 줄이고 긍정어로" — 화면 글에 쓰지 않는 말
const NEGATIVE = ["손해", "실패", "못 ", "못해", "안 돼", "안돼", "아쉬", "어색", "틀린", "틀려"];

const allText = (l: (typeof TITLE_TEACH_LESSONS)[number]) =>
  [
    l.kicker,
    l.title,
    l.lead,
    l.stats?.note ?? "",
    ...(l.stats?.items.map((s) => s.label) ?? []),
    ...l.research.flatMap((r) => [r.text, r.detail ?? ""]),
    ...(l.steps?.items.flatMap((s) => [s.label, s.text]) ?? []),
    ...(l.stories?.items.flatMap((s) => [s.who, s.text]) ?? []),
    ...l.gym,
    l.hero.caption,
    ...(l.videos ?? []).flatMap((v) => [v.title, ...(v.points ?? [])]),
    l.action.text,
    l.closing?.line ?? "",
    l.notice.title,
    l.notice.body,
  ].join(" ");

describe("titleTeachLessons — 설계 노트 3편", () => {
  it("1·2·3편이 순서대로 있고, 편마다 머리말 · 제목 · 설명 · 연구 · 체육관 · 행동 하나 · 출처가 있다", () => {
    expect(TITLE_TEACH_LESSONS.map((l) => l.day)).toEqual([1, 2, 3]);
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.kicker.startsWith(`설계 노트 ${l.day}`)).toBe(true);
      expect(l.title.length).toBeGreaterThan(5);
      expect(l.lead.length).toBeGreaterThan(10);
      expect(l.research.length).toBeGreaterThanOrEqual(3);
      expect(l.research.every((r) => r.text && r.by)).toBe(true);
      expect(l.gym.length).toBeGreaterThan(0);
      expect(l.action.text.length).toBeGreaterThan(5);
      // 연구 · 이야기 · 단계마다 출처가 있다 (출처 이름이 있는 것만큼 출처 줄)
      const cited =
        l.research.length +
        (l.stories?.items.filter((s) => s.by).length ?? 0) +
        (l.steps?.items.filter((s) => s.by).length ?? 0);
      expect(l.sources.length).toBe(cited);
    }
    expect(lessonFor(2).day).toBe(2);
  });

  it("출처 · 연구 · 이야기는 누르면 원문으로 — https 주소", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      for (const r of l.research) expect(r.url ?? "", `${l.day}편 ${r.by}`).toMatch(/^https:\/\//);
      for (const s of l.stories?.items ?? []) if (s.by) expect(s.url ?? "", `${l.day}편 ${s.who}`).toMatch(/^https:\/\//);
      for (const s of l.steps?.items ?? []) if (s.url) expect(s.url).toMatch(/^https:\/\//);
      for (const s of l.sources) {
        expect(s.label.length).toBeGreaterThan(10);
        if (s.url) expect(s.url).toMatch(/^https:\/\//);
      }
      // 책(피츠 · 포스너)만 주소 없이
      expect(l.sources.filter((s) => !s.url).every((s) => /Human Performance/.test(s.label))).toBe(true);
    }
  });

  it("사진 · 아이콘 · 쇼츠 표지 파일이 public 에 있다", () => {
    const pub = (src: string) => path.resolve(process.cwd(), "public", src.replace(/^\//, "").split("?")[0]);
    for (const l of TITLE_TEACH_LESSONS) {
      expect(existsSync(pub(l.hero.src)), l.hero.src).toBe(true);
      expect(l.hero.alt.length).toBeGreaterThan(5);
      const icons = [...(l.stories?.items ?? []), ...(l.steps?.items ?? [])].map((x) => x.icon);
      for (const name of icons) expect(existsSync(pub(icon3dSrc(name))), name).toBe(true);
      for (const v of l.videos ?? []) if (v.poster) expect(existsSync(pub(v.poster)), v.poster).toBe(true);
    }
  });

  it("영상 — 유튜브 번호 · TED 는 한국어 자막 페이지와 자막 켜기, 쇼츠는 표지", () => {
    const all = TITLE_TEACH_LESSONS.flatMap((l) => l.videos ?? []);
    expect(all.length).toBeGreaterThan(0);
    for (const v of all) {
      expect(v.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      const url = teachVideoEmbed(v);
      expect(url.startsWith(`https://www.youtube.com/embed/${v.id}?autoplay=1`)).toBe(true);
      if (v.kind === "ted") {
        expect(v.koUrl).toMatch(/^https:\/\/www\.ted\.com\/talks\/.+language=ko$/);
        expect(url).toContain("cc_lang_pref=ko");
        expect(v.points?.length ?? 0).toBeGreaterThan(0);
        expect(v.poster).toBeUndefined(); // 강연자 얼굴 사진 표지는 쓰지 않는다
      } else {
        expect(v.poster).toBeTruthy();
        expect(url).not.toContain("cc_lang_pref");
      }
    }
    expect(lessonFor(1).titleVideo).toBe(true);
  });

  it("숫자 두 칸 — 3번 연속 확률 계산이 맞다", () => {
    const stats = lessonFor(3).stats!;
    expect(stats.items.map((s) => s.pct)).toEqual([12.5, 72.9]);
    expect(0.5 ** 3 * 100).toBeCloseTo(12.5);
    expect(0.9 ** 3 * 100).toBeCloseTo(72.9);
    expect(stats.items[1].value).toBe("73%");
  });

  it("읽는 시간은 1분 이상", () => {
    for (const l of TITLE_TEACH_LESSONS) expect(readingMinutes(l)).toBeGreaterThanOrEqual(1);
  });

  it("설득하는 질문 대신 설계를 설명한다 — 큰 제목은 질문이 아니다", () => {
    for (const l of TITLE_TEACH_LESSONS) expect(l.title.endsWith("?")).toBe(false);
    expect(lessonFor(1).notice.title).toContain(TEACH_SERIES_TITLE.replace(" · ", " · "));
  });

  it("부정어를 쓰지 않는다", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      const text = allText(l);
      for (const w of NEGATIVE) expect(text.includes(w), `${l.day}편에 '${w}'`).toBe(false);
    }
  });

  it("근거 없는 말은 쓰지 않는다 — 학습 피라미드 90% · 1만 시간 · 최적", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      const text = allText(l);
      expect(text).not.toMatch(/90%|1만 시간|만 시간의 법칙|최적/);
    }
  });

  it("알림 글은 휴대폰 두 줄에 들어갈 길이 · 몇 편인지 표시", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.notice.title.length).toBeLessThanOrEqual(40);
      expect(l.notice.body.length).toBeLessThanOrEqual(60);
      expect(l.notice.body.startsWith(`설계 노트 ${l.day}/3`)).toBe(true);
    }
  });

  it("?why= 는 1~3 만", () => {
    expect(teachDayFromParam("1")).toBe(1);
    expect(teachDayFromParam("3")).toBe(3);
    expect(teachDayFromParam("0")).toBeNull();
    expect(teachDayFromParam("4")).toBeNull();
    expect(teachDayFromParam("x")).toBeNull();
    expect(teachDayFromParam(null)).toBeNull();
  });

  it("알림 링크는 DB title_match_link('white') || '&why=' 과 같은 모양", () => {
    expect(titleTeachLink(2)).toBe(`${titleMatchLink("white")}&why=2`);
  });

  it("외우는 말을 덩어리로 — 화이트 9동작", () => {
    const chant = titleMissionGuideFor("white")?.chant ?? "";
    expect(chantChunks(chant)).toEqual(["잽 잽 원투", "빠지고 꽂고", "돌고 원투", "빠지고 꽂고"]);
    expect(chantChunks("")).toEqual([]);
  });

  it("행동 글의 {who} 를 심사하는 사람으로", () => {
    expect(fillWho("{who}께 심사를 신청해요", "지점장님")).toBe("지점장님께 심사를 신청해요");
    expect(fillWho(lessonFor(3).action.text, "관장님")).toContain("관장님께");
  });
});
