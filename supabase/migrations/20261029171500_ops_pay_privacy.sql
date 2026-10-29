-- 153운영본부 · 근무 — 돈은 대표님만 · 코치님은 본인 것만 (2026-10-29 대표님
--   "153운영본부탭에 코치님들이 다른 코치님들 일하는시간이랑 버는돈등을 보지못하게 본인자료만 볼수있게 해줘"
--   → 고른 답: 지점장은 「돈만 숨기기」 · 코치 본인 화면에 「본인 금액도 보여주기」)
--
--   이미 그렇던 것: 일반 코치님은 ops_month 가 본인 카드만 보낸다(다른 사람 근무 · 시간 안 보임).
--   바꾼 것:
--     · 돈(시급 · 월급 · PT 수당표)을 볼 수 있는 사람 = 대표님(hq) + 대표님이 지정한 회계매니저만 (_ops_can_see_pay).
--       지점장은 근무 관리(시간 고치기 · 대타 승인 · 시간표)는 그대로 하고 다른 사람 돈은 못 본다.
--     · 누구든 본인 카드의 시급 · 월급은 본다 → 코치님 화면 '이번 달 예상(공제 전)' · PT 위탁 코치는 본인 PT 수당.
--     · 지점장이 근무자 카드를 저장해도 시급 · 월급 · 급여 방식은 그대로 둔다(안 보이는 값을 비워 버리지 않게).
--       지점장이 새 근무자를 넣으면 급여는 비워 두고 대표님이 넣는다.
--   기존 함수 이름 · 인자 그대로 — 동작만 좁힘. 응답에 'pay'(이 화면에서 돈을 보는가)를 덧붙임.

-- ───────────────────────── 돈을 보는 사람 ─────────────────────────
create or replace function public._ops_can_see_pay(_uid uuid, _branch text)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null
     and exists (select 1 from public.ops_branches b where b.branch_name = _branch and b.enabled)
     and (public._strategy_hq(_uid)
          or exists (select 1 from public.ops_managers m
                      where m.user_id = _uid and m.title = '회계매니저'
                        and (m.branch_name is null or m.branch_name = _branch)));
$$;
revoke all on function public._ops_can_see_pay(uuid, text) from public, anon, authenticated;

