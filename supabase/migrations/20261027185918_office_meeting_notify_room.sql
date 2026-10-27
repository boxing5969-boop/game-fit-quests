-- 🏢 지점 회의실 — 회의 열림 알림을 누르면 바로 회의 화면(/office/room)으로
--   (2026-10-27 대표님 "그래 그렇게하자" — 지금까지는 사무실(/office)로 가서 '회의실 들어가기'를 한 번 더 눌러야 했다)
--   office_open_meeting 의 알림 링크만 '/office' → '/office/room'. 나머지는 DB 지금 정의 그대로(20261027140013 과 같음).
--   회의 화면은 들어오면 참석(office_join_meeting). 대표님 기기에 다른 지점이 골라져 있어도 회의가 열린 지점으로 연다(화면 쪽).

create or replace function public.office_open_meeting(p_branch text, p_title text, p_agenda text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_branch text; v_id uuid; v_title text := btrim(coalesce(p_title, ''));
  v_agenda text[]; v_me jsonb;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  if public._office_role(v_uid, v_branch) is distinct from 'host' then
    raise exception '회의는 대표님 · 지점장님이 열 수 있어요';
  end if;
  if v_title = '' then raise exception '안건을 한 줄 적어 주세요'; end if;
  if char_length(v_title) > 80 then raise exception '안건은 80자까지 적을 수 있어요'; end if;
  select coalesce(array_agg(left(btrim(x), 60) order by ord), '{}') into v_agenda
    from unnest(coalesce(p_agenda, '{}')) with ordinality as t(x, ord)
   where btrim(coalesce(x, '')) <> '' and ord <= 5;
  if exists (select 1 from public.office_meetings where branch_name = v_branch and closed_at is null) then
    raise exception '이미 열린 회의가 있어요';
  end if;

  insert into public.office_meetings (branch_name, title, agenda, opened_by)
  values (v_branch, v_title, v_agenda, v_uid) returning id into v_id;
  insert into public.office_meeting_attendees (meeting_id, user_id) values (v_id, v_uid);
  v_me := public._office_display(v_uid);
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (v_id, v_uid, 'system', coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '') || '님이 회의를 열었어요');

  insert into public.notifications (user_id, title, body, link)
  select pp.user_id, '지금 지점 회의가 열렸어요',
         left(v_title || ' · ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''), 120),
         '/office/room'
    from public._office_people(v_branch) pp
   where pp.user_id <> v_uid;

  perform public._office_ping(v_branch, 'meeting');
  return v_id;
end $$;

revoke all on function public.office_open_meeting(text, text, text[]) from public, anon;
grant execute on function public.office_open_meeting(text, text, text[]) to authenticated;
