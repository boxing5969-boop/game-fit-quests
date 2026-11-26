-- 관장님 앱 ② 153OS CRM 보기 — 153OS 쪽 읽기 함수 3개 (2026-11-27 대표님 「다음가자」 · 마이복서153 docs/features/69 · 선릉역점부터)
--   153OS(tbxdrfowanyksgdicryl) 에 적용한 함수의 사본. 마이복서153 Edge Function os-crm 이 서버 키로 부른다(service_role 만 실행).
--   읽기만 한다(쓰기는 ④). 지점은 os-crm 이 로그인한 관장 · 지점장 · 본사의 지점으로 정해서 넘긴다.
--   · crm_members(지점 이름, 찾을 말, 날) — 회원 목록: 기본 = 지금 수강권이 있는 회원 + 끝난 지 90일 안 + 홀딩 · 찾을 말이 있으면 이름 · 전화 뒷자리로 모든 회원
--       상태 = active(15일 넘게 남음) · soon(14일 안 끝남) · hold(홀딩) · ended(끝남) · unknown(브로제이 상태 없음)
--       할 일 표시(todo):
--         exp3 · exp14 = 14일 안 끝나는 유효 회원(홀딩 빼고 = 상태 soon) — 마이복서153 지도자 홈 ① · 관장님 홈 「기간 임박」과 같은 숫자
--           (일일경영 리포트 expiring_14d 는 30일 넘게 안 온 회원을 빼서 더 적다 — 그 회원은 아래 idle30 에도 나온다)
--         novisit7 = 7~29일 안 옴 · 14일 안 끝나는 회원 · 30일 넘게 안 온 회원 빼고 · 홀딩 포함 = 일일경영 리포트 no_visit_7d (관장님 홈 「7일 넘게 안 온 회원」)
--         idle30 = 유효인데 30일 넘게 안 옴 = 일일경영 리포트 idle_30d · 방문일은 브로제이 마지막 방문일(latest_visit_date)
--         ended7 · ended14 · ended30(끝난 지 며칠) · starter(가입 28일 안 · 주 2번 속도보다 늦음)
--       목록에는 전화 뒷 4자리만. 방문 = 출입 기록(attendance_logs · counts_as_visit) 하루 한 번.
--   · crm_member_card(지점 이름, 회원 id, 날) — 회원 카드: 전화 전체 · 수강권 · 홀딩 · PT · 가입일 · 들어온 길 · 운동 목적 · 최근 90일 방문 날짜 · 결제(같은 이름 · 24달) · 후속 연락 기록
--   · crm_customers(지점 이름, 날) — 고객: 이번 달 톡톡 첫 인사 · 번호 남긴 손님 · 문의 기록 · 첫 결제 + 최근 60일 톡톡 손님(번호로 회원 등록 여부) · 문의 기록

create or replace function public.crm_members(p_branch_name text, p_query text default null, p_day date default ((now() at time zone 'Asia/Seoul')::date))
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_bid uuid;
  v_q text := nullif(regexp_replace(coalesce(p_query, ''), '\s', '', 'g'), '');
  v_digits text;
  v_rows jsonb;
  v_counts jsonb;
