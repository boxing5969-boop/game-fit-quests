/**
 * 얼굴 키오스크 위 안내 — 153OS 「출석 프로그램 설정」 (2026-11-02 · FaceKioskPage 에서만 쓴다)
 *   · 쉬는 화면: 153OS 에서 얼굴 출석을 끄면 카메라 위를 덮는다(인식도 멈춤). 아래 소리 · 얼굴 등록 단추는 그대로 눌린다.
 *   · 안내 줄: 기다리는 화면 아래 — 지점이 적은 안내 문구 · "앱 QR 로도 출석할 수 있어요".
 *   글씨는 6단계 이름 — 1m 앞 태블릿에서 읽히게 큰 단계(title 24 · display 40)만 쓴다.
 */
import { KIOSK_TEXT, type KioskSettings } from "@/lib/kioskSettings";

/** 기다리는 화면 아래 안내 줄 — 안내 문구도 QR 안내도 없으면 그리지 않는다 */
export function KioskNoticeBar({ settings }: { settings: KioskSettings }) {
  if (!settings.notice_text && !settings.qr_hint) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-20 flex justify-center">
      <div className="max-w-xl rounded-3xl bg-black/65 px-6 py-3 text-center text-white">
        {settings.notice_text && <p className="text-title text-white">{settings.notice_text}</p>}
        {settings.qr_hint && (
          <p className={`${settings.notice_text ? "mt-1 " : ""}text-heading text-white/75`}>📱 {KIOSK_TEXT.qr}</p>
        )}
      </div>
    </div>
  );
}

/** 얼굴 출석을 쉬는 화면 */
export function KioskPausedScreen({ settings }: { settings: KioskSettings }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-8 text-center" role="status">
      <p className="text-display text-white">{settings.paused_text ?? KIOSK_TEXT.paused}</p>
      <p className="text-title text-white/75">{settings.qr_hint ? `📱 ${KIOSK_TEXT.qr}` : KIOSK_TEXT.pausedSub}</p>
    </div>
  );
}
