/**
 * 얼굴 출석 키오스크 — 인식 뒤 [출석] · [퇴장] 버튼 흐름 (2026-11-25)
 *   대표님 11/25 17:30 「얼굴인식후 출석누르면 출석이 되고 나갈때 한번더 인식을하는데 … 퇴장 버튼을 누르면 운동 시간 저장」
 *        11/25 17:42 「10초 자동출석으로 하자 나갈때 퇴장없이 가는사람은 한시간운동으로 처리하자 퇴장 버튼을 누른사람만 모든 운동 시간 기록하고」
 *
 *   · 오늘 처음 인식(출석 전) → [출석]. 10초 안에 안 누르면 자동 출석(출석이 빠지면 XP · 승급 · 153OS 방문 숫자도 같이 빠진다).
 *   · 오늘 출석한 회원이 다시 인식 → [출석] [퇴장]. [퇴장]을 눌러야 그 시각까지 실제 운동 시간이 저장된다.
 *     안 누르면 10초 뒤 닫히고 아무것도 안 바뀐다 → 기본 운동 시간(서버 workout_default_minutes = DEFAULT_SESSION_MINUTES, 지금 66분).
 *   · 회원이 앱에서 직접 남긴 끝(운동 종료 · 시간 고침)이 있는 날 → 기록만 보여 준다(퇴장이 덮지 않음 — 서버 kiosk_finish_workout 와 같은 규칙).
 * 화면 · 호출은 pages/FaceKioskPage, 카드는 components/kiosk/FaceKioskOverlays 의 KioskActionCard.
 */
import { DEFAULT_SESSION_MINUTES } from "@/lib/achievement153";
import { durationLabel, kstTime } from "@/lib/attendanceHistory";

/** 출석 전 카드 — 이 시간 안에 안 누르면 자동 출석 */
export const KIOSK_AUTO_ATTEND_MS = 10_000;
/** 퇴장 카드 — 이 시간 안에 안 누르면 닫힘(기록 없음 = 기본 운동 시간) */
export const KIOSK_EXIT_IDLE_MS = 10_000;
/** 결과(출석 완료 · 운동 시간 저장) 보이는 시간 */
export const KIOSK_RESULT_MS = 3_500;
/** 앱에서 이미 끝낸 날 안내 보이는 시간 */
export const KIOSK_FINISHED_MS = 5_000;

/** 회원이 앱에서 직접 남긴 끝 — 키오스크 [퇴장]이 덮지 않는다 */
export const OWN_END_SOURCES: readonly string[] = ["member_app", "member_fix"];

export const KIOSK_FLOW_TEXT = Object.freeze({
  checking: "확인 중…",
  attend: "출석",
  leave: "퇴장",
  notMe: "제가 아니에요",
  enterHint: (sec: number) => `${sec}초 뒤 자동으로 출석돼요`,
  exitHint: "퇴장을 눌러야 실제 운동 시간이 저장돼요",
  exitIdle: (sec: number) => `안 누르면 ${sec}초 뒤 닫혀요 · 운동 시간은 기본 ${DEFAULT_SESSION_MINUTES}분`,
  attendDone: "출석 완료! 좋은 운동 되세요",
  attendAlready: "오늘은 이미 출석했어요",
  attendFail: "출석 기록에 실패했어요",
  attendFailSub: "데스크에 말씀해 주시면 도와드릴게요",
  finishedTitle: "오늘 운동 기록이 있어요",
});

/** 오늘 이 회원의 출석 상태 (face-kiosk `state`) */
export interface KioskToday {
  attended: boolean;
  startedAt: string | null;
  endedAt: string | null;
  endedSource: string | null;
}

export type KioskCardKind = "enter" | "exit" | "finished";

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** face-kiosk `state` 답 → 오늘 상태. 모양이 틀리면 null(→ 출석 전으로 친다: 이미 출석했으면 서버가 '이미 출석'으로 답한다) */
export function parseKioskToday(json: unknown): KioskToday | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (j.ok !== true || typeof j.attended !== "boolean") return null;
  return { attended: j.attended, startedAt: str(j.started_at), endedAt: str(j.ended_at), endedSource: str(j.ended_source) };
}

/** 어떤 카드를 보일지 */
export function kioskCardKind(today: KioskToday | null): KioskCardKind {
  if (!today || !today.attended) return "enter";
  if (today.endedAt && today.endedSource && OWN_END_SOURCES.includes(today.endedSource)) return "finished";
  return "exit";
}

/** 마감까지 남은 초(올림) — 마감이 없으면 0 */
export function remainingSec(deadline: number | null, nowMs: number): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
}

/** 마감까지 남은 몫(1 → 0) — 줄어드는 막대 */
export function remainingRatio(deadline: number | null, totalMs: number, nowMs: number): number {
  if (deadline === null || totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, (deadline - nowMs) / totalMs));
}

/** 입장부터 지금까지 분 (내림) — 시각이 이상하면 null */
export function elapsedMinutes(startIso: string | null, nowMs: number): number | null {
  if (!startIso) return null;
  const t = new Date(startIso).getTime();
  if (!Number.isFinite(t) || nowMs < t) return null;
  return Math.floor((nowMs - t) / 60_000);
}

