-- 동료에게 응원 보내기 업그레이드 (2026-10-16 대표님 승인: "니가 추천해주는대로 하고 tv에는 띄우지말자")
--   기획안: Claude Docs '동료에게 응원 보내기 업그레이드 기획안'
--   1) 받은 사람 알림 — 알림함 + 휴대폰 알림(그날 받은 응원 3번째까지, 그다음은 알림함에만).
--      내정보 '응원 알림 받기'(profiles.cheer_notify)를 끄면 보내지 않는다.
--   2) 한도 — 스티커·한마디 응원은 하루 10번, 같은 동료에게 하루 1번 (타이틀매치 박수는 예전 규칙 그대로)
--   3) 보상 — 보낸 사람 리스펙트 +5 · 하루 첫 응원 챔피언 머니 +30 / 받은 사람 리스펙트 +1
--   4) 같은 지점 회원끼리 (본사는 켜 둔 지점 회원) · 한마디 금지어 거르기
--   5) 받을 사람 고르기 get_cheer_candidates — 지금 운동 중 → 오늘 다녀간 동료 → 최근 출석 순,
--      오늘 이미 보낸 동료 표시, 상황 추천(생일·승급·오랜만의 복귀)
--   6) 받은 응원함 get_my_received_cheers + '고마워요 153' thank_cheer (보낸 사람에게 알림)
--   7) 라이센스 '받은 응원' get_member_cheer_summary
--   TV 에는 띄우지 않는다.

alter table public.boxing_cheers add column if not exists thanked_at timestamptz;
alter table public.profiles add column if not exists cheer_notify boolean not null default true;

-- 한마디 금지어 (띄어쓰기를 지워도 걸리게)
create or replace function public._cheer_has_bad_word(p text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(p, ''), '\s', '', 'g')
         ~* '(씨발|시발|씨바|씨빨|ㅅㅂ|ㅆㅂ|병신|븅신|ㅂㅅ|ㅄ|개새|새끼|좆|존나|졸라|지랄|ㅈㄹ|닥쳐|꺼져|미친놈|미친년|엿먹|느금|니미|썅|fuck|shit|bitch)';
$$;

