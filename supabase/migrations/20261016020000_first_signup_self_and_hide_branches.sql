-- (적용: 2026-10-16 SQL 로 직접 실행 — 기록용)
-- 1) 153 레코드 '최초 가입자' = 앱에 직접(카카오·구글 등) 가입한 첫 회원 (2026-10-16 대표님)
--    엑셀·브로제이 명단으로 만든 계정(@153rankup.app 로그인)은 빼다. → 재석 님 (2026-09-28 18:35, 카카오)
--    이상현 님(6/18 명단 계정) 지급분 10,000 은 adjust -10,000 으로 회수(알림 없음), 재석 님 10,000 + 알림
do $$
declare d text;
begin
  d := pg_get_functiondef('public.refresh_153_records()'::regprocedure);
  if position('153rankup.app' in d) = 0 then
    d := replace(d, 'first_signup'', e.user_id, e.created_at, null::numeric from elig e',
      'first_signup'', e.user_id, e.created_at, null::numeric from elig e join auth.users au on au.id = e.user_id where coalesce(au.email, '''') not ilike ''%@153rankup.app''');
    execute d;
  end if;
end $$;

-- 2) 꺼진 지점(역삼·잠실·칠금·본사) 회원은 하트 보내기 목록·게임 순위에 안 나온다
--    (2026-10-16 대표님: "좋아요 보내기 할 때 잠실·역삼 회원도 나와 — 선릉점 빼고 모든 데이터 나오지 않게")
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'get_branch_nicknames' and p.pronamespace = 'public'::regnamespace;
  if position('is_branch_visible' in d) = 0 then
    d := replace(d, 'where (v_all or p.branch_name = v_me.branch_name)',
                    'where (v_all or p.branch_name = v_me.branch_name) and public.is_branch_visible(p.branch_name)');
    execute d;
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'get_minigame_leaderboard' and p.pronamespace = 'public'::regnamespace;
  if position('is_branch_visible' in d) = 0 then
    d := replace(d, 'where public._is_rankable_member(b.user_id)',
                    'where public._is_rankable_member(b.user_id)' || E'\n       and public.is_branch_visible((select pp.branch_name from public.profiles pp where pp.user_id = b.user_id))');
    execute d;
  end if;
end $$;
