-- 출석 기록 + 출석 50회마다 축하 (2026-10-21 대표님 — 회원님들 요청)
--   "내정보에 한 달 출석 수 · 지금까지 총 출석 수 확인할 수 있게. 그리고 50회 출석 시 챔피언 머니와 마일리지 1000점,
--    축하 메시지 편지 남겨 주면 좋을 것 같아. 100회 · 150회 · 200회 … 50회 출석될 때마다"
--   정한 것 (대표님 답): 챔피언 머니는 횟수만큼 커지게(50회 1,000 · 100회 2,000 · 150회 3,000 …), 마일리지는 매번 1,000점,
--                       이미 넘은 회원도 지금 축하, 전 지점 (지도진 · 관리자 계정 제외)
--
--   출석 1회 = 그날(KST) 첫 인정 출석 1번. 같은 날 여러 번 찍어도 1번 (attendance_logs.is_duplicate 가 아닌 행 · 날짜 중복 없이 센다).
--   기록은 attendance_logs 가 시작된 2026-02-01 부터다.
--
--   · attendance_milestones: 회원 · 달성 횟수(50·100·…)마다 한 줄 — 보상은 이 줄이 처음 생길 때 한 번만 (기본 키가 중복을 막는다)
--   · grant_attendance_milestones(uid): 지금 출석 수까지 못 받은 축하를 모두 준다 (챔피언 머니 · 마일리지 · 알림 1통)
--   · 출석이 들어올 때마다 트리거가 부른다 — 실패해도 출석 저장은 막지 않는다
--   · 앱: get_my_attendance_stats() — 내정보 '출석 기록' 카드 · 축하 편지(안 본 것) / mark_attendance_milestones_seen() — 편지를 닫으면
--   · 이미 넘은 회원 축하(백필)는 앱이 올라간 뒤 다음 마이그레이션에서 한 번 돌린다 (편지가 앱에 먼저 있어야 해서)

-- 1) 마일리지 종류에 'milestone' (출석 축하)
alter table public.mileage_ledger drop constraint if exists mileage_ledger_kind_check;
alter table public.mileage_ledger add constraint mileage_ledger_kind_check
  check (kind in ('attendance', 'level_up', 'title_match', 'adjust', 'record', 'milestone'));

-- 2) 달성 기록
create table if not exists public.attendance_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone integer not null check (milestone > 0 and milestone % 50 = 0),
  reached_on date,
  gems integer not null default 0,
  mileage integer not null default 0,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, milestone)
);
alter table public.attendance_milestones enable row level security;
drop policy if exists attendance_milestones_own_select on public.attendance_milestones;
create policy attendance_milestones_own_select on public.attendance_milestones
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.attendance_milestones from anon, authenticated;

-- 3) 보상 크기 — 챔피언 머니는 50회마다 1,000 씩 커진다 (50회 1,000 · 100회 2,000 …), 마일리지는 매번 1,000
create or replace function public.attendance_milestone_gems(_m integer)
returns integer language sql immutable set search_path = public as $$
  select greatest(0, (coalesce(_m, 0) / 50) * 1000)
$$;

create or replace function public.attendance_milestone_mileage(_m integer)
returns integer language sql immutable set search_path = public as $$
  select case when coalesce(_m, 0) > 0 then 1000 else 0 end
$$;

