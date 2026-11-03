import { describe, expect, it } from "vitest";
import { KIOSK_DEFAULTS, kioskVoiceLine, normalizeKioskSettings, rematchMs } from "./kioskSettings";

describe("얼굴 키오스크 — 153OS 출석 프로그램 설정 받기", () => {
  it("모양이 틀리거나 비면 기본값 · 저장 전", () => {
    for (const bad of [null, undefined, "x", 3, {}, { settings: "x" }]) {
      expect(normalizeKioskSettings(bad)).toEqual({ settings: KIOSK_DEFAULTS, saved: false });
    }
  });

  it("받은 값을 쓰고, 이상한 칸만 기본값", () => {
    const s = normalizeKioskSettings({
      updated_at: "2026-11-02T01:30:00+00:00",
      settings: {
        face_enabled: false, qr_hint: "yes", sound_on: false, rematch_min: 99,
        notice_text: "  화면 가운데에\n얼굴을  ", welcome_text: "가".repeat(41), voice_text: "{이름}님 파이팅", paused_text: "",
      },
    });
    expect(s.saved).toBe(true);
    expect(s.settings).toEqual({
      ...KIOSK_DEFAULTS,
      face_enabled: false, sound_on: false, notice_text: "화면 가운데에 얼굴을", voice_text: "{이름}님 파이팅",
    });
  });

  it("보이지 않는 문자는 빼고, 이모지는 1자로 센다", () => {
    const s = normalizeKioskSettings({ settings: { notice_text: "정면\u200b을 봐\u202e주세요", welcome_text: "🥊".repeat(40) } });
    expect(s.settings.notice_text).toBe("정면을 봐주세요");
    expect(s.settings.welcome_text).toBe("🥊".repeat(40));
  });

  it("줄바꿈은 빈칸 · 이모지 잇기(ZWJ)는 둔다 · 한글 채움 문자만 있으면 기본값 (2026-11-03)", () => {
    const n = (t: string) => normalizeKioskSettings({ settings: { notice_text: t } }).settings.notice_text;
    expect(n("오늘\t휴관\r\n내일 정상")).toBe("오늘 휴관 내일 정상");
    expect(n("가족 👨\u200d👩\u200d👧 환영")).toBe("가족 👨\u200d👩\u200d👧 환영");
    expect(n("\u3164\u3164")).toBeNull();
    expect(n("휴\u0085관\u00ad 안\u2060내")).toBe("휴관 안내");
  });

  it("호명 · 다시 인식 간격", () => {
    expect(kioskVoiceLine(null, "김일삼")).toBe("김일삼님 환영합니다!");
    expect(kioskVoiceLine("{이름}님! {이름}님 파이팅", "박")).toBe("박님! 박님 파이팅");
    expect(kioskVoiceLine("환영합니다!", "김일삼")).toBe("환영합니다!");
    expect(kioskVoiceLine(null, " ")).toBe("회원님 환영합니다!");
    expect(rematchMs({ ...KIOSK_DEFAULTS, rematch_min: 10 })).toBe(600_000);
  });
});
