-- PT 수당 2단계 2-4 — 회원 확인: 차감이 잡혔는데 기록이 없으면 회원에게 묻는다(「네, 맞아요」 · 「아니에요」)
--   (2026-11-16 대표님 「2-3적용하고 다음작업가자」 · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「회원 알림」 ·
--    「2단계 제작 계획」 2-4 · 근무 1단계 결정 ⑥ 「회원 차감 알림 + '아니에요' 단추」)
--
--   브로제이에서 PT 가 차감됐는데 그 차감과 짝지을 PT 기록(수업 · 당일취소 · 미참석)이 여섯 시간이 지나도 없으면
--   회원 앱에 「PT 차감 안내」를 보내고, 홈 「PT 수업」 카드에서 묻는다. 기록이 있는 차감은 묻지 않는다(수업 적립 알림이 이미 간다).
--     · 짝짓기 = 화면 matchPtRecord · 자동 기록 _ops_pt_auto_record 와 같은 차례(① 이틀 안의 기록 ② 더 오래된 기록) — 남은 차감만 묻는다.
--     · 「네, 맞아요」 → 담당 코치에게 알림(기록해 주세요). 「아니에요」(한 줄 메모 선택) → 코치 + 지점장 · 대표님에게 알림.
--       지점장 · 대표님이 확인하고 회원에게 답을 보내면 닫힌다. 닫기 전까지 그 차감의 수업은 수당을 보류한다(화면 opsPtPay 「회원 확인 중」).
--     · 묻지 않는 것: 수업권이 끝나 생긴 차감(kind ended) · 켜기 전에 잡힌 차감 · 14일이 지난 차감 · 이미 물은 차감.
--     · 지점마다 켜기(대표님) — 켠 뒤에 잡힌 차감만 묻는다. 묻는 때 = 매일 10:55 ~ 20:55 매시(밤에는 보내지 않는다).
--   새 표 2 · 새 함수 8 · 예약 1 — 기존 표 · 함수 · 예약은 건드리지 않는다. 회원 이름 · 금액은 이 파일에 없다.