begin
  select b.id into v_bid from public.branches b
   where b.name = p_branch_name and b.deleted_at is null order by b.created_at limit 1;
  if v_bid is null then
    return jsonb_build_object('error', 'branch_not_found', 'branch', p_branch_name);
  end if;
  v_digits := case when v_q ~ '^\d{2,11}$' then v_q end;

  with ms as (
    select m.id, m.member_name, m.normalized_phone, coalesce(m.raw_payload ->> 'member_id', '') as mid,
           m.product_name, m.start_date, m.end_date, m.hold_status, m.assigned_coach, m.latest_visit_date,
           (p_day - m.latest_visit_date) as since_snap,
           case when (m.raw_payload ->> 'joined_at') ~ '^\d{4}-\d{2}-\d{2}' then left(m.raw_payload ->> 'joined_at', 10)::date end as joined_at,
           case when m.end_date is not null
                then m.end_date >= p_day and not (coalesce(m.status, '') ~ '(만료|탈퇴|환불|종료)')
                else coalesce(m.status, '') ~ '(유효|활성|이용)' end as is_active,
           m.end_date is null and not (coalesce(m.status, '') ~ '(유효|활성|이용|만료|탈퇴|환불|종료)') as is_unknown
      from public.member_snapshots m
     where m.branch_id = v_bid
  ), pick as (
    select ms.* from ms
     where (v_q is null and (ms.is_active or ms.hold_status = 'HOLDING' or ms.end_date between p_day - 90 and p_day - 1))
        or (v_q is not null and (regexp_replace(ms.member_name, '\s', '', 'g') ilike '%' || v_q || '%'
                                 or (v_digits is not null and ms.normalized_phone like '%' || v_digits)))
     order by ms.end_date desc nulls last
     limit case when v_q is null then 600 else 100 end
  ), vis as (
    select distinct a.broj_member_id as mid, a.phone, a.attend_date
      from public.attendance_logs a
     where a.branch_id = v_bid and coalesce(a.counts_as_visit, true)
       and a.attend_date between p_day - 89 and p_day
  ), pv as (
    select p.id,
           count(distinct v.attend_date) filter (where v.attend_date between p_day - 6 and p_day) as v7,
           count(distinct v.attend_date) filter (where v.attend_date between p_day - 29 and p_day) as v30,
           count(distinct v.attend_date) filter (where p.joined_at is not null and v.attend_date >= p.joined_at) as since_join,
           max(v.attend_date) as last_att
      from pick p
      left join vis v on (p.mid <> '' and v.mid = p.mid) or (p.mid = '' and v.phone = p.normalized_phone)
     group by p.id
  ), r as (
    select p.*, pv.v7, pv.v30, pv.since_join,
           greatest(pv.last_att, p.latest_visit_date) as last_visit,
           coalesce(p.since_snap >= 30, false) as dormant,
           (p.end_date - p_day) as days_left,
           case when p.is_active and p.hold_status = 'HOLDING' then 'hold'
                when p.is_active and p.end_date is not null and p.end_date - p_day <= 14 then 'soon'
                when p.is_active then 'active'
                when p.is_unknown then 'unknown'
                else 'ended' end as st
      from pick p join pv on pv.id = p.id
  ), t as (
    select r.*,
           array_remove(array[
             case when r.st = 'soon' and r.days_left <= 3 then 'exp3' end,
             case when r.st = 'soon' and r.days_left > 3 then 'exp14' end,
             case when r.st = 'ended' and p_day - r.end_date between 1 and 7 then 'ended7' end,
             case when r.st = 'ended' and p_day - r.end_date between 8 and 14 then 'ended14' end,
             case when r.st = 'ended' and p_day - r.end_date between 15 and 30 then 'ended30' end,
             case when r.is_active and not r.dormant and (r.end_date is null or r.end_date > p_day + 14) and r.since_snap >= 7 then 'novisit7' end,
             case when r.is_active and r.since_snap >= 30 then 'idle30' end,
             case when r.st in ('active', 'soon') and r.joined_at is not null and r.joined_at between p_day - 27 and p_day
                       and r.since_join < floor((p_day - r.joined_at + 1) * 8.0 / 28) then 'starter' end
           ], null) as todo
      from r
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'name', t.member_name,
           'last4', right(coalesce(t.normalized_phone, ''), 4),
           'product', t.product_name,
           'start', t.start_date,
           'end', t.end_date,
           'days_left', t.days_left,
           'status', t.st,
           'joined', t.joined_at,
           'last_visit', t.last_visit,
           'v7', t.v7,
           'v30', t.v30,
           'coach', nullif(trim(coalesce(t.assigned_coach, '')), ''),
           'todo', to_jsonb(t.todo)
         ) order by
           case t.st when 'soon' then 0 when 'active' then 1 when 'hold' then 2 when 'ended' then 3 else 4 end,
           t.end_date nulls last, t.member_name), '[]'::jsonb),
         jsonb_build_object(
           'active', count(*) filter (where t.st = 'active'),
           'soon', count(*) filter (where t.st = 'soon'),
           'hold', count(*) filter (where t.st = 'hold'),
           'valid', count(*) filter (where t.is_active),
           'ended30', count(*) filter (where t.st = 'ended' and p_day - t.end_date between 1 and 30),
           'ended', count(*) filter (where t.st = 'ended'),
           'expiring', count(*) filter (where t.todo && array['exp3', 'exp14']),
           'novisit7', count(*) filter (where 'novisit7' = any(t.todo)),
           'idle30', count(*) filter (where 'idle30' = any(t.todo)),
           'starter', count(*) filter (where 'starter' = any(t.todo)),
           'unknown', count(*) filter (where t.st = 'unknown'),
           'shown', count(*))
    into v_rows, v_counts
    from t;

  return jsonb_build_object(
    'v', 1,
    'branch', p_branch_name,
    'day', p_day,
    'query', v_q,
    'snap_at', (select max(m.updated_at) from public.member_snapshots m where m.branch_id = v_bid),
    'counts', v_counts,
    'rows', v_rows);
