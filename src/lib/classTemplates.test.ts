import { describe, expect, it } from "vitest";
import {
  CLASS_TEMPLATES,
  TEMPLATE_OVERVIEW_STEP,
  classTemplateBlocks,
  classTemplateMinutes,
  classTemplateNote,
  formatClipLength,
  templateVideoKey,
  templateVideoPath,
  templateVideoTitle,
} from "./classTemplates";

// strategyService 의 BlockKind 와 같게 (서비스를 불러오면 Supabase 연결이 필요해서 여기 적어 둔다)
const KINDS = ["warmup", "skill", "mitt", "defense", "conditioning", "cooldown", "etc"];

describe("153 수업 템플릿", () => {
  it("이름은 겹치지 않고 규칙(소문자 · 숫자 · -)에 맞다", () => {
    const ids = CLASS_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("오늘 프로그램 입력 칸에 그대로 들어간다 (블록 종류 · 글자 수 · 분)", () => {
    for (const t of CLASS_TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.title.length).toBeLessThanOrEqual(120);
      expect(t.blocks.length).toBeGreaterThan(0);
      for (const b of t.blocks) {
        expect(KINDS).toContain(b.kind);
        expect(b.title.length).toBeGreaterThan(0);
        expect(b.title.length).toBeLessThanOrEqual(80);
        expect((b.note ?? "").length).toBeLessThanOrEqual(200);
        expect(Number.isInteger(b.minutes)).toBe(true);
        expect(b.minutes).toBeGreaterThanOrEqual(1);
        expect(b.minutes).toBeLessThanOrEqual(120);
      }
      expect(classTemplateNote(t).length).toBeLessThanOrEqual(1000);
    }
  });

  it("미트 두 콤보 + 샌드백 구령 — 50분 수업 · 대표님이 정한 순서", () => {
    const t = CLASS_TEMPLATES.find((x) => x.id === "mitt2-sandbag-call");
    expect(t).toBeTruthy();
    expect(classTemplateMinutes(t!)).toBe(50);
    expect(t!.blocks.map((b) => b.kind)).toEqual(["warmup", "mitt", "mitt", "conditioning", "etc"]);
    // 둘째 동작 대상 (11/11 대표님 — 레벨 10 또는 다른 곳에서 배운 경험이 있는 회원)
    expect(t!.who).toMatch(/레벨 10/);
    expect(t!.blocks[2].note).toMatch(/레벨 10/);
    expect(t!.blocks[3].note).toMatch(/30초/);
  });

  it("블록은 복사본 — 고쳐도 템플릿 원본은 그대로", () => {
    const t = CLASS_TEMPLATES[0];
    const copy = classTemplateBlocks(t);
    copy[0].title = "바꿈";
    expect(t.blocks[0].title).not.toBe("바꿈");
  });
});

describe("순서마다 참고 영상", () => {
  const t = CLASS_TEMPLATES[0];

  it("영상 자리는 DB step 칸(0~20)에 들어간다 — 블록은 20개까지", () => {
    for (const x of CLASS_TEMPLATES) expect(x.blocks.length).toBeLessThanOrEqual(20);
    expect(TEMPLATE_OVERVIEW_STEP).toBe(0);
    expect(templateVideoKey(t.id, 2)).toBe("mitt2-sandbag-call:2");
  });

  it("저장소 경로는 넣는 분 폴더 안 · 서버 규칙(템플릿 이름 · .. 없음)에 맞다", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const p = templateVideoPath(uid, t.id, 3, "mp4", "a1b2c3d4");
    expect(p).toBe(`${uid}/tpl-mitt2-sandbag-call-3-a1b2c3d4.mp4`);
    expect(p.split("/")[0]).toBe(uid);
    // 이상한 확장자 · 글자는 걸러진다
    const q = templateVideoPath(uid, t.id, 0, "../x", "../../zz");
    expect(q).not.toContain("..");
    expect(q.endsWith(".mp4")).toBe(true);
    expect(q.length).toBeLessThanOrEqual(300);
  });

  it("영상 길이 글", () => {
    expect(formatClipLength(31.4)).toBe("31초");
    expect(formatClipLength(165)).toBe("2:45");
    expect(formatClipLength(60)).toBe("1:00");
    expect(formatClipLength(null)).toBe("");
    expect(formatClipLength(0)).toBe("");
  });

  it("영상 창 제목 — 전체 흐름 · 블록 · 없는 블록", () => {
    expect(templateVideoTitle(t, 0)).toBe(`${t.title} · 수업 요약`);
    expect(templateVideoTitle(t, 2)).toBe(t.blocks[1].title);
    expect(templateVideoTitle(t, 99)).toBe(t.title);
  });
});
