-- PT 수당 2단계 2-2 — 월 마감 (2026-11-16 대표님 「추천대로 진행하고 2-2진행하자」
--   · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「월 마감과 명세서」 · 「2단계 제작 계획」 2-2)
--
--   2-1(20261116 · DB 변경 없음)은 「기록 + 차감」 수당을 열 때마다 지금 자료로 다시 셈한다 — 지난달 숫자가 뒤늦은 차감 ·
--   확인으로 바뀔 수 있다. 12월 수업분 첫 지급(1/3 코치 확정 → 1/4 승인 → 1/5 세무 → 1/10 지급) 전에 잠금이 있어야 한다.
--
--   · 코치 확정(ops_pt_close_confirm): 달이 끝난 뒤, PT 코치 본인이 그 달 줄을 보고 누른다. 그때 본 줄 · 정산 줄을 남긴다
--     (정산 줄을 본 채로 확정 = 그 줄을 빼는 데 동의).
--   · 승인 = 잠금(ops_pt_close_approve): 대표님 · 회계매니저. 화면이 셈한 줄을 받아 **서버가 다시 본다** —
--     그 코치의 수업 기록인지 · 같은 수업이 이미 지급됐는지(이중 지급 막기) · 정산 줄은 지급한 적이 있고 코치가 동의했는지 ·
--     합계와 3.3%는 서버가 셈한다. 앞 달을 먼저 승인해야 하고(차례대로), 뒤 달이 승인된 달은 다시 못 연다.
--   · 닫은 뒤 달라진 것은 닫은 달을 고치지 않는다 — 다음에 닫는 달에 줄로 얹는다:
--       「보정」(adj) 닫은 달의 수업이 뒤늦게 지급 대상이 됨(늦은 차감 · 늦은 확인) / 「정산」(settle) 지급한 수업이 없던 일이 됨.
--     줄마다 열쇠 = 수업 기록 id:몇 번째 회. 승인한 달들의 줄을 모으면 「이 수업에 얼마 나갔나」가 나온다(_ops_pt_close_ledger).
--   · 승인 취소(ops_pt_close_reopen): 대표님만 · 뒤 달이 승인되기 전에만 · 사유와 취소 전 승인본을 남긴다.
--   · 알림: 확정 → 대표님 · 회계매니저 / 승인 · 취소 → 코치 / 매일 10:05(1~10일) 확정 · 승인 재촉(_ops_pt_close_tick).
--   짝짓기 · 줄 만들기는 화면(src/lib/opsPtPay.ts · opsPtClose.ts) 한 곳 — 서버는 잠그고 지킨다. 금액 · 회원 이름은 이 표에만.
--   새 표 2 · 새 함수 8 · 새 예약 1 — 기존 표 · 함수 · 예약은 건드리지 않는다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_closes (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid not null references public.ops_staff(id),
  month date not null check (extract(day from month) = 1),
  -- open 승인을 취소했고 코치 확정이 없는 달 · confirmed 코치 확정 · approved 승인(잠금)
  status text not null check (status in ('open', 'confirmed', 'approved')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  confirm_summary jsonb,          -- 코치가 확정할 때 본 것 {uses, hold, gross, keys[], settle[]}
  approved_by uuid,
  approved_at timestamptz,
  uses integer,                   -- 지급 줄(수업 · 지난달 수업 · 보정)
  settle_uses integer,            -- 정산(빼는) 줄
  hold integer,                   -- 승인할 때 남아 있던 보류(회)
  gross integer,                  -- 3.3% 전 = 지급 − 정산
  tax_income integer,             -- 소득세 3%(10원 미만 버림)
  tax_local integer,              -- 지방소득세 = 소득세의 10%(10원 미만 버림)
  net integer,
  lines jsonb,                    -- 승인한 줄 [{k, sid, i, t, rate, date, name, kind, ticket, deduct, from}]
  holds jsonb,                    -- 승인할 때의 보류 줄(참고)
  reopened_by uuid,
  reopened_at timestamptz,
  reopen_reason text check (reopen_reason is null or length(reopen_reason) <= 300),
  prev jsonb,                     -- 취소 전 승인본
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_name, coach_staff_id, month)
);
alter table public.ops_pt_closes enable row level security;