end
$function$;

create or replace function public.crm_member_card(p_branch_name text, p_member_id uuid, p_day date default ((now() at time zone 'Asia/Seoul')::date))
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_bid uuid;
  m record;
  v_mid text;
  v_norm text;
  v_same integer;
  v_visits jsonb;
  v_pay jsonb;
  v_follow jsonb;
  v_active boolean;
begin
  select b.id into v_bid from public.branches b
   where b.name = p_branch_name and b.deleted_at is null order by b.created_at limit 1;
  if v_bid is null then
    return jsonb_build_object('error', 'branch_not_found');
  end if;
  select * into m from public.member_snapshots s where s.id = p_member_id and s.branch_id = v_bid;
  if not found then
    return jsonb_build_object('error', 'member_not_found');
  end if;
  v_mid := coalesce(m.raw_payload ->> 'member_id', '');
  v_norm := regexp_replace(coalesce(m.member_name, ''), '\s', '', 'g');
  select count(*) into v_same from public.member_snapshots s
   where s.branch_id = v_bid and regexp_replace(coalesce(s.member_name, ''), '\s', '', 'g') = v_norm;
  v_active := case when m.end_date is not null then m.end_date >= p_day and not (coalesce(m.status, '') ~ '(만료|탈퇴|환불|종료)')
                   else coalesce(m.status, '') ~ '(유효|활성|이용)' end;

  select coalesce(jsonb_agg(d order by d), '[]'::jsonb) into v_visits
    from (select distinct a.attend_date as d
            from public.attendance_logs a
           where a.branch_id = v_bid and coalesce(a.counts_as_visit, true)
             and a.attend_date between p_day - 89 and p_day
             and ((v_mid <> '' and a.broj_member_id = v_mid) or (v_mid = '' and a.phone = m.normalized_phone))) x;

  select coalesce(jsonb_agg(jsonb_build_object('day', s.sale_date, 'product', s.product, 'category', s.category, 'amount', s.amount)
                            order by s.sale_date desc), '[]'::jsonb) into v_pay
    from (select * from public.sales_entries s
           where s.branch_id = v_bid and regexp_replace(coalesce(s.member_name, ''), '\s', '', 'g') = v_norm
             and s.sale_date >= p_day - 730
           order by s.sale_date desc limit 30) s;

  select coalesce(jsonb_agg(jsonb_build_object('at', f.created_at, 'status', f.status, 'met', f.met_inperson, 'called', f.called,
                                               'texted', f.texted, 'memo', f.memo) order by f.created_at desc), '[]'::jsonb) into v_follow
    from (select * from public.member_followups f
           where f.branch_id = v_bid and regexp_replace(coalesce(f.member_name, ''), '\s', '', 'g') = v_norm
           order by f.created_at desc limit 10) f;

  return jsonb_build_object(
    'v', 1,
    'id', m.id,
    'name', m.member_name,
    'phone', m.normalized_phone,
    'product', m.product_name,
    'membership_type', m.membership_type,
    'start', m.start_date,
    'end', m.end_date,
    'days_left', m.end_date - p_day,
    'active', v_active,
    'status_text', m.status,
    'hold', jsonb_build_object('status', m.hold_status, 'start', m.hold_start, 'end', m.hold_end),
    'sessions', jsonb_build_object('total', m.total_sessions, 'used', m.used_sessions, 'remaining', m.remaining_sessions),
    'pt', jsonb_build_object('active', m.pt_active, 'ticket', m.pt_ticket_name, 'remaining', m.pt_remaining, 'end', m.pt_end_date),
    'coach', nullif(trim(coalesce(m.assigned_coach, '')), ''),
    'joined', nullif(m.raw_payload ->> 'joined_at', ''),
    'last_bought', nullif(m.raw_payload ->> 'last_ticket_purchased_at', ''),
    'route', nullif(m.raw_payload ->> 'visit_route', ''),
    'purpose', nullif(m.raw_payload ->> 'exercise_purpose', ''),
    'last_visit', m.latest_visit_date,
    'visits', v_visits,
    'payments', v_pay,
    'same_name', v_same,
    'followups', v_follow,
    'checked_at', m.ticket_checked_at,
    'updated_at', m.updated_at);
