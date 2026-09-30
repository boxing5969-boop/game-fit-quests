-- 2026-09-30 메시지(DM) 검수 보완 — 적대적 검수에서 실제로 재현된 것만 고친다 (20260930073749_dm_direct_messages 다음).
--
--   1. 전화번호로 계정을 연결(merge_linked_account)할 때 병합 루프가 dm_threads 의 initiator·user_a·user_b 를
--      차례로 바꾸다가 '짝 순서(user_a < user_b)'·'보낸 사람은 짝 중 하나' 확인에 걸려, 그 대화를 상대 쪽까지 통째로 지웠다.
--      → 짝 순서는 트리거가 맞춘다(읽음·나감 시각도 함께 자리를 바꾼다). '보낸 사람은 짝 중 하나'는 함수들이 지키므로 제약은 뺀다.
--      merge_linked_account 자체는 건드리지 않는다.
--   2. 계정이 지워져도 신고(대화 사본)는 남긴다 — 신고한 사람·신고된 사람은 on delete set null.
--   3. 읽음 = 실제로 돌려준 가장 최근 메시지 시각까지 (예전엔 now() — 같은 순간 들어온 못 본 메시지까지 읽음 처리).
--   4. 같은 사람이 동시에 여러 번 보내 한도(분당 20 · 하루 500 · 새 대화 10)를 넘지 않게 보내는 사람별로 줄을 세운다.
--   5. 차단은 메시지를 주고받을 수 있는 사람에게만 (아무 id 나 차단해 설정 화면에서 다른 지점 사람 이름을 알아내던 틈).
--      dm_peer 는 없는 계정·다른 지점·차단을 모두 '열 수 없음(unavailable)' 한 가지로 답한다.
--   6. 새 메시지 목록: '메시지 요청 받기'를 끈 회원은 closed 로 알려 흐리게 보인다 (누르면 막히는 줄이었다).
--   7. 지워진 계정의 신고에는 제한을 걸거나 풀 수 없다고 알린다.

-- ── 1. 계정 병합에도 대화가 지워지지 않게 ─────────────────────────────
alter table public.dm_threads drop constraint dm_threads_initiator_in_pair;

create or replace function public._dm_threads_keep_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_at timestamptz;
begin
  -- user_a < user_b 를 유지한다. 자리를 바꾸면 그 사람의 읽음·나감 시각도 같이 옮긴다
  if new.user_a > new.user_b then
    v_id := new.user_a; new.user_a := new.user_b; new.user_b := v_id;
    v_at := new.a_last_read_at; new.a_last_read_at := new.b_last_read_at; new.b_last_read_at := v_at;
    v_at := new.a_cleared_at; new.a_cleared_at := new.b_cleared_at; new.b_cleared_at := v_at;
  end if;
  return new;
end;
$$;

create trigger dm_threads_keep_order
before insert or update of user_a, user_b on public.dm_threads
for each row execute function public._dm_threads_keep_order();

revoke all on function public._dm_threads_keep_order() from public, anon, authenticated;

-- ── 2. 신고는 계정이 지워져도 남긴다 ──────────────────────────────────
alter table public.dm_reports alter column reporter drop not null;
alter table public.dm_reports alter column reported drop not null;
alter table public.dm_reports drop constraint dm_reports_reporter_fkey;
alter table public.dm_reports drop constraint dm_reports_reported_fkey;
alter table public.dm_reports
  add constraint dm_reports_reporter_fkey foreign key (reporter) references auth.users(id) on delete set null;
alter table public.dm_reports
  add constraint dm_reports_reported_fkey foreign key (reported) references auth.users(id) on delete set null;

