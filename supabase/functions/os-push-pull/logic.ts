// os-push-pull 순수 로직 — Deno(Edge Function)와 vitest(src/lib/osPushPull.test.ts)가 같이 쓴다.
//
// 153OS 앱 알림 링크(cleanAppLink — home · notices · notice:<id> · classes · branch · coaches · reviews · inquiries · membership)
//   → 마이복서153 앱 안 경로. 앱에 아직 없는 화면(classes 등)은 null = 알림함에서 내용만 펼쳐 본다.
//   membership = 수강권 탭 (2026-11-05 만료 안내 · 마일리지 알림 — 대표님 "마이복서 153 링크 수강권탭 주면서")

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OS_LINKS: Readonly<Record<string, string>> = {
  home: "/home",
  notices: "/notices",
  branch: "/branch",
  coaches: "/branch?tab=coaches",
  reviews: "/branch?tab=reviews",
  inquiries: "/inquiries",
  membership: "/membership",
};

export function mapOsLink(link: unknown): string | null {
  if (typeof link !== "string") return null;
  const t = link.trim();
  if (Object.prototype.hasOwnProperty.call(OS_LINKS, t)) return OS_LINKS[t];
  const notice = /^notice:([0-9a-f-]{36})$/i.exec(t);
  if (notice && UUID.test(notice[1])) return `/notices/${notice[1].toLowerCase()}`;
  const inquiry = /^inquiry:([0-9a-f-]{36})$/i.exec(t);
  if (inquiry && UUID.test(inquiry[1])) return `/inquiries/${inquiry[1].toLowerCase()}`;
  return null;
}

/** 알림함 한 줄 길이 — 153OS 는 제목 80 · 내용 1000 안팎을 보낸다 */
export const TITLE_MAX = 120;
export const BODY_MAX = 1500;

export interface InboxRow {
  recipient_id: string;
  message_id: string | null;
  user_id: string | null;
  kind: string;
  title: string;
  body: string;
  link: string | null;
}

const clip = (v: unknown, max: number): string => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/**
 * outbox 응답 → 알림함에 넣을 줄. recipient_id 가 이상한 줄은 버린다(ack 도 못 한다).
 * 앱 계정 id 가 이상하면 user_id = null 로 두고(DB 가 건너뛰고 ack 만), 같은 recipient_id 는 한 번만.
 */
export function toInboxRows(rows: unknown): InboxRow[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: InboxRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const rid = typeof o.recipient_id === "string" && UUID.test(o.recipient_id) ? o.recipient_id.toLowerCase() : null;
    if (!rid || seen.has(rid)) continue;
    seen.add(rid);
    const uid = typeof o.ranking_app_user_id === "string" && UUID.test(o.ranking_app_user_id) ? o.ranking_app_user_id.toLowerCase() : null;
    const mid = typeof o.message_id === "string" && UUID.test(o.message_id) ? o.message_id.toLowerCase() : null;
    out.push({
      recipient_id: rid,
      message_id: mid,
      user_id: uid,
      kind: o.kind === "ad" ? "ad" : "info",
      title: clip(o.title, TITLE_MAX) || "153복싱짐 소식",
      body: clip(o.body, BODY_MAX),
      link: mapOsLink(o.link),
    });
  }
  return out;
}
