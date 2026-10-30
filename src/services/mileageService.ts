/**
 * 앱 마일리지 — RPC 래퍼 (2026-09-28).
 *
 * 대표님 지시: 출석 +500 · 레벨업 +500 · 레벨 10 타이틀매치 승급 +5,000.
 *
 * 적립은 전부 서버가 한다 — 이 파일에는 적립(쓰기) 경로가 없다.
 *   출석      = attendance_logs 에 그날 첫 인정 출석이 들어올 때 (트리거 mileage_on_attendance, 하루 1번)
 *   레벨업    = 레벨 승인 순간 (트리거 mileage_on_progress, 같은 레벨은 한 번만)
 *   타이틀매치 = 레벨 10 타이틀매치 승급 순간 (같은 리그는 한 번만)
 * 지도진·관리자 계정은 적립 제외, 규칙이 켜진 시각 이전 기록은 소급하지 않는다.
 * 원장(mileage_ledger)은 브로제이 공개 API 에 마일리지 적립 기능이 생기면 그대로 옮길 수 있게 보관한다.
 *
 * 보호 원칙: 공식 XP / wallet / level 변경 0건. 규칙 저장은 set_app_setting(관리자만).
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type MileageKind = "attendance" | "level_up" | "title_match" | "adjust" | "record" | "milestone";

export interface MileageRules {
  enabled: boolean;
  attendance: number;
  level_up: number;
  title_match: number;
  /** 153 레코드 최초 기록이 새겨질 때 (2026-10-16 대표님 10,000 · 2026-10-28 설정 화면에 칸 추가 — 예전 화면은 저장할 때 이 값을 지웠다) */
  record: number;
  /** 적립 시작 시각(UTC ISO) — 관리자 설정 화면에서만 읽힌다. 서버가 정한다. */
  since?: string;
}

export interface MileageItem {
  amount: number;
  kind: MileageKind;
  reason: string;
  at: string;
}

export interface MyMileage {
  balance: number;
  items: MileageItem[];
  rules: MileageRules | null;
}

export const DEFAULT_MILEAGE_RULES: MileageRules = { enabled: true, attendance: 500, level_up: 500, title_match: 5000, record: 10000 };

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

const toInt = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

/** 서버 JSON → 규칙 (빠진 칸은 기본값) */
export function normalizeRules(raw: unknown): MileageRules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled !== false,
    attendance: toInt(r.attendance, DEFAULT_MILEAGE_RULES.attendance),
    level_up: toInt(r.level_up, DEFAULT_MILEAGE_RULES.level_up),
    title_match: toInt(r.title_match, DEFAULT_MILEAGE_RULES.title_match),
    // 서버에 칸이 없으면 0 — 서버(records_153_reward_trg)도 없으면 주지 않는다
    record: toInt(r.record, 0),
    since: typeof r.since === "string" ? r.since : undefined,
  };
}

/** 내 마일리지 — 잔액 + 최근 내역 + 지금 규칙 */
export async function getMyMileage(limit = 20): Promise<MyMileage> {
  const { data, error } = await sbRpc<{ balance?: unknown; items?: unknown; rules?: unknown }>("get_my_mileage", { p_limit: limit });
  if (error) throw new Error(translateError(error));
  const items = Array.isArray(data?.items) ? (data!.items as MileageItem[]) : [];
  return {
    balance: toInt(data?.balance, 0),
    items: items.map((it) => ({ ...it, amount: toInt(it.amount, 0) })),
    rules: normalizeRules(data?.rules),
  };
}

/** 마일리지로 아낀 금액 (2026-10-30 대표님 "배민처럼 지금까지 총 얼마를 할인받았는지") — 앱 결제(취소 뺌) + 데스크 결제 할인 */
export interface MileageSavings {
  total: number;
  count: number;
  app: number;
  desk: number;
  firstAt: string | null;
  lastAt: string | null;
}

export async function getMyMileageSavings(): Promise<MileageSavings> {
  const { data, error } = await sbRpc<Record<string, unknown>>("get_my_mileage_savings");
  if (error) throw new Error(translateError(error));
  return {
    total: Math.max(0, toInt(data?.total, 0)),
    count: Math.max(0, toInt(data?.count, 0)),
    app: Math.max(0, toInt(data?.app, 0)),
    desk: Math.max(0, toInt(data?.desk, 0)),
    firstAt: typeof data?.first_at === "string" ? data.first_at : null,
    lastAt: typeof data?.last_at === "string" ? data.last_at : null,
  };
}

/** "결제 할인 3번 · 앱 19,000원 · 데스크 3,000원" — 한쪽만 있으면 '앱 결제' / '데스크 결제' */
export function savingsDetail(s: Pick<MileageSavings, "count" | "app" | "desk">): string {
  const won = (n: number) => `${Math.trunc(n).toLocaleString("ko-KR")}원`;
  const parts = [`결제 할인 ${s.count}번`];
  if (s.app > 0 && s.desk > 0) parts.push(`앱 ${won(s.app)}`, `데스크 ${won(s.desk)}`);
  else if (s.desk > 0) parts.push("데스크 결제");
  else if (s.app > 0) parts.push("앱 결제");
  return parts.join(" · ");
}

/** 관리자 설정 화면 — 적립 시작 시각까지 포함한 규칙 (app_settings 는 로그인 회원 누구나 읽을 수 있다) */
export async function getMileageRules(): Promise<MileageRules> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("app_settings").select("value").eq("key", "mileage_rules").maybeSingle();
  if (error) throw new Error(translateError(error));
  return normalizeRules((data as { value?: unknown } | null)?.value) ?? { ...DEFAULT_MILEAGE_RULES, enabled: false };
}

/** 관리자만 — 서버(set_app_setting)가 권한·형식(0~100,000 정수)을 검사하고 적립 시작 시각을 정한다 */
export async function setMileageRules(input: Omit<MileageRules, "since">): Promise<void> {
  const value = {
    enabled: input.enabled,
    attendance: input.attendance,
    level_up: input.level_up,
    title_match: input.title_match,
    record: input.record,
  };
  const { error } = await sbRpc<unknown>("set_app_setting", { _key: "mileage_rules", _value: value });
  if (error) throw new Error(translateError(error));
}

/** 12,500 */
export const formatMileage = (n: number): string => Math.trunc(n).toLocaleString("ko-KR");

/** KST 날짜 키 YYYY-MM-DD */
export const kstDateKey = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10);
};

/** 09.28 */
export const kstShortDate = (iso: string): string => {
  const key = kstDateKey(iso);
  return key ? `${key.slice(5, 7)}.${key.slice(8, 10)}` : "";
};

/** 규칙 한 줄 — "출석 +500 · 레벨업 +500 · 타이틀매치 +5,000" (0 인 항목은 뺀다) */
export const mileageRulesLine = (r: MileageRules | null | undefined): string => {
  if (!r || !r.enabled) return "";
  const parts: string[] = [];
  if (r.attendance > 0) parts.push(`출석 +${formatMileage(r.attendance)}`);
  if (r.level_up > 0) parts.push(`레벨업 +${formatMileage(r.level_up)}`);
  if (r.title_match > 0) parts.push(`타이틀매치 +${formatMileage(r.title_match)}`);
  return parts.join(" · ");
};
