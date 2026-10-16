-- 153 레코드 — 153복싱짐 첫 대회 우승 · 준우승 (2026-10-16 대표님:
--   "153레코드에 153복싱짐 최초 대회 출전 우승 준우승자들에게도 기록으로 남기자.")
--   · member_medals 에서 가장 먼저 열린 대회(대회일 → 없으면 등록일) 하나를 골라 금(우승)·은(준우승) 수상자를 같이 내보낸다.
--   · 한 칸에 여러 명 — 대회 수상자는 한 사람이 아니다. 동메달(3위)은 넣지 않는다.
--   · 이름은 메달에 새겨진 이름(person_name). 앱 가입 전 회원(user_id 없음)도 이름으로 남고, 가입하면 링크 트리거가 이어 준다.
--   · 코치님 수상도 대회 기록이니 그대로 넣고 staff 로 표시만 한다.
--   · 마일리지는 주지 않는다 (최초 기록 마일리지는 records_153 트리거 그대로).
--   반환 jsonb 에 'tournament' 키만 더한다 — 나머지는 20261015170000_records_153.sql 과 같다.

create or replace function public.get_153_records()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  perform public.refresh_153_records();

  with elig as (
    select p.user_id
      from public.profiles p
     where public.is_branch_visible(p.branch_name)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles r
                        where r.user_id = p.user_id and r.role in ('super_admin', 'admin', 'branch_manager'))
  ),
  first_event as (
    select m.event_title
      from public.member_medals m
     where m.medal in ('gold', 'silver')
     group by m.event_title
     order by min(coalesce(m.event_date, (m.created_at at time zone 'Asia/Seoul')::date)), min(m.created_at), m.event_title
     limit 1
  )
  select jsonb_build_object(
    'firsts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', r.record_key, 'user_id', r.user_id,
               'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'),
               'avatar_url', p.avatar_url, 'branch_name', p.branch_name,
               'achieved_at', r.achieved_at, 'value', r.value, 'is_me', r.user_id = v_uid)
             order by r.achieved_at)
        from public.records_153 r left join public.profiles p on p.user_id = r.user_id), '[]'::jsonb),
    'bests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', c.code, 'category', c.category, 'title', c.title, 'metric', c.target_metric,
               'user_id', b.user_id,
               'nickname', case when b.user_id is null then null
                                else coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서') end,
               'value', b.v, 'achieved_at', b.at, 'is_me', b.user_id = v_uid)
             order by c.sort_order, c.code)
        from public.boxing_fun_challenges c
        left join lateral (
          select a.user_id,
                 least(a.submitted_value, greatest(coalesce((c.difficulty_targets ->> 'advanced')::numeric, 0) * 3, 1)) as v,
                 a.created_at as at
            from public.boxing_fun_challenge_attempts a join elig e on e.user_id = a.user_id
           where a.challenge_id = c.id
             and a.status <> 'rejected' and a.submitted_value > 0 and a.submitted_value < 'Infinity'::numeric
           order by 2 desc, a.created_at asc
           limit 1) b on true
        left join public.profiles p on p.user_id = b.user_id
       where c.active
         and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')), '[]'::jsonb),
    'tournament', (
      select jsonb_build_object(
               'title', fe.event_title,
               'branch_name', min(m.branch_name),
               'event_date', min(m.event_date),
               'holders', jsonb_agg(jsonb_build_object(
                            'medal', m.medal,
                            'name', m.person_name,
                            'user_id', m.user_id,
                            'avatar_url', p.avatar_url,
                            'staff', coalesce(p.is_staff, false),
                            'is_me', coalesce(m.user_id = v_uid, false))
                          order by case m.medal when 'gold' then 1 else 2 end, m.person_name))
        from first_event fe
        join public.member_medals m on m.event_title = fe.event_title and m.medal in ('gold', 'silver')
        left join public.profiles p on p.user_id = m.user_id
       group by fe.event_title),
    'members', (select count(*) from elig)
  ) into v_out;

  return v_out;
end $$;
