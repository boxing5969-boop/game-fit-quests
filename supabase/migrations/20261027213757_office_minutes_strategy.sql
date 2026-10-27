-- 🏢 지점 회의실 3단계 — 회의록 → 전략 회의실 지시 · 못 온 분께 회의 요약 (2026-10-27 대표님 "다음단계진행할까?" · 보고서 3단계)
--   회의를 끝낼 때(대표님 · 지점장) 고른 대로 — 끝내기 시트(src/components/office/OfficeMeeting.tsx EndMeetingSheet):
--     ① 오삼코치 3줄 요약 — Edge Function office-summary(Haiku)가 office_save_summary(…, 'ai') 로 남긴다. 회의록 · 지시 · 요약 알림에 붙는다.
--     ② 정한 것 → 전략 회의실 '지시' 한 건 (office_wrap_up) — 요청 = 정한 것 번호 목록, 상황 = 회의 정보 + 3줄 요약, 대상 = 지점 지도진 모두.
--        코치님들이 '확인했어요' — 안 누르면 다음 날 09:00 재알림(strategy_remind_unacked 그대로). 지시 카드에서 '회의록 보기'.
--     ③ 못 온 분(회의에 한 번도 안 들어온 지점 지도진 + 대표님)께 '못 오신 회의 요약' 알림 → 회의록(/office?minutes=<회의>).
--        같은 분은 ② 의 새 지시 알림을 따로 받지 않는다 (알림 하나 — 회의록에서 '확인하러 가기').
--   끝낼 때 못 한 것은 회의록에서 대표님 · 지점장이 나중에 할 수 있다(같은 함수 — 지시 · 알림은 회의마다 한 번).
--   새 칸 · 새 함수만 더한다 (기존 office_* · strategy_* 함수는 그대로). 채팅 원문은 늘 office_messages 에만 있다(요약만 저장).

alter table public.office_meetings add column if not exists summary text[];
alter table public.office_meetings add column if not exists summary_by text check (summary_by is null or summary_by in ('ai', 'host'));
alter table public.office_meetings add column if not exists summary_at timestamptz;
alter table public.office_meetings add column if not exists directive_id uuid references public.strategy_items(id) on delete set null;
alter table public.office_meetings add column if not exists recap_at timestamptz;
alter table public.office_meetings add column if not exists recap_to integer;

/** 못 온 분 — 그 지점 회의실 사람(지점 지도진 + 대표님) 중 이 회의에 한 번도 들어오지 않은 분 */
create or replace function public._office_absent(_meeting uuid)
returns table(user_id uuid, hq boolean) language sql stable security definer set search_path = public as $$
  select pp.user_id, pp.hq
    from public.office_meetings m
    cross join lateral public._office_people(m.branch_name) pp
   where m.id = _meeting
     and not exists (select 1 from public.office_meeting_attendees a where a.meeting_id = m.id and a.user_id = pp.user_id);
$$;

/** '42분' · '1시간 5분' (화면 officeDuration 과 같은 모양) */
create or replace function public._office_duration_label(_from timestamptz, _to timestamptz)
returns text language sql stable set search_path = public as $$
  select case when x.m >= 60 then (x.m / 60) || '시간' || case when x.m % 60 > 0 then ' ' || (x.m % 60) || '분' else '' end
              else x.m || '분' end
    from (select greatest(1, round(extract(epoch from (coalesce(_to, now()) - _from)) / 60)::int) as m) x;
$$;

