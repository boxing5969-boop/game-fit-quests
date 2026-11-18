import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import {
  APP_ORIGIN,
  PULSE_MIN,
  SCENE_MS,
  awardsStripOf,
  buildReel,
  hoursText,
  manText,
  normalizeMileage,
  normalizePulse,
  sceneIndexAt,
  sceneOffsetAt,
  type AppPulse,
  type ValueScene,
} from "./appValueReel";
import { awardsView, normalizeAwards } from "./launchAwards";

// 지어낸 숫자만 — 저장소가 공개라 실제 지점 숫자를 시험에 쓰지 않는다
const SUNREUNG = "153복싱짐 선릉역점";
const RAW_PULSE = {
  branch: SUNREUNG,
  days: 28,
  members: 120,
  visits: 900,
  minutes: 61_234,
  level_ups: 88,
  points: 352_100,
  rules: {
    mileage: { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 },
    levels: [
      { rank: "white", visits: 3, auto: true, first: 1, last: 10 },
      { rank: "blue", visits: 5, auto: true, first: 11, last: 20 },
      { rank: "red", visits: 8, auto: false, first: 21, last: 30 },
      { rank: "black", visits: 20, auto: false, first: 31, last: 40 },
      { rank: "gold", visits: 1 },
    ],
  },
  features: { promise: true, return_bonus: 5000, weather: true, market: true, market_count: 60 },
};
const PULSE = normalizePulse(RAW_PULSE)!;
const TODAY = "2026-11-18";
const full = () => buildReel({ branch: SUNREUNG, pulse: PULSE, today: TODAY });

/** 장면 안 글(왼쪽) · 그림 글(오른쪽)을 따로 모은다 */
const textOf = (s: ValueScene) => [s.tag, s.kicker, ...s.hook, s.answer, ...s.proofs, s.ease, ...s.qr.caption];
const visualOf = (s: ValueScene): string[] => {
  const v = s.visual;
  switch (v.kind) {
    case "pulse":
      return [v.caption ?? "", v.hero ?? "", v.heroLabel ?? "", ...v.flow];
    case "leagues":
      return [...v.leagues.flatMap((l) => [l.name, l.range]), v.chip?.label ?? "", v.chip?.value ?? ""];
    case "shelves":
      return v.shelves.map((x) => x.label);
    case "ladder":
      return [...v.rows.flatMap((r) => [r.label, r.plus]), v.chip?.label ?? "", v.chip?.value ?? ""];
    case "calendar":
      return [];
    case "promise":
      return [...v.days, v.notice];
    case "together":
      return [v.title, v.call, v.joined];
    case "bodymind":
      return [...v.cards.flatMap((c) => [c.tag, c.label, c.value]), v.source];
    case "market":
      return [v.count ?? "", ...v.rows.flatMap((r) => [r.label, r.save])];
  }
};

/** TV 글 폭 어림 — 한글 1칸 · 숫자 · 영문 0.58 · 빈칸 0.3 · 가운뎃점 0.5 · 꺾쇠 1 */
const units = (t: string) => {
  let u = 0;
  for (const ch of t) {
    if (/[ㄱ-ㆎ가-힣「」]/.test(ch)) u += 1;
    else if (ch === " ") u += 0.3;
    else if (ch === "·") u += 0.5;
    else if (/[,!:.]/.test(ch)) u += 0.35;
    else u += 0.58;
  }
  return u;
};

const BANNED =
  /국가대표|태릉|선수 ?출신|프로 ?출신|엘리트|메달|최고|프리미엄|압도적|무조건|보장|확정 ?혜택|벨트|계급|급수|잽부터|끝까지 ?붙|정성을 다|고객 만족|가족 같은|믿고 맡겨|년 전통|오삼코치|오사미|—|100%|건강 나이|일오삼|실패|밀린|못 ?했|못한/;

/** 여러 경우의 장면을 모두 모은다 — 서버 숫자 있음 · 없음 · 다른 지점 · 마일리지 꺼짐 */
const variants = (): ValueScene[][] => [
  full(),
  buildReel({ branch: SUNREUNG, pulse: null, today: TODAY }),
  buildReel({ branch: SUNREUNG, pulse: null, awardsRules: PULSE.mileage, today: TODAY }),
  buildReel({ branch: "153복싱짐 칠금점", pulse: null, today: TODAY }),
  buildReel({ branch: "153복싱짐 종로점", pulse: null, today: TODAY }),
  buildReel({ branch: SUNREUNG, pulse: { ...PULSE, mileage: { ...PULSE.mileage!, enabled: false } }, today: TODAY }),
  buildReel({ branch: SUNREUNG, pulse: { ...PULSE, members: 3 }, today: TODAY }),
];