-- ── 3~7. 함수 ─────────────────────────────────────────────────────
create or replace function public.dm_get_thread(p_thread uuid, p_before bigint default null, p_limit integer default 40)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_other uuid;
  v_cleared timestamptz;
  v_my_read timestamptz;
  v_other_read timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_msgs jsonb;
  v_more boolean;
  v_reason text;
  v_suspended timestamptz;
  v_seen_max timestamptz;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into v_t from public.dm_threads t where t.id = p_thread;
  if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
    raise exception '대화를 찾을 수 없어요';
  end if;
  if v_t.user_a = v_me then
    v_other := v_t.user_b; v_cleared := v_t.a_cleared_at; v_my_read := v_t.a_last_read_at; v_other_read := v_t.b_last_read_at;
  else
    v_other := v_t.user_a; v_cleared := v_t.b_cleared_at; v_my_read := v_t.b_last_read_at; v_other_read := v_t.a_last_read_at;
  end if;

  select count(*) > v_limit into v_more
    from (select 1 from public.dm_messages m
           where m.thread_id = v_t.id
             and (v_cleared is null or m.created_at > v_cleared)
             and (p_before is null or m.id < p_before)
           limit v_limit + 1) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'mine', q.sender_id = v_me, 'body', q.body, 'created_at', q.created_at
         ) order by q.id), '[]'::jsonb),
         max(q.created_at)
    into v_msgs, v_seen_max
    from (select m.id, m.sender_id, m.body, m.created_at
            from public.dm_messages m
           where m.thread_id = v_t.id
             and (v_cleared is null or m.created_at > v_cleared)
             and (p_before is null or m.id < p_before)
           order by m.id desc
           limit v_limit) q;

  -- 최신 쪽을 봤으면 읽음 — 실제로 돌려준 가장 최근 메시지 시각까지만 (2026-09-30 검수: 예전엔 now() 라
  -- 같은 순간 들어온, 아직 못 본 메시지까지 읽은 것으로 쳤다). 새 메시지가 있을 때만 쓴다.
  if p_before is null and v_seen_max is not null
     and (v_my_read is null or v_my_read < v_seen_max) then
    update public.dm_threads t
       set a_last_read_at = case when t.user_a = v_me then greatest(coalesce(t.a_last_read_at, v_seen_max), v_seen_max) else t.a_last_read_at end,
           b_last_read_at = case when t.user_b = v_me then greatest(coalesce(t.b_last_read_at, v_seen_max), v_seen_max) else t.b_last_read_at end
     where t.id = v_t.id;
  end if;

  v_reason := public._dm_thread_reason(v_me, v_t);
  select s.suspended_until into v_suspended from public.dm_settings s
   where s.user_id = v_me and s.suspended_until > now();

  return jsonb_build_object(
    'thread', jsonb_build_object('id', v_t.id,
                                 'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
                                 'i_am_initiator', v_t.initiator = v_me,
                                 'created_at', v_t.created_at),
    'peer', public._dm_person(v_other),
    'can_send', v_reason is null,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason),
    'suspended_until', v_suspended,
    'needs_response', v_t.status = 'request' and v_t.initiator <> v_me,
    'i_blocked', exists (select 1 from public.dm_blocks b where b.blocker = v_me and b.blocked = v_other),
    'other_read_at', case when v_t.status = 'active' then v_other_read end,
    'messages', v_msgs,
    'has_more', v_more
  );
end;
$$;

