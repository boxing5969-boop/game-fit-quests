/**
 * 📅 출석 기록 · 출석 50회마다 축하 (2026-10-21 대표님 — 회원님들 요청)
 *   "내정보에 한 달 출석 수 · 지금까지 총 출석 수 확인할 수 있게. 50회 출석 시 챔피언 머니와 마일리지 1000점,
 *    축하 메시지 편지 남겨 주면 좋을 것 같아. 100회 · 150회 · 200회 … 50회 출석될 때마다"
 *
 *   숫자 · 보상은 서버가 정본이다 (supabase/migrations/20261021203532_attendance_milestones.sql):
 *     · get_my_attendance_stats() — 이번 달 · 지난달 · 총 출석 수(그날 첫 인정 출석 = 1번), 다음 축하, 받은 축하, 안 본 축하
 *     · 보상: 챔피언 머니 = 50회마다 1,000씩 커짐(50회 1,000 · 100회 2,000 …), 마일리지 = 매번 1,000점
 *     · 출석이 들어오면 트리거가 바로 준다 · 편지를 닫으면 mark_attendance_milestones_seen()
 *   이 파일은 서버 응답을 안전하게 읽고(normalizeAttendanceStats), 진행 막대 · 편지 문구를 만든다.
 */
import type { LetterContent } from "@/lib/welcomeLetters";

export const ATTENDANCE_STEP = 50;

export interface AttendanceMilestone {
  milestone: number;
  reachedOn: string | null;
  gems: number;
  mileage: number;
  seen: boolean;
}

export interface AttendanceUnseen {
  milestone: number;
  count: number;
  gems: number;
  mileage: number;
}

export interface AttendanceStats {
  total: number;
  month: number;
  lastMonth: number;
  since: string | null;
  recordsSince: string;
  isStaff: boolean;
  step: number;
  next: number;
  nextGems: number;
  nextMileage: number;
  milestones: AttendanceMilestone[];
  unseen: AttendanceUnseen | null;
}

const int = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : d;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** 서버 JSON → 화면용 (빠지거나 이상한 값은 0 · 빈 값) */
export function normalizeAttendanceStats(raw: unknown): AttendanceStats {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const step = int(r.step, ATTENDANCE_STEP) || ATTENDANCE_STEP;
  const total = int(r.total);
  const next = int(r.next) || (Math.floor(total / step) + 1) * step;
  const milestones = (Array.isArray(r.milestones) ? r.milestones : [])
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((m) => ({
      milestone: int(m.milestone),
      reachedOn: str(m.reached_on),
      gems: int(m.gems),
      mileage: int(m.mileage),
      seen: m.seen === true,
    }))
    .filter((m) => m.milestone > 0)
    .sort((a, b) => a.milestone - b.milestone);
  const u = r.unseen && typeof r.unseen === "object" ? (r.unseen as Record<string, unknown>) : null;
  const unseen = u && int(u.milestone) > 0
    ? { milestone: int(u.milestone), count: int(u.count, 1) || 1, gems: int(u.gems), mileage: int(u.mileage) }
    : null;
  return {
    total,
    month: int(r.month),
    lastMonth: int(r.last_month),
    since: str(r.since),
    recordsSince: str(r.records_since) ?? "2026-02-01",
    isStaff: r.is_staff === true,
    step,
    next,
    nextGems: int(r.next_gems),
    nextMileage: int(r.next_mileage),
    milestones,
    unseen,
  };
}

/** 다음 축하까지 — 남은 횟수 · 이번 50회 구간에서 채운 비율(0~1) */
export function milestoneProgress(total: number, step = ATTENDANCE_STEP) {
  const t = Math.max(0, Math.floor(total));
  const s = Math.max(1, Math.floor(step));
  const next = (Math.floor(t / s) + 1) * s;
  const done = t % s;
  return { next, left: next - t, ratio: done / s };
}

const n = (v: number) => v.toLocaleString("ko-KR");

/** '2026-07-12' → '7.12' */
export const shortDate = (iso: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[2])}.${Number(m[3])}` : "";
};

/** 출석 축하 편지 — 이름 · 달성 횟수 · 이번에 드린 보상(안 본 축하를 모두 더한 값) */
export function attendanceLetter(name: string, unseen: AttendanceUnseen): LetterContent {
  const m = unseen.milestone;
  const who = (name || "").trim() || "복서";
  const opener =
    m === 50
      ? `처음 50번이 가장 어렵다고 해요.\n${who}님은 그 고비를 넘었습니다.`
      : m === 100
        ? `세 자리 숫자의 출석.\n이제 ${who}님에게 운동은 의지가 아니라 습관이에요.`
        : `${n(m)}번.\n153에서 이만큼 온 사람은 많지 않아요.`;
  const gift = [
    unseen.gems > 0 ? `챔피언 머니 +${n(unseen.gems)}` : "",
    unseen.mileage > 0 ? `마일리지 +${n(unseen.mileage)}점` : "",
  ].filter(Boolean).join(" · ");
  return {
    eyebrow: `${n(m)} Days at 153`,
    title: `출석 ${n(m)}회를 채운\n${who}님께`,
    body: `${opener}

피곤한 날도, 비 오는 날도,
그냥 쉬고 싶던 날도 있었을 텐데
${who}님은 결국 와서 글러브를 꼈어요.

복싱은 재능보다
'다시 오는 힘'이 만드는 운동이에요.
그 힘을 ${who}님은 ${n(m)}번이나 보여 줬습니다.
${gift ? `\n작은 선물을 담았어요.\n${gift}\n` : ""}
다음 ${n(m + ATTENDANCE_STEP)}회에서 또 축하할게요.`,
    sign: "— 153 일동",
    cta: "다음 라운드도 함께 🥊",
  };
}
