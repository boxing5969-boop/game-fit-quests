-- 관장님 홈 숫자 네 칸 — 153OS 쪽 계산 (2026-11-26 대표님 「추천대로」 · 마이복서153 docs/features/69 · 선릉역점부터)
--   153OS(tbxdrfowanyksgdicryl) 에 적용한 함수의 사본. 마이복서153 Edge Function leader-kpi 가 서버 키로 부른다(service_role 만 실행)
--   → 앱 DB leader_owner_kpi · leader_owner_kpi_days 에 숫자만 저장(이름 · 전화 없음).
--   정의(보고서 「관장님 홈」 표 · 대표님 확정 8가지):
--     · 유효 회원 = 회원 거울(member_snapshots)에서 오늘 수강권이 살아 있는 회원 − 홀딩(HOLDING).
--       살아 있는 판정은 일일경영 리포트 branch_vscore_kpis 'active' 와 같다(끝나는 날 ≥ 오늘 · 만료/탈퇴/환불/종료 아님).
--     · 출석률 = 유효 회원 중 최근 7일(오늘 포함) 한 번 이상 온 회원 ÷ 유효 회원.
--       출석 기록 attendance_logs(counts_as_visit) · 브로제이 회원 번호(raw_payload.member_id)로 맞춤, 번호가 없으면 전화.
--       지난주 = 그 앞 7일(같은 유효 회원 기준). 브로제이 회원 목록의 「7일 방문」은 8일(오늘 − 7일부터)을 세어 조금 높다.
--     · 주 평균 출석 = 유효 회원의 최근 30일 방문일 합 ÷ 유효 회원 ÷ 30 × 7.
--     · 이번 달 매출 = 이번 달 1일 ~ 오늘 매출 합(환불은 음수 줄이라 빠진다) · 비교는 지난달 1일 ~ 매출이 들어온 마지막 날과 같은 날.
--     · 오늘 할 일 = 기간 임박 · 7일 넘게 안 옴(branch_vscore_kpis 와 같은 판정) · 24시간 넘게 답 못 한 문의(최근 14일 안 문의).
create or replace function public.owner_home_kpi(p_branch_name text, p_day date default ((now() at time zone 'Asia/Seoul')::date))
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_bid uuid;
  v_k jsonb;
  v_m0 date := date_trunc('month', p_day)::date;
  v_pm0 date := (date_trunc('month', p_day) - interval '1 month')::date;
  v_through date;
  v_pm_same date;
  v_members jsonb;
  v_att jsonb;
  v_sales jsonb;
  v_todo jsonb;
  v_sync jsonb;