-- ───────── 지점마다 켜기 ─────────
create table if not exists public.ops_pt_check_settings (
  branch_name text primary key references public.ops_branches(branch_name),
  check_on boolean not null default false,
  started_at timestamptz,            -- 켠 때 — 이 뒤에 잡힌 차감만 묻는다(다시 켜면 그때부터)
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ops_pt_check_settings enable row level security;
revoke all on public.ops_pt_check_settings from anon, authenticated;

-- ───────── 물은 차감 한 줄 ─────────
create table if not exists public.ops_pt_member_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.ops_pt_events(id) on delete cascade,
  branch_name text not null,
  member_user_id uuid not null,
  work_date date not null,           -- 차감이 잡힌 날(앱이 알아챈 날)
  used integer not null check (used between 1 and 20),   -- 물을 때 짝지을 기록이 없던 횟수
  asked_at timestamptz not null default now(),
  answer text check (answer in ('yes', 'no')),
  answered_at timestamptz,
  note text check (char_length(note) <= 200),            -- 「아니에요」 한 줄(선택)
  reply text check (char_length(reply) <= 300),          -- 지점장 · 대표님이 회원에게 보낸 답
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ops_pt_member_checks_member_idx on public.ops_pt_member_checks (member_user_id, asked_at desc);
create index if not exists ops_pt_member_checks_branch_idx on public.ops_pt_member_checks (branch_name, asked_at desc);
alter table public.ops_pt_member_checks enable row level security;
revoke all on public.ops_pt_member_checks from anon, authenticated;

-- ───────── 한 회원의 짝 없는 차감 ─────────
-- 화면 matchPtRecord · _ops_pt_auto_record 와 같은 창 · 같은 차례. 차감마다 짝지을 기록이 없던 횟수(left_uses — 0 이면 다 맞음).
create or replace function public._ops_pt_check_left(_branch text, _member uuid)
returns table (event_id uuid, left_uses integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_started date;
  v_from date;
  v_sd date[];
  v_st boolean[];
  v_ue uuid[];
  v_uw date[];
  v_ul integer[];
  v_ns integer;
  v_nu integer;
  i integer;
  j integer;
begin
  select s.started_on into v_started from public.ops_pt_settings s where s.branch_name = _branch and s.record_on;
  if v_started is null or _member is null then return; end if;
  v_from := greatest(v_today - 120, v_started - 14);   -- ops_pt_record · 자동 기록과 같은 창
  -- 칸(연속 2회 수업 = 두 칸)
  select coalesce(array_agg(x.d order by x.d, x.c), '{}'::date[]) into v_sd
    from (select s.session_date as d, s.created_at as c
            from public.ops_pt_sessions s
            cross join lateral generate_series(1, greatest(1, s.uses::int)) g
           where s.branch_name = _branch and s.member_user_id = _member and s.status = 'open'
             and s.kind in ('lesson', 'noshow', 'late_cancel') and s.session_date >= v_from) x;
  v_ns := coalesce(array_length(v_sd, 1), 0);
  v_st := array_fill(false, array[greatest(v_ns, 1)]);
  -- 차감(수당에 세는 것만)
  select coalesce(array_agg(e.id order by e.work_date, e.detected_at), '{}'::uuid[]),
         coalesce(array_agg(e.work_date order by e.work_date, e.detected_at), '{}'::date[]),
         coalesce(array_agg(e.used order by e.work_date, e.detected_at), '{}'::integer[])
    into v_ue, v_uw, v_ul
    from public.ops_pt_events e
   where e.branch_name = _branch and e.member_user_id = _member
     and e.status in ('auto', 'confirmed') and e.used > 0
     and e.work_date >= greatest(v_from, v_started);
  v_nu := coalesce(array_length(v_ue, 1), 0);
  -- ① 제때(이틀 안) — 이른 차감부터, 이른 기록부터
  for i in 1 .. v_nu loop
    j := 1;
    while v_ul[i] > 0 and j <= v_ns loop
      if not v_st[j] and v_sd[j] <= v_uw[i] and v_uw[i] - v_sd[j] <= 2 then
        v_st[j] := true;
        v_ul[i] := v_ul[i] - 1;
      end if;
      j := j + 1;
    end loop;
  end loop;
  -- ② 늦은 차감 — 더 오래된 기록
  for i in 1 .. v_nu loop
    j := 1;
    while v_ul[i] > 0 and j <= v_ns loop
      if not v_st[j] and v_sd[j] < v_uw[i] then
        v_st[j] := true;
        v_ul[i] := v_ul[i] - 1;
      end if;
      j := j + 1;
    end loop;
  end loop;
  for i in 1 .. v_nu loop
    event_id := v_ue[i];
    left_uses := v_ul[i];
    return next;
  end loop;
end $$;

-- ───────── 코치 · 지점장 · 대표님에게 알림(링크) ─────────
-- 코치는 「오늘 PT」로(/office?tab=work&pt=today), 관리자는 「근무」 탭으로. 같은 사람에게 두 번 가지 않는다.
create or replace function public._ops_pt_check_notify_staff(_branch text, _coach_user uuid, _managers boolean, _title text, _body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  if _coach_user is not null then
    perform public._ops_pt_book_notify(_coach_user, _title, _body, '/office?tab=work&pt=today');
  end if;
  if not _managers then return; end if;
  for u in
    select x.user_id
      from (select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
            union
            select m.user_id from public.ops_managers m where m.branch_name is null or m.branch_name = _branch) x
     where x.user_id is distinct from _coach_user
  loop
    perform public._ops_pt_book_notify(u.user_id, _title, _body, '/office?tab=work');
  end loop;
end $$;

-- ───────── 묻기 — 매시(10:55 ~ 20:55) ─────────
create or replace function public._ops_pt_check_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  st record;
  m record;
  x record;
  n integer := 0;
  v_new integer;
  v_uses integer;
  v_first date;
begin
  for st in
    select s.branch_name, s.started_on, c.started_at
      from public.ops_pt_settings s
      join public.ops_pt_check_settings c on c.branch_name = s.branch_name
     where s.record_on and c.check_on and c.started_at is not null
  loop
    for m in
      select distinct e.member_user_id as uid
        from public.ops_pt_events e
       where e.branch_name = st.branch_name and e.member_user_id is not null
         and e.status in ('auto', 'confirmed') and e.used > 0 and e.kind <> 'ended'
         and e.work_date >= st.started_on
         and e.detected_at >= greatest(st.started_at, now() - interval '14 days')
         and e.detected_at <= now() - interval '6 hours'
         and not exists (select 1 from public.ops_pt_member_checks k where k.event_id = e.id)
    loop
      v_new := 0;
      v_uses := 0;
      v_first := null;
      for x in
        select l.event_id, l.left_uses, e.work_date
          from public._ops_pt_check_left(st.branch_name, m.uid) l
          join public.ops_pt_events e on e.id = l.event_id
         where l.left_uses > 0 and e.kind <> 'ended'
           and e.detected_at >= greatest(st.started_at, now() - interval '14 days')
           and e.detected_at <= now() - interval '6 hours'
           and not exists (select 1 from public.ops_pt_member_checks k where k.event_id = e.id)
         order by e.work_date, e.detected_at
      loop
        insert into public.ops_pt_member_checks (event_id, branch_name, member_user_id, work_date, used)
        values (x.event_id, st.branch_name, m.uid, x.work_date, least(x.left_uses, 20))
        on conflict (event_id) do nothing;
        if found then
          v_new := v_new + 1;
          v_uses := v_uses + least(x.left_uses, 20);
          v_first := coalesce(v_first, x.work_date);
        end if;
      end loop;
      if v_new > 0 then
        -- 회원마다 한 통(여러 건이면 묶어서)
        perform public._ops_pt_book_notify(m.uid, 'PT 차감 안내',
          case when v_new = 1
               then extract(month from v_first)::int || '월 ' || extract(day from v_first)::int || '일에 PT ' || v_uses
                    || '회 차감이 확인됐어요 — 받으신 수업이 맞는지 알려 주세요'
               else 'PT 차감 ' || v_new || '건이 확인됐어요 — 받으신 수업이 맞는지 알려 주세요' end,
          '/home?ptcheck=1');
        n := n + v_new;
      end if;
    end loop;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_check_tick: %', sqlerrm;
  return -1;
end $$;

-- ───────── 회원 — 내 PT 차감 확인 ─────────
-- state: ask 답을 기다림(아직 짝지을 기록이 없음) · wait 「아니에요」 — 지점에서 확인 중 · closed 지점의 답(사흘 동안)
create or replace function public.pt_deduct_checks()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  b record;
  c record;
  v_open uuid[];
  v_state text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  for b in
    select distinct k.branch_name
      from public.ops_pt_member_checks k
      join public.ops_pt_check_settings s on s.branch_name = k.branch_name and s.check_on
     where k.member_user_id = v_uid and k.asked_at > now() - interval '30 days'
  loop
    select coalesce(array_agg(l.event_id), '{}'::uuid[]) into v_open
      from public._ops_pt_check_left(b.branch_name, v_uid) l
     where l.left_uses > 0;
    for c in
      select k.*, e.status as e_status
        from public.ops_pt_member_checks k
        join public.ops_pt_events e on e.id = k.event_id
       where k.member_user_id = v_uid and k.branch_name = b.branch_name and k.asked_at > now() - interval '30 days'
       order by k.work_date, k.asked_at
    loop
      v_state := case
        when c.answer is null and c.asked_at > now() - interval '14 days'
             and c.e_status in ('auto', 'confirmed') and c.event_id = any(v_open) then 'ask'
        when c.answer = 'no' and c.closed_at is null then 'wait'
        when c.closed_at is not null and c.closed_at > now() - interval '3 days' then 'closed'
      end;
      continue when v_state is null;
      v_out := v_out || jsonb_build_object('id', c.id, 'work_date', c.work_date, 'used', c.used, 'state', v_state,
                                           'note', c.note, 'reply', c.reply, 'answered_at', c.answered_at, 'closed_at', c.closed_at);
    end loop;
  end loop;
  return v_out;
end $$;

-- ───────── 회원 — 답하기 ─────────
create or replace function public.pt_deduct_answer(p_id uuid, p_answer text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_pt_member_checks%rowtype;
  v_coach uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_who text;
  v_when text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p_answer is null or p_answer not in ('yes', 'no') then raise exception '답을 골라 주세요'; end if;
  select * into c from public.ops_pt_member_checks where id = p_id for update;
  if not found or c.member_user_id <> v_uid then raise exception '확인할 PT 차감을 찾지 못했어요'; end if;
  if c.answer is not null then raise exception '이미 답해 주셨어요'; end if;
  if not exists (select 1 from public.ops_pt_check_settings s where s.branch_name = c.branch_name and s.check_on) then
    raise exception '지금은 답할 수 없어요 — 1:1 문의로 알려 주세요';
  end if;
  if c.asked_at < now() - interval '14 days' then raise exception '답할 수 있는 기간이 지났어요 — 1:1 문의로 알려 주세요'; end if;
  if p_answer = 'yes' then v_note := null; end if;
  if char_length(v_note) > 200 then raise exception '200자 안으로 적어 주세요'; end if;

  update public.ops_pt_member_checks set answer = p_answer, answered_at = now(), note = v_note where id = c.id;

  select s.user_id into v_coach
    from public.ops_pt_events e join public.ops_staff s on s.id = e.coach_staff_id
   where e.id = c.event_id;
  v_who := public._ops_pt_member_name(c.branch_name, c.member_user_id);
  v_when := extract(month from c.work_date)::int || '/' || extract(day from c.work_date)::int;
  if p_answer = 'yes' then
    -- 담당 코치가 없으면 지점장 · 대표님이 기록한다
    perform public._ops_pt_check_notify_staff(c.branch_name, v_coach, v_coach is null,
      'PT 차감 회원 확인 · ' || v_who,
      v_when || ' 차감 ' || c.used || '회 — 회원님이 받은 수업이 맞다고 했어요 · 기록해 주세요');
  else
    perform public._ops_pt_check_notify_staff(c.branch_name, v_coach, true,
      'PT 차감 「아니에요」 · ' || v_who,
      v_when || ' 차감 ' || c.used || '회 — 회원님이 아니라고 했어요' || coalesce(' · “' || left(v_note, 80) || '”', '')
        || ' · 확인하고 회원님께 답해 주세요');
  end if;
  return jsonb_build_object('ok', true, 'answer', p_answer);
end $$;

-- ───────── 코치 · 지점장 · 대표님 — 목록 · 설정 ─────────
-- 코치(그 지점 PT 위탁) = 본인 담당 차감의 확인만 · 지점장 · 대표님 = 지점 전체. 120일 안 + 아직 닫지 않은 「아니에요」.
create or replace function public.ops_pt_member_check_list(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_staff uuid;
  s public.ops_pt_check_settings%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  v_staff := public._ops_pt_my_staff(v_uid, p_branch);
  if not v_manage and v_staff is null then raise exception 'PT 기록을 볼 수 없어요'; end if;
  select * into s from public.ops_pt_check_settings where branch_name = p_branch;
  return jsonb_build_object(
    'on', coalesce(s.check_on, false),
    'started_at', s.started_at,
    'can_set', public._strategy_hq(v_uid),
    'can_close', v_manage,
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'event_id', k.event_id, 'member_user_id', k.member_user_id, 'work_date', k.work_date, 'used', k.used,
               'coach_staff_id', e.coach_staff_id, 'asked_at', k.asked_at, 'answer', k.answer, 'answered_at', k.answered_at,
               'note', k.note, 'reply', k.reply, 'closed_at', k.closed_at,
               'closed_by_name', case when k.closed_by is null then null
                                      else (select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '관리자')
                                              from public.profiles p where p.user_id = k.closed_by) end)
             order by k.asked_at desc)
        from public.ops_pt_member_checks k
        join public.ops_pt_events e on e.id = k.event_id
       where k.branch_name = p_branch
         and (v_manage or e.coach_staff_id = v_staff)
         and (k.asked_at > now() - interval '120 days' or (k.answer = 'no' and k.closed_at is null))), '[]'::jsonb));