create or replace function public.dm_send(p_thread uuid default null, p_to uuid default null, p_body text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_body text;
  v_reason text;
  v_status text;
  v_msg public.dm_messages%rowtype;
  v_recent integer;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  -- 같은 사람이 동시에 여러 번 보내도 한도(분당 20 · 하루 500 · 새 대화 10)를 넘지 않게 한 줄로 세운다
  perform pg_advisory_xact_lock(hashtext('dm_send'), hashtext(v_me::text));
  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) = 0 then
    raise exception '메시지를 입력해 주세요';
  end if;
  if char_length(v_body) > 1000 then
    raise exception '메시지는 1000자까지 보낼 수 있어요';
  end if;

  if p_thread is not null then
    select * into v_t from public.dm_threads t where t.id = p_thread for update;
    if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
      raise exception '대화를 찾을 수 없어요';
    end if;
  else
    if p_to is null then
      raise exception '받는 사람을 골라 주세요';
    end if;
    if p_to = v_me then
      raise exception '%', public._dm_reason_text('self');
    end if;
    select * into v_t from public.dm_threads t
     where t.user_a = least(v_me, p_to) and t.user_b = greatest(v_me, p_to)
       for update;
    if v_t.id is null then
      v_reason := public._dm_start_reason(v_me, p_to);
      if v_reason is not null then
        raise exception '%', public._dm_reason_text(v_reason);
      end if;
      -- 회원끼리는 요청함으로, 코치님·본사가 끼면 바로 대화
      v_status := case when public._dm_kind(v_me) = 'member' and public._dm_kind(p_to) = 'member'
                       then 'request' else 'active' end;
      insert into public.dm_threads (user_a, user_b, initiator, status, accepted_at)
      values (least(v_me, p_to), greatest(v_me, p_to), v_me, v_status,
              case when v_status = 'active' then now() end)
      on conflict (user_a, user_b) do nothing;
      -- 두 사람이 동시에 만들었으면 먼저 생긴 대화로 이어 간다
      select * into v_t from public.dm_threads t
       where t.user_a = least(v_me, p_to) and t.user_b = greatest(v_me, p_to)
         for update;
    end if;
  end if;

  v_reason := public._dm_thread_reason(v_me, v_t);
  if v_reason is not null then
    raise exception '%', public._dm_reason_text(v_reason);
  end if;

  -- 너무 빠른 연속 전송·도배 막기
  select count(*) into v_recent from public.dm_messages m
   where m.sender_id = v_me and m.created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception '메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요';
  end if;
  select count(*) into v_recent from public.dm_messages m
   where m.sender_id = v_me and m.created_at > now() - interval '1 day';
  if v_recent >= 500 then
    raise exception '오늘 보낼 수 있는 메시지(500개)를 모두 보냈어요';
  end if;

  insert into public.dm_messages (thread_id, sender_id, body)
  values (v_t.id, v_me, v_body)
  returning * into v_msg;

  -- 받은 요청에 답장하면 수락 · 내가 보낸 시각까지는 읽은 것으로
  update public.dm_threads t
     set status = case when t.status in ('request', 'declined') and t.initiator <> v_me then 'active' else t.status end,
         accepted_at = case when t.status in ('request', 'declined') and t.initiator <> v_me then now() else t.accepted_at end,
         last_message_at = v_msg.created_at,
         last_sender = v_me,
         last_preview = left(regexp_replace(v_body, '\s+', ' ', 'g'), 80),
         a_last_read_at = case when t.user_a = v_me then v_msg.created_at else t.a_last_read_at end,
         b_last_read_at = case when t.user_b = v_me then v_msg.created_at else t.b_last_read_at end
   where t.id = v_t.id
  returning * into v_t;

  return jsonb_build_object(
    'thread_id', v_t.id,
    'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
    'message', jsonb_build_object('id', v_msg.id, 'mine', true, 'body', v_msg.body, 'created_at', v_msg.created_at)
  );
end;
$$;

create or replace function public.dm_block(p_user uuid, p_block boolean default true)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_user is null or p_user = v_me then
    raise exception '잘못된 요청이에요';
  end if;
  if coalesce(p_block, true) then
    -- 차단은 메시지를 주고받을 수 있는 사람에게만 — 대화가 있거나, 같은 지점이거나, 본사 (2026-09-30 검수:
    -- 아무 id 나 차단한 뒤 설정 화면에서 다른 지점 사람 이름·지점을 알아낼 수 있었다)
    if not exists (select 1 from public.dm_threads t
                    where t.user_a = least(v_me, p_user) and t.user_b = greatest(v_me, p_user))
       and public._dm_kind(v_me) is distinct from 'hq'
       and not exists (select 1 from public.profiles me
                         join public.profiles o on o.user_id = p_user
                        where me.user_id = v_me
                          and nullif(btrim(me.branch_name), '') is not null
                          and o.branch_name = me.branch_name) then
      raise exception '차단할 수 없는 회원이에요';
    end if;
    if not exists (select 1 from public.profiles p where p.user_id = p_user) then
      raise exception '회원을 찾을 수 없어요';
    end if;
    insert into public.dm_blocks (blocker, blocked) values (v_me, p_user) on conflict do nothing;
  else
    delete from public.dm_blocks b where b.blocker = v_me and b.blocked = p_user;
  end if;
  return jsonb_build_object('user_id', p_user, 'blocked', coalesce(p_block, true));
end;
$$;

