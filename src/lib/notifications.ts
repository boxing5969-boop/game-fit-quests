/**
 * 🔔 회원 앱 안 알림함 — 화면이 쓰는 순수 계산 (2026-10-01 대표님).
 *
 * notifications 행(공지·출석 취소·수업 참여 등)을 날짜별로 묶고, 시각을 한국 시간으로 적는다.
 * 시각 글자는 메시지(DM)와 같은 규칙(lib/dmTime) — 폰 시간대·언어 설정이 달라도 같은 모양.
 * 테스트: notifications.test.ts
 */
import { dmBubbleTime, dmDayLabel, kstDayKey } from "@/lib/dmTime";
import { opsWorkLink } from "@/lib/opsLink";

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

const OPS_WORK_LINK = "/office?tab=work";

/** "MM/DD" → 그날 — 알림이 온 날에서 가장 가까운 해(새해 첫날 받은 12/31 은 지난해 · 미리 낸 대타 요청 1/2 는 다음 해) */
const mdDay = (mm: string, dd: string, createdAt: string): string => {
  const sent = kstDayKey(createdAt);
  const y = Number(sent.slice(0, 4));
  const t = Date.parse(`${sent}T00:00:00Z`);
  const gap = (d: string) => Math.abs(Date.parse(`${d}T00:00:00Z`) - t);
  return [y, y - 1, y + 1].map((yy) => `${yy}-${mm}-${dd}`).reduce((a, b) => (gap(b) < gap(a) ? b : a));
};
/** 「📍 출근 기록 없음」 · 「📍 출근 신고」 본문 앞 "11/25 12:00 …" → 그날 */
const dutyDayOf = (body: string, createdAt: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\s/.exec(body);
  return m ? mdDay(m[1], m[2], createdAt) : null;
};

/**
 * 이미 와 있던 알림의 링크를 「바로 그 화면」으로 올려 읽는다 (2026-11-26 대표님 「내용 누르면 바로 그 부분으로 …
 * 근무 메뉴로는 가는데 PT 확인 메뉴까지는 못 가네」). 이제 서버가 정확한 링크를 넣지만, 그 전에 쌓인 알림은
 * 근무 탭 첫 화면(/office?tab=work)이나 링크 없음이라 화면에서 한 번 더 고쳐 읽는다 — lib/opsLink · OpsWorkTab.
 */
export function upgradeNotificationLink(title: string, body: string, link: string | null, createdAt: string): string | null {
  if (link === OPS_WORK_LINK) {
    // PT 기록 · 이틀 넘은 확인 필요 — 본문 첫 칸이 지점("선릉역점 · 기록 없는 입장 1건 · …")
    if (title.startsWith("PT 기록 · 이틀 넘은 확인 필요")) {
      const seg = (body.split(" · ")[0] ?? "").trim();
      return opsWorkLink({ pt: "check", b: /점$/.test(seg) && seg.length <= 20 ? seg : null });
    }
    // 📍 출근 기록 없음 · 이름 — 그 코치의 그날 시트(근무자 카드 id 가 없어 이름으로)
    const duty = /^📍️?\s*출근 기록 없음 · (.+)$/u.exec(title);
    if (duty) return opsWorkLink({ staffname: duty[1].trim(), day: dutyDayOf(body, createdAt) });
    // 승인 요청 — 「확인할 것」의 그 줄(승인 · 반려)로 (2026-11-26 「클릭하면 바로 할수있게」 · 요청 id 가 없어 이름 · 날짜로)
    //   ⏱ 연장 근무 신청 "박성현 · 11/25 60분 — 승인해 주세요" · 🔁 수업 대타 요청 "박성현 → 김코치 · 11/25 14:00~15:00"
    if (/^⏱️?\s*연장 근무 신청/u.test(title)) {
      const m = /^(.+?) · (\d{2})\/(\d{2})\s/.exec(body);
      return opsWorkLink({ todo: "overtime", staffname: m?.[1]?.trim(), day: m ? mdDay(m[2], m[3], createdAt) : null });
    }
    if (/^🔁️?\s*수업 대타 요청/u.test(title)) {
      const m = /^(.+?) → .+? · (\d{2})\/(\d{2})\s/.exec(body);
      return opsWorkLink({ todo: "cover", staffname: m?.[1]?.trim(), day: m ? mdDay(m[2], m[3], createdAt) : null });
    }
    //   📍 출근 신고 · 이름 "11/25 와 있었어요 10:58 — 확인해 주세요"
    const rep = /^📍️?\s*출근 신고 · (.+)$/u.exec(title);
    if (rep) return opsWorkLink({ todo: "duty", staffname: rep[1].trim(), day: dutyDayOf(body, createdAt) });
    return link;
  }
  if (link === null) {
    // 링크 없이 오던 출석 · 레벨 알림 — 본문이 말하는 홈(내 카드 · 레벨)으로
    if (title.startsWith("오늘 출석 완료!") && body.includes("홈에서")) return "/home";
    if (/^레벨 \d+ 달성!/.test(title)) return "/home";
  }
  return link;
}

/** 서버 행 → 화면 모양. 모양이 이상한 행은 null */
export function normalizeNotification(row: unknown): AppNotification | null {
  const r = (row ?? {}) as Row;
  if (typeof r.id !== "string" || typeof r.created_at !== "string") return null;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : "알림";
  const body = typeof r.body === "string" ? r.body.trim() : "";
  const up = upgradeNotificationLink(title, body, isSafeAppLink(r.link) ? r.link : null, r.created_at);
  return {
    id: r.id,
    title,
    body,
    link: isSafeAppLink(up) ? up : null,
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
