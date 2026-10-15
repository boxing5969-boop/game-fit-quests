-- 🥊 오삼코치 검수·회원 화면 RPC (2026-10-15 — 설계 결정: 파일럿 + 2주는 코치가 보고 승인한 것만 나간다)
--
--   검수 (지점장 화면 위 '오삼코치 오늘 메시지' 카드)
--     · coach_review_list(날짜)      — 오늘 초안 목록. 본사(super_admin·admin)는 전체, 지점장·코치는 자기 지점만.
--     · coach_review_set(id, 동작)   — approve · unapprove · skip · fallback(기본 문구로) · edit(고쳐서 승인)
--     · coach_review_approve_all()   — 대기 중인 것 한 번에 승인
--   회원 (캐릭터 탭 '내 카드')
--     · get_my_coach_today()         — 오늘 받은 오늘의 목표(또는 복귀 응원) 한 개
--     · coach_mark_opened(id)        — 알림을 눌러 열었으면 opened_at (보조 지표: 푸시로 앱을 연 비율)
--   보낸 뒤(sent)·지난 뒤(expired)는 고칠 수 없다. 길이는 앱 검사와 같은 20·60·90자.

create or replace function public._coach_reviewer_scope(_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- '*' = 전체, 지점 이름 = 그 지점만, null = 권한 없음
  select case
    when public.has_role(_uid, 'super_admin') or public.has_role(_uid, 'admin') then '*'
    when public.has_role(_uid, 'branch_manager') or public.has_role(_uid, 'coach')
      then (select nullif(btrim(p.branch_name), '') from public.profiles p where p.user_id = _uid)
  end
$$;

create or replace function public.coach_review_list(_for_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _scope text;
  _d date := coalesce(_for_date, (now() at time zone 'Asia/Seoul')::date);
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  _scope := public._coach_reviewer_scope(_uid);
  if _scope is null then raise exception 'Not authorized'; end if;

  return jsonb_build_object(
    'for_date', _d,
    'enabled', coalesce((select c.enabled from public.coach_config c where c.id), false),
    'review_required', coalesce((select c.review_required from public.coach_config c where c.id), true),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'kind', m.kind, 'status', m.status, 'source', m.source, 'check_reason', m.check_reason,
               'title', m.title, 'body', m.body, 'detail', m.detail, 'fallback', m.fallback,
               'state', m.facts ->> 'state', 'level_label', m.facts ->> 'level_label',
               'drill', m.facts #>> '{drill,name}',
               'member', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
               'member_name', nullif(btrim(p.name), ''),
               'branch', m.branch_name, 'send_at', m.send_at, 'sent_at', m.sent_at, 'reviewed_at', m.reviewed_at)
             order by case m.status when 'ready' then 0 when 'generating' then 1 when 'approved' then 2 else 3 end,
                      m.kind, p.name)
        from public.coach_messages m
        left join public.profiles p on p.user_id = m.user_id
       where m.for_date = _d
         and m.status in ('generating', 'ready', 'approved', 'sent')
         and (_scope = '*' or m.branch_name = _scope)
    ), '[]'::jsonb));
end;
$$;

create or replace function public.coach_review_set(
  _id uuid, _action text, _title text default null, _body text default null, _detail text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _scope text;
  m public.coach_messages%rowtype;
  _t text;
  _b text;
  _dt text;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  _scope := public._coach_reviewer_scope(_uid);
  if _scope is null then raise exception 'Not authorized'; end if;

  select * into m from public.coach_messages where id = _id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if _scope <> '*' and m.branch_name is distinct from _scope then raise exception 'Not authorized'; end if;
  if m.status not in ('ready', 'approved') then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'status', m.status);
  end if;

  if _action = 'approve' then
    update public.coach_messages
       set status = 'approved', reviewed_by = _uid, reviewed_at = now(), updated_at = now()
     where id = _id;
  elsif _action = 'unapprove' then
    update public.coach_messages
       set status = 'ready', reviewed_by = _uid, reviewed_at = now(), updated_at = now()
     where id = _id;
  elsif _action = 'skip' then
    update public.coach_messages
       set status = 'skipped', reviewed_by = _uid, reviewed_at = now(), updated_at = now()
     where id = _id;
  elsif _action = 'fallback' then
    update public.coach_messages
       set title = m.fallback ->> 'title', body = m.fallback ->> 'body', detail = m.fallback ->> 'detail',
           source = 'fallback', status = 'approved', reviewed_by = _uid, reviewed_at = now(), updated_at = now()
     where id = _id;
  elsif _action = 'edit' then
    _t := btrim(coalesce(_title, ''));
    _b := btrim(coalesce(_body, ''));
    _dt := btrim(coalesce(_detail, ''));
    if _t = '' or _b = '' or _dt = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
    if char_length(_t) > 20 or char_length(_b) > 60 or char_length(_dt) > 90 then
      return jsonb_build_object('ok', false, 'reason', 'too_long');
    end if;
    update public.coach_messages
       set title = _t, body = _b, detail = _dt, source = 'edited', status = 'approved',
           reviewed_by = _uid, reviewed_at = now(), updated_at = now()
     where id = _id;
  else
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.coach_review_approve_all(_for_date date default null, _kind text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _scope text;
  _n integer := 0;
  _d date := coalesce(_for_date, (now() at time zone 'Asia/Seoul')::date);
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  _scope := public._coach_reviewer_scope(_uid);
  if _scope is null then raise exception 'Not authorized'; end if;

  update public.coach_messages m
     set status = 'approved', reviewed_by = _uid, reviewed_at = now(), updated_at = now()
   where m.for_date = _d
     and m.status = 'ready'
     and (_kind is null or m.kind = _kind)
     and (_scope = '*' or m.branch_name = _scope);
  get diagnostics _n = row_count;
  return _n;
end;
$$;

-- 회원: 오늘 받은 오늘의 목표(또는 복귀 응원) — 없으면 null
create or replace function public.get_my_coach_today()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select (
    select jsonb_build_object('id', m.id, 'kind', m.kind, 'title', m.title, 'body', m.body,
                              'detail', m.detail, 'sent_at', m.sent_at)
      from public.coach_messages m
     where m.user_id = auth.uid()
       and m.for_date = (now() at time zone 'Asia/Seoul')::date
       and m.kind in ('daily_goal', 'comeback')
       and m.status = 'sent'
     order by m.sent_at desc
     limit 1)
$$;

-- 회원: 알림을 눌러 열었다 (자기 메시지만, 처음 한 번)
create or replace function public.coach_mark_opened(_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coach_messages
     set opened_at = now()
   where id = _id and user_id = auth.uid() and status = 'sent' and opened_at is null;
$$;

revoke all on function public._coach_reviewer_scope(uuid) from public, anon, authenticated;
revoke all on function public.coach_review_list(date) from public, anon;
revoke all on function public.coach_review_set(uuid, text, text, text, text) from public, anon;
revoke all on function public.coach_review_approve_all(date, text) from public, anon;
revoke all on function public.get_my_coach_today() from public, anon;
revoke all on function public.coach_mark_opened(uuid) from public, anon;
grant execute on function public.coach_review_list(date) to authenticated;
grant execute on function public.coach_review_set(uuid, text, text, text, text) to authenticated;
grant execute on function public.coach_review_approve_all(date, text) to authenticated;
grant execute on function public.get_my_coach_today() to authenticated;
grant execute on function public.coach_mark_opened(uuid) to authenticated;
