import { describe, expect, it, vi } from "vitest";
import { koTells } from "../../supabase/functions/_shared/koStyle";
import { OWNER_DEMO } from "@/lib/ownerKpi";
import {
  askOsami,
  isOwnerQuestion,
  normalizeOwnerAiScope,
  OSAMI_ASK_EVENT,
  OWNER_AI_OFF,
  OWNER_CHIPS,
  ownerAskChips,
  ownerSubtitle,
  ownerWelcome,
  takePendingOsamiAsk,
} from "./ownerAsk";

describe("관장 모드 범위", () => {
  it("서버 답 → 켜졌을 때만", () => {
    expect(normalizeOwnerAiScope(null)).toEqual(OWNER_AI_OFF);
    expect(normalizeOwnerAiScope({ on: false, role: "manager", branch: "x" })).toEqual(OWNER_AI_OFF);
    expect(normalizeOwnerAiScope({ on: true, role: "admin", branch: "153복싱짐 선릉역점", daily: 50, left: 47 })).toEqual({
      on: true,
      role: "admin",
      branch: "153복싱짐 선릉역점",
      daily: 50,
      left: 47,
    });
    expect(normalizeOwnerAiScope({ on: true, role: "manager", branch: "b", left: -3 }).left).toBe(0);
  });
});

describe("관장 모드 글", () => {
  const admin = normalizeOwnerAiScope({ on: true, role: "admin", branch: "153복싱짐 선릉역점", daily: 50, left: 47 });
  const manager = { ...admin, role: "manager" as const, left: 0 };

  it("첫 인사 · 머리글 — 호칭 · 하루 한도 · AI 티 없음", () => {
    expect(ownerWelcome(admin)).toContain("대표님, 오삼코치 관장 모드예요");
    expect(ownerWelcome(manager)).toContain("지점장님");
    expect(ownerWelcome(admin)).toContain("하루 50번");
    expect(ownerSubtitle(admin)).toBe("153OS 숫자로 답해요 · 오늘 47번 남음");
    expect(ownerSubtitle(manager)).toContain("다 썼어요");
    for (const t of [ownerWelcome(admin), ownerSubtitle(admin), ...OWNER_CHIPS]) expect(koTells(t)).toEqual([]);
  });

  it("운영 숫자 질문만 AI 로 — 앱 사용법은 그대로 앱 안내", () => {
    for (const q of ["출석률 왜 떨어졌어?", "이번 달 매출 지난달이랑 비교해 줘", "오늘 연락할 회원 누구야", "기간 임박 회원 명단", "재등록 올리려면?", "신규 몇 명 들어왔어", "코치별 기록 보여줘", "톡톡 문의 몇 개야"]) {
      expect(isOwnerQuestion(q)).toBe(true);
    }
    for (const q of ["출석 방법", "레벨업 조건", "잽 잘 치는 법", "홀딩 어떻게 해요", "마일리지", "휴대폰 알림 켜기"]) {
      expect(isOwnerQuestion(q)).toBe(false);
    }
    // 머리글 추천 질문 중 복싱 하나만 보통 길로
    expect(OWNER_CHIPS.filter((c) => !isOwnerQuestion(c))).toEqual(["잽 잘 치는 법"]);
  });

  it("관장님 숫자 칸 질문 단추 — 숫자에 맞춰 세 개", () => {
    const chips = ownerAskChips(OWNER_DEMO);
    expect(chips).toHaveLength(3);
    expect(chips.every(isOwnerQuestion)).toBe(true);
    const down = { ...OWNER_DEMO, owner: { ...OWNER_DEMO.owner!, attendance: { ...OWNER_DEMO.owner!.attendance, rate: 60, prevRate: 70 } } };
    expect(ownerAskChips(down)[0]).toBe("출석률 왜 떨어졌어?");
    const up = { ...OWNER_DEMO, owner: { ...OWNER_DEMO.owner!, attendance: { ...OWNER_DEMO.owner!.attendance, rate: 75, prevRate: 70 } } };
    expect(ownerAskChips(up)[0]).toBe("출석률 80% 만들려면?");
    expect(ownerAskChips({ ...OWNER_DEMO, salesVisible: false })[2]).toBe("첫 4주 신규 누구 챙겨?");
    expect(ownerAskChips({ ...OWNER_DEMO, salesVisible: true })[2]).toContain("매출");
    expect(ownerAskChips(null)).toHaveLength(3);
  });
});

describe("오삼코치 열고 묻기", () => {
  it("창 이벤트 + 한 번 남겨 두기", () => {
    const seen = vi.fn();
    window.addEventListener(OSAMI_ASK_EVENT, seen);
    askOsami("  출석률 왜 떨어졌어?  ", { owner: true });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(takePendingOsamiAsk()).toEqual({ q: "출석률 왜 떨어졌어?", owner: true });
    expect(takePendingOsamiAsk()).toBeNull();
    askOsami("   ");
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OSAMI_ASK_EVENT, seen);
  });
});