end
$function$;

create or replace function public.crm_customers(p_branch_name text, p_day date default ((now() at time zone 'Asia/Seoul')::date))
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
  v_codes text[];
  v_leads jsonb;
  v_inq jsonb;
  v_funnel jsonb;
begin
  select b.id into v_bid from public.branches b
   where b.name = p_branch_name and b.deleted_at is null order by b.created_at limit 1;
  if v_bid is null then
    return jsonb_build_object('error', 'branch_not_found');
  end if;
  v_k := public.branch_vscore_kpis(v_bid, p_day);
  select coalesce(array_agg(code), '{}') into v_codes from public.talktalk_branch_map where branch_id = v_bid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'source', 'talktalk',
           'at', t.created_at,
           'last_at', t.last_contact_at,
           'msgs', t.msg_count,
           'first', left(coalesce(t.first_message, ''), 80),
           'last4', right(regexp_replace(coalesce(t.phone, ''), '\D', '', 'g'), 4),
           'member', exists (select 1 from public.member_snapshots s
                              where s.branch_id = v_bid and s.normalized_phone = regexp_replace(coalesce(t.phone, ''), '\D', '', 'g')
                                and s.normalized_phone <> '')
         ) order by t.created_at desc), '[]'::jsonb)
    into v_leads
    from (select * from public.talktalk_leads t
           where t.branch = any(v_codes) and t.created_at >= (p_day - 59)::timestamp at time zone 'Asia/Seoul'
           order by t.created_at desc limit 50) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'source', coalesce(l.source, 'inquiry'),
           'at', l.created_at,
           'name', l.lead_name,
           'last4', right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 4),
           'status', l.status,
           'interest', l.interest_product,
           'trial_at', l.trial_at,
           'next_at', l.next_action_at,
           'first_contact_at', l.first_contact_at
         ) order by l.created_at desc), '[]'::jsonb)
    into v_inq
    from (select * from public.lead_inquiries l where l.branch_id = v_bid order by l.created_at desc limit 50) l;

  v_funnel := jsonb_build_object(
    'month', to_char(v_m0, 'YYYY-MM'),
    'talk_new', coalesce((v_k ->> 'talk_new_month')::integer, 0),
    'talk_leads', (select count(*) from public.talktalk_leads t
                    where t.branch = any(v_codes) and t.created_at >= v_m0::timestamp at time zone 'Asia/Seoul'),
    'inquiries', (select count(*) from public.lead_inquiries l
                   where l.branch_id = v_bid and l.created_at >= v_m0::timestamp at time zone 'Asia/Seoul'),
    'first_buy', coalesce((v_k ->> 'first_buy_month')::integer, 0),
    'rebuy', coalesce((v_k ->> 'rebuy_month')::integer, 0));

  return jsonb_build_object('v', 1, 'branch', p_branch_name, 'day', p_day, 'funnel', v_funnel, 'talk', v_leads, 'inquiries', v_inq);
end
$function$;

revoke all on function public.crm_members(text, text, date) from public, anon, authenticated;
revoke all on function public.crm_member_card(text, uuid, date) from public, anon, authenticated;
revoke all on function public.crm_customers(text, date) from public, anon, authenticated;
grant execute on function public.crm_members(text, text, date) to service_role;
grant execute on function public.crm_member_card(text, uuid, date) to service_role;
grant execute on function public.crm_customers(text, date) to service_role;