-- 재촉 알림 한 번만
create table if not exists public.ops_pt_close_notices (
  kind text not null check (kind in ('confirm', 'approve')),
  ref text not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref, user_id)
);
alter table public.ops_pt_close_notices enable row level security;

revoke all on public.ops_pt_closes, public.ops_pt_close_notices from anon, authenticated;

-- ───────────────────────── 안쪽 함수 ─────────────────────────
-- 이 지점이 「기록 + 차감」으로 넘어가는 첫 달 — PT 기록을 켠 다음 달(1일에 켰으면 그 달) · 2026-12 보다 이르지 않다.
--   화면 src/lib/opsPtPay.ts ptPayFirstRecordMonth 와 같은 셈. PT 기록을 안 켠 지점은 null.
create or replace function public._ops_pt_pay_first_month(_branch text)
returns date language sql stable security definer set search_path = public as $$
  select greatest(date '2026-12-01',
                  case when extract(day from s.started_on) = 1 then date_trunc('month', s.started_on)::date
                       else (date_trunc('month', s.started_on) + interval '1 month')::date end)
    from public.ops_pt_settings s
   where s.branch_name = _branch and s.record_on;
$$;

-- 승인한 달들의 줄을 모은다 — 줄마다(수업 기록 id:몇 번째) 지금까지 나간 금액. 정산은 뺀다.
create or replace function public._ops_pt_close_ledger(_branch text, _coach uuid)
returns table (k text, amount integer) language sql stable security definer set search_path = public as $$
  select l->>'k', sum(case when l->>'t' = 'settle' then -((l->>'rate')::int) else (l->>'rate')::int end)::int
    from public.ops_pt_closes c
   cross join lateral jsonb_array_elements(coalesce(c.lines, '[]'::jsonb)) l
   where c.branch_name = _branch and c.coach_staff_id = _coach and c.status = 'approved'
   group by 1;
$$;

-- 돈을 보는 분(대표님 · 그 지점 회계매니저)에게 알림
create or replace function public._ops_pt_close_notify_pay(_branch text, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select u.user_id, _title, coalesce(_body, ''), _link
    from (select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
          union
          select m.user_id from public.ops_managers m
           where m.title = '회계매니저' and (m.branch_name is null or m.branch_name = _branch)) u;
$$;

-- ───────────────────────── 읽기 ─────────────────────────
-- 관리자(지점 전체) 또는 그 지점 PT 코치(본인 것만). 금액은 돈을 보는 분과 그 코치 본인에게만.
create or replace function public.ops_pt_close_list(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_mine uuid;
  v_pay boolean;
  v_first date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  v_mine := public._ops_pt_my_staff(v_uid, p_branch);
  if not v_manage and v_mine is null then raise exception 'PT 자료를 볼 수 없어요'; end if;
  v_pay := public._ops_can_see_pay(v_uid, p_branch);
  v_first := public._ops_pt_pay_first_month(p_branch);
  if v_first is null then
    return jsonb_build_object('branch', p_branch, 'on', false, 'manage', v_manage, 'pay', v_pay, 'me_staff', v_mine);
  end if;
  return jsonb_build_object(
    'branch', p_branch,
    'on', true,
    'first_month', v_first,
    'today', v_today,
    'manage', v_manage,
    'pay', v_pay,
    'can_approve', v_pay,
    'can_reopen', public._strategy_hq(v_uid),
    'me_staff', v_mine,
    -- 코치마다 마감을 시작하는 달(지점 첫 달과 근무자 카드를 만든 달 중 늦은 쪽) — 그 달부터 차례대로 승인한다
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'start', greatest(v_first, date_trunc('month', (s.created_at at time zone 'Asia/Seoul'))::date))
             order by s.created_at)
        from public.ops_staff s
       where s.branch_name = p_branch and s.pt_freelancer and (v_manage or s.id = v_mine)), '[]'::jsonb),
    'closes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'coach_staff_id', c.coach_staff_id, 'month', c.month, 'status', c.status,
               'confirmed_at', c.confirmed_at, 'approved_at', c.approved_at,
               'uses', c.uses, 'settle_uses', c.settle_uses, 'hold', c.hold,
               'gross', case when v_pay or c.coach_staff_id = v_mine then c.gross end,
               'tax_income', case when v_pay or c.coach_staff_id = v_mine then c.tax_income end,
               'tax_local', case when v_pay or c.coach_staff_id = v_mine then c.tax_local end,
               'net', case when v_pay or c.coach_staff_id = v_mine then c.net end,
               'lines', case when c.lines is null then null
                             when v_pay or c.coach_staff_id = v_mine then c.lines
                             else (select coalesce(jsonb_agg(l - 'rate'), '[]'::jsonb) from jsonb_array_elements(c.lines) l) end,
               'holds', c.holds,
               'confirm', case when c.confirm_summary is null then null
                               when v_pay or c.coach_staff_id = v_mine then c.confirm_summary
                               else c.confirm_summary - 'gross' end,
               'reopened_at', c.reopened_at, 'reopen_reason', c.reopen_reason)
             order by c.month desc, c.created_at)
        from public.ops_pt_closes c
       where c.branch_name = p_branch and (v_manage or c.coach_staff_id = v_mine)
         and c.month >= (date_trunc('month', v_today) - interval '11 months')::date), '[]'::jsonb));