create or replace function public.dm_peer(p_user uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_reason text;
  v_person jsonb;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_user is null then
    raise exception '받는 사람을 골라 주세요';
  end if;
  v_person := public._dm_person(p_user);
  if v_person is null then
    -- 없는 계정도 '열 수 없음'으로 똑같이 답한다 (있는지 없는지 알려 주지 않는다)
    return jsonb_build_object('user_id', p_user, 'thread_id', null, 'status', null, 'can_open', false,
                              'can_send', false, 'reason', 'unavailable', 'reason_text', public._dm_reason_text('unavailable'),
                              'peer', null);
  end if;
  -- 대화가 이미 있으면 그 대화 기준, 없으면 새 대화 규칙. 다른 지점·차단 등으로 열 수 없는 사람은 정보를 돌려주지 않는다
  select * into v_t from public.dm_threads t
   where t.user_a = least(v_me, p_user) and t.user_b = greatest(v_me, p_user);
  if v_t.id is not null then
    v_reason := public._dm_thread_reason(v_me, v_t);
  else
    v_reason := public._dm_start_reason(v_me, p_user);
    if v_reason in ('other_branch', 'target_unavailable', 'unavailable', 'self', 'not_member') then
      -- 대화를 열 수 없는 사람 — 버튼을 숨기는 데만 쓰고 자세한 정보는 돌려주지 않는다.
      -- 다른 지점·없는 계정·차단은 모두 'unavailable' 한 가지로 답한다 (누가 어디 있는지 알려 주지 않게)
      if v_reason in ('other_branch', 'target_unavailable') then
        v_reason := 'unavailable';
      end if;
      return jsonb_build_object('user_id', p_user, 'thread_id', null, 'status', null, 'can_open', false,
                                'can_send', false, 'reason', v_reason, 'reason_text', public._dm_reason_text(v_reason),
                                'peer', null);
    end if;
  end if;
  return jsonb_build_object(
    'user_id', p_user,
    'thread_id', v_t.id,
    'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
    'i_am_initiator', case when v_t.id is null then null else v_t.initiator = v_me end,
    'can_open', v_t.id is not null or v_reason is null
                or v_reason in ('change_credentials', 'you_blocked', 'too_many_requests', 'suspended'),
    'can_send', v_reason is null,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason),
    'peer', v_person
  );
end;
$$;

create or replace function public.dm_people(p_search text default null, p_limit integer default 40)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_all boolean;
  v_branch text;
  v_pat text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_rows jsonb;
  v_reason text;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  v_kind := public._dm_kind(v_me);
  v_all := v_kind = 'hq';
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  v_reason := public._dm_self_reason(v_me);
  if v_kind is null or (not v_all and nullif(btrim(v_branch), '') is null) then
    return jsonb_build_object('branch', v_branch, 'all_branches', false, 'rows', '[]'::jsonb,
                              'reason', coalesce(v_reason, 'not_member'),
                              'reason_text', public._dm_reason_text(coalesce(v_reason, 'not_member')));
  end if;
  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    v_pat := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- 사람마다 _dm_kind·_dm_display 를 부르면 전 지점(본사) 목록이 2초 가까이 걸려서, 같은 규칙을 한 번에 계산한다.
  -- 규칙은 _dm_kind(누구인가) · _dm_display(보이는 이름)와 같아야 한다 (롤백 테스트로 전체 계정 대조).
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id,
           'display', c.disp,
           'kind', c.kind,
           'branch', c.branch_name,
           'rank', case when c.kind = 'coach' then 'champion' else lower(coalesce(c.current_rank, 'white')) end,
           'level', coalesce(c.current_level, 1),
           'avatar_url', c.avatar_url,
           'thread_id', c.thread_id,
           -- 회원끼리 새 대화인데 상대가 '메시지 요청 받기'를 꺼 둠 — 목록에서 흐리게 (누르면 막히는 줄)
           'closed', v_kind = 'member' and c.kind = 'member' and c.thread_id is null and c.allow_requests is false
         ) order by c.ord_kind, c.ord_app, c.last_at desc nulls last, c.disp), '[]'::jsonb)
    into v_rows
    from (
      select k.user_id, k.branch_name, k.avatar_url, k.kind, k.disp,
             mp.current_rank::text as current_rank, mp.current_level,
             t.id as thread_id, ds.allow_requests,
             case k.kind when 'coach' then 0 when 'member' then 1 else 2 end as ord_kind,
             case when u.last_sign_in_at is not null then 0 else 1 end as ord_app,
             la.last_at
        from (
          select b.*,
                 case when b.kind = 'coach' then
                        btrim(coalesce(nullif(btrim(b.name), ''), nullif(btrim(b.nickname), ''), '') || ' ' ||
                              case when right(b.title, 1) = '님' then b.title else b.title || '님' end)
                      else coalesce(nullif(btrim(b.nickname), ''), nullif(btrim(b.name), ''), '익명 복서')
                 end as disp
            from (
              select p.user_id, p.branch_name, p.avatar_url, p.name, p.nickname, p.is_test_account,
                     coalesce(nullif(btrim(p.staff_title), ''),
                              case when rr.has_bm then '지점장' when rr.has_coach then '코치' end, '코치') as title,
                     case
                       when rr.has_hq then 'hq'
                       when coalesce(p.is_staff, false) or rr.has_coach then 'coach'
                       when coalesce(p.is_approved, false) and not coalesce(p.is_test_account, false)
                            and (p.membership_end is not null
                                 or exists (select 1 from public.attendance_logs a
                                             where a.user_id = p.user_id and a.method in ('broj', 'face'))) then 'member'
                       when coalesce(p.is_test_account, false) and coalesce(p.is_approved, false) then 'member'
                     end as kind
                from public.profiles p
                left join lateral (
                  select coalesce(bool_or(ur.role in ('super_admin', 'admin')), false) as has_hq,
                         coalesce(bool_or(ur.role in ('coach', 'branch_manager')), false) as has_coach,
                         coalesce(bool_or(ur.role = 'branch_manager'), false) as has_bm
                    from public.user_roles ur where ur.user_id = p.user_id
                ) rr on true
               where p.user_id <> v_me
                 and (v_all or p.branch_name = v_branch)
            ) b
        ) k
        left join public.member_progress mp on mp.user_id = k.user_id
        left join auth.users u on u.id = k.user_id
        left join public.dm_settings ds on ds.user_id = k.user_id
        left join public.dm_threads t on t.user_a = least(v_me, k.user_id) and t.user_b = greatest(v_me, k.user_id)
        left join lateral (
          select max(a.checked_in_at) as last_at from public.attendance_logs a where a.user_id = k.user_id
        ) la on true
       where k.kind is not null
         and (v_all or k.kind <> 'hq')
         and (v_all or not coalesce(k.is_test_account, false))
         and not exists (select 1 from public.dm_blocks bl
                          where (bl.blocker = v_me and bl.blocked = k.user_id)
                             or (bl.blocker = k.user_id and bl.blocked = v_me))
         and (v_pat is null or k.disp ilike v_pat escape '\')
       order by ord_kind, ord_app, la.last_at desc nulls last, k.disp
       limit v_limit
    ) c;

  return jsonb_build_object(
    'branch', v_branch,
    'all_branches', v_all,
    'rows', v_rows,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason)
  );