end $$;

-- 「아니에요」에 답하고 닫기 — 지점장 · 대표님만(코치 담당 차감에 대한 이의라서). 답은 회원에게 알림으로 간다.
create or replace function public.ops_pt_member_check_close(p_id uuid, p_reply text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_pt_member_checks%rowtype;
  v_reply text := btrim(coalesce(p_reply, ''));
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into c from public.ops_pt_member_checks where id = p_id for update;
  if not found then raise exception '회원 확인을 찾지 못했어요'; end if;
  if not public._ops_can_manage(v_uid, c.branch_name) then raise exception '지점장 · 대표님만 답할 수 있어요'; end if;
  if c.answer is distinct from 'no' then raise exception '회원님이 「아니에요」라고 한 것만 답할 수 있어요'; end if;
  if c.closed_at is not null then raise exception '이미 답했어요'; end if;
  if char_length(v_reply) < 2 then raise exception '회원님께 보낼 답을 적어 주세요'; end if;
  if char_length(v_reply) > 300 then raise exception '300자 안으로 적어 주세요'; end if;
  update public.ops_pt_member_checks set reply = v_reply, closed_by = v_uid, closed_at = now() where id = c.id;
  perform public._ops_pt_book_notify(c.member_user_id, 'PT 차감 확인 결과',
    extract(month from c.work_date)::int || '월 ' || extract(day from c.work_date)::int || '일 차감 — ' || v_reply,
    '/home?ptcheck=1');
  return jsonb_build_object('ok', true);
end $$;

-- 켜기 · 끄기 — 대표님만. 켜면 그때부터 잡힌 차감을 묻는다(다시 켜도 그때부터).
create or replace function public.ops_pt_check_setting_set(p_branch text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.ops_pt_check_settings%rowtype;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 켜고 끌 수 있어요'; end if;
  if p_on is null then raise exception '켜기 · 끄기를 골라 주세요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = p_branch and b.enabled) then
    raise exception '지점을 찾지 못했어요';
  end if;
  insert into public.ops_pt_check_settings as t (branch_name, check_on, started_at, updated_by, updated_at)
  values (p_branch, p_on, case when p_on then now() end, v_uid, now())
  on conflict (branch_name) do update
     set check_on = excluded.check_on,
         started_at = case when excluded.check_on and not t.check_on then now() else t.started_at end,
         updated_by = v_uid,
         updated_at = now()
  returning * into s;
  return jsonb_build_object('on', s.check_on, 'started_at', s.started_at);
end $$;

-- ───────── 권한 ─────────
revoke all on function public._ops_pt_check_left(text, uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_check_notify_staff(text, uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public._ops_pt_check_tick() from public, anon, authenticated;
revoke all on function public.pt_deduct_checks() from public, anon;
revoke all on function public.pt_deduct_answer(uuid, text, text) from public, anon;
revoke all on function public.ops_pt_member_check_list(text) from public, anon;
revoke all on function public.ops_pt_member_check_close(uuid, text) from public, anon;
revoke all on function public.ops_pt_check_setting_set(text, boolean) from public, anon;
grant execute on function public.pt_deduct_checks() to authenticated;
grant execute on function public.pt_deduct_answer(uuid, text, text) to authenticated;
grant execute on function public.ops_pt_member_check_list(text) to authenticated;
grant execute on function public.ops_pt_member_check_close(uuid, text) to authenticated;
grant execute on function public.ops_pt_check_setting_set(text, boolean) to authenticated;

-- ───────── 예약 — 10:55 ~ 20:55 (KST) 매시 ─────────
select cron.schedule('ops-pt-check-tick', '55 1-11 * * *', $cron$select public._ops_pt_check_tick()$cron$);
