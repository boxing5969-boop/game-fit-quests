-- 알림을 누르면 바로 그 화면 (2026-11-26 대표님 「마이복서 153 내용 누르면 바로 그 부분으로 이동하게 해줘 —
--   현재 근무 메뉴로는 가는데 PT 확인 메뉴까지는 못 가네」 · 작업판 myboxer:notifications · docs/features/65)
--
--   ① PT 기록 · 이틀 넘은 확인 필요(_ops_pt_overdue)      /office?tab=work → /office?tab=work&pt=check&b=<지점>
--        → 그 지점 PT 코치 카드 'PT' 탭 「확인 필요」(확인할 코치가 여럿이면 '확인할 것')
--   ② 📍 출근 기록 없음 · 이름(ops_duty_tick 관리자 알림)  /office?tab=work → /office?tab=work&b=<지점>&staff=<근무자 카드>&day=<날짜>
--        → 그 코치의 그날 시트
--   ③ 🎉 새 회원 · 자동 등록(notify_auto_member_joined)    /manager → /manager/member/<회원> (10분 안에 여러 명으로 합쳐지면 /manager)
--
--   받는 사람 · 제목 · 본문 · 예약은 그대로 — 링크만 바뀐다. 세 함수는 2026-11-26 운영 DB 의 지금 정의
--   (pg_get_functiondef md5 ef7f32471b0aa3f1ef9258e4b96411be · fc4461d286f334709bbde09685557186 · f3a6d69f8b061912ef2d6c4d5ec94855
--    = 저장소 20261113000026 · 20261112225136 · 20261019170000 과 같음) 위에 링크 자리만 고쳤다.
--   지점 b = '153복싱짐 '을 뗀 이름을 %로 바꾼 글자(링크 규칙 notifications_link_internal: 빈칸 금지) — 화면 lib/opsLink matchOpsBranch.
--   이미 와 있던 알림은 화면이 같은 링크로 올려 읽는다(lib/notifications upgradeNotificationLink).

-- 링크에 넣는 지점 — '153복싱짐 ' · 빈칸을 빼고 UTF-8 바이트마다 %XX ("153복싱짐 선릉역점" → %EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90)
create or replace function public._ops_link_branch(_branch text)
returns text language sql stable set search_path = public as $$
  select regexp_replace(upper(encode(convert_to(
           regexp_replace(regexp_replace(coalesce(_branch, ''), '^153복싱짐\s*', ''), '\s+', '', 'g'),
           'UTF8'), 'hex')), '(..)', '%\1', 'g');
$$;
revoke all on function public._ops_link_branch(text) from public, anon, authenticated;