describe("마이복서153 가치 전달 — 서버 값 다듬기", () => {
  it("모양이 다르면 null", () => {
    expect(normalizePulse(null)).toBeNull();
    expect(normalizePulse([])).toBeNull();
    expect(normalizePulse({ members: 3 })).toBeNull();
    expect(normalizePulse({ branch: "  " })).toBeNull();
  });
  it("숫자 · 규칙 · 켠 기능을 읽고 모르는 리그는 버린다", () => {
    expect(PULSE.members).toBe(120);
    expect(PULSE.minutes).toBe(61_234);
    expect(PULSE.levelUps).toBe(88);
    expect(PULSE.levels.map((l) => l.rank)).toEqual(["white", "blue", "red", "black"]);
    expect(PULSE.levels[0].visits).toBe(3);
    expect(PULSE.mileage).toEqual({ enabled: true, attendance: 300, levelUp: 300, titleMatch: 2500, record: 10000 });
    expect(PULSE.features).toEqual({ promise: true, returnBonus: 5000, weather: true, market: true, marketCount: 60 });
  });
  it("숫자가 아니거나 음수면 0 · 규칙의 0 은 없음", () => {
    const p = normalizePulse({ branch: "x", members: "열", minutes: -5, rules: { mileage: { enabled: true, attendance: 0, record: "100" } } })!;
    expect(p.members).toBe(0);
    expect(p.minutes).toBe(0);
    expect(p.days).toBe(28);
    expect(p.mileage).toEqual({ enabled: true, attendance: null, levelUp: null, titleMatch: null, record: 100 });
    expect(normalizeMileage({ enabled: true, levelUp: 300 })?.levelUp).toBe(300);
  });
  it("글 숫자 — 시간은 내림 · 만 단위", () => {
    expect(hoursText(61_234)).toBe("1,020시간");
    expect(hoursText(59)).toBe("0시간");
    expect(manText(559_430)).toBe("55만 9,430");
    expect(manText(30_000)).toBe("3만");
    expect(manText(980)).toBe("980");
  });
});

