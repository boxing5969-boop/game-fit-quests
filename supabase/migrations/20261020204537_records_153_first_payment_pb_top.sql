-- 153 레코드 — '마이복서153 최초 결제' + '최초 153 PB 1위 · 남자 / 여자' (2026-10-20 대표님:
--   "최초로 앱 통해 결제한 회원도 153 레코드에 넣자. 153 PB 최초 도전자는 있고, 최초 153 PB 1위 기록자 —
--    1위 기록은 한 달간 회원님들 테스트 후 최고 기록 보유자에게 수상" ·
--    한 달은 첫 공식 기록일부터 · 1위는 남녀 각각 1명 (대표님 선택))
--
--   · first_app_payment — 앱(payment_orders)으로 결제를 처음 마친 회원. status 'paid' · paid_at 있음 · 금액 0 초과만
--     (운영진·테스트 계정은 다른 기록과 같은 elig 로 빠진다). 결제 표는 읽기만 한다.
--   · first_test153_top_m / _f — 첫 공식 153 PB 기록일(한국 날짜)부터 한 달이 지나면, 그 한 달 동안 잰
--     오픈 공식 기록 중 남자 1위 · 여자 1위 (153 PB 순위와 같은 기준: score_ms 빠른 순 → 먼저 잰 순).
--     한 달이 끝나기 전에는 후보가 없어서 새겨지지 않는다 — 10분마다 도는 refresh-153-records 크론이 마감 뒤 새긴다.
--     기록 값(value) = score_ms. 날짜(achieved_at) = 그 1위 기록을 잰 날.
--   · 새 기록도 records_153 에 들어가므로 마일리지 10,000 · 알림(records_153_reward 트리거)이 같이 간다.
--   · 기록 칸 목록은 src/services/records153Service.ts RECORD_153_FIRSTS 와 같은 순서.
--   함수 본문은 2026-10-20 운영 DB 정의(pg_get_functiondef)를 그대로 옮기고 새 부분만 더했다.

-- ── 153 PB 1위 한 달 — 첫 공식 기록일(한국 날짜) 0시 ~ 한 달 뒤 0시 ─────────────────────
create or replace function public.test153_top_window()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with first_rec as (
    select min(t.measured_at) as at
      from public.test153_records t
      join public.profiles p on p.user_id = t.user_id
     where t.official
       and public.is_branch_visible(p.branch_name)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles r
                        where r.user_id = t.user_id and r.role in ('super_admin', 'admin', 'branch_manager'))
  ), d as (
    select (f.at at time zone 'Asia/Seoul')::date as day from first_rec f where f.at is not null
  )
  select case when d.day is null then null
              else jsonb_build_object(
                     'starts_at', (d.day::timestamp at time zone 'Asia/Seoul'),
                     'ends_at', ((d.day + interval '1 month')::timestamp at time zone 'Asia/Seoul'))
         end
    from (select 1) one
    left join d on true;
$function$;

revoke all on function public.test153_top_window() from public, anon;
grant execute on function public.test153_top_window() to authenticated, service_role;

-- ── 기록 이름 ─────────────────────────────────────────────────────────────
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

-- ── 최초 기록 새기기 (넣기만 · 지우기 없음) ─────────────────────────────────
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

-- ── 153 레코드 화면 — 153 PB 1위 한 달(pb_top_window)을 같이 내려 준다 ─────────────────
create or replace function public.get_153_records()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    'pb_top_window', public.test153_top_window(),
    'members', (select count(*) from elig)
  ) into v_out;

  return v_out;
end $function$;

-- ── TV(라이브보드) 기록 순서 — 153 레코드 화면과 같게 ─────────────────────────────
create or replace function public.board_record_holders(p_branch text, p_key text default null)
 returns table(user_id uuid, name text, records text[], first_at timestamptz)
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
                                                            'first_100_checkins','first_journal','first_handwrap','first_lv10','first_lv11',
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