-- 1~4) 응원 보내기
create or replace function public.send_boxing_cheer(
  p_receiver_user_id uuid,
  p_cheer_type text,
  p_message text default null,
  p_source_type text default null,
  p_source_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_total_today integer := 0;
  v_to_receiver_today integer := 0;
  v_respect integer := 0;
  v_receiver_gems integer := 0;
  v_sender_gems integer := 0;
  v_cheer_id uuid := gen_random_uuid();
  v_idem text;
  v_receiver_exists boolean;
  v_sticker_mode boolean := p_cheer_type in ('sticker', 'comment');
  v_hq boolean;
  v_sender_branch text;
  v_receiver_branch text;
  v_msg text := left(btrim(coalesce(p_message, '')), 120);
  v_pos integer;
  v_sticker text;
  v_note text;
  v_sender_name text;
  v_recv_today integer;
  v_first boolean := false;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_receiver_user_id is null then raise exception 'receiver required'; end if;
  if p_receiver_user_id = v_uid then raise exception 'cannot cheer yourself'; end if;
  if p_cheer_type not in ('clap', 'sticker', 'comment') then raise exception 'invalid cheer_type'; end if;

  select exists (select 1 from auth.users where id = p_receiver_user_id) into v_receiver_exists;
  if not v_receiver_exists then raise exception 'receiver not found'; end if;

  perform public.ensure_boxing_engagement_profile(v_uid);
  perform public.ensure_boxing_engagement_profile(p_receiver_user_id);

  if v_sticker_mode then
    -- 같은 지점 동료끼리 — 본사는 켜 둔 지점 회원
    v_hq := public._dm_kind(v_uid) = 'hq';
    select branch_name into v_sender_branch from public.profiles where user_id = v_uid;
    select branch_name into v_receiver_branch from public.profiles where user_id = p_receiver_user_id;
    if v_hq then
      if v_receiver_branch is distinct from v_sender_branch and not public.is_branch_visible(v_receiver_branch) then
        raise exception '지금은 응원을 보낼 수 없는 지점의 회원이에요';
      end if;
    elsif v_sender_branch is null or v_receiver_branch is distinct from v_sender_branch then
      raise exception '같은 지점 동료에게만 응원을 보낼 수 있어요';
    end if;

    if v_msg = '' then raise exception '스티커를 골라 주세요'; end if;
    if public._cheer_has_bad_word(v_msg) then
      raise exception '한마디에 쓸 수 없는 말이 들어 있어요. 고쳐서 다시 보내 주세요';
    end if;

    select count(*) into v_total_today
      from public.boxing_cheers
     where sender_user_id = v_uid and cheer_type in ('sticker', 'comment') and created_at >= v_day_start;
    select count(*) into v_to_receiver_today
      from public.boxing_cheers
     where sender_user_id = v_uid and receiver_user_id = p_receiver_user_id
       and cheer_type in ('sticker', 'comment') and created_at >= v_day_start;
    if v_to_receiver_today > 0 then
      raise exception '오늘은 이 동료에게 이미 응원을 보냈어요. 내일 또 보내 주세요';
    end if;
    if v_total_today >= 10 then
      raise exception '오늘 보낼 수 있는 응원 10번을 모두 썼어요. 내일 또 보내 주세요';
    end if;

    v_respect := 5;
    v_first := v_total_today = 0;
    -- 화면이 보내는 모양: '스티커' 또는 '스티커 — 한마디'
    v_pos := position(' — ' in v_msg);
    if v_pos > 0 then
      v_sticker := left(v_msg, v_pos - 1);
      v_note := nullif(btrim(substr(v_msg, v_pos + 3)), '');
    else
      v_sticker := v_msg;
      v_note := null;
    end if;
  else
    -- 타이틀매치 박수 — 예전 규칙 그대로 (하루 20번 · 같은 사람 3번까지 리스펙트)
    select count(*) into v_total_today
      from public.boxing_cheers
     where sender_user_id = v_uid and respect_granted > 0
       and (created_at at time zone 'Asia/Seoul')::date = v_today;
    select count(*) into v_to_receiver_today
      from public.boxing_cheers
     where sender_user_id = v_uid and receiver_user_id = p_receiver_user_id and respect_granted > 0
       and (created_at at time zone 'Asia/Seoul')::date = v_today;
    if v_total_today < 20 and v_to_receiver_today < 3 then
      v_respect := 5;
    end if;
  end if;

  insert into public.boxing_cheers (
    id, sender_user_id, receiver_user_id, cheer_type, message,
    source_type, source_id, respect_granted, gems_granted_to_receiver, metadata
  ) values (
    v_cheer_id, v_uid, p_receiver_user_id, p_cheer_type, nullif(v_msg, ''),
    p_source_type, p_source_id, v_respect, v_receiver_gems,
    case when v_sticker_mode then jsonb_build_object('sticker', v_sticker, 'note', v_note) else '{}'::jsonb end
  );

  if v_respect > 0 then
    v_idem := concat('cheer_send:', v_cheer_id::text);
    insert into public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) values (
      v_uid, 'reward', 'boxing_cheer', v_cheer_id, 'cheer_sent',
      0, 0, v_respect, v_idem,
      jsonb_build_object('receiver', p_receiver_user_id, 'cheer_type', p_cheer_type)
    )
    on conflict (user_id, idempotency_key) do nothing;

    insert into public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) values (
      p_receiver_user_id, 'reward', 'boxing_cheer', v_cheer_id, 'cheer_received',
      0, v_receiver_gems, 1,
      concat('cheer_recv:', v_cheer_id::text),
      jsonb_build_object('sender', v_uid, 'cheer_type', p_cheer_type)
    )
    on conflict (user_id, idempotency_key) do nothing;

    update public.boxing_engagement_profiles
       set cheer_sent_count = cheer_sent_count + 1,
           respect_points = respect_points + v_respect
     where user_id = v_uid;
    update public.boxing_engagement_profiles
       set cheer_received_count = cheer_received_count + 1,
           respect_points = respect_points + 1
     where user_id = p_receiver_user_id;
  else
    update public.boxing_engagement_profiles
       set cheer_sent_count = cheer_sent_count + 1
     where user_id = v_uid;
    update public.boxing_engagement_profiles
       set cheer_received_count = cheer_received_count + 1
     where user_id = p_receiver_user_id;
  end if;

  -- 하루 첫 응원 — 챔피언 머니 +30
  if v_first then
    perform public.grant_gems(v_uid, 30, '오늘 첫 응원 보상');
    v_sender_gems := 30;
  end if;

  -- 받은 사람 알림 (알림함 + 휴대폰). 그날 받은 응원 3번째까지만 휴대폰으로, 그다음은 알림함에만
  if v_sticker_mode and coalesce((select p.cheer_notify from public.profiles p where p.user_id = p_receiver_user_id), true) then
    select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
      into v_sender_name from public.profiles p where p.user_id = v_uid;
    select count(*) into v_recv_today
      from public.boxing_cheers
     where receiver_user_id = p_receiver_user_id and cheer_type in ('sticker', 'comment')
       and created_at >= v_day_start and id <> v_cheer_id;
    insert into public.notifications (user_id, title, body, link, pushed_at)
    values (
      p_receiver_user_id,
      '📣 ' || coalesce(v_sender_name, '동료') || '님이 응원을 보냈어요',
      '“' || v_sticker || '”' || coalesce(' — ' || v_note, ''),
      '/mypage?cheers=1',
      -- pushed_at 을 미리 찍으면 휴대폰으로는 안 나간다 (push_claim_notifications 는 pushed_at 이 빈 알림만 보낸다)
      case when v_recv_today >= 3 then now() else null end
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'cheer_id', v_cheer_id,
    'respect_granted', v_respect,
    'receiver_gems_granted', v_receiver_gems,
    'sender_gems_granted', v_sender_gems,
    'first_today', v_first,
    'sender_daily_count_today', v_total_today + 1,
    'remaining_today', case when v_sticker_mode then greatest(0, 10 - (v_total_today + 1)) else null end,
    'limit_reached', v_respect = 0,
    'message', case
      when not v_sticker_mode and v_respect = 0 then '오늘 응원 한도를 모두 사용했어요. 기록은 남습니다.'
      when v_first then '오늘 첫 응원! 챔피언 머니 +30'
      else '응원 전송!'
    end
  );
