/**
 * 📅 캘린더 3-1단계 — 구독 주소, 화면 쪽 (2026-11-13 대표님 「추천대로 3-1부터」 · 「캘린더 3단계 보고서」)
 *
 *   주소 하나를 휴대폰(아이폰) · 구글 캘린더에 한 번 넣으면 그 앱이 몇 시간마다 다시 읽어 153 일정이 늘 보인다.
 *   알림 · 위젯 · 워치는 그 캘린더 앱 것을 그대로 쓴다. 한 방향 — 거기서 고쳐도 153에는 안 온다.
 *     · 코치진(kind staff) = 내 일정 · 근무 시간표 · 153 일정 · 정기 회의 (153운영본부 「일정」 탭 맨 아래)
 *     · 회원(kind member) = 운동 약속 · 153 일정 · D-day (내 운동 기록 › 운동 달력 — 약속 시트 · 나만의 체크 시트)
 *     · 지점 공개 주소 = 그 지점 153 일정(승급 심사 빼고) — 「회원 달력」 카드에서 대표님 · 지점장님이 복사
 *   서버: my_calendar_feed · my_calendar_feed_on · my_calendar_feed_off (services/calendarFeedService) →
 *         Edge Function calendar-feed(supabase/functions/calendar-feed — .ics 만들기는 feed.ts).
 *   이 파일은 주소 만들기 · 기기 고르기 · 화면 글만 (시험 calendarFeed.test.ts).
 */

export type FeedKind = "staff" | "member";

export interface FeedState {
  /** 서버에 함수가 있나 — 없으면(DB 적용 전 · 옛 DB 미리보기) 입구를 숨긴다 */
  available: boolean;
  /** 이 계정이 주소를 가질 수 있나 (승인된 회원 · 「일정」 탭을 쓰는 코치진) */
  can: boolean;
  /** 살아 있는 주소가 있나 */
  on: boolean;
  kind: FeedKind;
  token: string | null;
  createdAt: string | null;
  /** 캘린더 앱이 마지막으로 읽은 때 — 넣고 나면 '방금 읽었어요'로 확인 */
  lastFetchedAt: string | null;
  fetchCount: number;
}

const TOKEN = /^[0-9a-f]{64}$/;
const CODE = /^[a-z0-9-]{2,40}$/;

/** 서버 답 → 화면 상태 (모양이 틀리면 꺼진 것으로) */
export function normalizeFeedState(raw: unknown, kind: FeedKind): FeedState {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const token = typeof o.token === "string" && TOKEN.test(o.token) ? o.token : null;
  const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  return {
    available: true,
    can: o.can === true,
    on: o.on === true && token != null,
    kind,
    token,
    createdAt: iso(o.created_at),
    lastFetchedAt: iso(o.last_fetched_at),
    fetchCount: typeof o.fetch_count === "number" && o.fetch_count > 0 ? Math.floor(o.fetch_count) : 0,
  };
}

/** 서버에 함수가 없을 때 */
export const unavailableFeed = (kind: FeedKind): FeedState => ({
  available: false,
  can: false,
  on: false,
  kind,
  token: null,
  createdAt: null,
  lastFetchedAt: null,
  fetchCount: 0,
});

/** Edge Function 주소 (base = VITE_SUPABASE_URL) */
export const feedBase = (base: string): string => `${base.replace(/\/+$/, "")}/functions/v1/calendar-feed`;

/** 내 구독 주소 (https) — 토큰이 틀리면 null */
export const feedHttpsUrl = (base: string | null | undefined, token: string | null): string | null =>
  base && token && TOKEN.test(token) ? `${feedBase(base)}/${token}.ics` : null;