describe("마이복서153 가치 전달 — 장면", () => {
  it("서버 숫자가 있고 기능을 다 켠 지점: 아홉 장면 · 차례대로 · 그림 틀이 모두 다르다", () => {
    const r = full();
    expect(r.map((s) => s.id)).toEqual(["record", "level", "learn", "mileage", "calendar", "promise", "together", "bodymind", "market"]);
    expect(new Set(r.map((s) => s.visual.kind)).size).toBe(r.length);
    expect(new Set(r.map((s) => s.hook.join(" "))).size).toBe(r.length);
  });
  it("기록 장면 — 지난 4주 운동 시간이 주인공 숫자", () => {
    const v = full()[0].visual;
    expect(v.kind).toBe("pulse");
    if (v.kind !== "pulse") return;
    expect(v.hero).toBe("1,020시간");
    expect(v.caption).toBe("지난 4주 · 선릉역점");
    expect(v.heroLabel).toBe("회원님 120명이 쌓은 운동 시간");
  });
  it("레벨 장면 — 한 레벨 출석 수는 서버 규칙 그대로 · 레벨업 수", () => {
    const s = full()[1];
    expect(s.hook).toEqual(["레벨 2까지,", "몇 번 오면 될까요?"]);
    expect(s.answer).toBe("화이트 리그는 3번이면 한 레벨");
    if (s.visual.kind !== "leagues") throw new Error("leagues");
    expect(s.visual.leagues.map((l) => l.range)).toEqual(["레벨 1~10", "레벨 11~20", "레벨 21~30", "레벨 31~40"]);
    expect(s.visual.chip).toEqual({ label: "지난 4주", value: "레벨업 88번" });
  });
  it("마일리지 장면 — 규칙 사다리 · 쌓인 마일리지는 '점'(원으로 말하지 않는다)", () => {
    const s = full()[3];
    if (s.visual.kind !== "ladder") throw new Error("ladder");
    // 출석 · 레벨업이 같은 값이면 한 줄(칸이 낮은 날에도 사다리가 다 들어가게)
    expect(s.visual.rows).toEqual([
      { label: "출석 · 레벨업", plus: "+300점", big: false },
      { label: "타이틀매치", plus: "+2,500점", big: false },
      { label: "153 레코드", plus: "+10,000점", big: true },
    ]);
    expect(s.visual.chip).toEqual({ label: "지난 4주 회원님들에게", value: "35만 2,100점 쌓였어요" });
    const apart = buildReel({ branch: SUNREUNG, pulse: { ...PULSE, mileage: { ...PULSE.mileage!, levelUp: 500 } }, today: TODAY });
    const ap = apart.find((x) => x.id === "mileage")!.visual;
    if (ap.kind !== "ladder") throw new Error("ladder");
    expect(ap.rows.slice(0, 2)).toEqual([
      { label: "출석", plus: "+300점", big: false },
      { label: "레벨업", plus: "+500점", big: false },
    ]);
    expect([...textOf(s), ...visualOf(s)].join(" ")).not.toMatch(/\d[\d,]*\s*원/);
  });
  it("약속 · 마켓 — 다시 시작 보너스 · 상품 수는 서버 숫자", () => {
    const r = full();
    const promise = r.find((s) => s.id === "promise")!;
    if (promise.visual.kind !== "promise") throw new Error("promise");
    expect(promise.proofs[2]).toBe("쉬었다 오면 보너스 5,000점 · 한 달 한 번");
    expect(promise.visual.notice).toBe("오늘은 운동 약속한 날이에요");
    const market = r.find((s) => s.id === "market")!;
    if (market.visual.kind !== "market") throw new Error("market");
    expect(market.visual.count).toBe("용품 60가지");
  });
  it("숫자가 작으면 숨긴다 — 회원 10명 아래면 숫자 없이 흐름 그림", () => {
    const r = buildReel({ branch: SUNREUNG, pulse: { ...PULSE, members: PULSE_MIN.members - 1 }, today: TODAY });
    const rec = r[0].visual;
    if (rec.kind !== "pulse") throw new Error("pulse");
    expect(rec.hero).toBeNull();
    expect(rec.flow).toEqual(["출석", "운동 시간", "레벨", "마일리지"]);
    const lv = r[1].visual;
    if (lv.kind !== "leagues") throw new Error("leagues");
    expect(lv.chip).toBeNull();
    const ld = r.find((s) => s.id === "mileage")!.visual;
    if (ld.kind !== "ladder") throw new Error("ladder");
    expect(ld.chip).toBeNull();
    const few = buildReel({ branch: SUNREUNG, pulse: { ...PULSE, levelUps: 4, points: 9000, features: { ...PULSE.features, marketCount: 3 } }, today: TODAY });
    expect((few[1].visual as { chip: unknown }).chip).toBeNull();
    expect((few.find((s) => s.id === "mileage")!.visual as { chip: unknown }).chip).toBeNull();
    expect((few.find((s) => s.id === "market")!.visual as { count: unknown }).count).toBeNull();
  });
  it("서버 함수가 없을 때 — 숫자 없이, 선릉역점은 아는 대로(약속 · 마켓), 마일리지는 수상자 규칙이 있을 때만", () => {
    const none = buildReel({ branch: SUNREUNG, pulse: null, today: TODAY });
    expect(none.map((s) => s.id)).toEqual(["record", "level", "learn", "calendar", "promise", "together", "bodymind", "market"]);
    expect(none[1].answer).toBe("출석만으로 한 레벨씩 올라가요");
    expect(none[1].hook).toEqual(["오는 만큼", "레벨이 오를까요?"]);
    const promise = none.find((s) => s.id === "promise")!;
    expect(promise.proofs[2]).toBe("휴대폰 캘린더에도 넣을 수 있어요");
    const withAwards = buildReel({ branch: SUNREUNG, pulse: null, awardsRules: PULSE.mileage, today: TODAY });
    expect(withAwards.map((s) => s.id)).toContain("mileage");
  });
  it("시범이 아닌 지점 — 약속 · 마켓 장면 없음 · 날씨 도장이 없으면 다른 훅", () => {
    const chilgeum = buildReel({ branch: "153복싱짐 칠금점", pulse: null, today: TODAY });
    expect(chilgeum.map((s) => s.id)).not.toContain("promise");
    expect(chilgeum.map((s) => s.id)).not.toContain("market");
    const cal = chilgeum.find((s) => s.id === "calendar")!;
    expect(cal.answer).toBe("달력에 우산 도장이 찍혀요");
    expect(cal.proofs[2]).toBe("그날 쓴 한 줄 · 사진도 함께");
    const other = buildReel({ branch: "153복싱짐 종로점", pulse: null, today: TODAY }).find((s) => s.id === "calendar")!;
    expect(other.kicker).toBe("바쁜 한 주에도 시간을 냈다면");
    expect(other.answer).toBe("달력에 도장이 남아요");
    if (other.visual.kind !== "calendar") throw new Error("calendar");
    expect(other.visual).toMatchObject({ weather: false, coach: false, promise: false });
  });
  it("마일리지를 끈 지점 — 마일리지 장면 없음 · 레벨 장면도 마일리지 말을 하지 않는다", () => {
    const off = buildReel({ branch: SUNREUNG, pulse: { ...PULSE, mileage: { ...PULSE.mileage!, enabled: false } }, today: TODAY });
    expect(off.map((s) => s.id)).not.toContain("mileage");
    expect(off[1].proofs.join(" ")).not.toMatch(/마일리지/);
    const rec = off[0].visual;
    expect(rec.kind === "pulse" && rec.flow).toEqual(["출석", "운동 시간", "레벨"]);
  });
  it("QR — 마이복서153 주소 하나씩 · 어디서 왔는지 · 달력은 오늘 · 몸과 마음은 마음 체크 칸", () => {
    for (const s of full()) {
      expect(s.qr.url.startsWith(`${APP_ORIGIN}/`)).toBe(true);
      expect(s.qr.url).toMatch(/[?&]from=tv-value$/);
      expect(s.qr.caption).toHaveLength(2);
    }
    const r = full();
    expect(r.find((s) => s.id === "calendar")!.qr.url).toBe(`${APP_ORIGIN}/home?cal=${TODAY}&from=tv-value`);
    expect(r.find((s) => s.id === "bodymind")!.qr.url).toBe(`${APP_ORIGIN}/mypage/attendance?mind=1&from=tv-value`);
    expect(r.find((s) => s.id === "mileage")!.qr.url).toBe(`${APP_ORIGIN}/mypage?focus=mileage&from=tv-value`);
  });
});

