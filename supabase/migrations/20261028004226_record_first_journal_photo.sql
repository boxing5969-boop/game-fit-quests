-- 153 레코드 새 최초 기록 — '최초 커뮤니티 사진' (2026-10-28 대표님 "처음으로 사진을 올렸는데 축하해드리자 153레코드에 넣을까?")
--   153 커뮤니티에 처음으로 사진을 올린(같은 지점 전체 공개 · 숨기지 않은) 회원. 다른 최초 기록과 같이 records_153 에 들어가므로
--   마일리지 10,000 · 알림(records_153_reward) · TV 금색 '153 RECORD' 환영 · 라이센스 금색 띠가 같이 간다.
--   DB 의 지금 정의(10/28 00:4x KST 에 읽음) 위에 'first_journal_photo' 한 줄씩만 더했다 — 다른 기록은 그대로.

-- 1) 기록 이름
create or replace function public.record_153_label(_key text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case _key
    when 'first_member_sunreung' then '선릉역점 최초 가입자'
    when 'first_signup' then '마이복서153 최초 가입자'
    when 'first_app_payment' then '마이복서153 최초 결제'
    when 'first_checkin' then '최초 출석'
    when 'first_100_checkins' then '최초 출석 100회'
    when 'first_journal' then '최초 커뮤니티 글'
    when 'first_journal_photo' then '최초 커뮤니티 사진'
    when 'first_handwrap' then '최초 붕대 감기 연습'
    when 'first_lv10' then '최초 레벨 10'
    when 'first_lv11' then '최초 블루리그 달성'
    when 'first_lv21' then '최초 레드리그 달성'
    when 'first_lv31' then '최초 블랙리그 달성'
    when 'first_test153' then '최초 153 PB 완주'
    when 'first_test153_top_m' then '최초 153 PB 1위 · 남자'
    when 'first_test153_top_f' then '최초 153 PB 1위 · 여자'
    when 'first_fitness' then '최초 체력테스트 기록'
    else _key end;
$function$;

-- 2) 기록 찾기 (10분마다 · 153 레코드 탭을 열 때) — first_journal_photo 후보 한 줄
create or replace function public.refresh_153_records()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  with elig as (
    select p.user_id, p.created_at
      from public.profiles p
     where public.is_branch_visible(p.branch_name)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles r
                        where r.user_id = p.user_id and r.role in ('super_admin', 'admin', 'branch_manager'))
  ),
  att as (
    select a.user_id, a.checked_in_at,
           row_number() over (partition by a.user_id order by a.checked_in_at) as n
      from public.attendance_logs a join elig e on e.user_id = a.user_id
     where not coalesce(a.is_duplicate, false)
  ),
  win as (
    select (w ->> 'starts_at')::timestamptz as starts_at, (w ->> 'ends_at')::timestamptz as ends_at
      from (select public.test153_top_window() as w) x
     where x.w is not null
  ),
  cand(k, user_id, at, v) as (
    select 'first_signup', e.user_id, e.created_at, null::numeric from elig e join auth.users au on au.id = e.user_id where coalesce(au.email, '') not ilike '%@153rankup.app'
    union all
    select 'first_app_payment', o.user_id, o.paid_at, null
      from public.payment_orders o join elig e on e.user_id = o.user_id
     where o.status = 'paid' and o.paid_at is not null and o.amount > 0
    union all
    select 'first_checkin', a.user_id, a.checked_in_at, null
      from public.attendance_logs a join elig e on e.user_id = a.user_id
     where a.method = 'qr_manual'
    union all
    select 'first_100_checkins', a.user_id, a.checked_in_at, 100 from att a where a.n = 100
    union all
    select 'first_lv10', h.user_id, h.created_at, 10
      from public.level_status_history h join elig e on e.user_id = h.user_id
     where h.rank_name = 'white' and h.level_number = 10
    union all
    select x.k, h.user_id, h.created_at, x.v
      from public.level_status_history h join elig e on e.user_id = h.user_id
      join (values ('first_lv11', 11::numeric, array['blue','red','black']),
                   ('first_lv21', 21, array['red','black']),
                   ('first_lv31', 31, array['black'])) x(k, v, ranks)
        on h.rank_name::text = any (x.ranks)
    union all
    select x.k, mp.user_id, coalesce(mp.level_started_at, mp.updated_at), x.v
      from public.member_progress mp join elig e on e.user_id = mp.user_id
      join (values ('first_lv11', 11::numeric, array['blue','red','black']),
                   ('first_lv21', 21, array['red','black']),
                   ('first_lv31', 31, array['black'])) x(k, v, ranks)
        on mp.current_rank::text = any (x.ranks)
    union all
    select 'first_test153', t.user_id, t.measured_at, t.total_ms::numeric
      from public.test153_records t join elig e on e.user_id = t.user_id
     where t.official and t.finished
    union all
    -- 최초 153 PB 1위 — 한 달이 끝난 뒤에만 후보가 생긴다 (남녀 각각 1명, 153 PB 순위와 같은 순서)
    select x.k, b.user_id, b.measured_at, b.score_ms::numeric
      from win w
      cross join (values ('first_test153_top_m', '남'), ('first_test153_top_f', '여')) x(k, g)
      cross join lateral (
        select t.user_id, t.measured_at, t.score_ms
          from public.test153_records t join elig e on e.user_id = t.user_id
         where t.official and t.division = 'open' and t.gender = x.g
           and t.measured_at >= w.starts_at and t.measured_at < w.ends_at
         order by t.score_ms asc, t.measured_at asc, t.user_id
         limit 1) b
     where now() >= w.ends_at
    union all
    select 'first_journal', j.user_id, j.created_at, null
      from public.champion_journal_entries j join elig e on e.user_id = j.user_id
     where j.kind = 'journal' and j.hidden_at is null
    union all
    -- 최초 커뮤니티 사진 (2026-10-28) — 같은 지점 전체 공개(branch)로 올린 사진 글만 (친구만 · 나만 보기 · 숨긴 글 제외)
    select 'first_journal_photo', j.user_id, j.created_at, null
      from public.champion_journal_entries j join elig e on e.user_id = j.user_id
     where j.kind = 'journal' and j.hidden_at is null
       and coalesce(j.visibility, 'branch') = 'branch'
       and nullif(btrim(coalesce(j.photo_url, '')), '') is not null
    union all
    select 'first_handwrap', w.user_id, w.created_at, null
      from public.handwrap_practice_logs w join elig e on e.user_id = w.user_id
  )
  insert into public.records_153 (record_key, user_id, achieved_at, value)
  select distinct on (c.k) c.k, c.user_id, c.at, c.v
    from cand c
   where c.at is not null and c.at <= now()
     and not exists (select 1 from public.records_153 r where r.record_key = c.k)
   order by c.k, c.at, c.user_id
  on conflict (record_key) do nothing;
