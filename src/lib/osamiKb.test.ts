import { describe, expect, it } from "vitest";
import { buildKbContext, isCoachingTopic, matchOsamiFaq, pickOsamiKbHints, planOsamiReply, smallTalkReply, kbDice, kbNormalize } from "./osamiKb";
import { OSAMI_FAQ } from "../data/osamiFaq";

/** 회원이 실제로 칠 만한 말 → 바로 답해야 하는 항목 */
const DIRECT: [string, string][] = [
  ["레벨업 조건이 뭐예요", "lv-requirements"],
  ["출석 몇 번 해야 레벨 올라요?", "lv-requirements"],
  ["레벨업 하려면 어떻게 해야돼", "lv-requirements"],
  ["타이틀매치가 뭐야", "lv-title-match"],
  ["직행권이 뭐예요", "lv-fast-track"],
  ["출석은 어떻게 해요", "att-how"],
  ["QR 출석 어떻게 찍어요", "att-qr"],
  ["출석했는데 반영이 안돼요", "att-missing"],
  ["운동 종료 버튼 뭐예요", "att-finish"],
  ["마일리지 어떻게 쌓여요", "rw-mileage"],
  ["마일리지 어디에 써요", "rw-mileage-use"],
  ["젬은 어떻게 얻어요", "rw-gems"],
  ["파이트머니 뭐예요", "rw-gems"],
  ["닉네임 변경 어떻게 해요", "acct-nickname"],
  ["닉네임 바꾸는법", "acct-nickname"],
  ["비밀번호 잊어버렸어요", "acct-reset-pw"],
  ["비번 찾기", "acct-reset-pw"],
  ["아이디 찾기", "acct-find-id"],
  ["비밀번호 변경하고 싶어요", "acct-change-pw"],
  ["지문 로그인 등록", "acct-passkey"],
  ["다크모드 어떻게 켜요", "acct-theme"],
  ["앱 설치 어떻게 해요", "start-install"],
  ["홈 화면에 추가", "start-install"],
  ["휴대폰 알림 켜는 법", "nt-push"],
  ["푸시 알림이 안와요", "nt-push"],
  ["알림함이 뭐예요", "nt-inbox"],
  ["메시지 어떻게 보내요", "dm-how"],
  ["코치님한테 메시지 보내고 싶어요", "dm-how"],
  ["메시지가 안 보내져요", "dm-limits"],
  ["차단은 어떻게 해요", "dm-block"],
  ["수강권 남은 기간", "mb-remaining"],
  ["재등록 하고 싶어요", "mb-renew"],
  ["홀딩 신청", "mb-hold"],
  ["환불 규정", "mb-refund"],
  ["양도 수수료", "mb-transfer"],
  ["153다이어트가 뭐예요", "dt-what"],
  ["식단 사진 칼로리", "dt-photo"],
  ["캐릭터 꾸미기 어떻게 해요", "ch-how"],
  ["단증혜택이 뭐예요", "ct-benefit"],
  ["153 챌린지 왕좌가 뭐예요", "rk-kings"],
  ["출석왕은 어떻게 뽑아요", "rk-kings"],
  ["런칭 이벤트 언제까지예요", "rk-launch-event"],
  ["하트 어떻게 보내요", "rk-heart"],
  ["랭킹에 제가 안 보여요", "rk-missing"],
  ["복싱 트레이닝 게임 뭐예요", "gm-overview"],
  ["게임 점수가 랭킹에 안올라가요", "gm-ranking"],
  ["오늘의 코스가 뭐예요", "tr-course"],
  ["수업 매뉴얼 어디서 봐요", "tr-lesson"],
  ["오늘 수업 몇일차예요", "tr-lesson"],
  ["153플레이가 뭐예요", "tr-play"],
  ["실사 애니메이션 영상 차이", "tr-video-variant"],
  ["내 레벨 연습하기", "tr-practice"],
  ["타이틀매치 영상 어디서 봐요", "tr-title-videos"],
  ["명예의 전당 조건", "lv-master"],
  ["레벨업하면 뭐 받아요", "lv-reward"],
  ["승인은 누가 해요", "lv-review"],
  ["보완 요청 받았어요", "lv-review"],
  ["리그가 몇 개예요", "lv-structure"],
  ["지점 이전 하고 싶어요", "acct-branch"],
  ["탈퇴하고 싶어요", "acct-delete"],
  ["전화번호 바꾸고 싶어요", "acct-phone"],
  ["오삼이 누구야", "osami-who"],
  ["뭘 물어볼 수 있어?", "osami-can"],
  ["운동 파트너 구하기", "cm-partner"],
  ["장비 나눔 어떻게 해요", "cm-gear"],
  ["코너맨이 뭐예요", "cm-cornerman"],
  ["153 뜻이 뭐예요", "gd-153"],
  ["운동하다 어지러우면 어떡해요", "gd-safety"],
  ["PT 배지가 뭐예요", "mb-pt"],
  ["입단식 보상 뭐예요", "rw-induction"],
  ["마인드셋이 뭐예요", "md-what"],
];

