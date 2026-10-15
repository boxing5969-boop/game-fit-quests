-- 지점 표시 켜기/끄기 (2026-10-15 대표님: "선릉점을 제외한 모든 지점은 테스트하고 있지 않아 데이터 낭비 —
-- 마이복서153에서 보이지 않게, 153본사도 없애고 153복싱짐 선릉역점만. 설정에서 온오프")
--   · branches.is_visible — 꺼진 지점은 '전 지점' 랭킹 · 명예의 전당 · 153 챌린지 전체 · 운동시간 랭킹 · 지점 선택 목록에서 빠진다
--   · 지점을 지우지 않는다 — 회원·출석·얼굴 인식·TV 는 그대로 (켜면 바로 돌아온다)
--   · 켜기/끄기는 관리자(super_admin·admin)만 — set_branch_visible

alter table public.branches add column if not exists is_visible boolean not null default true;
update public.branches set is_visible = false
 where name in ('153복싱짐 역삼점', '153복싱짐 잠실점', '153복싱짐 칠금점', '153본사');

create or replace function public.is_branch_visible(p_name text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select b.is_visible from public.branches b where b.name = p_name limit 1), false);
$$;
grant execute on function public.is_branch_visible(text) to anon, authenticated;

create or replace function public.set_branch_visible(p_branch_id uuid, p_visible boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception '관리자만 바꿀 수 있어요';
  end if;
  update public.branches set is_visible = coalesce(p_visible, true) where id = p_branch_id;
  if not found then raise exception '지점을 찾을 수 없어요'; end if;
  return jsonb_build_object('success', true, 'visible', coalesce(p_visible, true));
end $$;
grant execute on function public.set_branch_visible(uuid, boolean) to authenticated;

-- 전 지점 보기(지점 지정 없음)일 때 꺼진 지점 회원을 뺀다 — 함수 본문의 조건 한 줄만 바꾼다
do $$
declare
  f record;
  d text;
  d2 text;
begin
  for f in
    select * from (values
      ('public.get_division_ranking(text,integer)',
       E'      ef.branch_filter is null\n      or p.branch_name = ef.branch_filter',
       E'      (ef.branch_filter is null and public.is_branch_visible(p.branch_name))\n      or p.branch_name = ef.branch_filter'),
      ('public.get_boss_conquerors(text,integer)',
       '(ef.is_super_admin and ef.branch_filter is null)',
       '(ef.is_super_admin and ef.branch_filter is null and public.is_branch_visible(p.branch_name))'),
      ('public.get_streak_ranking(text,integer)',
       '(ef.branch_filter is null or p.branch_name = ef.branch_filter)',
       '((ef.branch_filter is null and public.is_branch_visible(p.branch_name)) or p.branch_name = ef.branch_filter)'),
      ('public.get_weekly_activity_ranking(text,integer)',
       '(ef.branch_filter is null or p.branch_name = ef.branch_filter)',
       '((ef.branch_filter is null and public.is_branch_visible(p.branch_name)) or p.branch_name = ef.branch_filter)'),
      ('public.get_monthly_risers(text,integer)',
       '(ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)',
       '((ef.branch_filter IS NULL AND public.is_branch_visible(p.branch_name)) OR p.branch_name = ef.branch_filter)'),
      ('public.get_workout_time_ranking(text,integer)',
       '(s.branch_name is null or p.branch_name = s.branch_name)',
       '((s.branch_name is null and public.is_branch_visible(p.branch_name)) or p.branch_name = s.branch_name)'),
      ('public.get_153_king_board(text,text,text,integer)',
       'and (v_scope = ''all'' or p.branch_name = v_branch)',
       'and ((v_scope = ''all'' and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)'),
      ('public.get_hall_of_fame(integer)',
       'where mp.current_rank = ''black'' and mp.current_level = 10',
       'where mp.current_rank = ''black'' and mp.current_level = 10 and public.is_branch_visible(p.branch_name)')
    ) as t(sig, old_txt, new_txt)
  loop
    d := pg_get_functiondef(f.sig::regprocedure);
    if position(f.new_txt in d) > 0 then
      continue; -- 이미 바뀜
    end if;
    d2 := replace(d, f.old_txt, f.new_txt);
    if d2 = d then
      raise exception '바꿀 줄을 못 찾음: %', f.sig;
    end if;
    execute d2;
  end loop;
end $$;
