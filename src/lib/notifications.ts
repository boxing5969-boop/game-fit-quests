/**
 * 🔔 회원 앱 안 알림함 — 화면이 쓰는 순수 계산 (2026-10-01 대표님).
 *
 * notifications 행(공지·출석 취소·수업 참여 등)을 날짜별로 묶고, 시각을 한국 시간으로 적는다.
 * 시각 글자는 메시지(DM)와 같은 규칙(lib/dmTime) — 폰 시간대·언어 설정이 달라도 같은 모양.
 * 테스트: notifications.test.ts
 */
import { dmBubbleTime, dmDayLabel, kstDayKey } from "@/lib/dmTime";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  /** 누르면 열 앱 안 화면 — 안전한 앱 안 주소일 때만 (아니면 null) */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * 앱 안 주소만 — '/' 로 시작하고, '//host'·역슬래시·공백이 없는 것 (DB 의 notifications_link_internal 과 같은 규칙).
 * 휴대폰 알림을 눌러 바깥 주소로 나가는 일이 없게 화면에서도 한 번 더 거른다.
 */
export const isSafeAppLink = (link: unknown): link is string =>
  typeof link === "string" && link.length <= 300 && /^\/([^/\\\s][^\\\s]*)?$/.test(link);

type Row = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  link?: unknown;
  read_at?: unknown;
  created_at?: unknown;
};

/** 서버 행 → 화면 모양. 모양이 이상한 행은 null */
export function normalizeNotification(row: unknown): AppNotification | null {
  const r = (row ?? {}) as Row;
  if (typeof r.id !== "string" || typeof r.created_at !== "string") return null;
  return {
    id: r.id,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : "알림",
    body: typeof r.body === "string" ? r.body.trim() : "",
    link: isSafeAppLink(r.link) ? r.link : null,
    readAt: typeof r.read_at === "string" ? r.read_at : null,
    createdAt: r.created_at,
  };
}

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** 날짜 묶음 제목 — 오늘 · 어제 · "9월 30일 수요일" */
export const notificationDayLabel = (iso: string, now: Date = new Date()): string => {
  const diff = dayDiff(kstDayKey(now), kstDayKey(iso));
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  return dmDayLabel(iso, now);
};

/** 알림 한 줄의 시각 — 방금 · 12분 전 · 오후 4:51 */
export const notificationTime = (iso: string, now: Date = new Date()): string => {
  const ms = now.getTime() - Date.parse(iso);
  if (Number.isFinite(ms) && ms >= 0) {
    if (ms < 60_000) return "방금";
    if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}분 전`;
  }
  return dmBubbleTime(iso);
};

export interface NotificationDay {
  key: string;
  label: string;
  items: AppNotification[];
}

/** 최신순 목록 → 날짜별 묶음 (순서 유지) */
export function groupNotificationsByDay(items: readonly AppNotification[], now: Date = new Date()): NotificationDay[] {
  const out: NotificationDay[] = [];
  for (const n of items) {
    const key = kstDayKey(n.createdAt);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(n);
    else out.push({ key, label: notificationDayLabel(n.createdAt, now), items: [n] });
  }
  return out;
}

/** 배지 숫자 — 99 넘으면 99+ */
export const badgeText = (n: number): string => (n > 99 ? "99+" : String(n));
