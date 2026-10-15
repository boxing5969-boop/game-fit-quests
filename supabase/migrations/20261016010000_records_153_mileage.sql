-- 153 레코드 최초 달성 = 마일리지 10,000 (2026-10-16 대표님: "최초 레코드 달성 시 마일리지 지급", 기존 6개도 지급)
--   · records_153 에 새 기록이 새겨지면(트리거) 그 회원에게 mileage_ledger 'record' 10,000 + 알림함(🔔)·푸시
--     금액은 app_settings.mileage_rules.record (기본 10,000). 한 기록은 한 번만(idem_key = record:<key>)
--   · 지금까지 주인이 정해진 기록도 같은 기준으로 지급 (아래 소급)
--   · 새 기록 '최초 153 TEST 완주' (first_test153) — 공식 측정에서 끝까지 마친 첫 회원
--   · '최초 체력테스트 기록'(아레나, first_fitness)은 아레나가 앱에서 빠져 후보에서 뺀다 (비어 있던 칸)
--   · 10분마다 refresh — 아무도 153 레코드를 안 열어도 달성하자마자 새겨지고 마일리지가 나간다

-- 1) 마일리지 종류에 'record'
alter table public.mileage_ledger drop constraint if exists mileage_ledger_kind_check;
alter table public.mileage_ledger add constraint mileage_ledger_kind_check
  check (kind in ('attendance', 'level_up', 'title_match', 'adjust', 'record'));

update public.app_settings
   set value = value || jsonb_build_object('record', 10000), updated_at = now()
 where key = 'mileage_rules' and not (value ? 'record');

-- 2) 기록 이름 (알림·마일리지 내역에 쓴다)
create or replace function public.record_153_label(_key text)
returns text language sql immutable set search_path to 'public' as $$
  select case _key
    when 'first_signup' then '최초 가입자'
    when 'first_checkin' then '최초 출석'
    when 'first_100_checkins' then '최초 출석 100회'
    when 'first_journal' then '최초 커뮤니티 글'
    when 'first_handwrap' then '최초 붕대 감기 연습'
    when 'first_lv10' then '최초 레벨 10'
    when 'first_lv11' then '최초 레벨 11'
    when 'first_lv21' then '최초 레벨 21'
    when 'first_lv31' then '최초 레벨 31'
    when 'first_test153' then '최초 153 TEST 완주'
    when 'first_fitness' then '최초 체력테스트 기록'
    else _key end;
$$;

-- 3) 새겨지면 지급
create or replace function public.records_153_reward_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_amount integer := coalesce(public.mileage_rule('record'), 0);
  v_label text := public.record_153_label(new.record_key);
  v_paid boolean;
begin
  if v_amount <= 0 then return new; end if;
  v_paid := public.grant_mileage(new.user_id, 'record', v_amount, '153 레코드 ' || v_label,
                                 'record:' || new.record_key, null);
  if v_paid then
    insert into public.notifications (user_id, title, body, link)
    values (new.user_id, '🏆 153 레코드 ' || v_label || '!',
            '153복싱짐 역사에 이름이 새겨졌어요. 마일리지 ' || to_char(v_amount, 'FM999,999') || '이 적립됐어요.',
            '/halloffame?tab=records');
  end if;
  return new;
exception when others then
  return new;  -- 지급이 실패해도 기록은 남는다
end $$;

drop trigger if exists records_153_reward on public.records_153;
create trigger records_153_reward after insert on public.records_153
  for each row execute function public.records_153_reward_trg();

-- 4) 후보에 '최초 153 TEST 완주' 추가, 아레나 기록 제외
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
    -- 최초 출석 = 앱이 생긴 뒤 앱으로 처음 출석(QR 출석)
    select 'first_checkin', a.user_id, a.checked_in_at, null
      from public.attendance_logs a join elig e on e.user_id = a.user_id
     where a.method = 'qr_manual'
    union all
    select 'first_100_checkins', a.user_id, a.checked_in_at, 100 from att a where a.n = 100
    union all
    -- 레벨 10 = 화이트 Lv.10 도달
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
    -- 최초 153 TEST 완주 = 공식 측정에서 끝까지 마친 첫 기록 (값 = 완주 시간 ms)
    select 'first_test153', t.user_id, t.measured_at, t.total_ms::numeric
      from public.test153_records t join elig e on e.user_id = t.user_id
     where t.official and t.finished
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

-- 5) 이미 새겨진 기록도 지급 (대표님: 기존 6개도)
do $$
declare r record; v_amount integer := coalesce(public.mileage_rule('record'), 0);
begin
  if v_amount <= 0 then return; end if;
  for r in select * from public.records_153 loop
    if public.grant_mileage(r.user_id, 'record', v_amount, '153 레코드 ' || public.record_153_label(r.record_key),
                            'record:' || r.record_key, null) then
      insert into public.notifications (user_id, title, body, link)
      values (r.user_id, '🏆 153 레코드 ' || public.record_153_label(r.record_key) || ' 보상',
              '153복싱짐 역사에 이름을 새긴 기념으로 마일리지 ' || to_char(v_amount, 'FM999,999') || '이 적립됐어요.',
              '/halloffame?tab=records');
    end if;
  end loop;
end $$;

-- 6) 10분마다 새 기록 확인 (아무도 안 열어도 달성하면 바로)
select cron.schedule('refresh-153-records', '*/10 * * * *', $$select public.refresh_153_records()$$);