describe("마이복서153 가치 전달 — 글 기준 (153 브랜드 · TV 폭)", () => {
  it("153 금칙 · 긴 줄표 · 못한 말 없음 — 모든 경우의 모든 글", () => {
    for (const r of variants()) {
      for (const s of r) {
        for (const t of [...textOf(s), ...visualOf(s)]) expect(t, `${s.id}: ${t}`).not.toMatch(BANNED);
      }
    }
  });
  it("장면마다 훅 두 줄(빈칸 질문으로 끝) · 증거 세 줄 · 의심 해소 한 줄", () => {
    for (const r of variants()) {
      for (const s of r) {
        expect(s.hook.length, s.id).toBe(2);
        expect(s.hook[1], s.id).toMatch(/\?$/);
        expect(s.answer, s.id).not.toMatch(/\?$/);
        expect(s.proofs, s.id).toHaveLength(3);
        expect(s.ease.length, s.id).toBeGreaterThan(5);
      }
    }
  });
  it("TV 폭에 들어간다 — 훅 한 줄 12.5칸 · 상황 22칸 · 답 18.5칸 · 증거 23칸 · 의심 해소 22칸 안", () => {
    for (const r of variants()) {
      for (const s of r) {
        for (const h of s.hook) expect(units(h), `${s.id} 훅 「${h}」`).toBeLessThanOrEqual(12.5);
        expect(units(s.kicker), `${s.id} 「${s.kicker}」`).toBeLessThanOrEqual(22);
        expect(units(s.answer), `${s.id} 「${s.answer}」`).toBeLessThanOrEqual(18.5);
        for (const p of s.proofs) expect(units(p), `${s.id} 「${p}」`).toBeLessThanOrEqual(23);
        expect(units(s.ease), `${s.id} 「${s.ease}」`).toBeLessThanOrEqual(22);
        for (const c of s.qr.caption) expect(units(c), `${s.id} 「${c}」`).toBeLessThanOrEqual(8);
      }
    }
  });
  it("같은 숫자는 한 장면에 한 번 — 왼쪽 글과 오른쪽 그림이 같은 숫자(세 자리 이상 · 쉼표)를 말하지 않는다", () => {
    // 이름 속 숫자(153 · 국민체력100)는 숫자가 아니라 이름
    const nums = (ts: string[]) =>
      new Set(ts.join(" ").replace(/국민체력100|153/g, "").match(/\d{1,3}(?:,\d{3})+|\d{3,}/g) ?? []);
    for (const s of full()) {
      const left = nums(textOf(s));
      for (const n of nums(visualOf(s))) expect(left.has(n), `${s.id}: ${n}`).toBe(false);
    }
  });
  it("예시 숫자는 예시 그림에만 — 몸과 마음 · 마켓은 그림에 '예시' 표시가 붙는 틀", () => {
    const r = full();
    expect(r.find((s) => s.id === "bodymind")!.visual.kind).toBe("bodymind");
    expect(r.find((s) => s.id === "market")!.visual.kind).toBe("market");
  });
});