/** 앱 안내가 아니라 AI 가 답해야 하는 말 — 바로 답하면 안 된다 */
const TO_AI: string[] = [
  "잽 칠 때 어깨가 아파요",
  "스트레이트 치는 법 알려줘",
  "훅은 어떻게 쳐요",
  "복싱 처음인데 뭐부터 배워야 해요",
  "저녁에 뭐 먹는 게 좋아요",
  "단백질은 하루에 얼마나 먹어야 해요",
  "체중이 안 빠져요",
  "스파링 무서워요",
  "줄넘기 잘하는 법",
  "오늘 너무 힘들어서 가기 싫어요",
  "복싱이 다이어트에 좋아요?",
  "샌드백 칠 때 손목이 아파요",
];

/** 답하는 길 — [질문, 길, (faq 면 항목 id)] (2026-10-03 검수 회귀 포함) */
const PLAN: [string, "small" | "faq" | "suggest" | "ai", string?][] = [
  ["안녕하세요", "small"],
  ["양도", "faq", "mb-transfer"],
  ["메시지 한도", "faq", "dm-limits"],
  ["마일리지", "faq", "rw-mileage"],
  ["랭킹", "faq", "rk-types"],
  ["홀딩", "faq", "mb-hold"],
  ["아이디 까먹었어요", "faq", "acct-find-id"],
  ["홀딩 자세히 알려주세요", "faq", "mb-hold"],
  ["타이틀매치 떨어지면 어떡해요", "faq", "lv-review"],
  ["앱이 먹통이에요", "faq", "osami-app-error"],
  ["운동하다 어지러우면 어떡해요", "faq", "gd-safety"], // 안전 안내는 코칭 화제여도 공식 문구로
  ["식단 사진 칼로리", "faq", "dt-photo"],
  ["타이틀매치 통과하면 마일리지 얼마나 줘요", "suggest"],
  ["다이어트 중에 치킨 먹어도 돼요", "ai"], // 153다이어트 소개문으로 답하지 않는다
  ["복싱이 다이어트에 좋아요?", "ai"],
  ["술 마셔도 돼요", "ai"],
  ["정체기 왔어요", "ai"],
  ["잽 자세히 알려줘", "ai"],
];

const topIds = (q: string) => matchOsamiFaq(q).candidates.map((c) => `${c.entry.id}:${c.score}`).join(", ");

