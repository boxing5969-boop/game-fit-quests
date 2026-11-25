import { describe, expect, it } from "vitest";
import {
  KIOSK_AUTO_ATTEND_MS,
  KIOSK_FLOW_TEXT,
  elapsedMinutes,
  kioskAttendResult,
  kioskCardKind,
  kioskFinishedLine,
  kioskLeaveResult,
  kioskStayLine,
  parseKioskCheckout,
  parseKioskToday,
  remainingRatio,
  remainingSec,
} from "./faceKioskFlow";

// 2026-11-25 19:12 KST
const NOW = Date.parse("2026-11-25T10:12:00Z");

describe("얼굴 키오스크 — [출석] · [퇴장] 버튼 흐름 (2026-11-25)", () => {
  it("오늘 상태 읽기 — 모양이 틀리면 null", () => {
    for (const bad of [null, undefined, "x", {}, { ok: false, attended: true }, { ok: true }, { ok: true, attended: "yes" }]) {
      expect(parseKioskToday(bad)).toBeNull();
    }
    expect(parseKioskToday({ ok: true, attended: true, started_at: "2026-11-25T09:00:00Z", ended_at: null, ended_source: null })).toEqual({
      attended: true, startedAt: "2026-11-25T09:00:00Z", endedAt: null, endedSource: null,
    });
  });

  it("카드 고르기 — 출석 전은 [출석] · 출석했으면 [출석][퇴장] · 앱에서 끝냈으면 기록만", () => {
    expect(kioskCardKind(null)).toBe("enter"); // 상태를 못 읽으면 출석 전으로(이미 출석이면 서버가 '이미 출석')
    expect(kioskCardKind({ attended: false, startedAt: null, endedAt: null, endedSource: null })).toBe("enter");
    expect(kioskCardKind({ attended: true, startedAt: "2026-11-25T09:00:00Z", endedAt: null, endedSource: null })).toBe("exit");
    // 두 번째 체크 · 앞서 누른 퇴장은 다시 누르면 지금 시각으로 고친다
    expect(kioskCardKind({ attended: true, startedAt: "x", endedAt: "y", endedSource: "checkout_scan" })).toBe("exit");
    expect(kioskCardKind({ attended: true, startedAt: "x", endedAt: "y", endedSource: "kiosk_exit" })).toBe("exit");
    expect(kioskCardKind({ attended: true, startedAt: "x", endedAt: "y", endedSource: "member_app" })).toBe("finished");
    expect(kioskCardKind({ attended: true, startedAt: "x", endedAt: "y", endedSource: "member_fix" })).toBe("finished");
  });

  it("카운트다운 — 남은 초는 올림 · 막대는 1 → 0", () => {
    const deadline = NOW + KIOSK_AUTO_ATTEND_MS;
    expect(remainingSec(deadline, NOW)).toBe(10);
    expect(remainingSec(deadline, NOW + 9_100)).toBe(1);
    expect(remainingSec(deadline, NOW + 12_000)).toBe(0);
    expect(remainingSec(null, NOW)).toBe(0);
    expect(remainingRatio(deadline, KIOSK_AUTO_ATTEND_MS, NOW)).toBe(1);
    expect(remainingRatio(deadline, KIOSK_AUTO_ATTEND_MS, NOW + 5_000)).toBe(0.5);
    expect(remainingRatio(deadline, KIOSK_AUTO_ATTEND_MS, NOW + 20_000)).toBe(0);
    expect(KIOSK_FLOW_TEXT.enterHint(3)).toBe("3초 뒤 자동으로 출석돼요");
  });

  it("퇴장 카드 한 줄 — 입장 시각(KST) · 지금까지", () => {
    expect(kioskStayLine("2026-11-25T09:00:00Z", NOW)).toBe("18:00 입장 · 지금까지 1시간 12분");
    expect(kioskStayLine("2026-11-25T10:11:30Z", NOW)).toBe("19:11 입장");
    expect(kioskStayLine(null, NOW)).toBeNull();
    expect(kioskStayLine("엉터리", NOW)).toBeNull();
    expect(elapsedMinutes("2026-11-25T10:30:00Z", NOW)).toBeNull(); // 미래 시각
  });

  it("출석 결과 — 한쪽이라도 남으면 완료 · 앱이 이미 출석이면 '이미 출석'", () => {
    expect(kioskAttendResult("ok", "ok")).toEqual({ ok: true, already: false, title: KIOSK_FLOW_TEXT.attendDone, sub: null });
    expect(kioskAttendResult("ok", "already").title).toBe(KIOSK_FLOW_TEXT.attendAlready); // 브로제이로 먼저 찍힌 날
    expect(kioskAttendResult("skip", "ok").ok).toBe(true); // 옛 153OS 워커(/attend 없음)
    expect(kioskAttendResult("fail", "ok").ok).toBe(true);
    expect(kioskAttendResult("ok", "skip")).toMatchObject({ ok: true, already: false }); // 앱 연결 전 회원
    expect(kioskAttendResult("already", "skip")).toMatchObject({ ok: true, already: true });
    expect(kioskAttendResult("already", "ok")).toMatchObject({ ok: true, already: false }); // 앱엔 새로 남음
    expect(kioskAttendResult("fail", "fail")).toMatchObject({ ok: false, title: KIOSK_FLOW_TEXT.attendFail });
    expect(kioskAttendResult("skip", "skip").ok).toBe(false);
  });

  it("퇴장 답 읽기", () => {
    expect(parseKioskCheckout(null)).toBeNull();
    expect(parseKioskCheckout({ error: "x" })).toBeNull();
    expect(parseKioskCheckout({ ok: true, minutes: 72, xp_granted: 2, source: "kiosk_exit" })).toEqual({
      ok: true, code: null, alreadyFinished: false, source: "kiosk_exit", minutes: 72, xp: 2,
    });
    expect(parseKioskCheckout({ ok: false, code: "NO_ATTENDANCE" })).toMatchObject({ ok: false, code: "NO_ATTENDANCE", xp: 0 });
  });

  it("퇴장 결과 글 — 저장 · 앱에서 이미 끝냄 · 출석 없음 · 실패", () => {
    expect(kioskLeaveResult({ ok: true, code: null, alreadyFinished: false, source: "kiosk_exit", minutes: 72, xp: 2 }, "홍길동")).toEqual({
      ok: true, title: "오늘 운동 1시간 12분 저장!", sub: "+2 XP · 수고하셨어요",
      voice: "홍길동님, 오늘 1시간 12분 운동하셨어요. 수고하셨어요!", retry: false,
    });
    expect(kioskLeaveResult({ ok: true, code: null, alreadyFinished: false, source: "kiosk_exit", minutes: 66, xp: 0 }, "A").sub).toBe("수고하셨어요");
    expect(kioskLeaveResult({ ok: true, code: null, alreadyFinished: true, source: "member_app", minutes: 80, xp: 0 }, "A")).toMatchObject({
      ok: true, title: "앱에서 운동 종료한 기록이 있어요", sub: "1시간 20분 기록 그대로예요", voice: null,
    });
    expect(kioskLeaveResult({ ok: false, code: "NO_ATTENDANCE", alreadyFinished: false, source: null, minutes: null, xp: 0 }, "A")).toMatchObject({
      ok: false, title: "오늘 출석 기록이 없어요", retry: false,
    });
    expect(kioskLeaveResult(null, "A")).toMatchObject({ ok: false, retry: true });
  });

  it("앱에서 끝낸 날 한 줄 — 서버와 같은 테(기본 66분 · 4시간 넘으면 기본)", () => {
    const t = (s: string, e: string) => kioskFinishedLine({ attended: true, startedAt: s, endedAt: e, endedSource: "member_app" });
    expect(t("2026-11-25T09:00:00Z", "2026-11-25T10:20:00Z")).toBe("오늘 1시간 20분 운동 기록 · 수고하셨어요");
    expect(t("2026-11-25T09:00:00Z", "2026-11-25T09:30:00Z")).toBe("오늘 1시간 6분 운동 기록 · 수고하셨어요");
    expect(t("2026-11-25T03:00:00Z", "2026-11-25T09:00:00Z")).toBe("오늘 1시간 6분 운동 기록 · 수고하셨어요");
    expect(kioskFinishedLine(null)).toBeNull();
  });
});
