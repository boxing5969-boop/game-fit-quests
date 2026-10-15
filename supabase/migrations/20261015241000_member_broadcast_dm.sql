-- 단체 메시지를 메시지 탭에서 DM 처럼 (2026-10-15 대표님: "전체 회원·유효회원에게 보내는 메시지 등등 — 메시지 탭에서 보낼 수 있게, DM 처럼")
--   대상(audience): valid 유효회원 · all 전체 회원 · expired 만료 회원(수강권·PT 기간 끝남) · pt PT 회원
--   보내기 = 회원마다 보낸 사람과의 1:1 대화방(dm_threads)에 메시지 한 통 + 알림함(🔔)·푸시(누르면 그 대화방)
--     · 회원이 답장하면 보통 DM 처럼 그 대화방으로 온다
--     · 보낸 사람을 차단한 회원에게는 보내지 않는다
--   보낼 수 있는 사람은 그대로: 대표님(전체관리자) = 켜진 지점 전체 또는 한 지점 · 지점장 = 자기 지점만.

alter table public.member_broadcasts add column if not exists audience text not null default 'valid';
alter table public.member_broadcasts add column if not exists mode text not null default 'notice';

/** 대상 회원 id — 공통: 가입 승인 · 지도진/테스트/관리 계정 아님 · 지점 범위 */
create or replace function public._broadcast_targets2(p_branch text, p_audience text)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  select p.user_id
    from public.profiles p
   where p.is_approved = true
     and coalesce(p.is_staff, false) = false
     and not coalesce(p.is_test_account, false)
     and (case when p_branch is null then public.is_branch_visible(p.branch_name) else p.branch_name = p_branch end)
     and not exists (select 1 from public.user_roles ur
                      where ur.user_id = p.user_id and ur.role in ('super_admin', 'admin', 'branch_manager', 'coach'))
     and case coalesce(p_audience, 'valid')
           when 'all' then true
           when 'valid' then (p.membership_end >= (now() at time zone 'Asia/Seoul')::date
                              or p.pt_until >= (now() at time zone 'Asia/Seoul')::date)
           when 'expired' then (p.membership_end < (now() at time zone 'Asia/Seoul')::date
                                and coalesce(p.pt_until < (now() at time zone 'Asia/Seoul')::date, true))
           when 'pt' then p.pt_until >= (now() at time zone 'Asia/Seoul')::date
           else false
         end;
$$;
revoke all on function public._broadcast_targets2(text, text) from public, anon, authenticated;

create or replace function public.count_broadcast_targets2(p_branch text default null, p_audience text default 'valid')
returns integer language plpgsql stable security definer set search_path = public as $$
declare v_scope text;
begin
  v_scope := public._broadcast_scope(p_branch);
  if coalesce(p_audience, '') not in ('valid', 'all', 'expired', 'pt') then raise exception '받는 사람 종류가 잘못됐어요'; end if;
  return (select count(*)::int from public._broadcast_targets2(v_scope, p_audience) t where t.user_id <> auth.uid());
end $$;
revoke all on function public.count_broadcast_targets2(text, text) from public, anon;
grant execute on function public.count_broadcast_targets2(text, text) to authenticated;

/** DM 처럼 보내기 — 돌려주는 값 = 받은 회원 수 */
create or replace function public.send_member_dm_broadcast(p_branch text, p_audience text, p_body text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_scope text;
  v_body text := btrim(coalesce(p_body, ''), E' \t\r\n');
  v_preview text;
  v_sender text;
  v_count integer;
  v_now timestamptz := now();
begin
  v_scope := public._broadcast_scope(p_branch);
  if coalesce(p_audience, '') not in ('valid', 'all', 'expired', 'pt') then raise exception '받는 사람 종류가 잘못됐어요'; end if;
  if char_length(v_body) = 0 then raise exception '메시지를 입력해 주세요'; end if;
  if char_length(v_body) > 1000 then raise exception '메시지는 1000자까지 보낼 수 있어요'; end if;
  v_preview := left(regexp_replace(v_body, '\s+', ' ', 'g'), 80);
  if exists (select 1 from public.member_broadcasts b
              where b.sender_id = v_me and b.mode = 'dm' and b.body = v_body
                and b.branch_name is not distinct from v_scope and b.audience = p_audience
                and b.created_at > v_now - interval '10 minutes') then
    raise exception '같은 메시지를 방금 보냈어요 (10분 뒤에 다시 보낼 수 있어요)';
  end if;
  v_sender := coalesce(public._dm_display(v_me), '153복싱짐');

  create temp table _bc_targets on commit drop as
    select t.user_id as uid
      from public._broadcast_targets2(v_scope, p_audience) t
     where t.user_id <> v_me
       and not exists (select 1 from public.dm_blocks b where b.blocker = t.user_id and b.blocked = v_me);

  -- 1) 대화방 (없으면 만든다 — 대표님·지점장이 끼므로 바로 '대화 중')
  insert into public.dm_threads (user_a, user_b, initiator, status, accepted_at)
  select least(v_me, x.uid), greatest(v_me, x.uid), v_me, 'active', v_now from _bc_targets x
  on conflict (user_a, user_b) do nothing;

  create temp table _bc_threads on commit drop as
    select t.id as thread_id, x.uid
      from _bc_targets x
      join public.dm_threads t on t.user_a = least(v_me, x.uid) and t.user_b = greatest(v_me, x.uid);

  -- 2) 메시지
  insert into public.dm_messages (thread_id, sender_id, body, created_at)
  select bt.thread_id, v_me, v_body, v_now from _bc_threads bt;
  get diagnostics v_count = row_count;

  -- 3) 대화방 최신 상태 (보낸 쪽은 읽음)
  update public.dm_threads t
     set status = case when t.status in ('request', 'declined') then 'active' else t.status end,
         accepted_at = coalesce(t.accepted_at, v_now),
         last_message_at = v_now,
         last_sender = v_me,
         last_preview = v_preview,
         a_last_read_at = case when t.user_a = v_me then v_now else t.a_last_read_at end,
         b_last_read_at = case when t.user_b = v_me then v_now else t.b_last_read_at end
   where t.id in (select thread_id from _bc_threads);

  -- 4) 알림함 · 푸시 — 누르면 그 대화방
  insert into public.notifications (user_id, title, body, link)
  select bt.uid, '📩 ' || v_sender || ' 메시지', left(v_body, 300), '/messages/' || bt.thread_id
    from _bc_threads bt;

  insert into public.member_broadcasts (sender_id, branch_name, title, body, link, recipients, audience, mode)
  values (v_me, v_scope, v_preview, v_body, null, v_count, p_audience, 'dm');
  return v_count;
end $$;
revoke all on function public.send_member_dm_broadcast(text, text, text) from public, anon;
grant execute on function public.send_member_dm_broadcast(text, text, text) to authenticated;
