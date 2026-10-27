-- 🏢 지점 회의실 — 줌 · 구글 미트 링크 (2026-10-27 대표님 "그렇게하자": 지도진끼리는 앱 음성 회의, 바깥 분이 함께하는 회의는 줌 링크 — 둘 다)
--   · office_meetings.video_url — 이 회의의 줌 · 구글 미트 주소 (https · zoom.us · zoom.com · meet.google.com 만)
--   · _office_video_url(글) — 붙여 넣은 글(줌 초대 글 통째도)에서 첫 링크만 골라 검사 (화면 lib/meetingLink.ts 와 같은 규칙)
--   · office_set_meeting_link(회의, 링크) — 대표님 · 지점장, 열린 회의에서만. 빈 값이면 뺀다. 넣거나 빼면 채팅에 안내 한 줄
--   · office_state — meeting.video_url + (대표님 · 지점장에게만) last_video_url = 그 지점이 마지막에 쓴 링크(회의 열 때 미리 채움)
--   회의실은 그 지점 지도진 + 대표님만 들어온다 — 링크도 그분들만 본다. 새 칸 · 새 함수 + office_state 에 두 값만 더한다.

alter table public.office_meetings add column if not exists video_url text;

create or replace function public._office_video_url(p_text text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := btrim(coalesce(p_text, '')); v_url text; v_host text;
begin
  if v = '' then return null; end if;
  -- 초대 글을 통째로 붙여 넣어도 첫 링크만 (주소에 쓰는 글자까지만 — 붙어 있는 한글은 뺀다)
  v_url := substring(v from '[Hh][Tt][Tt][Pp][Ss]?://[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+');
  if v_url is null then
    -- 'zoom.us/j/…' · 'meet.google.com/…' 처럼 https 없이 넣은 것
    v_url := substring(v from '(?:[A-Za-z0-9-]+\.)*(?:[Zz][Oo][Oo][Mm]\.(?:us|com)|meet\.google\.com)/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]*');
    if v_url is not null then v_url := 'https://' || v_url; end if;
  end if;
  if v_url is null then raise exception '줌 · 구글 미트 링크를 넣어 주세요'; end if;
  v_url := regexp_replace(v_url, '[.,;:!?)]+$', '');
  v_url := regexp_replace(v_url, '^[Hh][Tt][Tt][Pp][Ss]?://', 'https://');
  if char_length(v_url) > 500 then raise exception '링크가 너무 길어요'; end if;
  v_host := lower(substring(v_url from '^https://([^/?#:]+)'));
  if v_host is null or not (v_host in ('zoom.us', 'zoom.com', 'meet.google.com')
                            or v_host like '%.zoom.us' or v_host like '%.zoom.com') then
    raise exception '줌 · 구글 미트 링크만 넣을 수 있어요';
  end if;
  return v_url;
end $$;

/** 화상회의 링크 넣기 · 바꾸기 · 빼기 — 대표님 · 지점장, 열린 회의에서만 */
create or replace function public.office_set_meeting_link(p_meeting uuid, p_url text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_url text; v_me jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  m := public._office_meeting_for(v_uid, p_meeting);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then
    raise exception '화상회의 링크는 대표님 · 지점장님이 넣어요';
  end if;
  if m.closed_at is not null then raise exception '이미 끝난 회의예요'; end if;
  v_url := public._office_video_url(p_url);
  if v_url is not distinct from m.video_url then return v_url; end if;
  update public.office_meetings set video_url = v_url where id = m.id;
  v_me := public._office_display(v_uid);
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (m.id, v_uid, 'system', coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '') ||
    case when v_url is null then '님이 화상회의 링크를 뺐어요'
         when v_url ~* '^https://meet\.google\.com' then '님이 구글 미트 링크를 넣었어요'
         else '님이 줌 링크를 넣었어요' end);
  perform public._office_ping(m.branch_name, 'meeting');
  return v_url;
end $$;

-- office_state — DB 지금 정의(20261027140013) 그대로 + meeting.video_url · last_video_url
create or replace function public.office_state(p_branch text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_meeting public.office_meetings;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  if v_branch is null then raise exception '켜진 지점 회의실이 없어요'; end if;
  perform public._office_assign_seats(v_branch);
  select * into v_meeting from public.office_meetings where branch_name = v_branch and closed_at is null;

  return jsonb_build_object(
    'branch', v_branch,
    'label', btrim(replace(v_branch, '153복싱짐', '')),
    'topic', (select topic from public.office_branches where branch_name = v_branch),
    'me', v_uid,
    'role', public._office_role(v_uid, v_branch),
    'branches', case when public._strategy_hq(v_uid)
                     then coalesce((select jsonb_agg(b.branch_name order by b.branch_name) from public.office_branches b where b.enabled), '[]'::jsonb)
                     else jsonb_build_array(v_branch) end,
    'people', coalesce((
      select jsonb_agg(public._office_display(pp.user_id) || jsonb_build_object(
               'hq', pp.hq,
               'host', public._office_role(pp.user_id, v_branch) = 'host',
               'seat', case when pp.hq then 'boss'
                            else (select os.seat from public.office_seats os where os.branch_name = v_branch and os.user_id = pp.user_id) end,
               'status', coalesce((select st.status from public.office_status st
                                    where st.user_id = pp.user_id and st.updated_at > now() - interval '3 hours'), 'on'),
               'style', (select cp.parts_json ->> 'style'
                           from public.member_character_assignments a
                           join public.character_presets cp on cp.id = a.preset_id
                          where a.user_id = pp.user_id and a.is_active
                          order by a.updated_at desc nulls last limit 1))
             order by pp.hq desc, (select coalesce(nullif(btrim(p.name), ''), p.nickname) from public.profiles p where p.user_id = pp.user_id))
        from public._office_people(v_branch) pp), '[]'::jsonb),
    -- 회의 열 때 미리 채울 지난번 링크 (회의를 여는 대표님 · 지점장에게만)
    'last_video_url', case when public._office_role(v_uid, v_branch) = 'host' then
      (select om.video_url from public.office_meetings om
        where om.branch_name = v_branch and om.video_url is not null
        order by om.opened_at desc limit 1) end,
    'meeting', case when v_meeting.id is null then null else jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'agenda', to_jsonb(v_meeting.agenda),
      'opened_at', v_meeting.opened_at,
      'opened_by', public._office_display(v_meeting.opened_by),
      'video_url', v_meeting.video_url,
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'first_joined_at', a.first_joined_at,
                                            'last_joined_at', a.last_joined_at, 'in_room', a.left_at is null)
                         order by a.first_joined_at)
          from public.office_meeting_attendees a where a.meeting_id = v_meeting.id), '[]'::jsonb)) end
  );
end $$;

revoke all on function public._office_video_url(text) from public, anon, authenticated;
revoke all on function public.office_set_meeting_link(uuid, text) from public, anon;
grant execute on function public.office_set_meeting_link(uuid, text) to authenticated;
