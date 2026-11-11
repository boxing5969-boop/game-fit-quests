import { describe, expect, it } from "vitest";
import { GYM_POLICIES, GYM_POLICY_VERSION } from "@/data/gymPolicies";
import {
  TERMS_SNOOZE_MS,
  buildAgreementRecord,
  hasCurrentConsent,
  isTermsAudience,
  policyFingerprint,
  policyText,
  termsPromptDue,
} from "./termsConsent";

const allAgree = Object.fromEntries(GYM_POLICIES.map((p) => [p.key, true]));
const member = {
  isApproved: true,
  role: "member",
  realRole: "member",
  isStaff: false,
  branchName: "153복싱짐 선릉역점",
};

describe("hasCurrentConsent", () => {
  it("지금 판 + 필수 항목 모두 동의면 참", () => {
    expect(hasCurrentConsent({ ...allAgree, version: GYM_POLICY_VERSION })).toBe(true);
  });
  it("기록 없음 · 옛 판 · 필수 하나 빠짐이면 거짓", () => {
    expect(hasCurrentConsent(null)).toBe(false);
    expect(hasCurrentConsent([])).toBe(false);
    expect(hasCurrentConsent({ ...allAgree, version: "2026-06" })).toBe(false);
    expect(hasCurrentConsent({ ...allAgree, terms: false, version: GYM_POLICY_VERSION })).toBe(false);
  });
});

describe("isTermsAudience", () => {
  it("승인된 선릉역점 일반 회원만", () => {
    expect(isTermsAudience(member)).toBe(true);
  });
  it("다른 지점 · 미승인 · 코치님 · 운영진(회원으로 보기 포함)은 아님", () => {
    expect(isTermsAudience({ ...member, branchName: "153복싱짐 칠금점" })).toBe(false);
    expect(isTermsAudience({ ...member, branchName: null })).toBe(false);
    expect(isTermsAudience({ ...member, isApproved: false })).toBe(false);
    expect(isTermsAudience({ ...member, isStaff: true })).toBe(false);
    expect(isTermsAudience({ ...member, role: "coach", realRole: "coach" })).toBe(false);
    expect(isTermsAudience({ ...member, realRole: "super_admin" })).toBe(false);
  });
});

describe("termsPromptDue", () => {
  const now = Date.parse("2026-11-11T12:00:00+09:00");
  it("처음이면 띄운다", () => {
    expect(termsPromptDue({ snoozedUntil: null, shownThisSession: false, now })).toBe(true);
  });
  it("이번 접속에 이미 보였으면 · '나중에' 3일 안이면 안 띄운다", () => {
    expect(termsPromptDue({ snoozedUntil: null, shownThisSession: true, now })).toBe(false);
    expect(termsPromptDue({ snoozedUntil: now + TERMS_SNOOZE_MS, shownThisSession: false, now })).toBe(false);
  });
  it("3일이 지나면 다시 띄운다", () => {
    expect(termsPromptDue({ snoozedUntil: now - 1, shownThisSession: false, now })).toBe(true);
  });
});

describe("policyFingerprint", () => {
  it("같은 글이면 같은 지문, 글이 바뀌면 다른 지문 (64자)", async () => {
    const a = await policyFingerprint();
    const b = await policyFingerprint();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    const changed = GYM_POLICIES.map((p, i) => (i === 0 ? { ...p, body: `${p.body} ` } : p));
    expect(await policyFingerprint(changed)).not.toBe(a);
  });
  it("규정 글에 지급 장비 금액이 들어 있다 (장비 공제 근거)", () => {
    expect(policyText()).toContain("글러브 50,000원");
    expect(policyText()).toContain("붕대 10,000원");
  });
});

describe("buildAgreementRecord", () => {
  it("판 · 지문 · 어디서를 남긴다", () => {
    const rec = buildAgreementRecord({ agree: allAgree, hash: "abc", source: "app_prompt" });
    expect(rec).toMatchObject({ ...allAgree, version: GYM_POLICY_VERSION, hash: "abc", source: "app_prompt" });
    expect(rec.history).toBeUndefined();
  });
  it("옛 기록은 지우지 않고 그때 시각과 함께 history 로", () => {
    const old = { ...allAgree, version: "2026-06", history: [{ version: "2026-01", agreed_at: "2026-01-02" }] };
    const rec = buildAgreementRecord({
      agree: allAgree,
      hash: null,
      source: "app_prompt",
      previous: old,
      previousAt: "2026-10-20T01:00:00Z",
    });
    expect(rec.history).toHaveLength(2);
    expect(rec.history?.[1]).toMatchObject({ version: "2026-06", agreed_at: "2026-10-20T01:00:00Z" });
    expect(rec.history?.[1]).not.toHaveProperty("history");
    expect(rec.version).toBe(GYM_POLICY_VERSION);
  });
});