-- 4) 출석 수 (그날 첫 인정 출석 = 1번)
create or replace function public.attendance_day_count(_uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::integer
    from public.attendance_logs a
   where a.user_id = _uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
$$;
revoke all on function public.attendance_day_count(uuid) from public, anon, authenticated;

-- 5) 못 받은 축하 모두 주기 — 새로 준 개수를 돌려준다
create or replace function public.grant_attendance_milestones(_uid uuid, _notify boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_days integer;
  v_m integer := 50;
  v_on date;
  v_gems integer;
  v_mileage integer;
  v_new integer := 0;
  v_top integer := 0;
  v_sum_gems integer := 0;
  v_sum_mileage integer := 0;
begin
  if _uid is null then return 0; end if;
  -- 지도진 · 관리자 계정은 축하 보상 없음 (마일리지 · 출석 보상과 같은 기준)
  if exists (select 1 from public.profiles where user_id = _uid and coalesce(is_staff, false)) then return 0; end if;
  if not exists (select 1 from public.member_progress where user_id = _uid) then return 0; end if;

  v_days := public.attendance_day_count(_uid);
  while v_m <= v_days loop
    if not exists (select 1 from public.attendance_milestones where user_id = _uid and milestone = v_m) then
      -- 그 횟수를 채운 날 (v_m 번째 출석일)
      select x.d into v_on
        from (select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as d
                from public.attendance_logs a
               where a.user_id = _uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
               order by 1) x
       offset v_m - 1 limit 1;
      v_gems := public.attendance_milestone_gems(v_m);
      v_mileage := public.attendance_milestone_mileage(v_m);
      insert into public.attendance_milestones (user_id, milestone, reached_on, gems, mileage)
      values (_uid, v_m, v_on, v_gems, v_mileage)
      on conflict (user_id, milestone) do nothing;
      if found then
        if v_gems > 0 then
          perform public.grant_gems(_uid, v_gems, '출석 ' || v_m || '회 축하');
        end if;
        if v_mileage > 0 then
          perform public.grant_mileage(_uid, 'milestone', v_mileage, '출석 ' || v_m || '회 축하',
                                       'att-milestone:' || _uid::text || ':' || v_m, null);
        end if;
        v_new := v_new + 1;
        v_top := v_m;
        v_sum_gems := v_sum_gems + v_gems;
        v_sum_mileage := v_sum_mileage + v_mileage;
      end if;
    end if;
    v_m := v_m + 50;
  end loop;

  if v_new > 0 and _notify then
    insert into public.notifications (user_id, title, body, link)
    values (_uid,
            '출석 ' || v_top || '회 달성! 🎉',
            '챔피언 머니 +' || to_char(v_sum_gems, 'FM999,999,999') || ' · 마일리지 +' || to_char(v_sum_mileage, 'FM999,999,999')
              || '점을 드렸어요. 앱에서 축하 편지를 열어 보세요',
            '/mypage');
  end if;
  return v_new;
end $$;
revoke all on function public.grant_attendance_milestones(uuid, boolean) from public, anon, authenticated;

-- 6) 출석이 들어오면 — 실패해도 출석 저장은 그대로
create or replace function public.attendance_milestone_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null or coalesce(new.is_duplicate, false) or new.checked_in_at is null then
    return null;
  end if;
  begin
    perform public.grant_attendance_milestones(new.user_id, true);
  exception when others then
    raise warning 'attendance_milestone skipped: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
revoke all on function public.attendance_milestone_trg() from public, anon, authenticated;

drop trigger if exists attendance_milestone on public.attendance_logs;
create trigger attendance_milestone
  after insert on public.attendance_logs
  for each row when (new.is_duplicate is not true)
  execute function public.attendance_milestone_trg();

-- 7) 내 출석 기록 — 내정보 카드 · 축하 편지
create or replace function public.get_my_attendance_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_last_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul';
  v_total integer;
  v_month integer;
  v_last integer;
  v_since date;
  v_staff boolean;
  v_next integer;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select coalesce(is_staff, false) into v_staff from public.profiles where user_id = v_uid;

  select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date) filter (where a.checked_in_at >= v_month_start)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)
           filter (where a.checked_in_at >= v_last_start and a.checked_in_at < v_month_start)::integer,
         min((a.checked_in_at at time zone 'Asia/Seoul')::date)
    into v_total, v_month, v_last, v_since
    from public.attendance_logs a
   where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null;

  v_next := ((coalesce(v_total, 0) / 50) + 1) * 50;
  return jsonb_build_object(
    'total', coalesce(v_total, 0),
    'month', coalesce(v_month, 0),
    'last_month', coalesce(v_last, 0),
    'since', v_since,
    'records_since', '2026-02-01',
    'is_staff', coalesce(v_staff, false),
    'step', 50,
    'next', v_next,
    'next_gems', public.attendance_milestone_gems(v_next),
    'next_mileage', public.attendance_milestone_mileage(v_next),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('milestone', m.milestone, 'reached_on', m.reached_on, 'gems', m.gems,
                                          'mileage', m.mileage, 'seen', m.seen_at is not null) order by m.milestone)
        from public.attendance_milestones m where m.user_id = v_uid), '[]'::jsonb),
    'unseen', (
      select case when count(*) = 0 then null else
               jsonb_build_object('milestone', max(m.milestone), 'count', count(*),
                                  'gems', sum(m.gems), 'mileage', sum(m.mileage)) end
        from public.attendance_milestones m where m.user_id = v_uid and m.seen_at is null)
  );
end $$;
revoke all on function public.get_my_attendance_stats() from public, anon;
grant execute on function public.get_my_attendance_stats() to authenticated;

-- 8) 축하 편지를 봤음 — 안 본 것을 모두 본 것으로
create or replace function public.mark_attendance_milestones_seen()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.attendance_milestones set seen_at = now() where user_id = auth.uid() and seen_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.mark_attendance_milestones_seen() from public, anon;
grant execute on function public.mark_attendance_milestones_seen() to authenticated;