describe("osamiKb — 1단 답변 매칭", () => {
  it.each(DIRECT)("%s → %s", (q, id) => {
    const r = matchOsamiFaq(q);
    expect(r.kind, `kind for "${q}" (${topIds(q)})`).toBe("answer");
    expect(r.best?.entry.id, `best for "${q}" (${topIds(q)})`).toBe(id);
  });

  it.each(TO_AI)("AI 로 넘긴다: %s", (q) => {
    const r = matchOsamiFaq(q);
    expect(r.kind, `"${q}" → ${topIds(q)}`).not.toBe("answer");
  });

  it.each(PLAN)("길 정하기: %s → %s %s", (q, kind, id) => {
    const p = planOsamiReply(q);
    expect(p.kind, `${q} (${topIds(q)})`).toBe(kind);
    if (id && p.kind === "faq") expect(p.best.entry.id).toBe(id);
  });

  it.each(TO_AI)("AI 질문은 AI 로 간다: %s", (q) => {
    expect(planOsamiReply(q).kind, `${q} (${topIds(q)})`).toBe("ai");
  });

  it("코칭 화제 판별 — 글자만 겹치는 말은 제외", () => {
    for (const q of ["아이디 까먹었어요", "앱이 먹통이에요", "홀딩 자세히 알려주세요", "출석 동기화가 안 돼요"]) expect(isCoachingTopic(q), q).toBe(false);
    for (const q of ["자세가 무너져요", "동기부여가 안 돼요", "저녁에 뭐 먹어요", "잽 칠 때 어깨가 아파요"]) expect(isCoachingTopic(q), q).toBe(true);
  });

  it("코칭으로 돌린 질문은 관련 앱 안내만 칩으로 단다", () => {
    const p = planOsamiReply("다이어트 중에 치킨 먹어도 돼요");
    expect(p.kind).toBe("ai");
    if (p.kind === "ai") expect(p.related.map((r) => r.entry.id)).toEqual(["dt-what"]);
  });

  it("빈 질문은 none", () => {
    expect(matchOsamiFaq("").kind).toBe("none");
    expect(matchOsamiFaq("   ").kind).toBe("none");
  });

  it("인사·감사는 정해진 말로", () => {
    expect(smallTalkReply("안녕하세요")).toMatch(/오삼/);
    expect(smallTalkReply("고마워요")).toBeNull(); // '고마워요' 는 목록 밖 — 자연스럽게 AI/FAQ 로
    expect(smallTalkReply("감사합니다!")).toMatch(/응원/);
    expect(smallTalkReply("ㅋㅋㅋ")).toBeTruthy();
    expect(smallTalkReply("레벨업 조건")).toBeNull();
  });

  it("AI 참고 자료는 관련 항목 몇 개를 글자 상한 안에서", () => {
    const hints = pickOsamiKbHints("타이틀매치 통과하면 마일리지 얼마나 줘요");
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.length).toBeLessThanOrEqual(4);
    expect(hints.map((h) => h.id)).toContain("rw-mileage");
    const total = hints.reduce((s, h) => s + h.q.length + h.answer.length, 0);
    expect(total).toBeLessThanOrEqual(2200);
    expect(pickOsamiKbHints("")).toEqual([]);
  });

  it("AI 요청에 실어 보내는 컨텍스트 — 앱 화제면 기능 지도까지, 복싱·식단만이면 비움", () => {
    const app = buildKbContext("타이틀매치 통과하면 마일리지 얼마나 줘요");
    expect(app.hints.length).toBeGreaterThan(0);
    expect(app.hints[0]).toEqual({ q: expect.any(String), answer: expect.any(String) });
    expect(app.index).toContain("레벨·승급");
    expect(app.index!.length).toBeLessThanOrEqual(2500);
    const boxing = buildKbContext("잽 칠 때 어깨가 아파요");
    expect(boxing.hints).toEqual([]);
    expect(boxing.index).toBeUndefined();
    // 잡음 차단 — 일반 낱말("좋아요")이 우연히 겹친 항목은 참고 자료로 붙이지 않는다
    expect(buildKbContext("저녁에 뭐 먹는 게 좋아요").hints).toEqual([]);
    // 코칭 질문은 관련 앱 안내만 붙이고 기능 지도는 뺀다 (토큰 절약)
    const diet = buildKbContext("복싱이 다이어트에 좋아요?");
    expect(diet.hints.map((h) => h.q)).toContain("153다이어트가 뭐예요?");
    expect(diet.index).toBeUndefined();
  });

  it("지식 베이스 자체 검사 — id 유일, 링크는 앱 안 주소, 금칙어 없음", () => {
    const ids = OSAMI_FAQ.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of OSAMI_FAQ) {
      expect(f.keywords.length, f.id).toBeGreaterThan(0);
      expect(f.answer.length, f.id).toBeGreaterThan(20);
      for (const l of f.links ?? []) expect(l.to, `${f.id} link`).toMatch(/^\//);
      // 용어 규칙 — 벨트·계급·확정 혜택 금지
      expect(f.answer, f.id).not.toMatch(/벨트|계급|확정 혜택|무조건/);
    }
  });

  it("도우미 — 정규화·다이스", () => {
    expect(kbNormalize("레벨 업 조건!")).toBe("레벨업조건");
    expect(kbDice("레벨업조건", "레벨업조건")).toBe(1);
    expect(kbDice("가나", "다라")).toBe(0);
  });
});
