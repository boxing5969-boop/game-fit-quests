-- 🏢 지점 회의실 2단계 — 음성 · 카메라 회의 입장권 (2026-10-27 대표님 "다음 단계 작업하자" · 보고서 2단계, Cloudflare RealtimeKit)
--   · office_meetings.rtk_meeting_id — 회의마다 RealtimeKit 회의 하나 (Edge Function office-call 이 처음 들어오는 사람 때 만든다)
--   · office_call_participants — 회의 · 사람마다 RealtimeKit 참가자 하나 (다시 들어오면 입장권만 새로 — 같은 사람을 또 만들면 거절된다)
--     Edge Function(서버 키)만 읽고 쓴다. 앱 사용자는 못 본다.
--   · office_call_ticket(회의) — 부른 사람이 그 회의 음성방에 들어갈 수 있나 + 보일 이름 · 역할 (Edge Function 이 부른 사람 토큰으로)
--   · office_call_end_check(회의) — 회의를 끝낸 대표님 · 지점장이 음성방도 닫을 때 (RealtimeKit 회의 번호를 돌려준다)
--   · office_call_ready() — 설정(internal_sync_config 'office_call')이 끝났나. 끝나기 전에는 회의 화면에 음성 막대가 안 보인다
--   새 칸 · 새 표 · 새 함수만 더한다 (기존 함수 동작은 그대로). 녹음 · 녹화 없음. 영상 서비스 API 토큰은 Edge Function 시크릿에만 있다.

alter table public.office_meetings add column if not exists rtk_meeting_id text;

create table if not exists public.office_call_participants (
  meeting_id uuid not null references public.office_meetings(id) on delete cascade,
  user_id uuid not null,
  rtk_participant_id text not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
alter table public.office_call_participants enable row level security;
revoke all on table public.office_call_participants from public, anon, authenticated;

create or replace function public.office_call_ticket(p_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_me jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  m := public._office_meeting_for(v_uid, p_meeting);
  if m.closed_at is not null then raise exception '이미 끝난 회의예요'; end if;
  v_me := public._office_display(v_uid);
  return jsonb_build_object(
    'meeting_id', m.id,
    'branch', m.branch_name,
    'title', m.title,
    'rtk_meeting_id', m.rtk_meeting_id,
    'role', public._office_role(v_uid, m.branch_name),
    'user_id', v_uid,
    'name', btrim(coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '')));
end $$;

create or replace function public.office_call_end_check(p_meeting uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  m := public._office_meeting_for(v_uid, p_meeting);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then
    raise exception '음성 회의는 대표님 · 지점장님이 닫을 수 있어요';
  end if;
  return m.rtk_meeting_id;
end $$;

-- 음성 회의를 켰나 — internal_sync_config 'office_call'(계정 · 앱 번호)이 있으면. 회의 화면이 '음성 참여' 막대를 보일지 (값은 돌려주지 않는다)
create or replace function public.office_call_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.internal_sync_config where key = 'office_call');
$$;

revoke all on function public.office_call_ticket(uuid) from public, anon;
revoke all on function public.office_call_end_check(uuid) from public, anon;
revoke all on function public.office_call_ready() from public, anon;
grant execute on function public.office_call_ticket(uuid) to authenticated;
grant execute on function public.office_call_end_check(uuid) to authenticated;
grant execute on function public.office_call_ready() to authenticated;