end;
$function$;

-- 5) 받을 사람 고르기
create or replace function public.get_cheer_candidates(p_search text default null, p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hq boolean;
  v_branch text;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_q text := left(nullif(btrim(coalesce(p_search, '')), ''), 30);
  v_pat text;
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_sent integer;
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_hq := public._dm_kind(v_uid) = 'hq';
  select branch_name into v_branch from public.profiles where user_id = v_uid;
  select count(*) into v_sent
    from public.boxing_cheers
   where sender_user_id = v_uid and cheer_type in ('sticker', 'comment') and created_at >= v_day_start;
  if not v_hq and v_branch is null then
    return jsonb_build_object('branch', null, 'all_branches', false, 'sent_today', v_sent, 'daily_limit', 10, 'members', '[]'::jsonb);
  end if;
  -- 보이는 이름으로만 찾는다 (닉네임을 정한 회원은 실명으로 역추적되지 않게)
  v_pat := case when v_q is null then null
                else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with base as (
    select p.user_id,
           coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') as nickname,
           p.avatar_url, p.branch_name, p.birth_date,
           coalesce(p.community_auto_post, true) as shows,
           mp.current_rank::text as rank_name, mp.current_level as lvl
      from public.profiles p
      left join public.member_progress mp on mp.user_id = p.user_id
     where p.user_id <> v_uid
       and ((v_hq and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)
       -- 코치·지점장·관리자·체험 계정은 뺀다
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
       and exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role = 'member')
       and not exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role <> 'member')
       and (v_pat is null
            or coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '') ilike v_pat escape '\')
  ),
  sess as (
    select s.user_id, max(s.started_at) as at
      from public.activity_sessions s
     where s.status = 'active' and s.ended_at is null and s.started_at >= now() - interval '60 minutes'
       and s.user_id in (select b.user_id from base b)
     group by s.user_id
  ),
  att as (
    select a.user_id,
           max(a.checked_in_at) filter (where a.checked_in_at >= v_day_start and a.checked_in_at <= now()) as today_at,
           max(a.checked_in_at) filter (where a.checked_in_at <= now()) as last_at,
           max(a.checked_in_at) filter (where a.checked_in_at < v_day_start) as prev_at
      from public.attendance_logs a
     where a.user_id in (select b.user_id from base b)
     group by a.user_id
  ),
  sent as (
    select distinct c.receiver_user_id as user_id
      from public.boxing_cheers c
     where c.sender_user_id = v_uid and c.cheer_type in ('sticker', 'comment') and c.created_at >= v_day_start
  ),
  r0 as (
    select b.*,
           -- '출석하면 커뮤니티에 알리기'를 끈 회원은 지금·오늘 표시 없이 최근 목록에만 (본사는 그대로)
           case when (v_hq or b.shows) and (s.at is not null or att.today_at >= now() - interval '120 minutes') then 'now'
                when (v_hq or b.shows) and att.today_at is not null then 'today'
                else 'recent' end as grp,
           coalesce(s.at, att.today_at) as since,
           att.last_at, att.prev_at,
           (sent.user_id is not null) as cheered
      from base b
      left join sess s on s.user_id = b.user_id
      left join att on att.user_id = b.user_id
      left join sent on sent.user_id = b.user_id
  ),
  r1 as (
    select r0.*,
           row_number() over (partition by (r0.grp = 'recent')
                              order by r0.last_at desc nulls last, r0.lvl desc nulls last, r0.nickname) as rn
      from r0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', r.user_id,
           'nickname', r.nickname,
           'avatar_url', r.avatar_url,
           'branch', r.branch_name,
           'league', coalesce(r.rank_name, 'white'),
           'level', (coalesce(array_position(v_order, r.rank_name), 1) - 1) * 10 + coalesce(r.lvl, 1),
           'group', r.grp,
           'since', case when r.grp <> 'recent' then r.since end,
           'last_at', r.last_at,
           'cheered_today', r.cheered,
           -- 상황 추천은 오늘 온 동료에게만 (TV 생일 축하와 같은 범위)
           -- profiles.birth_date 는 글자('1991-10-16' 또는 '19911016')
           'birthday', r.grp <> 'recent' and length(regexp_replace(coalesce(r.birth_date, ''), '\D', '', 'g')) = 8
                       and substr(regexp_replace(r.birth_date, '\D', '', 'g'), 5, 4) = to_char(v_today, 'MMDD'),
           'promoted', r.grp <> 'recent' and exists (
                         select 1 from public.level_status_history h
                          where h.user_id = r.user_id and h.new_status = 'boss_cleared'
                            and h.created_at >= now() - interval '3 days'),
           'returning', r.grp <> 'recent' and r.prev_at is not null and r.prev_at < v_day_start - interval '14 days'
         ) order by case r.grp when 'now' then 0 when 'today' then 1 else 2 end,
                    r.since desc nulls last, r.last_at desc nulls last, r.nickname), '[]'::jsonb)
    into v_out
    from r1 r
   where r.grp <> 'recent' or r.rn <= v_limit;

  return jsonb_build_object('branch', v_branch, 'all_branches', v_hq, 'sent_today', v_sent,
                            'daily_limit', 10, 'members', v_out);
