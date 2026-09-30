-- 2026-09-30 대표님: "랭킹에 보면 익명이 있는데 익명은 뭐야?"
--
-- 닉네임이 빈 칸('')인 회원(앱에 직접 로그인해 쓰는 선릉역점 회원 7명 — 09-28 첫 출입 계정)이
--   · 공식 랭킹·운동시간 랭킹에서는 '익명 + 계정번호 6자리'로,
--   · 주간·월간 상승·연속 출석·타이틀매치·명예의 전당·라이벌 탭에서는 이름이 빈칸으로 보였다.
-- 153 챌린지 킹 보드·런칭 이벤트 보드·일기처럼 '닉네임 → 이름 → 익명 복서' 순서로 통일한다.
-- (일괄 등록 회원은 닉네임 = 이름이라 이미 이름으로 보이고 있었다 — 같은 기준으로 맞추는 것)
-- 함수 본문은 그대로 두고 이름 식만 바꾼다. 바꿀 식이 정확히 한 번 있어야 적용되고, 없으면 멈춘다.

create or replace function pg_temp._patch_fn(p_name text, p_old text, p_new text,
                                             p_old2 text default null, p_new2 text default null)
returns void
language plpgsql
as $f$
declare
  v_oid oid;
  v_cnt int;
  v_def text;
begin
  select count(*), min(p.oid) into v_cnt, v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = p_name;
  if v_cnt <> 1 then
    raise exception '% 함수가 %개 — 하나여야 한다', p_name, v_cnt;
  end if;
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old) <> 1 then
    raise exception '% : 바꿀 식을 찾지 못했다 (또는 여러 개)', p_name;
  end if;
  v_def := replace(v_def, p_old, p_new);
  if p_old2 is not null then
    if (length(v_def) - length(replace(v_def, p_old2, ''))) / length(p_old2) <> 1 then
      raise exception '% : 두 번째 식을 찾지 못했다 (또는 여러 개)', p_name;
    end if;
    v_def := replace(v_def, p_old2, p_new2);
  end if;
  execute v_def;
end
$f$;

-- 공식 랭킹 (익명+번호 → 이름)
select pg_temp._patch_fn('get_division_ranking',
  $x$coalesce(nullif(p.nickname, ''), '익명' || substr(mp.user_id::text, 1, 6))$x$,
  $x$coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서')$x$);

-- 운동시간 랭킹
select pg_temp._patch_fn('get_workout_time_ranking',
  $x$coalesce(nullif(p.nickname, ''), '익명' || substr(g.user_id::text, 1, 6))$x$,
  $x$coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서')$x$);

-- 타이틀매치 정복자
select pg_temp._patch_fn('get_boss_conquerors',
  $x$mp.user_id, p.nickname, p.avatar_url,$x$,
  $x$mp.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url,$x$);

-- 연속 출석
select pg_temp._patch_fn('get_streak_ranking',
  $x$mp.user_id, p.nickname, p.avatar_url,$x$,
  $x$mp.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url,$x$);

-- 명예의 전당
select pg_temp._patch_fn('get_hall_of_fame',
  $x$mp.user_id, p.nickname, p.avatar_url, mp.current_rank$x$,
  $x$mp.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url, mp.current_rank$x$);

-- 주간 활동 (GROUP BY 에 이름 추가 → 그다음 SELECT 식)
select pg_temp._patch_fn('get_weekly_activity_ranking',
  $x$group by xl.user_id, p.nickname, p.avatar_url$x$,
  $x$group by xl.user_id, p.nickname, p.name, p.avatar_url$x$,
  $x$xl.user_id, p.nickname, p.avatar_url,$x$,
  $x$xl.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url,$x$);

-- 월간 상승 (GROUP BY 에 이름 추가 → 그다음 SELECT 식)
select pg_temp._patch_fn('get_monthly_risers',
  $x$GROUP BY xl.user_id, p.nickname, p.avatar_url$x$,
  $x$GROUP BY xl.user_id, p.nickname, p.name, p.avatar_url$x$,
  $x$xl.user_id, p.nickname, p.avatar_url,$x$,
  $x$xl.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url,$x$);

-- 라이벌(내 위 순위)
select pg_temp._patch_fn('get_rivals_above',
  $x$p.nickname,
      p.avatar_url,$x$,
  $x$coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서') as nickname,
      p.avatar_url,$x$);

-- 라이센스 한 장 (랭킹에서 누르면 뜨는 카드)
select pg_temp._patch_fn('get_member_license',
  $x$coalesce(nullif(btrim(v_t.nickname), ''), '익명' || substr(p_user::text, 1, 6))$x$,
  $x$coalesce(nullif(btrim(v_t.nickname), ''), nullif(btrim(v_t.name), ''), '익명 복서')$x$);

-- 추천 복서 목록 (보이는 이름으로 검색)
select pg_temp._patch_fn('get_branch_nicknames',
  $x$coalesce(nullif(btrim(p.nickname), ''), '익명' || substr(p.user_id::text, 1, 6)) as display$x$,
  $x$coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서') as display$x$,
  $x$and (v_pat is null or p.nickname ilike v_pat escape '\')$x$,
  $x$and (v_pat is null or coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '') ilike v_pat escape '\')$x$);

drop function pg_temp._patch_fn(text, text, text, text, text);