/** 회의 정리 현황 — 요약 · 정한 것 수 · 전략 회의실 지시(확인 n/n) · 못 온 분 · 요약 알림 (그 지점 회의실 사람만) */
create or replace function public.office_recap(p_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_dir jsonb;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if m.directive_id is not null then
    select jsonb_build_object(
             'id', i.id,
             'targets', (select count(*) from public._strategy_branch_staff(i.branch_name) s
                          where s.user_id <> i.author_id and (i.target_user_ids is null or s.user_id = any (i.target_user_ids))),
             'acked', (select count(*) from public.strategy_acks a
                         join public._strategy_branch_staff(i.branch_name) s on s.user_id = a.user_id
                        where a.item_id = i.id and a.acked_at is not null and a.user_id <> i.author_id
                          and (i.target_user_ids is null or a.user_id = any (i.target_user_ids))),
             -- 내가 아직 '확인했어요'를 안 누른 받는 사람인가
             'to_ack', v_uid <> i.author_id
                       and exists (select 1 from public._strategy_branch_staff(i.branch_name) s where s.user_id = v_uid)
                       and (i.target_user_ids is null or v_uid = any (i.target_user_ids))
                       and not exists (select 1 from public.strategy_acks a where a.item_id = i.id and a.user_id = v_uid and a.acked_at is not null))
      into v_dir
      from public.strategy_items i
     where i.id = m.directive_id and i.deleted_at is null;
  end if;

  return jsonb_build_object(
    'meeting_id', m.id,
    'closed', m.closed_at is not null,
    'host', public._office_role(v_uid, m.branch_name) = 'host',
    'summary', case when coalesce(cardinality(m.summary), 0) = 0 then null else to_jsonb(m.summary) end,
    'summary_by', m.summary_by,
    'summary_at', m.summary_at,
    'decisions', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind = 'decision' and om.deleted_at is null),
    'talk', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind <> 'system' and om.deleted_at is null),
    'directive', v_dir,
    'recap_at', m.recap_at,
    'recap_to', m.recap_to,
    'absent', coalesce((
      select jsonb_agg(public._office_display(x.user_id)
                       order by x.hq, (select coalesce(nullif(btrim(p.name), ''), p.nickname) from public.profiles p where p.user_id = x.user_id))
        from public._office_absent(m.id) x), '[]'::jsonb)
  );
end $$;

/** 3줄 요약 남기기 · 바꾸기 · 지우기(빈 값) — 대표님 · 지점장. p_by 'ai' = 오삼코치(office-summary 가 부른 사람 토큰으로 부른다) */
create or replace function public.office_save_summary(p_meeting uuid, p_lines text[], p_by text default 'host')
returns text[] language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_lines text[];
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then
    raise exception '회의 요약은 대표님 · 지점장님이 남겨요';
  end if;
  select coalesce(array_agg(s.x order by s.ord), '{}') into v_lines
    from (select left(regexp_replace(btrim(t.x), '\s+', ' ', 'g'), 120) as x, t.ord
            from unnest(coalesce(p_lines, '{}')) with ordinality as t(x, ord)
           where btrim(coalesce(t.x, '')) <> ''
           order by t.ord
           limit 3) s;
  update public.office_meetings
     set summary = case when cardinality(v_lines) = 0 then null else v_lines end,
         summary_by = case when cardinality(v_lines) = 0 then null when p_by = 'ai' then 'ai' else 'host' end,
         summary_at = case when cardinality(v_lines) = 0 then null else now() end
   where id = m.id;
  perform public._office_ping(m.branch_name, 'recap');
  return v_lines;
end $$;

