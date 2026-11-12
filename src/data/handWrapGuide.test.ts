import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_DEFAULT_REAL_RATE,
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_DEFAULT_VIEW,
  HANDWRAP_DONE_CHECKS,
  HANDWRAP_DONE_PHOTOS,
  HANDWRAP_FULL,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_REAL_HAND,
  HANDWRAP_STAGES,
  HANDWRAP_STAGES_LINE,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_LABEL,
  HANDWRAP_VIEW_NOTE,
  REAL_MEDIA_VERSION,
  handWrapIndexAt,
  handWrapRealFlip,
  handWrapStageMark,
  handWrapStageName,
  handWrapStepAt,
  handWrapStepLabel,
  handWrapStepParam,
  mirrorArrows,
} from "./handWrapGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];
const PUBLIC = join(__dirname, "..", "..", "public");
const stepText = (i: number) => {
  const s = HANDWRAP_STEPS[i];
  return [s.title, s.short, s.dir, ...s.how, s.tip ?? ""].join(" ");
};
const file = (url: string) => join(PUBLIC, url.split("?")[0]);

describe("붕대 감기 — 코팅 설명서와 같은 12단계 그림 애니메이션 (2026-10-30)", () => {
  it("12단계 + 완성 — 마지막 칸만 완성, 번호는 1~12", () => {
    expect(HANDWRAP_STEPS).toHaveLength(13);
    expect(HANDWRAP_NUMBERED_STEPS).toBe(12);
    expect(HANDWRAP_STEPS.filter((s) => s.final)).toHaveLength(1);
    expect(HANDWRAP_STEPS[12].final).toBe(true);
    expect(handWrapStepLabel(0)).toBe("1단계");
    expect(handWrapStepLabel(11)).toBe("12단계");
    expect(handWrapStepLabel(12)).toBe("완성");
  });

  it("코팅 설명서 글과 같은 순서", () => {
    expect(HANDWRAP_STEPS.map((s) => s.sheet)).toEqual([
      "엄지손가락에 걸어주세요",
      "손목을 지나 손등 위 바퀴",
      "손등을 지나 정권부위로",
      "정권부위 위 바퀴",
      "다시 손목으로",
      "한바퀴 감고",
      "새끼와 엄지 사이 통과",
      "통과한 붕대를 손가락 사이로",
      "넘어와 손목 감고",
      "새끼와 엄지 통과",
      "한번 더 동일",
      "새끼와 엄지 통과",
      "완성된 모습",
    ]);
  });

  it("단계마다 제목 · 짧은 글 · 시작/끝 · 자세한 설명 · 방향", () => {
    for (const s of HANDWRAP_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(1);
      expect(s.short.trim().length).toBeGreaterThan(5);
      expect(s.from.trim()).toBeTruthy();
      expect(s.to.trim()).toBeTruthy();
      expect(s.how.length).toBeGreaterThanOrEqual(2);
      for (const h of s.how) expect(h.trim().length).toBeGreaterThan(5);
      expect(s.dir.trim().length).toBeGreaterThan(5);
    }
  });

  it("손마다 애니메이션 · 끝 장면 · 작은 그림이 public 에 있고 가볍다 (거울로 뒤집지 않고 따로 만든 왼손)", () => {
    HANDWRAP_STEPS.forEach((s, i) => {
      const id = `step${String(i + 1).padStart(2, "0")}`;
      for (const [hand, suffix] of [["right", ""], ["left", "_l"]] as const) {
        const m = s.media[hand];
        // 주소 끝 ?v= 는 다시 만든 판 표시(폰 캐시 넘기기) — 파일은 같은 자리
        expect(m.clip.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}.mp4`);
        expect(m.image.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}.webp`);
        expect(m.thumb.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}_s.webp`);
        for (const url of [m.clip, m.image, m.thumb]) {
          expect(existsSync(file(url)), url).toBe(true);
          expect(statSync(file(url)).size, url).toBeLessThan(400 * 1024);
        }
        expect(statSync(file(m.thumb)).size).toBeLessThan(20 * 1024);
      }
    });
    // 예전 9단계 뒤에 붙을 파일이 없다
    expect(existsSync(join(PUBLIC, "handwrap/steps/step14.mp4"))).toBe(false);
  });

  it("기본 손은 오른손 · 보는 방향 글 · 대각선 화살표는 오른손 기준(왼손이면 뒤집기)", () => {
    expect(HANDWRAP_DEFAULT_HAND).toBe("right");
    expect(HANDWRAP_VIEW_NOTE.right).toContain("엄지가 왼쪽");
    expect(HANDWRAP_VIEW_NOTE.left).toContain("엄지가 오른쪽");
    expect(mirrorArrows("올라가(↗) 내려와(↘) ↖ ↙ → ↑")).toBe("올라가(↖) 내려와(↙) ↗ ↘ → ↑");
  });

  it("상세 주소 ?step=N — 1~13만 (13 = 완성)", () => {
    expect(handWrapStepParam("1")).toBe(0);
    expect(handWrapStepParam("12")).toBe(11);
    expect(handWrapStepParam("13")).toBe(12);
    expect(handWrapStepParam("0")).toBeNull();
    expect(handWrapStepParam("14")).toBeNull();
    expect(handWrapStepParam("2.5")).toBeNull();
    expect(handWrapStepParam("abc")).toBeNull();
    expect(handWrapStepParam(null)).toBeNull();
  });

  it("속도 — 기본 보통 · 더 천천히 둘", () => {
    expect(HANDWRAP_STEP_SPEEDS.map((s) => s.rate)).toEqual([0.5, 0.75, 1]);
    expect(HANDWRAP_STEP_SPEEDS.some((s) => s.rate === HANDWRAP_DEFAULT_STEP_RATE)).toBe(true);
  });

  it("감는 방향이 글에도 있다 — 손등에서 엄지 → 새끼 · 올라가는 ↗ · 내려가는 ↘ · 손등 X자 · 손가락 사이 · 벨크로 손목 바깥쪽", () => {
    const all = HANDWRAP_STEPS.map((_, i) => stepText(i)).join(" ");
    expect(all).toContain("엄지 쪽 → 새끼 쪽");
    expect(all).not.toContain("새끼 → 엄지");
    expect(stepText(2)).toContain("↗");
    expect(stepText(4)).toContain("↘");
    expect(stepText(4)).toContain("X자");
    expect(stepText(6)).toContain("새끼손가락과 약지 사이");
    expect(stepText(7)).toContain("엄지와 검지 사이");
    expect(stepText(11)).toContain("손목 바깥쪽");
    expect(HANDWRAP_STEPS[0].title).toContain("엄지");
    expect(HANDWRAP_KEY_POINTS[0]).toContain("엄지");
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([
      HANDWRAP_STEPS,
      HANDWRAP_MISTAKES,
      HANDWRAP_KEY_POINTS,
      HANDWRAP_STEP_SPEEDS,
      HANDWRAP_VIEW_NOTE,
      HANDWRAP_STAGES,
      HANDWRAP_STAGES_LINE,
      HANDWRAP_DONE_CHECKS,
      HANDWRAP_DONE_PHOTOS,
      HANDWRAP_FULL,
      HANDWRAP_VIEW_LABEL,
    ]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
    // 회원 글에는 '국가대표'를 쓰지 않는다
    expect(all.includes("국가대표")).toBe(false);
  });
});

describe("붕대 감기 — 실제 영상 · 큰 흐름 3 · 3 · 3 · 완성 확인 (2026-11-12)", () => {
  const MB = 1024 * 1024;
  const size = (url: string) => statSync(file(url)).size;

  it("처음은 실제 영상 · 절반 속도 — 영상에는 왼손이 찍혀 있어 오른손이면 좌우를 뒤집는다", () => {
    expect(HANDWRAP_DEFAULT_VIEW).toBe("real");
    expect(HANDWRAP_DEFAULT_REAL_RATE).toBe(0.5);
    expect(HANDWRAP_STEP_SPEEDS.some((sp) => sp.rate === HANDWRAP_DEFAULT_REAL_RATE)).toBe(true);
    expect(HANDWRAP_REAL_HAND).toBe("left");
    expect(handWrapRealFlip("right")).toBe(true);
    expect(handWrapRealFlip("left")).toBe(false);
    expect(HANDWRAP_VIEW_LABEL).toEqual({ real: "실제 영상", draw: "그림" });
  });

  it("단계마다 실제 영상 · 끝 장면이 public 에 있다 — 한 편 1.5MB 아래 · 13편 합쳐 6MB 아래", () => {
    let total = 0;
    HANDWRAP_STEPS.forEach((s, i) => {
      const id = `step${String(i + 1).padStart(2, "0")}`;
      expect(s.real.clip).toBe(`/handwrap/real/${id}.mp4?v=${REAL_MEDIA_VERSION}`);
      expect(s.real.image).toBe(`/handwrap/real/${id}.webp?v=${REAL_MEDIA_VERSION}`);
      for (const url of [s.real.clip, s.real.image]) expect(existsSync(file(url)), url).toBe(true);
      expect(size(s.real.clip), s.real.clip).toBeLessThan(1.5 * MB);
      expect(size(s.real.clip), s.real.clip).toBeGreaterThan(50 * 1024);
      expect(size(s.real.image), s.real.image).toBeLessThan(80 * 1024);
      total += size(s.real.clip);
    });
    expect(total).toBeLessThan(6 * MB);
    expect(existsSync(join(PUBLIC, "handwrap/real/step14.mp4"))).toBe(false);
  });

  it("전체 영상 두 편(내 눈으로 · 옆에서)과 표지 — 한 편 5MB 아래 · 단계 초는 '내 눈으로'만 안다", () => {
    expect(Object.keys(HANDWRAP_FULL)).toEqual(["mine", "side"]);
    for (const v of Object.values(HANDWRAP_FULL)) {
      for (const url of [v.src, v.poster]) expect(existsSync(file(url)), url).toBe(true);
      expect(size(v.src), v.src).toBeLessThan(5 * MB);
      expect(size(v.poster), v.poster).toBeLessThan(120 * 1024);
      expect(v.seconds).toBeGreaterThan(30);
      expect(v.seconds).toBeLessThan(v.duration);
      // 큰 흐름 네 덩이 — 0초에서 시작 · 늘 커지고 · 영상 길이 안
      expect(v.stageAt).toHaveLength(HANDWRAP_STAGES.length);
      expect(v.stageAt[0]).toBe(0);
      v.stageAt.forEach((t, i) => {
        if (i > 0) expect(t).toBeGreaterThan(v.stageAt[i - 1]);
        expect(t).toBeLessThan(v.duration);
      });
      expect(v.label.length).toBeGreaterThan(1);
      expect(v.switchLabel).toContain(v.label);
    }
    expect(HANDWRAP_FULL.mine.steps).toBe(true);
    expect(HANDWRAP_FULL.side.steps).toBe(false);
    // 예전 720p 전체 화면 파일은 지웠다 (새 파일이 같은 원본의 더 선명한 판)
    for (const old of ["front.mp4", "front.webp", "side.mp4", "side.webp"]) {
      expect(existsSync(join(PUBLIC, "handwrap", old)), old).toBe(false);
    }
  });

  it("단계 시작 초 — 0초에서 시작 · 늘 커지고 · 전체 영상 길이 안", () => {
    expect(HANDWRAP_STEPS[0].at).toBe(0);
    HANDWRAP_STEPS.forEach((s, i) => {
      if (i > 0) expect(s.at, `${i + 1}단계`).toBeGreaterThan(HANDWRAP_STEPS[i - 1].at);
      expect(s.at).toBeLessThan(HANDWRAP_FULL.mine.duration);
    });
  });

  it("몇 초에 몇 단계 — handWrapStepAt · handWrapIndexAt", () => {
    expect(handWrapStepAt(0)).toBe(0);
    expect(handWrapStepAt(-1)).toBe(0);
    expect(handWrapStepAt(2.74)).toBe(0);
    expect(handWrapStepAt(2.75)).toBe(1);
    expect(handWrapStepAt(7.5)).toBe(2);
    expect(handWrapStepAt(10)).toBe(3);
    expect(handWrapStepAt(14)).toBe(4);
    expect(handWrapStepAt(16)).toBe(5);
    expect(handWrapStepAt(18.5)).toBe(6);
    expect(handWrapStepAt(20)).toBe(7);
    expect(handWrapStepAt(22)).toBe(8);
    expect(handWrapStepAt(26)).toBe(9);
    expect(handWrapStepAt(29)).toBe(10);
    expect(handWrapStepAt(35)).toBe(11);
    expect(handWrapStepAt(43)).toBe(12);
    expect(handWrapStepAt(999)).toBe(12);
    expect(handWrapIndexAt([0, 5, 10], 4.9)).toBe(0);
    expect(handWrapIndexAt([0, 5, 10], 5)).toBe(1);
    expect(handWrapIndexAt([0, 5, 10], 99)).toBe(2);
    expect(handWrapIndexAt([], 3)).toBe(0);
  });

  it("큰 흐름 네 덩이 3 · 3 · 3 — 손목 3바퀴 → 정권 3바퀴 → 손가락 사이 3번 → 마무리, 사진이 있다", () => {
    expect(HANDWRAP_STAGES.map((s) => s.name)).toEqual(["손목 3바퀴", "정권 3바퀴", "손가락 사이 3번", "손목에서 마무리"]);
    HANDWRAP_STAGES.forEach((s, i) => {
      expect(s.name.startsWith(s.title) || s.name.endsWith(s.title), s.name).toBe(true);
      expect(s.why.trim().length).toBeGreaterThan(5);
      expect(existsSync(file(s.photo)), s.photo).toBe(true);
      expect(size(s.photo)).toBeLessThan(40 * 1024);
      expect(handWrapStageName(i)).toBe(s.name);
    });
    expect([0, 1, 2, 3].map(handWrapStageMark)).toEqual(["①", "②", "③", "④"]);
    expect(handWrapStageName(9)).toBe("");
    expect(HANDWRAP_STAGES_LINE).toContain("→");
  });

  it("단계마다 큰 흐름 — 1~2 손목 · 3~6 정권 · 7~12 손가락 사이 · 완성 = 마무리 (글과 맞는다)", () => {
    expect(HANDWRAP_STEPS.map((s) => s.stage)).toEqual([1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    // 큰 흐름 글과 단계 글이 같은 말을 한다
    expect(stepText(1)).toContain("3바퀴"); // 손목 3바퀴
    expect(stepText(3)).toContain("3바퀴"); // 정권 3바퀴
    expect(stepText(6)).toContain("새끼손가락과 약지 사이");
    expect(stepText(9)).toContain("약지와 중지 사이");
    expect(stepText(11)).toContain("중지와 검지 사이");
    // '내 눈으로' 영상의 큰 흐름 시작 초 = 그 흐름 첫 단계 시작 초 (마무리는 12단계 안 — 남은 붕대를 감기 시작할 때)
    const at = HANDWRAP_FULL.mine.stageAt;
    expect(at[0]).toBe(HANDWRAP_STEPS[0].at);
    expect(at[1]).toBe(HANDWRAP_STEPS[2].at);
    expect(at[2]).toBe(HANDWRAP_STEPS[6].at);
    expect(at[3]).toBeGreaterThan(HANDWRAP_STEPS[11].at);
    expect(at[3]).toBeLessThan(HANDWRAP_STEPS[12].at);
  });

  it("흔한 실수 — 바르게 하는 모습이 나오는 단계로 이어진다 (그 단계 글에 같은 말이 있다)", () => {
    const linked = HANDWRAP_MISTAKES.filter((m) => m.step != null);
    expect(linked.length).toBeGreaterThanOrEqual(4);
    for (const m of linked) {
      expect(Number.isInteger(m.step)).toBe(true);
      expect(m.step as number).toBeGreaterThanOrEqual(0);
      expect(m.step as number).toBeLessThan(HANDWRAP_NUMBERED_STEPS);
    }
    const stepOf = (word: string) => HANDWRAP_MISTAKES.find((m) => m.wrong.includes(word))?.step as number;
    expect(stepText(stepOf("고리"))).toContain("고리");
    expect(stepText(stepOf("오므리고"))).toContain("손가락을 쫙");
    expect(stepText(stepOf("손목을 안 감아요"))).toContain("손목을 한 바퀴");
    expect(stepText(stepOf("벨크로"))).toContain("손목 바깥쪽");
    expect(stepText(stepOf("꼬이거나"))).toContain("평평하게");
  });

  it("완성 확인 — 다섯 가지 · 실제 사진 두 장 · 12단계 완성 글과 같은 말", () => {
    expect(HANDWRAP_DONE_CHECKS).toHaveLength(5);
    expect(new Set(HANDWRAP_DONE_CHECKS).size).toBe(5);
    const checks = HANDWRAP_DONE_CHECKS.join(" ");
    for (const w of ["정권", "X자", "손가락 사이", "벨크로", "손목 바깥쪽", "저리지"]) expect(checks, w).toContain(w);
    expect(HANDWRAP_DONE_PHOTOS).toHaveLength(2);
    for (const ph of HANDWRAP_DONE_PHOTOS) {
      expect(existsSync(file(ph.src)), ph.src).toBe(true);
      expect(ph.label.trim().length).toBeGreaterThan(1);
    }
  });
});
