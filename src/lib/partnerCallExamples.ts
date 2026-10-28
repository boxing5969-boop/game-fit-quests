/**
 * 운동 모집 '이렇게 올려 보세요' 예시 (2026-10-28 대표님 "게시물5개 올라올때까지는 다양한 예시 넣어놓자").
 *
 * 우리 지점에 모집이 5개 올라올 때까지(get_partner_calls_v2 의 branchPosts) 시트와 커뮤니티 맨 위 카드에 보인다.
 * 진짜 모집과 헷갈리지 않게: 늘 '예시' 표시 · 점선 테두리 · 사람 이름 없음 · 저요 단추 없음.
 * 누르면 올리기 칸이 그 내용으로 채워진다 — 올리는 것은 회원 본인이 고쳐서 '모집 올리기'를 눌러야 한다.
 * 날마다 순서를 바꿔 여러 가지가 보이게 한다(같은 날에는 같은 순서).
 */
import type { PartnerPurpose } from "@/services/communityHubService";
import { laterHours } from "@/lib/partnerCallTime";

/** 이만큼 모집이 올라오면 예시를 그만 보인다 */
export const EXAMPLES_UNTIL_POSTS = 5;

export interface PartnerCallExample {
  id: string;
  purpose: PartnerPurpose;
  /** 몇 시 — null 이면 '지금'(체육관에 있을 때 30분) */
  hour: number | null;
  note: string;
}

export const PARTNER_CALL_EXAMPLES: PartnerCallExample[] = [
  { id: "mitt-evening", purpose: "mitt", hour: 19, note: "3라운드만 미트 잡아 주실 분 — 저도 잡아 드릴게요" },
  { id: "now-mitt", purpose: "mitt", hour: null, note: "샌드백 옆에 있어요, 원투 미트 5분만 같이 해요" },
  { id: "morning", purpose: "together", hour: 7, note: "아침 운동 같이 해요 — 줄넘기 3라운드부터" },
  { id: "lunch", purpose: "together", hour: 12, note: "점심시간 30분, 서킷 같이 돌아요" },
  { id: "night", purpose: "together", hour: 21, note: "퇴근하고 9시에 와요, 마지막 라운드 같이 버텨요" },
  { id: "first-mitt", purpose: "mitt", hour: 20, note: "미트가 처음이라 천천히 맞춰 주실 분 찾아요" },
  { id: "combo", purpose: "mitt", hour: 18, note: "원투 훅 콤비 연습해요, 서로 10번씩 잡아 줘요" },
];

/** 예시를 보일까 — 서버가 branchPosts 를 알려 줄 때만 (모르면 안 보인다) */
export const showPartnerExamples = (branchPosts: number | null | undefined): boolean =>
  typeof branchPosts === "number" && branchPosts < EXAMPLES_UNTIL_POSTS;

/** 한국 날짜 'YYYY-MM-DD' */
export function kstDayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** 오늘 보일 예시 n개 — 날짜로 시작 자리를 돌려 날마다 다른 예시가 앞에 온다 */
export function examplesForDay(n: number, day: string = kstDayKey()): PartnerCallExample[] {
  const list = PARTNER_CALL_EXAMPLES;
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const start = h % list.length;
  const out: PartnerCallExample[] = [];
  for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[(start + i) % list.length]);
  return out;
}

/**
 * 지금 보일 예시 n개 — 지금 그대로 올릴 수 있는 것(아직 안 지난 시간 · 체육관에 있으면 '지금')을 앞에,
 * 지난 시간 예시는 뒤에(여러 가지를 보이려고). '지금' 예시는 체육관에 있을 때만 — 아니면 '지금'으로 못 올린다.
 * (저녁에 '아침 운동' 예시를 눌러 저녁 모집에 아침 글이 올라가는 일을 줄인다)
 */
export function examplesFor(
  n: number,
  { now, atGym, day = kstDayKey() }: { now: number; atGym: boolean; day?: string },
): PartnerCallExample[] {
  const later = new Set(laterHours(now));
  const all = examplesForDay(PARTNER_CALL_EXAMPLES.length, day).filter((ex) => ex.hour != null || atGym);
  const fits = (ex: PartnerCallExample) => (ex.hour == null ? atGym : later.has(ex.hour));
  return [...all.filter(fits), ...all.filter((ex) => !fits(ex))].slice(0, Math.max(0, n));
}
