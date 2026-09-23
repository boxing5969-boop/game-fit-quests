/**
 * 지도진 표기 (2026-09-22)
 *
 * 대표님 지시: 선릉역점 지도진(지점장·코치)은 로그인하면 리그·레벨 대신
 * "임OO 지점장님", "박OO 코치님" 처럼 이름 + 직함으로 보인다.
 *
 * 근거 데이터는 profiles.is_staff / profiles.staff_title 하나뿐이다 — 라이브보드 COACHING STAFF 띠
 * (public_staff_on_duty 뷰)와 같은 출처, 같은 기본값('코치'), 같은 존칭 규칙(님)을 쓴다.
 * 이름을 코드에 박지 않는다. 직함이 비어 있으면 코치님으로 보인다.
 *
 * 주의: 생성된 Supabase 타입(types.ts)에 is_staff/staff_title 컬럼이 아직 없어서
 * profile 은 느슨한 형태로 받는다 (AuthContext 는 select("*") 라 런타임엔 들어온다).
 *
 * 2026-09-23 대표님 지시: "코치님들은 모두 챔피언으로 해주고 레벨은 77로 맞춰줘".
 * 지도진은 회원 리그(화이트~블랙 · 레벨 1~10) 대신 "챔피언 · Lv.77" 로 보인다. 화면 전용 표기다 —
 * DB 의 리그·레벨(member_progress)은 건드리지 않는다(리그는 4단계, 레벨은 1~10 까지라 77 을 저장하면
 * 승급·보상 계산이 깨진다). 회원 순위표에서는 지도진을 뺀다(서버 랭킹 RPC).
 */

/** 지도진 표기 — 챔피언 · Lv.77 (화면 전용) */
export const STAFF_CHAMPION_LABEL = "챔피언";
export const STAFF_CHAMPION_LEVEL = 77;
/** "챔피언 · Lv.77" */
export const STAFF_CHAMPION_LINE = `${STAFF_CHAMPION_LABEL} · Lv.${STAFF_CHAMPION_LEVEL}`;

export interface StaffLikeProfile {
  is_staff?: boolean | null;
  staff_title?: string | null;
  name?: string | null;
  nickname?: string | null;
}

/** 화면 표기용 직함 — 항상 님을 붙인다 (지점장 → 지점장님, 코치 → 코치님). 빈 값은 코치님. */
export const honorTitle = (title?: string | null): string => {
  const t = (title ?? "").trim() || "코치";
  return t.endsWith("님") ? t : `${t}님`;
};

export const isStaffProfile = (p: unknown): boolean =>
  !!p && typeof p === "object" && (p as StaffLikeProfile).is_staff === true;

/** "임OO 지점장님" — 실명 + 직함. 실명이 없으면 닉네임, 그것도 없으면 직함만. */
export const staffDisplayName = (p: StaffLikeProfile): string => {
  const base = (p.name ?? "").trim() || (p.nickname ?? "").trim();
  const title = honorTitle(p.staff_title);
  return base ? `${base} ${title}` : title;
};

/** 직함만 ("지점장님") */
export const staffTitleLabel = (p: StaffLikeProfile): string => honorTitle(p.staff_title);

/** "챔피언 · Lv.77 · 코치님" — 칩·메타 한 줄 */
export const staffChampionLine = (p: StaffLikeProfile): string => `${STAFF_CHAMPION_LINE} · ${honorTitle(p.staff_title)}`;
