/**
 * 닉네임 = 앱 카드 · 체육관 TV(사이니지)에 보이는 이름 (2026-11-28 대표님
 * 「회원님들 내정보에서 이름 바꿀수있도록 … 앱카드나 사이니지에 올라가는 아이디 이름」 · docs/features/72)
 *
 * 화면에 보이는 이름은 늘 profiles.nickname, 비어 있으면 실명(profiles.name) 순서다 —
 * 홈 라이센스 카드 · 랭킹 · 하트 · TV 운동 중 칸(board_people) · 출석 때 찍는 이름(display_name_snapshot,
 * qr-checkin · face-kiosk · sync-broj-checkins 의 기본 'nickname' 모드)이 모두 같다.
 * 실명(name)은 손대지 않는다: 153OS · 브로제이 동기화와 「기록 찾기」가 실명 · 전화번호로 사람을 찾는다.
 *
 * 서버 규칙 = guard_profile_privileged_columns → nickname_problem()
 * ([20261128092219_nickname_rules.sql](../../supabase/migrations/20261128092219_nickname_rules.sql)).
 * 아래 낱말 목록 · 문구는 그 파일과 같아야 한다 — src/lib/nicknameRules.test.ts 가 대조한다.
 * 화면은 저장 전에 같은 검사를 해서 바로 알려 주고, 서버가 마지막에 한 번 더 막는다.
 */

export const NICKNAME_MAX = 12;

/** 글자 수 — 이모지 · 한글 조합을 한 글자로 센다 (서버 char_length 와 같은 기준) */
export const nicknameLen = (s: string): number => Array.from(s).length;

/** 욕설 · 성적인 말 — 누구에게나 (공백 · 기호를 뺀 소문자에서 찾는다) */
export const NICKNAME_BLOCK_WORDS: readonly string[] = [
  "씨발", "시발", "씨팔", "시팔", "ㅅㅂ", "ㅆㅂ",
  "병신", "븅신", "ㅂㅅ", "좆", "존나", "지랄", "ㅈㄹ",
  "개새끼", "개색기", "개세끼", "미친놈", "미친년", "썅", "쌍년",
  "느금마", "니애미", "엠창", "창녀", "섹스", "야동",
  "fuck", "shit", "bitch", "pussy", "asshole", "nigger", "nigga",
];

/** 운영진처럼 보이는 말 — 회원만 (지도진 계정은 직함이 따로 붙는다) */
export const NICKNAME_STAFF_WORDS: readonly string[] = [
  "관장", "관리자", "운영자", "운영진", "지점장", "코치님", "대표님", "본사",
];

export const NICKNAME_MSG = {
  tooLong: `닉네임은 ${NICKNAME_MAX}자 이내로 정해 주세요`,
  blocked: "다른 회원도 보는 이름이라 쓸 수 없는 낱말이 들어 있어요",
  staff: "운영진으로 보일 수 있는 이름은 쓸 수 없어요",
} as const;

/** 찾기용으로 다듬기 — 소문자 · 숫자 · 영문 · 한글(자모 포함)만 남긴다 (서버 regexp_replace 와 같은 범위) */
export const nicknameSearchForm = (s: string): string =>
  s.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");

/**
 * 이 닉네임으로 저장하면 서버가 막는 이유 — 괜찮으면 null.
 * 빈 닉네임은 막지 않는다(서버도 그렇다 — 비우면 실명이 보인다). 시트는 빈 칸 저장을 따로 막는다.
 */
export function nicknameProblem(raw: string, opts: { isStaff?: boolean } = {}): string | null {
  const trimmed = raw.trim();
  if (nicknameLen(trimmed) > NICKNAME_MAX) return NICKNAME_MSG.tooLong;
  const s = nicknameSearchForm(trimmed);
  if (!s) return null;
  if (NICKNAME_BLOCK_WORDS.some((w) => s.includes(w))) return NICKNAME_MSG.blocked;
  if (!opts.isStaff && NICKNAME_STAFF_WORDS.some((w) => s.includes(w))) return NICKNAME_MSG.staff;
  return null;
}

type NameLike = { nickname?: string | null; name?: string | null } | null | undefined;

/** 카드 · TV에 지금 보이는 이름 — 닉네임 → 실명 → '복서' */
export function shownName(p: NameLike): string {
  return (p?.nickname ?? "").trim() || (p?.name ?? "").trim() || "복서";
}

/** 실명과 다른 닉네임을 직접 정했는지 (일괄 등록 계정은 닉네임 = 실명) */
export function hasOwnNickname(p: NameLike): boolean {
  const nick = (p?.nickname ?? "").trim();
  return !!nick && nick !== (p?.name ?? "").trim();
}

/** '으로/로' — 받침 없거나 ㄹ 받침이면 '로' (홍길동으로 · 잽마스터로 · 하늘로). 한글이 아니면 '(으)로' */
export function withRo(word: string): string {
  const last = Array.from(word.trim()).pop() ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}
