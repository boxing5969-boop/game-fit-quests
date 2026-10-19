/**
 * 수강권 화면 — PT 남은 횟수 · 락카 번호 (2026-10-19 대표님:
 * "PT 회원님들 수강권 들어가면 몇회 남았는지 락카번호 몇번인지 확인할수있게 해줘").
 *
 * 원본은 브로제이다. 153OS 가 회원별 이용권을 확인할 때 기록하고(회원마다 하루에 한 번쯤),
 * sync-pt-members(매시 40분)가 전화번호로 profiles 에 옮긴다:
 *   · pt_ticket · pt_remaining · pt_end_date · pt_checked_at — 대표 PT 수업권 (pt_until 은 '배지 유효일'이라 실제 기한과 다르다)
 *   · locker_label · locker_updated_at — 락카 ("개인락카 / 11"). 153OS 가 브로제이 락카를 읽지 않아 지금은 데스크가 회원 상세에서 넣는다
 * 확인이 하루쯤 늦을 수 있어 화면에는 '언제 기준'을 같이 보여 준다.
 */
import { kstToday } from "@/lib/levelPractice";
import { isPtMember } from "@/lib/ptMember";

type InfoLike = {
  pt_ticket?: string | null;
  pt_remaining?: number | null;
  pt_end_date?: string | null;
  pt_checked_at?: string | null;
  locker_label?: string | null;
  locker_updated_at?: string | null;
};

export interface PtTicketView {
  /** 수업권 이름 (예: 퍼스널 트레이닝 20회권) */
  ticket: string | null;
  /** 남은 횟수 — 모르면 null */
  remaining: number | null;
  /** 수업권 기한 (YYYY-MM-DD) */
  endDate: string | null;
  /** 브로제이에서 확인한 시각 (ISO) */
  asOf: string | null;
}

const clean = (s: unknown): string | null => {
  const t = typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
  return t ? t : null;
};
const dateOnly = (s: unknown): string | null => {
  const t = typeof s === "string" ? s.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

/** PT 회원이면 수업권 정보, 아니면 null (PT 판정은 회원카드 파란 배지와 같은 isPtMember) */
export function ptTicketView(p: unknown, today: string = kstToday()): PtTicketView | null {
  if (!isPtMember(p, today)) return null;
  const x = p as InfoLike;
  const remaining =
    typeof x.pt_remaining === "number" && Number.isFinite(x.pt_remaining) && x.pt_remaining >= 0
      ? Math.floor(x.pt_remaining)
      : null;
  return {
    ticket: clean(x.pt_ticket),
    remaining,
    endDate: dateOnly(x.pt_end_date),
    asOf: clean(x.pt_checked_at),
  };
}

export interface LockerView {
  /** 락카 번호 (예: "11") — 번호가 아닌 이름이면 그대로 */
  number: string;
  /** 구역 이름 (예: "개인락카") — 없으면 null */
  area: string | null;
  /** 브로제이에서 확인한 시각 (ISO) */
  asOf: string | null;
}

/**
 * 브로제이 락카 칸 → 화면용.
 *   "개인락카 / 11" → { number: "11", area: "개인락카" }
 *   "11" → { number: "11", area: null } · "11번" → { number: "11", area: null }
 *   빈 값 · "없음" · "-" → null
 */
export function lockerView(p: unknown): LockerView | null {
  if (!p || typeof p !== "object") return null;
  const x = p as InfoLike;
  const raw = clean(x.locker_label);
  if (!raw || /^(-+|없음|미사용|미배정|해당\s*없음)$/.test(raw)) return null;
  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : raw;
  const area = parts.length > 1 ? parts.slice(0, -1).join(" / ") : null;
  const num = last.replace(/\s*번$/, "").trim();
  if (!num) return null;
  return { number: num, area, asOf: clean(x.locker_updated_at) };
}

/** 락카 번호 표시 — 숫자면 "11번", 이름이면 그대로 */
export const lockerNumberText = (l: LockerView): string => (/^\d+$/.test(l.number) ? `${l.number}번` : l.number);

const KST = 9 * 3600 * 1000;

/**
 * 확인 시각 → "오늘 오후 2:40 기준" · "어제 오후 9:40 기준" · "10월 17일 기준" (KST).
 * 잘못된 값이면 null.
 */
export function asOfLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const day = kstToday(t);
  const today = kstToday(now);
  const yesterday = kstToday(now - 86400000);
  const k = new Date(t + KST);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  const time = `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
  if (day === today) return `오늘 ${time} 기준`;
  if (day === yesterday) return `어제 ${time} 기준`;
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 기준`;
}

/** "2027-02-11" → "2027. 2. 11." (수강권 카드의 날짜 모양과 같다) */
export const ymdText = (d: string): string => {
  const [y, mo, da] = d.split("-").map((v) => parseInt(v, 10));
  return `${y}. ${mo}. ${da}.`;
};