end $$;

-- 6) 받은 응원함
create or replace function public.get_my_received_cheers(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_unthanked integer;
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select count(*), count(*) filter (where c.thanked_at is null)
    into v_total, v_unthanked
    from public.boxing_cheers c where c.receiver_user_id = v_uid;

  select coalesce(jsonb_agg(x.item order by x.at desc), '[]'::jsonb) into v_out
    from (
      select c.created_at as at,
             jsonb_build_object(
               'id', c.id,
               'type', c.cheer_type,
               'sender_id', c.sender_user_id,
               'sender', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료'),
               'sender_avatar', p.avatar_url,
               'sender_staff', coalesce(p.is_staff, false),
               'sticker', case when c.cheer_type = 'clap' then '승급 축하 박수'
                               else coalesce(nullif(c.metadata->>'sticker', ''), split_part(coalesce(c.message, ''), ' — ', 1)) end,
               'note', case when c.cheer_type = 'clap' then null
                            when c.metadata ? 'sticker' then nullif(c.metadata->>'note', '')
                            when position(' — ' in coalesce(c.message, '')) > 0
                              then nullif(btrim(substr(c.message, position(' — ' in c.message) + 3)), '')
                            else null end,
               'at', c.created_at,
               'thanked', c.thanked_at is not null
             ) as item
        from public.boxing_cheers c
        left join public.profiles p on p.user_id = c.sender_user_id
       where c.receiver_user_id = v_uid
       order by c.created_at desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) x;

  return jsonb_build_object('total', v_total, 'unthanked', v_unthanked, 'items', v_out);
end $$;

-- 6) 고마워요 153 — 보낸 사람에게 알림
create or replace function public.thank_cheer(p_cheer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.boxing_cheers%rowtype;
  v_name text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select * into v_c from public.boxing_cheers where id = p_cheer_id;
  if not found or v_c.receiver_user_id <> v_uid then raise exception '응원을 찾을 수 없어요'; end if;
  if v_c.thanked_at is not null then
    return jsonb_build_object('success', true, 'already', true);
  end if;

  update public.boxing_cheers set thanked_at = now() where id = p_cheer_id;

  if coalesce((select p.cheer_notify from public.profiles p where p.user_id = v_c.sender_user_id), true) then
    select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
      into v_name from public.profiles p where p.user_id = v_uid;
    insert into public.notifications (user_id, title, body, link)
    values (
      v_c.sender_user_id,
      '🙏 ' || coalesce(v_name, '동료') || '님이 고마워요 153을 보냈어요',
      '보낸 응원 “' || coalesce(nullif(v_c.metadata->>'sticker', ''), nullif(split_part(coalesce(v_c.message, ''), ' — ', 1), ''), '응원') || '”에 답장이 왔어요',
      '/myboxer/community'
    );
  end if;
  return jsonb_build_object('success', true);
end $$;

-- 7) 라이센스 '받은 응원' — 받은 수 + 많이 받은 스티커 3개
create or replace function public.get_member_cheer_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_top jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select count(*) into v_total
    from public.boxing_cheers where receiver_user_id = p_user_id and cheer_type in ('sticker', 'comment');
  select coalesce(jsonb_agg(jsonb_build_object('sticker', t.s, 'count', t.n) order by t.n desc, t.s), '[]'::jsonb)
    into v_top
    from (
      select coalesce(nullif(metadata->>'sticker', ''), split_part(coalesce(message, ''), ' — ', 1)) as s, count(*) as n
        from public.boxing_cheers
       where receiver_user_id = p_user_id and cheer_type in ('sticker', 'comment')
       group by 1
       order by 2 desc, 1
       limit 3
    ) t
   where t.s <> '';
  return jsonb_build_object('total', v_total, 'top', v_top);
end $$;

-- 내정보 '응원 알림 받기'
create or replace function public.set_cheer_notify(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  update public.profiles set cheer_notify = coalesce(p_on, true) where user_id = auth.uid();
  return jsonb_build_object('success', true, 'on', coalesce(p_on, true));
end $$;

revoke all on function public.get_cheer_candidates(text, integer) from public, anon;
revoke all on function public.get_my_received_cheers(integer) from public, anon;
revoke all on function public.thank_cheer(uuid) from public, anon;
revoke all on function public.get_member_cheer_summary(uuid) from public, anon;
revoke all on function public.set_cheer_notify(boolean) from public, anon;
grant execute on function public.get_cheer_candidates(text, integer) to authenticated;
grant execute on function public.get_my_received_cheers(integer) to authenticated;
grant execute on function public.thank_cheer(uuid) to authenticated;
grant execute on function public.get_member_cheer_summary(uuid) to authenticated;
grant execute on function public.set_cheer_notify(boolean) to authenticated;