-- 지점 관리자 알림 + 링크 — 받는 사람은 _ops_notify_managers 와 같다(대표님 · admin · 그 지점 ops_managers). 그쪽을 바꾸면 여기도.
--   링크가 규칙에 안 맞으면 근무 탭 첫 화면으로(알림 자체가 막히지 않게)
create or replace function public._ops_notify_managers_link(_branch text, _title text, _body text, _link text, _hq_only boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select u.user_id, _title, coalesce(_body, ''),
         case when char_length(coalesce(_link, '')) between 1 and 300
                   and _link ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$' then _link
              else '/office?tab=work' end
    from (
      select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
      union
      select m.user_id from public.ops_managers m
       where not _hq_only and (m.branch_name is null or m.branch_name = _branch)
    ) u
   where u.user_id is not null;
$$;
revoke all on function public._ops_notify_managers_link(text, text, text, text, boolean) from public, anon, authenticated;

-- ① PT 기록 · 이틀 넘은 확인 필요 — 20261113000026 정의에서 알림 한 줄만(링크)
create or replace function public._ops_pt_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_miss integer;
  v_wait integer;
  v_extra integer;
  v_rows integer;
begin
  for r in select st.branch_name, st.started_on, st.auto_record as auto from public.ops_pt_settings st where st.record_on and st.notify_on
  loop
    -- 이틀 넘게 '수업이었는지' 답이 없는 입장(회원 · 날짜)
    select count(*) into v_miss from (
      select distinct l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d
        from public.attendance_logs l
        join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                              and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
       where l.branch_name = r.branch_name
         and l.checked_in_at >= (r.started_on::timestamp at time zone 'Asia/Seoul')
         and l.checked_in_at < ((v_today - case when r.auto then 2 else 1 end)::timestamp at time zone 'Asia/Seoul')
         and not coalesce(l.is_duplicate, false)) a
     where not exists (select 1 from public.ops_pt_sessions s
                        where s.branch_name = r.branch_name and s.member_user_id = a.user_id
                          and s.session_date = a.d and s.status = 'open');
    -- 아침 10시: 사흘 전까지의 것(이틀이 꽉 지난 것)만 본다
    --   차감 대기       = 사흘 전까지의 수업 가운데 차감이 아직 안 잡힌 것
    --   사유 없는 차감 = 사흘 전까지 잡힌 차감 가운데, 사흘 전까지의 기록(시작 앞 기록 · 자동 기록 포함)으로 설명이 안 되는 것
    select coalesce(sum(greatest(b.c_old - greatest(b.d - b.c_pre, 0), 0)), 0)::int,
           coalesce(sum(greatest(coalesce(o.d_old, 0) - b.c_pre - b.c_old, 0)), 0)::int
      into v_wait, v_extra
      from public._ops_pt_balance(r.branch_name, null, r.started_on, v_today - 3) b
      left join (
        select coalesce(x.member_user_id::text, 'name:' || x.member_name) as k, sum(x.used)::int as d_old
          from public.ops_pt_events x
         where x.branch_name = r.branch_name and x.status in ('auto', 'confirmed')
           and x.work_date >= r.started_on and x.work_date <= v_today - 3
         group by 1) o on o.k = b.member_key;

    if v_miss + v_wait + v_extra > 0 then
      insert into public.ops_pt_notices (kind, ref, user_id)
      values ('overdue', r.branch_name || ':' || v_today::text, '00000000-0000-0000-0000-000000000000')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        -- 2026-11-26: 누르면 그 지점 PT 코치 카드 'PT' 탭 「확인 필요」로
        perform public._ops_notify_managers_link(r.branch_name, 'PT 기록 · 이틀 넘은 확인 필요',
          concat_ws(' · ',
            replace(r.branch_name, '153복싱짐 ', ''),
            case when v_miss > 0 then '기록 없는 입장 ' || v_miss || '건' end,
            case when v_wait > 0 then '차감 대기 ' || v_wait || '건' end,
            case when v_extra > 0 then '사유 없는 차감 ' || v_extra || '회' end),
          '/office?tab=work&pt=check&b=' || public._ops_link_branch(r.branch_name));
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_overdue: %', sqlerrm;
  return -1;
end $$;

-- ② 출근 알림 — 20261112225136 정의에서 관리자 알림 한 줄만(링크). 코치 알림(&duty=<날짜>)은 그대로
create or replace function public.ops_duty_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_tm time := (now() at time zone 'Asia/Seoul')::time;
  v_nm integer := extract(hour from (now() at time zone 'Asia/Seoul'))::int * 60 + extract(minute from (now() at time zone 'Asia/Seoul'))::int;
  v_first time;
  v_fm integer;
  v_rows integer;
begin
  for r in
    select s.id, s.name, s.user_id, s.branch_name, st.coach_after_min, st.manager_after_min
      from public.ops_duty_settings st
      join public.ops_branches b on b.branch_name = st.branch_name and b.enabled
      join public.ops_staff s on s.branch_name = st.branch_name and s.active and s.checkin_required
                             and s.kind in ('parttime', 'employee', 'intern')
     where st.nudge_on and st.started_on <= v_today
  loop
    select min(g.start_time) into v_first from public._ops_duty_segments(r.id, v_today) g;
    continue when v_first is null or v_first > v_tm;
    v_fm := extract(hour from v_first)::int * 60 + extract(minute from v_first)::int;
    continue when v_nm < v_fm + r.coach_after_min;
    continue when public._ops_duty_checked(r.id, v_today);
    continue when exists (select 1 from public.ops_day_entries e
                           where e.staff_id = r.id and e.work_date = v_today and e.kind in ('adjust', 'off') and e.status = 'approved');
    continue when exists (select 1 from public.ops_duty_reports x
                           where x.staff_id = r.id and x.work_date = v_today and x.status in ('open', 'approved'));
    if r.user_id is not null and v_nm < v_fm + 360 then
      insert into public.ops_duty_notices (kind, staff_id, work_date) values ('coach', r.id, v_today) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id, '⏰ 출근 기록이 아직 없어요',
                left(v_first::text, 5) || ' 근무예요 — 와 있다면 눌러서 알려 주세요(얼굴 인식이 안 됐을 수 있어요)',
                '/office?tab=work&duty=' || v_today::text);
        n := n + 1;
      end if;
    end if;
    if v_nm >= v_fm + r.manager_after_min and v_nm < v_fm + 480 then
      insert into public.ops_duty_notices (kind, staff_id, work_date) values ('manager', r.id, v_today) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        -- 2026-11-26: 누르면 그 코치의 그날 시트로
        perform public._ops_notify_managers_link(r.branch_name, '📍 출근 기록 없음 · ' || r.name,
          to_char(v_today, 'MM/DD') || ' ' || left(v_first::text, 5) || ' 근무 · ' || r.manager_after_min ||
          '분이 지나도 출근 기록 · 신고가 없어요',
          '/office?tab=work&b=' || public._ops_link_branch(r.branch_name) || '&staff=' || r.id::text || '&day=' || v_today::text);
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning 'ops_duty_tick: %', sqlerrm;
  return -1;
end $$;

-- ③ 새 회원 · 자동 등록 — 20261019170000 정의에서 링크만: 한 명이면 그 회원 화면, 여러 명으로 합쳐지면 관리 첫 화면
create or replace function public.notify_auto_member_joined(_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_branch text;
  v_name text;
  v_title text := '🎉 새 회원 · 자동 등록';
  v_tail text := ' — 브로제이에 등록된 회원이라 앱 계정이 자동으로 만들어졌어요. 보통은 따로 승인할 것이 없어요 (승인 대기에 보이면 승인만 눌러 주세요)';
  r record;
begin
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_name
    from public.profiles p where p.user_id = _member;

  for r in
    select x.uid from (
      select ur.user_id as uid from public.user_roles ur where ur.role = 'super_admin'
      union
      select ur.user_id
        from public.user_roles ur
        join public.profiles sp on sp.user_id = ur.user_id
       where ur.role in ('branch_manager', 'coach') and v_branch is not null and sp.branch_name = v_branch
    ) x
    where x.uid <> _member
  loop
    update public.notifications n
       set body = v_name || '님 등 여러 명' || v_tail,
           link = '/manager'
     where n.id = (select n2.id from public.notifications n2
                    where n2.user_id = r.uid and n2.title = v_title and n2.created_at > now() - interval '10 minutes'
                    order by n2.created_at desc limit 1);
    if not found then
      insert into public.notifications (user_id, title, body, link)
      values (r.uid, v_title, v_name || '님' || v_tail, '/manager/member/' || _member::text);
    end if;
  end loop;
exception when others then
  null;
end $$;
