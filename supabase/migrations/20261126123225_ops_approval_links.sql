-- 승인 요청 알림도 누르면 바로 그 자리 (2026-11-26 대표님 「연장근무신청했는데 이것도 클릭하면 바로 할수있게해줘」 · 작업판 myboxer:notifications · docs/features/65)
--
--   ⏱ 연장 근무 신청 · 🔁 수업 대타 요청(ops_entry_save) /office?tab=work → /office?tab=work&b=<지점>&entry=<요청>&day=<날짜>
--   📍 출근 신고 · 이름(ops_duty_report_send)              /office?tab=work → /office?tab=work&b=<지점>&dutyreport=<신고>&day=<날짜>
--     → 근무 탭 「확인할 것」의 그 줄(승인 · 반려 단추)로 내려가 잠깐 빛난다. 이미 처리됐으면 그렇다고 알리고 그날 시트를 연다.
--   받는 사람 · 제목 · 본문 · 저장 규칙은 그대로 — 링크만. 두 함수는 2026-11-26 운영 DB 의 지금 정의
--   (md5 89891c161f9c98b342750c4595629f4e · bc2d3d52398380ff7e30ccf80bee79e5 = 저장소 20261029101624 · 20261112225136) 위에 링크 자리만 고쳤다.
--   _ops_notify_managers_link · _ops_link_branch 는 20261126102924 (알림 바로 그 화면).

create or replace function public.ops_entry_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid := (p->>'staff_id')::uuid;
  v_kind text := p->>'kind';
  v_date date := (p->>'work_date')::date;
  v_branch text := public._ops_branch_of(v_staff);
  v_manage boolean;
  v_hq boolean := public._strategy_hq(v_uid);
  v_mine boolean := public._ops_is_mine(v_uid, v_staff);
  v_status text;
  v_id uuid;
  v_name text;
  v_cover uuid := nullif(p->>'cover_staff_id', '')::uuid;
  v_cover_name text;
  v_min integer := nullif(p->>'minutes', '')::integer;
begin
  if v_branch is null then raise exception '근무자를 찾을 수 없어요'; end if;
  v_manage := public._ops_can_manage(v_uid, v_branch);
  if v_kind not in ('adjust', 'off', 'overtime', 'cover') then raise exception '알 수 없는 기록이에요'; end if;
  if v_date is null then raise exception '날짜를 골라 주세요'; end if;
  select name into v_name from public.ops_staff where id = v_staff;

  if v_kind in ('adjust', 'off') then
    if not v_manage then raise exception '근무 시간은 지점장 · 대표님만 고칠 수 있어요'; end if;
    if v_kind = 'adjust' and v_min is null then raise exception '인정할 시간을 넣어 주세요'; end if;
    update public.ops_day_entries set status = 'canceled'
     where staff_id = v_staff and work_date = v_date and kind in ('adjust', 'off') and status = 'approved';
    v_status := 'approved';
  elsif v_kind = 'overtime' then
    if not (v_mine or v_manage) then raise exception '내 근무만 신청할 수 있어요'; end if;
    if coalesce(v_min, 0) <= 0 then raise exception '연장한 시간을 넣어 주세요'; end if;
    v_status := case when v_hq then 'approved' else 'pending' end;
  else -- cover
    if not (v_mine or v_manage) then raise exception '내 수업만 대타를 요청할 수 있어요'; end if;
    if v_cover is null or v_cover = v_staff then raise exception '대타 코치님을 골라 주세요'; end if;
    if public._ops_branch_of(v_cover) is distinct from v_branch then raise exception '같은 지점 코치님만 대타를 할 수 있어요'; end if;
    if nullif(p->>'start_time', '') is null or nullif(p->>'end_time', '') is null
       or (p->>'end_time')::time <= (p->>'start_time')::time then
      raise exception '대타 수업 시간을 골라 주세요';
    end if;
    select name into v_cover_name from public.ops_staff where id = v_cover;
    v_min := (extract(epoch from ((p->>'end_time')::time - (p->>'start_time')::time)) / 60)::integer;
    v_status := case when v_manage then 'approved' else 'pending' end;
  end if;

  insert into public.ops_day_entries (staff_id, work_date, kind, status, minutes, start_time, end_time, cover_staff_id,
                                      reason, requested_by, decided_by, decided_at)
  values (v_staff, v_date, v_kind, v_status, case when v_kind = 'off' then 0 else v_min end,
          nullif(p->>'start_time', '')::time, nullif(p->>'end_time', '')::time, v_cover,
          nullif(btrim(coalesce(p->>'reason', '')), ''), v_uid,
          case when v_status = 'approved' then v_uid end, case when v_status = 'approved' then now() end)
  returning id into v_id;

  -- 2026-11-26: 승인 요청 알림은 누르면 「확인할 것」의 그 요청(승인 · 반려)으로
  if v_status = 'pending' and v_kind = 'overtime' then
    perform public._ops_notify_managers_link(v_branch, '⏱ 연장 근무 신청',
      format('%s · %s %s분 — 승인해 주세요', v_name, to_char(v_date, 'MM/DD'), v_min),
      '/office?tab=work&b=' || public._ops_link_branch(v_branch) || '&entry=' || v_id::text || '&day=' || v_date::text, true);
  elsif v_status = 'pending' and v_kind = 'cover' then
    perform public._ops_notify_managers_link(v_branch, '🔁 수업 대타 요청',
      format('%s → %s · %s %s~%s', v_name, v_cover_name, to_char(v_date, 'MM/DD'), p->>'start_time', p->>'end_time'),
      '/office?tab=work&b=' || public._ops_link_branch(v_branch) || '&entry=' || v_id::text || '&day=' || v_date::text, false);
  elsif v_status = 'approved' and v_kind = 'cover' then
    perform public._ops_notify((select user_id from public.ops_staff where id = v_cover), '🔁 수업 대타가 정해졌어요',
      format('%s %s~%s · %s 코치님 수업', to_char(v_date, 'MM/DD'), p->>'start_time', p->>'end_time', v_name));
  end if;
  return v_id;