end;
$$;

create or replace function public.dm_admin_resolve(p_report uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_r public.dm_reports%rowtype;
  v_until timestamptz;
begin
  if v_me is null or public._dm_kind(v_me) is distinct from 'hq' then
    raise exception '본사 계정만 처리할 수 있어요';
  end if;
  if p_action is null or p_action not in ('dismiss', 'suspend7', 'suspend30', 'lift') then
    raise exception '처리 방법을 골라 주세요';
  end if;
  select * into v_r from public.dm_reports r where r.id = p_report for update;
  if v_r.id is null then
    raise exception '신고를 찾을 수 없어요';
  end if;
  if p_action <> 'dismiss' and v_r.reported is null then
    raise exception '계정이 지워진 회원이라 제한을 걸거나 풀 수 없어요';
  end if;
  if p_action in ('suspend7', 'suspend30') then
    v_until := now() + case when p_action = 'suspend7' then interval '7 days' else interval '30 days' end;
    insert into public.dm_settings as s (user_id, suspended_until, updated_at)
    values (v_r.reported, v_until, now())
    on conflict (user_id) do update
      set suspended_until = greatest(coalesce(s.suspended_until, now()), excluded.suspended_until),
          updated_at = now();
  elsif p_action = 'lift' then
    update public.dm_settings s set suspended_until = null, updated_at = now() where s.user_id = v_r.reported;
  end if;
  update public.dm_reports r
     set status = 'resolved', action = p_action, resolved_by = v_me, resolved_at = now(),
         note = left(nullif(btrim(coalesce(p_note, '')), ''), 300)
   where r.id = v_r.id;
  return jsonb_build_object('report_id', v_r.id, 'status', 'resolved', 'action', p_action,
                            'suspended_until', (select case when s.suspended_until > now() then s.suspended_until end
                                                  from public.dm_settings s where s.user_id = v_r.reported));
end;
$$;