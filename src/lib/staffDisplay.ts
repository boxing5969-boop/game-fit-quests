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
 */

export interface StaffLikeProfile {
  is_staff?: boolean | null;
  staff_title?: string | null;
  name?: string | null;
  nickname?: string | null;
}

/** 화면 표기용 직함 — 항상 님을 붙인다 (지점장 → 지점장님, 코치 → 코치님). 빈 값은 코치님. */
export const honorTitle = (title?: string | null): string => {
  const t = (title || "코치").trim();
  return t.endsWith("님") ? t : `${t}님`;
};

export const isStaffProfile = (p: unknown): boolean =>
  !!p && typeof p === "object" && (p as StaffLikeProfile).is_staff === true;

/** "임OO 지점장님" — 실명 + 직함. 실명이 없으면 닉네임, 그것도 없으면 직함만. */
export const staffDisplayName = (p: StaffLikeProfile): string => {
  const base = (p.name || p.nickname || "").trim();
  const title = honorTitle(p.staff_title);
  return base ? `${base} ${title}` : title;
};

/** 직함만 ("지점장님") */
export const staffTitleLabel = (p: StaffLikeProfile): string => honorTitle(p.staff_title);
