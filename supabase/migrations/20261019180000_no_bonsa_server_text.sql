-- 서버가 화면으로 내보내는 글에서 '본사' 빼기 (2026-10-19 검수 — 2026-10-18 대표님 "화면 글에 '본사'를 쓰지 않는다")
--   회원·코치에게 보이는 글은 '운영진', 전체관리자 전용 기능의 안내는 '전체관리자'.
--   함수 본문의 글자 한 줄만 바꾼다 (권한·동작 그대로). 바꿀 글이 정확히 한 번 있어야 진행한다.
do $$
declare
  r record;
  v_oid oid;
  v_def text;
  v_hits int;
begin
  for r in
    select * from (values
      (1, 'set_community_view_grant', '본사만 권한을 줄 수 있어요', '전체관리자만 권한을 줄 수 있어요'),
      (2, 'set_community_view_grant', '본사가 우리 지점 회원 글을', '운영진이 우리 지점 회원 글을'),
      (3, 'dm_admin_report', '본사 계정만 볼 수 있어요', '전체관리자 계정만 볼 수 있어요'),
      (4, 'dm_admin_reports', '본사 계정만 볼 수 있어요', '전체관리자 계정만 볼 수 있어요'),
      (5, 'dm_admin_resolve', '본사 계정만 처리할 수 있어요', '전체관리자 계정만 처리할 수 있어요'),
      (6, 'list_community_view_staff', '본사만 볼 수 있어요', '전체관리자만 볼 수 있어요'),
      (7, 'admin_member_activity', '본사만 볼 수 있어요', '전체관리자만 볼 수 있어요'),
      (8, 'guard_profile_privileged_columns', '소속 지점은 본사만 바꿀 수 있습니다', '소속 지점은 전체관리자만 바꿀 수 있습니다')
    ) as t(ord, fn, old_text, new_text)
    order by ord
  loop
    select p.oid into strict v_oid
      from pg_proc p
     where p.proname = r.fn and p.pronamespace = 'public'::regnamespace;
    v_def := pg_get_functiondef(v_oid);
    v_hits := (length(v_def) - length(replace(v_def, r.old_text, ''))) / length(r.old_text);
    if v_hits <> 1 then
      raise exception '% — 바꿀 글 "%" 이 % 번 있음 (1번이어야 함)', r.fn, r.old_text, v_hits;
    end if;
    execute replace(v_def, r.old_text, r.new_text);
  end loop;
end $$;