/** 회의 마무리 — 끝난 회의에서 대표님 · 지점장. ② 정한 것 → 전략 회의실 지시 · ③ 못 온 분께 요약 알림. 회의마다 한 번씩만. */
create or replace function public.office_wrap_up(p_meeting uuid, p_directive boolean default true, p_recap boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); m public.office_meetings; v_me jsonb; v_label text;
  v_decisions text[]; v_n integer; v_att integer;
  v_recap_ids uuid[] := '{}'; v_recap integer := 0; v_recap_new boolean := false;
  v_dir uuid; v_dir_new boolean := false;
  v_situation text; v_request text; v_body text;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then
    raise exception '회의 마무리는 대표님 · 지점장님이 해요';
  end if;
  -- 두 분이 동시에 눌러도 한 번만
  select * into m from public.office_meetings where id = m.id for update;
  if m.closed_at is null then raise exception '회의를 끝낸 다음에 보낼 수 있어요'; end if;

  v_me := public._office_display(v_uid);
  v_label := btrim(replace(m.branch_name, '153복싱짐', ''));
  select coalesce(array_agg(om.body order by om.created_at, om.id), '{}') into v_decisions
    from public.office_messages om where om.meeting_id = m.id and om.kind = 'decision' and om.deleted_at is null;
  v_n := cardinality(v_decisions);
  v_dir := m.directive_id;
  -- 보낸 지시를 전략 회의실에서 지웠으면 다시 보낼 수 있다
  if v_dir is not null and not exists (select 1 from public.strategy_items i where i.id = v_dir and i.deleted_at is null) then
    v_dir := null;
  end if;

  -- ③ 받을 분부터 정한다 — 같은 분이 ② 알림을 또 받지 않게
  if coalesce(p_recap, false) and m.recap_at is null then
    select coalesce(array_agg(x.user_id), '{}') into v_recap_ids
      from public._office_absent(m.id) x where x.user_id <> v_uid;
  end if;

  -- ② 정한 것 → 전략 회의실 지시
  if coalesce(p_directive, false) and v_dir is null and v_n > 0 then
    v_att := (select count(*) from public.office_meeting_attendees a where a.meeting_id = m.id);
    v_situation := to_char(m.opened_at at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') || ' 지점 회의 · 참석 ' || v_att || '명 · '
                   || public._office_duration_label(m.opened_at, m.closed_at)
                   || coalesce(E'\n' || (select string_agg('· ' || l, E'\n' order by o) from unnest(m.summary) with ordinality as s(l, o)), '');
    v_request := (select string_agg(o || '. ' || d, E'\n' order by o) from unnest(v_decisions) with ordinality as t(d, o));
    insert into public.strategy_items (branch_name, author_id, kind, title, body, data)
    values (m.branch_name, v_uid, 'directive', left('회의에서 정한 것 · ' || m.title, 120), '',
            jsonb_build_object(
              'situation', left(v_situation, 600),
              'request', left(v_request, 3000),
              'target', v_label || ' 지도진 모두',
              'meeting_id', m.id,
              'meeting_title', m.title,
              'meeting_at', m.opened_at))
    returning id into v_dir;
    -- 글쓴이는 바로 확인한 것으로 (strategy_save 와 같다)
    insert into public.strategy_acks (item_id, user_id, read_at, acked_at) values (v_dir, v_uid, now(), now())
    on conflict do nothing;
    insert into public.notifications (user_id, title, body, link)
    select s.user_id,
           '📌 새 지시 · ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''),
           left('회의에서 정한 것 ' || v_n || '가지 · ' || m.title, 120),
           '/messages?tab=strategy'
      from public._strategy_branch_staff(m.branch_name) s
     where s.user_id <> v_uid and not (s.user_id = any (v_recap_ids));
    update public.office_meetings set directive_id = v_dir where id = m.id;
    v_dir_new := true;
  end if;

  -- ③ 못 오신 분께 요약 알림 (못 온 분이 없어도 '보냄 0' 으로 남겨 다시 묻지 않는다)
  if coalesce(p_recap, false) and m.recap_at is null then
    v_body := case
      when coalesce(cardinality(m.summary), 0) > 0 then array_to_string(m.summary, ' ')
      when v_n > 0 then '정한 것 ' || v_n || '가지 — ' || array_to_string(v_decisions[1:2], ' / ')
      else '회의록에서 나눈 이야기를 볼 수 있어요' end;
    insert into public.notifications (user_id, title, body, link)
    select r.uid, left('못 오신 회의 요약 · ' || m.title, 80), left(v_body, 150), '/office?minutes=' || m.id
      from unnest(v_recap_ids) as r(uid);
    get diagnostics v_recap = row_count;
    update public.office_meetings set recap_at = now(), recap_to = v_recap where id = m.id;
    v_recap_new := true;
  end if;

  perform public._office_ping(m.branch_name, 'recap');
  return jsonb_build_object('directive_id', v_dir, 'directive_new', v_dir_new, 'recap_new', v_recap_new, 'recap_to', v_recap);
end $$;

revoke all on function public._office_absent(uuid) from public, anon, authenticated;
revoke all on function public._office_duration_label(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.office_recap(uuid) from public, anon;
revoke all on function public.office_save_summary(uuid, text[], text) from public, anon;
revoke all on function public.office_wrap_up(uuid, boolean, boolean) from public, anon;
grant execute on function public.office_recap(uuid) to authenticated;
grant execute on function public.office_save_summary(uuid, text[], text) to authenticated;
grant execute on function public.office_wrap_up(uuid, boolean, boolean) to authenticated;