/** 퇴장 카드 한 줄 — '18:05 입장 · 지금까지 1시간 12분' */
export function kioskStayLine(startIso: string | null, nowMs: number): string | null {
  if (!startIso) return null;
  const hm = kstTime(startIso);
  if (!hm) return null;
  const m = elapsedMinutes(startIso, nowMs);
  return m !== null && m >= 1 ? `${hm} 입장 · 지금까지 ${durationLabel(m)}` : `${hm} 입장`;
}

/** 출석 두 갈래 결과 — 153OS 출석부(/api/face/attend) · 마이복서153(face-kiosk checkin) */
export type KioskLeg = "ok" | "already" | "skip" | "fail";

export interface KioskAttendResult {
  ok: boolean;
  already: boolean;
  title: string;
  sub: string | null;
}

/**
 * 한쪽이라도 남았으면 출석 완료로 보인다(153OS 원장 · 앱 기록은 서로 다른 길 — 못 남긴 쪽은 직원용 진단에만).
 * skip = 그 길이 없음(앱 계정 연결 전 회원 · 아직 /attend 가 없는 옛 153OS 워커).
 */
export function kioskAttendResult(os: KioskLeg, app: KioskLeg): KioskAttendResult {
  const okLeg = (l: KioskLeg) => l === "ok" || l === "already";
  if (!okLeg(os) && !okLeg(app)) {
    return { ok: false, already: false, title: KIOSK_FLOW_TEXT.attendFail, sub: KIOSK_FLOW_TEXT.attendFailSub };
  }
  // 앱이 '오늘 이미 출석'이라 하면 이미 출석(브로제이 · QR 로 먼저 찍힌 날). 앱 길이 없으면 153OS 답을 따른다.
  const already = app === "already" || (app !== "ok" && os === "already");
  return { ok: true, already, title: already ? KIOSK_FLOW_TEXT.attendAlready : KIOSK_FLOW_TEXT.attendDone, sub: null };
}

/** face-kiosk `checkout` 답 */
export interface KioskCheckout {
  ok: boolean;
  code: string | null;
  alreadyFinished: boolean;
  source: string | null;
  minutes: number | null;
  xp: number;
}

export function parseKioskCheckout(json: unknown): KioskCheckout | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (typeof j.ok !== "boolean") return null;
  const minutes = typeof j.minutes === "number" && Number.isFinite(j.minutes) ? Math.round(j.minutes) : null;
  const xp = typeof j.xp_granted === "number" && Number.isFinite(j.xp_granted) ? Math.max(0, Math.round(j.xp_granted)) : 0;
  return { ok: j.ok, code: str(j.code), alreadyFinished: j.already_finished === true, source: str(j.source), minutes, xp };
}

export interface KioskLeaveResult {
  ok: boolean;
  title: string;
  sub: string | null;
  /** 이름 호명 음성 — 저장됐을 때만 */
  voice: string | null;
  /** 다시 누를 수 있게 카드를 남길지(저장 실패 — 네트워크 등) */
  retry: boolean;
}

/** [퇴장] 결과 글 */
export function kioskLeaveResult(r: KioskCheckout | null, name: string): KioskLeaveResult {
  const who = name.trim() || "회원";
  if (!r) return { ok: false, title: "저장에 실패했어요", sub: "퇴장을 한 번 더 눌러 주세요", voice: null, retry: true };
  if (!r.ok) {
    if (r.code === "NO_ATTENDANCE") {
      return { ok: false, title: "오늘 출석 기록이 없어요", sub: KIOSK_FLOW_TEXT.attendFailSub, voice: null, retry: false };
    }
    return { ok: false, title: "저장에 실패했어요", sub: "퇴장을 한 번 더 눌러 주세요", voice: null, retry: true };
  }
  const dur = r.minutes !== null ? durationLabel(r.minutes) : null;
  if (r.alreadyFinished) {
    return { ok: true, title: "앱에서 운동 종료한 기록이 있어요", sub: dur ? `${dur} 기록 그대로예요` : null, voice: null, retry: false };
  }
  return {
    ok: true,
    title: dur ? `오늘 운동 ${dur} 저장!` : "운동 시간 저장!",
    sub: r.xp > 0 ? `+${r.xp} XP · 수고하셨어요` : "수고하셨어요",
    voice: dur ? `${who}님, 오늘 ${dur} 운동하셨어요. 수고하셨어요!` : `${who}님, 수고하셨어요!`,
    retry: false,
  };
}

/** 앱에서 이미 끝낸 날 — '오늘 1시간 20분 운동 기록' */
export function kioskFinishedLine(today: KioskToday | null): string | null {
  if (!today?.startedAt || !today.endedAt) return null;
  const s = new Date(today.startedAt).getTime();
  const e = new Date(today.endedAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  // 서버 workout_minutes 와 같은 테 — 기본보다 짧으면 기본 · 4시간 넘으면 기본 · 180분 상한
  const raw = Math.ceil((e - s) / 60_000);
  const m = raw > 240 ? DEFAULT_SESSION_MINUTES : Math.min(180, Math.max(DEFAULT_SESSION_MINUTES, raw));
  return `오늘 ${durationLabel(m)} 운동 기록 · 수고하셨어요`;
}
