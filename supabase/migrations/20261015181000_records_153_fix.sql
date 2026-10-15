-- 153 레코드 바로잡기 (2026-10-15 대표님)
--   · '왕눈이복서'는 대표님 테스트 계정 → is_test_account (최초 가입자에서 빠진다)
--   · 최초 출석 = 앱이 생기고 나서의 첫 출석(앱 QR 출석) → 위서진 님 (2026-09-28)
--   · 최초 레벨 10 = 위서진 님 확정

update public.profiles set is_test_account = true
 where user_id = '1589d353-68e7-4e3f-a23d-1ce3d011f5eb' and nickname = '왕눈이복서';

create or replace function public.refresh_153_records()
returns void language sql security definer set search_path to 'public' as $$
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
  cand(k, user_id, at, v) as (
    select 'first_signup', e.user_id, e.created_at, null::numeric from elig e
    union all
    -- 최초 출석 = 앱이 생긴 뒤 앱으로 처음 출석(QR 출석) — 출입기 기록(2월~)은 앱 이전이라 뺀다
    select 'first_checkin', a.user_id, a.checked_in_at, null
      from public.attendance_logs a join elig e on e.user_id = a.user_id
     where a.method = 'qr_manual'  -- 같은 날 출입기에도 찍혀 중복 표시가 붙어도 '앱으로 찍은 출석'은 맞다
    union all
    select 'first_100_checkins', a.user_id, a.checked_in_at, 100 from att a where a.n = 100
    union all
    -- 레벨 10 = 화이트 Lv.10 도달 (10레벨 도달 자동 심사 기록)
    select 'first_lv10', h.user_id, h.created_at, 10
      from public.level_status_history h join elig e on e.user_id = h.user_id
     where h.rank_name = 'white' and h.level_number = 10
    union all
    -- 레벨 11 / 21 / 31 = 블루 / 레드 / 블랙 리그 첫 입성
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
    -- 153 체력테스트 = 챌린지 아레나 체력 종목
    select 'first_fitness', a.user_id, a.created_at, a.submitted_value
      from public.boxing_fun_challenge_attempts a
      join public.boxing_fun_challenges c on c.id = a.challenge_id
      join elig e on e.user_id = a.user_id
     where c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
       and a.status <> 'rejected' and a.submitted_value > 0 and a.submitted_value < 'Infinity'::numeric
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
$$;
revoke all on function public.refresh_153_records() from public, anon, authenticated;

-- 아직 새겨진 기록이 없을 때 실행됨 — 지금 바로 새겨 둔다
select public.refresh_153_records();
