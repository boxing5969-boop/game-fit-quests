/**
 * 153운영본부 · PT 수당 계산 (2026-10-29 대표님 · 보고서 「근로계약서 개정판」 양식 C)
 *
 *   PT 횟수 원본 = 브로제이 PT 수업권 → 153OS → 앱 profiles.pt_remaining. 줄어든 만큼을 서버가 ops_pt_events 로 남긴다.
 *   수당 = 수업 1회당(1:1) · 팀은 '차감된 팀원 1명당 = 팀 1회 수당 ÷ 정원'(팀원이 모두 오면 팀 1회 수당과 같다).
 *   PT 위탁(사업소득) — 3.3% 원천징수: 소득세 3%(10원 미만 버림) + 지방소득세 = 소득세의 10%(10원 미만 버림).
 *   서버(ops_pt_month)는 자료만 — 계산은 이 파일 한 곳.
 */

export type OpsPtStatus = "auto" | "check" | "confirmed" | "excluded";

export interface OpsPtEvent {
  id: string;
  member_user_id: string | null;
  member_name: string;
  ticket_name: string | null;
  before: number | null;
  after: number | null;
  used: number;
  kind: "used" | "ended" | "manual";
  status: OpsPtStatus;
  coach_staff_id: string | null;
  work_date: string;
  detected_at: string;
  note: string | null;
}

export interface OpsPtMember {
  user_id: string;
  name: string;
  ticket: string | null;
  remaining: number | null;
  end_date: string | null;
  checked_at: string | null;
}

export interface OpsPtRate {
  team_size: number;
  sessions: number;
  session_rate: number;
  valid_from: string;
}

export interface OpsPtTicketKind {
  /** 1 = 1:1, 4 = 4인 팀 … */
  teamSize: number;
  /** 수업권 총 횟수 (10 · 20), 모르면 null */
  sessions: number | null;
}

/** "퍼스널 트레이닝 20회권" → 1:1 20회 · "팀PT 4인 10회" · "4:1 PT 20회" → 4인 팀 */
export const classifyTicket = (name: string | null | undefined): OpsPtTicketKind => {
  const s = (name ?? "").replace(/\s+/g, " ");
  const sessions = Number(s.match(/(\d+)\s*회/)?.[1] ?? NaN);
  const team =
    Number(s.match(/(\d+)\s*인/)?.[1] ?? NaN) ||
    Number(s.match(/(\d+)\s*:\s*1/)?.[1] ?? NaN) ||
    (/팀|세미|그룹/.test(s) ? 4 : 1);
  return { teamSize: team >= 1 && team <= 10 ? team : 1, sessions: Number.isFinite(sessions) && sessions > 0 ? sessions : null };
};

/** 그 날짜에 맞는 1회 수당(팀은 팀 1회) — 같은 팀 크기 · 횟수 중 valid_from 이 가장 늦은 것. 없으면 null */
export const sessionRateFor = (rates: OpsPtRate[], kind: OpsPtTicketKind, date: string): number | null => {
  const hits = rates
    .filter((r) => r.team_size === kind.teamSize && (kind.sessions == null || r.sessions === kind.sessions) && r.valid_from <= date)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return hits[0]?.session_rate ?? null;
};

/** 차감 1회(팀은 팀원 1명)당 수당 */
export const perUseRate = (rates: OpsPtRate[], ticket: string | null, date: string): number | null => {
  const kind = classifyTicket(ticket);
  const rate = sessionRateFor(rates, kind, date);
  return rate == null ? null : Math.round(rate / kind.teamSize);
};

/** 수당에 셀 기록 — 빼기(excluded)와 확인 전(check)은 세지 않는다 */
export const countsForPay = (e: OpsPtEvent) => e.status === "auto" || e.status === "confirmed";

/** 3.3% — 소득세 3% · 지방소득세 0.3%(소득세의 10%), 각각 10원 미만 버림 */
export const withholding33 = (gross: number) => {
  const income = Math.floor((gross * 0.03) / 10) * 10;
  const local = Math.floor((income * 0.1) / 10) * 10;
  return { income, local, total: income + local, net: gross - income - local };
};

export interface OpsPtMemberRow {
  key: string;
  name: string;
  ticket: string | null;
  usedThisMonth: number;
  remaining: number | null;
  endDate: string | null;
  pay: number | null;
}

export interface OpsPtSummary {
  /** 수당에 들어간 차감 수(팀은 팀원 1명이 1) */
  uses: number;
  /** 수당 합계(3.3% 전) — 수당표가 없거나 코치 화면이면 null */
  gross: number | null;
  /** 수당표에 없는 수업권 차감 */
  unpriced: number;
  /** 확인이 필요한 기록(수업권이 끝남) */
  toCheck: OpsPtEvent[];
  members: OpsPtMemberRow[];
}

/** 한 코치(또는 coachId=null 이면 지점 전체)의 한 달 PT */
export const computePtMonth = (
  events: OpsPtEvent[],
  members: OpsPtMember[],
  rates: OpsPtRate[] | null,
  coachId: string | null,
): OpsPtSummary => {
  const mine = coachId ? events.filter((e) => e.coach_staff_id === coachId) : events;
  const byKey = new Map<string, OpsPtMemberRow>();
  const keyOf = (userId: string | null, name: string) => userId ?? `name:${name}`;
  for (const m of members) {
    byKey.set(keyOf(m.user_id, m.name), {
      key: keyOf(m.user_id, m.name),
      name: m.name,
      ticket: m.ticket,
      usedThisMonth: 0,
      remaining: m.remaining,
      endDate: m.end_date,
      pay: rates ? 0 : null,
    });
  }
  let uses = 0;
  let gross = 0;
  let unpriced = 0;
  for (const e of mine) {
    if (!countsForPay(e)) continue;
    const key = keyOf(e.member_user_id, e.member_name);
    const row =
      byKey.get(key) ??
      (() => {
        const r: OpsPtMemberRow = { key, name: e.member_name, ticket: e.ticket_name, usedThisMonth: 0, remaining: e.after, endDate: null, pay: rates ? 0 : null };
        byKey.set(key, r);
        return r;
      })();
    row.usedThisMonth += e.used;
    uses += e.used;
    if (rates) {
      const per = perUseRate(rates, e.ticket_name ?? row.ticket, e.work_date);
      if (per == null) unpriced += e.used;
      else {
        gross += per * e.used;
        row.pay = (row.pay ?? 0) + per * e.used;
      }
    }
  }
  // 이번 달 수업한 회원이 위로, 그다음 남은 횟수가 적은 순
  const list = [...byKey.values()]
    .filter((r) => r.usedThisMonth > 0 || r.remaining != null)
    .sort((a, b) => b.usedThisMonth - a.usedThisMonth || (a.remaining ?? 999) - (b.remaining ?? 999) || a.name.localeCompare(b.name));
  return {
    uses,
    gross: rates ? gross : null,
    unpriced,
    toCheck: mine.filter((e) => e.status === "check"),
    members: list,
  };
};