end $$;

-- ───────────────────────── 코치 확정 ─────────────────────────
create or replace function public.ops_pt_close_confirm(p_branch text, p_month date, p_summary jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mine uuid;
  v_first date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month date;
  v_row public.ops_pt_closes;
  v_sum jsonb;
  v_name text;
  v_new boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_mine := public._ops_pt_my_staff(v_uid, p_branch);
  if v_mine is null then raise exception 'PT 코치님만 확정할 수 있어요'; end if;
  v_first := public._ops_pt_pay_first_month(p_branch);
  if v_first is null then raise exception 'PT 기록을 켠 지점에서만 쓸 수 있어요'; end if;
  if p_month is null then raise exception '달을 골라 주세요'; end if;
  v_month := date_trunc('month', p_month)::date;
  if v_month < v_first then raise exception '이 달은 차감 기록 기준이에요'; end if;
  if v_today < (v_month + interval '1 month')::date then raise exception '달이 끝난 뒤에 확정할 수 있어요'; end if;

  -- 코치가 본 것 — 모양을 믿지 않고 다듬는다
  v_sum := jsonb_build_object(
    'uses', case when (p_summary->>'uses') ~ '^[0-9]{1,4}$' then (p_summary->>'uses')::int else 0 end,
    'hold', case when (p_summary->>'hold') ~ '^[0-9]{1,4}$' then (p_summary->>'hold')::int else 0 end,
    'gross', case when (p_summary->>'gross') ~ '^[0-9]{1,9}$' then (p_summary->>'gross')::int end,
    'keys', coalesce((
      select jsonb_agg(q.x) from (
        select x from jsonb_array_elements_text(
          case when jsonb_typeof(p_summary->'keys') = 'array' then p_summary->'keys' else '[]'::jsonb end) x
         where length(x) <= 60 limit 600) q), '[]'::jsonb),
    'settle', coalesce((
      select jsonb_agg(q.x) from (
        select x from jsonb_array_elements_text(
          case when jsonb_typeof(p_summary->'settle') = 'array' then p_summary->'settle' else '[]'::jsonb end) x
         where length(x) <= 60 limit 200) q), '[]'::jsonb));

  select * into v_row from public.ops_pt_closes c
   where c.branch_name = p_branch and c.coach_staff_id = v_mine and c.month = v_month for update;
  if found then
    if v_row.status = 'approved' then raise exception '이미 승인된 달이에요'; end if;
    v_new := v_row.confirmed_at is null;
    update public.ops_pt_closes
       set status = 'confirmed', confirmed_by = v_uid, confirmed_at = now(), confirm_summary = v_sum, updated_at = now()
     where id = v_row.id;
  else
    v_new := true;
    insert into public.ops_pt_closes (branch_name, coach_staff_id, month, status, confirmed_by, confirmed_at, confirm_summary)
    values (p_branch, v_mine, v_month, 'confirmed', v_uid, now(), v_sum);
  end if;

  -- 처음 확정할 때만 알린다(다시 확정은 조용히)
  if v_new then
    select s.name into v_name from public.ops_staff s where s.id = v_mine;
    perform public._ops_pt_close_notify_pay(p_branch, 'PT 수당 확정 · 승인 대기',
      concat_ws(' · ', replace(p_branch, '153복싱짐 ', ''), coalesce(v_name, '') || ' 코치',
                extract(month from v_month)::int || '월', '지급 대상 ' || (v_sum->>'uses') || '회'),
      '/office?tab=work&ptcoach=' || v_mine::text);
  end if;
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end $$;

-- ───────────────────────── 승인 = 잠금 ─────────────────────────
create or replace function public.ops_pt_close_approve(p_branch text, p_coach uuid, p_month date, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_first date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month date;
  v_chain date;
  v_staff public.ops_staff;
  v_row public.ops_pt_closes;
  v_has boolean;
  v_agreed jsonb := '[]'::jsonb;
  v_ledger jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_holds jsonb := '[]'::jsonb;
  v_hold integer := 0;
  l jsonb;
  v_t text;
  v_k text;
  v_sid uuid;
  v_i integer;
  v_rate integer;
  v_paid integer;
  v_keys text[] := '{}'::text[];
  v_pay integer := 0;
  v_settle integer := 0;
  v_uses integer := 0;
  v_suses integer := 0;
  v_gross integer;
  v_income integer;
  v_local integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not public._ops_can_see_pay(v_uid, p_branch) then raise exception '대표님 · 회계매니저만 승인할 수 있어요'; end if;
  select * into v_staff from public.ops_staff s where s.id = p_coach and s.branch_name = p_branch and s.pt_freelancer;
  if not found then raise exception 'PT 코치를 찾지 못했어요'; end if;
  v_first := public._ops_pt_pay_first_month(p_branch);
  if v_first is null then raise exception 'PT 기록을 켠 지점에서만 쓸 수 있어요'; end if;
  if p_month is null then raise exception '달을 골라 주세요'; end if;
  v_month := date_trunc('month', p_month)::date;
  if v_month < v_first then raise exception '이 달은 차감 기록 기준이에요'; end if;
  if v_today < (v_month + interval '1 month')::date then raise exception '달이 끝난 뒤에 승인할 수 있어요'; end if;

  -- 차례대로: 뒤 달이 승인돼 있으면 안 되고, 앞 달(그 코치의 시작 달 뒤)이 승인돼 있어야 한다
  if exists (select 1 from public.ops_pt_closes c
              where c.branch_name = p_branch and c.coach_staff_id = p_coach and c.status = 'approved' and c.month > v_month) then
    raise exception '뒤 달이 이미 승인돼 있어요';
  end if;
  v_chain := greatest(v_first, date_trunc('month', (v_staff.created_at at time zone 'Asia/Seoul'))::date);
  if v_month > v_chain and not exists (
       select 1 from public.ops_pt_closes c
        where c.branch_name = p_branch and c.coach_staff_id = p_coach and c.status = 'approved'
          and c.month = (v_month - interval '1 month')::date) then
    raise exception '앞 달(%월)을 먼저 승인해 주세요', extract(month from (v_month - interval '1 month'))::int;
  end if;

  select * into v_row from public.ops_pt_closes c
   where c.branch_name = p_branch and c.coach_staff_id = p_coach and c.month = v_month for update;
  v_has := found;
  if v_has and v_row.status = 'approved' then raise exception '이미 승인된 달이에요'; end if;
  if v_has and v_row.status = 'confirmed' then v_agreed := coalesce(v_row.confirm_summary->'settle', '[]'::jsonb); end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot->'lines') is distinct from 'array' then raise exception '줄이 없어요'; end if;
  if jsonb_array_length(p_snapshot->'lines') > 600 or octet_length(p_snapshot::text) > 600000 then raise exception '줄이 너무 많아요'; end if;
  select coalesce(jsonb_object_agg(g.k, g.amount), '{}'::jsonb) into v_ledger from public._ops_pt_close_ledger(p_branch, p_coach) g;

  for l in select x from jsonb_array_elements(p_snapshot->'lines') x loop
    v_t := l->>'t';
    if v_t is null or v_t not in ('line', 'carry', 'adj', 'settle') then raise exception '줄 종류가 맞지 않아요'; end if;
    if (l->>'rate') is null or (l->>'rate') !~ '^[0-9]{1,7}$' then
      raise exception '금액이 없는 줄이 있어요 — 수당표를 먼저 확인해 주세요';
    end if;
    v_rate := (l->>'rate')::int;
    if (l->>'sid') is null or (l->>'sid') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception '수업 기록을 찾지 못했어요';
    end if;
    v_sid := (l->>'sid')::uuid;
    if (l->>'i') is null or (l->>'i') !~ '^[0-3]$' then raise exception '줄 번호가 맞지 않아요'; end if;
    v_i := (l->>'i')::int;
    v_k := v_sid::text || ':' || v_i;
    if v_k = any(v_keys) then raise exception '같은 수업이 두 번 들어 있어요'; end if;
    v_keys := v_keys || v_k;
    v_paid := coalesce((v_ledger->>v_k)::int, 0);

    if v_t = 'settle' then
      -- 지급한 적이 있는 수업만 · 지급한 만큼까지만 · 코치가 본 채로 확정한 줄만
      if not exists (select 1 from public.ops_pt_sessions s
                      where s.id = v_sid and s.branch_name = p_branch) then
        raise exception '수업 기록을 찾지 못했어요';
      end if;
      if v_paid <= 0 then raise exception '지급한 적 없는 수업은 정산할 수 없어요'; end if;
      if v_rate > v_paid then raise exception '정산 금액이 지급한 금액보다 커요'; end if;
      if not (v_agreed ? v_k) then raise exception '정산 줄은 코치님이 확정(동의)한 뒤에 넣을 수 있어요'; end if;
      v_settle := v_settle + v_rate;
      v_suses := v_suses + 1;
    else
      -- 이 코치의 열린 수업 기록 · 그 기록의 횟수 안 · 아직 지급한 적 없는 수업
      if not exists (select 1 from public.ops_pt_sessions s
                      where s.id = v_sid and s.branch_name = p_branch and s.coach_staff_id = p_coach
                        and s.status = 'open' and s.kind in ('lesson', 'noshow', 'late_cancel')
                        and v_i < greatest(1, s.uses::int)) then
        raise exception '이 코치의 수업 기록이 아닌 줄이 있어요 — 새로 고친 뒤 다시 해 주세요';
      end if;
      if v_paid > 0 then raise exception '이미 지급한 수업이 들어 있어요 — 새로 고친 뒤 다시 해 주세요'; end if;
      v_pay := v_pay + v_rate;
      v_uses := v_uses + 1;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'k', v_k, 'sid', v_sid, 'i', v_i, 't', v_t, 'rate', v_rate,
      'date', left(l->>'date', 10), 'name', left(coalesce(l->>'name', ''), 40), 'kind', left(coalesce(l->>'kind', ''), 20),
      'ticket', left(l->>'ticket', 80), 'deduct', left(l->>'deduct', 10), 'from', left(l->>'from', 7)));
  end loop;

  v_gross := v_pay - v_settle;
  if v_gross < 0 then raise exception '정산 금액이 이 달 수당보다 커요 — 남는 것은 다음 달로 넘겨 주세요'; end if;
  -- 3.3% — 소득세 3% · 지방소득세 = 소득세의 10%, 각각 10원 미만 버림(src/lib/opsPt.ts withholding33 과 같은 셈)
  v_income := (v_gross * 3 / 1000) * 10;
  v_local := (v_income / 100) * 10;

  if jsonb_typeof(p_snapshot->'holds') = 'array' and jsonb_array_length(p_snapshot->'holds') <= 300 then
    v_holds := p_snapshot->'holds';
  end if;
  if (p_snapshot->>'hold') ~ '^[0-9]{1,4}$' then v_hold := (p_snapshot->>'hold')::int; end if;

  if v_has then
    update public.ops_pt_closes
       set status = 'approved', approved_by = v_uid, approved_at = now(),
           uses = v_uses, settle_uses = v_suses, hold = v_hold,
           gross = v_gross, tax_income = v_income, tax_local = v_local, net = v_gross - v_income - v_local,
           lines = v_lines, holds = v_holds, updated_at = now()
     where id = v_row.id;
  else
    insert into public.ops_pt_closes (branch_name, coach_staff_id, month, status, approved_by, approved_at,
                                      uses, settle_uses, hold, gross, tax_income, tax_local, net, lines, holds)
    values (p_branch, p_coach, v_month, 'approved', v_uid, now(),
            v_uses, v_suses, v_hold, v_gross, v_income, v_local, v_gross - v_income - v_local, v_lines, v_holds);
  end if;

  if v_staff.user_id is not null then
    insert into public.notifications (user_id, title, body, link)
    values (v_staff.user_id, 'PT 수당 승인',
            extract(month from v_month)::int || '월 PT 수당이 승인됐어요 · 근무 탭에서 확인해 주세요', '/office?tab=work');
  end if;
  return jsonb_build_object('ok', true, 'status', 'approved', 'uses', v_uses, 'settle_uses', v_suses,
                            'gross', v_gross, 'net', v_gross - v_income - v_local);