-- ───────────────────────── 한 달 자료 ─────────────────────────
create or replace function public.ops_month(p_branch text, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_manage boolean := public._ops_can_manage(v_uid, p_branch);
  v_pay boolean := public._ops_can_see_pay(v_uid, p_branch);
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_manage then
    select coalesce(array_agg(id), '{}') into v_ids from public.ops_staff where branch_name = p_branch;
  else
    select coalesce(array_agg(id), '{}') into v_ids from public.ops_staff where branch_name = p_branch and user_id = v_uid;
    if cardinality(v_ids) = 0 then raise exception '이 지점 근무 자료를 볼 수 없어요'; end if;
  end if;

  return jsonb_build_object(
    'branch', p_branch,
    'month', to_char(v_from, 'YYYY-MM-DD'),
    'manage', v_manage,
    'pay', v_pay,
    'hq', public._strategy_hq(v_uid),
    'today', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'now_hm', to_char(now() at time zone 'Asia/Seoul', 'HH24:MI'),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'user_id', s.user_id, 'name', s.name, 'kind', s.kind, 'pay_type', s.pay_type,
               -- 돈 = 대표님 · 회계매니저, 또는 본인 카드
               'hourly_wage', case when v_pay or s.user_id = v_uid then s.hourly_wage end,
               'monthly_salary', case when v_pay or s.user_id = v_uid then s.monthly_salary end,
               'pt_freelancer', s.pt_freelancer, 'checkin_required', s.checkin_required,
               'start_date', s.start_date, 'end_date', s.end_date, 'active', s.active,
               'note', case when v_manage then s.note end, 'mine', s.user_id = v_uid)
             order by s.active desc, s.name)
        from public.ops_staff s where s.id = any(v_ids)), '[]'::jsonb),
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'staff_id', r.staff_id, 'weekday', r.weekday,
               'start_time', to_char(r.start_time, 'HH24:MI'), 'end_time', to_char(r.end_time, 'HH24:MI'),
               'valid_from', r.valid_from, 'valid_to', r.valid_to)
             order by r.staff_id, r.weekday, r.start_time)
        from public.ops_shift_rules r
       where r.staff_id = any(v_ids) and r.valid_from <= v_to and (r.valid_to is null or r.valid_to >= v_from)), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'staff_id', e.staff_id, 'work_date', e.work_date, 'kind', e.kind, 'status', e.status,
               'minutes', e.minutes,
               'start_time', to_char(e.start_time, 'HH24:MI'), 'end_time', to_char(e.end_time, 'HH24:MI'),
               'cover_staff_id', e.cover_staff_id, 'reason', e.reason, 'decide_note', e.decide_note,
               'requested_by_me', e.requested_by = v_uid, 'created_at', e.created_at, 'decided_at', e.decided_at)
             order by e.work_date, e.created_at)
        from public.ops_day_entries e
       where (e.staff_id = any(v_ids) or e.cover_staff_id = any(v_ids))
         and e.work_date between v_from and v_to and e.status <> 'canceled'), '[]'::jsonb),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', x.staff_id, 'work_date', x.d,
                                          'at_hm', to_char(x.first_at at time zone 'Asia/Seoul', 'HH24:MI'))
             order by x.d)
        from (select s.id as staff_id, l.attend_date as d, min(l.checked_in_at) as first_at
                from public.ops_staff s
                join public.staff_duty_logs l
                  on l.branch_name = s.branch_name
                 and l.attend_date between v_from and v_to
                 and ((s.user_id is not null and l.user_id = s.user_id) or l.staff_name = s.name)
               where s.id = any(v_ids)
               group by s.id, l.attend_date) x), '[]'::jsonb),
    -- 대타로 고를 수 있는 같은 지점 동료 (이름만)
    'colleagues', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name)
        from public.ops_staff s
       where s.branch_name = p_branch and s.active and s.kind <> 'volunteer'), '[]'::jsonb));
end $$;

-- ───────────────────────── 근무자 카드 저장 ─────────────────────────
-- 돈을 못 보는 관리자(지점장)는 급여 방식 · 시급 · 월급을 바꾸지 못한다 — 보낸 값은 무시하고 그대로 둔다.
create or replace function public.ops_staff_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text;
  v_kind text := coalesce(nullif(p->>'kind', ''), 'parttime');
  v_pay text := coalesce(nullif(p->>'pay_type', ''), case when coalesce(nullif(p->>'kind', ''), 'parttime') = 'volunteer' then 'none' else 'hourly' end);
  v_wage integer := nullif(p->>'hourly_wage', '')::integer;
  v_salary integer := nullif(p->>'monthly_salary', '')::integer;
  v_can_pay boolean;
