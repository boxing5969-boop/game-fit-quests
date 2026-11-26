-- 관장님 앱 ③ AI 관장 모드 — 153OS 「달마다 흐름」 함수 (2026-11-27 대표님 「다음가지」 · 마이복서153 docs/features/69 · 선릉역점부터)
--   153OS(tbxdrfowanyksgdicryl) 에 적용한 함수의 사본. 마이복서153 chat-assistant(오삼코치 관장 모드)가 서버 키로 부른다(service_role 만).
--   owner_trend(지점 이름, 숫자, 몇 달, 날) — 최근 n달(이번 달 포함 · 이번 달은 오늘까지 = partial) 달마다 값 하나:
--     sales     = 결제 합(환불은 빼서 = 관장님 홈 「이번 달 매출」 mtd 와 같은 셈) · 결제 건수 · 환불
--     first_buy = 그 달 처음 수강권을 산 회원(이름 기준) — 일일경영 리포트 first_buy_month 와 같은 셈
--     rebuy     = 그 달 다시 수강권을 산 회원(그 달 전에 산 적이 있는 이름) — rebuy_month 와 같은 셈
--     visits    = 출입 기록 방문(회원 · 날 하루 한 번) · 온 회원 수
--     talk_new  = 네이버 톡톡 · 카카오 첫 인사(talktalk_welcome_log)
--     inquiries = 153OS 문의 기록(lead_inquiries)
--   data_from = 그 자료가 처음 쌓인 날 — 그 전 달은 0 이 아니라 「자료 없음」(no_data: true).

create or replace function public.owner_trend(p_branch_name text, p_metric text, p_months integer default 6, p_day date default ((now() at time zone 'Asia/Seoul')::date))
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_bid uuid;
  v_n integer := least(greatest(coalesce(p_months, 6), 1), 12);
  v_m0 date := (date_trunc('month', p_day) - make_interval(months => least(greatest(coalesce(p_months, 6), 1), 12) - 1))::date;
  v_codes text[];
  v_from date;
  v_rows jsonb;
