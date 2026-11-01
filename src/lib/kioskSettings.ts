/**
 * 얼굴 출석 키오스크 — 153OS 「출석 프로그램 설정」 받기 (2026-11-02 대표님 「둘 다 차례로」)
 *
 * 153OS CRM '설정 › 출석 프로그램 설정' 에서 지점마다 정한 값을 키오스크가 켤 때와 1분마다 읽는다
 *   POST https://153-boxing-os-api…/api/face/settings (x-kiosk-key — 키가 지점을 정한다)
 * 못 읽거나(옛 워커 · 네트워크) 이상한 값은 그 칸만 기본값 — 키오스크는 지금처럼 동작한다.
 * 출입 판단(verify)은 이 설정과 상관없다 — 얼굴 출석 쉬기는 키오스크가 인식을 멈추는 것.
 * 기본 글은 153OS workers/api/src/lib/kioskSettings.ts 와 같은 글.
 */

export interface KioskSettings {
  /** 얼굴 출석 켜기 — 끄면 인식을 멈추고 쉬는 화면 */
  face_enabled: boolean;
  /** 쉬는 동안 문구 (null = 기본) */
  paused_text: string | null;
  /** "앱 QR 로도 출석할 수 있어요" 안내 줄 */
  qr_hint: boolean;
  /** 기다리는 화면 아래 안내 (null = 안 보임) */
  notice_text: string | null;
  /** 인식했을 때 이름 아래 인사 (null = 시간대별 인사) */
  welcome_text: string | null;
  /** 호명 음성 — {이름} 자리에 이름 (null = "{이름}님 환영합니다!") */
  voice_text: string | null;
  /** 소리 — 153OS 에서 한 번이라도 저장했을 때만 기기 값을 덮는다(KioskSettingsState.saved) */
  sound_on: boolean;
  /** 같은 회원 다시 인식까지 분 */
  rematch_min: number;
}

export interface KioskSettingsState {
  settings: KioskSettings;
  /** 153OS 에 저장된 설정이 있는지 (없으면 기본값 — 소리는 기기 값을 그대로 둔다) */
  saved: boolean;
}

export const KIOSK_DEFAULTS: Readonly<KioskSettings> = Object.freeze({
  face_enabled: true,
  paused_text: null,
  qr_hint: false,
  notice_text: null,
  welcome_text: null,
  voice_text: null,
  sound_on: true,
  rematch_min: 5,
});

export const KIOSK_TEXT = Object.freeze({
  paused: "지금은 얼굴 출석을 쉬고 있어요",
  pausedSub: "데스크에 말씀해 주시면 도와드릴게요",
  qr: "앱 QR 로도 출석할 수 있어요",
  voice: "{이름}님 환영합니다!",
});

/** 설정을 다시 읽는 간격 — 153OS 에서 바꾸면 이 안에 들어간다 */
export const KIOSK_SETTINGS_POLL_MS = 60_000;

const TEXT_MAX = { paused_text: 60, notice_text: 60, welcome_text: 40, voice_text: 40 } as const;

/** 한 줄 글 — 제어 · 보이지 않는 문자 빼고 빈칸 정리. 비었거나 너무 길면 null(기본값) */
function line(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // 줄바꿈·탭은 빈칸으로(아래 \s+), 그 밖의 제어 문자와 보이지 않는 방향·폭 문자는 뺀다 — 153OS 워커와 같은 규칙
  const t = v
    // eslint-disable-next-line no-control-regex -- 제어 문자를 지우려는 정규식
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t && [...t].length <= max ? t : null;
}

/** 153OS 답(data) → 키오스크 설정. 모양이 틀리면 기본값 */
export function normalizeKioskSettings(data: unknown): KioskSettingsState {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const raw = d.settings && typeof d.settings === "object" ? (d.settings as Record<string, unknown>) : {};
  const bool = (v: unknown, dv: boolean) => (typeof v === "boolean" ? v : dv);
  const rm = raw.rematch_min;
  return {
    saved: typeof d.updated_at === "string" && d.updated_at.length > 0,
    settings: {
      face_enabled: bool(raw.face_enabled, KIOSK_DEFAULTS.face_enabled),
      paused_text: line(raw.paused_text, TEXT_MAX.paused_text),
      qr_hint: bool(raw.qr_hint, KIOSK_DEFAULTS.qr_hint),
      notice_text: line(raw.notice_text, TEXT_MAX.notice_text),
      welcome_text: line(raw.welcome_text, TEXT_MAX.welcome_text),
      voice_text: line(raw.voice_text, TEXT_MAX.voice_text),
      sound_on: bool(raw.sound_on, KIOSK_DEFAULTS.sound_on),
      rematch_min: typeof rm === "number" && Number.isInteger(rm) && rm >= 1 && rm <= 30 ? rm : KIOSK_DEFAULTS.rematch_min,
    },
  };
}

/** 호명 음성 — {이름} 자리에 이름 (없으면 글 그대로) */
export function kioskVoiceLine(template: string | null, name: string): string {
  return (template ?? KIOSK_TEXT.voice).split("{이름}").join(name.trim() || "회원");
}

export const rematchMs = (s: KioskSettings): number => s.rematch_min * 60_000;
