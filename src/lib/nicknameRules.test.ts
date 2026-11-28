import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NICKNAME_BLOCK_WORDS,
  NICKNAME_MAX,
  NICKNAME_MSG,
  NICKNAME_STAFF_WORDS,
  hasOwnNickname,
  nicknameLen,
  nicknameProblem,
  nicknameSearchForm,
  shownName,
  withRo,
} from "./nicknameRules";

const SQL_FILE = "supabase/migrations/20261128092219_nickname_rules.sql";

describe("닉네임 규칙 — 저장 전 검사 (서버 nickname_problem 과 같음)", () => {
  it("보통 닉네임 · 이모지 · 빈 칸은 괜찮다", () => {
    for (const ok of ["잽마스터", "원투 훅", "Jab153", "🥊😀", "", "   "]) expect({ ok, p: nicknameProblem(ok) }).toEqual({ ok, p: null });
  });

  it("12자 — 이모지 · 한글을 한 글자로 세고, 앞뒤 빈칸은 빼고 센다", () => {
    expect(NICKNAME_MAX).toBe(12);
    expect(nicknameLen("🥊🥊")).toBe(2);
    expect(nicknameProblem("가".repeat(12))).toBeNull();
    expect(nicknameProblem(`  ${"가".repeat(12)}  `)).toBeNull();
    expect(nicknameProblem("가".repeat(13))).toBe(NICKNAME_MSG.tooLong);
    expect(nicknameProblem("🥊".repeat(13))).toBe(NICKNAME_MSG.tooLong);
  });

  it("욕설은 띄어 쓰거나 기호를 끼워도 · 대문자여도 막는다", () => {
    for (const bad of ["시발", "시 발", "시.발맨", "ㅅㅂ", "FUCK", "f_u_c_k", "개새끼야"]) {
      expect({ bad, p: nicknameProblem(bad) }).toEqual({ bad, p: NICKNAME_MSG.blocked });
    }
    // 지도진 계정이어도 욕설은 막는다
    expect(nicknameProblem("병신", { isStaff: true })).toBe(NICKNAME_MSG.blocked);
  });

  it("운영진처럼 보이는 말은 회원만 막는다", () => {
    for (const w of ["관장님", "관 장", "선릉 지점장", "코치님", "대표님", "153본사", "운영진"]) {
      expect({ w, p: nicknameProblem(w) }).toEqual({ w, p: NICKNAME_MSG.staff });
      expect({ w, staff: nicknameProblem(w, { isStaff: true }) }).toEqual({ w, staff: null });
    }
  });

  it("비슷하지만 괜찮은 말은 막지 않는다 (잘못 막기 줄이기)", () => {
    for (const ok of ["시바견", "국가대표꿈나무", "잽코치", "졸라맨", "보지마", "개새벽러", "등신대", "153복싱러"]) {
      expect({ ok, p: nicknameProblem(ok) }).toEqual({ ok, p: null });
    }
  });

  it("찾기용 다듬기 — 소문자 · 숫자 · 영문 · 한글(자모 포함)만", () => {
    expect(nicknameSearchForm(" A.b_C 1-2 가ㄱㅏ!🥊 ")).toBe("abc12가ㄱㅏ");
  });
});

describe("보이는 이름 · 조사", () => {
  it("닉네임 → 실명 → '복서'", () => {
    expect(shownName({ nickname: " 잽마스터 ", name: "홍길동" })).toBe("잽마스터");
    expect(shownName({ nickname: "", name: "홍길동" })).toBe("홍길동");
    expect(shownName({ nickname: null, name: null })).toBe("복서");
    expect(shownName(null)).toBe("복서");
  });

  it("직접 정한 닉네임 — 실명과 같거나 비었으면 아님 (일괄 등록 계정)", () => {
    expect(hasOwnNickname({ nickname: "잽마스터", name: "홍길동" })).toBe(true);
    expect(hasOwnNickname({ nickname: "홍길동", name: "홍길동" })).toBe(false);
    expect(hasOwnNickname({ nickname: " ", name: "홍길동" })).toBe(false);
  });

  it("'으로/로' — 받침 · ㄹ 받침 · 한글 아님", () => {
    expect(withRo("홍길동")).toBe("홍길동으로");
    expect(withRo("잽마스터")).toBe("잽마스터로");
    expect(withRo("하늘")).toBe("하늘로");
    expect(withRo("Mike")).toBe("Mike(으)로");
  });
});

describe("서버 마이그레이션과 같은 목록 · 문구", () => {
  const sql = readFileSync(SQL_FILE, "utf8");
  const listAfter = (marker: string): string[] => {
    const m = sql.match(new RegExp(`array\\[\\s*--\\s*${marker}([\\s\\S]*?)\\]::text\\[\\]`));
    expect(m, marker).not.toBeNull();
    return [...(m as RegExpMatchArray)[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  };

  it("욕설 · 운영진 낱말 목록이 같다(순서까지)", () => {
    expect(listAfter("NICKNAME_BLOCK_WORDS")).toEqual([...NICKNAME_BLOCK_WORDS]);
    expect(listAfter("NICKNAME_STAFF_WORDS")).toEqual([...NICKNAME_STAFF_WORDS]);
  });

  it("막는 문구 · 12자 · 다듬기 범위가 같다", () => {
    for (const msg of Object.values(NICKNAME_MSG)) expect(sql).toContain(`'${msg}'`);
    expect(sql).toContain(`> ${NICKNAME_MAX}`);
    expect(sql).toContain("'[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]'");
  });

  it("목록 낱말은 이미 다듬은 꼴이다(그래야 다듬은 닉네임에서 찾힌다)", () => {
    for (const w of [...NICKNAME_BLOCK_WORDS, ...NICKNAME_STAFF_WORDS]) expect({ w, s: nicknameSearchForm(w) }).toEqual({ w, s: w });
  });
});