begin
  select b.id into v_bid from public.branches b
   where b.name = p_branch_name and b.deleted_at is null order by b.created_at limit 1;
  if v_bid is null then
    return jsonb_build_object('error', 'branch_not_found', 'branch', p_branch_name);
  end if;
  if p_metric is null or p_metric not in ('sales', 'first_buy', 'rebuy', 'visits', 'talk_new', 'inquiries') then
    return jsonb_build_object('error', 'unknown_metric',
                              'metrics', jsonb_build_array('sales', 'first_buy', 'rebuy', 'visits', 'talk_new', 'inquiries'));
  end if;
  select coalesce(array_agg(code), '{}') into v_codes from public.talktalk_branch_map where branch_id = v_bid;

  if p_metric = 'sales' then
    select min(s.sale_date) into v_from from public.sales_entries s where s.branch_id = v_bid;
    select jsonb_agg(jsonb_build_object(
             'month', to_char(mon.m, 'YYYY-MM'),
             'partial', mon.m1 > p_day,
             'no_data', v_from is null or mon.m1 <= v_from,
             'net', coalesce(x.net, 0),
             'payments', coalesce(x.n, 0),
             'refunds', coalesce(x.refunds, 0)) order by mon.m)
      into v_rows
      from (select gs::date as m, (gs + interval '1 month')::date as m1
              from generate_series(v_m0, date_trunc('month', p_day)::date, interval '1 month') gs) mon
      left join lateral (
        select sum(s.amount) as net,
               count(*) filter (where s.amount > 0) as n,
               coalesce(-sum(s.amount) filter (where s.amount < 0), 0) as refunds
          from public.sales_entries s
         where s.branch_id = v_bid and s.sale_date >= mon.m and s.sale_date < mon.m1 and s.sale_date <= p_day
      ) x on true;

  elsif p_metric in ('first_buy', 'rebuy') then
    select min(s.sale_date) into v_from from public.sales_entries s where s.branch_id = v_bid;
    with s as (
      select s.member_name, s.sale_date
        from public.sales_entries s
       where s.branch_id = v_bid and s.category = '수강권' and s.amount > 0
         and coalesce(s.member_name, '') <> '' and s.sale_date <= p_day
    ), f as (
      select member_name, min(sale_date) as fb from s group by 1
    )
    select jsonb_agg(jsonb_build_object(
             'month', to_char(mon.m, 'YYYY-MM'),
             'partial', mon.m1 > p_day,
             'no_data', v_from is null or mon.m1 <= v_from,
             'members', case when p_metric = 'first_buy'
                             then (select count(distinct f.member_name) from f where f.fb >= mon.m and f.fb < mon.m1)
                             else (select count(distinct s.member_name) from s join f using (member_name)
                                    where s.sale_date >= mon.m and s.sale_date < mon.m1 and f.fb < mon.m) end) order by mon.m)
      into v_rows
      from (select gs::date as m, (gs + interval '1 month')::date as m1
              from generate_series(v_m0, date_trunc('month', p_day)::date, interval '1 month') gs) mon;

  elsif p_metric = 'visits' then
    select min(a.attend_date) into v_from from public.attendance_logs a where a.branch_id = v_bid;
    select jsonb_agg(jsonb_build_object(
             'month', to_char(mon.m, 'YYYY-MM'),
             'partial', mon.m1 > p_day,
             'no_data', v_from is null or mon.m1 <= v_from,
             'visits', coalesce(x.visits, 0),
             'visitors', coalesce(x.visitors, 0)) order by mon.m)
      into v_rows
      from (select gs::date as m, (gs + interval '1 month')::date as m1
              from generate_series(v_m0, date_trunc('month', p_day)::date, interval '1 month') gs) mon
      left join lateral (
        select count(*) as visits, count(distinct v.who) as visitors
          from (select distinct coalesce(nullif(a.broj_member_id, ''), nullif(a.phone, ''), a.member_name) as who, a.attend_date
                  from public.attendance_logs a
                 where a.branch_id = v_bid and coalesce(a.counts_as_visit, true)
                   and a.attend_date >= mon.m and a.attend_date < mon.m1 and a.attend_date <= p_day) v
      ) x on true;

  elsif p_metric = 'talk_new' then
    select min((w.created_at at time zone 'Asia/Seoul')::date) into v_from
      from public.talktalk_welcome_log w where w.branch = any(v_codes);
    select jsonb_agg(jsonb_build_object(
             'month', to_char(mon.m, 'YYYY-MM'),
             'partial', mon.m1 > p_day,
             'no_data', v_from is null or mon.m1 <= v_from,
             'talks', (select count(*) from public.talktalk_welcome_log w
                        where w.branch = any(v_codes)
                          and (w.created_at at time zone 'Asia/Seoul')::date >= mon.m
                          and (w.created_at at time zone 'Asia/Seoul')::date < mon.m1
                          and (w.created_at at time zone 'Asia/Seoul')::date <= p_day)) order by mon.m)
      into v_rows
      from (select gs::date as m, (gs + interval '1 month')::date as m1
              from generate_series(v_m0, date_trunc('month', p_day)::date, interval '1 month') gs) mon;

  else -- inquiries
    select min((l.created_at at time zone 'Asia/Seoul')::date) into v_from
      from public.lead_inquiries l where l.branch_id = v_bid;
    select jsonb_agg(jsonb_build_object(
             'month', to_char(mon.m, 'YYYY-MM'),
             'partial', mon.m1 > p_day,
             'no_data', v_from is null or mon.m1 <= v_from,
             'inquiries', (select count(*) from public.lead_inquiries l
                            where l.branch_id = v_bid
                              and (l.created_at at time zone 'Asia/Seoul')::date >= mon.m
                              and (l.created_at at time zone 'Asia/Seoul')::date < mon.m1
                              and (l.created_at at time zone 'Asia/Seoul')::date <= p_day)) order by mon.m)
      into v_rows
      from (select gs::date as m, (gs + interval '1 month')::date as m1
              from generate_series(v_m0, date_trunc('month', p_day)::date, interval '1 month') gs) mon;
  end if;

  return jsonb_build_object('v', 1, 'branch', p_branch_name, 'metric', p_metric, 'day', p_day,
                            'months', coalesce(v_rows, '[]'::jsonb), 'data_from', v_from);
end
$function$;

revoke all on function public.owner_trend(text, text, integer, date) from public, anon, authenticated;
grant execute on function public.owner_trend(text, text, integer, date) to service_role;
