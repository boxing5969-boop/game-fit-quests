import { describe, expect, it } from "vitest";
import {
  ACCURACY_POINTS,
  accuracyNote,
  bodyFatDrop,
  fitnessExtraInputError,
  normalizeFitnessExtra,
  parseBirthYear,
  parseBodyFat,
  reportAccuracy,
  weightBasis,
} from "./fitnessProfile153";

describe("정확도 — 넣을수록 올라간다 (2026-10-22 대표님)", () => {
  it("점수표 합은 100", () => {
    expect(Object.values(ACCURACY_POINTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("아무것도 없으면 출석 기록 40% · 몸무게가 가장 먼저 권할 정보", () => {
    const a = reportAccuracy({ days: [{ endSource: null }], gender: null, birthYear: null, heightCm: null, weightKg: null, bodyFatPct: null });
    expect(a.pct).toBe(40);
    expect(a.next?.key).toBe("weight");
    expect(a.missing.map((m) => m.key)).toEqual(["weight", "gender", "age", "bodyFat", "height"]);
  });
  it("운동 끝 체크 비율만큼 (최근 20번) · 다 넣으면 100%", () => {
    const half = Array.from({ length: 20 }, (_, i) => ({ endSource: i % 2 ? "checkout_scan" : null }));
    expect(reportAccuracy({ days: half, gender: "남", birthYear: 1990, heightCm: 175, weightKg: 70, bodyFatPct: 20 }).pct).toBe(95);
    const all = Array.from({ length: 5 }, () => ({ endSource: "member_app" }));
    const a = reportAccuracy({ days: all, gender: "여", birthYear: 1995, heightCm: 160, weightKg: 55, bodyFatPct: 28 });
    expect(a.pct).toBe(100);
    expect(a.next).toBeNull();
  });
});

describe("정확도 올리기 — 오삼코치 메시지 (2026-10-28 대표님 '카톡 메시지 같이')", () => {
  const all = Array.from({ length: 4 }, () => ({ endSource: "checkout_scan" }));
  it("두 가지 남았으면 이름을 부르고 · 조사를 맞추고 · 몇 %까지 오르는지", () => {
    const a = reportAccuracy({ days: all, gender: "남", birthYear: null, heightCm: 176, weightKg: 72, bodyFatPct: null });
    expect(a.pct).toBe(80);
    const n = accuracyNote("지훈", a);
    expect(n.target).toBe(100);
    expect(n.lines).toEqual(["지훈님, 지금 정확도는 80%예요", "나이 · 체지방률을 넣으면 100%까지 올라가요", "나이에 맞게 비교해 드려요. 30초면 끝나요!"]);
  });
  it("받침 없는 말로 끝나면 '를' · 이름이 없으면 회원님", () => {
    const a = reportAccuracy({ days: all, gender: "여", birthYear: 1995, heightCm: null, weightKg: 55, bodyFatPct: 24 });
    const n = accuracyNote("  ", a);
    expect(n.lines[0]).toBe("회원님, 지금 정확도는 95%예요");
    expect(n.lines[1]).toBe("키를 넣으면 100%까지 올라가요");
  });
  it("넷 이상 남았으면 큰 것 둘 + 몇 가지 · 운동 끝 체크가 덜 됐으면 그만큼 빼고", () => {
    const half = Array.from({ length: 20 }, (_, i) => ({ endSource: i % 2 ? "checkout_scan" : null }));
    const a = reportAccuracy({ days: half, gender: null, birthYear: null, heightCm: null, weightKg: null, bodyFatPct: null });
    const n = accuracyNote("지훈", a);
    expect(n.lines[1]).toBe("몸무게 · 성별 등 5가지를 넣으면 95%까지 올라가요");
    expect(n.lines[2]).toBe("칼로리 · 지방을 내 몸 기준으로 바꿔요. 30초면 끝나요!");
  });
  it("넣을 정보를 다 넣었으면 운동 끝 얼굴 인식 안내 · target 없음", () => {
    const half = Array.from({ length: 20 }, (_, i) => ({ endSource: i % 2 ? "checkout_scan" : null }));
    const a = reportAccuracy({ days: half, gender: "남", birthYear: 1990, heightCm: 175, weightKg: 70, bodyFatPct: 20 });
    const n = accuracyNote("지훈", a);
    expect(n.target).toBeNull();
    expect(n.lines[1]).toContain("얼굴 인식");
  });
});

describe("계산 몸무게 — 내 몸무게 → 남녀 평균 → 65kg", () => {
  it("순서대로", () => {
    expect(weightBasis(68.4, "남")).toMatchObject({ kg: 68.4, source: "me" });
    expect(weightBasis(null, "남")).toMatchObject({ kg: 75, source: "gender", label: "남성 평균 75kg 기준" });
    expect(weightBasis(null, "여")).toMatchObject({ kg: 60, source: "gender" });
    expect(weightBasis(10, null)).toMatchObject({ kg: 65, source: "default", label: "성인 평균 65kg 기준" });
  });
});

describe("서버 값 읽기 · 체지방률 변화", () => {
  it("모르는 값은 null", () => {
    const x = normalizeFitnessExtra({ gender: "x", birth_year: 1800, body_fat_pct: 99, body_fat_count: "2" });
    expect(x).toMatchObject({ gender: null, birthYear: null, bodyFatPct: null, bodyFatCount: 2 });
    expect(normalizeFitnessExtra(null).gender).toBeNull();
  });
  it("처음보다 내려갔을 때만", () => {
    const x = normalizeFitnessExtra({ body_fat_pct: 24.1, body_fat_on: "2026-10-22", first_body_fat_pct: 26, first_body_fat_on: "2026-09-01" });
    expect(bodyFatDrop(x)).toBe(1.9);
    expect(bodyFatDrop({ ...x, firstBodyFatPct: 23 })).toBeNull();
    expect(bodyFatDrop({ ...x, firstBodyFatOn: "2026-10-22" })).toBeNull();
  });
  it("입력 확인", () => {
    expect(parseBirthYear("1990")).toBe(1990);
    expect(parseBirthYear("90")).toBeNaN();
    expect(parseBirthYear("")).toBeNull();
    expect(parseBodyFat("24,5")).toBe(24.5);
    expect(parseBodyFat("abc")).toBeNaN();
    expect(fitnessExtraInputError(1990, 24.5, 2026)).toBeNull();
    expect(fitnessExtraInputError(2024, null, 2026)).not.toBeNull();
    expect(fitnessExtraInputError(null, 70, 2026)).not.toBeNull();
  });
});