begin
  if v_id is not null then
    select branch_name into v_branch from public.ops_staff where id = v_id;
    if v_branch is null then raise exception '근무자를 찾을 수 없어요'; end if;
  else
    v_branch := p->>'branch';
  end if;
  if not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  if length(btrim(coalesce(p->>'name', ''))) = 0 then raise exception '이름을 넣어 주세요'; end if;
  v_can_pay := public._ops_can_see_pay(v_uid, v_branch);
  if v_kind = 'volunteer' then v_pay := 'none'; end if;

  if v_can_pay then
    -- 최저시급 (2026년 10,320원 · 2027년 10,700원 — 앱이 1월 전에 미리 알린다)
    if v_pay = 'hourly' and (v_wage is null or v_wage < 10320) then
      raise exception '시급은 최저시급(2026년 10,320원) 이상이어야 해요';
    end if;
    if v_pay = 'monthly' and coalesce(v_salary, 0) <= 0 then raise exception '월급을 넣어 주세요'; end if;
  else
    -- 지점장: 새 근무자는 급여를 비워 두고(대표님이 넣음) · 있는 근무자는 아래 update 에서 급여 칸을 건드리지 않는다
    if v_pay <> 'none' then v_pay := 'hourly'; end if;
    v_wage := null;
    v_salary := null;
  end if;

  if v_id is null then
    insert into public.ops_staff (branch_name, user_id, name, kind, pay_type, hourly_wage, monthly_salary, pt_freelancer,
                                  checkin_required, start_date, end_date, active, note, created_by)
    values (v_branch, nullif(p->>'user_id', '')::uuid, btrim(p->>'name'), v_kind, v_pay,
            case when v_pay = 'hourly' then v_wage end, case when v_pay = 'monthly' then v_salary end,
            coalesce((p->>'pt_freelancer')::boolean, false), coalesce((p->>'checkin_required')::boolean, true),
            nullif(p->>'start_date', '')::date, nullif(p->>'end_date', '')::date,
            coalesce((p->>'active')::boolean, true), nullif(btrim(coalesce(p->>'note', '')), ''), v_uid)
    returning id into v_id;
  else
    update public.ops_staff set
      user_id = nullif(p->>'user_id', '')::uuid,
      name = btrim(p->>'name'),
      kind = v_kind,
      pay_type = case when v_can_pay then v_pay else pay_type end,
      hourly_wage = case when v_can_pay then (case when v_pay = 'hourly' then v_wage end) else hourly_wage end,
      monthly_salary = case when v_can_pay then (case when v_pay = 'monthly' then v_salary end) else monthly_salary end,
      pt_freelancer = coalesce((p->>'pt_freelancer')::boolean, false),
      checkin_required = coalesce((p->>'checkin_required')::boolean, true),
      start_date = nullif(p->>'start_date', '')::date,
      end_date = nullif(p->>'end_date', '')::date,
      active = coalesce((p->>'active')::boolean, true),
      note = nullif(btrim(coalesce(p->>'note', '')), ''),
      updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;

-- ───────────────────────── PT 한 달 ─────────────────────────
-- 수당표(rates) = 대표님 · 회계매니저, 또는 본인 PT 수당을 볼 PT 위탁 코치 본인. 지점장은 횟수 · 회원만.
create or replace function public.ops_pt_month(p_branch text, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_manage boolean := public._ops_can_manage(v_uid, p_branch);
  v_pay boolean := public._ops_can_see_pay(v_uid, p_branch);
  v_mine uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not v_manage then
    select s.id into v_mine from public.ops_staff s
     where s.branch_name = p_branch and s.user_id = v_uid and s.pt_freelancer and s.active limit 1;
    if v_mine is null then raise exception 'PT 자료를 볼 수 없어요'; end if;
  end if;

  return jsonb_build_object(
    'branch', p_branch,
    'month', to_char(v_from, 'YYYY-MM-DD'),
    'manage', v_manage,
    'pay', v_pay or v_mine is not null,
    'me_staff', v_mine,
    -- 지금 PT 수업권이 있는 회원 (브로제이 → 153OS → 앱)
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(nullif(btrim(p.name), ''), '회원'),
                                          'ticket', p.pt_ticket, 'remaining', p.pt_remaining,
                                          'end_date', p.pt_end_date, 'checked_at', p.pt_checked_at)
             order by p.pt_remaining nulls last, p.name)
        from public.profiles p
       where p.branch_name = p_branch and p.pt_ticket is not null and coalesce(p.is_test_account, false) = false), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'member_user_id', e.member_user_id, 'member_name', e.member_name,
                                          'ticket_name', e.ticket_name, 'before', e.before_remaining, 'after', e.after_remaining,
                                          'used', e.used, 'kind', e.kind, 'status', e.status, 'coach_staff_id', e.coach_staff_id,
                                          'work_date', e.work_date, 'detected_at', e.detected_at, 'note', e.note)
             order by e.work_date desc, e.detected_at desc)
        from public.ops_pt_events e
       where e.branch_name = p_branch and e.work_date between v_from and v_to
         and (v_manage or e.coach_staff_id = v_mine)), '[]'::jsonb),
    'rates', case when v_pay or v_mine is not null then coalesce((
      select jsonb_agg(jsonb_build_object('team_size', r.team_size, 'sessions', r.sessions, 'session_rate', r.session_rate,
                                          'valid_from', r.valid_from) order by r.team_size, r.sessions, r.valid_from)
        from public.ops_pt_rates r where r.branch_name = p_branch), '[]'::jsonb) else '[]'::jsonb end);
end $$;