/** 아이폰 · 맥 캘린더가 '구독'으로 여는 주소 */
export const feedWebcalUrl = (httpsUrl: string): string => httpsUrl.replace(/^https?:\/\//, "webcal://");

/** 구글 캘린더 '구독 추가' 화면 (cid = webcal 주소 그대로 — 알려진 모양) */
export const googleAddUrl = (httpsUrl: string): string => `https://calendar.google.com/calendar/render?cid=${feedWebcalUrl(httpsUrl)}`;

/** 파일로 받기 (한 번 넣기 — 네이버 캘린더 가져오기 등) */
export const feedDownloadUrl = (httpsUrl: string): string => `${httpsUrl}?download=1`;

/** 지점 공개 주소 — 지점 코드가 틀리면 null */
export const branchFeedUrl = (base: string | null | undefined, code: string | null | undefined): string | null =>
  base && code && CODE.test(code) ? `${feedBase(base)}/branch/${code}.ics` : null;

/** 주소에 들어가는 것 */
export const FEED_INCLUDES: Record<FeedKind, string> = {
  staff: "내 일정 · 근무 시간표 · 153 일정 · 정기 회의",
  member: "운동 약속 · 153 일정 · D-day",
};

export const FEED_TITLE: Record<FeedKind, string> = {
  staff: "휴대폰 캘린더에서 보기",
  member: "휴대폰 캘린더에서 늘 보기",
};

/** 주소를 만들기 전 — 무엇이 좋은지 세 줄 (셋째 줄 = 무엇이 안 들어가나) */
export const FEED_POINTS: Record<FeedKind, readonly string[]> = {
  staff: ["한 번 넣으면 153에서 바뀐 일정이 저절로 따라와요", "알림 · 위젯 · 워치는 쓰시던 캘린더 그대로예요", "PT · 개인 일정은 제목 없이, 메모는 넣지 않아요"],
  member: ["한 번 넣으면 153에서 바뀐 일정이 저절로 따라와요", "알림 · 위젯 · 워치는 쓰시던 캘린더 그대로예요", "이름 · 운동 기록은 넣지 않아요"],
};

/** 만들기 단추 아래 한 줄 */
export const FEED_SECRET = "주소를 아는 사람은 일정을 볼 수 있어요 — 다른 사람에게 보내지 마세요";

/** 다른 캘린더에 넣는 법 (접어 둔 칸) */
export const FEED_TIPS: readonly string[] = [
  "컴퓨터 구글 캘린더 — '다른 캘린더 +' › 'URL로 추가'에 주소를 붙여 넣어요",
  "삼성 캘린더 — 구글 캘린더에 넣으면 같이 보여요",
  "네이버 캘린더 — '파일로 받기' 뒤 PC 네이버 캘린더 '가져오기'(한 번만 들어가요)",
  "구글 캘린더는 하루에 몇 번만 새로 읽어서, 바뀐 일정이 늦게 보일 수 있어요",
  "휴대폰 캘린더에서 고친 것은 153에 안 바뀌어요",
];

/** 주소를 아는 사람은 일정을 볼 수 있어서 — 시트 맨 아래 한 줄 */
export const FEED_PRIVACY: Record<FeedKind, string> = {
  staff: "주소가 다른 사람에게 갔다면 '새 주소 만들기'로 옛 주소를 끊어요 · PT · 개인 일정은 제목 없이 나가요",
  member: "주소가 다른 사람에게 갔다면 '새 주소 만들기'로 옛 주소를 끊어요 · 이름 · 운동 기록은 넣지 않아요",
};

export type FeedDevice = "apple" | "android" | "other";

/** 기기 — 아이폰 · 아이패드 · 맥은 webcal 로 바로 구독, 안드로이드 · 그 밖은 구글 캘린더로 */
export function feedDevice(ua: string, iosApp = false): FeedDevice {
  if (/Android/i.test(ua)) return "android";
  if (iosApp || /iPhone|iPad|iPod|Macintosh/i.test(ua)) return "apple";
  return "other";
}

/** 캘린더가 마지막으로 읽은 때 — "방금" · "12분 전" · "3시간 전" · "2일 전" · 아직이면 null */
export function fetchedAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (min < 2) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 연결 확인 한 줄 — 넣고 나면 캘린더가 읽어 간다 */
export function fetchedLine(st: Pick<FeedState, "lastFetchedAt">, now: Date = new Date()): string {
  const ago = fetchedAgo(st.lastFetchedAt, now);
  if (!ago) return "아직 읽어 간 캘린더가 없어요 — 넣고 나면 여기에 '방금 읽어 갔어요'가 떠요";
  return `캘린더가 ${ago === "방금" ? ago : `${ago}에`} 읽어 갔어요 — 잘 연결됐어요`;
}