end $$;

create or replace function public.ops_duty_report_send(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid := nullif(p->>'staff_id', '')::uuid;
  v_kind text := nullif(p->>'kind', '');
  v_date date := nullif(p->>'work_date', '')::date;
  v_at time := nullif(p->>'at_time', '')::time;
  v_min integer := nullif(p->>'minutes', '')::integer;
  v_note text := left(nullif(btrim(coalesce(p->>'note', '')), ''), 200);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_now time := (now() at time zone 'Asia/Seoul')::time;
  v_s public.ops_staff;
  v_old uuid;
  v_id uuid;
  v_n integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_s from public.ops_staff where id = v_staff;
  if v_s.id is null or not v_s.active then raise exception '근무자를 찾을 수 없어요'; end if;
  if not public._ops_is_mine(v_uid, v_staff) then raise exception '내 근무만 신고할 수 있어요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = v_s.branch_name and b.enabled) then
    raise exception '운영본부를 켠 지점이 아니에요';
  end if;
  if v_kind is null or v_kind not in ('here', 'early', 'off') then raise exception '무엇을 알릴지 골라 주세요'; end if;
  if v_date is null then raise exception '날짜를 골라 주세요'; end if;
  if v_date > v_today then raise exception '아직 오지 않은 날은 신고할 수 없어요'; end if;
  if v_date < v_today - 14 then raise exception '14일이 지난 날은 지점장님께 말씀해 주세요'; end if;
  if v_kind = 'off' then
    v_at := null;
    v_min := null;
  elsif v_at is null then
    raise exception '시각을 넣어 주세요';
  elsif v_date = v_today and v_at - v_now > interval '5 minutes' then
    raise exception '아직 오지 않은 시각이에요';
  end if;
  if v_min is not null and (v_min < 0 or v_min > 1440) then raise exception '인정 시간이 이상해요'; end if;
  if v_kind = 'here' and public._ops_duty_checked(v_staff, v_date) then
    raise exception '이날은 얼굴 출근이 찍혀 있어요 — 시각이 다르면 지점장님께 말씀해 주세요';
  end if;

  select r.id into v_old from public.ops_duty_reports r
   where r.staff_id = v_staff and r.work_date = v_date and r.kind = v_kind and r.status = 'open';
  if v_old is not null then
    update public.ops_duty_reports set at_time = v_at, minutes = v_min, note = v_note where id = v_old;
    return jsonb_build_object('id', v_old, 'updated', true);
  end if;
  select count(*) into v_n from public.ops_duty_reports r where r.staff_id = v_staff and r.created_at > now() - interval '1 day';
  if v_n >= 10 then raise exception '하루에 10건까지 신고할 수 있어요'; end if;

  insert into public.ops_duty_reports (branch_name, staff_id, work_date, kind, at_time, minutes, note, created_by)
  values (v_s.branch_name, v_staff, v_date, v_kind, v_at, v_min, v_note, v_uid)
  returning id into v_id;

  -- 대표님 · 그 지점 관리자에게(보낸 분 빼고) — 2026-11-26: 누르면 「확인할 것」의 그 신고(승인 · 반려)로
  insert into public.notifications (user_id, title, body, link)
  select u.user_id, '📍 출근 신고 · ' || v_s.name,
         to_char(v_date, 'MM/DD') || ' ' || public._ops_duty_kind_text(v_kind, v_at) || ' — 확인해 주세요',
         '/office?tab=work&b=' || public._ops_link_branch(v_s.branch_name) || '&dutyreport=' || v_id::text || '&day=' || v_date::text
    from (select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
          union
          select m.user_id from public.ops_managers m where m.branch_name is null or m.branch_name = v_s.branch_name) u
   where u.user_id <> v_uid;
  return jsonb_build_object('id', v_id, 'updated', false);
end $$;