$function$;

-- 3) TV 기록 순서 — '최초 커뮤니티 글' 바로 뒤
create or replace function public.board_record_holders(p_branch text, p_key text default null::text)
 returns table(user_id uuid, name text, records text[], first_at timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if v_name is null then
    return;
  end if;
  return query
    with today_people as (
      select a.user_id, min(a.checked_in_at) as first_at,
             (array_agg(a.display_name_snapshot order by a.checked_in_at desc))[1] as snap_name
        from public.attendance_logs a
       where a.branch_name = v_name and a.checked_in_at >= v_start and a.user_id is not null
       group by a.user_id
      union all
      select s.user_id, min(s.started_at), null::text
        from public.activity_sessions s
       where s.branch_name = v_name and s.status = 'active' and s.ended_at is null
       group by s.user_id
    ), people as (
      select tp.user_id, min(tp.first_at) as first_at, max(tp.snap_name) as snap_name
        from today_people tp
       group by tp.user_id
    )
    select pe.user_id,
           coalesce(nullif(btrim(p.nickname), ''), pe.snap_name) as name,
           array_agg(public.record_153_label(r.record_key)
                     order by coalesce(array_position(array['first_member_sunreung','first_signup','first_app_payment','first_checkin',
                                                            'first_100_checkins','first_journal','first_journal_photo','first_handwrap','first_lv10','first_lv11',
                                                            'first_lv21','first_lv31','first_test153','first_test153_top_m',
                                                            'first_test153_top_f','first_fitness'], r.record_key), 99),
                              r.achieved_at) as records,
           pe.first_at
      from people pe
      join public.records_153 r on r.user_id = pe.user_id
      left join public.profiles p on p.user_id = pe.user_id
     where coalesce(p.is_staff, false) = false
     group by pe.user_id, p.nickname, pe.snap_name, pe.first_at
     order by pe.first_at;
end
$function$;