begin
  select b.id into v_bid
    from public.branches b
   where b.name = p_branch_name and b.deleted_at is null
   order by b.created_at
   limit 1;
  if v_bid is null then
    return jsonb_build_object('error', 'branch_not_found', 'branch', p_branch_name);
  end if;

  v_k := public.branch_vscore_kpis(v_bid, p_day);

  with ms as (
    select m.id, m.normalized_phone, coalesce(m.raw_payload ->> 'member_id', '') as mid, m.end_date, m.hold_status,
           case when m.end_date is not null
                then m.end_date >= p_day and not (coalesce(m.status, '') ~ '(만료|탈퇴|환불|종료)')
                else coalesce(m.status, '') ~ '(유효|활성|이용)' end as is_active
      from public.member_snapshots m
     where m.branch_id = v_bid
  ), vis as (
    select distinct a.broj_member_id as mid, a.phone, a.attend_date
      from public.attendance_logs a
     where a.branch_id = v_bid and coalesce(a.counts_as_visit, true)
       and a.attend_date between p_day - 29 and p_day
  ), base as (
    select ms.* from ms where ms.is_active and coalesce(ms.hold_status, '') <> 'HOLDING'
  ), bv as (
    select b.id,
           count(distinct v.attend_date) filter (where v.attend_date between p_day - 6 and p_day) as d7,
           count(distinct v.attend_date) filter (where v.attend_date between p_day - 13 and p_day - 7) as dp7,
           count(distinct v.attend_date) as d30
      from base b
      left join vis v on (b.mid <> '' and v.mid = b.mid) or (b.mid = '' and v.phone = b.normalized_phone)
     group by b.id
  )
  select jsonb_build_object(
           'active_all', (select count(*) from ms where ms.is_active),
           'holding', (select count(*) from ms where ms.is_active and ms.hold_status = 'HOLDING'),
           'active', (select count(*) from base),
           'new_month', coalesce((v_k ->> 'first_buy_month')::integer, 0),
           'ended_month', (select count(*) from ms where not ms.is_active and ms.end_date between v_m0 and p_day - 1)),
         jsonb_build_object(
           'from', p_day - 6,
           'to', p_day,
           'n', (select count(*) from bv where bv.d7 > 0),
           'base', (select count(*) from bv),
           'rate', (select case when count(*) > 0 then round(100.0 * count(*) filter (where bv.d7 > 0) / count(*), 1) end from bv),
           'prev_n', (select count(*) from bv where bv.dp7 > 0),
           'prev_rate', (select case when count(*) > 0 then round(100.0 * count(*) filter (where bv.dp7 > 0) / count(*), 1) end from bv),
           'week_avg', (select case when count(*) > 0 then round(sum(bv.d30)::numeric / count(*) / 30 * 7, 1) end from bv),
           'visits_30d', (select coalesce(sum(bv.d30), 0) from bv))
    into v_members, v_att;

  select max(s.sale_date) into v_through
    from public.sales_entries s
   where s.branch_id = v_bid and s.sale_date between v_m0 and p_day;
  v_through := coalesce(v_through, p_day);
  v_pm_same := least(v_pm0 + (extract(day from v_through)::integer - 1), v_m0 - 1);

  select jsonb_build_object(
           'month', to_char(v_m0, 'YYYY-MM'),
           'mtd', coalesce(sum(s.amount) filter (where s.sale_date between v_m0 and p_day), 0),
           'refunds_mtd', coalesce(-sum(s.amount) filter (where s.sale_date between v_m0 and p_day and s.amount < 0), 0),
           'through', v_through,
           'prev_month', to_char(v_pm0, 'YYYY-MM'),
           'prev_same_to', v_pm_same,
           'prev_same', coalesce(sum(s.amount) filter (where s.sale_date between v_pm0 and v_pm_same), 0),
           'prev_full', coalesce(sum(s.amount) filter (where s.sale_date between v_pm0 and v_m0 - 1), 0))
    into v_sales
    from public.sales_entries s
   where s.branch_id = v_bid and s.sale_date between v_pm0 and p_day;

  v_todo := jsonb_build_object(
    'expiring_14d', coalesce((v_k ->> 'expiring_14d')::integer, 0),
    'no_visit_7d', coalesce((v_k ->> 'no_visit_7d')::integer, 0),
    'leads_overdue', (select count(*) from public.lead_inquiries l
                       where l.branch_id = v_bid and l.first_contact_at is null
                         and coalesce(l.status, 'inquiry') in ('inquiry', 'new')
                         and l.created_at < now() - interval '24 hours'
                         and l.created_at >= now() - interval '14 days'),
    'leads_month', (select count(*) from public.lead_inquiries l
                     where l.branch_id = v_bid
                       and (l.created_at at time zone 'Asia/Seoul')::date between v_m0 and p_day));

  v_sync := jsonb_build_object(
    'snap_at', v_k -> 'snap_at',
    'members_at', (select max(r.finished_at) from public.broj_sync_runs r where r.branch_id = v_bid and r.kind = 'members' and r.status = 'success'),
    'attendance_at', (select max(r.finished_at) from public.broj_sync_runs r where r.branch_id = v_bid and r.kind = 'attendance' and r.status = 'success'),
    'sales_at', (select max(r.finished_at) from public.broj_sync_runs r where r.branch_id = v_bid and r.kind = 'sales' and r.status = 'success'));

  return jsonb_build_object(
    'v', 1,
    'branch', p_branch_name,
    'day', p_day,
    'members', v_members,
    'attendance', v_att,
    'sales', v_sales,
    'todo', v_todo,
    'sync', v_sync);
end
$function$;

revoke all on function public.owner_home_kpi(text, date) from public, anon, authenticated;
grant execute on function public.owner_home_kpi(text, date) to service_role;