end $$;

-- ───────────────────────── 승인 취소 (대표님만) ─────────────────────────
create or replace function public.ops_pt_close_reopen(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ops_pt_closes;
  v_coach_uid uuid;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 승인을 취소할 수 있어요'; end if;
  if coalesce(length(btrim(p_reason)), 0) < 2 then raise exception '취소 사유를 적어 주세요'; end if;
  select * into v_row from public.ops_pt_closes c where c.id = p_id for update;
  if not found or v_row.status <> 'approved' then raise exception '승인된 달이 아니에요'; end if;
  if exists (select 1 from public.ops_pt_closes c
              where c.branch_name = v_row.branch_name and c.coach_staff_id = v_row.coach_staff_id
                and c.status = 'approved' and c.month > v_row.month) then
    raise exception '뒤 달이 승인돼 있어요 — 뒤 달부터 취소해 주세요';
  end if;
  update public.ops_pt_closes
     set status = case when confirmed_at is not null then 'confirmed' else 'open' end,
         prev = jsonb_build_object('approved_at', approved_at, 'approved_by', approved_by, 'uses', uses, 'settle_uses', settle_uses,
                                   'hold', hold, 'gross', gross, 'tax_income', tax_income, 'tax_local', tax_local, 'net', net,
                                   'lines', lines, 'holds', holds),
         approved_by = null, approved_at = null, uses = null, settle_uses = null, hold = null,
         gross = null, tax_income = null, tax_local = null, net = null, lines = null, holds = null,
         reopened_by = v_uid, reopened_at = now(), reopen_reason = left(btrim(p_reason), 300), updated_at = now()
   where id = v_row.id;
  select s.user_id into v_coach_uid from public.ops_staff s where s.id = v_row.coach_staff_id;
  if v_coach_uid is not null then
    insert into public.notifications (user_id, title, body, link)
    values (v_coach_uid, 'PT 수당 승인 취소',
            extract(month from v_row.month)::int || '월 PT 수당 승인이 취소됐어요 — ' || left(btrim(p_reason), 80), '/office?tab=work');
  end if;
  return jsonb_build_object('ok', true, 'status', case when v_row.confirmed_at is not null then 'confirmed' else 'open' end);
end $$;

-- ───────────────────────── 재촉 (매일 10:05 KST · 1~10일) ─────────────────────────
-- 지난달에 수업 기록이 있는 PT 코치마다: 확정 전이면 코치에게(1~5일), 확정됐거나 4일이 지났으면 돈을 보는 분에게. 하루 한 번.
create or replace function public._ops_pt_close_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  c record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day integer := extract(day from (now() at time zone 'Asia/Seoul'))::int;
  v_month date := (date_trunc('month', (now() at time zone 'Asia/Seoul')) - interval '1 month')::date;
  v_first date;
  v_st text;
  v_rows integer;
begin
  if v_day > 10 then return 0; end if;
  for r in select st.branch_name from public.ops_pt_settings st where st.record_on and st.notify_on loop
    v_first := public._ops_pt_pay_first_month(r.branch_name);
    continue when v_first is null or v_month < v_first;
    for c in
      select s.id, s.user_id, s.name from public.ops_staff s
       where s.branch_name = r.branch_name and s.pt_freelancer and s.active
         and exists (select 1 from public.ops_pt_sessions x
                      where x.branch_name = r.branch_name and x.coach_staff_id = s.id and x.status = 'open'
                        and x.session_date >= v_month and x.session_date < (v_month + interval '1 month')::date)
    loop
      v_st := null;
      select cl.status into v_st from public.ops_pt_closes cl
       where cl.branch_name = r.branch_name and cl.coach_staff_id = c.id and cl.month = v_month;
      continue when v_st = 'approved';
      if coalesce(v_st, 'open') <> 'confirmed' and c.user_id is not null and v_day <= 5 then
        insert into public.ops_pt_close_notices (kind, ref, user_id)
        values ('confirm', c.id::text || ':' || v_today::text, c.user_id) on conflict do nothing;
        get diagnostics v_rows = row_count;
        if v_rows > 0 then
          insert into public.notifications (user_id, title, body, link)
          values (c.user_id, 'PT 수당 확정',
                  extract(month from v_month)::int || '월 PT 수당을 확인하고 확정해 주세요 (3일까지)', '/office?tab=work');
          n := n + 1;
        end if;
      end if;
      if v_st = 'confirmed' or v_day >= 4 then
        insert into public.ops_pt_close_notices (kind, ref, user_id)
        values ('approve', c.id::text || ':' || v_today::text, '00000000-0000-0000-0000-000000000000') on conflict do nothing;
        get diagnostics v_rows = row_count;
        if v_rows > 0 then
          perform public._ops_pt_close_notify_pay(r.branch_name, 'PT 수당 승인 대기',
            concat_ws(' · ', replace(r.branch_name, '153복싱짐 ', ''), c.name || ' 코치', extract(month from v_month)::int || '월',
                      case when v_st = 'confirmed' then '코치 확정 끝' else '코치 확정 전' end),
            '/office?tab=work&ptcoach=' || c.id::text);
          n := n + 1;
        end if;
      end if;
    end loop;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_close_tick: %', sqlerrm;
  return -1;
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public._ops_pt_pay_first_month(text) from public, anon, authenticated;
revoke all on function public._ops_pt_close_ledger(text, uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_close_notify_pay(text, text, text, text) from public, anon, authenticated;
revoke all on function public._ops_pt_close_tick() from public, anon, authenticated;
revoke all on function public.ops_pt_close_list(text) from public, anon;
revoke all on function public.ops_pt_close_confirm(text, date, jsonb) from public, anon;
revoke all on function public.ops_pt_close_approve(text, uuid, date, jsonb) from public, anon;
revoke all on function public.ops_pt_close_reopen(uuid, text) from public, anon;
grant execute on function public.ops_pt_close_list(text) to authenticated;
grant execute on function public.ops_pt_close_confirm(text, date, jsonb) to authenticated;
grant execute on function public.ops_pt_close_approve(text, uuid, date, jsonb) to authenticated;
grant execute on function public.ops_pt_close_reopen(uuid, text) to authenticated;

-- ───────────────────────── 예약 (같은 이름이면 덮어쓴다) ─────────────────────────
-- 끄기: select cron.unschedule('ops-pt-close-tick');
select cron.schedule('ops-pt-close-tick', '5 1 * * *', $cron$select public._ops_pt_close_tick()$cron$);   -- 10:05 KST