describe("마이복서153 가치 전달 — 1분마다 시계로", () => {
  it("분이 바뀔 때마다 다음 장면 · 장면 수로 돌아간다", () => {
    expect(sceneIndexAt(0, 9)).toBe(0);
    expect(sceneIndexAt(SCENE_MS - 1, 9)).toBe(0);
    expect(sceneIndexAt(SCENE_MS, 9)).toBe(1);
    expect(sceneIndexAt(SCENE_MS * 9 + 5, 9)).toBe(0);
    expect(sceneIndexAt(SCENE_MS * 3, 0)).toBe(0);
    expect(sceneOffsetAt(SCENE_MS * 4 + 2_500)).toBe(2_500);
  });
});

describe("수상자 축하 한 줄", () => {
  const RAW = {
    branch: SUNREUNG,
    status: "ended",
    start_date: "2026-10-01",
    end_date: "2026-11-09",
    items: [
      { category: "attendance", rows: [{ rank: 1, name: "예시 복서", score: 30, paid_points: 50000 }] },
      { category: "app", rows: [{ rank: 1, name: "봄비", score: 100, paid_points: 50000 }] },
      { category: "nickname", rows: [{ rank: 1, name: null, hidden: true, score: 8, paid_points: 50000 }] },
    ],
  };
  it("왕좌 · 1위 이름(이름을 뺀 분은 '1위 회원님') · 모두 받았으면 '받았어요'", () => {
    const strip = awardsStripOf(awardsView(normalizeAwards(RAW)))!;
    expect(strip.label).toBe("런칭 이벤트 1위");
    expect(strip.winners).toEqual([
      { throne: "출석왕", name: "예시 복서" },
      { throne: "앱 활동왕", name: "봄비" },
      { throne: "좋아요왕", name: "1위 회원님" },
    ]);
    expect(strip.prizes).toHaveLength(2);
    expect(strip.prizes[0]).toMatch(/^1위께 153 마일리지 [\d,]+점 · 받았어요$/);
    expect(strip.prizes[1]).toMatch(/^마일리지 [\d,]+점 받았어요$/);
    expect(units(strip.prizes[1])).toBeLessThan(units(strip.prizes[0]));
  });
  it("아직 못 받은 1위가 있으면 '받았어요' 없이 · 수상자가 없으면 null", () => {
    const one = { ...RAW, items: [{ category: "attendance", rows: [{ rank: 1, name: "예시 복서", score: 30, paid_points: null }] }] };
    for (const p of awardsStripOf(awardsView(normalizeAwards(one)))!.prizes) expect(p).not.toMatch(/받았어요/);
    expect(awardsStripOf(null)).toBeNull();
    expect(awardsStripOf(awardsView(normalizeAwards({ ...RAW, items: [] })))).toBeNull();
  });
});

// 타입 확인용 — 서버 숫자 없는 모양도 AppPulse
const _typed: AppPulse | null = null;
void _typed;
